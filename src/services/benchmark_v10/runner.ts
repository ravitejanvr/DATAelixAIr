/**
 * Benchmark v10 — Multi-Layer Runner (Orchestrator-Aligned)
 *
 * Executes all v10 cases through the PRODUCTION orchestrator pipeline,
 * ensuring benchmarks exercise the same code path as real consultations:
 *
 *   Case → ClinicalContext → runUnifiedClinicalPipeline → PipelineResult → Metrics
 *
 * Supports dual-mode execution: phase8 (legacy) and phase9 (decoupled safety).
 * Results are persisted to benchmark_suite_runs / benchmark_suite_results tables.
 */

import { ALL_NEW_CASES } from "./index";
import type {
  BenchmarkCaseV10, BenchmarkLayer, CaseResult,
  LayerMetrics, SuiteRunResult,
} from "./types";
import { runUnifiedClinicalPipeline, type PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import { runBenchmarkPipeline } from "@/services/clinical_pipeline/benchmark_mode";
import { v10CaseToPipelineInput } from "@/services/benchmark_shared/case_to_context";
import { diagMatch } from "@/services/benchmark_shared/diagnosis_matching";
import { supabase } from "@/integrations/supabase/client";

// ── Run single v10 case through orchestrator ──

export type V10PipelineMode = "phase8" | "phase9" | "phase10";

async function runSingleV10Case(
  c: BenchmarkCaseV10,
  mode: V10PipelineMode,
): Promise<CaseResult> {
  const t0 = performance.now();
  const failures: string[] = [];

  // Convert case → canonical PipelineInput
  const pipelineInput = v10CaseToPipelineInput(c);

  // Run through PRODUCTION orchestrator
  let pipelineResult: PipelineResult | null = null;
  try {
    pipelineResult = await runUnifiedClinicalPipeline(pipelineInput);
  } catch (e) {
    failures.push(`Pipeline error: ${e}`);
  }

  const latency_ms = Math.round(performance.now() - t0);

  // Extract DDX results from pipeline output
  const ddxResult = pipelineResult?.ddx ?? null;

  // Extract top 5 predictions
  const predicted_top5: Array<{ diagnosis: string; probability: number }> = [];
  if (ddxResult?.differential_diagnoses) {
    for (const d of ddxResult.differential_diagnoses.slice(0, 5)) {
      predicted_top5.push({
        diagnosis: (d.diagnosis_name || "").trim(),
        probability: d.probability || 0,
      });
    }
  }

  // Gold standard matching
  const goldRankIdx = predicted_top5.findIndex(p =>
    diagMatch(p.diagnosis, c.ground_truth.primary)
  );
  const gold_rank = goldRankIdx >= 0 ? goldRankIdx + 1 : null;
  const top1_match = goldRankIdx === 0;
  const top3_match = goldRankIdx >= 0 && goldRankIdx < 3;
  const top5_match = goldRankIdx >= 0 && goldRankIdx < 5;

  // Candidate recall: gold in full candidate set
  const allCandidates = ddxResult?.differential_diagnoses || [];
  const candidate_recall = allCandidates.some(d =>
    diagMatch((d.diagnosis_name || "").trim(), c.ground_truth.primary)
  );

  // Safety alerts extraction
  const safety_alerts: Array<{ condition: string; severity: string; source: string }> = [];
  let safety_triggered = false;

  // From DDX safety_alerts channel
  if (ddxResult?.safety_alerts) {
    for (const alert of ddxResult.safety_alerts) {
      if (alert.diagnosis_name) {
        safety_alerts.push({
          condition: alert.diagnosis_name.trim(),
          severity: alert.severity_level || "high",
          source: "ddx_safety_alerts",
        });
      }
    }
  }

  // From dangerous_diagnoses (legacy channel)
  if (ddxResult?.dangerous_diagnoses) {
    for (const d of ddxResult.dangerous_diagnoses) {
      const name = typeof d === "string" ? d : (d.diagnosis_name || "");
      if (name) {
        safety_alerts.push({
          condition: name.trim(),
          severity: (d as any).severity_level || "high",
          source: "dangerous_diagnoses",
        });
      }
    }
  }

  // From must_not_miss in ranking
  for (const d of allCandidates) {
    if (d.must_not_miss) {
      const alreadyTracked = safety_alerts.some(a =>
        diagMatch(a.condition, (d.diagnosis_name || "").trim())
      );
      if (!alreadyTracked) {
        safety_alerts.push({
          condition: (d.diagnosis_name || "").trim(),
          severity: "high",
          source: "ranking_must_not_miss",
        });
      }
    }
  }

  // From oversight engine (production safety layer)
  if (pipelineResult?.oversight?.events) {
    for (const ev of pipelineResult.oversight.events) {
      if (ev.event_type === "dangerous_diagnosis_injected" || ev.severity === "critical") {
        const condition = (ev as any).metadata?.diagnosis_name || ev.message || "";
        if (condition && !safety_alerts.some(a => diagMatch(a.condition, condition))) {
          safety_alerts.push({
            condition,
            severity: ev.severity || "high",
            source: "oversight_engine",
          });
        }
      }
    }
  }

  safety_triggered = safety_alerts.length > 0;

  // Safety correctness
  let safety_correct: boolean;
  if (c.evaluation.safety_expected) {
    const mustNotMiss = c.ground_truth.must_not_miss;
    const detected = mustNotMiss.some(mnm =>
      safety_alerts.some(a => diagMatch(a.condition, mnm)) ||
      allCandidates.some(d => diagMatch((d.diagnosis_name || "").trim(), mnm))
    );
    safety_correct = detected;
    if (!detected) {
      failures.push(`Must-not-miss not detected: ${mustNotMiss.join(", ")}`);
    }
  } else {
    safety_correct = true;
  }

  // Clinical acceptability score (0-1)
  let clinical_acceptability = 0;
  if (top1_match) clinical_acceptability = 1.0;
  else if (top3_match) clinical_acceptability = 0.8;
  else if (top5_match) clinical_acceptability = 0.6;
  else if (candidate_recall) clinical_acceptability = 0.3;

  // Check acceptable alternatives
  if (!top1_match && predicted_top5.length > 0) {
    const topDiag = predicted_top5[0].diagnosis;
    const isAcceptable = c.ground_truth.acceptable_alternatives.some(alt =>
      diagMatch(topDiag, alt)
    );
    if (isAcceptable) {
      clinical_acceptability = Math.max(clinical_acceptability, 0.7);
    }
  }

  if (!candidate_recall) {
    failures.push(`Gold diagnosis "${c.ground_truth.primary}" not in candidate set`);
  }

  return {
    case_id: c.case_id,
    layer: c.layer,
    name: c.name,
    predicted_top5,
    gold_rank,
    top1_match,
    top3_match,
    top5_match,
    candidate_recall,
    safety_triggered,
    safety_alerts,
    safety_expected: c.evaluation.safety_expected,
    safety_correct,
    clinical_acceptability,
    latency_ms,
    failure_reasons: failures,
  };
}

// ── Compute layer-level metrics ──

function computeLayerMetrics(results: CaseResult[], layer: BenchmarkLayer): LayerMetrics {
  const layerResults = results.filter(r => r.layer === layer);
  const n = layerResults.length;
  if (n === 0) {
    return {
      layer, total_cases: 0,
      top1_accuracy: 0, top3_accuracy: 0, top5_accuracy: 0, candidate_recall: 0,
      safety_sensitivity: 0, safety_specificity: 0,
      alert_precision: 0, alert_recall: 0,
      clinical_acceptability_score: 0, noise_robustness_score: 0,
      ambiguity_resolution_score: 0, ranking_stability_score: 0,
      avg_latency_ms: 0, max_latency_ms: 0,
    };
  }

  const top1 = layerResults.filter(r => r.top1_match).length;
  const top3 = layerResults.filter(r => r.top3_match).length;
  const top5 = layerResults.filter(r => r.top5_match).length;
  const recall = layerResults.filter(r => r.candidate_recall).length;

  const safetyCases = layerResults.filter(r => r.safety_expected);
  const noSafetyCases = layerResults.filter(r => !r.safety_expected);
  const tp = safetyCases.filter(r => r.safety_triggered).length;
  const tn = noSafetyCases.filter(r => !r.safety_triggered).length;

  const sensitivity = safetyCases.length > 0 ? Math.round((tp / safetyCases.length) * 100) : 100;
  const specificity = noSafetyCases.length > 0 ? Math.round((tn / noSafetyCases.length) * 100) : 100;

  const alertCases = layerResults.filter(r => r.safety_alerts.length > 0);
  const alertTP = alertCases.filter(r => r.safety_expected).length;
  const alertPrecision = alertCases.length > 0 ? Math.round((alertTP / alertCases.length) * 100) : 100;
  const alertRecall = safetyCases.length > 0
    ? Math.round((safetyCases.filter(r => r.safety_correct).length / safetyCases.length) * 100) : 100;

  const latencies = layerResults.map(r => r.latency_ms);
  const cas = layerResults.reduce((sum, r) => sum + r.clinical_acceptability, 0) / n;

  const noiseRobustness = layer === "noisy" ? Math.round((top3 / n) * 100) : Math.round((top1 / n) * 100);
  const ambiguityResolution = layer === "ambiguous" ? Math.round((top3 / n) * 100) : Math.round((top1 / n) * 100);
  const rankingStability = Math.round((top5 / n) * 100);

  return {
    layer,
    total_cases: n,
    top1_accuracy: Math.round((top1 / n) * 100),
    top3_accuracy: Math.round((top3 / n) * 100),
    top5_accuracy: Math.round((top5 / n) * 100),
    candidate_recall: Math.round((recall / n) * 100),
    safety_sensitivity: sensitivity,
    safety_specificity: specificity,
    alert_precision: alertPrecision,
    alert_recall: alertRecall,
    clinical_acceptability_score: Math.round(cas * 100),
    noise_robustness_score: noiseRobustness,
    ambiguity_resolution_score: ambiguityResolution,
    ranking_stability_score: rankingStability,
    avg_latency_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / n),
    max_latency_ms: Math.max(...latencies),
  };
}

