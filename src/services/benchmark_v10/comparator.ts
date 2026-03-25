/**
 * Benchmark v10 — Phase Comparator
 *
 * Compares Phase 8 vs Phase 9 vs Phase 10 results from v10 suite runs.
 * Produces structured comparison summary with per-layer deltas,
 * regressions, improvements, and a verdict.
 */

import type {
  SuiteRunResult, BenchmarkLayer, CaseResult,
  SuiteComparison,
} from "./types";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function diagMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

interface MetricDeltas {
  top1_accuracy: number;
  top3_accuracy: number;
  top5_accuracy: number;
  candidate_recall: number;
  safety_sensitivity: number;
  safety_specificity: number;
  alert_precision: number;
  alert_recall: number;
  clinical_acceptability_score: number;
  avg_latency_ms: number;
}

function computeDeltas(
  a: SuiteRunResult["aggregate_metrics"],
  b: SuiteRunResult["aggregate_metrics"],
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const key of Object.keys(a) as Array<keyof typeof a>) {
    deltas[key] = (b[key] as number) - (a[key] as number);
  }
  return deltas;
}

function computeLayerDeltas(
  aLayers: SuiteRunResult["layer_metrics"],
  bLayers: SuiteRunResult["layer_metrics"],
): Array<{ layer: BenchmarkLayer; deltas: Record<string, number> }> {
  const result: Array<{ layer: BenchmarkLayer; deltas: Record<string, number> }> = [];

  for (const aLayer of aLayers) {
    const bLayer = bLayers.find(l => l.layer === aLayer.layer);
    if (!bLayer) continue;

    const deltas: Record<string, number> = {};
    const keys: Array<keyof typeof aLayer> = [
      "top1_accuracy", "top3_accuracy", "top5_accuracy", "candidate_recall",
      "safety_sensitivity", "safety_specificity", "alert_precision", "alert_recall",
      "clinical_acceptability_score", "noise_robustness_score",
      "ambiguity_resolution_score", "ranking_stability_score",
    ];

    for (const key of keys) {
      const aVal = aLayer[key] as number;
      const bVal = bLayer[key] as number;
      deltas[key] = bVal - aVal;
    }

    result.push({ layer: aLayer.layer, deltas });
  }

  return result;
}

function findRegressions(
  aResults: CaseResult[],
  bResults: CaseResult[],
): Array<{ case_id: string; name: string; reason: string }> {
  const regressions: Array<{ case_id: string; name: string; reason: string }> = [];

  for (const aCase of aResults) {
    const bCase = bResults.find(r => r.case_id === aCase.case_id);
    if (!bCase) continue;

    // Top-1 regression
    if (aCase.top1_match && !bCase.top1_match) {
      regressions.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: `Top-1 lost: was "${aCase.predicted_top5[0]?.diagnosis}", now "${bCase.predicted_top5[0]?.diagnosis || "N/A"}"`,
      });
    }

    // Recall regression
    if (aCase.candidate_recall && !bCase.candidate_recall) {
      regressions.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: "Gold diagnosis lost from candidate set",
      });
    }

    // Safety regression
    if (aCase.safety_correct && !bCase.safety_correct) {
      regressions.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: "Safety detection lost",
      });
    }

    // Rank degradation (gold moved down)
    if (aCase.gold_rank !== null && bCase.gold_rank !== null && bCase.gold_rank > aCase.gold_rank) {
      regressions.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: `Gold rank degraded: #${aCase.gold_rank} → #${bCase.gold_rank}`,
      });
    }
  }

  return regressions;
}

function findImprovements(
  aResults: CaseResult[],
  bResults: CaseResult[],
): Array<{ case_id: string; name: string; reason: string }> {
  const improvements: Array<{ case_id: string; name: string; reason: string }> = [];

  for (const aCase of aResults) {
    const bCase = bResults.find(r => r.case_id === aCase.case_id);
    if (!bCase) continue;

    if (!aCase.top1_match && bCase.top1_match) {
      improvements.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: `Top-1 gained: now "${bCase.predicted_top5[0]?.diagnosis}"`,
      });
    }

    if (!aCase.candidate_recall && bCase.candidate_recall) {
      improvements.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: "Gold diagnosis now in candidate set",
      });
    }

    if (!aCase.safety_correct && bCase.safety_correct) {
      improvements.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: "Safety detection restored",
      });
    }

    if (aCase.gold_rank !== null && bCase.gold_rank !== null && bCase.gold_rank < aCase.gold_rank) {
      improvements.push({
        case_id: aCase.case_id,
        name: aCase.name,
        reason: `Gold rank improved: #${aCase.gold_rank} → #${bCase.gold_rank}`,
      });
    }
  }

  return improvements;
}

export function compareV10Runs(
  phase8Run: SuiteRunResult,
  phase9Run: SuiteRunResult,
): SuiteComparison {
  const metric_deltas = computeDeltas(phase8Run.aggregate_metrics, phase9Run.aggregate_metrics);
  const per_layer_deltas = computeLayerDeltas(phase8Run.layer_metrics, phase9Run.layer_metrics);
  const regressions = findRegressions(phase8Run.results, phase9Run.results);
  const improvements = findImprovements(phase8Run.results, phase9Run.results);

  // Verdict
  const verdictReasons: string[] = [];
  let verdict: "SAFE" | "UNSAFE" | "REVIEW" = "SAFE";

  if (metric_deltas.top1_accuracy < 0) {
    verdict = "UNSAFE";
    verdictReasons.push(`Top-1 accuracy dropped by ${Math.abs(metric_deltas.top1_accuracy)}pp`);
  }
  if (metric_deltas.top3_accuracy < 0) {
    verdict = "UNSAFE";
    verdictReasons.push(`Top-3 accuracy dropped by ${Math.abs(metric_deltas.top3_accuracy)}pp`);
  }
  if (metric_deltas.candidate_recall < 0) {
    verdict = "UNSAFE";
    verdictReasons.push(`Candidate recall dropped by ${Math.abs(metric_deltas.candidate_recall)}pp`);
  }
  if (metric_deltas.safety_sensitivity < 0) {
    verdict = "UNSAFE";
    verdictReasons.push(`Safety sensitivity dropped by ${Math.abs(metric_deltas.safety_sensitivity)}pp`);
  }
  if (metric_deltas.safety_specificity < -5) {
    if (verdict !== "UNSAFE") verdict = "REVIEW";
    verdictReasons.push(`Safety specificity dropped by ${Math.abs(metric_deltas.safety_specificity)}pp (>5pp threshold)`);
  }
  if (regressions.length > 0) {
    if (verdict === "SAFE") verdict = "REVIEW";
    verdictReasons.push(`${regressions.length} per-case regression(s) detected`);
  }

  if (verdict === "SAFE") {
    verdictReasons.push("All invariants hold — Phase 9 is safe on v10 dataset");
    if (improvements.length > 0) {
      verdictReasons.push(`${improvements.length} improvement(s) detected`);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    run_a: { run_id: phase8Run.run_id, phase: phase8Run.pipeline_phase, version: phase8Run.benchmark_version },
    run_b: { run_id: phase9Run.run_id, phase: phase9Run.pipeline_phase, version: phase9Run.benchmark_version },
    metric_deltas,
    per_layer_deltas,
    regressions,
    improvements,
    verdict,
    verdict_reasons: verdictReasons,
  };
}
