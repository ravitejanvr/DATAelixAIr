/**
 * V3 Production Validation Suite — Types
 * Validates V3 engine in isolation for ranking correctness and systemic reasoning.
 */

export type V3CaseCategory = "strong_systemic" | "pure_local" | "ambiguous_overlap";

export interface V3ValidationCase {
  id: string;
  name: string;
  category: V3CaseCategory;
  expected_top1: string;
  /** If true, expected_top1 only needs to appear in top-3 (ambiguous cases) */
  top3_sufficient?: boolean;
  input: {
    symptoms: string[];
    vitals: Record<string, any>;
    risk_factors?: string[];
    medical_history?: string[];
    age: number;
    sex: string;
    duration?: string;
  };
}

export interface V3CaseResult {
  case_id: string;
  case_name: string;
  category: V3CaseCategory;
  expected_top1: string;
  top3: Array<{ diagnosis: string; probability: number }>;
  ground_truth_rank: number | null;
  top1_match: boolean;
  top3_match: boolean;
  systemic_severity: number;
  v3_state_contribution_top1: number;
  v1_symptom_contribution_top1: number;
  explanation: string;
  latency_ms: number;
  error?: string;
}

export interface V3ValidationSuiteResult {
  timestamp: string;
  total_cases: number;
  metrics: {
    top1_accuracy: number;
    top3_recall: number;
    systemic_top1_accuracy: number;
    local_top1_accuracy: number;
    ambiguous_top3_rate: number;
  };
  v1_overpower_count: number;
  systemic_flip_local_count: number;
  fragile_cases: string[];
  results: V3CaseResult[];
}
