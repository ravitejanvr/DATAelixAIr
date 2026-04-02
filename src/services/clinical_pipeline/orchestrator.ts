/**
 * Clinical Pipeline Orchestrator (v4.3 — Cognitive Diagnostic Architecture)
 *
 * Wave-based parallel execution with Clinical World Model integration.
 *
 *   Wave 0 — PCIE Context Hydration
 *   Wave 1 — Context Preparation
 *   Wave 1.5 — Meta-Reasoning Orchestrator (Clinical World Model)
 *   Wave 1.8 — Episodic Memory (patient history, doctor patterns, epidemiology)
 *   Wave 2 — Parallel Context Analysis (DDX, Physiology, Preindexed)
 *   Wave 2b — Evidence Retrieval (enriched with DDX results)
 *   Wave 2c — Hypothesis Testing (graph-based DDX validation)
 *   Wave 2d — Causal Reasoning (causal chains, convergent pathways, counterfactuals)
 *   Wave 3 — Parallel Clinical Reasoning (Bayesian, Guidelines, Hypotheses, Evidence Planning)
 *   Wave 3.5 — Reasoning Conflict Resolution
 *   Wave 3.6 — Bounded Diagnostic Loop (iterative refinement if confidence is low)
 *   Wave 4 — Clinical Safety Evaluation
 *   Wave 5 — Output Generation (Uncertainty, Hybrid Reasoning, SOAP)
 */

import { isNewPipelineEnabled, isPhase6IntelligenceCoreEnabled } from "@/services/feature_flags";
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
import { runMetaReasoning, resolveReasoningConflict, type MetaReasoningOutput, type ConflictResolution } from "@/services/meta_reasoning";
import { testHypotheses, type HypothesisTestResult } from "@/services/hypothesis_testing/client";
import { planEvidence, type EvidencePlanResult } from "@/services/evidence_planning/client";
import { planAndPersistEvidence } from "@/services/cognitive/evidence_planner";
import { runCausalReasoning, type CausalReasoningResult } from "@/services/causal_reasoning/client";
import { getCalibrationFactors, buildCalibrationMap, type CalibrationResult } from "@/services/learning_system/calibration_client";
import { queryEpisodicMemory, buildEpisodicPriors, type EpisodicMemoryResult } from "@/services/episodic_memory/client";
import { runCognitiveLayer, type CognitiveLayerResult } from "@/services/cognitive";
import { applyCandidateFallback, type FallbackMeta } from "@/services/ddx_engine/candidate_fallback";
import { applyCandidateFallbackV2, type FallbackV2Meta } from "@/services/ddx_engine/candidate_fallback_v2";
import { expandCandidatesFromContext, type ExpansionResult } from "@/services/context_candidate_expander";
import { applyFailureDerivedRules } from "@/services/clinical_pipeline/failure_derived_rules";
import { mergeActivations, expandKG, expandKGDeep } from "@/services/kg";
import { isPhase5ContextCandidatesEnabled } from "@/services/feature_flags";
import { detectContextAwareSafetyFlags } from "@/services/context_engine/context_aware_safety";
import { rankCandidates, type IntelligenceCoreResult } from "@/services/reasoning/intelligence_core";
import { shouldTriggerRecovery, runRecallRecovery } from "@/services/reasoning/recall_recovery";
import { normalizeSignals } from "@/services/signal_normalizer";
import { generateSuspicionSignals } from "@/services/suspicion_engine";
import { safetyNetActivation } from "@/services/reasoning/safety_net_activation";
import { weakSignalDiagnosisActivation } from "@/services/reasoning/weak_signal_activation";
import { applyPhase7Ranking, type Phase7Result } from "@/services/reasoning/phase7_clinical_ranker";
import { isPhase7ClinicalRankerEnabled } from "@/services/feature_flags";
import { domainCoverageGuarantee } from "@/services/reasoning/domain_coverage_guarantee";
import { recognizeClinicalPatterns } from "@/services/reasoning/pattern_recognizer";

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

export interface DiagnosticLoopMeta {
  executed: boolean;
  reason: string;
  candidates_pruned: number;
  candidates_remaining: number;
  iteration_ms: number;
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
  meta_reasoning: MetaReasoningOutput | null;
  hypothesis_testing: HypothesisTestResult | null;
  evidence_plan: EvidencePlanResult | null;
  conflict_resolution: ConflictResolution | null;
  diagnostic_loop: DiagnosticLoopMeta | null;
  causal_reasoning: CausalReasoningResult | null;
  calibration: CalibrationResult | null;
  episodic_memory: EpisodicMemoryResult | null;
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
  /** Wave 6 — Cognitive layer (runs async, populated after pipeline returns) */
  cognitive_layer: CognitiveLayerResult | null;
}

export type PipelineProgressCallback = (stage: string, data: Partial<PipelineResult>) => void;

// ── Adaptive Timeout Constants (per-engine) ──

const TIMEOUT = {
  PCIE:            2000,
  DDX:             8000,
  PHYSIOLOGY:      6000,
  EVIDENCE:        6000,
  PREINDEXED:      2000,
  BAYESIAN:        6000,
  GUIDELINE:       6000,
  GUIDELINE_COMPLIANCE: 6000,
  HYPOTHESIS:      8000,
  HYPOTHESIS_TESTING: 3000,
  EVIDENCE_PLANNING: 3000,
  UNCERTAINTY:     5000,
  HYBRID:          8000,
  SOAP:            4000,
  CAUSAL_REASONING: 3000,
  EPISODIC_MEMORY:  2000,
} as const;

// ── Organ-System Weighting ──

const ORGAN_SYSTEM_WEIGHTS: Record<string, number> = {
  cardiovascular: 1.4,
  respiratory:    1.1,
  ent:            1.0,
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
    // Cardiovascular
    "chest pain": "cardiovascular",
    "left arm pain": "cardiovascular",
    "diaphoresis": "cardiovascular",
    "palpitations": "cardiovascular",
    "tachycardia": "cardiovascular",
    "crushing chest": "cardiovascular",
    // Respiratory
    "shortness of breath": "respiratory",
    "dyspnea": "respiratory",
    "cough": "respiratory",
    "productive cough": "respiratory",
    "wheezing": "respiratory",
    "sputum": "respiratory",
    "pleuritic": "respiratory",
    "runny nose": "respiratory",
    "nasal congestion": "respiratory",
    "sneezing": "respiratory",
    "coryza": "respiratory",
    // ENT
    "sore throat": "ent",
    "pharyngitis": "ent",
    "throat pain": "ent",
    "ear pain": "ent",
    "otalgia": "ent",
    "hoarseness": "ent",
    // Neurological
    "headache": "neurological",
    "dizziness": "neurological",
    "syncope": "neurological",
    "seizure": "neurological",
    "neck stiffness": "neurological",
    "photophobia": "neurological",
    "confusion": "neurological",
    "blurred vision": "neurological",
    // Gastrointestinal
    "nausea": "gastrointestinal",
    "vomiting": "gastrointestinal",
    "abdominal pain": "gastrointestinal",
    "diarrhea": "gastrointestinal",
    "abdominal cramps": "gastrointestinal",
    "loss of appetite": "gastrointestinal",
    // Infectious
    "fever": "infectious",
    "chills": "infectious",
    "rigors": "infectious",
    "sweating": "infectious",
    "night sweats": "infectious",
    // Musculoskeletal
    "joint pain": "musculoskeletal",
    "back pain": "musculoskeletal",
    "body ache": "musculoskeletal",
    "unsteady gait": "musculoskeletal",
    // Dermatological
    "rash": "dermatological",
    "urticaria": "dermatological",
    "pruritus": "dermatological",
    "skin rash": "dermatological",
    "petechial rash": "dermatological",
    "maculopapular rash": "dermatological",
    // Endocrine
    "polyuria": "endocrine",
    "polydipsia": "endocrine",
    "weight loss": "endocrine",
    // Renal
    "hematuria": "renal",
    "oliguria": "renal",
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
  const bpParts = ctx.blood_pressure ? ctx.blood_pressure.split("/") : [];
  return {
    temperature: ctx.temperature,
    spo2: ctx.oxygen_saturation,
    pulse: ctx.pulse,
    bp: ctx.blood_pressure,
    bp_systolic: bpParts.length >= 1 ? parseInt(bpParts[0]) : undefined,
    bp_diastolic: bpParts.length >= 2 ? parseInt(bpParts[1]) : undefined,
    respiratory_rate: ctx.respiratory_rate,
    blood_sugar: ctx.blood_sugar,
  };
}

