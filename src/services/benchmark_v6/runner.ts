/**
 * Benchmark v6 — Enhanced Runner
 * Executes 205 cases through the full cognitive pipeline with detailed metrics.
 */

import { BENCHMARK_CASES_V6 } from "./cases";
import type {
  BenchmarkCaseV6, CaseResultV6, BenchmarkSuiteResultV6,
  DiagnosticLoopEvaluation, HypothesisEvaluation, EvidencePlanEvaluation,
  BayesianEvaluation, SafetyEvaluation, LatencyBreakdown, LatencyStatistics,
  SpecialtyBreakdown, DifficultyBreakdown, FailureAnalysis, KnowledgeGraphGap,
  FailureRootCause, Specialty, CaseDifficulty,
} from "./types";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";

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

function findGoldRank(actualDiagnoses: string[], gold: string): number | null {
  const ng = normalize(gold);
  const idx = actualDiagnoses.findIndex(a => {
    const na = normalize(a);
    return na.includes(ng) || ng.includes(na);
  });
  return idx >= 0 ? idx + 1 : null;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Run Single Case ──

async function runCase(bc: BenchmarkCaseV6): Promise<CaseResultV6> {
  try {
    const result = await runClinicalPipeline(bc.context);
    const o1 = result.o1_result || null;

    // Extract actuals
    const actualDx = result.ddx_candidates?.diagnoses?.map((d: any) => d.diagnosis) || [];
    const actualLabs = result.recommended_labs?.map((l: any) => l.test_name) || [];
    const actualMeds = result.recommended_medications?.suggestions?.map((s: any) => s.generic_name) || [];

    const goldRank = findGoldRank(actualDx, bc.ground_truth.gold_standard_diagnosis);
    const diagMatch = matchRate(actualDx, bc.ground_truth.top_differential_diagnoses);
    const labMatch = matchRate(actualLabs, bc.ground_truth.recommended_tests);
    const medMatch = bc.ground_truth.recommended_medications.length === 0 ? 1 : matchRate(actualMeds, bc.ground_truth.recommended_medications);

    // Safety
    const dangerDetected = result.ddx_candidates?.diagnoses?.some((d: any) => d.must_not_miss) ||
      result.safety_alerts?.critical_count > 0;

    // Diagnostic loop eval
    const dxLoop: DiagnosticLoopEvaluation = o1?.diagnostic_loop ? {
      iterations_executed: o1.diagnostic_loop.executed ? 1 : 0,
      hypothesis_changes: o1.diagnostic_loop.candidates_pruned || 0,
      probability_updates: o1.diagnostic_loop.candidates_remaining || 0,
      convergence_status: o1.diagnostic_loop.executed ? "converged" : "not_triggered",
      improved_ranking: o1.diagnostic_loop.executed || false,
      weak_pruned: o1.diagnostic_loop.candidates_pruned || 0,
    } : { iterations_executed: 0, hypothesis_changes: 0, probability_updates: 0, convergence_status: "not_triggered", improved_ranking: false, weak_pruned: 0 };

    // Hypothesis eval
    const hypoTest = o1?.hypothesis_testing;
    const hypoEval: HypothesisEvaluation = hypoTest ? {
      total_tested: hypoTest.summary?.total_tested || 0,
      support_scores: hypoTest.tested_hypotheses?.map((h: any) => h.support_score) || [],
      contradiction_scores: hypoTest.tested_hypotheses?.map((h: any) => h.contradiction_score || 0) || [],
      pruning_rate: hypoTest.summary ? (hypoTest.summary.weakly_supported / Math.max(1, hypoTest.summary.total_tested)) : 0,
      boosted_correct: goldRank !== null && goldRank <= 3,
      removed_unsupported: hypoTest.summary?.weakly_supported || 0,
      entropy_reduction: 0,
    } : { total_tested: 0, support_scores: [], contradiction_scores: [], pruning_rate: 0, boosted_correct: false, removed_unsupported: 0, entropy_reduction: 0 };

    // Evidence plan eval
    const evPlan = o1?.evidence_plan;
    const evPlanEval: EvidencePlanEvaluation = evPlan ? {
      tests_recommended: evPlan.recommended_tests?.map((t: any) => t.test_name || t) || [],
      test_selection_accuracy: matchRate(evPlan.recommended_tests?.map((t: any) => t.test_name || t) || [], bc.ground_truth.recommended_tests),
      test_relevance_score: evPlan.information_gain_score || 0,
      information_gain_score: evPlan.information_gain_score || 0,
    } : { tests_recommended: [], test_selection_accuracy: 0, test_relevance_score: 0, information_gain_score: 0 };

    // Bayesian eval
    const bayesian = o1?.bayesian;
    const bayesEval: BayesianEvaluation = {
      posterior_accuracy: goldRank ? (goldRank <= 3 ? 1 : 0.5) : 0,
      confidence_calibration: result.confidence_scores?.confidence_score || 0,
      entropy_reduction: 0,
      correct_gained_probability: goldRank !== null && goldRank <= 3,
      incorrect_lost_probability: false,
    };

    // Safety eval
    const safetyEval: SafetyEvaluation = {
      dangerous_detected: dangerDetected,
      expected_dangerous: bc.ground_truth.danger_flag,
      safety_score: result.safety_alerts?.safety_score || 100,
      critical_alerts: result.safety_alerts?.critical_count || 0,
      false_negative: bc.ground_truth.danger_flag && !dangerDetected,
      safety_engine_activated: (result.safety_alerts?.alerts?.length || 0) > 0,
    };

    // Latency
    const lat: LatencyBreakdown = {
      pcie_ms: o1?.stage_latencies?.wave0_pcie || 0,
      world_model_ms: o1?.stage_latencies?.meta_reasoning || 0,
      episodic_memory_ms: o1?.stage_latencies?.episodic_memory || 0,
      ddx_ms: o1?.stage_latencies?.ddx_engine || 0,
      hypothesis_testing_ms: o1?.stage_latencies?.hypothesis_testing || 0,
      evidence_ms: o1?.stage_latencies?.retrieve_evidence || 0,
      bayesian_ms: o1?.stage_latencies?.bayesian_engine || 0,
      evidence_planning_ms: o1?.stage_latencies?.evidence_planning || 0,
      causal_reasoning_ms: o1?.stage_latencies?.causal_reasoning || 0,
      conflict_resolution_ms: o1?.stage_latencies?.conflict_resolution || 0,
      safety_ms: o1?.stage_latencies?.safety_evaluation || 0,
      uncertainty_ms: o1?.stage_latencies?.uncertainty_engine || 0,
      soap_ms: o1?.stage_latencies?.soap_generation || 0,
      diagnostic_loop_ms: o1?.stage_latencies?.diagnostic_loop || 0,
      total_ms: result.latency?.total_ms || o1?.total_latency_ms || 0,
    };

    // Reasoning completeness
    const stagesExpected = 10;
    let stagesExecuted = 0;
    if (o1?.ddx) stagesExecuted++;
    if (o1?.bayesian) stagesExecuted++;
    if (o1?.evidence) stagesExecuted++;
    if (o1?.hypothesis_testing) stagesExecuted++;
    if (o1?.uncertainty) stagesExecuted++;
    if (o1?.oversight) stagesExecuted++;
    if (o1?.hybrid_reasoning || o1?.soap_fallback) stagesExecuted++;
    if (o1?.meta_reasoning) stagesExecuted++;
    if (o1?.causal_reasoning) stagesExecuted++;
    if (o1?.episodic_memory) stagesExecuted++;
    const reasoningCompleteness = stagesExecuted / stagesExpected;

    // Failure reasons
    const failures: string[] = [];
    let rootCause: FailureRootCause | null = null;
    if (!goldRank || goldRank > 3) {
      failures.push(`Gold standard "${bc.ground_truth.gold_standard_diagnosis}" not in top 3`);
      const ddxRaw = result.ddx_candidates?.raw;
      if (ddxRaw?.graph_miss) rootCause = "knowledge_graph_gap";
      else if ((ddxRaw?.matched_symptoms?.length || 0) === 0) rootCause = "symptom_mapping_gap";
      else rootCause = "bayesian_probability_error";
    }
    if (bc.ground_truth.danger_flag && !dangerDetected) {
      failures.push("Dangerous diagnosis missed");
      rootCause = rootCause || "safety_engine_failure";
    }

    const passed = diagMatch >= 0.5 && (!bc.ground_truth.danger_flag || dangerDetected);

    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty, difficulty: bc.difficulty, tags: bc.tags,
      top1_match: goldRank === 1, top3_match: goldRank !== null && goldRank <= 3, top5_match: goldRank !== null && goldRank <= 5,
      diagnosis_match_rate: diagMatch, lab_match_rate: labMatch, medication_match_rate: medMatch, gold_standard_rank: goldRank,
      matched_diagnoses: fuzzyMatch(actualDx, bc.ground_truth.top_differential_diagnoses),
      actual_diagnoses: actualDx, actual_labs: actualLabs, actual_medications: actualMeds,
      diagnostic_loop: dxLoop, hypothesis: hypoEval, evidence_plan: evPlanEval, bayesian: bayesEval,
      safety: safetyEval, latency: lat,
      reasoning_trace_completeness: reasoningCompleteness,
      graph_symptom_matches: result.ddx_candidates?.raw?.matched_symptoms?.length || 0,
      graph_miss: result.ddx_candidates?.raw?.graph_miss ?? true,
      confidence_score: result.confidence_scores?.confidence_score || 0,
      confidence_label: result.confidence_scores?.confidence_label || "Unknown",
      guideline_sources: result.guidelines?.sources_used || [],
      failure_reasons: failures, failure_root_cause: rootCause,
      pipeline_output: result, o1_result: o1, passed,
    };
  } catch (error) {
    console.error(`[BenchmarkV6] Case ${bc.id} failed:`, error);
    const emptyLat: LatencyBreakdown = { pcie_ms: 0, world_model_ms: 0, episodic_memory_ms: 0, ddx_ms: 0, hypothesis_testing_ms: 0, evidence_ms: 0, bayesian_ms: 0, evidence_planning_ms: 0, causal_reasoning_ms: 0, conflict_resolution_ms: 0, safety_ms: 0, uncertainty_ms: 0, soap_ms: 0, diagnostic_loop_ms: 0, total_ms: 0 };
    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty, difficulty: bc.difficulty, tags: bc.tags,
      top1_match: false, top3_match: false, top5_match: false,
      diagnosis_match_rate: 0, lab_match_rate: 0, medication_match_rate: 0, gold_standard_rank: null,
      matched_diagnoses: [], actual_diagnoses: [], actual_labs: [], actual_medications: [],
      diagnostic_loop: { iterations_executed: 0, hypothesis_changes: 0, probability_updates: 0, convergence_status: "not_triggered", improved_ranking: false, weak_pruned: 0 },
      hypothesis: { total_tested: 0, support_scores: [], contradiction_scores: [], pruning_rate: 0, boosted_correct: false, removed_unsupported: 0, entropy_reduction: 0 },
      evidence_plan: { tests_recommended: [], test_selection_accuracy: 0, test_relevance_score: 0, information_gain_score: 0 },
      bayesian: { posterior_accuracy: 0, confidence_calibration: 0, entropy_reduction: 0, correct_gained_probability: false, incorrect_lost_probability: false },
      safety: { dangerous_detected: false, expected_dangerous: bc.ground_truth.danger_flag, safety_score: 0, critical_alerts: 0, false_negative: bc.ground_truth.danger_flag, safety_engine_activated: false },
      latency: emptyLat, reasoning_trace_completeness: 0, graph_symptom_matches: 0, graph_miss: true,
      confidence_score: 0, confidence_label: "Error", guideline_sources: [],
      failure_reasons: [`Pipeline error: ${error}`], failure_root_cause: "timeout_error",
      pipeline_output: null, o1_result: null, passed: false,
    };
  }
}

