/**
 * Benchmark v5 — Clinical Pipeline Evaluation
 *
 * 10 canonical test cases covering:
 * viral infection, gastroenteritis, respiratory infection, cardiac emergency,
 * drug allergy, conflicting symptoms, missing evidence, dangerous diagnosis,
 * polypharmacy, pediatric fever
 */

import type { MergedContextObject } from "@/services/context_service";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";

// ── Types ──

export interface BenchmarkCase {
  id: string;
  name: string;
  category: string;
  context: MergedContextObject;
  expected: {
    diagnoses: string[];
    labs: string[];
    medications: string[];
    danger_flag?: boolean;
  };
}

export interface PipelineAudit {
  pipeline_name: string;
  ddx_engine_invoked: boolean;
  diagnosis_scoring_enabled: boolean;
  organ_system_bonus_applied: boolean;
  danger_bonus_applied: boolean;
  knowledge_retrieval_invoked: boolean;
  guideline_engine_invoked: boolean;
  safety_engine_invoked: boolean;
  uncertainty_engine_invoked: boolean;
  soap_generated: boolean;
}

export interface BenchmarkCaseResult {
  case_id: string;
  case_name: string;
  category: string;
  passed: boolean;
  diagnosis_match_rate: number;
  lab_match_rate: number;
  medication_match_rate: number;
  guideline_citations: number;
  danger_detected: boolean;
  expected_danger: boolean;
  confidence_score: number;
  confidence_label: string;
  latency: {
    wave1_ms: number;
    wave2_ms: number;
    wave3_ms: number;
    total_ms: number;
  };
  matched_diagnoses: string[];
  matched_labs: string[];
  matched_medications: string[];
  // Diagnostic audit fields
  graph_miss: boolean;
  graph_symptom_matches: number;
  dangerous_injected: number;
  guideline_sources: string[];
  actual_diagnoses: string[];
  actual_labs: string[];
  actual_medications: string[];
  pipeline_audit: PipelineAudit;
  pipeline_output: ClinicalPipelineResult;
}

export interface BenchmarkSuiteResult {
  run_id: string;
  run_timestamp: string;
  version: "v5";
  total_cases: number;
  passed_cases: number;
  avg_diagnosis_match: number;
  avg_lab_match: number;
  avg_medication_match: number;
  avg_latency_ms: number;
  module_avg_latency: {
    wave1_ms: number;
    wave2_ms: number;
    wave3_ms: number;
  };
  danger_detection_rate: number;
  cases: BenchmarkCaseResult[];
}

// ── Helpers ──

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(actual: string[], expected: string[]): string[] {
  return expected.filter(exp => {
    const ne = normalize(exp);
    return actual.some(act => {
      const na = normalize(act);
      return na.includes(ne) || ne.includes(na);
    });
  });
}

function matchRate(actual: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  return fuzzyMatch(actual, expected).length / expected.length;
}

// ── Stub Context Builder ──

function makeContext(overrides: Partial<MergedContextObject>): MergedContextObject {
  return {
    visit_id: `bench-v5-${crypto.randomUUID().slice(0, 8)}`,
    patient_id: "bench-patient",
    clinic_id: "bench-clinic",
    chief_complaint: "",
    symptoms: [],
    symptom_duration: "",
    associated_symptoms: [],
    medical_history: [],
    family_history: [],
    risk_factors: [],
    medications: [],
    allergies: [],
    vitals: null,
    lab_results: [],
    risk_flags: [],
    missing_information: [],
    context_confidence: 0.8,
    source_priority: ["benchmark"],
    ...overrides,
  };
}

// ── 10 Benchmark Cases ──