// ── Persist results to database ──

async function persistRun(runResult: SuiteRunResult): Promise<void> {
  const { error: runError } = await supabase.from("benchmark_suite_runs").insert({
    run_id: runResult.run_id,
    benchmark_version: runResult.benchmark_version,
    pipeline_phase: runResult.pipeline_phase,
    pipeline_mode: runResult.pipeline_phase.includes("10") ? "phase10" : runResult.pipeline_phase.includes("9") ? "phase9" : "phase8",
    total_cases: runResult.total_cases,
    passed: runResult.passed,
    failed: runResult.failed,
    metrics_summary: runResult.aggregate_metrics as any,
    layer_metrics: runResult.layer_metrics as any,
    regression_count: 0,
    improvement_count: 0,
    locked: true,
  } as any);

  if (runError) {
    console.error("[BenchmarkV10] Failed to persist run:", runError);
    return;
  }

  const batchSize = 20;
  for (let i = 0; i < runResult.results.length; i += batchSize) {
    const batch = runResult.results.slice(i, i + batchSize).map(r => ({
      run_id: runResult.run_id,
      case_id: r.case_id,
      layer: r.layer,
      case_name: r.name,
      predicted_top5: r.predicted_top5 as any,
      gold_rank: r.gold_rank,
      top1_match: r.top1_match,
      top3_match: r.top3_match,
      top5_match: r.top5_match,
      candidate_recall: r.candidate_recall,
      safety_triggered: r.safety_triggered,
      safety_expected: r.safety_expected,
      safety_correct: r.safety_correct,
      safety_alerts: r.safety_alerts as any,
      clinical_acceptability: r.clinical_acceptability,
      latency_ms: r.latency_ms,
      failure_reasons: r.failure_reasons,
      score_breakdown: {} as any,
    }));

    const { error } = await supabase.from("benchmark_suite_results").insert(batch as any);
    if (error) {
      console.error(`[BenchmarkV10] Failed to persist results batch ${i}:`, error);
    }
  }
}

