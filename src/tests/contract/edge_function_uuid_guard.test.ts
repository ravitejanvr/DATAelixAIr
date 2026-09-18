/**
 * Regression test for #15: DDX candidates can carry synthetic placeholder
 * IDs (e.g. "fallback-0-myocardial-infarction" from orchestrator.ts's
 * withRetry path, or "hint-context_signal-pneumothorax" from FallbackV2)
 * when they never resolved to a real diagnoses.id. test-hypotheses and
 * plan-evidence both used to pass every candidate's diagnosis_id straight
 * into a `.in("diagnosis_id", ...)` query against a UUID column, which
 * fails the whole query with "invalid input syntax for type uuid" the
 * moment one synthetic ID slips in — silently degrading real results too.
 *
 * Both edge functions now filter through this shared isUuid() guard before
 * querying. This test isn't a live edge-function test (no Deno/network
 * available here) — it exercises the exact guard both functions import,
 * against the exact synthetic ID shapes that caused the incident.
 */
import { describe, it, expect } from "vitest";
import { isUuid } from "../../../supabase/functions/_shared/uuid.ts";

describe("isUuid guard used by test-hypotheses / plan-evidence", () => {
  it("accepts real UUIDs", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000001")).toBe(true);
  });

  it("rejects the exact synthetic ID shapes that broke symptom_likelihoods/diagnosis_lab_map", () => {
    expect(isUuid("fallback-0-myocardial-infarction")).toBe(false);
    expect(isUuid("hint-context_signal-myocardial-infarction")).toBe(false);
    expect(isUuid("hint-phenotype_inference-pneumothorax")).toBe(false);
  });

  it("rejects non-string and empty values without throwing", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(12345)).toBe(false);
  });
});
