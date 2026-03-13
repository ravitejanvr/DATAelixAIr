/**
 * Benchmark v6 — Full Clinical Reasoning Evaluation Suite
 * Type Definitions
 */

import type { MergedContextObject } from "@/services/context_service";
import type { ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import type { PipelineResult } from "@/services/clinical_pipeline/orchestrator";

// ── Case Definition ──

export type CaseDifficulty = "common" | "moderate" | "complex" | "rare";

export type Specialty =
  | "cardiology" | "neurology" | "pulmonology" | "gastroenterology"
  | "infectious_disease" | "emergency_medicine" | "endocrinology"
  | "nephrology" | "dermatology" | "pediatrics" | "psychiatry" | "rare_diseases";

export interface BenchmarkCaseV6 {
  id: string;
  name: string;
  specialty: Specialty;
  difficulty: CaseDifficulty;
  /** Clinical scenario tags for filtering */
  tags: string[];
  context: MergedContextObject;
  ground_truth: {
    gold_standard_diagnosis: string;
    top_differential_diagnoses: string[];
    recommended_tests: string[];
    recommended_medications: string[];
    guideline_reference: string;
    danger_flag: boolean;
    /** Expected organ system */
    organ_system: string;
  };
}

// ── Per-Case Result ──

export interface DiagnosticLoopEvaluation {
  iterations_executed: number;
  hypothesis_changes: number;
  probability_updates: number;
  convergence_status: "converged" | "diverged" | "unchanged" | "not_triggered";
  improved_ranking: boolean;
  weak_pruned: number;
}

export interface HypothesisEvaluation {
  total_tested: number;
  support_scores: number[];
  contradiction_scores: number[];
  pruning_rate: number;
  boosted_correct: boolean;
  removed_unsupported: number;
  entropy_reduction: number;
}

export interface EvidencePlanEvaluation {
  tests_recommended: string[];
  test_selection_accuracy: number;
  test_relevance_score: number;
  information_gain_score: number;
}

export interface BayesianEvaluation {
  posterior_accuracy: number;
  confidence_calibration: number;
  entropy_reduction: number;
  correct_gained_probability: boolean;
  incorrect_lost_probability: boolean;
}

export interface SafetyEvaluation {
  dangerous_detected: boolean;
  expected_dangerous: boolean;
  safety_score: number;
  critical_alerts: number;
  false_negative: boolean;
  safety_engine_activated: boolean;
}

export interface LatencyBreakdown {
  pcie_ms: number;
  world_model_ms: number;
  episodic_memory_ms: number;
  ddx_ms: number;
  hypothesis_testing_ms: number;
  evidence_ms: number;
  bayesian_ms: number;
  evidence_planning_ms: number;
  causal_reasoning_ms: number;
  conflict_resolution_ms: number;
  safety_ms: number;
  uncertainty_ms: number;
  soap_ms: number;
  diagnostic_loop_ms: number;
  total_ms: number;
}

export interface CaseResultV6 {
  case_id: string;
  case_name: string;
  specialty: Specialty;
  difficulty: CaseDifficulty;
  tags: string[];

  // Diagnostic accuracy
  top1_match: boolean;
  top3_match: boolean;
  top5_match: boolean;
  diagnosis_match_rate: number;
  lab_match_rate: number;
  medication_match_rate: number;
  gold_standard_rank: number | null; // rank of gold standard in DDX (null = not found)

  // Matched items
  matched_diagnoses: string[];
  actual_diagnoses: string[];
  actual_labs: string[];
  actual_medications: string[];

  // Component evaluations
  diagnostic_loop: DiagnosticLoopEvaluation;
  hypothesis: HypothesisEvaluation;
  evidence_plan: EvidencePlanEvaluation;
  bayesian: BayesianEvaluation;
  safety: SafetyEvaluation;
  latency: LatencyBreakdown;

  // Reasoning quality
  reasoning_trace_completeness: number; // 0-1
  graph_symptom_matches: number;
  graph_miss: boolean;
  confidence_score: number;
  confidence_label: string;
  guideline_sources: string[];

  // Failure classification
  failure_reasons: string[];
  failure_root_cause: FailureRootCause | null;

  // Raw outputs
  pipeline_output: ClinicalPipelineResult | null;
  o1_result: PipelineResult | null;
  passed: boolean;
}

export type FailureRootCause =
  | "knowledge_graph_gap"
  | "symptom_mapping_gap"
  | "physiology_inference_error"
  | "bayesian_probability_error"
  | "evidence_retrieval_failure"
  | "safety_engine_failure"
  | "hypothesis_testing_failure"
  | "diagnostic_loop_divergence"
  | "timeout_error"
  | "unknown";

// ── Suite-Level Results ──

export interface SpecialtyBreakdown {
  specialty: Specialty;
  total_cases: number;
  passed: number;
  avg_diagnosis_match: number;
  avg_lab_match: number;
  avg_latency_ms: number;
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  danger_detection_rate: number;
}

export interface DifficultyBreakdown {
  difficulty: CaseDifficulty;
  total_cases: number;
  passed: number;
  avg_diagnosis_match: number;
  top1_accuracy: number;
  top3_accuracy: number;
}

export interface LatencyStatistics {
  avg_total_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  avg_per_stage: Record<string, number>;
  cases_under_5s: number;
  cases_under_5s_pct: number;
}

export interface KnowledgeGraphGap {
  category: string;
  gap_type: "symptom_diagnosis" | "physiology_disease" | "test_mapping" | "guideline" | "rare_disease";
  description: string;
  affected_cases: string[];
  priority: "critical" | "high" | "medium" | "low";
}

export interface FailureAnalysis {
  total_failures: number;
  by_root_cause: Record<FailureRootCause, number>;
  by_specialty: Record<Specialty, number>;
  by_difficulty: Record<CaseDifficulty, number>;
  critical_misses: Array<{
    case_id: string;
    case_name: string;
    expected: string;
    actual: string[];
    root_cause: FailureRootCause;
  }>;
}

export interface BenchmarkSuiteResultV6 {
  run_id: string;
  run_timestamp: string;
  version: "v6";
  suite_name: string;
  total_cases: number;
  passed_cases: number;
  pass_rate: number;

  // Diagnostic accuracy
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  avg_diagnosis_match: number;
  avg_lab_match: number;
  avg_medication_match: number;

  // Safety
  danger_detection_rate: number;
  danger_false_negative_rate: number;
  safety_activation_rate: number;

  // Confidence
  avg_confidence_score: number;
  confidence_calibration_score: number;

  // Reasoning quality
  avg_reasoning_completeness: number;
  diagnostic_convergence_rate: number;
  hypothesis_pruning_rate: number;
  evidence_plan_accuracy: number;

  // Latency
  latency: LatencyStatistics;

  // Breakdowns
  by_specialty: SpecialtyBreakdown[];
  by_difficulty: DifficultyBreakdown[];

  // Analysis
  failure_analysis: FailureAnalysis;
  knowledge_gaps: KnowledgeGraphGap[];

  // Architecture recommendations
  recommendations: string[];

  // All case results
  cases: CaseResultV6[];
}
