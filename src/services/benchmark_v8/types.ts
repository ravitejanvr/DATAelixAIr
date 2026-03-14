/**
 * Benchmark v8 — Phase 1 GP Benchmark Types
 */

import type { MergedContextObject } from "@/services/context_service";
import type { ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import type { PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import type { CognitiveControllerOutput } from "@/services/cognitive/clinical_cognitive_controller";

export type ReasoningCategory = "straightforward" | "ambiguous" | "deceptive";

export type Specialty =
  | "general_practice" | "emergency_medicine" | "cardiology" | "pulmonology" | "neurology"
  | "gastroenterology" | "endocrinology" | "infectious_disease"
  | "pediatrics" | "nephrology";

export type CaseDifficulty = "common" | "moderate" | "complex" | "rare";

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

export interface CognitiveMetrics {
  hypothesis_management: {
    total_evaluated: number;
    kept: number;
    pruned: number;
    escalated: number;
    prune_accuracy: number;
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

export interface PhysiologyTrace {
  symptoms_detected: string[];
  physiology_states_activated: string[];
  candidate_diagnosis_ids: string[];
  affected_organ_systems: string[];
  physiology_used: boolean;
}

export interface ReasoningTrace {
  raw_symptoms: string[];
  normalized_symptoms: string[];
  symptoms: string[];
  physiology: PhysiologyTrace;
  candidate_diagnoses: Array<{ name: string; diagnosis_id: string; probability: number }>;
  bayesian_probabilities: Array<{ diagnosis: string; probability: number }>;
  hypotheses_pruned: string[];
  final_ranking: Array<{ diagnosis: string; diagnosis_id: string; probability: number; rank: number }>;
  dangerous_diagnoses_detected: string[];
  failure_type?: string;
}

export interface CaseResultV8 {
  case_id: string;
  case_name: string;
  specialty: Specialty;
  difficulty: CaseDifficulty;
  reasoning_category: ReasoningCategory;
  tags: string[];
  top1_match: boolean;
  top3_match: boolean;
  top5_match: boolean;
  gold_in_candidates: boolean;
  gold_standard_rank: number | null;
  actual_diagnoses: string[];
  actual_diagnosis_ids: string[];
  matched_diagnoses: string[];
  cognitive: CognitiveMetrics;
  iterative_reasoning: IterativeReasoningMetrics;
  safety: SafetyMetrics;
  latency: LatencyBreakdownV8;
  reasoning_trace: ReasoningTrace;
  reasoning_completeness: number;
  confidence_score: number;
  confidence_label: string;
  guideline_sources: string[];
  failure_reasons: string[];
  passed: boolean;
  pipeline_output: ClinicalPipelineResult | null;
  cognitive_output: CognitiveControllerOutput | null;
}

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
  candidate_recall: number;
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
  candidate_recall: number;
  danger_detection_rate: number;
  danger_false_negative_count: number;
  cognitive: CognitiveSummary;
  iteration_utilization_rate: number;
  avg_confidence_convergence: number;
  latency: LatencyStatisticsV8;
  by_specialty: SpecialtyBreakdownV8[];
  by_category: Record<ReasoningCategory, {
    cases: number;
    passed: number;
    top1: number;
    top3: number;
    candidate_recall: number;
  }>;
  physiology_activation_stats: {
    total_cases: number;
    physiology_used_count: number;
    physiology_usage_rate: number;
    avg_states_activated: number;
    avg_candidates_from_physiology: number;
  };
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
