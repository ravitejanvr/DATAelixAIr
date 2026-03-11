/**
 * Clinical Pipeline Orchestrator (v3 — Performance Optimized)
 * 
 * Target latency: < 10 seconds
 * 
 * Optimizations:
 *   1. DDX + Knowledge Retrieval run in parallel (Stage 2)
 *   2. Reasoning cache for symptom cluster memoization
 *   3. Pre-indexed knowledge short-circuits common conditions
 *   4. Streaming progress callbacks at every stage
 *   5. Aggressive timeouts (3s per stage, 8s for parallel blocks)
 *   6. Multi-agent orchestrator runs in background (non-blocking)
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
import { 
  getCached, setCache, 
  getReasoningCache, setReasoningCache,
  getPreindexedKnowledge, searchPreindexedBySymptoms,
} from "@/services/knowledge_cache";
import { runDDXEngine, type DDXResult } from "@/services/ddx_engine/client";
import { runUncertaintyEngine, type UncertaintyResult } from "@/services/uncertainty_engine/client";
import { runHybridReasoning, type HybridReasoningResult } from "@/services/reasoning_engine/client";
import { runMultiAgentPipeline, type OrchestratorResponse } from "@/services/multi_agent";
import { generatePhysiologicalContext, type PhysiologicalContextResult } from "@/services/physiology_engine";
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
  physiological_context: PhysiologicalContextResult | null;
  ddx: DDXResult | null;
  uncertainty: UncertaintyResult | null;
  hypotheses: HypothesisResult | null;
  guideline_alignment: GuidelineAlignmentResult | null;
  evidence: EvidenceQueryResult | null;
  oversight: OversightReport | null;
  hybrid_reasoning: HybridReasoningResult | null;
  multi_agent: OrchestratorResponse | null;
  guideline_summary: {
    guideline_sources_used: string[];
    guideline_compliance_score: number;
    conflicts_detected: Array<{ recommendation: string; conflicting_guideline: string; organization: string; severity: string; explanation: string }>;
  } | null;
  logs: ReturnType<typeof getPipelineLogs>;
  stage_latencies: Record<string, number>;
  total_latency_ms: number;
  cache_stats: { reasoning_hit: boolean; preindexed_hit: boolean; evidence_hit: boolean; guideline_hit: boolean };
}

/** Callback for streaming partial results to the UI */
export type PipelineProgressCallback = (stage: string, data: Partial<PipelineResult>) => void;

const FAST_TIMEOUT_MS = 3000;
const PARALLEL_TIMEOUT_MS = 4000;

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
 * Extract symptoms array from clinical context.
 */
function extractSymptoms(ctx: ClinicalContext): string[] {
  const symptoms: string[] = [];
  if (ctx.chief_complaint) symptoms.push(ctx.chief_complaint);
  if ((ctx as any).symptoms) symptoms.push(...(ctx as any).symptoms);
  return [...new Set(symptoms)];
}

/**
 * Run the full clinical pipeline — optimized for sub-10s latency.
 */
