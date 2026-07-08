/**
 * Contract Test — Single Entrypoint (Architecture Freeze v1.0, C1)
 *
 * Enforces workspace Rule 2 and Freeze Contract #2:
 * `runUnifiedClinicalPipeline` (O1) is the ONLY execution entrypoint.
 *
 * The legacy O2 shape adapter has been co-located inside
 * `src/services/benchmark_v8/` as `legacy_pipeline_adapter.ts`.
 * No code outside benchmark_v8 (and the PipelineSimulation debug page
 * that consumes benchmark_v8's shape) may import it.
 *
 * This test fails the build if the legacy top-level path resurfaces
 * or if any new caller starts importing the adapter outside its
 * allow-list.
 *
 * See: architecture/ARCHITECTURE_FREEZE_v1.md §5
 *      .lovable/execution-backlog-v1.md C1
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SRC_DIR = join(REPO_ROOT, "src");

// Forbidden top-level path — this module was moved under benchmark_v8.
const FORBIDDEN_IMPORT_PATTERNS = [
  /@\/services\/clinical_pipeline_orchestrator/,
  /['"]\.\.?\/(services\/)?clinical_pipeline_orchestrator['"]/,
];

// Allow-list for the co-located legacy adapter path. Only these files
// may import from `benchmark_v8/legacy_pipeline_adapter`.
const LEGACY_ADAPTER_ALLOWLIST = new Set<string>([
  "src/services/benchmark_v8/runner.ts",
  "src/services/benchmark_v8/types.ts",
  "src/services/benchmark_v8/legacy_pipeline_adapter.ts",
  "src/pages/PipelineSimulation.tsx",
]);

const LEGACY_ADAPTER_IMPORT =
  /@\/services\/benchmark_v8\/legacy_pipeline_adapter|\.\.?\/legacy_pipeline_adapter/;

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

describe("Contract: single clinical-pipeline entrypoint", () => {
  const allFiles = walk(SRC_DIR);

  it("no source file imports the retired top-level clinical_pipeline_orchestrator path", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(relative(REPO_ROOT, file));
          break;
        }
      }
    }
    expect(offenders, `Forbidden import of retired O2 path found in:\n  ${offenders.join("\n  ")}`).toEqual([]);
  });

  it("only the allow-listed files may import the legacy_pipeline_adapter shim", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const rel = relative(REPO_ROOT, file).replace(/\\/g, "/");
      if (LEGACY_ADAPTER_ALLOWLIST.has(rel)) continue;
      const content = readFileSync(file, "utf8");
      if (LEGACY_ADAPTER_IMPORT.test(content)) {
        offenders.push(rel);
      }
    }
    expect(
      offenders,
      `legacy_pipeline_adapter is co-located in benchmark_v8 and must not be imported elsewhere. Offenders:\n  ${offenders.join(
        "\n  ",
      )}`,
    ).toEqual([]);
  });

  it("O1 orchestrator module exports runUnifiedClinicalPipeline", () => {
    const o1Path = join(SRC_DIR, "services", "clinical_pipeline", "orchestrator.ts");
    const content = readFileSync(o1Path, "utf8");
    expect(content).toMatch(/export\s+(async\s+)?function\s+runUnifiedClinicalPipeline/);
  });
});
