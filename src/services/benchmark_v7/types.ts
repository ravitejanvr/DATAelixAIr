/**
 * Benchmark v7 — Iterative Clinical Reasoning Evaluation Suite
 * Type Definitions
 *
 * Captures both final diagnostic accuracy AND reasoning process quality
 * across iterative diagnostic loops.
 */

import type { MergedContextObject } from "@/services/context_service";
import type { ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import type { PipelineResult } from "@/services/clinical_pipeline/orchestrator";

// ── Reasoning Category ──

export type ReasoningCategory =
  | "straightforward"   // Single iteration sufficient
  | "ambiguous"         // Requires hypothesis testing & iteration
  | "deceptive";        // Requires physiology reasoning

export type Specialty =
  | "emergency_medicine" | "cardiology" | "pulmonology" | "neurology"
  | "gastroenterology" | "endocrinology" | "infectious_disease"
  | "pediatrics" | "nephrology" | "hematology";

export type CaseDifficulty = "common" | "moderate" | "complex" | "rare";

// ── Case Definition ──

export interface BenchmarkCaseV7 {
  id: string;
  name: string;
  specialty: Specialty;
  difficulty: CaseDifficulty;
  reasoning_category: ReasoningCategory;
  tags: string[];
  context: MergedContextObject;
  ground_truth: {
    gold_standard_diagnosis: string;
    alternative_plausible_diagnoses: string[];
    recommended_tests: string[];
    recommended_medications: string[];
    guideline_reference: string;
    danger_flag: boolean;
    organ_system: string;
    /** Expected iteration behavior */
    expected_iterations: 1 | 2;
    /** For deceptive cases: what the initial misdiagnosis might be */
    common_misdiagnosis?: string;
  };
}

// ── Per-Iteration Snapshot ──

export interface IterationSnapshot {
  iteration: number;
  top_diagnoses: Array<{
    name: string;
    probability: number;
    rank: number;
  }>;
  candidate_count: number;
  top_probability: number;
  confidence_gap: number;
  gold_standard_rank: number | null;
  gold_standard_probability: number | null;
  hypothesis_testing: {
    tested: number;
    supported: number;
    pruned: number;
  };
  evidence_plan: {
    tests_recommended: string[];
    information_gain: number;
  };
  latency_ms: number;
}

// ── Iterative Reasoning Metrics ──

export interface IterativeReasoningMetrics {
  /** Total iterations executed (1 or 2) */
  iterations_executed: number;
  /** Whether iteration 2 was triggered */
  loop_activated: boolean;
  /** Reason for loop activation or skip */
  loop_reason: string;

  /** Candidate count: initial → final */
  initial_candidate_count: number;
  final_candidate_count: number;
  hypothesis_pruning_rate: number; // (initial - final) / initial

  /** Confidence convergence: how much top probability improved */
  initial_top_probability: number;
  final_top_probability: number;
  confidence_convergence: number; // final - initial

  /** Did the #1 diagnosis change between iterations? */
  diagnosis_stable: boolean;
  top_diagnosis_changed: boolean;
  ranking_shifts: number; // how many diagnoses moved rank

  /** Gold standard tracking across iterations */
  gold_rank_iteration_1: number | null;
  gold_rank_iteration_2: number | null;
  gold_rank_improved: boolean;

  /** Per-iteration snapshots */
  snapshots: IterationSnapshot[];
}

export interface EvidencePlanningMetrics {
  tests_recommended: string[];
  test_match_rate: number; // vs ground truth
  clinical_usefulness_score: number; // 0-1
  information_gain_score: number;
  discriminative_tests: string[]; // tests that differentiate between top diagnoses
}

export interface SafetyMetrics {
  dangerous_detected: boolean;
  expected_dangerous: boolean;
  false_negative: boolean;
  safety_alerts: number;
  safety_engine_activated: boolean;
  safety_score: number;
}

export interface LatencyBreakdownV7 {
  pcie_ms: number;
  world_model_ms: number;
  episodic_memory_ms: number;
  ddx_ms: number;
  hypothesis_testing_ms: number;
  bayesian_ms: number;
  evidence_planning_ms: number;
  causal_reasoning_ms: number;
  conflict_resolution_ms: number;
  safety_ms: number;
  soap_ms: number;
  diagnostic_loop_ms: number;
  iteration_1_ms: number;
  iteration_2_ms: number;
  total_ms: number;
}

// ── Per-Case Result ──

export interface CaseResultV7 {
  case_id: string;
  case_name: string;
  specialty: Specialty;
  difficulty: CaseDifficulty;
  reasoning_category: ReasoningCategory;
  tags: string[];

  // Diagnostic accuracy
  top1_match: boolean;
  top3_match: boolean;
  top5_match: boolean;
  diagnosis_match_rate: number;
  lab_match_rate: number;
  medication_match_rate: number;
  gold_standard_rank: number | null;

  // Matched items
  matched_diagnoses: string[];
  actual_diagnoses: string[];
  actual_labs: string[];
  actual_medications: string[];

  // Iterative reasoning (NEW)
  iterative_reasoning: IterativeReasoningMetrics;
  evidence_planning: EvidencePlanningMetrics;
  safety: SafetyMetrics;
  latency: LatencyBreakdownV7;

  // Reasoning quality
  reasoning_completeness: number;
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
  | "hypothesis_testing_failure"
  | "diagnostic_loop_divergence"
  | "safety_engine_failure"
  | "evidence_planning_failure"
  | "timeout_error"
  | "unknown";

// ── Suite-Level Results ──

export interface IterativeReasoningSummary {
  /** % of scenarios that triggered iteration 2 */
  iteration_utilization_rate: number;
  /** Average pruning rate across all cases */
  avg_pruning_rate: number;
  /** Average confidence convergence */
  avg_confidence_convergence: number;
  /** % of cases where diagnosis was stable across iterations */
  diagnostic_stability_rate: number;
  /** % of cases where gold rank improved after iteration */
  gold_rank_improvement_rate: number;
  /** Breakdown by reasoning category */
  by_category: Record<ReasoningCategory, {
    cases: number;
    loop_rate: number;
    avg_convergence: number;
    top3_accuracy: number;
  }>;
}

export interface SpecialtyBreakdownV7 {
  specialty: Specialty;
  total_cases: number;
  passed: number;
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  avg_latency_ms: number;
  danger_detection_rate: number;
  avg_pruning_rate: number;
  avg_convergence: number;
}

export interface LatencyStatisticsV7 {
  avg_total_ms: number;
  p50_ms: number;
  p95_ms: number;
  avg_per_stage: Record<string, number>;
  cases_under_2s: number;
  cases_under_2s_pct: number;
  cases_under_5s: number;
  cases_under_5s_pct: number;
}

export interface BenchmarkSuiteResultV7 {
  run_id: string;
  run_timestamp: string;
  version: "v7";
  suite_name: string;
  total_cases: number;
  passed_cases: number;
  pass_rate: number;

  // Diagnostic accuracy
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  avg_diagnosis_match: number;

  // Safety
  danger_detection_rate: number;
  danger_false_negative_count: number;

  // Iterative reasoning (NEW)
  iterative_reasoning: IterativeReasoningSummary;

  // Evidence planning
  avg_evidence_plan_accuracy: number;

  // Latency
  latency: LatencyStatisticsV7;

  // Breakdowns
  by_specialty: SpecialtyBreakdownV7[];
  by_category: Record<ReasoningCategory, {
    cases: number;
    passed: number;
    top1: number;
    top3: number;
  }>;

  // Analysis
  recommendations: string[];
  knowledge_gaps: string[];

  // All case results
  cases: CaseResultV7[];
}
