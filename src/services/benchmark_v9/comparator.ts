/**
 * Benchmark v9 — Phase 8 vs Phase 9 Comparator
 *
 * Generates normalized comparison reports between baseline (Phase 8)
 * and experimental (Phase 9) benchmark runs.
 */

import type {
  BenchmarkSuiteResult, BenchmarkResult,
  ScenarioDiff, PhaseComparisonReport,
} from "./types";

function diagMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return na === nb || na.includes(nb) || nb.includes(na);
}

function extractSuiteMetrics(suite: BenchmarkSuiteResult) {
  const { results, failure_summary, ...metrics } = suite;
  return metrics;
}

function buildScenarioDiff(p8: BenchmarkResult, p9: BenchmarkResult): ScenarioDiff {
  const p8Top1 = p8.final_ranking.ranking[0]?.diagnosis ?? null;
  const p9Top1 = p9.final_ranking.ranking[0]?.diagnosis ?? null;
  const top1Changed = p8Top1 !== p9Top1;

  const p8GoldRank = p8.final_ranking.gold_rank;
  const p9GoldRank = p9.final_ranking.gold_rank;

  const rankingImproved = p9GoldRank !== null && (p8GoldRank === null || p9GoldRank < p8GoldRank);
  const rankingDegraded = p8GoldRank !== null && (p9GoldRank === null || p9GoldRank > p8GoldRank);

  const safetyChanged = p8.metrics.safety_correct !== p9.metrics.safety_correct;

  // A change is acceptable if: no ranking degradation AND no safety loss
  const acceptable = !rankingDegraded && !(p8.metrics.safety_correct && !p9.metrics.safety_correct);

  let reason = "No change";
  if (rankingImproved) reason = `Ranking improved: #${p8GoldRank ?? "∅"} → #${p9GoldRank}`;
  else if (rankingDegraded) reason = `REGRESSION: #${p8GoldRank} → #${p9GoldRank ?? "∅"}`;
  else if (safetyChanged && !p9.metrics.safety_correct) reason = "Safety coverage lost";
  else if (safetyChanged && p9.metrics.safety_correct) reason = "Safety improved";
  else if (top1Changed) reason = `Top-1 changed: ${p8Top1} → ${p9Top1}`;

  return {
    scenario_id: p8.scenario_id,
    scenario_name: p8.scenario_name,
    phase8_top1: p8Top1,
    phase9_top1: p9Top1,
    top1_changed: top1Changed,
    phase8_gold_rank: p8GoldRank,
    phase9_gold_rank: p9GoldRank,
    ranking_improved: rankingImproved,
    ranking_degraded: rankingDegraded,
    phase8_safety_correct: p8.metrics.safety_correct,
    phase9_safety_correct: p9.metrics.safety_correct,
    safety_changed: safetyChanged,
    acceptable,
    reason,
  };
}

export function comparePhases(
  phase8: BenchmarkSuiteResult,
  phase9: BenchmarkSuiteResult,
): PhaseComparisonReport {
  const scenarioDiffs: ScenarioDiff[] = [];

  for (const p8Result of phase8.results) {
    const p9Result = phase9.results.find(r => r.scenario_id === p8Result.scenario_id);
    if (!p9Result) continue;
    scenarioDiffs.push(buildScenarioDiff(p8Result, p9Result));
  }

  const regressions = scenarioDiffs.filter(d => d.ranking_degraded || (d.safety_changed && !d.phase9_safety_correct));
  const improvements = scenarioDiffs.filter(d => d.ranking_improved || (d.safety_changed && d.phase9_safety_correct));

  const deltas = {
    top1_delta: phase9.top1_accuracy - phase8.top1_accuracy,
    top3_delta: phase9.top3_accuracy - phase8.top3_accuracy,
    top5_delta: phase9.top5_accuracy - phase8.top5_accuracy,
    recall_delta: phase9.candidate_recall - phase8.candidate_recall,
    safety_sensitivity_delta: phase9.safety_sensitivity - phase8.safety_sensitivity,
    safety_specificity_delta: phase9.safety_specificity - phase8.safety_specificity,
  };

  const verdictReasons: string[] = [];
  let verdict: "READY" | "NOT_READY" = "READY";

  if (deltas.top1_delta < 0) { verdict = "NOT_READY"; verdictReasons.push(`Top-1 regression: ${deltas.top1_delta}pp`); }
  if (deltas.top3_delta < 0) { verdict = "NOT_READY"; verdictReasons.push(`Top-3 regression: ${deltas.top3_delta}pp`); }
  if (deltas.recall_delta < 0) { verdict = "NOT_READY"; verdictReasons.push(`Recall regression: ${deltas.recall_delta}pp`); }
  if (deltas.safety_sensitivity_delta < 0) { verdict = "NOT_READY"; verdictReasons.push(`Safety sensitivity regression: ${deltas.safety_sensitivity_delta}pp`); }
  if (regressions.length > 0) { verdictReasons.push(`${regressions.length} scenario(s) regressed`); }
  if (verdict === "READY") { verdictReasons.push("All invariants hold — safe to proceed"); }

  return {
    timestamp: new Date().toISOString(),
    phase8_metrics: extractSuiteMetrics(phase8),
    phase9_metrics: extractSuiteMetrics(phase9),
    deltas,
    scenario_diffs: scenarioDiffs,
    regressions,
    improvements,
    verdict,
    verdict_reasons: verdictReasons,
  };
}
