/**
 * Clinical Pipeline Orchestrator (v4 — Wave-Based Parallel Architecture)
 *
 * 5-wave execution model for sub-10s latency:
 *
 *   Wave 1 — Context Preparation (sync, ~5ms)
 *     Build Clinical Context Object
 *
 *   Wave 2 — Parallel Context Analysis (~2s)
 *     • Physiological State Engine
 *     • Knowledge Graph Query (DDX Engine)
 *     • Reasoning Cache + Pre-indexed Knowledge
 *     • Evidence Retrieval
 *
 *   Wave 3 — Parallel Clinical Reasoning (~3s)
 *     • Bayesian Probability Engine
 *     • Guideline Compliance Engine
 *     • Hypothesis Engine (LLM)
 *
 *   Wave 4 — Clinical Safety Evaluation (~1s)
 *     • Safety / Oversight Engine
 *     • Drug Interaction + Allergy (via DDX safety flags)
 *
 *   Wave 5 — Output Generation (~2s)
 *     • Uncertainty Calibration Engine
 *     • Hybrid Reasoning (SOAP synthesis)
 *
 * Background (non-blocking):
 *     • Multi-Agent Orchestrator
 */

import { isNewPipelineEnabled } from "@/services/feature_flags";
import { withStageLogging, clearPipelineLogs, getPipelineLogs } from "@/services/pipeline_logger";
import {
  buildEnrichedContext,
  validateContextCompleteness,
  type EnrichedClinicalContext,
} from "@/services/clinical_context";
import type { ClinicalContext } from "@/lib/clinical-context";
import { generateHypotheses, type HypothesisResult } from "@/services/hypothesis_engine";
import { evaluateGuidelineAlignment, type GuidelineAlignmentResult } from "@/services/guideline_engine";
import {
  recordOversightEvent,
  generateOversightReport,
  clearOversightEvents,
  type OversightReport,
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
import { calculateDiagnosticProbabilities, type BayesianResult } from "@/services/bayesian_engine";
import { supabase } from "@/integrations/supabase/client";

// ── Public Types ──

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
  bayesian: BayesianResult | null;
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
    conflicts_detected: Array<{
      recommendation: string;
      conflicting_guideline: string;
      organization: string;
      severity: string;
      explanation: string;
    }>;
  } | null;
  logs: ReturnType<typeof getPipelineLogs>;
  stage_latencies: Record<string, number>;
  wave_latencies: Record<string, number>;
  total_latency_ms: number;
  cache_stats: {
    reasoning_hit: boolean;
    preindexed_hit: boolean;
    evidence_hit: boolean;
    guideline_hit: boolean;
  };
}

export type PipelineProgressCallback = (stage: string, data: Partial<PipelineResult>) => void;

// ── Constants ──

const WAVE_TIMEOUT_MS = 4000;
const MODULE_TIMEOUT_MS = 3500;

