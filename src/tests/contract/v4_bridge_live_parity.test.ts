/**
 * Contract Test — V4 Bridge / Cockpit Live Parity
 *
 * WHY THIS EXISTS
 * ----------------
 * 2026-09-20 architecture inventory found that ClinicalInteraction.tsx (V4,
 * conversational) could silently disagree with Clinical.tsx (O1, cockpit) on
 * diagnosis ranking for the same case, because orchestrator_bridge.ts's
 * o1ResultToV4Reasoning() built v3Diagnoses from `result.ddx.differential_diagnoses`
 * (the raw, pre-fusion DDX list) instead of `result.bayesian.diagnoses`
 * (fusedBayesian — O1's actual final ranking, which the cockpit already uses).
 * Fixed same day. This is the live-data companion to the synthetic unit test in
 * orchestrator_bridge.test.ts: it proves the fix holds against a REAL
 * runUnifiedClinicalPipeline() result, not hand-built fixture data, and that
 * the full V4 stack still runs end-to-end on top of the fix.
 *
 * EXECUTION
 * ---------
 * Same live-edge-function requirement as benchmark_parity.test.ts, opt-in:
 *
 *   RUN_PARITY_CHECK=1 PARITY_TEST_PASSWORD=... bunx vitest run src/tests/contract/v4_bridge_live_parity.test.ts
 *
 * DESIGN NOTE — why this doesn't also assert V4-vs-O1 exact-match end-to-end
 * ---------------------------------------------------------------------------
 * runClinicalPipelineV4() is called with V4's own PipelineInput (flatter than
 * O1's ClinicalContext — no symptom_duration/associated_symptoms/risk_factors
 * fields), and v4InputToO1Input() hardcodes those as empty when bridging V4
 * input to O1. That's a real, separate input-fidelity gap between the two
 * entry points (not the ranking bug fixed here) — V4's conversational intake
 * genuinely captures less structured context than O1's cockpit form today, so
 * running the same case through both entry points end-to-end can legitimately
 * produce different bayesian results even with a correct bridge, for reasons
 * unrelated to o1ResultToV4Reasoning(). Asserting exact match there would
 * conflate two different questions. This test isolates the one thing that was
 * actually fixed: given a single real O1 result, does the bridge correctly
 * carry its final ranking through, unchanged. The V4 smoke test below checks
 * the full stack still runs, without asserting it produces the cockpit's exact
 * ranking end-to-end — that's tracked separately (see ROADMAP item 24 notes).
 */

import { describe, it, expect } from "vitest";
import { ALL_NEW_CASES } from "@/services/benchmark_v10";
import { v10CaseToPipelineInput } from "@/services/benchmark_shared/case_to_context";
import { supabase } from "@/integrations/supabase/client";

const ENABLED = process.env.RUN_PARITY_CHECK === "1";
const PARITY_TEST_EMAIL = "raviteja.ciparitytest@gmail.com";
const PARITY_CASE_IDS = ["noisy-001", "ambig-001", "adv-001"];

function topIds(diagnoses: Array<{ diagnosis_id?: string }>, n: number): string[] {
  return diagnoses.slice(0, n).map((d) => (d.diagnosis_id || "").trim().toLowerCase());
}

describe("Contract: V4 bridge reflects O1's real fusedBayesian ranking", () => {
  it.runIf(!ENABLED)("is opt-in and was NOT run in this pass", () => {
    expect(ENABLED).toBe(false);
  });

  it.runIf(ENABLED)(
    "o1ResultToV4Reasoning(realO1Result).v3Diagnoses matches realO1Result.bayesian.diagnoses order",
    async () => {
      const password = process.env.PARITY_TEST_PASSWORD;
      expect(password, "PARITY_TEST_PASSWORD must be set to sign in as the CI parity test account").toBeTruthy();

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: PARITY_TEST_EMAIL,
        password: password!,
      });
      expect(signInError, `Sign-in as ${PARITY_TEST_EMAIL} failed: ${signInError?.message}`).toBeNull();

      const { runUnifiedClinicalPipeline } = await import("@/services/clinical_pipeline/orchestrator");
      const { o1ResultToV4Reasoning } = await import("@/services/pipeline/orchestrator_bridge");

      const cases = ALL_NEW_CASES.filter((c: any) => PARITY_CASE_IDS.includes(c.case_id));
      expect(cases.length, "parity case ids must resolve").toBeGreaterThan(0);

      const divergences: string[] = [];
      for (const c of cases) {
        const input = v10CaseToPipelineInput(c as any);
        const o1 = await runUnifiedClinicalPipeline(input);

        expect(o1.bayesian?.diagnoses?.length, `${(c as any).case_id}: O1 returned no bayesian diagnoses to bridge`).toBeGreaterThan(0);

        const bridged = o1ResultToV4Reasoning(o1);
        const expected = topIds(o1.bayesian!.diagnoses as any, 5);
        const actual = topIds(bridged.v3Diagnoses, 5);

        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          divergences.push(`${(c as any).case_id}\n    O1 bayesian: ${expected.join(" | ")}\n    Bridged v3 : ${actual.join(" | ")}`);
        }
      }

      expect(
        divergences,
        [
          "The V4 bridge no longer reflects O1's real fusedBayesian ranking.",
          "This is the exact regression the 2026-09-20 bridge fix (ROADMAP item 24) closed.",
          ...divergences.map((d) => `  ${d}`),
        ].join("\n"),
      ).toEqual([]);
    },
    180_000,
  );

  it.runIf(ENABLED)(
    "runClinicalPipelineV4 runs end-to-end on real cases and produces a non-empty SSAL",
    async () => {
      const { runClinicalPipelineV4 } = await import("@/services/pipeline/index");

      const cases = ALL_NEW_CASES.filter((c: any) => PARITY_CASE_IDS.includes(c.case_id));

      for (const c of cases) {
        const o1Input = v10CaseToPipelineInput(c as any);
        const v4Input = {
          raw_text: o1Input.clinical_context.chief_complaint || undefined,
          symptoms: o1Input.clinical_context.symptoms,
          input_type: "form" as const,
          vitals: {
            bp_systolic: undefined,
            bp_diastolic: undefined,
            pulse: o1Input.clinical_context.pulse ?? undefined,
            temperature: o1Input.clinical_context.temperature ?? undefined,
            respiratory_rate: o1Input.clinical_context.respiratory_rate ?? undefined,
            spo2: o1Input.clinical_context.oxygen_saturation ?? undefined,
            height_cm: o1Input.clinical_context.height ?? undefined,
            weight_kg: o1Input.clinical_context.weight ?? undefined,
          },
          medical_history: o1Input.clinical_context.medical_history,
          current_medications: o1Input.clinical_context.current_medications,
          allergies: o1Input.clinical_context.allergies,
          visit_id: o1Input.visit_id ?? undefined,
          clinic_id: o1Input.clinic_id ?? undefined,
        };

        const v4Result = await runClinicalPipelineV4(v4Input as any);
        expect(v4Result.ssal, `${(c as any).case_id}: V4 produced no SSAL`).toBeTruthy();
        expect(Array.isArray(v4Result.ssal.diagnoses), `${(c as any).case_id}: V4 SSAL diagnoses is not an array`).toBe(true);
      }
    },
    180_000,
  );
});