// ── Main runner ──

export interface V10RunProgress {
  case_name: string;
  index: number;
  total: number;
  layer: BenchmarkLayer;
}

export async function runV10Suite(
  mode: V10PipelineMode,
  onProgress?: (progress: V10RunProgress) => void,
  options?: {
    batchSize?: number;
    batchDelayMs?: number;
    caseDelayMs?: number;
  },
): Promise<SuiteRunResult> {
  const cases = ALL_NEW_CASES;
  const results: CaseResult[] = [];
  const batchSize = options?.batchSize ?? 5;
  const batchDelay = options?.batchDelayMs ?? 3000;
  const caseDelay = options?.caseDelayMs ?? 500;

  const runId = `v10_${mode}_${Date.now()}`;
  const timestamp = new Date().toISOString();

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    onProgress?.({ case_name: c.name, index: i, total: cases.length, layer: c.layer });

    try {
      const result = await runSingleV10Case(c, mode);
      results.push(result);
    } catch (e) {
      console.error(`[BenchmarkV10] Case ${c.case_id} crashed:`, e);
      results.push({
        case_id: c.case_id,
        layer: c.layer,
        name: c.name,
        predicted_top5: [],
        gold_rank: null,
        top1_match: false,
        top3_match: false,
        top5_match: false,
        candidate_recall: false,
        safety_triggered: false,
        safety_alerts: [],
        safety_expected: c.evaluation.safety_expected,
        safety_correct: false,
        clinical_acceptability: 0,
        latency_ms: 0,
        failure_reasons: [`Pipeline crash: ${e}`],
      });
    }

    if (caseDelay > 0 && i < cases.length - 1) {
      await new Promise(r => setTimeout(r, caseDelay));
    }
    if ((i + 1) % batchSize === 0 && i < cases.length - 1) {
      await new Promise(r => setTimeout(r, batchDelay));
    }
  }

  // Compute metrics
  const layers: BenchmarkLayer[] = ["noisy", "ambiguous", "adversarial"];
  const layer_metrics = layers.map(l => computeLayerMetrics(results, l));

  const total = results.length;
  const passed = results.filter(r => r.failure_reasons.length === 0 && r.candidate_recall).length;

  const top1 = results.filter(r => r.top1_match).length;
  const top3 = results.filter(r => r.top3_match).length;
  const top5 = results.filter(r => r.top5_match).length;
  const recall = results.filter(r => r.candidate_recall).length;

  const safetyCases = results.filter(r => r.safety_expected);
  const noSafetyCases = results.filter(r => !r.safety_expected);
  const tp = safetyCases.filter(r => r.safety_triggered).length;
  const tn = noSafetyCases.filter(r => !r.safety_triggered).length;
  const alertCases = results.filter(r => r.safety_alerts.length > 0);
  const alertTP = alertCases.filter(r => r.safety_expected).length;

  const latencies = results.map(r => r.latency_ms);
  const cas = results.reduce((sum, r) => sum + r.clinical_acceptability, 0) / total;

  const suiteResult: SuiteRunResult = {
    run_id: runId,
    timestamp,
    benchmark_version: "v10",
    pipeline_phase: mode,
    total_cases: total,
    passed,
    failed: total - passed,
    layer_metrics,
    aggregate_metrics: {
      top1_accuracy: Math.round((top1 / total) * 100),
      top3_accuracy: Math.round((top3 / total) * 100),
      top5_accuracy: Math.round((top5 / total) * 100),
      candidate_recall: Math.round((recall / total) * 100),
      safety_sensitivity: safetyCases.length > 0 ? Math.round((tp / safetyCases.length) * 100) : 100,
      safety_specificity: noSafetyCases.length > 0 ? Math.round((tn / noSafetyCases.length) * 100) : 100,
      alert_precision: alertCases.length > 0 ? Math.round((alertTP / alertCases.length) * 100) : 100,
      alert_recall: safetyCases.length > 0
        ? Math.round((safetyCases.filter(r => r.safety_correct).length / safetyCases.length) * 100) : 100,
      clinical_acceptability_score: Math.round(cas * 100),
      avg_latency_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / total),
    },
    results,
    failure_summary: results
      .filter(r => r.failure_reasons.length > 0)
      .map(r => ({ case_id: r.case_id, name: r.name, reasons: r.failure_reasons })),
  };

  // Persist to database
  try {
    await persistRun(suiteResult);
    console.log(`[BenchmarkV10] Run ${runId} persisted successfully`);
  } catch (e) {
    console.error("[BenchmarkV10] Persistence failed:", e);
  }

  return suiteResult;
}