// ── Suite Runner ──

export async function runBenchmarkV6(
  onProgress?: (caseIndex: number, total: number, caseName: string) => void,
  caseFilter?: (c: BenchmarkCaseV6) => boolean,
): Promise<BenchmarkSuiteResultV6> {
  const runId = `v6-${Date.now()}`;
  const cases = caseFilter ? BENCHMARK_CASES_V6.filter(caseFilter) : BENCHMARK_CASES_V6;
  const results: CaseResultV6[] = [];

  for (let i = 0; i < cases.length; i++) {
    onProgress?.(i, cases.length, cases[i].name);
    results.push(await runCase(cases[i]));
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Specialty breakdown
  const specialties = [...new Set(cases.map(c => c.specialty))];
  const bySpecialty: SpecialtyBreakdown[] = specialties.map(s => {
    const sc = results.filter(r => r.specialty === s);
    const dangerCases = sc.filter(r => r.safety.expected_dangerous);
    return {
      specialty: s, total_cases: sc.length, passed: sc.filter(r => r.passed).length,
      avg_diagnosis_match: avg(sc.map(r => r.diagnosis_match_rate)),
      avg_lab_match: avg(sc.map(r => r.lab_match_rate)),
      avg_latency_ms: avg(sc.map(r => r.latency.total_ms)),
      top1_accuracy: sc.filter(r => r.top1_match).length / sc.length,
      top3_accuracy: sc.filter(r => r.top3_match).length / sc.length,
      top5_accuracy: sc.filter(r => r.top5_match).length / sc.length,
      danger_detection_rate: dangerCases.length ? dangerCases.filter(r => r.safety.dangerous_detected).length / dangerCases.length : 1,
    };
  });

  // Difficulty breakdown
  const difficulties: CaseDifficulty[] = ["common", "moderate", "complex", "rare"];
  const byDifficulty: DifficultyBreakdown[] = difficulties.map(d => {
    const dc = results.filter(r => r.difficulty === d);
    return {
      difficulty: d, total_cases: dc.length, passed: dc.filter(r => r.passed).length,
      avg_diagnosis_match: avg(dc.map(r => r.diagnosis_match_rate)),
      top1_accuracy: dc.length ? dc.filter(r => r.top1_match).length / dc.length : 0,
      top3_accuracy: dc.length ? dc.filter(r => r.top3_match).length / dc.length : 0,
    };
  });

  // Latency stats
  const allLatencies = results.map(r => r.latency.total_ms).filter(l => l > 0);
  const latencyStats: LatencyStatistics = {
    avg_total_ms: avg(allLatencies),
    p50_ms: percentile(allLatencies, 50),
    p95_ms: percentile(allLatencies, 95),
    p99_ms: percentile(allLatencies, 99),
    avg_per_stage: {
      pcie: avg(results.map(r => r.latency.pcie_ms)),
      world_model: avg(results.map(r => r.latency.world_model_ms)),
      ddx: avg(results.map(r => r.latency.ddx_ms)),
      bayesian: avg(results.map(r => r.latency.bayesian_ms)),
      evidence: avg(results.map(r => r.latency.evidence_ms)),
      safety: avg(results.map(r => r.latency.safety_ms)),
      soap: avg(results.map(r => r.latency.soap_ms)),
    },
    cases_under_5s: allLatencies.filter(l => l < 5000).length,
    cases_under_5s_pct: allLatencies.length ? allLatencies.filter(l => l < 5000).length / allLatencies.length : 0,
  };

  // Failure analysis
  const failedCases = results.filter(r => !r.passed);
  const byRootCause: Record<FailureRootCause, number> = {
    knowledge_graph_gap: 0, symptom_mapping_gap: 0, physiology_inference_error: 0,
    bayesian_probability_error: 0, evidence_retrieval_failure: 0, safety_engine_failure: 0,
    hypothesis_testing_failure: 0, diagnostic_loop_divergence: 0, timeout_error: 0, unknown: 0,
  };
  for (const f of failedCases) {
    byRootCause[f.failure_root_cause || "unknown"]++;
  }
  const failBySpec: Record<string, number> = {};
  const failByDiff: Record<string, number> = {};
  for (const f of failedCases) {
    failBySpec[f.specialty] = (failBySpec[f.specialty] || 0) + 1;
    failByDiff[f.difficulty] = (failByDiff[f.difficulty] || 0) + 1;
  }

  const failureAnalysis: FailureAnalysis = {
    total_failures: failedCases.length,
    by_root_cause: byRootCause,
    by_specialty: failBySpec as Record<Specialty, number>,
    by_difficulty: failByDiff as Record<CaseDifficulty, number>,
    critical_misses: results.filter(r => r.safety.false_negative).map(r => ({
      case_id: r.case_id, case_name: r.case_name,
      expected: cases.find(c => c.id === r.case_id)?.ground_truth.gold_standard_diagnosis || "",
      actual: r.actual_diagnoses.slice(0, 3),
      root_cause: r.failure_root_cause || "unknown",
    })),
  };

  // KG gaps
  const kgGaps: KnowledgeGraphGap[] = [];
  const graphMissCases = results.filter(r => r.graph_miss);
  if (graphMissCases.length > results.length * 0.2) {
    kgGaps.push({
      category: "General", gap_type: "symptom_diagnosis",
      description: `${graphMissCases.length}/${results.length} cases had graph misses`,
      affected_cases: graphMissCases.map(c => c.case_id),
      priority: "critical",
    });
  }
  // Group graph misses by specialty
  for (const s of specialties) {
    const specMisses = graphMissCases.filter(r => r.specialty === s);
    if (specMisses.length >= 3) {
      kgGaps.push({
        category: s, gap_type: "symptom_diagnosis",
        description: `${specMisses.length} graph misses in ${s}`,
        affected_cases: specMisses.map(c => c.case_id),
        priority: specMisses.length >= 10 ? "high" : "medium",
      });
    }
  }

  // Recommendations
  const recommendations: string[] = [];
  const dangerAll = results.filter(r => r.safety.expected_dangerous);
  const dangerRate = dangerAll.length ? dangerAll.filter(r => r.safety.dangerous_detected).length / dangerAll.length : 1;
  if (dangerRate < 0.95) recommendations.push(`⚠ Dangerous diagnosis detection at ${(dangerRate * 100).toFixed(0)}% — target ≥95%. Expand must-not-miss trigger symptoms.`);
  const top1 = results.filter(r => r.top1_match).length / results.length;
  const top3 = results.filter(r => r.top3_match).length / results.length;
  if (top1 < 0.65) recommendations.push(`Dx Top-1 accuracy at ${(top1 * 100).toFixed(0)}% — target ≥65%. Expand knowledge graph coverage.`);
  if (top3 < 0.85) recommendations.push(`Dx Top-3 accuracy at ${(top3 * 100).toFixed(0)}% — target ≥85%.`);
  if (latencyStats.p95_ms > 5000) recommendations.push(`P95 latency ${(latencyStats.p95_ms / 1000).toFixed(1)}s exceeds 5s target.`);
  if (graphMissCases.length > results.length * 0.3) recommendations.push(`${graphMissCases.length} graph misses — prioritize KG expansion.`);

  return {
    run_id: runId, run_timestamp: new Date().toISOString(), version: "v6",
    suite_name: "Full Clinical Reasoning Benchmark Suite",
    total_cases: results.length, passed_cases: results.filter(r => r.passed).length,
    pass_rate: results.filter(r => r.passed).length / results.length,
    top1_accuracy: top1, top3_accuracy: top3,
    top5_accuracy: results.filter(r => r.top5_match).length / results.length,
    avg_diagnosis_match: avg(results.map(r => r.diagnosis_match_rate)),
    avg_lab_match: avg(results.map(r => r.lab_match_rate)),
    avg_medication_match: avg(results.map(r => r.medication_match_rate)),
    danger_detection_rate: dangerRate,
    danger_false_negative_rate: dangerAll.length ? dangerAll.filter(r => r.safety.false_negative).length / dangerAll.length : 0,
    safety_activation_rate: results.filter(r => r.safety.safety_engine_activated).length / results.length,
    avg_confidence_score: avg(results.map(r => r.confidence_score)),
    confidence_calibration_score: 0,
    avg_reasoning_completeness: avg(results.map(r => r.reasoning_trace_completeness)),
    diagnostic_convergence_rate: results.filter(r => r.diagnostic_loop.convergence_status === "converged").length / results.length,
    hypothesis_pruning_rate: avg(results.map(r => r.hypothesis.pruning_rate)),
    evidence_plan_accuracy: avg(results.map(r => r.evidence_plan.test_selection_accuracy)),
    latency: latencyStats, by_specialty: bySpecialty, by_difficulty: byDifficulty,
    failure_analysis: failureAnalysis, knowledge_gaps: kgGaps, recommendations, cases: results,
  };
}
