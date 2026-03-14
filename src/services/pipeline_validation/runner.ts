/**
 * Pipeline Validation Runner — Single Scenario Test
 *
 * Runs one controlled "perfect scenario" through the full reasoning pipeline
 * to verify architecture correctness, NOT benchmark accuracy.
 */

import type { MergedContextObject } from "@/services/context_service";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import { runCognitiveController } from "@/services/cognitive/clinical_cognitive_controller";

// ── Validation Scenario ──

export const VALIDATION_SCENARIO: MergedContextObject = {
  visit_id: "validation-gastroenteritis-001",
  patient_id: "validation-patient-001",
  clinic_id: "validation-clinic-001",
  chief_complaint: "Vomiting and diarrhea for 24 hours",
  symptoms: ["vomiting", "diarrhea", "abdominal cramps", "nausea", "mild fever", "dehydration"],
  symptom_duration: "24 hours",
  associated_symptoms: ["loss of appetite", "fatigue"],
  medical_history: [],
  family_history: [],
  risk_factors: ["recent food intake"],
  medications: [],
  allergies: [],
  vitals: {
    bp_systolic: 110,
    bp_diastolic: 70,
    pulse: 96,
    temperature: 37.8,
    spo2: 98,
    respiratory_rate: 18,
    weight_kg: 72,
    height_cm: 175,
  },
  lab_results: [],
  risk_flags: [],
  missing_information: [],
  context_confidence: 0.9,
  source_priority: ["doctor"],
};

// ── Stage Result Types ──

export interface StageResult {
  stage: string;
  status: "success" | "error" | "skipped";
  latency_ms: number;
  data: any;
  error?: string;
}

export interface KnowledgeGap {
  type: "symptom_physiology" | "physiology_diagnosis" | "symptom_likelihood" | "diagnosis_prior";
  description: string;
  missing_items: string[];
}

export interface ValidationResult {
  scenario_name: string;
  timestamp: string;
  overall_status: "pass" | "fail" | "partial";
  total_latency_ms: number;

  // Stage-by-stage results
  stages: StageResult[];

  // Reasoning trace
  trace: {
    input_symptoms: string[];
    normalized_symptoms: string[];
    physiology_states: Array<{ state: string; confidence: number; system: string }>;
    candidate_diagnoses: string[];
    bayesian_ranking: Array<{ diagnosis: string; probability: number }>;
    pruned_diagnoses: string[];
    final_ranking: Array<{ rank: number; diagnosis: string; probability: number }>;
    dangerous_detected: string[];
    soap_generated: boolean;
  };

  // Gap analysis
  knowledge_gaps: KnowledgeGap[];

  // Success criteria
  criteria: {
    physiology_activated: boolean;
    gastroenteritis_in_candidates: boolean;
    top1_is_gastroenteritis: boolean;
    no_pipeline_errors: boolean;
    latency_under_3s: boolean;
  };

  // Raw pipeline output (for inspection)
  raw_output: ClinicalPipelineResult | null;
}

// ── Runner ──