// ── Helpers ──

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[Pipeline] ⏱️ ${label} timed out after ${timeoutMs}ms`);
        resolve(null);
      }, timeoutMs),
    ),
  ]);
}

function extractSymptoms(ctx: ClinicalContext): string[] {
  const symptoms: string[] = [];
  if (ctx.chief_complaint) symptoms.push(ctx.chief_complaint);
  if ((ctx as any).symptoms) symptoms.push(...(ctx as any).symptoms);
  return [...new Set(symptoms)];
}

function buildVitals(ctx: ClinicalContext) {
  return {
    temperature: ctx.temperature,
    spo2: ctx.oxygen_saturation,
    pulse: ctx.pulse,
    bp: ctx.blood_pressure,
    bp_systolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[0]) : undefined,
  };
}

// ── Main Pipeline ──

export async function runClinicalPipeline(
  input: PipelineInput,
  onProgress?: PipelineProgressCallback,
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const lat: Record<string, number> = {};
  const waveLat: Record<string, number> = {};
  const cache = { reasoning_hit: false, preindexed_hit: false, evidence_hit: false, guideline_hit: false };

  const empty: PipelineResult = {
    enabled: false, enriched_context: null, physiological_context: null,
    bayesian: null, ddx: null, uncertainty: null, hypotheses: null,
    guideline_alignment: null, evidence: null, oversight: null,
    hybrid_reasoning: null, multi_agent: null, guideline_summary: null,
    logs: [], stage_latencies: {}, wave_latencies: {}, total_latency_ms: 0,
    cache_stats: cache,
  };

  if (!isNewPipelineEnabled()) {
    console.log("[Pipeline] Disabled. Using legacy flow.");
    return empty;
  }

  clearPipelineLogs();
  clearOversightEvents();
  const symptoms = extractSymptoms(input.clinical_context);
  const vitals = buildVitals(input.clinical_context);
  const ctx = input.clinical_context;

  console.log("[Pipeline] v4 wave-based starting — target <10s...");

  // ═══════════════════════════════════════════════════════
  // FAST PATH: Reasoning cache check
  // ═══════════════════════════════════════════════════════
  const cacheT0 = performance.now();
  const cachedReasoning = await getReasoningCache(symptoms);
  lat.cache_check = Math.round(performance.now() - cacheT0);

  if (cachedReasoning.hit && cachedReasoning.data) {
    console.log("[Pipeline] ⚡ Reasoning cache HIT");
    cache.reasoning_hit = true;
    const cached = cachedReasoning.data as Partial<PipelineResult>;
    onProgress?.("complete", cached);
    return {
      ...empty, enabled: true, ...cached,
      cache_stats: cache,
      stage_latencies: { cache_check: lat.cache_check, total: lat.cache_check },
      wave_latencies: {},
      total_latency_ms: lat.cache_check,
    };
  }

  // ═══════════════════════════════════════════════════════
  // WAVE 1 — Context Preparation (sync, ~5ms)
  // ═══════════════════════════════════════════════════════
  const w1Start = performance.now();

  const enrichedContext = await withStageLogging("build_context", async () => {
    const enriched = buildEnrichedContext(ctx, {
      visit_id: input.visit_id,
      consultation_id: input.consultation_id,
      clinic_id: input.clinic_id,
      intake_approved: input.intake_approved,
    });
    const missing = validateContextCompleteness(ctx);
    if (missing.length > 0) {
      recordOversightEvent({
        event_type: "context_incomplete",
        severity: missing.includes("chief_complaint") ? "warning" : "info",
        stage: "build_context",
        message: `Missing fields: ${missing.join(", ")}`,
        metadata: { missing_fields: missing },
      });
    }
    return enriched;
  });

  lat.build_context = Math.round(performance.now() - w1Start);
  waveLat.wave1_context = lat.build_context;
  onProgress?.("context", { enriched_context: enrichedContext });

  // ═══════════════════════════════════════════════════════
  // WAVE 2 — Parallel Context Analysis
  //   • Physiological State Engine
  //   • DDX Engine (Knowledge Graph traversal)
  //   • Evidence Retrieval
  //   • Pre-indexed Knowledge Lookup
  // ═══════════════════════════════════════════════════════
  const w2Start = performance.now();

  // Launch physiology first (it feeds DDX), but don't block Wave 2 on it.
  // Instead, run physiology + DDX + evidence + preindexed all in parallel.
  // DDX will run without physiology context in this wave; Bayesian engine
  // in Wave 3 will incorporate physiology for refined scoring.

  const [physiologicalContext, ddxResult, evidence, preindexedMatches] = await Promise.all([
    // 2a: Physiological State Engine
    (async (): Promise<PhysiologicalContextResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          generatePhysiologicalContext({
            symptoms,
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp_systolic: vitals.bp_systolic },
            visit_id: input.visit_id,
            clinic_id: input.clinic_id,
          }),
          MODULE_TIMEOUT_MS,
          "physiological_engine",
        );
        lat.physiological_engine = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.physiological_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 2b: DDX Engine (knowledge graph traversal + Bayesian scoring)
    (async (): Promise<DDXResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          withStageLogging("ddx_engine", () =>
            runDDXEngine({
              symptoms,
              vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp: vitals.bp },
              age: ctx.patient_age,
              sex: ctx.patient_sex,
              medical_history: ctx.medical_history,
              current_medications: ctx.current_medications,
              allergies: ctx.allergies,
              visit_id: input.visit_id,
              clinic_id: input.clinic_id,
              // Physiology context not available yet — Wave 3 Bayesian will refine
            }),
          ),
          MODULE_TIMEOUT_MS,
          "ddx_engine",
        );
        lat.ddx_engine = Math.round(performance.now() - t0);
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
        lat.ddx_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 2c: Evidence Retrieval
    (async (): Promise<EvidenceQueryResult | null> => {
      if (!ctx.chief_complaint) return null;
      const query = ctx.chief_complaint;
      const t0 = performance.now();
      try {
        const cached = await getCached<EvidenceQueryResult>(query, "evidence");
        if (cached.hit && cached.data) {
          cache.evidence_hit = true;
          lat.retrieve_evidence = Math.round(performance.now() - t0);
          return cached.data;
        }
        const result = await withTimeout(
          withStageLogging("retrieve_evidence", () => queryEvidence(query, { maxResults: 5 })),
          MODULE_TIMEOUT_MS,
          "retrieve_evidence",
        );
        if (result) setCache(query, "evidence", result, 12);
        lat.retrieve_evidence = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.retrieve_evidence = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 2d: Pre-indexed Knowledge (instant, <50ms)
    (async () => {
      const t0 = performance.now();
      try {
        if (ctx.chief_complaint) {
          const exact = await getPreindexedKnowledge(ctx.chief_complaint);
          if (exact.hit) {
            cache.preindexed_hit = true;
            lat.preindexed_lookup = Math.round(performance.now() - t0);
            return [exact.data!];
          }
        }
        const matches = await searchPreindexedBySymptoms(symptoms, 3);
        if (matches.length > 0) cache.preindexed_hit = true;
        lat.preindexed_lookup = Math.round(performance.now() - t0);
        return matches;
      } catch {
        lat.preindexed_lookup = Math.round(performance.now() - t0);
        return [];
      }
    })(),
  ]);

  waveLat.wave2_analysis = Math.round(performance.now() - w2Start);

  // Stream Wave 2 results
  onProgress?.("physiology", { physiological_context: physiologicalContext });
  onProgress?.("ddx", { ddx: ddxResult });
  onProgress?.("evidence", { evidence });

  // ═══════════════════════════════════════════════════════
  // WAVE 3 — Parallel Clinical Reasoning
  //   • Bayesian Probability Engine (uses DDX candidates + physiology)
  //   • Guideline Compliance Engine
  //   • Hypothesis Engine (LLM reasoning)
  // ═══════════════════════════════════════════════════════
  const w3Start = performance.now();

  const [bayesianResult, guidelineAlignment, hypotheses] = await Promise.all([
    // 3a: Bayesian Engine
    (async (): Promise<BayesianResult | null> => {
      const candidateIds = ddxResult?.differential_diagnoses.map(d => d.diagnosis_id) || [];
      if (candidateIds.length === 0) return null;
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          calculateDiagnosticProbabilities({
            candidate_diagnosis_ids: candidateIds,
            symptoms,
            physiological_state_ids: physiologicalContext?.physiological_states.map(s => s.state_id) || [],
            risk_factors: ctx.medical_history || [],
            patient_age: ctx.patient_age,
            patient_sex: ctx.patient_sex,
            region: "south_asia",
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse },
          }),
          MODULE_TIMEOUT_MS,
          "bayesian_engine",
        );
        lat.bayesian_engine = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.bayesian_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 3b: Guideline Compliance (with cache)
    (async (): Promise<GuidelineAlignmentResult | null> => {
      if (!input.recommendations) return null;
      const t0 = performance.now();
      const cacheKey = JSON.stringify(input.recommendations);
      try {
        const cached = await getCached<GuidelineAlignmentResult>(cacheKey, "guideline");
        if (cached.hit && cached.data) {
          cache.guideline_hit = true;
          lat.retrieve_guidelines = Math.round(performance.now() - t0);
          return cached.data;
        }
        const result = await withTimeout(
          withStageLogging("retrieve_guidelines", () =>
            evaluateGuidelineAlignment(input.recommendations!, enrichedContext),
          ),
          MODULE_TIMEOUT_MS,
          "retrieve_guidelines",
        );
        if (result) setCache(cacheKey, "guideline", result, 6);
        lat.retrieve_guidelines = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.retrieve_guidelines = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 3c: Hypothesis Engine (LLM)
    (async (): Promise<HypothesisResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          withStageLogging("generate_hypotheses", () => generateHypotheses(enrichedContext)),
          MODULE_TIMEOUT_MS,
          "generate_hypotheses",
        );
        lat.generate_hypotheses = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.generate_hypotheses = Math.round(performance.now() - t0);
        return null;
      }
    })(),
  ]);

  waveLat.wave3_reasoning = Math.round(performance.now() - w3Start);

  // Stream Wave 3 results
  onProgress?.("bayesian", { bayesian: bayesianResult });
  onProgress?.("guidelines", { guideline_alignment: guidelineAlignment });
  onProgress?.("hypotheses", { hypotheses });

  // ═══════════════════════════════════════════════════════
  // WAVE 4 — Clinical Safety Evaluation
  //   • Oversight / Safety Engine
  //   Safety flags from DDX (drug interactions, allergy conflicts)
  //   are already available via ddxResult — oversight aggregates them.
  // ═══════════════════════════════════════════════════════
  const w4Start = performance.now();

  const oversight = await (async () => {
    const t0 = performance.now();
    const report = await withStageLogging<OversightReport>("oversight_report", async () =>
      generateOversightReport(input.visit_id ?? null, input.consultation_id ?? null),
    );
    lat.oversight_report = Math.round(performance.now() - t0);
    return report;
  })();

  waveLat.wave4_safety = Math.round(performance.now() - w4Start);
  onProgress?.("safety", { oversight });

  // ═══════════════════════════════════════════════════════
  // WAVE 5 — Output Generation
  //   • Uncertainty Calibration Engine
  //   • Hybrid Reasoning (SOAP synthesis)
  // ═══════════════════════════════════════════════════════
  const w5Start = performance.now();

  const [uncertaintyResult, hybridReasoning] = await Promise.all([
    // 5a: Uncertainty Engine
    (async (): Promise<UncertaintyResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          runUncertaintyEngine({
            symptoms: ddxResult?.matched_symptoms || symptoms,
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp: vitals.bp },
            differential_diagnoses: ddxResult?.differential_diagnoses || [],
            suggested_labs: ddxResult?.recommended_labs || [],
            guideline_sources: [],
            guideline_recommendations: ddxResult?.guideline_recommendations?.map(g => ({
              authority: g.authority,
              evidence_level: g.evidence_level,
            })) || [],
            safety_flags: [],
            safety_score: oversight.safety_score || 80,
            medical_history: ctx.medical_history,
            current_medications: ctx.current_medications,
            allergies: ctx.allergies,
            matched_symptoms: ddxResult?.matched_symptoms || [],
            unmatched_symptoms: ddxResult?.unmatched_symptoms || [],
          }),
          MODULE_TIMEOUT_MS,
          "uncertainty_engine",
        );
        lat.uncertainty_engine = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.uncertainty_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 5b: Hybrid Reasoning (SOAP synthesis)
    (async (): Promise<HybridReasoningResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          runHybridReasoning({
            symptoms,
            chief_complaint: ctx.chief_complaint,
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp: vitals.bp },
            patient_age: ctx.patient_age,
            patient_sex: ctx.patient_sex,
            medical_history: ctx.medical_history,
            current_medications: ctx.current_medications,
            allergies: ctx.allergies,
            visit_id: input.visit_id,
            clinic_id: input.clinic_id,
          }),
          MODULE_TIMEOUT_MS,
          "hybrid_reasoning",
        );
        lat.hybrid_reasoning = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.hybrid_reasoning = Math.round(performance.now() - t0);
        return null;
      }
    })(),
  ]);

  waveLat.wave5_output = Math.round(performance.now() - w5Start);
  onProgress?.("uncertainty", { uncertainty: uncertaintyResult });
  onProgress?.("reasoning", { hybrid_reasoning: hybridReasoning });

  // ═══════════════════════════════════════════════════════
  // FINALIZE
  // ═══════════════════════════════════════════════════════
  const totalLatency = Math.round(performance.now() - pipelineStart);
  lat.total = totalLatency;

  console.log(
    `[Pipeline] v4 complete in ${totalLatency}ms (target <10000ms). ` +
    `Waves: W1=${waveLat.wave1_context}ms W2=${waveLat.wave2_analysis}ms ` +
    `W3=${waveLat.wave3_reasoning}ms W4=${waveLat.wave4_safety}ms W5=${waveLat.wave5_output}ms. ` +
    `Cache: reasoning=${cache.reasoning_hit}, preindexed=${cache.preindexed_hit}, evidence=${cache.evidence_hit}`,
  );

  // ── Memoize for future cache hits ──
  if (symptoms.length > 0 && (ddxResult || hypotheses)) {
    setReasoningCache(
      symptoms,
      { ddx: ddxResult, hypotheses, evidence, guideline_alignment: guidelineAlignment, uncertainty: uncertaintyResult, hybrid_reasoning: hybridReasoning, bayesian: bayesianResult },
      uncertaintyResult?.confidence_score || 0,
      6,
    );
  }

  // ── Multi-agent in background (non-blocking) ──
  let multiAgentResult: OrchestratorResponse | null = null;
  const multiAgentPromise = runMultiAgentPipeline({
    transcript: ctx.chief_complaint || "",
    clinical_context: ctx,
    visit_id: input.visit_id || undefined,
    clinic_id: input.clinic_id || undefined,
    skip_agents: ["documentation_agent"],
  }).then(result => {
    multiAgentResult = result;
    onProgress?.("multi_agent", { multi_agent: result });
  }).catch(() => {});

  // ── Record latency metrics (non-blocking) ──
  supabase
    .from("monitoring_events")
    .insert({
      event_type: "pipeline_latency",
      pipeline_type: "modular_v4_waves",
      total_latency_ms: totalLatency,
      stage_latencies: lat,
      visit_id: input.visit_id || null,
      clinic_id: input.clinic_id || null,
      metadata: {
        wave_latencies: waveLat,
        ddx_enabled: !!ddxResult,
        ddx_diagnoses: ddxResult?.differential_diagnoses.length || 0,
        bayesian_enabled: !!bayesianResult,
        bayesian_candidates: bayesianResult?.total_candidates || 0,
        physiology_states: physiologicalContext?.physiological_states.length || 0,
        uncertainty_score: uncertaintyResult?.confidence_score || null,
        uncertainty_label: uncertaintyResult?.confidence_label || null,
        hybrid_reasoning_enabled: !!hybridReasoning,
        paradigm_agreement: hybridReasoning?.paradigm_agreement || null,
        cache_stats: cache,
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
    physiological_context: physiologicalContext,
    bayesian: bayesianResult,
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
    stage_latencies: lat,
    wave_latencies: waveLat,
    total_latency_ms: totalLatency,
    cache_stats: cache,
  };
}
