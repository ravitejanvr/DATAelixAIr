/**
 * Contract Test — Engine Forcing Actually Diverges
 *
 * WHY THIS EXISTS
 * ----------------
 * The benchmark_v9/v10 runners had a `mode: "phase8"|"phase9"|"phase10"` parameter
 * that was accepted, stored as a display label (`pipeline_phase: mode`), and never
 * forwarded into the pipeline call after a 2026-03-25 refactor (commits c1012944,
 * c1e3b196). Every "Phase 8 vs Phase 9 vs Phase 10" comparison either dashboard ever
 * produced compared identical configurations against each other — found 2026-09-19,
 * see CLAUDE.md.
 *
 * `engine_force.ts` (forceEngine) is the replacement mechanism for the new V1-vs-V3
 * benchmark comparison. This test exists so that mechanism can never silently decay
 * the same way: it does not trust that forceEngine("v1") vs forceEngine("v3") produced
 * different results because the code asked for different engines — it checks the
 * ACTUAL executed engine (PipelineResult.engine_audit.engine_version), which is
 * computed independently inside the orchestrator from what really ran, not from
 * what the caller requested.
 *
 * Part 1 (always runs, no network): forceEngine mutates and restores config exactly.
 * Part 2 (opt-in, RUN_PARITY_CHECK=1, live edge functions): forcing v1 vs v3 for the
 * SAME case produces a different engine_audit.engine_version each time, and each
 * matches what was requested — not the config left over from a previous forcing call.
 */

import { describe, it, expect } from "vitest";
import { ALL_NEW_CASES } from "@/services/benchmark_v10";
import { v10CaseToPipelineInput } from "@/services/benchmark_shared/case_to_context";
import { forceEngine } from "@/services/benchmark_v10/engine_force";
import { getEngineConfig } from "@/services/engine_registry";
import { getRolloutConfig } from "@/services/rollout_controller";
import { supabase } from "@/integrations/supabase/client";

const ENABLED = process.env.RUN_PARITY_CHECK === "1";
const PARITY_TEST_EMAIL = "raviteja.ciparitytest@gmail.com";
const DIVERGENCE_CASE_ID = "noisy-001";

describe("Contract: engine forcing config mutation/restore", () => {
  it("forceEngine('v1') pins rollout to 0% and active_engine to v1, restore() undoes it exactly", () => {
    const beforeEngine = getEngineConfig();
    const beforeRollout = getRolloutConfig();

    const handle = forceEngine("v1");
    expect(getEngineConfig().active_engine).toBe("v1");
    expect(getRolloutConfig().rollout_percentage).toBe(0);

    handle.restore();
    expect(getEngineConfig()).toEqual(beforeEngine);
    expect(getRolloutConfig()).toEqual(beforeRollout);
  });

  it("forceEngine('v3') pins rollout to 100% and active_engine to v3, restore() undoes it exactly", () => {
    const beforeEngine = getEngineConfig();
    const beforeRollout = getRolloutConfig();

    const handle = forceEngine("v3");
    expect(getEngineConfig().active_engine).toBe("v3");
    expect(getRolloutConfig().rollout_percentage).toBe(100);

    handle.restore();
    expect(getEngineConfig()).toEqual(beforeEngine);
    expect(getRolloutConfig()).toEqual(beforeRollout);
  });
});

describe("Contract: engine forcing changes what actually executes", () => {
  it.runIf(!ENABLED)("is opt-in and was NOT run in this pass", () => {
    expect(ENABLED).toBe(false);
  });

  it.runIf(ENABLED)(
    "forcing v1 then v3 for the same case yields two different engine_audit.engine_version values, each matching the request",
    async () => {
      const password = process.env.PARITY_TEST_PASSWORD;
      expect(password, "PARITY_TEST_PASSWORD must be set to sign in as the CI parity test account").toBeTruthy();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: PARITY_TEST_EMAIL,
        password: password!,
      });
      expect(signInError, `Sign-in as ${PARITY_TEST_EMAIL} failed: ${signInError?.message}`).toBeNull();

      const { runUnifiedClinicalPipeline } = await import("@/services/clinical_pipeline/orchestrator");

      const c = ALL_NEW_CASES.find((x: any) => x.case_id === DIVERGENCE_CASE_ID);
      expect(c, `fixture case ${DIVERGENCE_CASE_ID} must exist`).toBeTruthy();
      const input = v10CaseToPipelineInput(c as any);

      const v1Handle = forceEngine("v1");
      let v1Result;
      try {
        v1Result = await runUnifiedClinicalPipeline(input);
      } finally {
        v1Handle.restore();
      }

      const v3Handle = forceEngine("v3");
      let v3Result;
      try {
        v3Result = await runUnifiedClinicalPipeline(input);
      } finally {
        v3Handle.restore();
      }

      const v1Actual = v1Result?.engine_audit?.engine_version ?? null;
      const v3Actual = v3Result?.engine_audit?.engine_version ?? null;

      expect(
        v1Actual,
        `Forcing v1 should make the pipeline actually execute v1, but engine_audit reported "${v1Actual}". ` +
          `If this fails, forceEngine() is producing a label without a real effect — exactly the bug this test exists to catch.`,
      ).toBe("v1");

      expect(
        v3Actual,
        `Forcing v3 should make the pipeline actually execute v3, but engine_audit reported "${v3Actual}". ` +
          `If this fails, forceEngine() is producing a label without a real effect — exactly the bug this test exists to catch.`,
      ).toBe("v3");

      expect(v1Actual, "v1 and v3 forced runs must report different actually-executed engines").not.toBe(v3Actual);
    },
    180_000,
  );
});
