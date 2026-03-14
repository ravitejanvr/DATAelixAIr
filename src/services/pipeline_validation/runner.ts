/**
 * Pipeline Validation Runner — Multi-Scenario Test
 *
 * Runs controlled "perfect scenarios" through the full reasoning pipeline
 * to verify architecture correctness, NOT benchmark accuracy.
 *
 * Scenarios:
 *   1. Acute Gastroenteritis (original)
 *   2. Acute Appendicitis
 *   3. Community Acquired Pneumonia
 */

import type { MergedContextObject } from "@/services/context_service";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import { runCognitiveController } from "@/services/cognitive/clinical_cognitive_controller";

// ── Validation Scenarios ──

export interface ValidationScenario {
  id: string;
  name: string;
  expected_top1: string;
  expected_physiology: string[];
  expected_differentials: string[];
  context: MergedContextObject;
}

export const VALIDATION_SCENARIOS: ValidationScenario[] = [
  {
    id: "validation-gastroenteritis-001",
    name: "Acute Gastroenteritis",
    expected_top1: "gastroenteritis",
    expected_physiology: ["intestinal inflammation", "intestinal motility", "fluid loss", "electrolyte"],
    expected_differentials: ["gastroenteritis", "food poison", "viral enteritis", "appendicitis"],
    context: {
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
        bp_systolic: 110, bp_diastolic: 70, pulse: 96, temperature: 37.8,
        spo2: 98, respiratory_rate: 18, weight_kg: 72, height_cm: 175,
      },
      lab_results: [], risk_flags: [], missing_information: [],
      context_confidence: 0.9, source_priority: ["doctor"],
    },
  },
  {
    id: "validation-appendicitis-001",
    name: "Acute Appendicitis",
    expected_top1: "appendicitis",
    expected_physiology: ["appendiceal inflammation", "peritonitis", "inflammatory response", "intestinal"],
    expected_differentials: ["appendicitis", "gastroenteritis", "mesenteric adenitis", "ovarian torsion"],
    context: {
      visit_id: "validation-appendicitis-001",
      patient_id: "validation-patient-002",
      clinic_id: "validation-clinic-001",
      chief_complaint: "Severe right lower abdominal pain for 12 hours",
      symptoms: ["right lower quadrant abdominal pain", "fever", "nausea", "vomiting", "loss of appetite", "rebound tenderness"],
      symptom_duration: "12 hours",
      associated_symptoms: ["abdominal pain"],
      medical_history: [],
      family_history: [],
      risk_factors: [],
      medications: [],
      allergies: [],
      vitals: {
        bp_systolic: 125, bp_diastolic: 80, pulse: 102, temperature: 38.3,
        spo2: 98, respiratory_rate: 20, weight_kg: 70, height_cm: 172,
      },
      lab_results: [], risk_flags: [], missing_information: [],
      context_confidence: 0.9, source_priority: ["doctor"],
    },
  },
  {
    id: "validation-pneumonia-001",
    name: "Community Acquired Pneumonia",
    expected_top1: "pneumonia",
    expected_physiology: ["pulmonary inflammation", "alveolar", "impaired gas exchange", "respiratory"],
    expected_differentials: ["pneumonia", "bronchitis", "copd", "pulmonary embolism"],
    context: {
      visit_id: "validation-pneumonia-001",
      patient_id: "validation-patient-003",
      clinic_id: "validation-clinic-001",
      chief_complaint: "Fever and productive cough for 3 days",
      symptoms: ["fever", "productive cough", "shortness of breath", "chest pain", "fatigue"],
      symptom_duration: "3 days",
      associated_symptoms: ["chills", "loss of appetite"],
      medical_history: [],
      family_history: [],
      risk_factors: [],
      medications: [],
      allergies: [],
      vitals: {
        bp_systolic: 130, bp_diastolic: 85, pulse: 108, temperature: 38.9,
        spo2: 93, respiratory_rate: 24, weight_kg: 80, height_cm: 178,
      },
      lab_results: [], risk_flags: [], missing_information: [],
      context_confidence: 0.9, source_priority: ["doctor"],
    },
  },
];

// Keep backward compatibility
export const VALIDATION_SCENARIO = VALIDATION_SCENARIOS[0].context;

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
  scenario_id: string;
  timestamp: string;
  overall_status: "pass" | "fail" | "partial";
  total_latency_ms: number;

  stages: StageResult[];

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

  knowledge_gaps: KnowledgeGap[];

  criteria: {
    physiology_activated: boolean;
    target_in_candidates: boolean;
    top1_correct: boolean;
    no_pipeline_errors: boolean;
    latency_under_3s: boolean;
  };

  raw_output: ClinicalPipelineResult | null;
}

export interface MultiValidationResult {
  timestamp: string;
  scenarios: ValidationResult[];
  summary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
    avg_latency_ms: number;
    physiology_activation_rate: number;
    top1_accuracy: number;
  };
}

// ── Single Scenario Runner ──