export const BENCHMARK_CASES_V5: BenchmarkCase[] = [
  {
    id: "v5-01",
    name: "Viral Upper Respiratory Infection",
    category: "viral_infection",
    context: makeContext({
      chief_complaint: "Sore throat and runny nose for 3 days",
      symptoms: ["sore throat", "runny nose", "sneezing", "mild headache"],
      symptom_duration: "3 days",
      associated_symptoms: ["fatigue", "low-grade fever"],
      vitals: { temperature: 37.8, pulse: 82, spo2: 98 },
    }),
    expected: {
      diagnoses: ["Upper Respiratory Infection", "Common Cold", "Viral Pharyngitis"],
      labs: ["CBC", "Rapid Strep Test"],
      medications: ["Acetaminophen", "Paracetamol", "Antihistamine"],
    },
  },
  {
    id: "v5-02",
    name: "Acute Gastroenteritis",
    category: "gastroenteritis",
    context: makeContext({
      chief_complaint: "Vomiting and diarrhea since yesterday",
      symptoms: ["vomiting", "diarrhea", "abdominal cramps", "nausea"],
      symptom_duration: "1 day",
      associated_symptoms: ["dehydration", "loss of appetite"],
      vitals: { temperature: 37.5, pulse: 96, bp_systolic: 110, bp_diastolic: 70 },
    }),
    expected: {
      diagnoses: ["Acute Gastroenteritis", "Food Poisoning", "Viral Gastroenteritis"],
      labs: ["Stool Culture", "Electrolytes", "CBC"],
      medications: ["ORS", "Ondansetron", "Loperamide"],
    },
  },
  {
    id: "v5-03",
    name: "Community Acquired Pneumonia",
    category: "respiratory_infection",
    context: makeContext({
      chief_complaint: "Cough with yellow sputum and fever for 5 days",
      symptoms: ["productive cough", "fever", "chest pain", "dyspnea"],
      symptom_duration: "5 days",
      associated_symptoms: ["chills", "fatigue", "pleuritic chest pain"],
      vitals: { temperature: 39.2, pulse: 110, spo2: 93, respiratory_rate: 24 },
      medical_history: ["Diabetes Mellitus"],
    }),
    expected: {
      diagnoses: ["Community Acquired Pneumonia", "Pneumonia", "Lower Respiratory Tract Infection"],
      labs: ["Chest X-ray", "CBC", "Blood Culture", "CRP", "Procalcitonin"],
      medications: ["Amoxicillin", "Azithromycin", "Clavulanate"],
    },
  },
  {
    id: "v5-04",
    name: "Acute Myocardial Infarction",
    category: "cardiac_emergency",
    context: makeContext({
      chief_complaint: "Severe crushing chest pain radiating to left arm",
      symptoms: ["chest pain", "left arm pain", "diaphoresis", "shortness of breath"],
      symptom_duration: "45 minutes",
      associated_symptoms: ["nausea", "dizziness"],
      vitals: { bp_systolic: 160, bp_diastolic: 95, pulse: 110, spo2: 94 },
      medical_history: ["Hypertension", "Hyperlipidemia"],
      risk_factors: ["smoking", "family history of CAD"],
      medications: ["Atorvastatin", "Amlodipine"],
    }),
    expected: {
      diagnoses: ["Acute Myocardial Infarction", "Unstable Angina", "Acute Coronary Syndrome"],
      labs: ["Troponin", "ECG", "CBC", "BMP", "CK-MB"],
      medications: ["Aspirin", "Nitroglycerin", "Heparin", "Clopidogrel"],
      danger_flag: true,
    },
  },
  {
    id: "v5-05",
    name: "Drug Allergy Reaction",
    category: "drug_allergy",
    context: makeContext({
      chief_complaint: "Rash and itching after taking amoxicillin",
      symptoms: ["urticaria", "pruritus", "skin rash"],
      symptom_duration: "6 hours",
      associated_symptoms: ["mild swelling of lips"],
      allergies: ["Penicillin"],
      medications: ["Amoxicillin"],
      vitals: { pulse: 88, bp_systolic: 120, bp_diastolic: 75 },
    }),
    expected: {
      diagnoses: ["Drug Allergy", "Allergic Reaction", "Urticaria"],
      labs: ["IgE levels", "CBC"],
      medications: ["Cetirizine", "Diphenhydramine", "Prednisolone", "Epinephrine"],
    },
  },
  {
    id: "v5-06",
    name: "Conflicting Symptoms — Fever with Hypothermia History",
    category: "conflicting_symptoms",
    context: makeContext({
      chief_complaint: "Fever and chills but feeling cold",
      symptoms: ["fever", "chills", "cold sensation", "body ache"],
      symptom_duration: "2 days",
      associated_symptoms: ["sweating", "rigors"],
      medical_history: ["Hypothyroidism"],
      vitals: { temperature: 39.0, pulse: 100 },
    }),
    expected: {
      diagnoses: ["Malaria", "Dengue", "Typhoid Fever", "Sepsis"],
      labs: ["Blood Smear", "Dengue NS1", "Widal Test", "CBC", "Blood Culture"],
      medications: ["Paracetamol", "Antimalarial"],
    },
  },
  {
    id: "v5-07",
    name: "Missing Evidence — Vague Fatigue",
    category: "missing_evidence",
    context: makeContext({
      chief_complaint: "Feeling tired all the time",
      symptoms: ["fatigue"],
      symptom_duration: "3 weeks",
      vitals: { pulse: 72, bp_systolic: 118, bp_diastolic: 76 },
    }),
    expected: {
      diagnoses: ["Anemia", "Hypothyroidism", "Depression", "Diabetes"],
      labs: ["CBC", "TSH", "Blood Glucose", "Iron Studies", "Vitamin B12"],
      medications: [],
    },
  },
  {
    id: "v5-08",
    name: "Dangerous Diagnosis — Meningitis",
    category: "dangerous_diagnosis",
    context: makeContext({
      chief_complaint: "Severe headache with neck stiffness and fever",
      symptoms: ["severe headache", "neck stiffness", "fever", "photophobia"],
      symptom_duration: "12 hours",
      associated_symptoms: ["vomiting", "confusion", "petechial rash"],
      vitals: { temperature: 39.8, pulse: 120, bp_systolic: 90, bp_diastolic: 60 },
    }),
    expected: {
      diagnoses: ["Meningitis", "Bacterial Meningitis", "Encephalitis"],
      labs: ["Lumbar Puncture", "CSF Analysis", "Blood Culture", "CBC", "CRP"],
      medications: ["Ceftriaxone", "Vancomycin", "Dexamethasone"],
      danger_flag: true,
    },
  },
  {
    id: "v5-09",
    name: "Polypharmacy — Elderly with Multiple Conditions",
    category: "polypharmacy",
    context: makeContext({
      chief_complaint: "Dizziness and falls",
      symptoms: ["dizziness", "unsteady gait", "near-syncope"],
      symptom_duration: "1 week",
      associated_symptoms: ["blurred vision", "dry mouth"],
      medical_history: ["Hypertension", "Diabetes", "Depression", "Osteoarthritis", "GERD"],
      medications: ["Amlodipine", "Metformin", "Sertraline", "Ibuprofen", "Omeprazole", "Lisinopril"],
      vitals: { bp_systolic: 100, bp_diastolic: 58, pulse: 64 },
      risk_factors: ["age > 65"],
    }),
    expected: {
      diagnoses: ["Orthostatic Hypotension", "Drug-Induced Dizziness", "Postural Hypotension"],
      labs: ["Orthostatic BP", "Blood Glucose", "Electrolytes", "Renal Function"],
      medications: [],
    },
  },
  {
    id: "v5-10",
    name: "Pediatric Fever with Rash",
    category: "pediatric_fever",
    context: makeContext({
      chief_complaint: "High fever and rash in 4-year-old child",
      symptoms: ["high fever", "maculopapular rash", "irritability"],
      symptom_duration: "2 days",
      associated_symptoms: ["coryza", "conjunctivitis", "cough"],
      vitals: { temperature: 40.1, pulse: 130 },
      risk_factors: ["unvaccinated"],
    }),
    expected: {
      diagnoses: ["Measles", "Roseola", "Scarlet Fever", "Kawasaki Disease"],
      labs: ["Measles IgM", "CBC", "CRP"],
      medications: ["Paracetamol", "Ibuprofen", "Vitamin A"],
      danger_flag: true,
    },
  },
];

