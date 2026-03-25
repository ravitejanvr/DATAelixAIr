/**
 * Benchmark v9 — 10-Scenario Controlled Suite
 * Public API
 */
export { CONTROLLED_SCENARIO, BENCHMARK_SUITE } from "./scenario";
export type { BenchmarkCase } from "./scenario";
export { runControlledBenchmark, runBenchmarkSuite, runSingleScenario } from "./runner";
export type { PipelineMode } from "./runner";
export { comparePhases } from "./comparator";
export type * from "./types";
