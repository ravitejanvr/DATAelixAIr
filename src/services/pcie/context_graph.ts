/**
 * UnifiedClinicalContextGraph
 *
 * The canonical shared clinical state structure that all PCIE modules
 * read from and write to. This replaces the pipeline-centric data flow
 * with a context-centric graph that accumulates reasoning results.
 *
 * Layers:
 *   PATIENT — demographics, history, observations
 *   REASONING — engine outputs (DDX, Bayesian, evidence, guidelines, hypotheses)
 *   DECISION — safety, investigations, treatments, confidence
 *   DOCUMENTATION — SOAP, clinical summary
 */

// ── Patient Context Layer ──

export interface PatientContextLayer {
  patient_age: number | null;
  patient_sex: string | null;
  patient_name: string | null;
  chief_complaint: string;
  symptoms: string[];
  associated_symptoms: string[];
  symptom_duration: string;
  medical_history: string[];
  family_history: string[];
  risk_factors: string[];
  current_medications: string[];
  allergies: string[];
  vitals: {
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    pulse?: number | null;
    temperature?: number | null;
    spo2?: number | null;
    respiratory_rate?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
  } | null;
  lab_results: Array<{
    parameter: string;
    value: string;
    unit?: string | null;
    reference_range?: string | null;
    is_abnormal?: boolean | null;
  }>;
  risk_flags: string[];
  missing_information: string[];
  context_confidence: number;
}

// ── Reasoning Layer ──

export interface ReasoningLayer {
  organ_systems_detected: string[];
  differential_diagnoses: Array<{
    diagnosis_name: string;
    diagnosis_id: string;
    probability: number;
    icd10_code?: string;
    must_not_miss?: boolean;
    supporting_symptoms?: string[];
    contradicting_factors?: string[];
    category?: string;
  }>;
  bayesian_probabilities: Array<{
    diagnosis_id: string;
    posterior_probability: number;
    prior: number;
    symptom_likelihood: number;
    must_not_miss?: boolean;
  }> | null;
  physiology_models: Array<{
    state_id: string;
    state_name: string;
    category: string;
    severity: string;
  }>;
  evidence_sources: Array<{
    title: string;
    source: string;
    relevance_score?: number;
    publication_year?: number;
    evidence_strength?: string;
    key_clinical_findings?: string;
  }>;
  guideline_references: {
    sources_used: string[];
    compliance_score: number;
    recommendations: Array<{
      recommendation: string;
      organization: string;
      evidence_level?: string;
    }>;
    conflicts: Array<{
      recommendation: string;
      conflicting_guideline: string;
      organization: string;
      severity: string;
      explanation: string;
    }>;
  } | null;
  hypotheses: Array<{
    condition: string;
    confidence: "high" | "moderate" | "low";
    supporting_evidence: string[];
    contradicting_evidence: string[];
    recommended_tests: string[];
  }>;
  reasoning_traces: Array<{
    module: string;
    timestamp: number;
    summary: string;
  }>;
}

// ── Decision Layer ──

export interface DecisionLayer {
  safety_alerts: Array<{
    event_type: string;
    severity: string;
    message: string;
  }>;
  safety_score: number;
  recommended_investigations: Array<{
    test_name: string;
    priority: string;
    differentiates: string[];
  }>;
  treatment_suggestions: Array<{
    generic_name: string;
    drug_class?: string;
    for_diagnosis?: string;
    safe?: boolean;
    interactions?: string[];
    allergy_conflict?: boolean;
  }>;
  uncertainty_score: number | null;
  confidence_score: number | null;
  confidence_label: string | null;
  paradigm_agreement: number | null;
}

// ── Documentation Layer ──

export interface DocumentationLayer {
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
  clinical_summary: string | null;
  soap_source: "hybrid_reasoning" | "fallback_generator" | "manual" | null;
}

// ── Full Graph ──

export interface UnifiedClinicalContextGraph {
  // Identity
  visit_id: string | null;
  patient_id: string | null;
  clinic_id: string | null;
  consultation_id: string | null;

  // Layers
  patient: PatientContextLayer;
  reasoning: ReasoningLayer;
  decision: DecisionLayer;
  documentation: DocumentationLayer;

  // Provenance
  source_type: "pcie" | "merged_context" | "direct" | "benchmark";
  assembled_at: string;
  last_updated_at: string;
  modules_executed: string[];
}

// ── Factory ──

export function createEmptyContextGraph(
  identity: {
    visit_id?: string | null;
    patient_id?: string | null;
    clinic_id?: string | null;
    consultation_id?: string | null;
  } = {},
): UnifiedClinicalContextGraph {
  const now = new Date().toISOString();
  return {
    visit_id: identity.visit_id ?? null,
    patient_id: identity.patient_id ?? null,
    clinic_id: identity.clinic_id ?? null,
    consultation_id: identity.consultation_id ?? null,
    patient: {
      patient_age: null,
      patient_sex: null,
      patient_name: null,
      chief_complaint: "",
      symptoms: [],
      associated_symptoms: [],
      symptom_duration: "",
      medical_history: [],
      family_history: [],
      risk_factors: [],
      current_medications: [],
      allergies: [],
      vitals: null,
      lab_results: [],
      risk_flags: [],
      missing_information: [],
      context_confidence: 0,
    },
    reasoning: {
      organ_systems_detected: [],
      differential_diagnoses: [],
      bayesian_probabilities: null,
      physiology_models: [],
      evidence_sources: [],
      guideline_references: null,
      hypotheses: [],
      reasoning_traces: [],
    },
    decision: {
      safety_alerts: [],
      safety_score: 100,
      recommended_investigations: [],
      treatment_suggestions: [],
      uncertainty_score: null,
      confidence_score: null,
      confidence_label: null,
      paradigm_agreement: null,
    },
    documentation: {
      soap_note: null,
      clinical_summary: null,
      soap_source: null,
    },
    source_type: "direct",
    assembled_at: now,
    last_updated_at: now,
    modules_executed: [],
  };
}