export async function runPipelineValidation(
  onStage?: (stage: string) => void,
): Promise<ValidationResult> {
  const startTime = performance.now();
  const stages: StageResult[] = [];
  let pipelineResult: ClinicalPipelineResult | null = null;

  const result: ValidationResult = {
    scenario_name: "Acute Gastroenteritis — Pipeline Validation",
    timestamp: new Date().toISOString(),
    overall_status: "fail",
    total_latency_ms: 0,
    stages: [],
    trace: {
      input_symptoms: VALIDATION_SCENARIO.symptoms,
      normalized_symptoms: [],
      physiology_states: [],
      candidate_diagnoses: [],
      bayesian_ranking: [],
      pruned_diagnoses: [],
      final_ranking: [],
      dangerous_detected: [],
      soap_generated: false,
    },
    knowledge_gaps: [],
    criteria: {
      physiology_activated: false,
      gastroenteritis_in_candidates: false,
      top1_is_gastroenteritis: false,
      no_pipeline_errors: false,
      latency_under_3s: false,
    },
    raw_output: null,
  };

  try {
    // ── Stage 1: Input Normalization ──
    onStage?.("Input Normalization");
    const s1Start = performance.now();
    result.trace.normalized_symptoms = VALIDATION_SCENARIO.symptoms.map(s => s.toLowerCase().trim());
    stages.push({
      stage: "Input Normalization",
      status: "success",
      latency_ms: Math.round(performance.now() - s1Start),
      data: { normalized: result.trace.normalized_symptoms },
    });

    // ── Stage 2-7: Run Full Pipeline ──
    onStage?.("Full Pipeline Execution");
    const pipeStart = performance.now();
    pipelineResult = await runClinicalPipeline(VALIDATION_SCENARIO);
    const pipeDuration = Math.round(performance.now() - pipeStart);
    result.raw_output = pipelineResult;

    const o1 = pipelineResult.o1_result;

    // Stage 2: Physiology Engine
    const physioCtx = (o1 as any)?.physiological_context;
    const physioStates: Array<{ state: string; confidence: number; system: string }> = [];
    if (physioCtx?.physiological_states) {
      for (const ps of physioCtx.physiological_states) {
        physioStates.push({
          state: ps.state || ps.state_name || String(ps),
          confidence: ps.confidence || 0,
          system: ps.system || ps.system_name || "unknown",
        });
      }
    }
    result.trace.physiology_states = physioStates;
    result.criteria.physiology_activated = physioStates.length > 0;

    stages.push({
      stage: "Physiology Engine",
      status: physioStates.length > 0 ? "success" : "error",
      latency_ms: o1?.stage_latencies?.physiology_engine || 0,
      data: {
        states_activated: physioStates.length,
        states: physioStates,
        candidate_diagnosis_ids: physioCtx?.candidate_diagnosis_ids || [],
        affected_systems: physioCtx?.affected_systems || [],
      },
      error: physioStates.length === 0 ? "No physiology states activated" : undefined,
    });

    // Stage 3: Candidate Generation (DDX)
    const ddxDiagnoses = o1?.ddx?.differential_diagnoses || pipelineResult.ddx_candidates?.diagnoses || [];
    const candidateNames = ddxDiagnoses.map((d: any) => d.diagnosis_name || d.diagnosis || "").filter(Boolean);
    result.trace.candidate_diagnoses = candidateNames;

    const gastroMatch = candidateNames.some((n: string) =>
      n.toLowerCase().includes("gastroenteritis") || n.toLowerCase().includes("food poison")
    );
    result.criteria.gastroenteritis_in_candidates = gastroMatch;

    stages.push({
      stage: "Candidate Generation (DDX)",
      status: candidateNames.length > 0 ? "success" : "error",
      latency_ms: o1?.stage_latencies?.ddx_engine || 0,
      data: {
        candidate_count: candidateNames.length,
        candidates: ddxDiagnoses.slice(0, 10).map((d: any) => ({
          name: d.diagnosis_name || d.diagnosis || "",
          probability: d.probability || 0,
          must_not_miss: d.must_not_miss || false,
        })),
        dangerous_injected: o1?.ddx?.dangerous_diagnoses_injected || 0,
      },
      error: candidateNames.length === 0 ? "No candidates generated" : undefined,
    });

    // Stage 4: Bayesian Ranking
    const bayDiagnoses = (o1?.bayesian as any)?.diagnoses || [];
    result.trace.bayesian_ranking = bayDiagnoses.slice(0, 10).map((d: any) => ({
      diagnosis: d.diagnosis_name || d.diagnosis || "",
      probability: d.posterior_probability || d.probability || 0,
    }));

    stages.push({
      stage: "Bayesian Ranking",
      status: bayDiagnoses.length > 0 ? "success" : "skipped",
      latency_ms: o1?.stage_latencies?.bayesian_engine || 0,
      data: {
        ranked_count: bayDiagnoses.length,
        top5: result.trace.bayesian_ranking.slice(0, 5),
      },
    });

    // Stage 5: Cognitive Pruning
    onStage?.("Cognitive Pruning");
    const cogStart = performance.now();
    const cogInput = ddxDiagnoses.map((d: any) => ({
      diagnosis_name: d.diagnosis_name || d.diagnosis || "",
      probability: d.probability || 0,
      must_not_miss: d.must_not_miss || false,
      supporting_symptoms: d.supporting_evidence || d.supporting_symptoms || [],
      contradicting_factors: d.contradicting_factors || [],
    }));
    const cogOutput = runCognitiveController(cogInput, []);
    const cogDuration = Math.round(performance.now() - cogStart);

    const pruned = cogOutput.hypothesis_evaluation.filter(h => h.action === "prune").map(h => h.hypothesis);
    result.trace.pruned_diagnoses = pruned;

    stages.push({
      stage: "Cognitive Pruning",
      status: "success",
      latency_ms: cogDuration,
      data: {
        total_evaluated: cogOutput.hypothesis_evaluation.length,
        kept: cogOutput.hypothesis_evaluation.filter(h => h.action === "keep").length,
        pruned: pruned.length,
        escalated: cogOutput.hypothesis_evaluation.filter(h => h.action === "escalate").length,
        pruned_names: pruned,
        quality_score: cogOutput.reasoning_evaluation.quality_score,
        entropy: cogOutput.reasoning_evaluation.distribution_entropy,
      },
    });

    // Stage 6: Safety Evaluation
    const safetyAlerts = pipelineResult.safety_alerts;
    const dangerousDetected: string[] = [];
    if (o1?.ddx?.dangerous_diagnoses && o1.ddx.dangerous_diagnoses.length > 0) {
      dangerousDetected.push(...o1.ddx.dangerous_diagnoses.map((d: any) => d.diagnosis_name || d.diagnosis || String(d)));
    }
    if (ddxDiagnoses.some((d: any) => d.must_not_miss)) {
      dangerousDetected.push(...ddxDiagnoses.filter((d: any) => d.must_not_miss).map((d: any) => d.diagnosis_name || d.diagnosis));
    }
    result.trace.dangerous_detected = [...new Set(dangerousDetected)];

    stages.push({
      stage: "Safety Evaluation",
      status: "success",
      latency_ms: o1?.stage_latencies?.safety_evaluation || 0,
      data: {
        critical_alerts: safetyAlerts?.critical_count || 0,
        safety_score: safetyAlerts?.safety_score || 100,
        dangerous_detected: result.trace.dangerous_detected,
      },
    });

    // Stage 7: SOAP Output
    const soapData = (o1?.hybrid_reasoning as any)?.soap || (o1?.soap_fallback as any)?.soap;
    result.trace.soap_generated = !!soapData;

    stages.push({
      stage: "SOAP Generation",
      status: soapData ? "success" : "skipped",
      latency_ms: o1?.stage_latencies?.soap_generation || 0,
      data: {
        has_subjective: !!soapData?.subjective,
        has_objective: !!soapData?.objective,
        has_assessment: !!soapData?.assessment,
        has_plan: !!soapData?.plan,
        soap_preview: soapData?.assessment?.substring(0, 200) || null,
      },
    });

    // Build final ranking
    // Prefer Bayesian ordering, fall back to DDX
    const finalSource = result.trace.bayesian_ranking.length > 0
      ? result.trace.bayesian_ranking
      : candidateNames.map((n: string, i: number) => ({ diagnosis: n, probability: 0 }));

    result.trace.final_ranking = finalSource.slice(0, 10).map((d, i) => ({
      rank: i + 1,
      diagnosis: d.diagnosis,
      probability: d.probability,
    }));

    // Check top-1
    const top1Name = result.trace.final_ranking[0]?.diagnosis || "";
    result.criteria.top1_is_gastroenteritis = top1Name.toLowerCase().includes("gastroenteritis")
      || top1Name.toLowerCase().includes("food poison");

    // No errors?
    const hasErrors = stages.some(s => s.status === "error");
    result.criteria.no_pipeline_errors = !hasErrors;

    // Latency
    result.total_latency_ms = Math.round(performance.now() - startTime);
    result.criteria.latency_under_3s = result.total_latency_ms < 3000;

    // Pipeline stage latency breakdown
    stages.push({
      stage: "Total Pipeline",
      status: "success",
      latency_ms: pipeDuration,
      data: { stage_latencies: o1?.stage_latencies || {} },
    });

    // ── Knowledge Gap Analysis ──
    if (physioStates.length === 0) {
      result.knowledge_gaps.push({
        type: "symptom_physiology",
        description: "No physiology states were activated for the input symptoms",
        missing_items: VALIDATION_SCENARIO.symptoms,
      });
    }
    if (candidateNames.length === 0) {
      result.knowledge_gaps.push({
        type: "symptom_likelihood",
        description: "No candidate diagnoses generated — possible missing symptom_likelihoods",
        missing_items: VALIDATION_SCENARIO.symptoms,
      });
    }
    if (!gastroMatch && candidateNames.length > 0) {
      result.knowledge_gaps.push({
        type: "symptom_likelihood",
        description: "Acute gastroenteritis not in candidates despite classic symptoms",
        missing_items: ["gastroenteritis symptom_likelihoods"],
      });
    }
    if (bayDiagnoses.length === 0 && candidateNames.length > 0) {
      result.knowledge_gaps.push({
        type: "diagnosis_prior",
        description: "Bayesian engine returned no results — possible missing disease_priors",
        missing_items: candidateNames.slice(0, 5),
      });
    }

    // Overall status
    const criteriaMet = Object.values(result.criteria).filter(Boolean).length;
    const totalCriteria = Object.keys(result.criteria).length;
    result.overall_status = criteriaMet === totalCriteria ? "pass" : criteriaMet >= 3 ? "partial" : "fail";

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    stages.push({
      stage: "Pipeline Execution",
      status: "error",
      latency_ms: Math.round(performance.now() - startTime),
      data: null,
      error: errMsg,
    });
    result.total_latency_ms = Math.round(performance.now() - startTime);
  }

  result.stages = stages;
  return result;
}
