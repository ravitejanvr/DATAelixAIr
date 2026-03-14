/**
 * Benchmark v8 — Cognitive Clinical Reasoning Evaluation Suite
 * Type Definitions
 *
 * Extends v7 with cognitive controller metrics:
 * - Hypothesis management quality
 * - Evidence strategy effectiveness
 * - Reasoning quality scoring
 * - Uncertainty calibration
 * - Diagnostic policy adherence
 */

import type { MergedContextObject } from "@/services/context_service";
import type { ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import type { PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import type { CognitiveControllerOutput } from "@/services/cognitive/clinical_cognitive_controller";

// ── Reasoning Category ──

export type ReasoningCategory = "straightforward" | "ambiguous" | "deceptive";

export type Specialty =
  | "emergency_medicine" | "cardiology" | "pulmonology" | "neurology"
  | "gastroenterology" | "endocrinology" | "infectious_disease"
  | "pediatrics" | "nephrology";

export type CaseDifficulty = "common" | "moderate" | "complex" | "rare";

// ── Case Definition ──

export interface BenchmarkCaseV8 {
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
    expected_iterations: 1 | 2;
    common_misdiagnosis?: string;
  };
}

// ── Cognitive Metrics (NEW in v8) ──

export interface CognitiveMetrics {
  hypothesis_management: {
    total_evaluated: number;
    kept: number;
    pruned: number;
    escalated: number;
    prune_accuracy: number; // did pruning help?
  };
  evidence_strategy: {
    strategy_type: string;
    tests_recommended: number;
    test_match_rate: number;
    total_information_gain: number;
  };
  reasoning_quality: {
    quality_score: number;
    issues_detected: number;
    high_severity_issues: number;
    entropy: number;
    ranking_stability: number;
    evidence_coverage: number;
  };
  uncertainty: {
    level: string;
    top_probability: number;
    probability_gap: number;
    candidates_within_10pct: number;
    entropy: number;
    recommended_action: string;
  };
  policy: {
    actions_triggered: number;
    should_iterate: boolean;
    should_escalate: boolean;
    confidence_sufficient: boolean;
  };
}

// ── Per-Iteration Snapshot (carried from v7) ──

export interface IterationSnapshot {
  iteration: number;
  top_diagnoses: Array<{ name: string; probability: number; rank: number }>;
  candidate_count: number;
  top_probability: number;
  confidence_gap: number;
  gold_standard_rank: number | null;
  gold_standard_probability: number | null;
  latency_ms: number;
}

// ── Iterative Reasoning Metrics ──

export interface IterativeReasoningMetrics {
  iterations_executed: number;
  loop_activated: boolean;
  loop_reason: string;
  initial_candidate_count: number;
  final_candidate_count: number;
  hypothesis_pruning_rate: number;
  initial_top_probability: number;
  final_top_probability: number;
  confidence_convergence: number;
  diagnosis_stable: boolean;
  gold_rank_iteration_1: number | null;
  gold_rank_iteration_2: number | null;
  gold_rank_improved: boolean;
  snapshots: IterationSnapshot[];
}

export interface SafetyMetrics {
  dangerous_detected: boolean;
  expected_dangerous: boolean;
  false_negative: boolean;
  safety_alerts: number;
  safety_score: number;
}

export interface LatencyBreakdownV8 {
  pcie_ms: number;
  world_model_ms: number;
  ddx_ms: number;
  bayesian_ms: number;
  hypothesis_testing_ms: number;
  evidence_planning_ms: number;
  causal_reasoning_ms: number;
  safety_ms: number;
  soap_ms: number;
  diagnostic_loop_ms: number;
  cognitive_controller_ms: number;
  total_ms: number;
}

// ── Per-Case Result ──

export interface CaseResultV8 {
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
  gold_standard_rank: number | null;
  actual_diagnoses: string[];
  matched_diagnoses: string[];

  // Cognitive controller (NEW)
  cognitive: CognitiveMetrics;

  // Iterative reasoning
  iterative_reasoning: IterativeReasoningMetrics;
  safety: SafetyMetrics;
  latency: LatencyBreakdownV8;

  // Quality
  reasoning_completeness: number;
  confidence_score: number;
  confidence_label: string;
  guideline_sources: string[];

  // Failure
  failure_reasons: string[];
  passed: boolean;

  // Raw
  pipeline_output: ClinicalPipelineResult | null;
  cognitive_output: CognitiveControllerOutput | null;
}

// ── Suite-Level Results ──

export interface CognitiveSummary {
  avg_reasoning_quality: number;
  avg_hypothesis_prune_rate: number;
  avg_evidence_match_rate: number;
  avg_entropy: number;
  avg_ranking_stability: number;
  policy_iterate_rate: number;
  policy_escalate_rate: number;
  confidence_sufficient_rate: number;
  by_category: Record<ReasoningCategory, {
    cases: number;
    avg_quality: number;
    avg_entropy: number;
    escalate_rate: number;
  }>;
}

export interface SpecialtyBreakdownV8 {
  specialty: Specialty;
  total_cases: number;
  passed: number;
  top1_accuracy: number;
  top3_accuracy: number;
  danger_detection_rate: number;
  avg_latency_ms: number;
  avg_reasoning_quality: number;
}

export interface LatencyStatisticsV8 {
  avg_total_ms: number;
  p50_ms: number;
  p95_ms: number;
  cases_under_2s: number;
  cases_under_2s_pct: number;
  cases_under_5s: number;
  cases_under_5s_pct: number;
}

export interface BenchmarkSuiteResultV8 {
  run_id: string;
  run_timestamp: string;
  version: "v8";
  suite_name: string;
  total_cases: number;
  passed_cases: number;
  pass_rate: number;

  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;

  danger_detection_rate: number;
  danger_false_negative_count: number;

  // Cognitive (NEW)
  cognitive: CognitiveSummary;

  // Iterative reasoning
  iteration_utilization_rate: number;
  avg_confidence_convergence: number;

  // Latency
  latency: LatencyStatisticsV8;

  // Breakdowns
  by_specialty: SpecialtyBreakdownV8[];
  by_category: Record<ReasoningCategory, {
    cases: number;
    passed: number;
    top1: number;
    top3: number;
  }>;

  recommendations: string[];
  cases: CaseResultV8[];
}

export interface BatchProgressV8 {
  caseIndex: number;
  totalCases: number;
  caseName: string;
  reasoningCategory: ReasoningCategory;
  batchNumber: number;
  totalBatches: number;
  status: "running" | "batch_delay" | "credit_error" | "done";
}
