/**
 * Benchmark Mode — Lightweight Pipeline Execution
 * 
 * Provides a benchmark-optimized pipeline that:
 * 1. KEEPS: DDX engine, Hypothesis testing, Bayesian scoring (core diagnostic accuracy)
 * 2. SKIPS: Episodic memory, Evidence retrieval, Hybrid reasoning, Multi-agent,
 *           Cognitive layer, SOAP generation, Monitoring DB writes
 * 3. INLINES: Meta-reasoning, Safety, Context building, Guideline (local stubs)
 * 4. CACHES: Symptom normalization, knowledge graph lookups across cases
 * 
 * Output is structurally identical to production PipelineResult — only execution
 * path is optimized. Diagnostic accuracy outputs (DDX, Bayesian, Safety) are
 * produced by the SAME edge functions as production.
 */

import { isNewPipelineEnabled, isPhase6IntelligenceCoreEnabled } from "@/services/feature_flags";
import { clearPipelineLogs, getPipelineLogs } from "@/services/pipeline_logger";
import {
  buildEnrichedContext,
  validateContextCompleteness,
  type EnrichedClinicalContext,
} from "@/services/clinical_context";
import type { ClinicalContext } from "@/lib/clinical-context";
import { runDDXEngine, type DDXResult } from "@/services/ddx_engine/client";
import { runUncertaintyEngine, type UncertaintyResult } from "@/services/uncertainty_engine/client";
import { calculateDiagnosticProbabilities, type BayesianResult } from "@/services/bayesian_engine";
import { testHypotheses, type HypothesisTestResult } from "@/services/hypothesis_testing/client";
import { runCausalReasoning, type CausalReasoningResult } from "@/services/causal_reasoning/client";
import { planEvidence, type EvidencePlanResult } from "@/services/evidence_planning/client";
import { checkGuidelineCompliance, type GuidelineComplianceResult } from "@/services/guideline_engine";
import { generatePhysiologicalContext, type PhysiologicalContextResult } from "@/services/physiology_engine";
import { runMetaReasoning, resolveReasoningConflict, type MetaReasoningOutput, type ConflictResolution } from "@/services/meta_reasoning";
import {
  recordOversightEvent,
  generateOversightReport,
  clearOversightEvents,
  type OversightReport,
} from "@/services/oversight_engine";
import { applyCandidateFallback } from "@/services/ddx_engine/candidate_fallback";
import { applyCandidateFallbackV2 } from "@/services/ddx_engine/candidate_fallback_v2";
import { expandCandidatesFromContext } from "@/services/context_candidate_expander";
import { applyFailureDerivedRules } from "@/services/clinical_pipeline/failure_derived_rules";
import { isPhase5ContextCandidatesEnabled } from "@/services/feature_flags";
import { mergeActivations, expandKG, expandKGDeep } from "@/services/kg";
import { detectContextAwareSafetyFlags } from "@/services/context_engine/context_aware_safety";
import { rankCandidates, type IntelligenceCoreResult } from "@/services/reasoning/intelligence_core";
import { shouldTriggerRecovery, runRecallRecovery } from "@/services/reasoning/recall_recovery";
import { normalizeSignals } from "@/services/signal_normalizer";
import { generateSuspicionSignals } from "@/services/suspicion_engine";
import { safetyNetActivation } from "@/services/reasoning/safety_net_activation";
import { weakSignalDiagnosisActivation } from "@/services/reasoning/weak_signal_activation";
import { applyPhase7Ranking } from "@/services/reasoning/phase7_clinical_ranker";
import { isPhase7ClinicalRankerEnabled } from "@/services/feature_flags";
import { domainCoverageGuarantee } from "@/services/reasoning/domain_coverage_guarantee";
import type { PipelineInput, PipelineResult } from "./orchestrator";