export async function runClinicalPipeline(
  input: PipelineInput,
  onProgress?: PipelineProgressCallback
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const stageLatencies: Record<string, number> = {};
  const cacheStats = { reasoning_hit: false, preindexed_hit: false, evidence_hit: false, guideline_hit: false };

  const emptyResult: PipelineResult = {
    enabled: false, enriched_context: null, ddx: null, uncertainty: null,
    hypotheses: null, guideline_alignment: null, evidence: null, oversight: null,
    hybrid_reasoning: null, multi_agent: null, guideline_summary: null,
    logs: [], stage_latencies: {}, total_latency_ms: 0, cache_stats: cacheStats,
  };

  if (!isNewPipelineEnabled()) {
    console.log("[Pipeline] Disabled. Using legacy flow.");
    return emptyResult;
  }

  clearPipelineLogs();
  clearOversightEvents();
  const symptoms = extractSymptoms(input.clinical_context);
  console.log("[Pipeline] v3 starting — target <10s...");

  // ═══════════════════════════════════════════════
  // FAST PATH: Check reasoning cache for this symptom cluster
  // ═══════════════════════════════════════════════
  const cacheCheckStart = performance.now();
  const cachedReasoning = await getReasoningCache(symptoms);
  stageLatencies.cache_check = Math.round(performance.now() - cacheCheckStart);

  if (cachedReasoning.hit && cachedReasoning.data) {
    console.log("[Pipeline] ⚡ Reasoning cache HIT — returning memoized result");
    cacheStats.reasoning_hit = true;
    const cached = cachedReasoning.data as Partial<PipelineResult>;
    onProgress?.("complete", cached);
    return {
      ...emptyResult,
      enabled: true,
      ...cached,
      cache_stats: cacheStats,
      stage_latencies: { cache_check: stageLatencies.cache_check, total: stageLatencies.cache_check },
      total_latency_ms: stageLatencies.cache_check,
    };
  }

  // ═══════════════════════════════════════════════
  // Stage 1: Build Context (sync, ~5ms)
  // ═══════════════════════════════════════════════
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
  onProgress?.("context", { enriched_context: enrichedContext });

  // ═══════════════════════════════════════════════
  // Stage 2: PARALLEL — DDX + Knowledge + Preindexed
  //   Key optimization: DDX and knowledge retrieval run simultaneously
  // ═══════════════════════════════════════════════
  const stage2Start = performance.now();

  const [ddxResult, evidence, preindexedMatches] = await Promise.all([
    // 2a: DDX Engine
    (async (): Promise<DDXResult | null> => {
      const start = performance.now();
      try {
        const result = await withTimeout(
          withStageLogging("ddx_engine", () =>
            runDDXEngine({
              symptoms,
              vitals: {
                temperature: input.clinical_context.temperature,
                spo2: input.clinical_context.oxygen_saturation,
                pulse: input.clinical_context.pulse,
                bp: input.clinical_context.blood_pressure,
              },
              age: input.clinical_context.patient_age,
              sex: input.clinical_context.patient_sex,
              medical_history: input.clinical_context.medical_history,
              current_medications: input.clinical_context.current_medications,
              allergies: input.clinical_context.allergies,
              visit_id: input.visit_id,
              clinic_id: input.clinic_id,
            })
          ),
          PARALLEL_TIMEOUT_MS,
          "ddx_engine"
        );
        stageLatencies.ddx_engine = Math.round(performance.now() - start);
        if (result?.dangerous_diagnoses_injected && result.dangerous_diagnoses_injected > 0) {
          recordOversightEvent({
            event_type: "dangerous_diagnosis_injected",
            severity: "warning",
            stage: "ddx_engine",
            message: `${result.dangerous_diagnoses_injected} must-not-miss diagnoses injected`,
            metadata: { dangerous_count: result.dangerous_diagnoses_injected },
          });
        }
        return result;
      } catch {
        stageLatencies.ddx_engine = Math.round(performance.now() - start);
        return null;
      }
    })(),

    // 2b: Evidence retrieval (parallel with DDX)
    (async (): Promise<EvidenceQueryResult | null> => {
      if (!input.clinical_context.chief_complaint) return null;
      const query = input.clinical_context.chief_complaint;
      const start = performance.now();
      try {
        const cached = await getCached<EvidenceQueryResult>(query, "evidence");
        if (cached.hit && cached.data) {
          cacheStats.evidence_hit = true;
          stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
          return cached.data;
        }
        const result = await withTimeout(
          withStageLogging("retrieve_evidence", () => queryEvidence(query, { maxResults: 5 })),
          PARALLEL_TIMEOUT_MS,
          "retrieve_evidence"
        );
        if (result) setCache(query, "evidence", result, 12);
        stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
        return result;
      } catch {
        stageLatencies.retrieve_evidence = Math.round(performance.now() - start);
        return null;
      }
    })(),

    // 2c: Pre-indexed knowledge lookup (instant, <50ms)
    (async () => {
      const start = performance.now();
      try {
        // Try exact condition match first
        if (input.clinical_context.chief_complaint) {
          const exact = await getPreindexedKnowledge(input.clinical_context.chief_complaint);
          if (exact.hit) {
            cacheStats.preindexed_hit = true;
            stageLatencies.preindexed_lookup = Math.round(performance.now() - start);
            return [exact.data!];
          }
        }
        // Fallback: symptom overlap search
        const matches = await searchPreindexedBySymptoms(symptoms, 3);
        if (matches.length > 0) cacheStats.preindexed_hit = true;
        stageLatencies.preindexed_lookup = Math.round(performance.now() - start);
        return matches;
      } catch {
        stageLatencies.preindexed_lookup = Math.round(performance.now() - start);
        return [];
      }
    })(),
  ]);

  stageLatencies.stage2_parallel = Math.round(performance.now() - stage2Start);

  // Stream DDX + evidence immediately
  onProgress?.("ddx", { ddx: ddxResult });
  onProgress?.("evidence", { evidence });

  // ═══════════════════════════════════════════════
  // Stage 3: PARALLEL — Hypotheses + Guidelines + Oversight + Uncertainty
  //   All can run concurrently since they depend only on context + DDX
  // ═══════════════════════════════════════════════
  const stage3Start = performance.now();

  const [hypotheses, guidelineAlignment, oversight, uncertaintyResult] = await Promise.all([
    // 3a: Hypotheses
    (async (): Promise<HypothesisResult | null> => {
      const start = performance.now();
      try {
        const result = await withTimeout(
          withStageLogging("generate_hypotheses", () => generateHypotheses(enrichedContext)),
          FAST_TIMEOUT_MS,
          "generate_hypotheses"
        );
        stageLatencies.generate_hypotheses = Math.round(performance.now() - start);
        return result;
      } catch {
        stageLatencies.generate_hypotheses = Math.round(performance.now() - start);
        return null;
      }
    })(),

    // 3b: Guideline alignment (with cache)
    (async (): Promise<GuidelineAlignmentResult | null> => {
      if (!input.recommendations) return null;
      const start = performance.now();
      const cacheKey = JSON.stringify(input.recommendations);
      try {
        const cached = await getCached<GuidelineAlignmentResult>(cacheKey, "guideline");
        if (cached.hit && cached.data) {
          cacheStats.guideline_hit = true;
          stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
          return cached.data;
        }
        const result = await withTimeout(
          withStageLogging("retrieve_guidelines", () =>
            evaluateGuidelineAlignment(input.recommendations!, enrichedContext)
          ),
          FAST_TIMEOUT_MS,
          "retrieve_guidelines"
        );
        if (result) setCache(cacheKey, "guideline", result, 6);
        stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
        return result;
      } catch {
        stageLatencies.retrieve_guidelines = Math.round(performance.now() - start);
        return null;
      }
    })(),

    // 3c: Oversight (fast, in-memory)
    (async () => {
      const start = performance.now();
      const report = await withStageLogging<OversightReport>("oversight_report", async () =>
        generateOversightReport(input.visit_id ?? null, input.consultation_id ?? null)
      );
      stageLatencies.oversight_report = Math.round(performance.now() - start);
      return report;
    })(),

    // 3d: Uncertainty Engine (moved to parallel — no longer depends on oversight)
    (async (): Promise<UncertaintyResult | null> => {
      const start = performance.now();
      try {
        const result = await withTimeout(
          runUncertaintyEngine({
            symptoms: ddxResult?.matched_symptoms || symptoms,
            vitals: {
              temperature: input.clinical_context.temperature,
              spo2: input.clinical_context.oxygen_saturation,
              pulse: input.clinical_context.pulse,
              bp: input.clinical_context.blood_pressure,
            },
            differential_diagnoses: ddxResult?.differential_diagnoses || [],
            suggested_labs: ddxResult?.recommended_labs || [],
            guideline_sources: [],
            guideline_recommendations: ddxResult?.guideline_recommendations?.map(g => ({
              authority: g.authority,
              evidence_level: g.evidence_level,
            })) || [],
            safety_flags: [],
            safety_score: 80,
            medical_history: input.clinical_context.medical_history,
            current_medications: input.clinical_context.current_medications,
            allergies: input.clinical_context.allergies,
            matched_symptoms: ddxResult?.matched_symptoms || [],
            unmatched_symptoms: ddxResult?.unmatched_symptoms || [],
          }),
          FAST_TIMEOUT_MS,
          "uncertainty_engine"
        );
        stageLatencies.uncertainty_engine = Math.round(performance.now() - start);
        return result;
      } catch {
        stageLatencies.uncertainty_engine = Math.round(performance.now() - start);
        return null;
      }
    })(),
  ]);

  stageLatencies.stage3_parallel = Math.round(performance.now() - stage3Start);

  // Stream all stage 3 results
  onProgress?.("hypotheses", { hypotheses });
  onProgress?.("guidelines", { guideline_alignment: guidelineAlignment });
  onProgress?.("safety", { oversight });
  onProgress?.("uncertainty", { uncertainty: uncertaintyResult });

  // ═══════════════════════════════════════════════
  // Stage 4: Hybrid Reasoning (final synthesis)
  // ═══════════════════════════════════════════════
  let hybridReasoning: HybridReasoningResult | null = null;
  const reasoningStart = performance.now();
  try {
    hybridReasoning = await withTimeout(
      runHybridReasoning({
        symptoms,
        chief_complaint: input.clinical_context.chief_complaint,
        vitals: {
          temperature: input.clinical_context.temperature,
          spo2: input.clinical_context.oxygen_saturation,
          pulse: input.clinical_context.pulse,
          bp: input.clinical_context.blood_pressure,
        },
        patient_age: input.clinical_context.patient_age,
        patient_sex: input.clinical_context.patient_sex,
        medical_history: input.clinical_context.medical_history,
        current_medications: input.clinical_context.current_medications,
        allergies: input.clinical_context.allergies,
        visit_id: input.visit_id,
        clinic_id: input.clinic_id,
      }),
      FAST_TIMEOUT_MS,
      "hybrid_reasoning"
    );
  } catch {
    hybridReasoning = null;
  }
  stageLatencies.hybrid_reasoning = Math.round(performance.now() - reasoningStart);
  onProgress?.("reasoning", { hybrid_reasoning: hybridReasoning });

  const totalLatency = Math.round(performance.now() - pipelineStart);
  stageLatencies.total = totalLatency;

  console.log(`[Pipeline] v3 complete in ${totalLatency}ms (target <10000ms). Cache: reasoning=${cacheStats.reasoning_hit}, preindexed=${cacheStats.preindexed_hit}, evidence=${cacheStats.evidence_hit}`);

  // ── Memoize successful result for future cache hits ──
  if (symptoms.length > 0 && (ddxResult || hypotheses)) {
    const memoPayload = {
      ddx: ddxResult,
      hypotheses,
      evidence,
      guideline_alignment: guidelineAlignment,
      uncertainty: uncertaintyResult,
      hybrid_reasoning: hybridReasoning,
    };
    setReasoningCache(symptoms, memoPayload, uncertaintyResult?.confidence_score || 0, 6);
  }

  // ── Multi-agent in background (non-blocking, doesn't affect latency) ──
  let multiAgentResult: OrchestratorResponse | null = null;
  const multiAgentPromise = runMultiAgentPipeline({
    transcript: input.clinical_context.chief_complaint || "",
    clinical_context: input.clinical_context,
    visit_id: input.visit_id || undefined,
    clinic_id: input.clinic_id || undefined,
    skip_agents: ["documentation_agent"],
  }).then(result => {
    multiAgentResult = result;
    onProgress?.("multi_agent", { multi_agent: result });
  }).catch(() => {});

  // Record latency metrics (non-blocking)
  supabase
    .from("monitoring_events")
    .insert({
      event_type: "pipeline_latency",
      pipeline_type: "modular_v3",
      total_latency_ms: totalLatency,
      stage_latencies: stageLatencies,
      visit_id: input.visit_id || null,
      clinic_id: input.clinic_id || null,
      metadata: {
        ddx_enabled: !!ddxResult,
        ddx_diagnoses: ddxResult?.differential_diagnoses.length || 0,
        uncertainty_score: uncertaintyResult?.confidence_score || null,
        uncertainty_label: uncertaintyResult?.confidence_label || null,
        hybrid_reasoning_enabled: !!hybridReasoning,
        paradigm_agreement: hybridReasoning?.paradigm_agreement || null,
        cache_stats: cacheStats,
        preindexed_matches: preindexedMatches.length,
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
        conflicts_detected: (guidelineAlignment.conflicts_detected || []).map((c: any) => ({
          recommendation: c.prescribed_drug || c.recommendation || "",
          conflicting_guideline: c.guideline_recommends || c.conflicting_guideline || "",
          organization: c.source || c.organization || "",
          severity: c.severity || "moderate",
          explanation: c.explanation || "",
        })),
      }
    : null;

  // Wait briefly for multi-agent if it completes quickly
  await Promise.race([multiAgentPromise, new Promise(r => setTimeout(r, 500))]);

  onProgress?.("complete", {});

  return {
    enabled: true,
    enriched_context: enrichedContext,
    ddx: ddxResult,
    uncertainty: uncertaintyResult,
    hypotheses,
    guideline_alignment: guidelineAlignment,
    evidence,
    oversight,
    hybrid_reasoning: hybridReasoning,
    multi_agent: multiAgentResult,
    guideline_summary,
    logs: getPipelineLogs(),
    stage_latencies: stageLatencies,
    total_latency_ms: totalLatency,
    cache_stats: cacheStats,
  };
}
