/**
 * Contract: the conversational path must reason ONLY through the unified
 * orchestrator (Architecture Freeze v1.0 — Rule 2, Single Execution Entrypoint).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");

describe("Conversational path — single execution entrypoint", () => {
  it("runClinicalPipelineV4 delegates reasoning to runUnifiedClinicalPipeline", () => {
    const src = read("src/services/pipeline/index.ts");
    expect(src).toContain("runUnifiedClinicalPipeline");
    expect(src).toContain("await runUnifiedClinicalPipeline(");
  });

  it("no longer declares empty DDX / V3 stage arrays", () => {
    const src = read("src/services/pipeline/index.ts");
    expect(src).not.toContain("const ddxCandidates: DDXCandidate[] = [];");
    expect(src).not.toMatch(/}>\s*=\s*\[\];\s*\/\/ Populated by V3 engine call/);
  });

  it("the bridge performs mapping only — no scoring or probability math", () => {
    const src = read("src/services/pipeline/orchestrator_bridge.ts");
    expect(src).not.toMatch(/Math\.(exp|log|pow)/);
    expect(src).toContain("v4InputToO1Input");
    expect(src).toContain("o1ResultToV4Reasoning");
  });
});
