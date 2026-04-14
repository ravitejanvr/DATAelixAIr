/**
 * Pipeline Types — V4 Unified Type System
 *
 * All pipeline stage inputs/outputs are defined here.
 * Each stage has a strict contract.
 */

import type { CanonicalFeature, CanonicalizationResult, SupportedLanguage } from "../canonical/types";

// ══════════════════════════════════════════════
// STAGE: Ingestion → Canonical
// ══════════════════════════════════════════════

export interface PipelineInput {
  /** Raw text from patient (voice transcript, form, chat) */
  raw_text?: string;
  /** Pre-structured symptoms */
  symptoms?: string[];
  /** Input source type */
  input_type: "voice" | "form" | "chat" | "frontdesk" | "report";
  /** Demographics */
  patient_age?: number | null;
  patient_sex?: string | null;
  patient_name?: string | null;
  /** Vitals */
  vitals?: PipelineVitals | null;
  /** Pre-existing data */
  medical_history?: string[];
  family_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  lab_results?: PipelineLabResult[];
  /** IDs */
  visit_id?: string | null;
  patient_id?: string | null;
  clinic_id?: string | null;
}

export interface PipelineVitals {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
}

export interface PipelineLabResult {
  parameter: string;
  value: string;
  unit?: string | null;
  reference_range?: string | null;
  is_abnormal?: boolean | null;
}

// ══════════════════════════════════════════════
// STAGE: Clinical Context (SSOT)
// ══════════════════════════════════════════════

export interface ClinicalContext {
  chief_complaint: CanonicalFeature | null;
  symptoms: CanonicalFeature[];
  associated_symptoms: CanonicalFeature[];
  duration: string;
  severity: string;
  vitals: PipelineVitals | null;
  medications: string[];
  allergies: string[];
  medical_history: string[];
  family_history: string[];
  lab_results: PipelineLabResult[];
  patient_age: number | null;
  patient_sex: string | null;
  risk_flags: RiskFlag[];
  missing_fields: MissingField[];
  context_confidence: number;
  language_detected: SupportedLanguage;
  canonicalization: CanonicalizationResult;
}

// ══════════════════════════════════════════════
// STAGE: Question Engine
// ══════════════════════════════════════════════

export interface QuestionEngineOutput {
  questions: ClinicalQuestion[];
  minimum_context_met: boolean;
  missing_critical_fields: string[];
}

export interface ClinicalQuestion {
  question_id: string;
  text: string;
  category: "symptom_detail" | "duration" | "severity" | "history" | "risk_factor" | "vital" | "allergy";
  priority: "critical" | "high" | "medium" | "low";
  triggered_by: string;  // canonical_id that triggered this
  options?: string[];
}

// ══════════════════════════════════════════════
// STAGE: DDX Engine
// ══════════════════════════════════════════════

export interface DDXCandidate {
  diagnosis_id: string;
  diagnosis_name: string;
  probability: number;
  supporting_features: string[];  // canonical IDs
  contradicting_features: string[];  // canonical IDs
  must_not_miss: boolean;
  category: string;
}

// ══════════════════════════════════════════════
// STAGE: Cognitive Layer
// ══════════════════════════════════════════════

export interface CognitiveSignals {
  expanded_hypotheses: string[];
  counterfactual_insights: CounterfactualInsight[];
  evidence_gaps: EvidenceGap[];
}

export interface CounterfactualInsight {
  diagnosis: string;
  if_present: string;   // canonical ID
  probability_delta: number;
  explanation: string;
}

export interface EvidenceGap {
  diagnosis: string;
  missing_feature: string;  // canonical ID
  importance: "critical" | "high" | "moderate";
  suggested_action: string;
}

// ══════════════════════════════════════════════
// STAGE: Completeness
// ══════════════════════════════════════════════

export interface CompletenessOutput {
  missing_tests: string[];
  required_questions: string[];
  red_flags: RedFlag[];
  completeness_score: number;
}

export interface RedFlag {
  flag_id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  action: string;
  trigger_features: string[];  // canonical IDs
}

// ══════════════════════════════════════════════
// STAGE: Confidence Engine
// ══════════════════════════════════════════════

export interface ConfidenceOutput {
  overall_confidence: number;
  uncertainty_score: number;
  conflicting_evidence: ConflictingEvidence[];
  insufficient_data_flags: string[];
  confidence_factors: ConfidenceFactor[];
}

export interface ConflictingEvidence {
  feature_a: string;
  feature_b: string;
  conflict_type: string;
  impact: number;
}

export interface ConfidenceFactor {
  name: string;
  weight: number;
  value: number;
  detail: string;
}

// ══════════════════════════════════════════════
// STAGE: Safety Layer
// ══════════════════════════════════════════════

export interface SafetyOutput {
  safety_alerts: SafetyAlert[];
  escalation_required: boolean;
  emergency_flags: string[];
}

export interface SafetyAlert {
  alert_id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  trigger_features: string[];
  action: string;
}

// ══════════════════════════════════════════════
// STAGE: Authority Layer
// ══════════════════════════════════════════════

export interface AuthorityOutput {
  ranked_diagnoses: AuthorityDiagnosis[];
  primary_diagnosis: AuthorityDiagnosis | null;
  resolution_method: string;
  authority_trace: string[];
}

export interface AuthorityDiagnosis {
  diagnosis_id: string;
  diagnosis_name: string;
  rank: number;
  final_probability: number;
  v3_probability: number;
  confidence_adjusted: boolean;
  safety_promoted: boolean;
  source: string;
}

// ══════════════════════════════════════════════
// STAGE: SSAL (Finalization — Frozen)
// ══════════════════════════════════════════════

export interface SSALOutput {
  readonly diagnoses: ReadonlyArray<AuthorityDiagnosis>;
  readonly primary: AuthorityDiagnosis | null;
  readonly frozen_at: string;
  readonly pipeline_version: string;
}

// ══════════════════════════════════════════════
// STAGE: Explainability
// ══════════════════════════════════════════════

export interface ExplainabilityOutput {
  explanations: DiagnosisExplanation[];
}

export interface DiagnosisExplanation {
  diagnosis: string;
  why: string;
  why_not_others: string[];
  contributing_features: FeatureContribution[];
  missing_expected_features: string[];
  confidence_rationale: string;
}

export interface FeatureContribution {
  feature_id: string;
  label: string;
  direction: "supporting" | "opposing" | "neutral";
  weight: number;
}

// ══════════════════════════════════════════════
// FULL PIPELINE OUTPUT
// ══════════════════════════════════════════════

export interface PipelineOutput {
  ssal: SSALOutput;
  context: ClinicalContext;
  questions: QuestionEngineOutput;
  completeness: CompletenessOutput;
  confidence: ConfidenceOutput;
  safety: SafetyOutput;
  explainability: ExplainabilityOutput;
  cognitive: CognitiveSignals;
  execution_ms: number;
  pipeline_version: "v4";
}

// ══════════════════════════════════════════════
// Shared sub-types used across stages
// ══════════════════════════════════════════════

export interface RiskFlag {
  flag_id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  trigger_features: string[];
  action: string;
}

export interface MissingField {
  field: string;
  reason: string;
  priority: "high" | "medium" | "low";
  suggested_questions?: string[];
}