async function runSingleValidation(
  scenario: ValidationScenario,
  onStage?: (stage: string) => void,
): Promise<ValidationResult> {
  const startTime = performance.now();
  const stages: StageResult[] = [];
  let pipelineResult: ClinicalPipelineResult | null = null;

  const result: ValidationResult = {
    scenario_name: scenario.name,
    scenario_id: scenario.id,
    timestamp: new Date().toISOString(),
    overall_status: "fail",
    total_latency_ms: 0,
    stages: [],
    trace: {
      input_symptoms: scenario.context.symptoms,
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
      target_in_candidates: false,
      top1_correct: false,
      no_pipeline_errors: false,
      latency_under_3s: false,
    },
    raw_output: null,
  };

  try {
    // ── Stage 1: Input Normalization ──
    onStage?.(`${scenario.name}: Normalization`);
    const s1Start = performance.now();
    result.trace.normalized_symptoms = scenario.context.symptoms.map(s => s.toLowerCase().trim());
    stages.push({
      stage: "Input Normalization",
      status: "success",
      latency_ms: Math.round(performance.now() - s1Start),
      data: { normalized: result.trace.normalized_symptoms },
    });

    // ── Stage 2-7: Run Full Pipeline ──
    onStage?.(`${scenario.name}: Pipeline`);
    const pipeStart = performance.now();
    pipelineResult = await runClinicalPipeline(scenario.context);
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
      latency_ms: o1?.stage_latencies?.physiology_engine || o1?.stage_latencies?.physiological_engine || 0,
      data: {
        states_activated: physioStates.length,
        states: physioStates.slice(0, 6),
        candidate_diagnosis_ids: physioCtx?.candidate_diagnosis_ids?.length || 0,
        dominant_systems: physioCtx?.dominant_organ_systems || [],
        states_before_filter: physioCtx?.states_before_filter || physioStates.length,
      },
      error: physioStates.length === 0 ? "No physiology states activated" : undefined,
    });

    // Stage 3: Candidate Generation (DDX)
    const ddxDiagnoses = o1?.ddx?.differential_diagnoses || pipelineResult.ddx_candidates?.diagnoses || [];
    const candidateNames = ddxDiagnoses.map((d: any) => d.diagnosis_name || d.diagnosis || "").filter(Boolean);
    result.trace.candidate_diagnoses = candidateNames;

    const targetMatch = candidateNames.some((n: string) =>
      scenario.expected_top1.split("|").some(t => n.toLowerCase().includes(t))
    );
    result.criteria.target_in_candidates = targetMatch;

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
    onStage?.(`${scenario.name}: Cognitive Pruning`);
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
        dangerous_detected: result.trace.dangerous_detected.length,
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
        has_assessment: !!soapData?.assessment,
        has_plan: !!soapData?.plan,
      },
    });

    // Build final ranking
    const finalSource = result.trace.bayesian_ranking.length > 0
      ? result.trace.bayesian_ranking
      : candidateNames.map((n: string) => ({ diagnosis: n, probability: 0 }));

    result.trace.final_ranking = finalSource.slice(0, 10).map((d, i) => ({
      rank: i + 1,
      diagnosis: d.diagnosis,
      probability: d.probability,
    }));

    // Check top-1
    const top1Name = result.trace.final_ranking[0]?.diagnosis || "";
    result.criteria.top1_correct = scenario.expected_top1.split("|").some(
      t => top1Name.toLowerCase().includes(t)
    );

    // No errors?
    const hasErrors = stages.some(s => s.status === "error");
    result.criteria.no_pipeline_errors = !hasErrors;

    // Latency
    result.total_latency_ms = Math.round(performance.now() - startTime);
    result.criteria.latency_under_3s = result.total_latency_ms < 3000;

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
        description: "No physiology states activated for input symptoms",
        missing_items: scenario.context.symptoms,
      });
    }
    if (candidateNames.length === 0) {
      result.knowledge_gaps.push({
        type: "symptom_likelihood",
        description: "No candidate diagnoses generated",
        missing_items: scenario.context.symptoms,
      });
    }
    if (!targetMatch && candidateNames.length > 0) {
      result.knowledge_gaps.push({
        type: "symptom_likelihood",
        description: `${scenario.name} not in candidates despite classic symptoms`,
        missing_items: [`${scenario.expected_top1} symptom_likelihoods`],
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

// ── Multi-Scenario Runner ──

export async function runPipelineValidation(
  onStage?: (stage: string) => void,
  scenarioIds?: string[],
): Promise<MultiValidationResult> {
  const scenarios = scenarioIds
    ? VALIDATION_SCENARIOS.filter(s => scenarioIds.includes(s.id))
    : VALIDATION_SCENARIOS;

  const results: ValidationResult[] = [];

  for (const scenario of scenarios) {
    onStage?.(`Running: ${scenario.name}`);
    const r = await runSingleValidation(scenario, onStage);
    results.push(r);
  }

  const passed = results.filter(r => r.overall_status === "pass").length;
  const partial = results.filter(r => r.overall_status === "partial").length;
  const failed = results.filter(r => r.overall_status === "fail").length;
  const avgLatency = results.reduce((s, r) => s + r.total_latency_ms, 0) / (results.length || 1);
  const physioRate = results.filter(r => r.criteria.physiology_activated).length / (results.length || 1);
  const top1Rate = results.filter(r => r.criteria.top1_correct).length / (results.length || 1);

  return {
    timestamp: new Date().toISOString(),
    scenarios: results,
    summary: {
      total: results.length,
      passed,
      partial,
      failed,
      avg_latency_ms: Math.round(avgLatency),
      physiology_activation_rate: Math.round(physioRate * 100) / 100,
      top1_accuracy: Math.round(top1Rate * 100) / 100,
    },
  };
}

// ── Single scenario runner (backward compat) ──
export async function runSingleScenarioValidation(
  onStage?: (stage: string) => void,
): Promise<ValidationResult> {
  return runSingleValidation(VALIDATION_SCENARIOS[0], onStage);
}
