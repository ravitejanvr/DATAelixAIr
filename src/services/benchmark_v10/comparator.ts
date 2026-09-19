/**
 * Benchmark v10 — Run Comparator
 *
 * Compares two suite runs (e.g. forced V1 vs forced V3 — see engine_registry.ts).
 * Produces structured comparison summary with per-layer deltas,
 * regressions, improvements, and a verdict.
 *
 * NOTE: this file previously exported compareV10ThreeWay() for a
 * "Phase 8 vs Phase 9 vs Phase 10" comparison. That concept was removed
 * 2026-09-19 — the phase8/9/10 mode parameter it compared stopped reaching
 * the pipeline after the 2026-03-25 orchestrator-alignment refactor
 * (c1012944), so every such comparison was silently comparing identical
 * configs. See CLAUDE.md's "config-driven comparison must assert actual
 * divergence" rule before adding anything like it back.
 */

import type {
  SuiteRunResult, BenchmarkLayer, CaseResult,
  SuiteComparison, BenchmarkCaseV10,
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

// ── Organ-System Breakdown ──
// Per CLAUDE.md's post-mortem rule: this groups by organ_system rather than
// by a mode/phase label, since ground truth here is the case data itself
// (BenchmarkCaseV10.organ_system), not a parameter that has to be trusted
// to have actually changed anything.

export interface OrganSystemMetric {
  organ_system: string;
  n: number;
  top1_accuracy: number;
  top3_accuracy: number;
  candidate_recall: number;
  safety_sensitivity: number;
}

export function computeOrganSystemMetrics(
  results: CaseResult[],
  cases: BenchmarkCaseV10[],
): OrganSystemMetric[] {
  const organById = new Map(cases.map(c => [c.case_id, c.organ_system]));
  const byOrgan = new Map<string, CaseResult[]>();
  for (const r of results) {
    const organ = organById.get(r.case_id) ?? "unknown";
    if (!byOrgan.has(organ)) byOrgan.set(organ, []);
    byOrgan.get(organ)!.push(r);
  }

  const out: OrganSystemMetric[] = [];
  for (const [organ_system, rs] of byOrgan) {
    const n = rs.length;
    const top1 = rs.filter(r => r.top1_match).length;
    const top3 = rs.filter(r => r.top3_match).length;
    const recall = rs.filter(r => r.candidate_recall).length;
    const safetyCases = rs.filter(r => r.safety_expected);
    const safetyOk = safetyCases.filter(r => r.safety_correct).length;

    out.push({
      organ_system,
      n,
      top1_accuracy: Math.round((top1 / n) * 100),
      top3_accuracy: Math.round((top3 / n) * 100),
      candidate_recall: Math.round((recall / n) * 100),
      safety_sensitivity: safetyCases.length > 0 ? Math.round((safetyOk / safetyCases.length) * 100) : 100,
    });
  }

  return out.sort((a, b) => a.organ_system.localeCompare(b.organ_system));
}

/** Pair up two engines' per-organ-system metrics for a side-by-side table. */
export function diffOrganSystemMetrics(
  a: OrganSystemMetric[],
  b: OrganSystemMetric[],
): Array<{ organ_system: string; n: number; a: OrganSystemMetric; b: OrganSystemMetric; top1_delta: number }> {
  const bBySystem = new Map(b.map(m => [m.organ_system, m]));
  return a
    .map(am => {
      const bm = bBySystem.get(am.organ_system);
      if (!bm) return null;
      return { organ_system: am.organ_system, n: am.n, a: am, b: bm, top1_delta: bm.top1_accuracy - am.top1_accuracy };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
