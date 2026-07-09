/**
 * A7.1 Contract Test — KG Terminology Binding (dormant slice)
 *
 * Guarantees:
 *   1. Feature flag exists and defaults to false (no runtime effect).
 *   2. ClusterDiagnosis accepts the optional canonical_id / snomed_id fields.
 *   3. Cluster registry entries carry NO bindings at rest — A7.1 is additive
 *      only; bindings populate via offline backfill in A7.2.
 */

import { describe, it, expect } from "vitest";
import { getFeatureFlags, isKgTerminologyBindingEnabled } from "@/services/feature_flags";
import { getClusterDiagnoses, getAllClusterIds, type ClusterDiagnosis } from "@/services/kg";

describe("A7.1 — KG Terminology Binding (dormant slice)", () => {
  it("feature flag exists and defaults to false", () => {
    expect(getFeatureFlags().enable_kg_terminology_binding).toBe(false);
    expect(isKgTerminologyBindingEnabled()).toBe(false);
  });

  it("ClusterDiagnosis accepts optional canonical_id / snomed_id", () => {
    const sample: ClusterDiagnosis = {
      diagnosis_name: "Sepsis",
      base_relevance: 0.9,
      must_not_miss: true,
      category: "infectious",
      canonical_id: "TEST_CANONICAL",
      snomed_id: "91302008",
    };
    expect(sample.canonical_id).toBe("TEST_CANONICAL");
    expect(sample.snomed_id).toBe("91302008");
  });

  it("cluster registry unchanged and unbound at rest", () => {
    const ids = getAllClusterIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      for (const d of getClusterDiagnoses(id)) {
        expect(d.canonical_id).toBeUndefined();
        expect(d.snomed_id).toBeUndefined();
        expect(typeof d.diagnosis_name).toBe("string");
        expect(d.base_relevance).toBeGreaterThanOrEqual(0);
        expect(d.base_relevance).toBeLessThanOrEqual(1);
      }
    }
  });
});
