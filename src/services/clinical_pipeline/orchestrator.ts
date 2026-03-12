/**
 * Clinical Pipeline Orchestrator (v4.1 — Wave-Based Parallel Architecture)
 *
 * Adaptive timeouts, organ-system weighting, enriched evidence retrieval.
 *
 *   Wave 0 — PCIE Context Hydration
 *   Wave 1 — Context Preparation
 *   Wave 2 — Parallel Context Analysis (DDX, Physiology, Preindexed)
 *   Wave 2b — Evidence Retrieval (enriched with DDX results)
 *   Wave 3 — Parallel Clinical Reasoning (Bayesian, Guidelines, Hypotheses)
 *   Wave 4 — Clinical Safety Evaluation
 *   Wave 5 — Output Generation (Uncertainty, Hybrid Reasoning, SOAP)
 */

import { isNewPipelineEnabled } from "@/services/feature_flags";
import { withStageLogging, clearPipelineLogs, getPipelineLogs } from "@/services/pipeline_logger";
import {
  buildEnrichedContext,
  validateContextCompleteness,
  type EnrichedClinicalContext,
} from "@/services/clinical_context";
import type { ClinicalContext } from "@/lib/clinical-context";
import { getPatientContext } from "@/services/context_engine/client";
import { fromPCIEContext, toClinicalContext, type UnifiedClinicalContext } from "@/types/clinical-context";
import { generateDiagnosticHypotheses } from "@/services/hypothesis_engine/client";
import type { HypothesisResult } from "@/services/hypothesis_engine";
import { evaluateGuidelineAlignment, checkGuidelineCompliance, type GuidelineAlignmentResult, type GuidelineComplianceResult } from "@/services/guideline_engine";
import { generateSOAP, type SOAPGeneratorResult } from "@/services/soap_generator";
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
import { LineageTracker, type LineageReport } from "@/services/clinical_pipeline/lineage_tracker";
import { PCIECore } from "@/services/pcie/core";
import type { UnifiedClinicalContextGraph } from "@/services/pcie/context_graph";

// ── Public Types ──

export interface PipelineInput {
  clinical_context: ClinicalContext;
  visit_id?: string | null;
  consultation_id?: string | null;
  clinic_id?: string | null;
  intake_approved?: boolean;
  /** When true, bypass reasoning cache to force full pipeline execution (used by trace/benchmarks) */
  skip_cache?: boolean;
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
  guideline_compliance: GuidelineComplianceResult | null;
  evidence: EvidenceQueryResult | null;
  oversight: OversightReport | null;
  hybrid_reasoning: HybridReasoningResult | null;
  soap_fallback: SOAPGeneratorResult | null;
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
  lineage: LineageReport | null;
  /** PCIE context graph — full clinical state snapshot */
  context_graph: UnifiedClinicalContextGraph | null;
}

export type PipelineProgressCallback = (stage: string, data: Partial<PipelineResult>) => void;

// ── Adaptive Timeout Constants (per-engine) ──

const TIMEOUT = {
  PCIE:            2000,
  DDX:             10000,
  PHYSIOLOGY:      10000,
  EVIDENCE:        9000,
  PREINDEXED:      2000,
  BAYESIAN:        8000,
  GUIDELINE:       10000,
  GUIDELINE_COMPLIANCE: 12000,
  HYPOTHESIS:      12000,
  UNCERTAINTY:     8000,
  HYBRID:          10000,
  SOAP:            4000,
} as const;

// ── Organ-System Weighting ──

const ORGAN_SYSTEM_WEIGHTS: Record<string, number> = {
  cardiovascular: 1.4,
  respiratory:    1.1,
  neurological:   0.8,
  gastrointestinal: 0.9,
  musculoskeletal: 0.7,
  endocrine:      0.8,
  renal:          0.9,
  hepatic:        0.8,
  infectious:     1.0,
  hematological:  0.9,
  dermatological: 0.6,
};

/** Detect dominant organ system from symptoms */
function detectDominantOrganSystem(symptoms: string[]): string | null {
  const symptomSystemMap: Record<string, string> = {
    "chest pain": "cardiovascular",
    "left arm pain": "cardiovascular",
    "diaphoresis": "cardiovascular",
    "palpitations": "cardiovascular",
    "tachycardia": "cardiovascular",
    "shortness of breath": "respiratory",
    "dyspnea": "respiratory",
    "cough": "respiratory",
    "wheezing": "respiratory",
    "headache": "neurological",
    "dizziness": "neurological",
    "syncope": "neurological",
    "seizure": "neurological",
    "nausea": "gastrointestinal",
    "vomiting": "gastrointestinal",
    "abdominal pain": "gastrointestinal",
    "diarrhea": "gastrointestinal",
    "fever": "infectious",
    "chills": "infectious",
    "joint pain": "musculoskeletal",
    "back pain": "musculoskeletal",
    "rash": "dermatological",
    "polyuria": "endocrine",
    "polydipsia": "endocrine",
  };

  const systemCounts: Record<string, number> = {};
  for (const s of symptoms) {
    const lower = s.toLowerCase().trim();
    for (const [keyword, system] of Object.entries(symptomSystemMap)) {
      if (lower.includes(keyword)) {
        systemCounts[system] = (systemCounts[system] || 0) + 1;
      }
    }
  }

  let dominant: string | null = null;
  let maxCount = 0;
  for (const [system, count] of Object.entries(systemCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = system;
    }
  }
  return dominant;
}

