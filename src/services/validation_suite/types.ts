/**
 * Deterministic Validation Suite — Types
 */

export interface ValidationScenario {
  id: string;
  name: string;
  clinical_context: {
    chief_complaint: string;
    symptoms: string[];
    age: number;
    sex: string;
    vitals?: Record<string, any>;
    medical_history?: string[];
    medications?: string[];
    allergies?: string[];
    duration?: string;
  };
  expected_top_diagnosis: string;
  /** Sensitivity variant: modified inputs that should change scores */
  sensitivity_variant?: {
    label: string;
    overrides: Partial<ValidationScenario["clinical_context"]>;
    expected_effect: "decrease" | "increase";
    target_diagnosis: string;
  };
}

export interface DiagnosisSnapshot {
  diagnosis: string;
  probability: number;
  rank: number;
}

export interface RunSnapshot {
  run_index: number;
  skip_cache: boolean;
  diagnoses: DiagnosisSnapshot[];
  latency_ms: number;
  timestamp: number;
}

export type TestType = "determinism" | "sensitivity" | "isolation" | "cache_consistency";

export interface TestResult {
  scenario: string;
  test_type: TestType;
  passed: boolean;
  score_variance: number;
  ranking_variance: number;
  details?: string;
  runs?: RunSnapshot[];
}

export interface ValidationSuiteResult {
  started_at: string;
  completed_at: string;
  tests: TestResult[];
  summary: {
    deterministic: boolean;
    stable: boolean;
    no_state_leak: boolean;
    feature_sensitive: boolean;
    system_not_deterministic: boolean;
    root_cause_hint: string | null;
  };
}
