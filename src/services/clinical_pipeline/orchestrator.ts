/**
 * Clinical Pipeline Orchestrator (Optimized)
 * 
 * Modular pipeline that coordinates all service layers.
 * Key optimization: After hypothesis_engine, runs knowledge_retrieval,
 * guideline_engine, and oversight_engine in PARALLEL.
 * 
 * Target latency: < 8 seconds (down from ~25s).
 * 
 * Pipeline stages:
 *   1. build_context()        → Clinical Context Engine (sync)
 *   2. generate_hypotheses()  → Diagnostic Hypothesis Engine
 *   3. [PARALLEL] retrieve_evidence() + evaluate_guidelines() + oversight_report()
 */

import { isNewPipelineEnabled } from "@/services/feature_flags";
import { withStageLogging, clearPipelineLogs, getPipelineLogs } from "@/services/pipeline_logger";
import { 
  buildEnrichedContext, 
  validateContextCompleteness,
  type EnrichedClinicalContext 
} from "@/services/clinical_context";
import type { ClinicalContext } from "@/lib/clinical-context";
import { generateHypotheses, type HypothesisResult } from "@/services/hypothesis_engine";
import { evaluateGuidelineAlignment, type GuidelineAlignmentResult } from "@/services/guideline_engine";
import { 
  recordOversightEvent, 
  generateOversightReport, 
  clearOversightEvents,
  type OversightReport 
} from "@/services/oversight_engine";
import { queryEvidence, type EvidenceQueryResult } from "@/services/knowledge_ingestion";
import { getCached, setCache } from "@/services/knowledge_cache";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineInput {
  clinical_context: ClinicalContext;
  visit_id?: string | null;
  consultation_id?: string | null;
  clinic_id?: string | null;
  intake_approved?: boolean;
  recommendations?: {
    diagnosis?: string;
    drugs?: string[];
    labs?: string[];
    care_plan?: string;
  };
}

export interface PipelineResult {
  enabled: boolean;
  enriched_context: EnrichedClinicalContext | null;
  hypotheses: HypothesisResult | null;
  guideline_alignment: GuidelineAlignmentResult | null;
  evidence: EvidenceQueryResult | null;
  oversight: OversightReport | null;
  guideline_summary: {
    guideline_sources_used: string[];
    guideline_compliance_score: number;
    conflicts_detected: Array<{ recommendation: string; conflicting_guideline: string; organization: string; severity: string; explanation: string }>;
  } | null;
  logs: ReturnType<typeof getPipelineLogs>;
  /** Per-stage latency in ms */
  stage_latencies: Record<string, number>;
  total_latency_ms: number;
}

/** Callback for streaming partial results to the UI */
export type PipelineProgressCallback = (stage: string, data: Partial<PipelineResult>) => void;

const STAGE_TIMEOUT_MS = 5000; // 5 second timeout per stage

/**
 * Race a promise against a timeout. Returns null on timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  stageName: string
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[Pipeline] ⏱️ ${stageName} timed out after ${timeoutMs}ms`);
        resolve(null);
      }, timeoutMs)
    ),
  ]);
}

/**
 * Run the full clinical pipeline with parallelization and caching.
 */
