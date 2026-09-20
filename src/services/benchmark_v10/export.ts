/**
 * Benchmark v10 — Run Export
 *
 * Pulls a persisted run (benchmark_suite_runs + benchmark_suite_results,
 * written by runner.ts's persistRun()) back out of the database and offers
 * it as a downloadable JSON file. Exists so a completed run's full per-case
 * data can be handed off (e.g. to a reviewer without dashboard access)
 * without re-running the suite — a full V1 vs V3 pass is a real cost
 * (~120 live pipeline calls per engine).
 */

import { supabase } from "@/integrations/supabase/client";

export interface RunSummary {
  run_id: string;
  created_at: string;
  pipeline_phase: string;
  engine_version: string | null;
  total_cases: number;
  passed: number;
  failed: number;
  metrics_summary: Record<string, unknown>;
  layer_metrics: unknown;
}

export interface RunBundle {
  run: RunSummary;
  results: unknown[];
}

/** List the most recent persisted runs, newest first. */
export async function listRecentRuns(limit = 15): Promise<RunSummary[]> {
  const { data, error } = await supabase
    .from("benchmark_suite_runs")
    .select("run_id, created_at, pipeline_phase, total_cases, passed, failed, metrics_summary, layer_metrics")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[BenchmarkV10Export] Failed to list runs:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    run_id: r.run_id,
    created_at: r.created_at,
    pipeline_phase: r.pipeline_phase,
    engine_version: (r.metrics_summary as any)?.engine_version ?? null,
    total_cases: r.total_cases,
    passed: r.passed,
    failed: r.failed,
    metrics_summary: r.metrics_summary,
    layer_metrics: r.layer_metrics,
  }));
}

/** Fetch a single run's metadata plus every per-case result row. */
export async function fetchRunBundle(runId: string): Promise<RunBundle | null> {
  const { data: runRows, error: runError } = await supabase
    .from("benchmark_suite_runs")
    .select("run_id, created_at, pipeline_phase, total_cases, passed, failed, metrics_summary, layer_metrics")
    .eq("run_id", runId)
    .limit(1);

  if (runError || !runRows || runRows.length === 0) {
    console.error("[BenchmarkV10Export] Failed to fetch run:", runError);
    return null;
  }
  const r = runRows[0] as any;

  const results: unknown[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data: page, error: resultsError } = await supabase
      .from("benchmark_suite_results")
      .select("*")
      .eq("run_id", runId)
      .range(offset, offset + pageSize - 1);

    if (resultsError) {
      console.error("[BenchmarkV10Export] Failed to fetch results page:", resultsError);
      break;
    }
    if (!page || page.length === 0) break;
    results.push(...page);
    if (page.length < pageSize) break;
  }

  return {
    run: {
      run_id: r.run_id,
      created_at: r.created_at,
      pipeline_phase: r.pipeline_phase,
      engine_version: (r.metrics_summary as any)?.engine_version ?? null,
      total_cases: r.total_cases,
      passed: r.passed,
      failed: r.failed,
      metrics_summary: r.metrics_summary,
      layer_metrics: r.layer_metrics,
    },
    results,
  };
}

/** Trigger a browser download of the given data as a JSON file. */
export function downloadAsJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Fetch a run and immediately trigger its download. */
export async function downloadRun(runId: string): Promise<boolean> {
  const bundle = await fetchRunBundle(runId);
  if (!bundle) return false;
  downloadAsJson(`benchmark-v10-${runId}.json`, bundle);
  return true;
}