// ── Runner ──

export async function runBenchmarkV5(
  onProgress?: (caseIndex: number, total: number, caseName: string) => void,
): Promise<BenchmarkSuiteResult> {
  const runId = `v5-${Date.now()}`;
  const cases = BENCHMARK_CASES_V5;
  const results: BenchmarkCaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const bc = cases[i];
    onProgress?.(i, cases.length, bc.name);

    try {
      const pipelineResult = await runClinicalPipeline(bc.context);

      // Extract actual values
      const actualDiagnoses = pipelineResult.ddx_candidates.diagnoses.map(d => d.diagnosis);
      const actualLabs = pipelineResult.recommended_labs.map(l => l.test_name);
      const actualMeds = pipelineResult.recommended_medications.suggestions.map(s => s.generic_name);

      const matchedDiagnoses = fuzzyMatch(actualDiagnoses, bc.expected.diagnoses);
      const matchedLabs = fuzzyMatch(actualLabs, bc.expected.labs);
      const matchedMeds = fuzzyMatch(actualMeds, bc.expected.medications);

      const diagMatchRate = matchRate(actualDiagnoses, bc.expected.diagnoses);
      const labMatchRate = matchRate(actualLabs, bc.expected.labs);
      const medMatchRate = bc.expected.medications.length === 0 ? 1 : matchRate(actualMeds, bc.expected.medications);

      // Danger detection: check must_not_miss flag from DDX output OR critical safety alerts
      const dangerDetected = pipelineResult.ddx_candidates.diagnoses.some(d => d.must_not_miss) ||
        pipelineResult.safety_alerts.critical_count > 0;

      // Graph audit info from DDX raw output
      const ddxRaw = pipelineResult.ddx_candidates.raw;
      const graphMiss = ddxRaw?.graph_miss ?? true;
      const graphSymptomMatches = ddxRaw?.matched_symptoms?.length ?? 0;
      const dangerousInjected = ddxRaw?.dangerous_diagnoses_injected ?? 0;

      // Pass threshold: diag >= 0.5
      const passed = diagMatchRate >= 0.5;

      results.push({
        case_id: bc.id,
        case_name: bc.name,
        category: bc.category,
        passed,
        diagnosis_match_rate: diagMatchRate,
        lab_match_rate: labMatchRate,
        medication_match_rate: medMatchRate,
        guideline_citations: pipelineResult.guidelines.sources_used.length,
        danger_detected: dangerDetected,
        expected_danger: bc.expected.danger_flag || false,
        confidence_score: pipelineResult.confidence_scores.confidence_score,
        confidence_label: pipelineResult.confidence_scores.confidence_label,
        latency: pipelineResult.latency,
        matched_diagnoses: matchedDiagnoses,
        matched_labs: matchedLabs,
        matched_medications: matchedMeds,
        // Diagnostic audit
        graph_miss: graphMiss,
        graph_symptom_matches: graphSymptomMatches,
        dangerous_injected: dangerousInjected,
        guideline_sources: pipelineResult.guidelines.sources_used,
        actual_diagnoses: actualDiagnoses,
        actual_labs: actualLabs,
        actual_medications: actualMeds,
        pipeline_output: pipelineResult,
      });
    } catch (error) {
      console.error(`[BenchmarkV5] Case ${bc.id} failed:`, error);
      results.push({
        case_id: bc.id,
        case_name: bc.name,
        category: bc.category,
        passed: false,
        diagnosis_match_rate: 0,
        lab_match_rate: 0,
        medication_match_rate: 0,
        guideline_citations: 0,
        danger_detected: false,
        expected_danger: bc.expected.danger_flag || false,
        confidence_score: 0,
        confidence_label: "Error",
        latency: { wave1_ms: 0, wave2_ms: 0, wave3_ms: 0, total_ms: 0 },
        matched_diagnoses: [],
        matched_labs: [],
        matched_medications: [],
        graph_miss: true,
        graph_symptom_matches: 0,
        dangerous_injected: 0,
        guideline_sources: [],
        actual_diagnoses: [],
        actual_labs: [],
        actual_medications: [],
        pipeline_output: null as any,
      });
    }
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const dangerCases = results.filter(r => r.expected_danger);
  const dangerDetected = dangerCases.filter(r => r.danger_detected).length;

  return {
    run_id: runId,
    run_timestamp: new Date().toISOString(),
    version: "v5",
    total_cases: cases.length,
    passed_cases: results.filter(r => r.passed).length,
    avg_diagnosis_match: avg(results.map(r => r.diagnosis_match_rate)),
    avg_lab_match: avg(results.map(r => r.lab_match_rate)),
    avg_medication_match: avg(results.map(r => r.medication_match_rate)),
    avg_latency_ms: avg(results.map(r => r.latency.total_ms)),
    module_avg_latency: {
      wave1_ms: avg(results.map(r => r.latency.wave1_ms)),
      wave2_ms: avg(results.map(r => r.latency.wave2_ms)),
      wave3_ms: avg(results.map(r => r.latency.wave3_ms)),
    },
    danger_detection_rate: dangerCases.length ? dangerDetected / dangerCases.length : 1,
    cases: results,
  };
}