/** Apply organ-system weighting to DDX results */
function applyOrganSystemWeighting(ddx: DDXResult, dominantSystem: string): DDXResult {
  if (!ddx.differential_diagnoses || ddx.differential_diagnoses.length === 0) return ddx;

  const dominantWeight = ORGAN_SYSTEM_WEIGHTS[dominantSystem] ?? 1.0;

  const reweighted = ddx.differential_diagnoses.map(d => {
    const diagSystem = (d.category || "").toLowerCase();
    let weight = 1.0;
    if (diagSystem === dominantSystem) {
      weight = dominantWeight;
    } else if (ORGAN_SYSTEM_WEIGHTS[diagSystem] !== undefined) {
      weight = ORGAN_SYSTEM_WEIGHTS[diagSystem];
    }
    // must_not_miss diagnoses keep at least their original score
    const newProb = d.must_not_miss
      ? Math.max(d.probability, Math.round(d.probability * weight))
      : Math.round(d.probability * weight);
    return { ...d, probability: newProb };
  });

  // Re-sort by probability descending
  reweighted.sort((a, b) => b.probability - a.probability);

  return {
    ...ddx,
    differential_diagnoses: reweighted,
    organ_system_weighting: {
      dominant_system: dominantSystem,
      weight_applied: dominantWeight,
    },
  } as DDXResult;
}

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

/** Retry-once wrapper: attempts the factory, and on null/timeout retries once with extended budget */
async function withRetry<T>(
  factory: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  const first = await withTimeout(factory(), timeoutMs, label);
  if (first !== null) return first;
  console.log(`[Pipeline] 🔄 Retrying ${label} (budget: ${Math.round(timeoutMs * 1.3)}ms)`);
  return withTimeout(factory(), Math.round(timeoutMs * 1.3), `${label}_retry`);
}

function extractSymptoms(ctx: ClinicalContext): string[] {
  const symptoms: string[] = [];
  if (ctx.chief_complaint) symptoms.push(ctx.chief_complaint);
  if (ctx.symptoms && ctx.symptoms.length > 0) symptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms && ctx.associated_symptoms.length > 0) symptoms.push(...ctx.associated_symptoms);
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

/** Build a DDX-enriched evidence query for higher relevance */
function buildEvidenceQuery(
  chiefComplaint: string,
  ddxResult: DDXResult | null,
  ctx?: { risk_factors?: string[]; patient_age?: number | null; patient_sex?: string | null },
): string {
  const parts: string[] = [chiefComplaint];
  if (ddxResult?.differential_diagnoses?.length) {
    const topDx = ddxResult.differential_diagnoses
      .slice(0, 2)
      .map(d => d.diagnosis_name);
    parts.push(...topDx);
  }
  if (ddxResult?.organ_systems_active?.length) {
    parts.push(ddxResult.organ_systems_active[0]);
  }
  // Enrich with demographics and risk factors
  if (ctx?.patient_age) parts.push(ctx.patient_age < 18 ? "pediatric" : ctx.patient_age > 65 ? "elderly" : "adult");
  if (ctx?.risk_factors?.length) parts.push(...ctx.risk_factors.slice(0, 2));
  parts.push("diagnosis guidelines");
  return parts.join(" ");
}

/** Build a guideline query from DDX candidates and organ system */
function buildGuidelineQuery(ddxResult: DDXResult | null, ctx: ClinicalContext): {
  diagnosis?: string;
  drugs?: string[];
  labs?: string[];
  care_plan?: string;
} | null {
  if (!ddxResult || ddxResult.differential_diagnoses.length === 0) return null;
  return {
    diagnosis: ddxResult.differential_diagnoses[0]?.diagnosis_name,
    drugs: ddxResult.suggested_medications?.map(m => m.generic_name) || [],
    labs: ddxResult.recommended_labs?.map(l => l.test_name) || [],
  };
}

// ── Main Pipeline ──