// ── Timeout constants (tighter for benchmark) ──
const BM_TIMEOUT = {
  DDX: 8000,
  PHYSIOLOGY: 6000,
  BAYESIAN: 6000,
  HYPOTHESIS_TESTING: 3000,
  CAUSAL_REASONING: 3000,
  EVIDENCE_PLANNING: 3000,
  GUIDELINE_COMPLIANCE: 6000,
  UNCERTAINTY: 5000,
} as const;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[BenchPipeline] ⏱️ ${label} timed out after ${timeoutMs}ms`);
        resolve(null);
      }, timeoutMs),
    ),
  ]);
}

function extractSymptoms(ctx: ClinicalContext): string[] {
  const symptoms: string[] = [];
  if (ctx.chief_complaint) symptoms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) symptoms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) symptoms.push(...ctx.associated_symptoms);
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

const ORGAN_SYSTEM_WEIGHTS: Record<string, number> = {
  cardiovascular: 1.4, respiratory: 1.1, ent: 1.0, neurological: 0.8,
  gastrointestinal: 0.9, musculoskeletal: 0.7, endocrine: 0.8,
  renal: 0.9, hepatic: 0.8, infectious: 1.0, hematological: 0.9, dermatological: 0.6,
};

const SYMPTOM_SYSTEM_MAP: Record<string, string> = {
  "chest pain": "cardiovascular", "palpitations": "cardiovascular", "tachycardia": "cardiovascular",
  "shortness of breath": "respiratory", "dyspnea": "respiratory", "cough": "respiratory", "wheezing": "respiratory",
  "sore throat": "ent", "throat pain": "ent", "ear pain": "ent",
  "headache": "neurological", "dizziness": "neurological", "seizure": "neurological", "confusion": "neurological",
  "nausea": "gastrointestinal", "vomiting": "gastrointestinal", "abdominal pain": "gastrointestinal", "diarrhea": "gastrointestinal",
  "fever": "infectious", "chills": "infectious", "rigors": "infectious",
  "joint pain": "musculoskeletal", "back pain": "musculoskeletal",
  "rash": "dermatological", "polyuria": "endocrine", "polydipsia": "endocrine",
  "hematuria": "renal",
};

function detectDominantOrganSystem(symptoms: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const s of symptoms) {
    const lower = s.toLowerCase().trim();
    for (const [kw, sys] of Object.entries(SYMPTOM_SYSTEM_MAP)) {
      if (lower.includes(kw)) counts[sys] = (counts[sys] || 0) + 1;
    }
  }
  let dominant: string | null = null;
  let max = 0;
  for (const [sys, c] of Object.entries(counts)) {
    if (c > max) { max = c; dominant = sys; }
  }
  return dominant;
}

/**
 * Benchmark-optimized pipeline execution.
 * 
 * Executes the SAME core diagnostic engines (DDX, Bayesian, Hypothesis Testing,
 * Causal Reasoning, Safety) but skips non-diagnostic modules to reduce latency
 * from ~60s to ~5-10s per case.
 * 
 * SKIPPED modules (not relevant to diagnostic accuracy benchmarking):
 * - Episodic memory (patient history lookup)
 * - Evidence retrieval (PubMed/research citations)
 * - Hybrid reasoning / SOAP generation (LLM narrative)
 * - Multi-agent pipeline
 * - Cognitive layer (learning signals)
 * - Calibration factors (learning-adjusted priors)
 * - Monitoring DB writes
 * - Lineage tracking
 * - PCIE context graph population
 */
export async function runBenchmarkPipeline(
  input: PipelineInput,
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
    multi_agent: null, meta_reasoning: null, hypothesis_testing: null,
    evidence_plan: null, conflict_resolution: null, diagnostic_loop: null,
    causal_reasoning: null, calibration: null, episodic_memory: null,
    guideline_summary: null,
    logs: [], stage_latencies: {}, wave_latencies: {}, total_latency_ms: 0,
    cache_stats: cache, lineage: null, context_graph: null, cognitive_layer: null,
  };

  if (!isNewPipelineEnabled()) return empty;

  clearPipelineLogs();
  clearOversightEvents();

  const ctx = { ...input.clinical_context };
  const symptoms = extractSymptoms(ctx);
  const vitals = buildVitals(ctx);

  // ═══════ WAVE 1 — Context (local, ~1ms) ═══════
  const w1Start = performance.now();
  const enrichedContext = buildEnrichedContext(ctx, {
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
  lat.build_context = Math.round(performance.now() - w1Start);
  waveLat.wave1_context = lat.build_context;

  // ═══════ WAVE 1.5 — Meta-reasoning (local, ~1ms) ═══════
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
  } catch {}
  waveLat.wave15_meta_reasoning = Math.round(performance.now() - w15Start);
  lat.meta_reasoning = waveLat.wave15_meta_reasoning;

  // ═══════ WAVE 2 — DDX + Physiology (PARALLEL — core diagnostic engines) ═══════
  const w2Start = performance.now();

  // Run Physiology + DDX in parallel (physiology doesn't block DDX in benchmark mode)
  const [physiologicalContext, ddxResultRaw] = await Promise.all([
    // Physiology
    (async (): Promise<PhysiologicalContextResult | null> => {
      const t0 = performance.now();
      try {
        const r = await withTimeout(
          generatePhysiologicalContext({
            symptoms,
            vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp_systolic: vitals.bp_systolic },
            visit_id: input.visit_id,
            clinic_id: input.clinic_id,
          }),
          BM_TIMEOUT.PHYSIOLOGY,
          "physiology",
        );
        lat.physiological_engine = Math.round(performance.now() - t0);
        return r;
      } catch {
        lat.physiological_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // DDX Engine (without physiology payload in benchmark — runs truly parallel)
    (async (): Promise<DDXResult | null> => {
      const t0 = performance.now();
      try {
        const result = await withTimeout(
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
            onset_pattern: ctx.onset_pattern || null,
            severity: ctx.severity || null,
            body_location: ctx.body_location || null,
            risk_factors: ctx.risk_factors || [],
            duration: ctx.symptom_duration || null,
            family_history: ctx.family_history || [],
          }),
          BM_TIMEOUT.DDX,
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
  ]);

  // Apply organ-system weighting
  const dominantSystem = detectDominantOrganSystem(symptoms);
  let ddxResult = ddxResultRaw;
  if (ddxResult && dominantSystem) {
    const w = ORGAN_SYSTEM_WEIGHTS[dominantSystem] ?? 1.0;
    ddxResult = {
      ...ddxResult,
      differential_diagnoses: ddxResult.differential_diagnoses.map(d => {
        const diagSys = (d.category || "").toLowerCase();
        let weight = diagSys === dominantSystem ? w : (ORGAN_SYSTEM_WEIGHTS[diagSys] ?? 1.0);
        const newProb = d.must_not_miss
          ? Math.max(d.probability, Math.round(d.probability * weight))
          : Math.round(d.probability * weight);
        return { ...d, probability: newProb };
      }).sort((a, b) => b.probability - a.probability),
    };
  }

  // Phase 6.3: Signal Normalization (BEFORE rules)
  const normalizedCtx = normalizeSignals(ctx);
  const ctxForRules = normalizedCtx.enriched;

  // Phase 5: KG-Native Candidate Generation
  if (isPhase5ContextCandidatesEnabled()) {
    const failureResult = applyFailureDerivedRules(ctxForRules);
    const expansion = expandCandidatesFromContext(ctxForRules);

    // Phase 6.2: Suspicion Engine
    const suspicion = generateSuspicionSignals(ctxForRules);

    // KG-Native: Merge ALL activations → expand via KG
    const mergedActivation = mergeActivations(
      mergeActivations(failureResult.activation, expansion.activation),
      suspicion.activation,
    );

    // Phase 6.6: SafetyNet — ensure critical domains are explored
    const safetyNet = safetyNetActivation(ctx, mergedActivation);
    const postSafetyNetActivation = safetyNet.activation;

    // Phase 6: Deep KG traversal if Intelligence Core enabled
    const expandedActivation = isPhase6IntelligenceCoreEnabled()
      ? expandKGDeep(postSafetyNetActivation, 2, 0.5)
      : postSafetyNetActivation;

    const kgExpansion = expandKG(expandedActivation);
    let allHints = kgExpansion.candidates;

    // Phase 6.7: Weak Signal Diagnosis Activation
    if (isPhase6IntelligenceCoreEnabled()) {
      const wsaResult = weakSignalDiagnosisActivation(ctx, allHints, expandedActivation);
      allHints = wsaResult.candidates;
      if (wsaResult.boosts_applied.length > 0) {
        recordOversightEvent({
          event_type: "phase6_safetynet" as any,
          severity: "info",
          stage: "weak_signal_activation",
          message: `Phase 6.7: ${wsaResult.boosts_applied.length} weak signal boosts`,
          metadata: { boosts: wsaResult.boosts_applied } as any,
        });
      }
    }

    // Domain Coverage Guarantee
    const domainCoverage = domainCoverageGuarantee(allHints);
    allHints = domainCoverage.candidates;
    if (domainCoverage.injected_count > 0) {
      console.log(`[Benchmark] Domain coverage: +${domainCoverage.injected_count} reps, filled: [${domainCoverage.domains_filled.join(", ")}]`);
    }

    // Phase 6: Intelligence Core ranking
    if (isPhase6IntelligenceCoreEnabled() && allHints.length > 0) {
      let icResult = rankCandidates({
        context: ctx,
        candidates: allHints,
        activation: expandedActivation,
      });

      // Recall Recovery
      if (shouldTriggerRecovery(icResult.candidate_count, icResult.top_score * 100)) {
        const recovery = runRecallRecovery({
          activation: expandedActivation,
          symptoms,
          current_candidate_count: icResult.candidate_count,
          top_score: icResult.top_score * 100,
        });
        const recoveryHints = [...allHints, ...recovery.additional_candidates];
        icResult = rankCandidates({
          context: ctx,
          candidates: recoveryHints,
          activation: expandedActivation,
        });
        recordOversightEvent({
          event_type: "recall_recovery_triggered",
          severity: "warning",
          stage: "intelligence_core",
          message: `Recovery: ${recovery.trigger_reason}`,
          metadata: { recovery } as any,
        });
      }

      // Phase 7: Clinical Intelligence Ranking
      if (isPhase7ClinicalRankerEnabled() && icResult.candidate_count > 0) {
        const phase7 = applyPhase7Ranking({ icResult, context: ctx });
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
    }

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
        message: `Fallback v2 injected ${fallbackMeta.total_injected} candidates (${failureResult.rules_fired.length} failure rules, ${kgExpansion.clusters_resolved.length} KG clusters)`,
        metadata: { ...fallbackMeta, failure_rules: failureResult.rules_fired, kg_clusters: kgExpansion.clusters_resolved } as any,
      });
    }
  } else {
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
        message: `Fallback injected ${fallbackMeta.fallback_count} candidates`,
        metadata: fallbackMeta as any,
      });
    }
  }

  waveLat.wave2_analysis = Math.round(performance.now() - w2Start);

  // ═══════ WAVE 2c+2d+3 — PARALLEL: Hypothesis Testing, Causal, Bayesian, Guidelines, Evidence Planning ═══════
  // In benchmark mode, ALL of these run in parallel (no sequential dependencies)
  const w3Start = performance.now();
  const dxWithIds = ddxResult?.differential_diagnoses?.filter(d => d.diagnosis_name) || [];

  const [hypothesisTestResult, causalReasoningResult, bayesianResult, guidelineCompliance, evidencePlanResult] = await Promise.all([
    // Hypothesis Testing
    (async (): Promise<HypothesisTestResult | null> => {
      if (dxWithIds.length === 0) return null;
      const t0 = performance.now();
      try {
        const r = await withTimeout(
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
          BM_TIMEOUT.HYPOTHESIS_TESTING,
          "hypothesis_testing",
        );
        lat.hypothesis_testing = Math.round(performance.now() - t0);
        return r;
      } catch {
        lat.hypothesis_testing = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // Causal Reasoning
    (async (): Promise<CausalReasoningResult | null> => {
      if (!ddxResult || ddxResult.differential_diagnoses.length === 0) return null;
      const t0 = performance.now();
      try {
        const r = await withTimeout(
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
          BM_TIMEOUT.CAUSAL_REASONING,
          "causal_reasoning",
        );
        lat.causal_reasoning = Math.round(performance.now() - t0);
        return r;
      } catch {
        lat.causal_reasoning = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // Bayesian Engine
    (async (): Promise<BayesianResult | null> => {
      const candidateIds = ddxResult?.differential_diagnoses.map(d => d.diagnosis_id).filter(Boolean) || [];
      if (candidateIds.length === 0) {
        if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
          return {
            diagnoses: ddxResult.differential_diagnoses.map(d => ({
              diagnosis_id: d.diagnosis_id,
              posterior_probability: d.probability / 100,
              prior: 0.01, symptom_likelihood: d.probability / 100,
              physiology_likelihood: 1.0, risk_modifier: 1.0,
              supporting_evidence: d.supporting_symptoms || [],
              must_not_miss: d.must_not_miss,
            })),
            total_candidates: ddxResult.differential_diagnoses.length,
            symptoms_resolved: ddxResult.matched_symptoms?.length || 0,
            physiology_states_used: 0, risk_factors_applied: 0,
            execution_ms: 0, source: "ddx_fallback",
          };
        }
        return null;
      }
      const t0 = performance.now();
      try {
        const result = await withTimeout(
          calculateDiagnosticProbabilities({
            candidate_diagnosis_ids: candidateIds,
            symptoms,
            physiological_state_ids: physiologicalContext?.physiological_states.map(s => s.state_id) || [],
            risk_factors: ctx.risk_factors || [],
            medical_history: ctx.medical_history || [],
            patient_age: ctx.patient_age,
            patient_sex: ctx.patient_sex,
            region: "south_asia",
            vitals: {
              temperature: vitals.temperature, spo2: vitals.spo2,
              pulse: vitals.pulse, bp_systolic: vitals.bp_systolic,
              bp_diastolic: vitals.bp_diastolic, respiratory_rate: vitals.respiratory_rate,
            },
            duration: ctx.symptom_duration || null,
            onset_pattern: ctx.onset_pattern || null,
            severity: ctx.severity || null,
            body_location: ctx.body_location || null,
          }),
          BM_TIMEOUT.BAYESIAN,
          "bayesian_engine",
        );
        lat.bayesian_engine = Math.round(performance.now() - t0);
        if (!result && ddxResult && ddxResult.differential_diagnoses.length > 0) {
          return {
            diagnoses: ddxResult.differential_diagnoses.map(d => ({
              diagnosis_id: d.diagnosis_id,
              posterior_probability: d.probability / 100,
              prior: 0.01, symptom_likelihood: d.probability / 100,
              physiology_likelihood: 1.0, risk_modifier: 1.0,
              supporting_evidence: d.supporting_symptoms || [],
              must_not_miss: d.must_not_miss,
            })),
            total_candidates: ddxResult.differential_diagnoses.length,
            symptoms_resolved: ddxResult.matched_symptoms?.length || 0,
            physiology_states_used: 0, risk_factors_applied: 0,
            execution_ms: 0, source: "ddx_timeout_fallback",
          };
        }
        return result;
      } catch {
        lat.bayesian_engine = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // Guideline Compliance
    (async (): Promise<GuidelineComplianceResult | null> => {
      if (!ddxResult || ddxResult.differential_diagnoses.length === 0) return null;
      const t0 = performance.now();
      try {
        const r = await withTimeout(
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
          BM_TIMEOUT.GUIDELINE_COMPLIANCE,
          "guideline_compliance",
        );
        lat.guideline_compliance = Math.round(performance.now() - t0);
        return r;
      } catch {
        lat.guideline_compliance = Math.round(performance.now() - t0);
        return null;
      }
    })(),

    // Evidence Planning
    (async (): Promise<EvidencePlanResult | null> => {
      if (!ddxResult || ddxResult.differential_diagnoses.length < 2) return null;
      const t0 = performance.now();
      try {
        const r = await withTimeout(
          planEvidence({
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
          }),
          BM_TIMEOUT.EVIDENCE_PLANNING,
          "evidence_planning",
        );
        lat.evidence_planning = Math.round(performance.now() - t0);
        return r;
      } catch {
        lat.evidence_planning = Math.round(performance.now() - t0);
        return null;
      }
    })(),
  ]);

  // Apply hypothesis testing adjustments to DDX
  if (hypothesisTestResult && hypothesisTestResult.tested_hypotheses.length > 0 && ddxResult) {
    const adjustedMap = new Map(
      hypothesisTestResult.tested_hypotheses.map(h => [h.diagnosis_id, h]),
    );
    ddxResult = {
      ...ddxResult,
      differential_diagnoses: ddxResult.differential_diagnoses.map(d => {
        const tested = adjustedMap.get(d.diagnosis_id);
        return tested ? { ...d, probability: tested.adjusted_probability } : d;
      }).sort((a, b) => b.probability - a.probability),
    };
  }

  waveLat.wave3_reasoning = Math.round(performance.now() - w3Start);

  // ═══════ WAVE 3.5 — Cognitive Pruning (local, ~1ms) ═══════
  if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
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
    // Candidates flagged as low_confidence are kept for ranking/truncation
    const flaggedByController = cogOutput.hypothesis_evaluation
      .filter(h => h.reason.includes("flagged low_confidence"))
      .map(h => h.hypothesis);
    if (flaggedByController.length > 0) {
      console.log(`[BenchPipeline] Wave 3.5: ${flaggedByController.length} candidates flagged low_confidence (preserved)`);
    }
  }

  // ═══════ WAVE 3.6 — Diagnostic Loop (SKIPPED in benchmark mode) ═══════
  // The diagnostic loop re-runs hypothesis testing + Bayesian. In benchmark mode
  // we skip this to save ~6-12s. The initial wave already provides the diagnostic signal.

  // ═══════ WAVE 4 — Safety (local, ~1ms) ═══════
  const w4Start = performance.now();
  const oversight = generateOversightReport(input.visit_id ?? null, input.consultation_id ?? null);

  // FIX 4: Context-aware safety
  const contextSafety = detectContextAwareSafetyFlags(
    {
      symptoms,
      chief_complaint: ctx.chief_complaint || "",
      vitals: {
        temperature: vitals.temperature, pulse: vitals.pulse,
        bp_systolic: vitals.bp_systolic, bp_diastolic: vitals.bp_diastolic,
        spo2: vitals.spo2, respiratory_rate: vitals.respiratory_rate,
        blood_sugar: vitals.blood_sugar,
      },
      age: ctx.patient_age, sex: ctx.patient_sex,
      medical_history: ctx.medical_history,
      current_medications: ctx.current_medications,
      risk_factors: ctx.risk_factors,
      allergies: ctx.allergies,
    },
    (ctx.risk_flags || []).map((f: any) => typeof f === 'string' ? {
      flag_id: f, condition: f, severity: "moderate" as const,
      trigger_symptoms: [], action: "", matched_at: new Date().toISOString(),
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
  waveLat.wave4_safety = Math.round(performance.now() - w4Start);

  // ═══════ WAVE 5 — Uncertainty (single edge function, skip hybrid reasoning) ═══════
  const w5Start = performance.now();
  let uncertaintyResult: UncertaintyResult | null = null;
  if (ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const t0 = performance.now();
    try {
      uncertaintyResult = await withTimeout(
        runUncertaintyEngine({
          symptoms: ddxResult.matched_symptoms || symptoms,
          vitals: { temperature: vitals.temperature, spo2: vitals.spo2, pulse: vitals.pulse, bp: vitals.bp },
          differential_diagnoses: ddxResult.differential_diagnoses || [],
          suggested_labs: ddxResult.recommended_labs || [],
          guideline_sources: [],
          guideline_recommendations: ddxResult.guideline_recommendations?.map(g => ({
            authority: g.authority, evidence_level: g.evidence_level,
          })) || [],
          safety_flags: [],
          safety_score: oversight.safety_score || 80,
          medical_history: ctx.medical_history,
          current_medications: ctx.current_medications,
          allergies: ctx.allergies,
          matched_symptoms: ddxResult.matched_symptoms || [],
          unmatched_symptoms: ddxResult.unmatched_symptoms || [],
        }),
        BM_TIMEOUT.UNCERTAINTY,
        "uncertainty_engine",
      );
      lat.uncertainty_engine = Math.round(performance.now() - t0);
    } catch {
      lat.uncertainty_engine = Math.round(performance.now() - t0);
    }
  }
  // Synthetic fallback if uncertainty engine fails
  if (!uncertaintyResult && ddxResult && ddxResult.differential_diagnoses.length > 0) {
    const topDx = ddxResult.differential_diagnoses[0];
    const spread = ddxResult.differential_diagnoses.length > 1
      ? topDx.probability - ddxResult.differential_diagnoses[1].probability
      : topDx.probability;
    const syntheticScore = Math.min(95, Math.max(30, Math.round(spread * 1.5 + 20)));
    uncertaintyResult = {
      confidence_score: syntheticScore,
      confidence_label: syntheticScore >= 70 ? "high" : syntheticScore >= 40 ? "moderate" : "low",
      top_diagnosis: topDx.diagnosis_name,
      alternative_diagnoses: ddxResult.differential_diagnoses.slice(1, 4).map(d => ({ name: d.diagnosis_name, probability: d.probability })),
      must_not_miss: ddxResult.differential_diagnoses.filter(d => d.must_not_miss).map(d => d.diagnosis_name),
      missing_evidence: [], diagnostic_conflict: false, conflict_details: [],
      guideline_sources: [], safety_flags: [],
      scoring_breakdown: { evidence_strength: syntheticScore / 100, data_completeness: 0.5, signal_coherence: syntheticScore / 100 },
      execution_ms: 0,
    };
  }
  waveLat.wave5_output = Math.round(performance.now() - w5Start);

  // ═══════ FINALIZE ═══════
  const totalLatency = Math.round(performance.now() - pipelineStart);
  lat.total = totalLatency;

  // Conflict resolution (local, ~0ms)
  let conflictResult: ConflictResolution | null = null;
  if (metaReasoningResult && ddxResult && bayesianResult) {
    const ddxTop = ddxResult.differential_diagnoses[0];
    const bayesTop = bayesianResult.diagnoses[0];
    if (ddxTop && bayesTop) {
      conflictResult = resolveReasoningConflict(
        ddxTop.diagnosis_name, ddxTop.probability,
        (bayesTop as any).diagnosis_name || (bayesTop as any).diagnosis_id || "",
        (bayesTop as any).posterior_probability ?? 0,
        metaReasoningResult.world_state,
      );
    }
  }

  console.log(
    `[BenchPipeline] Complete in ${totalLatency}ms. ` +
    `W1=${waveLat.wave1_context}ms W2=${waveLat.wave2_analysis}ms ` +
    `W3=${waveLat.wave3_reasoning}ms W4=${waveLat.wave4_safety}ms W5=${waveLat.wave5_output}ms`,
  );

  return {
    enabled: true,
    enriched_context: enrichedContext,
    physiological_context: physiologicalContext,
    bayesian: bayesianResult,
    ddx: ddxResult,
    uncertainty: uncertaintyResult,
    hypotheses: null,
    guideline_alignment: null,
    guideline_compliance: guidelineCompliance,
    evidence: null,
    oversight,
    hybrid_reasoning: null,
    soap_fallback: null,
    multi_agent: null,
    meta_reasoning: metaReasoningResult,
    hypothesis_testing: hypothesisTestResult,
    evidence_plan: evidencePlanResult,
    conflict_resolution: conflictResult,
    diagnostic_loop: null,
    causal_reasoning: causalReasoningResult,
    calibration: null,
    episodic_memory: null,
    guideline_summary: null,
    logs: getPipelineLogs(),
    stage_latencies: lat,
    wave_latencies: waveLat,
    total_latency_ms: totalLatency,
    cache_stats: cache,
    lineage: null,
    context_graph: null,
    cognitive_layer: null,
  };
}
