/**
 * Contract Test — O1 / O2 Output Parity
 *
 * WHY THIS EXISTS
 * ---------------
 * `benchmark_mode.ts` (O2) was created on 2026-03-25 with this claim in its header:
 *
 *   "Output is structurally identical to production PipelineResult — only execution
 *    path is optimized. Diagnostic accuracy outputs are produced by the SAME edge
 *    functions as production."
 *
 * That claim was true the day it was written and false within weeks: O1 received
 * 152 commits (engine registry, V3 selection, fusedBayesian fusion, Phase 5.7
 * evidence pass) while O2 received 27 unrelated ones. Nothing ever re-checked it.
 *
 * This test re-checks it. It runs both pipelines over a small fixed case set and
 * fails if the top-5 of the frozen `fusedBayesian` object differs.
 *
 * EXECUTION
 * ---------
 * Both pipelines call live edge functions and require an authenticated session,
 * so this test does NOT run in the default unit-test pass. It is opt-in:
 *
 *   RUN_PARITY_CHECK=1 PARITY_TEST_PASSWORD=... bunx vitest run src/tests/contract/benchmark_parity.test.ts
 *
 * PARITY_TEST_PASSWORD signs in as the dedicated CI test account (doctor role,
 * approved status — see scripts/provision-parity-test-user.mjs) so edge-function
 * calls carry a real user JWT instead of just the anon key, which every protected
 * function rejects with 401.
 *
 * When RUN_PARITY_CHECK is absent the suite reports a skip with a reason, rather
 * than silently passing — a silent pass is precisely how the original claim decayed.
 */

import { describe, it, expect } from "vitest";
import { ALL_NEW_CASES } from "@/services/benchmark_v10";
import { v10CaseToPipelineInput } from "@/services/benchmark_shared/case_to_context";
import { supabase } from "@/integrations/supabase/client";

const ENABLED = process.env.RUN_PARITY_CHECK === "1";
// Must be a real, receivable inbox — this project requires email
// confirmation before a session is issued (confirmed empirically via
// scripts/probe-signup-confirmation.mjs), so a synthetic address can never
// be confirmed. See scripts/provision-parity-test-user.mjs.
const PARITY_TEST_EMAIL = "raviteja.ciparitytest@gmail.com";

/** Fixed, deterministic slice — one case per layer. */
const PARITY_CASE_IDS = ["noisy-001", "ambig-001", "adv-001"];

function topFive(result: any): string[] {
  return ((result?.bayesian?.diagnoses ?? []) as any[])
    .slice(0, 5)
    .map((d) => (d.diagnosis_name || d.diagnosis_id || "").trim().toLowerCase());
}

describe("Contract: O1 / O2 fusedBayesian parity", () => {
  it.runIf(!ENABLED)("is opt-in and was NOT run in this pass", () => {
    // Deliberately visible: this records that parity is unverified in this run.
    expect(ENABLED).toBe(false);
  });

  it.runIf(ENABLED)(
    "O2 produces the same fusedBayesian top-5 as O1 for every parity case",
    async () => {
      const password = process.env.PARITY_TEST_PASSWORD;
      expect(password, "PARITY_TEST_PASSWORD must be set to sign in as the CI parity test account").toBeTruthy();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: PARITY_TEST_EMAIL,
        password: password!,
      });
      expect(signInError, `Sign-in as ${PARITY_TEST_EMAIL} failed: ${signInError?.message}`).toBeNull();

      const { runUnifiedClinicalPipeline } = await import("@/services/clinical_pipeline/orchestrator");
      const { runBenchmarkPipeline } = await import("@/services/clinical_pipeline/benchmark_mode");

      const cases = ALL_NEW_CASES.filter((c: any) =>
        PARITY_CASE_IDS.includes(c.case_id),
      ).slice(0, PARITY_CASE_IDS.length);

      expect(cases.length, "parity case ids must resolve").toBeGreaterThan(0);

      const divergences: string[] = [];
      for (const c of cases) {
        const input = v10CaseToPipelineInput(c as any);
        const o1 = await runUnifiedClinicalPipeline(input);
        const o2 = await runBenchmarkPipeline(input);
        const a = topFive(o1);
        const b = topFive(o2);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          divergences.push(`${(c as any).case_id}\n    O1: ${a.join(" | ")}\n    O2: ${b.join(" | ")}`);
        }
      }

      expect(
        divergences,
        [
          "O2 (benchmark_mode) no longer agrees with O1 (production).",
          "Either bring O2 back into agreement or delete it — do not publish its numbers.",
          ...divergences.map((d) => `  ${d}`),
        ].join("\n"),
      ).toEqual([]);
    },
    180_000,
  );
});
