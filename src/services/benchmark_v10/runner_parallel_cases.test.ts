import { describe, it, expect } from "vitest";
import {
  resolveParallelCases,
  PRODUCTION_MAX_PARALLEL_CASES,
  BENCHMARK_DEFAULT_PARALLEL_CASES,
} from "./runner";

// Regression for: BenchmarkV10Panel.tsx switched every call site from
// executionMode "benchmark" to "production" but left `parallelCases: 5`
// (tuned for the lightweight O2 pipeline) in place, so production runs
// started firing 5 concurrent full-orchestrator pipelines per batch.
describe("resolveParallelCases — production can never inherit a benchmark-tuned value", () => {
  it("clamps a benchmark-tuned concurrency request to the production max", () => {
    expect(resolveParallelCases("production", 5)).toBe(PRODUCTION_MAX_PARALLEL_CASES);
  });

  it("clamps any production request above the max, however large", () => {
    expect(resolveParallelCases("production", 100)).toBe(PRODUCTION_MAX_PARALLEL_CASES);
  });

  it("leaves a production request at or below the max untouched", () => {
    expect(resolveParallelCases("production", PRODUCTION_MAX_PARALLEL_CASES)).toBe(PRODUCTION_MAX_PARALLEL_CASES);
  });

  it("defaults production to the max when nothing is requested", () => {
    expect(resolveParallelCases("production")).toBe(PRODUCTION_MAX_PARALLEL_CASES);
  });

  it("leaves benchmark mode's own concurrency requests alone", () => {
    expect(resolveParallelCases("benchmark", 5)).toBe(5);
    expect(resolveParallelCases("benchmark")).toBe(BENCHMARK_DEFAULT_PARALLEL_CASES);
  });
});