export async function runUnifiedClinicalPipeline(
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
    guideline_alignment: null, guideline_compliance: null, evidence: null,
    oversight: null, hybrid_reasoning: null, soap_fallback: null,
    multi_agent: null, guideline_summary: null,
    logs: [], stage_latencies: {}, wave_latencies: {}, total_latency_ms: 0,
    cache_stats: cache, lineage: null, context_graph: null,
  };

  if (!isNewPipelineEnabled()) {
    console.log("[Pipeline] Disabled. Using legacy flow.");
    return empty;
  }

  clearPipelineLogs();
  clearOversightEvents();
  const lineageTracker = new LineageTracker();
  const pcieCore = new PCIECore({
    visit_id: input.visit_id,
    clinic_id: input.clinic_id,
    consultation_id: input.consultation_id,
  });
  const symptoms = extractSymptoms(input.clinical_context);
  const vitals = buildVitals(input.clinical_context);
  const ctx = input.clinical_context;

  // Hydrate PCIE Core from input context
  pcieCore.hydrateFromClinicalContext(ctx);

  // Initial snapshot — pre-pipeline context
  lineageTracker.captureSnapshot("Wave 0 (Pre)", "pcie", {
    chief_complaint: ctx.chief_complaint,
    symptoms: ctx.symptoms,
    associated_symptoms: ctx.associated_symptoms,
    symptom_duration: ctx.symptom_duration,
    medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [],
    risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications,
    allergies: ctx.allergies,
    vitals: {
      bp_systolic: vitals.bp_systolic,
      bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null,
      pulse: vitals.pulse,
      temperature: vitals.temperature,
      spo2: vitals.spo2,
      respiratory_rate: ctx.respiratory_rate,
      weight_kg: ctx.weight,
      height_cm: ctx.height,
    },
    lab_results: [],
    risk_flags: ctx.risk_flags || [],
    patient_age: ctx.patient_age,
    patient_sex: ctx.patient_sex,
    context_confidence: 0,
  });

  // ═══════════════════════════════════════════════════════
  // WAVE 0 — PCIE Context Hydration
  // ═══════════════════════════════════════════════════════
  let unifiedContext: UnifiedClinicalContext | null = null;
  const isBenchmarkVisit = input.visit_id?.startsWith("bench-") || false;
  if (input.visit_id && !isBenchmarkVisit) {
    const w0Start = performance.now();
    try {
      const pcieRow = await withRetry(
        () => getPatientContext(input.visit_id!),
        TIMEOUT.PCIE,
        "pcie_fetch",
      );
      if (pcieRow) {
        unifiedContext = fromPCIEContext(pcieRow);
        const cc = input.clinical_context;
        if (!cc.chief_complaint && unifiedContext.chief_complaint) {
          (cc as any).chief_complaint = unifiedContext.chief_complaint;
        }
        if ((!cc.medical_history || cc.medical_history.length === 0) && unifiedContext.medical_history.length > 0) {
          (cc as any).medical_history = unifiedContext.medical_history;
        }
        if ((!cc.allergies || cc.allergies.length === 0) && unifiedContext.allergies.length > 0) {
          (cc as any).allergies = unifiedContext.allergies;
        }
        if ((!cc.current_medications || cc.current_medications.length === 0) && unifiedContext.current_medications.length > 0) {
          (cc as any).current_medications = unifiedContext.current_medications;
        }
        // Propagate additional fields from PCIE if missing
        if ((!ctx.risk_factors || ctx.risk_factors.length === 0) && unifiedContext.risk_factors.length > 0) {
          (cc as any).risk_factors = unifiedContext.risk_factors;
        }
        if (!(ctx as any).family_history && unifiedContext.family_history.length > 0) {
          (cc as any).family_history = unifiedContext.family_history;
        }
        console.log(`[Pipeline] Wave 0: PCIE context loaded (confidence=${unifiedContext.context_confidence})`);
      } else {
        console.warn("[Pipeline] Wave 0: PCIE returned null — building minimal context from input");
      }
    } catch {
      console.warn("[Pipeline] Wave 0: PCIE fetch failed, continuing with input context");
    }
    lat.wave0_pcie = Math.round(performance.now() - w0Start);
    waveLat.wave0_pcie = lat.wave0_pcie;
  } else if (isBenchmarkVisit) {
    console.log("[Pipeline] Wave 0: Benchmark visit ID detected — skipping PCIE fetch");
    waveLat.wave0_pcie = 0;
  }

  // ═══════════════════════════════════════════════════════
  // FAST PATH: Reasoning cache check (skipped in trace/benchmark mode)
  // ═══════════════════════════════════════════════════════
  if (!input.skip_cache) {
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
  } else {
    console.log("[Pipeline] 🔬 Cache bypass enabled (trace/benchmark mode)");
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
  lineageTracker.captureSnapshot("Wave 1 (Context)", "context_enrichment", {
    chief_complaint: ctx.chief_complaint,
    symptoms: symptoms,
    associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration,
    medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [],
    risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications,
    allergies: ctx.allergies,
    vitals: {
      bp_systolic: vitals.bp_systolic,
      bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null,
      pulse: vitals.pulse,
      temperature: vitals.temperature,
      spo2: vitals.spo2,
      respiratory_rate: ctx.respiratory_rate,
      weight_kg: ctx.weight,
      height_cm: ctx.height,
    },
    lab_results: [],
    risk_flags: ctx.risk_flags || [],
    patient_age: ctx.patient_age,
    patient_sex: ctx.patient_sex,
    context_confidence: 0,
  });
  lineageTracker.recordEngineResult("context_enrichment", !!enrichedContext);
  onProgress?.("context", { enriched_context: enrichedContext });

  // ═══════════════════════════════════════════════════════
  // WAVE 2 — Parallel Context Analysis
  //   • Physiological State Engine
  //   • DDX Engine (Knowledge Graph traversal)
  //   • Pre-indexed Knowledge Lookup
  //   (Evidence retrieval moved to Wave 2b — after DDX for enriched query)
  // ═══════════════════════════════════════════════════════
  const w2Start = performance.now();

  const [physiologicalContext, ddxResultRaw, preindexedMatches] = await Promise.all([
    // 2a: Physiological State Engine
    (async (): Promise<PhysiologicalContextResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withRetry(
          () => generatePhysiologicalContext({
            symptoms,
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp_systolic: vitals.bp_systolic },
            visit_id: input.visit_id,
            clinic_id: input.clinic_id,
          }),
          TIMEOUT.PHYSIOLOGY,
          "physiological_engine",
        );
        lat.physiological_engine = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.physiological_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 2b: DDX Engine
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
            }),
          ),
          TIMEOUT.DDX,
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

    // 2c: Pre-indexed Knowledge (instant, <50ms)
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

  // ── Apply Organ-System Weighting to DDX ──
  const dominantSystem = detectDominantOrganSystem(symptoms);
  let ddxResult = ddxResultRaw;
  if (ddxResult && dominantSystem) {
    console.log(`[Pipeline] Organ-system weighting: dominant=${dominantSystem}, weight=${ORGAN_SYSTEM_WEIGHTS[dominantSystem] ?? 1.0}`);
    ddxResult = applyOrganSystemWeighting(ddxResult, dominantSystem);
  }

  waveLat.wave2_analysis = Math.round(performance.now() - w2Start);
  lineageTracker.recordEngineResult("ddx", !!ddxResult);
  lineageTracker.recordEngineResult("physiology", !!physiologicalContext);
  lineageTracker.captureSnapshot("Wave 2 (DDX)", "ddx", {
    chief_complaint: ctx.chief_complaint,
    symptoms: ddxResult?.matched_symptoms || symptoms,
    associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration,
    medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [],
    risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications,
    allergies: ctx.allergies,
    vitals: { bp_systolic: vitals.bp_systolic, bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null, pulse: vitals.pulse, temperature: vitals.temperature, spo2: vitals.spo2, respiratory_rate: ctx.respiratory_rate, weight_kg: ctx.weight, height_cm: ctx.height },
    lab_results: [],
    risk_flags: ctx.risk_flags || [],
    patient_age: ctx.patient_age,
    patient_sex: ctx.patient_sex,
    context_confidence: 0,
  });
  onProgress?.("physiology", { physiological_context: physiologicalContext });
  onProgress?.("ddx", { ddx: ddxResult });

  // ═══════════════════════════════════════════════════════
  // WAVE 2b — Evidence Retrieval (enriched with DDX results)
  // ═══════════════════════════════════════════════════════
  let evidence: EvidenceQueryResult | null = null;
  if (ctx.chief_complaint) {
    const evT0 = performance.now();
    const enrichedQuery = buildEvidenceQuery(ctx.chief_complaint, ddxResult, {
      risk_factors: ctx.risk_factors,
      patient_age: ctx.patient_age,
      patient_sex: ctx.patient_sex,
    });
    try {
      const cached = await getCached<EvidenceQueryResult>(enrichedQuery, "evidence");
      if (cached.hit && cached.data) {
        cache.evidence_hit = true;
        evidence = cached.data;
      } else {
        evidence = await withRetry(
          () => withStageLogging("retrieve_evidence", () => queryEvidence(enrichedQuery, { maxResults: 5 })),
          TIMEOUT.EVIDENCE,
          "retrieve_evidence",
        );
        if (evidence && evidence.items.length > 0) {
          setCache(enrichedQuery, "evidence", evidence, 12);
        }
      }
    } catch {
      console.warn("[Pipeline] Evidence retrieval failed, continuing without citations.");
    }
    lat.retrieve_evidence = Math.round(performance.now() - evT0);
  }
  lineageTracker.recordEngineResult("evidence", !!evidence && evidence.items.length > 0);
  onProgress?.("evidence", { evidence });

  // ═══════════════════════════════════════════════════════
  // WAVE 3 — Parallel Clinical Reasoning
  //   • Bayesian Probability Engine
  //   • Guideline Compliance Engine
  //   • Hypothesis Engine (LLM reasoning)
  // ═══════════════════════════════════════════════════════
  const w3Start = performance.now();

  const [bayesianResult, guidelineAlignment, guidelineCompliance, hypothesesRaw] = await Promise.all([
    // 3a: Bayesian Engine — fallback to DDX rankings if no candidates
    (async (): Promise<BayesianResult | null> => {
      const candidateIds = ddxResult?.differential_diagnoses.map(d => d.diagnosis_id).filter(Boolean) || [];
      if (candidateIds.length === 0) {
        console.warn("[Pipeline] Wave 3: Bayesian skipped — no DDX candidates. Using DDX rankings as fallback.");
        if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
          return {
            diagnoses: ddxResult.differential_diagnoses.map(d => ({
              diagnosis_id: d.diagnosis_id,
              posterior_probability: d.probability / 100,
              prior: 0.01,
              symptom_likelihood: d.probability / 100,
              physiology_likelihood: 1.0,
              risk_modifier: 1.0,
              supporting_evidence: d.supporting_symptoms || [],
              must_not_miss: d.must_not_miss,
            })),
            total_candidates: ddxResult.differential_diagnoses.length,
            symptoms_resolved: ddxResult.matched_symptoms?.length || 0,
            physiology_states_used: 0,
            risk_factors_applied: 0,
            execution_ms: 0,
            source: "ddx_fallback",
          };
        }
        return null;
      }
      const t0 = performance.now();
      try {
        const result = await withRetry(
          () => calculateDiagnosticProbabilities({
            candidate_diagnosis_ids: candidateIds,
            symptoms,
            physiological_state_ids: physiologicalContext?.physiological_states.map(s => s.state_id) || [],
            risk_factors: ctx.medical_history || [],
            patient_age: ctx.patient_age,
            patient_sex: ctx.patient_sex,
            region: "south_asia",
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse },
          }),
          TIMEOUT.BAYESIAN,
          "bayesian_engine",
        );
        lat.bayesian_engine = Math.round(performance.now() - t0);
        // Fallback: if retry also failed, use DDX-derived probabilities
        if (!result && ddxResult && ddxResult.differential_diagnoses.length > 0) {
          return {
            diagnoses: ddxResult.differential_diagnoses.map(d => ({
              diagnosis_id: d.diagnosis_id,
              posterior_probability: d.probability / 100,
              prior: 0.01,
              symptom_likelihood: d.probability / 100,
              physiology_likelihood: 1.0,
              risk_modifier: 1.0,
              supporting_evidence: d.supporting_symptoms || [],
              must_not_miss: d.must_not_miss,
            })),
            total_candidates: ddxResult.differential_diagnoses.length,
            symptoms_resolved: ddxResult.matched_symptoms?.length || 0,
            physiology_states_used: 0,
            risk_factors_applied: 0,
            execution_ms: 0,
            source: "ddx_timeout_fallback",
          };
        }
        return result;
      } catch {
        lat.bayesian_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 3b: Guideline Alignment (built from DDX via buildGuidelineQuery)
    (async (): Promise<GuidelineAlignmentResult | null> => {
      const recs = input.recommendations || buildGuidelineQuery(ddxResult, ctx);
      if (!recs) return null;
      const t0 = performance.now();
      const cacheKey = JSON.stringify(recs);
      try {
        const cached = await getCached<GuidelineAlignmentResult>(cacheKey, "guideline");
        if (cached.hit && cached.data) {
          cache.guideline_hit = true;
          lat.retrieve_guidelines = Math.round(performance.now() - t0);
          return cached.data;
        }
        const result = await withTimeout(
          withStageLogging("retrieve_guidelines", () =>
            evaluateGuidelineAlignment(recs, enrichedContext),
          ),
          TIMEOUT.GUIDELINE,
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

    // 3c: Direct Guideline Compliance (from DDX diagnoses)
    (async (): Promise<GuidelineComplianceResult | null> => {
      if (!ddxResult || ddxResult.differential_diagnoses.length === 0) return null;
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          checkGuidelineCompliance({
            diagnoses: ddxResult.differential_diagnoses.slice(0, 5).map(d => d.diagnosis_name),
            medications: (ddxResult.suggested_medications || []).map(m => ({
              drug_name: m.generic_name, dose: "", frequency: "", duration: "",
            })),
            tests: (ddxResult.recommended_labs || []).map(l => l.test_name),
            patient_age: ctx.patient_age ?? undefined,
            patient_sex: ctx.patient_sex ?? undefined,
            chief_complaint: ctx.chief_complaint,
          }),
          TIMEOUT.GUIDELINE_COMPLIANCE,
          "guideline_compliance_direct",
        );
        lat.guideline_compliance = Math.round(performance.now() - t0);
        return result;
      } catch {
        lat.guideline_compliance = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // 3d: Hypothesis Engine (via edge function)
    (async (): Promise<HypothesisResult | null> => {
      const t0 = performance.now();
      try {
        const edgeResult = await withTimeout(
          withStageLogging("generate_hypotheses", async () => {
            const hyp = await generateDiagnosticHypotheses(
              input.visit_id || "trace",
              {
                patient_id: "",
                age: ctx.patient_age,
                sex: ctx.patient_sex,
                chief_complaint: ctx.chief_complaint,
                symptoms: symptoms.join(", "),
                duration: ctx.symptom_duration || "",
                vitals: {
                  temperature: vitals.temperature ?? null,
                  spo2: vitals.spo2 ?? null,
                  pulse: vitals.pulse ?? null,
                  bp_systolic: vitals.bp_systolic ?? null,
                  bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) || null : null,
                  respiratory_rate: ctx.respiratory_rate ?? null,
                  weight_kg: ctx.weight ?? null,
                  height_cm: ctx.height ?? null,
                },
                past_diagnoses: ctx.medical_history,
                medications: ctx.current_medications,
                allergies: ctx.allergies,
                lab_results: [],
                lifestyle_factors: {},
              },
            );
            if (!hyp) return null;
            return {
              hypotheses: hyp.hypotheses.map(h => ({
                condition: h.diagnosis,
                icd_code: null,
                confidence: h.confidence > 0.7 ? "high" as const : h.confidence > 0.4 ? "moderate" as const : "low" as const,
                supporting_evidence: h.supporting_factors,
                contradicting_evidence: h.contradicting_factors,
                recommended_tests: h.recommended_tests,
                urgency: "routine" as const,
              })),
              reasoning_chain: "",
              data_gaps: [],
              generated_at: hyp.generated_at,
              source: "edge_function",
            } satisfies HypothesisResult;
          }),
          TIMEOUT.HYPOTHESIS,
          "generate_hypotheses",
        );
        lat.generate_hypotheses = Math.round(performance.now() - t0);
        return edgeResult;
      } catch {
        lat.generate_hypotheses = Math.round(performance.now() - t0);
        console.warn("[Pipeline] Hypothesis engine failed — skipping explanation generation.");
        return null;
      }
    })(),
  ]);

  const hypotheses = hypothesesRaw;

  waveLat.wave3_reasoning = Math.round(performance.now() - w3Start);
  lineageTracker.recordEngineResult("bayesian", !!bayesianResult);
  lineageTracker.recordEngineResult("guideline", !!guidelineAlignment || !!guidelineCompliance);
  lineageTracker.recordEngineResult("hypothesis", !!hypotheses && hypotheses.hypotheses.length > 0);
  lineageTracker.captureSnapshot("Wave 3 (Reasoning)", "bayesian", {
    chief_complaint: ctx.chief_complaint, symptoms, associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration, medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [], risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications, allergies: ctx.allergies,
    vitals: { bp_systolic: vitals.bp_systolic, bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null, pulse: vitals.pulse, temperature: vitals.temperature, spo2: vitals.spo2, respiratory_rate: ctx.respiratory_rate, weight_kg: ctx.weight, height_cm: ctx.height },
    lab_results: [], risk_flags: ctx.risk_flags || [], patient_age: ctx.patient_age, patient_sex: ctx.patient_sex, context_confidence: 0,
  });

  onProgress?.("bayesian", { bayesian: bayesianResult });
  onProgress?.("guidelines", { guideline_alignment: guidelineAlignment, guideline_compliance: guidelineCompliance });
  onProgress?.("hypotheses", { hypotheses, guideline_alignment: guidelineAlignment, guideline_compliance: guidelineCompliance });

  // ═══════════════════════════════════════════════════════
  // WAVE 4 — Clinical Safety Evaluation
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
  lineageTracker.recordEngineResult("safety", !!oversight);
  lineageTracker.captureSnapshot("Wave 4 (Safety)", "safety", {
    chief_complaint: ctx.chief_complaint, symptoms, associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration, medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [], risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications, allergies: ctx.allergies,
    vitals: { bp_systolic: vitals.bp_systolic, bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null, pulse: vitals.pulse, temperature: vitals.temperature, spo2: vitals.spo2, respiratory_rate: ctx.respiratory_rate, weight_kg: ctx.weight, height_cm: ctx.height },
    lab_results: [], risk_flags: ctx.risk_flags || [], patient_age: ctx.patient_age, patient_sex: ctx.patient_sex, context_confidence: 0,
  });
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
          TIMEOUT.UNCERTAINTY,
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
            risk_factors: ctx.risk_factors || [],
            visit_id: input.visit_id,
            clinic_id: input.clinic_id,
          }),
          TIMEOUT.HYBRID,
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
  lineageTracker.recordEngineResult("uncertainty", !!uncertaintyResult);
  lineageTracker.captureSnapshot("Wave 5 (Output)", "soap", {
    chief_complaint: ctx.chief_complaint, symptoms, associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration, medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [], risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications, allergies: ctx.allergies,
    vitals: { bp_systolic: vitals.bp_systolic, bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null, pulse: vitals.pulse, temperature: vitals.temperature, spo2: vitals.spo2, respiratory_rate: ctx.respiratory_rate, weight_kg: ctx.weight, height_cm: ctx.height },
    lab_results: [], risk_flags: ctx.risk_flags || [], patient_age: ctx.patient_age, patient_sex: ctx.patient_sex, context_confidence: uncertaintyResult?.confidence_score ?? 0,
  });
  onProgress?.("uncertainty", { uncertainty: uncertaintyResult });
  onProgress?.("reasoning", { hybrid_reasoning: hybridReasoning });

  // ═══════════════════════════════════════════════════════
  // FINALIZE
  // ═══════════════════════════════════════════════════════
  const totalLatency = Math.round(performance.now() - pipelineStart);
  lat.total = totalLatency;

  console.log(
    `[Pipeline] v4.1 complete in ${totalLatency}ms. ` +
    `Waves: W1=${waveLat.wave1_context}ms W2=${waveLat.wave2_analysis}ms ` +
    `W3=${waveLat.wave3_reasoning}ms W4=${waveLat.wave4_safety}ms W5=${waveLat.wave5_output}ms. ` +
    `Cache: reasoning=${cache.reasoning_hit}, preindexed=${cache.preindexed_hit}, evidence=${cache.evidence_hit}. ` +
    `Organ system: ${dominantSystem || "none"}`,
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
      total_latency_ms: totalLatency,
      stage_latencies: lat,
      visit_id: input.visit_id || null,
      clinic_id: input.clinic_id || null,
      metadata: {
        pipeline_type: "modular_v4.1_waves",
        wave_latencies: waveLat,
        ddx_enabled: !!ddxResult,
        ddx_diagnoses: ddxResult?.differential_diagnoses.length || 0,
        organ_system_weighting: dominantSystem || "none",
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

  // ── SOAP Fallback: generate best-effort SOAP if hybrid reasoning fails ──
  let soapFallback: SOAPGeneratorResult | null = null;
  if (!hybridReasoning || !(hybridReasoning as any).soap) {
    console.log("[Pipeline] Hybrid reasoning missing SOAP — generating fallback SOAP.");
    try {
      const soapCtx = {
        chief_complaint: ctx.chief_complaint,
        symptoms: symptoms,
        symptom_duration: ctx.symptom_duration || "",
        associated_symptoms: ctx.associated_symptoms || [],
        medical_history: ctx.medical_history || [],
        family_history: (ctx as any).family_history || [],
        risk_factors: ctx.risk_factors || [],
        medications: ctx.current_medications || [],
        allergies: ctx.allergies || [],
        vitals: {
          bp_systolic: vitals.bp_systolic || null,
          bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) || null : null,
          pulse: vitals.pulse || null,
          temperature: vitals.temperature || null,
          spo2: vitals.spo2 || null,
          respiratory_rate: ctx.respiratory_rate || null,
          weight_kg: ctx.weight || null,
          height_cm: ctx.height || null,
        },
        lab_results: [] as any[],
        risk_flags: ctx.risk_flags || [],
        missing_information: [] as string[],
        context_confidence: 0.5,
        visit_id: input.visit_id || "",
        patient_id: "",
        clinic_id: input.clinic_id || "",
      };

      const soapDdx = {
        diagnoses: (ddxResult?.differential_diagnoses || []).map(d => ({
          diagnosis: d.diagnosis_name,
          probability_score: d.probability,
          icd10_code: d.icd10_code,
          supporting_symptoms: d.supporting_symptoms,
          contradicting_factors: d.contradicting_factors,
        })),
        recommended_labs: (ddxResult?.recommended_labs || []).map(l => ({
          test_name: l.test_name,
          priority: l.priority,
          differentiates: l.differentiates,
        })),
      };

      soapFallback = generateSOAP({
        context: soapCtx as any,
        ddx: soapDdx as any,
        medications: ddxResult?.suggested_medications ? {
          suggestions: ddxResult.suggested_medications.map(m => ({
            generic_name: m.generic_name,
            dose: "",
            frequency: "",
            safe: m.safe,
          })),
        } as any : undefined,
        guidelines: guidelineAlignment ? {
          recommendations: (guidelineAlignment as any).recommendations || [],
        } as any : guidelineCompliance ? {
          recommendations: (guidelineCompliance.management_steps || []).map((s: any) => ({
            recommendation: s.step,
            organization: s.source,
          })),
        } as any : undefined,
        uncertainty: uncertaintyResult ? {
          confidence_score: uncertaintyResult.confidence_score,
          confidence_label: uncertaintyResult.confidence_label,
          follow_up_questions: (uncertaintyResult as any).follow_up_questions || [],
        } as any : undefined,
      });
    } catch (e) {
      console.warn("[Pipeline] SOAP fallback generation failed:", e);
    }
  }
  lineageTracker.recordEngineResult("soap", !!soapFallback || !!(hybridReasoning as any)?.soap);

  // ── Final lineage snapshot (cockpit) ──
  lineageTracker.captureSnapshot("Cockpit", "cockpit", {
    chief_complaint: ctx.chief_complaint,
    symptoms: symptoms,
    associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration,
    medical_history: ctx.medical_history,
    family_history: (ctx as any).family_history || [],
    risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications,
    allergies: ctx.allergies,
    vitals: {
      bp_systolic: vitals.bp_systolic,
      bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null,
      pulse: vitals.pulse,
      temperature: vitals.temperature,
      spo2: vitals.spo2,
      respiratory_rate: ctx.respiratory_rate,
      weight_kg: ctx.weight,
      height_cm: ctx.height,
    },
    lab_results: [],
    risk_flags: ctx.risk_flags || [],
    patient_age: ctx.patient_age,
    patient_sex: ctx.patient_sex,
    context_confidence: uncertaintyResult?.confidence_score ?? 0,
  });
  lineageTracker.recordEngineResult("cockpit", true);

  const lineageReport = lineageTracker.generateReport();

  // ── Populate PCIE Context Graph with all engine outputs ──
  if (ddxResult) {
    pcieCore.updateReasoning({
      differential_diagnoses: ddxResult.differential_diagnoses,
      organ_systems_detected: (ddxResult as any).organ_systems_active || (dominantSystem ? [dominantSystem] : []),
    });
    pcieCore.updateDecision({
      recommended_investigations: (ddxResult.recommended_labs || []).map(l => ({
        test_name: l.test_name,
        priority: l.priority,
        differentiates: l.differentiates || [],
      })),
      treatment_suggestions: (ddxResult.suggested_medications || []).map(m => ({
        generic_name: m.generic_name,
        drug_class: m.drug_class,
        for_diagnosis: m.for_diagnosis,
        safe: m.safe,
      })),
    });
    pcieCore.addReasoningTrace("ddx", `Generated ${ddxResult.differential_diagnoses.length} candidates`);
  }
  if (physiologicalContext) {
    pcieCore.updateReasoning({
      physiology_models: physiologicalContext.physiological_states.map((s: any) => ({
        state_id: s.state_id || s.id || "",
        state_name: s.state_name || s.name || "",
        category: s.category || "",
        severity: s.severity || "",
      })),
    });
  }
  if (evidence && evidence.items.length > 0) {
    pcieCore.updateReasoning({
      evidence_sources: evidence.items.map(i => ({
        title: i.title,
        source: i.source,
        relevance_score: i.relevance_score,
      })),
    });
  }
  if (bayesianResult) {
    pcieCore.updateReasoning({
      bayesian_probabilities: bayesianResult.diagnoses.map(d => ({
        diagnosis_id: d.diagnosis_id,
        posterior_probability: d.posterior_probability,
        prior: d.prior,
        symptom_likelihood: d.symptom_likelihood,
        must_not_miss: d.must_not_miss,
      })),
    });
  }
  if (guidelineAlignment || guidelineCompliance) {
    pcieCore.updateReasoning({
      guideline_references: guideline_summary ? {
        sources_used: guideline_summary.guideline_sources_used,
        compliance_score: guideline_summary.guideline_compliance_score,
        recommendations: [],
        conflicts: guideline_summary.conflicts_detected,
      } : null,
    });
  }
  if (hypotheses) {
    pcieCore.updateReasoning({ hypotheses: hypotheses.hypotheses });
  }
  if (oversight) {
    pcieCore.updateDecision({
      safety_alerts: oversight.events || [],
      safety_score: oversight.safety_score,
    });
  }
  if (uncertaintyResult) {
    pcieCore.updateDecision({
      uncertainty_score: uncertaintyResult.confidence_score,
      confidence_score: uncertaintyResult.confidence_score,
      confidence_label: uncertaintyResult.confidence_label,
    });
  }
  if (hybridReasoning) {
    pcieCore.updateDecision({
      paradigm_agreement: (hybridReasoning as any).paradigm_agreement ?? null,
    });
    if ((hybridReasoning as any).soap) {
      pcieCore.updateDocumentation({
        soap_note: (hybridReasoning as any).soap,
        soap_source: "hybrid_reasoning",
      });
    }
  } else if (soapFallback) {
    pcieCore.updateDocumentation({
      soap_note: soapFallback.soap,
      soap_source: "fallback_generator",
    });
  }

  const contextGraph = pcieCore.getGraph();

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
    guideline_compliance: guidelineCompliance,
    evidence,
    oversight,
    hybrid_reasoning: hybridReasoning,
    soap_fallback: soapFallback,
    multi_agent: multiAgentResult,
    guideline_summary,
    logs: getPipelineLogs(),
    stage_latencies: lat,
    wave_latencies: waveLat,
    total_latency_ms: totalLatency,
    cache_stats: cache,
    lineage: lineageReport,
    context_graph: { ...contextGraph } as UnifiedClinicalContextGraph,
  };
}

/** @deprecated Use runUnifiedClinicalPipeline instead */
export const runClinicalPipeline = runUnifiedClinicalPipeline;