export async function runClinicalPipeline(
  input: PipelineInput,
  onProgress?: PipelineProgressCallback
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const stageLatencies: Record<string, number> = {};

  if (!isNewPipelineEnabled()) {
    console.log("[Pipeline] New clinical pipeline is disabled. Using legacy flow.");
    return {
      enabled: false,
      enriched_context: null,
      hypotheses: null,
      guideline_alignment: null,
      evidence: null,
      oversight: null,
      guideline_summary: null,
      logs: [],
      stage_latencies: {},
      total_latency_ms: 0,
    };
  }

  clearPipelineLogs();
  clearOversightEvents();
  console.log("[Pipeline] Starting optimized modular pipeline...");

  // ── Stage 1: Build Context (sync, fast) ──
  const ctxStart = performance.now();
  const enrichedContext = await withStageLogging("build_context", async () => {
    const ctx = buildEnrichedContext(input.clinical_context, {
      visit_id: input.visit_id,
      consultation_id: input.consultation_id,
      clinic_id: input.clinic_id,
      intake_approved: input.intake_approved,
    });
    const missing = validateContextCompleteness(input.clinical_context);
    if (missing.length > 0) {
      recordOversightEvent({
        event_type: "context_incomplete",
        severity: missing.includes("chief_complaint") ? "warning" : "info",
        stage: "build_context",
        message: `Missing fields: ${missing.join(", ")}`,
        metadata: { missing_fields: missing },
      });
    }
    return ctx;
  });
  stageLatencies.build_context = Math.round(performance.now() - ctxStart);

  // ── Stage 2: Generate Hypotheses ──
  let hypotheses: HypothesisResult | null = null;
  const hypStart = performance.now();
  try {
    hypotheses = await withStageLogging("generate_hypotheses", async () => {
      const result = await generateHypotheses(enrichedContext);
      if (result.hypotheses.length === 0) {
        recordOversightEvent({
          event_type: "hypothesis_low_confidence",
          severity: "info",
          stage: "generate_hypotheses",
          message: "No hypotheses generated (stub mode or insufficient data)",
        });
      }
      return result;
    });
  } catch {
    hypotheses = null;
  }
  stageLatencies.generate_hypotheses = Math.round(performance.now() - hypStart);

  // Stream hypotheses to UI immediately
  onProgress?.("hypotheses", { hypotheses });

  // ── Stage 3: PARALLEL — Evidence + Guidelines + Oversight ──
  const parallelStart = performance.now();

  const [evidence, guidelineAlignment, oversight] = await Promise.all([
    // 3a: Evidence retrieval with caching + timeout
    (async (): Promise<EvidenceQueryResult | null> => {
      if (!input.clinical_context.chief_complaint) return null;
      const query = input.clinical_context.chief_complaint;
      const start = performance.now();
      try {
        // Check cache first
        const cached = await getCached<EvidenceQueryResult>(query, "evidence");
        if (cached.hit && cached.data) {
          console.log("[Pipeline] Cache HIT for evidence query");
          stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
          return cached.data;
        }

        // Fetch with timeout
        const result = await withTimeout(
          withStageLogging("retrieve_evidence", () => queryEvidence(query, { maxResults: 5 })),
          STAGE_TIMEOUT_MS,
          "retrieve_evidence"
        );

        if (result) {
          // Cache result (non-blocking)
          setCache(query, "evidence", result, 12);
          stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
          return result;
        }

        // Timeout: try cache even if expired
        const staleCache = await getCached<EvidenceQueryResult>(query, "evidence_stale");
        stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
        return staleCache.data;
      } catch {
        stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
        return null;
      }
    })(),

    // 3b: Guideline alignment with caching + timeout
    (async (): Promise<GuidelineAlignmentResult | null> => {
      if (!input.recommendations) return null;
      const start = performance.now();
      const cacheKey = JSON.stringify(input.recommendations);
      try {
        const cached = await getCached<GuidelineAlignmentResult>(cacheKey, "guideline");
        if (cached.hit && cached.data) {
          console.log("[Pipeline] Cache HIT for guideline query");
          stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
          return cached.data;
        }

        const result = await withTimeout(
          withStageLogging("retrieve_guidelines", () =>
            evaluateGuidelineAlignment(input.recommendations!, enrichedContext)
          ),
          STAGE_TIMEOUT_MS,
          "retrieve_guidelines"
        );

        if (result) {
          setCache(cacheKey, "guideline", result, 6);
          stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
          return result;
        }

        stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
        return null;
      } catch {
        stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
        return null;
      }
    })(),

    // 3c: Oversight report (fast, in-memory)
    (async (): Promise<OversightReport> => {
      const start = performance.now();
      const report = await withStageLogging("oversight_report", async () =>
        generateOversightReport(input.visit_id ?? null, input.consultation_id ?? null)
      );
      stageLatencies.oversight_report = Math.round(performance.now() - start);
      return report;
    })(),
  ]);

  stageLatencies.parallel_total = Math.round(performance.now() - parallelStart);

  // Stream evidence + guidelines to UI
  onProgress?.("evidence", { evidence });
  onProgress?.("guidelines", { guideline_alignment: guidelineAlignment });
  onProgress?.("safety", { oversight });

  const totalLatency = Math.round(performance.now() - pipelineStart);
  stageLatencies.total = totalLatency;

  console.log(`[Pipeline] Complete in ${totalLatency}ms. Safety score: ${oversight.safety_score}/100`);

  // Record latency metrics (non-blocking)
  supabase
    .from("monitoring_events")
    .insert({
      event_type: "pipeline_latency",
      pipeline_type: "modular",
      total_latency_ms: totalLatency,
      stage_latencies: stageLatencies,
      visit_id: input.visit_id || null,
      clinic_id: input.clinic_id || null,
      metadata: {
        cache_hits: {
          evidence: !!(evidence && stageLatencies.retrieve_evidence && stageLatencies.retrieve_evidence < 100),
          guideline: !!(guidelineAlignment && stageLatencies.retrieve_guidelines && stageLatencies.retrieve_guidelines < 100),
        },
        hypothesis_count: hypotheses?.hypotheses.length || 0,
        evidence_count: evidence?.items.length || 0,
        safety_score: oversight.safety_score,
      },
    })
    .then(() => {});

  const guideline_summary = guidelineAlignment
    ? {
        guideline_sources_used: guidelineAlignment.guideline_sources_used,
        guideline_compliance_score: guidelineAlignment.guideline_compliance_score,
        conflicts_detected: guidelineAlignment.conflicts_detected,
      }
    : null;

  return {
    enabled: true,
    enriched_context: enrichedContext,
    hypotheses,
    guideline_alignment: guidelineAlignment,
    evidence,
    oversight,
    guideline_summary,
    logs: getPipelineLogs(),
    stage_latencies: stageLatencies,
    total_latency_ms: totalLatency,
  };
}