/** Build a DDX-enriched evidence query for higher relevance */
function buildEvidenceQuery(
  chiefComplaint: string,
  ddxResult: DDXResult | null,
  ctx?: { risk_factors?: string[]; patient_age?: number | null; patient_sex?: string | null },
): string {
  const parts: string[] = [];

  // Lead with top diagnoses for specificity (not raw chief complaint which is often verbose)
  if (ddxResult?.differential_diagnoses?.length) {
    const topDx = ddxResult.differential_diagnoses
      .slice(0, 3)
      .map(d => d.diagnosis_name);
    parts.push(...topDx);
  } else {
    // Fallback: use chief complaint if no DDX
    parts.push(chiefComplaint);
  }

  // Add organ system for clinical context
  if (ddxResult?.organ_systems_active?.length) {
    parts.push(ddxResult.organ_systems_active[0]);
  }

  // Add clinical action terms for retrieval specificity
  parts.push("clinical management treatment guidelines");

  // Demographics only if clinically relevant
  if (ctx?.patient_age) {
    if (ctx.patient_age < 5) parts.push("pediatric infant");
    else if (ctx.patient_age < 18) parts.push("pediatric");
    else if (ctx.patient_age > 65) parts.push("elderly geriatric");
  }

  // Risk factors for contextual relevance
  if (ctx?.risk_factors?.length) parts.push(...ctx.risk_factors.slice(0, 2));

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
    multi_agent: null, meta_reasoning: null, hypothesis_testing: null, evidence_plan: null, conflict_resolution: null, diagnostic_loop: null, causal_reasoning: null, calibration: null, episodic_memory: null, guideline_summary: null,
    logs: [], stage_latencies: {}, wave_latencies: {}, total_latency_ms: 0,
    cache_stats: cache, lineage: null, context_graph: null, cognitive_layer: null,
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
  // Immutable local copy — pipeline enrichments do NOT mutate caller's object
  let ctx: ClinicalContext = { ...input.clinical_context };

  // Hydrate PCIE Core from input context
  pcieCore.hydrateFromClinicalContext(ctx);

  // Initial snapshot — pre-pipeline context
  lineageTracker.captureSnapshot("Wave 0 (Pre)", "pcie", {
    chief_complaint: ctx.chief_complaint,
    symptoms: ctx.symptoms,
    associated_symptoms: ctx.associated_symptoms,
    symptom_duration: ctx.symptom_duration,
    medical_history: ctx.medical_history,
    family_history: ctx.family_history || [],
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
        // Merge PCIE data into local context copy (immutable update)
        ctx = {
          ...ctx,
          chief_complaint: ctx.chief_complaint || unifiedContext.chief_complaint || ctx.chief_complaint,
          medical_history: (ctx.medical_history?.length) ? ctx.medical_history : unifiedContext.medical_history,
          allergies: (ctx.allergies?.length) ? ctx.allergies : unifiedContext.allergies,
          current_medications: (ctx.current_medications?.length) ? ctx.current_medications : unifiedContext.current_medications,
          risk_factors: (ctx.risk_factors?.length) ? ctx.risk_factors : unifiedContext.risk_factors,
          family_history: ctx.family_history?.length ? ctx.family_history : unifiedContext.family_history,
        };
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

  // ── Prefetch calibration data (non-blocking, resolves before Wave 3) ──
  let calibrationResult: CalibrationResult | null = null;
  const calibrationPromise = getCalibrationFactors(input.clinic_id || undefined)
    .then(r => { calibrationResult = r; })
    .catch(() => {});

  // ── Prefetch episodic memory (non-blocking, resolves before Wave 2 DDX) ──
  let episodicMemoryResult: EpisodicMemoryResult | null = null;
  const episodicPromise = queryEpisodicMemory({
    patient_id: ctx.patient_id || undefined,
    doctor_id: ctx.doctor_id || undefined,
    clinic_id: input.clinic_id || undefined,
    symptoms,
    chief_complaint: ctx.chief_complaint,
    patient_age: ctx.patient_age,
    patient_sex: ctx.patient_sex,
  }).then(r => { episodicMemoryResult = r; })
    .catch(e => { console.warn("[Pipeline] Episodic memory prefetch failed:", e); });

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
    family_history: ctx.family_history || [],
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
  // WAVE 1.5 — Meta-Reasoning Orchestrator (Clinical World Model)
  // ═══════════════════════════════════════════════════════
  const w15Start = performance.now();
  let metaReasoningResult: MetaReasoningOutput | null = null;
  try {
    metaReasoningResult = await runMetaReasoning({
      symptoms,
      vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp_systolic: vitals.bp_systolic },
      history: ctx.medical_history,
      medications: ctx.current_medications,
      allergies: ctx.allergies,
      chief_complaint: ctx.chief_complaint,
    });
    console.log(
      `[Pipeline] Wave 1.5: Meta-reasoning complete — ` +
      `organs=[${metaReasoningResult.world_state.organ_systems.join(",")}] ` +
      `risk=${metaReasoningResult.world_state.risk_level} ` +
      `hypotheses=${metaReasoningResult.world_state.hypotheses.length} ` +
      `pathways=[${metaReasoningResult.activated_pathways.join(",")}]`
    );
    lineageTracker.recordEngineResult("meta_reasoning", true);
    pcieCore.addReasoningTrace("meta_reasoning", `World model: ${metaReasoningResult.world_state.organ_systems.join(", ")} | risk=${metaReasoningResult.world_state.risk_level}`);
  } catch (e) {
    console.warn("[Pipeline] Wave 1.5: Meta-reasoning failed, continuing without world model:", e);
    lineageTracker.recordEngineResult("meta_reasoning", false);
  }
  waveLat.wave15_meta_reasoning = Math.round(performance.now() - w15Start);
  lat.meta_reasoning = waveLat.wave15_meta_reasoning;
  onProgress?.("meta_reasoning", { meta_reasoning: metaReasoningResult });

  // ═══════════════════════════════════════════════════════
  // WAVE 1.8 — Episodic Memory (resolve prefetch)
  // Patient longitudinal recall, doctor patterns, epidemiological signals.
  // Non-blocking prefetch started earlier; we resolve here before DDX.
  // ═══════════════════════════════════════════════════════
  const w18Start = performance.now();
  await episodicPromise; // Resolve the prefetch
  if (episodicMemoryResult) {
    const signals = episodicMemoryResult.memory_signals;
    console.log(
      `[Pipeline] Wave 1.8: Episodic memory loaded — ` +
      `patient_visits=${episodicMemoryResult.patient_memory?.total_past_visits || 0} ` +
      `doctor_consults=${episodicMemoryResult.doctor_patterns?.top_diagnoses.length || 0} ` +
      `clusters=${episodicMemoryResult.cross_patient?.recent_symptom_clusters.length || 0} ` +
      `signals=[${signals.join(",")}] (${episodicMemoryResult.execution_ms}ms)`
    );
    lineageTracker.recordEngineResult("episodic_memory", true);
    pcieCore.addReasoningTrace(
      "episodic_memory" as any,
      `Episodic: ${episodicMemoryResult.patient_memory?.total_past_visits || 0} past visits, ` +
      `${episodicMemoryResult.patient_memory?.recurring_conditions.length || 0} recurrences, ` +
      `${episodicMemoryResult.cross_patient?.recent_symptom_clusters.length || 0} clusters`
    );

    // Inject epidemiological and recurrence signals as risk flags (immutable)
    const episodicRiskFlags: string[] = [];
    if (episodicMemoryResult.patient_memory?.longitudinal_risk_signals.length) {
      episodicRiskFlags.push(
        ...episodicMemoryResult.patient_memory.longitudinal_risk_signals.map(s => `[Episodic] ${s}`),
      );
    }
    if (episodicMemoryResult.cross_patient?.seasonal_alerts.length) {
      episodicRiskFlags.push(
        ...episodicMemoryResult.cross_patient.seasonal_alerts.map(s => `[Seasonal] ${s}`),
      );
    }
    if (episodicRiskFlags.length > 0) {
      ctx = { ...ctx, risk_flags: [...(ctx.risk_flags || []), ...episodicRiskFlags] };
    }
    // Outbreak alert → oversight event
    const outbreakClusters = episodicMemoryResult.cross_patient?.recent_symptom_clusters.filter(
      c => c.alert_level === "outbreak" || c.alert_level === "elevated"
    ) || [];
    for (const cluster of outbreakClusters) {
      recordOversightEvent({
        event_type: "epidemiological_cluster",
        severity: cluster.alert_level === "outbreak" ? "critical" : "warning",
        stage: "episodic_memory",
        message: `${cluster.alert_level.toUpperCase()}: ${cluster.patient_count} patients with similar symptoms in last 7 days`,
        metadata: { symptom_cluster: cluster.symptom_cluster, patient_count: cluster.patient_count },
      });
    }
  } else {
    lineageTracker.recordEngineResult("episodic_memory", false);
  }
  waveLat.wave18_episodic_memory = Math.round(performance.now() - w18Start);
  lat.episodic_memory = waveLat.wave18_episodic_memory;
  onProgress?.("episodic_memory", { episodic_memory: episodicMemoryResult });

  // ═══════════════════════════════════════════════════════
  // WAVE 2 — Sequential: Physiology → DDX (physiology feeds DDX)
  //   + Parallel: Pre-indexed Knowledge Lookup
  // ═══════════════════════════════════════════════════════
  const w2Start = performance.now();

  // 2a: Physiological State Engine (runs FIRST to feed DDX)
  let physiologicalContext: PhysiologicalContextResult | null = null;
  {
    const t0 = performance.now();
    try {
      physiologicalContext = await withRetry(
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
    } catch {
      lat.physiological_engine = Math.round(performance.now() - t0);
    }
  }

  // Build physiological context payload for DDX engine
  const physioPayload = physiologicalContext ? {
    candidate_diagnosis_ids: physiologicalContext.candidate_diagnosis_ids || [],
    affected_systems: physiologicalContext.affected_systems?.map((s: any) => s.system_name || s) || [],
    physiological_states: physiologicalContext.physiological_states?.map((s: any) => ({
      state: s.state,
      confidence: s.confidence,
      system: s.system,
    })) || [],
  } : undefined;

  if (physiologicalContext) {
    console.log(
      `[Pipeline] Wave 2a: Physiology complete — ` +
      `${physiologicalContext.physiological_states?.length || 0} states, ` +
      `${physiologicalContext.candidate_diagnosis_ids?.length || 0} candidate dx IDs, ` +
      `${physiologicalContext.affected_systems?.length || 0} systems`
    );
  }

  // 2b: DDX Engine + Pre-indexed Knowledge (parallel — DDX now receives physiology)
  const [ddxResultRaw, preindexedMatches] = await Promise.all([
    // DDX Engine (with physiological context wired in)
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
              physiological_context: physioPayload,
              // Clinical modifiers for multi-signal candidate retrieval
              onset_pattern: ctx.onset_pattern || null,
              severity: ctx.severity || null,
              body_location: ctx.body_location || null,
              risk_factors: ctx.risk_factors || [],
              duration: ctx.symptom_duration || null,
              family_history: ctx.family_history || [],
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

    // Pre-indexed Knowledge (instant, <50ms)
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

  // ── Phase 6.3: Signal Normalization (BEFORE rules) ──
  const normalizedCtx = normalizeSignals(ctx);
  const ctxForRules = normalizedCtx.enriched;

  // ── Phase 5: KG-Native Context-Assisted Candidate Generation ──
  if (isPhase5ContextCandidatesEnabled()) {
    // Phase 5.1-5.2: Failure-derived rules → cluster activations (uses normalized ctx)
    const failureResult = applyFailureDerivedRules(ctxForRules);
    if (failureResult.rules_fired.length > 0) {
      recordOversightEvent({
        event_type: "phase5_context_expansion",
        severity: "info",
        stage: "failure_derived_rules",
        message: `Failure-derived rules fired ${failureResult.rules_fired.length} rules, activated ${failureResult.total_activations} clusters`,
        metadata: { rules: failureResult.rules_fired, clusters: [...failureResult.activation.nodes] } as any,
      });
    }

    // Phase 5.0: Context expander → cluster activations (uses normalized ctx)
    const expansion = expandCandidatesFromContext(ctxForRules);
    if (expansion.expansion_trace.length > 0) {
      recordOversightEvent({
        event_type: "phase5_context_expansion",
        severity: "info",
        stage: "context_candidate_expander",
        message: `Context expander fired ${expansion.expansion_trace.length} rules, activated ${expansion.activation.nodes.size} clusters, added ${expansion.added_symptoms.length} symptoms`,
        metadata: { trace: expansion.expansion_trace, clusters: [...expansion.activation.nodes] } as any,
      });
    }

    // Phase 6.2: Suspicion Engine → additional cluster activations (uses normalized ctx)
    const suspicion = generateSuspicionSignals(ctxForRules);
    if (suspicion.signal_count > 0) {
      recordOversightEvent({
        event_type: "suspicion_engine",
        severity: "info",
        stage: "suspicion_engine",
        message: `Suspicion engine generated ${suspicion.signal_count} signals: [${suspicion.signals.map(s => `${s.type}:${s.cluster}`).join(", ")}]`,
        metadata: { signals: suspicion.signals } as any,
      });
    }

    // Phase 6.9: Pattern Recognition — multi-symptom clinical pattern detection
    const patternResult = recognizeClinicalPatterns(ctxForRules);
    if (patternResult.pattern_count > 0) {
      recordOversightEvent({
        event_type: "phase5_context_expansion" as any,
        severity: "info",
        stage: "pattern_recognizer",
        message: `Pattern recognizer matched ${patternResult.pattern_count} patterns, injecting ${patternResult.injected_candidates.length} MNM candidates`,
        metadata: { patterns: patternResult.patterns_matched.map(p => p.pattern_id) } as any,
      });
    }

    // KG-Native: Merge ALL activations → expand via KG clusters → candidate hints
    const mergedActivation = mergeActivations(
      mergeActivations(
        mergeActivations(failureResult.activation, expansion.activation),
        suspicion.activation,
      ),
      patternResult.activation,
    );

    // Phase 6.6: SafetyNet — ensure critical domains are explored
    const safetyNet = safetyNetActivation(ctx, mergedActivation);
    const postSafetyNetActivation = safetyNet.activation;
    if (safetyNet.safetynet_count > 0) {
      recordOversightEvent({
        event_type: "phase6_safetynet",
        severity: "info",
        stage: "safety_net_activation",
        message: `SafetyNet activated ${safetyNet.safetynet_count} domain(s): [${safetyNet.activated_domains.join(", ")}]`,
        metadata: { reasons: safetyNet.activation_reasons, domains: safetyNet.activated_domains } as any,
      });
    }

    // Phase 6: Deep KG traversal (multi-hop) if Intelligence Core enabled
    const expandedActivation = isPhase6IntelligenceCoreEnabled()
      ? expandKGDeep(postSafetyNetActivation, 2, 0.5)
      : postSafetyNetActivation;

    const kgExpansion = expandKG(expandedActivation);
    let allHints = kgExpansion.candidates;

    // Inject pattern-detected MNM candidates (deduped against KG results)
    for (const pc of patternResult.injected_candidates) {
      const exists = allHints.some(h => h.diagnosis_name.toLowerCase() === pc.diagnosis_name.toLowerCase());
      if (!exists) {
        allHints.push(pc);
      }
    }

    // Phase 6.7: Weak Signal Diagnosis Activation — recover missed diagnoses within active clusters
    if (isPhase6IntelligenceCoreEnabled()) {
      const wsaResult = weakSignalDiagnosisActivation(ctx, allHints, expandedActivation);
      allHints = wsaResult.candidates;
      if (wsaResult.boosts_applied.length > 0) {
        recordOversightEvent({
          event_type: "phase6_safetynet" as any,
          severity: "info",
          stage: "weak_signal_activation",
          message: `Phase 6.7: ${wsaResult.boosts_applied.length} weak signal boosts (${wsaResult.total_scanned} scanned)`,
          metadata: { boosts: wsaResult.boosts_applied } as any,
        });
      }
    }

    // Domain Coverage Guarantee — ensure all major clinical domains represented
    const domainCoverage = domainCoverageGuarantee(allHints);
    allHints = domainCoverage.candidates;
    if (domainCoverage.injected_count > 0) {
      recordOversightEvent({
        event_type: "phase5_context_expansion" as any,
        severity: "info",
        stage: "domain_coverage_guarantee",
        message: `Domain coverage: injected ${domainCoverage.injected_count} representatives. Filled: [${domainCoverage.domains_filled.join(", ")}]`,
        metadata: { domains_filled: domainCoverage.domains_filled, already_covered: domainCoverage.domains_already_covered } as any,
      });
    }

    if (kgExpansion.clusters_resolved.length > 0) {
      recordOversightEvent({
        event_type: "phase5_context_expansion",
        severity: "info",
        stage: "kg_expander",
        message: `KG expanded ${kgExpansion.clusters_resolved.length} clusters → ${allHints.length} candidates`,
        metadata: { clusters: kgExpansion.clusters_resolved, detail: kgExpansion.expansion_detail } as any,
      });
    }

    // Phase 6: Intelligence Core ranking (pre-DDX candidate scoring)
    let intelligenceCoreResult: IntelligenceCoreResult | null = null;
    if (isPhase6IntelligenceCoreEnabled() && allHints.length > 0) {
      intelligenceCoreResult = rankCandidates({
        context: ctx,
        candidates: allHints,
        activation: expandedActivation,
      });

      // Recall Recovery: if Intelligence Core yields low confidence, expand deeper
      if (shouldTriggerRecovery(intelligenceCoreResult.candidate_count, intelligenceCoreResult.top_score * 100)) {
        const recovery = runRecallRecovery({
          activation: expandedActivation,
          symptoms,
          current_candidate_count: intelligenceCoreResult.candidate_count,
          top_score: intelligenceCoreResult.top_score * 100,
        });
        // Re-rank with recovery candidates merged
        const recoveryHints = [...allHints, ...recovery.additional_candidates];
        intelligenceCoreResult = rankCandidates({
          context: ctx,
          candidates: recoveryHints,
          activation: expandedActivation,
        });
        recordOversightEvent({
          event_type: "recall_recovery_triggered",
          severity: "warning",
          stage: "intelligence_core",
          message: `Recovery mode: ${recovery.trigger_reason}. Added ${recovery.additional_candidates.length} candidates from ${recovery.clusters_explored.length} clusters`,
          metadata: { recovery } as any,
        });
      }

      recordOversightEvent({
        event_type: "phase6_intelligence_core",
        severity: "info",
        stage: "intelligence_core",
        message: `Ranked ${intelligenceCoreResult.candidate_count} candidates in ${intelligenceCoreResult.execution_ms}ms. Top: ${intelligenceCoreResult.ranked[0]?.diagnosis || "none"} (${intelligenceCoreResult.top_score})`,
        metadata: { top_5: intelligenceCoreResult.ranked.slice(0, 5).map(r => ({ diagnosis: r.diagnosis, score: r.score })) } as any,
      });
    }

    // Phase 7: Clinical Intelligence Ranking (pattern matching, epi priors, competition)
    if (isPhase7ClinicalRankerEnabled() && intelligenceCoreResult && intelligenceCoreResult.candidate_count > 0) {
      const phase7 = applyPhase7Ranking({ icResult: intelligenceCoreResult, context: ctx });
      if (phase7.phase7_reordered) {
        recordOversightEvent({
          event_type: "phase6_intelligence_core" as any,
          severity: "info",
          stage: "phase7_ranking",
          message: `Phase 7: ${phase7.reorder_summary} (${phase7.execution_ms}ms)`,
          metadata: { top3: phase7.ranked.slice(0, 3).map(r => ({ dx: r.diagnosis, p7: r.phase7_score, pattern: r.phase7.pattern_label })) } as any,
        });
      }
    }

    // Use fallback v2 with KG-resolved hints
    const { ddx: ddxAfterFallback, fallback: fallbackMeta } = applyCandidateFallbackV2(
      ddxResult, symptoms, allHints,
      { medical_history: ctx.medical_history, risk_factors: ctx.risk_factors, age: ctx.patient_age, medications: ctx.current_medications },
    );
    ddxResult = ddxAfterFallback;
    if (fallbackMeta.triggered) {
      recordOversightEvent({
        event_type: "candidate_fallback_v2_triggered",
        severity: "info",
        stage: "ddx_engine",
        message: `Fallback v2 injected ${fallbackMeta.total_injected} candidates (${fallbackMeta.hint_count} hints, ${fallbackMeta.fallback_count} rules). Rules: ${fallbackMeta.rules_matched.join(", ")}`,
        metadata: fallbackMeta as any,
      });
    }
  } else {
    // Legacy fallback (Phase 4 behavior)
    const { ddx: ddxAfterFallback, fallback: fallbackMeta } = applyCandidateFallback(
      ddxResult, symptoms,
      { medical_history: ctx.medical_history, risk_factors: ctx.risk_factors, age: ctx.patient_age, medications: ctx.current_medications },
    );
    ddxResult = ddxAfterFallback;
    if (fallbackMeta.triggered) {
      recordOversightEvent({
        event_type: "candidate_fallback_triggered",
        severity: "info",
        stage: "ddx_engine",
        message: `Fallback injected ${fallbackMeta.fallback_count} candidates (organic: ${fallbackMeta.organic_count}). Rules: ${fallbackMeta.rules_matched.join(", ")}`,
        metadata: fallbackMeta as any,
      });
    }
  }

  // ── Vitals-Aware MNM Score Protection ──
  // Ensure MNM diagnoses with supporting vitals signals are not under-scored
  if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const temp = vitals.temperature ?? 0;
    const hr = vitals.pulse ?? 0;
    const rr = ctx.respiratory_rate ?? 0;
    const sbp = vitals.bp_systolic ?? 999;
    const spo2Val = vitals.spo2 ?? 100;
    const riskFactorsLower = (ctx.risk_factors || []).map(r => r.toLowerCase());

    ddxResult = {
      ...ddxResult,
      differential_diagnoses: ddxResult.differential_diagnoses.map(d => {
        const dxLower = d.diagnosis_name.toLowerCase().trim();

        // Sepsis vitals-based boost (SIRS criteria: temp ≥102, HR ≥100, RR ≥22, SBP ≤100)
        if (dxLower === "sepsis" || dxLower.includes("sepsis")) {
          let vitalBoost = 0;
          if (temp >= 102) vitalBoost += 5;
          if (hr >= 100) vitalBoost += 4;
          if (rr >= 22) vitalBoost += 3;
          if (sbp <= 100) vitalBoost += 4;
          if (spo2Val <= 94) vitalBoost += 3;
          if (riskFactorsLower.some(r => r.includes("diabet"))) vitalBoost += 3;

          if (vitalBoost > 0) {
            const boostedProb = Math.min(d.probability + vitalBoost, 60);
            console.log(
              `[Pipeline] MNM-Vitals: Sepsis boosted ${d.probability}% → ${boostedProb}% ` +
              `(vitals: T=${temp}, HR=${hr}, RR=${rr}, SBP=${sbp}, SpO2=${spo2Val})`
            );
            return { ...d, probability: boostedProb, must_not_miss: true };
          }
        }

        return d;
      }),
    };
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
    family_history: ctx.family_history || [],
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
  // WAVE 2c — Hypothesis Testing (validates DDX against symptom_likelihoods)
  // Deterministic, graph-only — no LLM. Target: <200ms.
  // ═══════════════════════════════════════════════════════
  let hypothesisTestResult: HypothesisTestResult | null = null;
  const dxWithIds = ddxResult?.differential_diagnoses?.filter(d => d.diagnosis_name) || [];
  if (dxWithIds.length > 0) {
    const w2cStart = performance.now();
    try {
      hypothesisTestResult = await withTimeout(
        testHypotheses({
          candidate_diagnoses: dxWithIds.map((d, i) => ({
            diagnosis_id: d.diagnosis_id || `fallback-${i}-${d.diagnosis_name?.replace(/\s+/g, '-').toLowerCase()}`,
            diagnosis_name: d.diagnosis_name,
            icd10_code: d.icd10_code || null,
            probability: d.probability || 0,
            must_not_miss: d.must_not_miss || false,
          })),
          patient_symptoms: symptoms,
          patient_age: ctx.patient_age,
          patient_sex: ctx.patient_sex,
          allergies: ctx.allergies,
          current_medications: ctx.current_medications,
        }),
        TIMEOUT.HYPOTHESIS_TESTING,
        "hypothesis_testing",
      );
      if (hypothesisTestResult) {
        console.log(
          `[Pipeline] Wave 2c: Hypothesis testing complete — ` +
          `supported=${hypothesisTestResult.summary.supported}, ` +
          `partial=${hypothesisTestResult.summary.partially_supported}, ` +
          `weak=${hypothesisTestResult.summary.weakly_supported} ` +
          `(${hypothesisTestResult.execution_ms}ms)`,
        );
        // Update DDX probabilities with evidence-adjusted values
        // GUARD: hypothesis layer refines scores, never recomputes from scratch
        if (hypothesisTestResult.tested_hypotheses.length > 0) {
          const adjustedMap = new Map(
            hypothesisTestResult.tested_hypotheses.map(h => [h.diagnosis_id, h]),
          );
          ddxResult = {
            ...ddxResult,
            differential_diagnoses: ddxResult.differential_diagnoses.map(d => {
              const tested = adjustedMap.get(d.diagnosis_id);
              if (tested) {
                const prevScore = d.probability;
                const newScore = tested.adjusted_probability;
                // INVARIANT: reject if hypothesis layer dropped score > 30%
                if (newScore < prevScore * 0.7) {
                  console.warn(
                    `[Pipeline] Hypothesis guard: ${d.diagnosis_name} score drop blocked (${prevScore}→${newScore}). Keeping ${Math.round(prevScore * 0.7)}.`
                  );
                  return { ...d, probability: Math.round(prevScore * 0.7) };
                }
                return { ...d, probability: newScore };
              }
              return d;
            }).sort((a, b) => b.probability - a.probability),
          };
        }
        pcieCore.addReasoningTrace(
          "hypothesis_testing",
          `Tested ${hypothesisTestResult.summary.total_tested} hypotheses: ${hypothesisTestResult.summary.supported} supported`,
        );
      }
    } catch {
      console.warn("[Pipeline] Wave 2c: Hypothesis testing failed — continuing with original DDX scores.");
    }
    lat.hypothesis_testing = Math.round(performance.now() - w2cStart);
    waveLat.wave2c_hypothesis_testing = lat.hypothesis_testing;
    lineageTracker.recordEngineResult("hypothesis_testing", !!hypothesisTestResult);
  }
  onProgress?.("hypothesis_testing", { hypothesis_testing: hypothesisTestResult });

  // ── Apply episodic memory priors to DDX probabilities ──
  if (episodicMemoryResult && ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const episodicPriors = buildEpisodicPriors(episodicMemoryResult);
    if (episodicPriors.size > 0) {
      let episodicBoostCount = 0;
      ddxResult = {
        ...ddxResult,
        differential_diagnoses: ddxResult.differential_diagnoses.map(d => {
          const factor = episodicPriors.get(d.diagnosis_name.toLowerCase());
          if (factor && factor !== 1.0) {
            episodicBoostCount++;
            const adjusted = Math.round(d.probability * factor);
            return { ...d, probability: Math.max(1, Math.min(95, adjusted)) };
          }
          return d;
        }).sort((a, b) => b.probability - a.probability),
      };
      if (episodicBoostCount > 0) {
        console.log(`[Pipeline] Episodic: Boosted ${episodicBoostCount} DDX candidates from memory priors.`);
        pcieCore.addReasoningTrace("episodic_memory" as any, `Episodic priors applied to ${episodicBoostCount} candidates`);
      }
    }
  }

  // ── Apply learned calibration factors to DDX probabilities ──
  await calibrationPromise; // Ensure calibration data is ready
  if (calibrationResult && ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const calMap = buildCalibrationMap(calibrationResult);
    if (calMap.size > 0) {
      let calibratedCount = 0;
      ddxResult = {
        ...ddxResult,
        differential_diagnoses: ddxResult.differential_diagnoses.map(d => {
          const factor = calMap.get(d.diagnosis_name.toLowerCase());
          if (factor && factor !== 1.0) {
            calibratedCount++;
            const adjusted = d.must_not_miss
              ? Math.max(d.probability, Math.round(d.probability * factor))
              : Math.round(d.probability * factor);
            return { ...d, probability: Math.max(1, Math.min(95, adjusted)) };
          }
          return d;
        }).sort((a, b) => b.probability - a.probability),
      };
      if (calibratedCount > 0) {
        console.log(`[Pipeline] Learning: Applied calibration to ${calibratedCount} DDX candidates.`);
        pcieCore.addReasoningTrace("learning" as any, `Calibrated ${calibratedCount} priors from ${calibrationResult.summary.total_outcomes_analyzed} historical outcomes`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // WAVE 2d — Causal Reasoning (parallel with nothing — runs after DDX adjustments)
  // Builds causal chains, convergent pathways, counterfactuals, and conflict detection.
  // Deterministic, graph-only — no LLM. Target: <300ms.
  // ═══════════════════════════════════════════════════════
  let causalReasoningResult: CausalReasoningResult | null = null;
  if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const w2dStart = performance.now();
    try {
      causalReasoningResult = await withTimeout(
        runCausalReasoning({
          symptoms,
          candidate_diagnoses: ddxResult.differential_diagnoses.slice(0, 8).map(d => ({
            diagnosis_id: d.diagnosis_id,
            diagnosis_name: d.diagnosis_name,
            probability: d.probability,
            must_not_miss: d.must_not_miss,
          })),
          patient_age: ctx.patient_age,
          patient_sex: ctx.patient_sex,
        }),
        TIMEOUT.CAUSAL_REASONING,
        "causal_reasoning",
      );
      if (causalReasoningResult) {
        console.log(
          `[Pipeline] Wave 2d: Causal reasoning complete — ` +
          `${causalReasoningResult.summary.total_chains} chains, ` +
          `${causalReasoningResult.summary.convergent_pathways_detected} convergent pathways, ` +
          `${causalReasoningResult.summary.causal_conflicts_detected} conflicts ` +
          `(${causalReasoningResult.execution_ms}ms)`,
        );
        pcieCore.addReasoningTrace(
          "causal_reasoning" as any,
          `Causal: ${causalReasoningResult.summary.total_chains} chains, ` +
          `${causalReasoningResult.summary.convergent_pathways_detected} convergent, ` +
          `${causalReasoningResult.summary.causal_conflicts_detected} conflicts`,
        );
      }
    } catch {
      console.warn("[Pipeline] Wave 2d: Causal reasoning failed — continuing without causal analysis.");
    }
    lat.causal_reasoning = Math.round(performance.now() - w2dStart);
    waveLat.wave2d_causal_reasoning = lat.causal_reasoning;
    lineageTracker.recordEngineResult("causal_reasoning" as any, !!causalReasoningResult);
  }
  onProgress?.("causal_reasoning", { causal_reasoning: causalReasoningResult } as any);

  // ═══════════════════════════════════════════════════════
  // WAVE 3 — Parallel Clinical Reasoning
  //   • Bayesian Probability Engine
  //   • Guideline Compliance Engine
  //   • Hypothesis Engine (LLM reasoning)
  // ═══════════════════════════════════════════════════════
  const w3Start = performance.now();

  const [bayesianResult, guidelineAlignment, guidelineCompliance, hypothesesRaw, evidencePlanResult] = await Promise.all([
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
          () => {
            // Build DDX priors map: pass DDX-computed probabilities as informed priors
            const ddxPriors: Record<string, number> = {};
            if (ddxResult?.differential_diagnoses) {
              for (const d of ddxResult.differential_diagnoses) {
                if (d.diagnosis_id) {
                  ddxPriors[d.diagnosis_id] = d.probability / 100; // Convert % → 0-1
                }
              }
            }
            return calculateDiagnosticProbabilities({
              candidate_diagnosis_ids: candidateIds,
              symptoms,
              physiological_state_ids: physiologicalContext?.physiological_states.map(s => s.state_id) || [],
              risk_factors: ctx.risk_factors || [],
              medical_history: ctx.medical_history || [],
              patient_age: ctx.patient_age,
              patient_sex: ctx.patient_sex,
              region: "south_asia",
              vitals: {
                temperature: vitals.temperature,
                spo2: vitals.spo2,
                pulse: vitals.pulse,
                bp_systolic: vitals.bp_systolic,
                bp_diastolic: vitals.bp_diastolic,
                respiratory_rate: vitals.respiratory_rate,
              },
              duration: ctx.symptom_duration || null,
              onset_pattern: ctx.onset_pattern || null,
              severity: ctx.severity || null,
              body_location: ctx.body_location || null,
              ddx_priors: ddxPriors,
            });
          },
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

    // 3d: Hypothesis Engine — DISABLED in pipeline (LLM call, adds ~6s latency)
    // The DDX engine + Bayesian scoring provide graph-based hypothesis generation.
    // LLM hypothesis generation is available in research mode via direct edge function call.
    (async (): Promise<HypothesisResult | null> => {
      console.log("[Pipeline] Wave 3d: Hypothesis engine SKIPPED (LLM — use DDX+Bayesian instead)");
      lat.generate_hypotheses = 0;
      return null;
    })(),

    // 3e: Evidence Planning Engine (optimal next tests by information gain)
    // Uses planAndPersistEvidence to persist information gain data for learning loop
    (async (): Promise<EvidencePlanResult | null> => {
      if (!ddxResult || ddxResult.differential_diagnoses.length < 2) {
        console.log("[Pipeline] Wave 3: Evidence planning skipped — fewer than 2 DDX candidates.");
        return null;
      }
      const t0 = performance.now();
      try {
        const planInput = {
          candidate_diagnoses: ddxResult.differential_diagnoses.slice(0, 6).map(d => ({
            diagnosis_id: d.diagnosis_id,
            diagnosis_name: d.diagnosis_name,
            probability: d.probability,
            must_not_miss: d.must_not_miss,
          })),
          patient_symptoms: symptoms,
          existing_tests: ddxResult.recommended_labs?.map(l => l.test_name) || [],
          patient_age: ctx.patient_age,
          patient_sex: ctx.patient_sex,
        };

        // Use persistence variant when we have a clinic_id (persists information gain data)
        const result = input.clinic_id
          ? await withTimeout(
              planAndPersistEvidence(planInput, input.clinic_id, input.visit_id || undefined)
                .then(r => r ? { planned_tests: r.planned_tests, summary: r.summary, execution_ms: r.execution_ms } as EvidencePlanResult : null),
              TIMEOUT.EVIDENCE_PLANNING,
              "evidence_planning",
            )
          : await withTimeout(
              planEvidence(planInput),
              TIMEOUT.EVIDENCE_PLANNING,
              "evidence_planning",
            );

        lat.evidence_planning = Math.round(performance.now() - t0);
        if (result) {
          console.log(
            `[Pipeline] Wave 3: Evidence planning complete — ` +
            `${result.summary.high_value_tests} high-value tests from ${result.summary.total_candidate_tests} candidates ` +
            `(${result.execution_ms}ms) [persisted=${!!input.clinic_id}]`,
          );
        }
        return result;
      } catch {
        lat.evidence_planning = Math.round(performance.now() - t0);
        console.warn("[Pipeline] Evidence planning failed — continuing without test recommendations.");
        return null;
      }
    })(),
  ]);

  const hypotheses = hypothesesRaw;
  let finalBayesianResult = bayesianResult;

  waveLat.wave3_reasoning = Math.round(performance.now() - w3Start);
  lineageTracker.recordEngineResult("bayesian", !!bayesianResult);
  lineageTracker.recordEngineResult("guideline", !!guidelineAlignment || !!guidelineCompliance);
  lineageTracker.recordEngineResult("hypothesis", !!hypotheses && hypotheses.hypotheses.length > 0);
  lineageTracker.recordEngineResult("evidence_planning", !!evidencePlanResult);
  lineageTracker.captureSnapshot("Wave 3 (Reasoning)", "bayesian", {
    chief_complaint: ctx.chief_complaint, symptoms, associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration, medical_history: ctx.medical_history,
    family_history: ctx.family_history || [], risk_factors: ctx.risk_factors || [],
    current_medications: ctx.current_medications, allergies: ctx.allergies,
    vitals: { bp_systolic: vitals.bp_systolic, bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) : null, pulse: vitals.pulse, temperature: vitals.temperature, spo2: vitals.spo2, respiratory_rate: ctx.respiratory_rate, weight_kg: ctx.weight, height_cm: ctx.height },
    lab_results: [], risk_flags: ctx.risk_flags || [], patient_age: ctx.patient_age, patient_sex: ctx.patient_sex, context_confidence: 0,
  });

  onProgress?.("bayesian", { bayesian: bayesianResult });
  onProgress?.("guidelines", { guideline_alignment: guidelineAlignment, guideline_compliance: guidelineCompliance });
  onProgress?.("hypotheses", { hypotheses, guideline_alignment: guidelineAlignment, guideline_compliance: guidelineCompliance });

  // ═══════════════════════════════════════════════════════
  // WAVE 3.5 — Cognitive Controller Review + Conflict Resolution
  // The cognitive controller is advisory only and never removes diagnoses.
  // ═══════════════════════════════════════════════════════
  let conflictResult: ConflictResolution | null = null;

  // Run cognitive controller on DDX candidates to flag low-confidence items and plan evidence
  if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const cogStart = performance.now();
    const { runCognitiveController } = await import("@/services/cognitive/clinical_cognitive_controller");
    const cogOutput = runCognitiveController(
      ddxResult.differential_diagnoses.map(d => ({
        diagnosis_name: d.diagnosis_name,
        probability: d.probability,
        must_not_miss: d.must_not_miss,
        supporting_symptoms: d.supporting_symptoms,
        contradicting_factors: d.contradicting_factors,
      })),
      ddxResult.recommended_labs?.map(l => l.test_name) || [],
    );

    // HIGH-RECALL: Cognitive controller is advisory only — no candidates are removed
    // Candidates are flagged but preserved for ranking and final truncation
    const flaggedByController = cogOutput.hypothesis_evaluation
      .filter(h => h.reason.includes("flagged low_confidence"))
      .map(h => h.hypothesis);
    
    if (flaggedByController.length > 0) {
      console.log(
        `[Pipeline] Wave 3.5: Cognitive controller flagged ${flaggedByController.length} candidates as low_confidence (preserved)`
      );
      recordOversightEvent({
        event_type: "cognitive_pruning",
        severity: "info",
        stage: "cognitive_controller",
        message: `Flagged ${flaggedByController.length} low-confidence hypotheses (preserved): ${flaggedByController.join(", ")}`,
        metadata: { flagged: flaggedByController, total: ddxResult.differential_diagnoses.length },
      });
    }
    lat.cognitive_controller = Math.round(performance.now() - cogStart);
    pcieCore.addReasoningTrace(
      "cognitive_controller" as any,
      `Cognitive: flagged ${flaggedByController.length}, strategy=${cogOutput.evidence_strategy.strategy_type}, quality=${cogOutput.reasoning_evaluation.quality_score}`,
    );
  }

  // Conflict resolution between DDX and Bayesian
  if (metaReasoningResult && ddxResult && bayesianResult) {
    const ddxTop = ddxResult.differential_diagnoses[0];
    const bayesTop = bayesianResult.diagnoses[0];
    if (ddxTop && bayesTop) {
      const bayesTopName = (bayesTop as any).diagnosis_name
        || (bayesTop as any).diagnosis_id
        || "";
      const bayesTopProb = (bayesTop as any).posterior_probability ?? 0;
      conflictResult = resolveReasoningConflict(
        ddxTop.diagnosis_name, ddxTop.probability,
        bayesTopName,
        bayesTopProb,
        metaReasoningResult.world_state,
      );
      if (conflictResult.resolution_method !== "agreement") {
        console.log(`[Pipeline] Wave 3.5: Conflict resolved — ${conflictResult.explanation}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // WAVE 3.6 — Bounded Diagnostic Loop (max 1 refinement iteration)
  //
  // If diagnostic confidence is weak after Wave 3.5, flag low-confidence
  // candidates and re-run Hypothesis Testing → Bayesian without deleting any diagnosis.
  // ═══════════════════════════════════════════════════════
  let diagnosticLoopExecuted = false;
  let diagnosticLoopReason = "";
  const LOOP_TOP_PROBABILITY_THRESHOLD = 45; // trigger if top DDX < 45%
  const LOOP_SPREAD_THRESHOLD = 10; // trigger if gap between #1 and #2 < 10%
  const LOOP_LOW_CONFIDENCE_THRESHOLD = 15; // flag candidates below 15%, never prune

  if (ddxResult && ddxResult.differential_diagnoses.length >= 2) {
    const topProb = ddxResult.differential_diagnoses[0].probability;
    const secondProb = ddxResult.differential_diagnoses[1].probability;
    const spread = topProb - secondProb;

    const needsRefinement =
      topProb < LOOP_TOP_PROBABILITY_THRESHOLD ||
      spread < LOOP_SPREAD_THRESHOLD;

    if (needsRefinement) {
      const w36Start = performance.now();
      diagnosticLoopExecuted = true;
      diagnosticLoopReason = topProb < LOOP_TOP_PROBABILITY_THRESHOLD
        ? `top_probability_low (${topProb}%)`
        : `narrow_spread (${spread}% gap)`;

      console.log(
        `[Pipeline] Wave 3.6: Diagnostic loop triggered — ${diagnosticLoopReason}. ` +
        `Flagging candidates below ${LOOP_LOW_CONFIDENCE_THRESHOLD}% for review and re-running reasoning without pruning.`
      );

      const loopDiagnoses = ddxResult.differential_diagnoses;
      const flaggedForLoop = loopDiagnoses
        .filter(d => d.probability < LOOP_LOW_CONFIDENCE_THRESHOLD && !d.must_not_miss)
        .map(d => d.diagnosis_name);
      const loopIds = loopDiagnoses.map(d => d.diagnosis_id).filter(Boolean);
      const loopPriors: Record<string, number> = {};

      if (finalBayesianResult?.diagnoses?.length) {
        for (const d of finalBayesianResult.diagnoses) {
          if (d.diagnosis_id) loopPriors[d.diagnosis_id] = d.posterior_probability;
        }
      } else {
        for (const d of loopDiagnoses) {
          if (d.diagnosis_id) loopPriors[d.diagnosis_id] = d.probability / 100;
        }
      }

      const loopState = {
        candidates: loopDiagnoses,
        scores: finalBayesianResult,
        ddx_priors: loopPriors,
        hypothesis_adjustments: hypothesisTestResult?.tested_hypotheses ?? [],
        mnm_flags: new Map(loopDiagnoses.map(d => [d.diagnosis_id, d.must_not_miss] as const)),
      };

      const hasNewEvidence = false;
      const hasNewCandidates = loopIds.some(id => loopState.ddx_priors[id] === undefined);
      const hasLoopChanges = hasNewEvidence || hasNewCandidates;

      console.log(
        `[Pipeline] Wave 3.6: Flagged ${flaggedForLoop.length} low-confidence candidates for review; ` +
        `preserving all ${loopDiagnoses.length} diagnoses.`
      );

      if (flaggedForLoop.length > 0) {
        recordOversightEvent({
          event_type: "diagnostic_loop_review" as any,
          severity: "info",
          stage: "diagnostic_loop",
          message: `Flagged ${flaggedForLoop.length} low-confidence candidates for loop review (preserved): ${flaggedForLoop.join(", ")}`,
          metadata: {
            flagged: flaggedForLoop,
            preserved: true,
            low_confidence_threshold: LOOP_LOW_CONFIDENCE_THRESHOLD,
          } as any,
        });
      }

      let loopHypoTest: HypothesisTestResult | null = null;
      let loopBayesian: BayesianResult | null = null;

      if (!hasLoopChanges) {
        console.log(
          `[Pipeline] Wave 3.6: Loop skip — no new evidence/candidates. Preserving Wave 3 state.`
        );
      } else {
        [loopHypoTest, loopBayesian] = await Promise.all([
          (async (): Promise<HypothesisTestResult | null> => {
            if (loopState.candidates.length === 0) return null;
            try {
              return await withTimeout(
                testHypotheses({
                  candidate_diagnoses: loopState.candidates.map((d, i) => ({
                    diagnosis_id: d.diagnosis_id || `fallback-loop-${i}-${d.diagnosis_name?.replace(/\s+/g, '-').toLowerCase()}`,
                    diagnosis_name: d.diagnosis_name,
                    icd10_code: d.icd10_code || null,
                    probability: d.probability || 0,
                    must_not_miss: d.must_not_miss || false,
                  })),
                  patient_symptoms: symptoms,
                  patient_age: ctx.patient_age,
                  patient_sex: ctx.patient_sex,
                  allergies: ctx.allergies,
                  current_medications: ctx.current_medications,
                }),
                TIMEOUT.HYPOTHESIS_TESTING,
                "hypothesis_testing_loop",
              );
            } catch {
              return null;
            }
          })(),

          (async (): Promise<BayesianResult | null> => {
            if (loopIds.length === 0) return null;
            console.log(`[Pipeline] Wave 3.6 Bayesian: uses_ddx_prior=${Object.keys(loopState.ddx_priors).length > 0}, candidates=${loopIds.length}`);
            try {
              return await withTimeout(
                calculateDiagnosticProbabilities({
                  symptoms,
                  candidate_diagnosis_ids: loopIds,
                  patient_age: ctx.patient_age ?? undefined,
                  patient_sex: ctx.patient_sex ?? undefined,
                  risk_factors: ctx.risk_factors || [],
                  medical_history: ctx.medical_history || [],
                  region: "south_asia",
                  vitals,
                  duration: ctx.symptom_duration || null,
                  ddx_priors: Object.keys(loopState.ddx_priors).length > 0 ? loopState.ddx_priors : undefined,
                }),
                TIMEOUT.BAYESIAN,
                "bayesian_loop",
              );
            } catch {
              return null;
            }
          })(),
        ]);
      }

      if (loopHypoTest && loopHypoTest.tested_hypotheses.length > 0) {
        hypothesisTestResult = loopHypoTest;
        const adjustedMap = new Map(
          loopHypoTest.tested_hypotheses.map(h => [h.diagnosis_id, h]),
        );
        ddxResult = {
          ...ddxResult,
          differential_diagnoses: loopState.candidates.map(d => {
            const tested = adjustedMap.get(d.diagnosis_id);
            if (!tested) return d;

            const prevScore = d.probability;
            const nextScore = tested.adjusted_probability;
            const protectedScore = !hasNewEvidence && nextScore < prevScore
              ? prevScore
              : nextScore;

            if (!hasNewEvidence && nextScore < prevScore * 0.8) {
              console.warn(
                `[Pipeline] Wave 3.6 invariant: blocked >20% hypothesis drop for ${d.diagnosis_name} (${prevScore}→${nextScore}).`
              );
            }

            console.log(JSON.stringify({
              stage: "Wave 3.6 loop",
              engine: "hypothesis",
              diagnosis_id: d.diagnosis_id,
              used_priors: Object.keys(loopState.ddx_priors).length > 0,
              score_before: prevScore,
              score_after: protectedScore,
              new_evidence: hasNewEvidence,
            }));

            return { ...d, probability: protectedScore };
          }).sort((a, b) => b.probability - a.probability),
        };
        console.log(
          `[Pipeline] Wave 3.6: Hypothesis re-test updated ${loopHypoTest.tested_hypotheses.length} candidates.`
        );
      }

      if (loopBayesian) {
        const previousBayesianMap = new Map(
          (loopState.scores?.diagnoses || []).map(d => [d.diagnosis_id, d]),
        );

        finalBayesianResult = {
          ...loopBayesian,
          diagnoses: loopBayesian.diagnoses.map(d => {
            const prev = previousBayesianMap.get(d.diagnosis_id);
            const scoreBefore = prev?.posterior_probability ?? loopState.ddx_priors[d.diagnosis_id] ?? 0;
            const protectedScore = !hasNewEvidence && prev && d.posterior_probability < prev.posterior_probability
              ? prev.posterior_probability
              : d.posterior_probability;

            if (!hasNewEvidence && prev && d.posterior_probability < prev.posterior_probability * 0.8) {
              console.warn(
                `[Pipeline] Wave 3.6 invariant: blocked >20% bayesian drop for ${d.diagnosis_id} (${prev.posterior_probability}→${d.posterior_probability}).`
              );
            }

            console.log(JSON.stringify({
              stage: "Wave 3.6 loop",
              engine: "bayesian",
              diagnosis_id: d.diagnosis_id,
              used_priors: Object.keys(loopState.ddx_priors).length > 0,
              score_before: scoreBefore,
              score_after: protectedScore,
              new_evidence: hasNewEvidence,
            }));

            return {
              ...d,
              posterior_probability: protectedScore,
              must_not_miss: d.must_not_miss || prev?.must_not_miss || false,
            };
          }).sort((a, b) => b.posterior_probability - a.posterior_probability),
        };

        console.log(
          `[Pipeline] Wave 3.6: Bayesian re-scored ${loopBayesian.total_candidates} candidates (state protected).`
        );
      }

      lat.diagnostic_loop = Math.round(performance.now() - w36Start);
      waveLat.wave36_diagnostic_loop = lat.diagnostic_loop;
      lineageTracker.recordEngineResult("diagnostic_loop", true);
      pcieCore.addReasoningTrace(
        "diagnostic_loop" as any,
        hasLoopChanges
          ? `Loop triggered: ${diagnosticLoopReason}. Flagged ${flaggedForLoop.length} low-confidence candidates, preserved all diagnoses, re-ran hypothesis testing + bayesian with state protection.`
          : `Loop triggered: ${diagnosticLoopReason}. No new evidence/candidates, preserved Wave 3 hypothesis + bayesian state.`,
      );

      onProgress?.("diagnostic_loop", { ddx: ddxResult, hypothesis_testing: hypothesisTestResult, bayesian: finalBayesianResult });
    }
  }

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

  // ── FIX 4: Context-Aware Safety Enhancement ──
  // Augment risk flags with comorbidity/age/medication-aware detections
  const contextSafety = detectContextAwareSafetyFlags(
    {
      symptoms,
      chief_complaint: ctx.chief_complaint || "",
      vitals: {
        temperature: vitals.temperature,
        pulse: vitals.pulse,
        bp_systolic: vitals.bp_systolic,
        bp_diastolic: vitals.bp_diastolic,
        spo2: vitals.spo2,
        respiratory_rate: vitals.respiratory_rate,
        blood_sugar: vitals.blood_sugar,
      },
      age: ctx.patient_age,
      sex: ctx.patient_sex,
      medical_history: ctx.medical_history,
      current_medications: ctx.current_medications,
      risk_factors: ctx.risk_factors,
      allergies: ctx.allergies,
    },
    (ctx.risk_flags || []).map((f: any) => typeof f === 'string' ? {
      flag_id: f,
      condition: f,
      severity: "moderate" as const,
      trigger_symptoms: [],
      action: "",
      matched_at: new Date().toISOString(),
    } : f),
  );
  if (contextSafety.context_triggers.length > 0) {
    recordOversightEvent({
      event_type: "context_aware_safety",
      severity: "warning",
      stage: "safety_enhancement",
      message: `Context-aware safety detected ${contextSafety.context_triggers.length} additional risk signals`,
      metadata: { triggers: contextSafety.context_triggers },
    });
  }

  lineageTracker.captureSnapshot("Wave 4 (Safety)", "safety", {
    chief_complaint: ctx.chief_complaint, symptoms, associated_symptoms: ctx.associated_symptoms || [],
    symptom_duration: ctx.symptom_duration, medical_history: ctx.medical_history,
    family_history: ctx.family_history || [], risk_factors: ctx.risk_factors || [],
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
        const result = await withRetry(
          () => runUncertaintyEngine({
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
        // Fallback: if uncertainty engine fails, produce a synthetic score from DDX spread
        if (!result && ddxResult && ddxResult.differential_diagnoses.length > 0) {
          const topDx = ddxResult.differential_diagnoses[0];
          const topProb = topDx.probability;
          const spread = ddxResult.differential_diagnoses.length > 1
            ? topProb - ddxResult.differential_diagnoses[1].probability
            : topProb;
          const syntheticScore = Math.min(95, Math.max(30, Math.round(spread * 1.5 + 20)));
          return {
            confidence_score: syntheticScore,
            confidence_label: syntheticScore >= 70 ? "high" : syntheticScore >= 40 ? "moderate" : "low",
            top_diagnosis: topDx.diagnosis_name,
            alternative_diagnoses: ddxResult.differential_diagnoses.slice(1, 4).map(d => ({ name: d.diagnosis_name, probability: d.probability })),
            must_not_miss: ddxResult.differential_diagnoses.filter(d => d.must_not_miss).map(d => d.diagnosis_name),
            missing_evidence: [],
            diagnostic_conflict: false,
            conflict_details: [],
            guideline_sources: [],
            safety_flags: [],
            scoring_breakdown: {
              evidence_strength: syntheticScore / 100,
              data_completeness: 0.5,
              signal_coherence: syntheticScore / 100,
            },
            execution_ms: 0,
          } satisfies UncertaintyResult;
        }
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
        const result = await withRetry(
          () => runHybridReasoning({
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
    family_history: ctx.family_history || [], risk_factors: ctx.risk_factors || [],
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
      { ddx: ddxResult, hypotheses, evidence, guideline_alignment: guidelineAlignment, uncertainty: uncertaintyResult, hybrid_reasoning: hybridReasoning, bayesian: finalBayesianResult },
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
        bayesian_enabled: !!finalBayesianResult,
        bayesian_candidates: finalBayesianResult?.total_candidates || 0,
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
        family_history: ctx.family_history || [],
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
    family_history: ctx.family_history || [],
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
  if (finalBayesianResult) {
    pcieCore.updateReasoning({
      bayesian_probabilities: finalBayesianResult.diagnoses.map(d => ({
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

  // ── Wave 6 — Clinical Cognitive Layer (async, fire-and-forget) ──
  // Does NOT block the pipeline return. Learning signals are recorded
  // asynchronously for batch calibration.
  const topDiagnosis = ddxResult?.differential_diagnoses?.[0];
  if (input.clinic_id && !input.skip_cache) {
    runCognitiveLayer({
      case: {
        visit_id: input.visit_id || undefined,
        patient_id: input.clinical_context.patient_id || "",
        clinic_id: input.clinic_id,
        doctor_id: input.clinical_context.doctor_id || "",
        symptom_vector: symptoms,
        chief_complaint: ctx.chief_complaint,
        final_diagnosis: topDiagnosis?.diagnosis_name,
        ai_top_diagnosis: topDiagnosis?.diagnosis_name,
        organ_system: dominantSystem || undefined,
        confidence_score: uncertaintyResult?.confidence_score,
        differential_diagnoses: ddxResult?.differential_diagnoses?.slice(0, 5),
        patient_age: ctx.patient_age ?? undefined,
        patient_sex: ctx.patient_sex ?? undefined,
      },
      clinic_id: input.clinic_id,
      run_discovery: false, // Discovery runs on a schedule, not per-consultation
    }).catch(e => console.warn("[Pipeline] Cognitive layer error (non-blocking):", e));
  }

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
    meta_reasoning: metaReasoningResult,
    hypothesis_testing: hypothesisTestResult,
    evidence_plan: evidencePlanResult,
    conflict_resolution: conflictResult,
    diagnostic_loop: diagnosticLoopExecuted ? {
      executed: true,
      reason: diagnosticLoopReason,
      candidates_pruned: 0,
      candidates_remaining: ddxResult ? ddxResult.differential_diagnoses.length : 0,
      iteration_ms: lat.diagnostic_loop || 0,
    } : null,
    causal_reasoning: causalReasoningResult,
    calibration: calibrationResult,
    episodic_memory: episodicMemoryResult,
    guideline_summary,
    logs: getPipelineLogs(),
    stage_latencies: lat,
    wave_latencies: waveLat,
    total_latency_ms: totalLatency,
    cache_stats: cache,
    lineage: lineageReport,
    context_graph: { ...contextGraph } as UnifiedClinicalContextGraph,
    cognitive_layer: null, // Populated async — check episodic_case_memory table
  };
}

/** @deprecated Use runUnifiedClinicalPipeline instead */
export const runClinicalPipeline = runUnifiedClinicalPipeline;
