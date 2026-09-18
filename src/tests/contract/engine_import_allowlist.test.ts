/**
 * Contract Test — Diagnostic Engine Import Allow-List
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-03-25 the v10 benchmark was rewired to run the production orchestrator
 * (O1). 113 minutes later a second, faster pipeline (`benchmark_mode.ts`, O2) was
 * written that imported the diagnostic engines directly, and every benchmark call
 * site was pointed at it. It stayed that way for five months.
 *
 * `single_entrypoint.test.ts` did not catch it, because that test only checks
 * module NAMES and IMPORT PATHS — a 31 KB parallel pipeline named `benchmark_mode`
 * satisfies all of its assertions.
 *
 * This test checks the thing that actually matters: **who is allowed to invoke a
 * diagnostic engine**. Any module that calls an engine entrypoint is, by
 * definition, a pipeline. If it is not on the allow-list below, the build fails.
 *
 * Adding a file to ALLOWLIST is a deliberate architectural act: it means you are
 * declaring a new pipeline, and Architecture Freeze v1 §2 requires that it either
 * delegate to O1 or be covered by `benchmark_parity.test.ts`.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");

/** Callable engine entrypoints. Invoking any of these makes a module a pipeline. */
const ENGINE_CALLS = [
  "runDDXEngine",
  "calculateDiagnosticProbabilities",
  "runInference",
  "testHypotheses",
  "runUncertaintyEngine",
  "generatePhysiologicalContext",
];

/**
 * Files permitted to invoke a diagnostic engine.
 *
 * - engine client/index modules: they ARE the engines.
 * - orchestrator.ts: O1, the single production entrypoint.
 * - benchmark_mode.ts: O2, quarantined latency-experiment path. Permitted ONLY
 *   while benchmark_parity.test.ts guards it. Not a publishable metric source.
 * - evaluation / v3_benchmark / v3_validation runners: pre-freeze harnesses that
 *   deliberately probe a single engine in isolation, not end-to-end pipelines.
 */
const ALLOWLIST = new Set<string>([
  "src/services/bayesian_engine/client.ts",
  "src/services/bayesian_engine/client_v3.ts",
  "src/services/bayesian_engine/index.ts",
  "src/services/ddx_engine/client.ts",
  "src/services/engine_registry.ts",
  "src/services/hypothesis_testing/client.ts",
  "src/services/physiology_engine/client.ts",
  "src/services/physiology_engine/index.ts",
  "src/services/uncertainty_engine/client.ts",
  "src/services/clinical_pipeline/orchestrator.ts",
  "src/services/clinical_pipeline/benchmark_mode.ts",
  "src/services/evaluation/runner.ts",
  "src/services/v3_benchmark/runner.ts",
  "src/services/v3_validation/runner.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "archive") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Strips line comments and block comments so documentation cannot trip the check. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("Contract: diagnostic engine invocation is allow-listed", () => {
  const allFiles = walk(SRC_DIR);

  it("no module outside the allow-list invokes a diagnostic engine", () => {
    const offenders: Array<string> = [];

    for (const file of allFiles) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
      if (ALLOWLIST.has(rel)) continue;
      if (rel.startsWith("src/tests/")) continue;

      const code = stripComments(readFileSync(file, "utf8"));
      const hit = ENGINE_CALLS.filter((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(code));
      if (hit.length > 0) {
        offenders.push(`${rel} → ${hit.join(", ")}`);
      }
    }

    expect(
      offenders,
      [
        "A module outside the allow-list is invoking a diagnostic engine directly.",
        "That makes it a second pipeline, which Architecture Freeze v1 §2 forbids.",
        "Either call runUnifiedClinicalPipeline (O1), or add the file to ALLOWLIST",
        "in this test AND cover it in benchmark_parity.test.ts.",
        "Offenders:",
        ...offenders.map((o) => `  ${o}`),
      ].join("\n"),
    ).toEqual([]);
  });

  it("the allow-list stays small — every entry is a deliberate exception", () => {
    // Guards against the allow-list quietly becoming the escape hatch it is
    // meant to prevent. Raising this number requires an architecture decision.
    expect(ALLOWLIST.size).toBeLessThanOrEqual(14);
  });

  it("O2 remains quarantined: benchmark_mode is imported only by the v10 runner", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
      if (rel === "src/services/benchmark_v10/runner.ts") continue;
      if (rel === "src/services/clinical_pipeline/benchmark_mode.ts") continue;
      if (rel.startsWith("src/tests/")) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      if (/clinical_pipeline\/benchmark_mode/.test(code)) offenders.push(rel);
    }
    expect(
      offenders,
      `benchmark_mode (O2) must not spread beyond the v10 runner. Offenders:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("the v10 benchmark reads its metrics from fusedBayesian, not ddx", () => {
    const runner = readFileSync(join(SRC_DIR, "services", "benchmark_v10", "runner.ts"), "utf8");
    const code = stripComments(runner);

    // Ranking must come from PipelineResult.bayesian (= fusedBayesian, the object
    // Clinical.tsx renders). This is the regression that produced five months of
    // benchmark numbers describing a pipeline no doctor ever used.
    expect(code).toMatch(/pipelineResult\?\.bayesian\?\.diagnoses/);
    expect(code).not.toMatch(/predicted_top5[\s\S]{0,200}differential_diagnoses/);
  });

  it("all v10 UI entrypoints run the production pipeline", () => {
    const panel = readFileSync(join(SRC_DIR, "components", "BenchmarkV10Panel.tsx"), "utf8");
    expect(stripComments(panel)).not.toMatch(/executionMode:\s*"benchmark"/);
  });
});
