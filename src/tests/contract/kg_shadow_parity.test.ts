/**
 * A7.3 Contract Test — KG Terminology Shadow Verifier
 *
 * Guarantees:
 *   1. The verifier is read-only: production candidates are byte-identical to
 *      a direct expandKG() call, and the cluster registry stays unbound.
 *   2. With zero bindings present, shadow == production (canonical keying
 *      falls back to the string key), so parity holds.
 *   3. safe_to_enable stays false while binding coverage is incomplete.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: async () => ({ data: [], error: null }),
      }),
    }),
  },
}));

import {
  createEmptyActivation,
  activateNode,
  expandKG,
  getAllClusterIds,
  getClusterDiagnoses,
  verifyKgTerminologyParity,
} from "@/services/kg";

function sampleActivation() {
  const a = createEmptyActivation();
  const ids = getAllClusterIds().slice(0, 3);
  for (const id of ids) activateNode(a, id, 0.8, `test:${id}`, "context_expander");
  return a;
}

describe("A7.3 — KG shadow parity verifier", () => {
  it("production candidates match a direct expandKG() call", async () => {
    const expected = expandKG(sampleActivation()).candidates;
    const report = await verifyKgTerminologyParity(sampleActivation());
    expect(report.production_candidates).toEqual(expected);
  });

  it("shadow equals production when no bindings exist", async () => {
    const report = await verifyKgTerminologyParity(sampleActivation());
    expect(report.divergences).toEqual([]);
    expect(report.parity).toBe(true);
  });

  it("does not mutate the cluster registry", async () => {
    await verifyKgTerminologyParity(sampleActivation());
    for (const id of getAllClusterIds()) {
      for (const d of getClusterDiagnoses(id)) {
        expect(d.canonical_id).toBeUndefined();
      }
    }
  });

  it("safe_to_enable is false while binding coverage is incomplete", async () => {
    const report = await verifyKgTerminologyParity(sampleActivation());
    expect(report.binding_coverage.coverage_pct).toBeLessThan(100);
    expect(report.safe_to_enable).toBe(false);
  });
});
