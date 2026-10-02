/**
 * Contract Test — Benchmark cases execute the production engine
 *
 * HISTORY
 * -------
 * This file used to check O1 (runUnifiedClinicalPipeline) against O2
 * (benchmark_mode.ts), a faster parallel pipeline created 2026-03-25 that claimed
 * to be "structurally identical to production". It stayed green from 2026-09-18
 * through 2026-09-20 — but only because rollout_controller.ts's
 * rollout_percentage was stuck at 10, which bucketed all three parity identities
 * (bench-v10-noisy-001/ambig-001/adv-001 → buckets 63/43/38) onto V1 inside O1.
 * O2 bypasses engine_registry and is effectively V1-only, so every green run
 * compared V1 against a V1-shaped pipeline and never exercised V3, the engine
 * production was supposed to serve. The day the rollout fix (ROADMAP item 28)
 * made O1 actually run V3, two of three cases diverged. O2 was retired
 * 2026-10-02; the v10 benchmark now runs O1 only.
 *
 * WHAT IT CHECKS NOW
 * ------------------
 * The hole that masked this was never "do two pipelines agree" — it was "which
 * engine actually ran for the identities the benchmark uses". So for each
 * parity case, through the exact input the v10 runner builds, it asserts that:
 *   - PipelineResult.engine_audit.engine_version (computed inside the
 *     orchestrator from what really executed, including the silent fallback to
 *     V1 when the advanced engine fails) equals engine_registry's active_engine;
 *   - the fusedBayesian ranking the benchmark scores is non-empty.
 *
 * EXECUTION
 * ---------
 * Calls live edge functions with an authenticated session, so it is opt-in:
 *
 *   RUN_PARITY_CHECK=1 PARITY_TEST_PASSWORD=... npx vitest run src/tests/contract/benchmark_parity.test.ts
 *
 * PARITY_TEST_PASSWORD signs in as the dedicated CI test account (doctor role,
 * approved status — see scripts/provision-parity-test-user.mjs) so edge-function
 * calls carry a real user JWT instead of just the anon key.
 *
 * When RUN_PARITY_CHECK is absent the suite reports a skip with a reason, rather
 * than silently passing.
 */

import { describe, it, expect } from "vitest";
import { ALL_NEW_CASES } from "@/services/benchmark_v10";
import { v10CaseToPipelineInput } from "@/services/benchmark_shared/case_to_context";
import { getActiveEngineVersion } from "@/services/engine_registry";
import { supabase } from "@/integrations/supabase/client";

const ENABLED = process.env.RUN_PARITY_CHECK === "1";
// Must be a real, receivable inbox — this project requires email
// confirmation before a session is issued (confirmed empirically via
// scripts/probe-signup-confirmation.mjs), so a synthetic address can never
// be confirmed. See scripts/provision-parity-test-user.mjs.
const PARITY_TEST_EMAIL = "raviteja.ciparitytest@gmail.com";

/** Fixed, deterministic slice — one case per layer. */
const PARITY_CASE_IDS = ["noisy-001", "ambig-001", "adv-001"];

describe("Contract: benchmark cases execute the production engine", () => {
  it.runIf(!ENABLED)("is opt-in and was NOT run in this pass", () => {
    // Deliberately visible: this records that the check is unverified in this run.
    expect(ENABLED).toBe(false);
  });

  it.runIf(ENABLED)(
    "every parity case runs engine_registry's active engine through O1 and yields a ranking",
    async () => {
      const password = process.env.PARITY_TEST_PASSWORD;
      expect(password, "PARITY_TEST_PASSWORD must be set to sign in as the CI parity test account").toBeTruthy();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: PARITY_TEST_EMAIL,
        password: password!,
      });
      expect(signInError, `Sign-in as ${PARITY_TEST_EMAIL} failed: ${signInError?.message}`).toBeNull();

      const { runUnifiedClinicalPipeline } = await import("@/services/clinical_pipeline/orchestrator");

      const cases = ALL_NEW_CASES.filter((c: any) => PARITY_CASE_IDS.includes(c.case_id));
      expect(cases.length, "parity case ids must resolve").toBe(PARITY_CASE_IDS.length);

      const declared = getActiveEngineVersion();
      const problems: string[] = [];
      for (const c of cases) {
        const result: any = await runUnifiedClinicalPipeline(v10CaseToPipelineInput(c as any));
        const executed = result?.engine_audit?.engine_version ?? "missing";
        const ranked = (result?.bayesian?.diagnoses ?? []).length;
        if (executed !== declared) {
          problems.push(`${(c as any).case_id}: executed ${executed}, registry declares ${declared}`);
        }
        if (ranked === 0) {
          problems.push(`${(c as any).case_id}: fusedBayesian ranking is empty`);
        }
      }

      expect(
        problems,
        [
          "Benchmark cases are not measuring the engine production declares.",
          "Do not publish v10 numbers until this is green.",
          ...problems.map((p) => `  ${p}`),
        ].join("\n"),
      ).toEqual([]);
    },
    180_000,
  );
});
