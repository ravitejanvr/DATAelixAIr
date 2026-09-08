/**
 * A7.4 Contract Test — KG Terminology Binding (active)
 *
 * Guarantees:
 *   1. Feature flag is ON — KG identity resolves through SNOMED concepts.
 *   2. ClusterDiagnosis carries the snomed_id field.
 *   3. Every cluster registry entry is bound to a numeric SNOMED concept id,
 *      and no two distinct diagnoses collapse onto one concept.
 */

import { describe, it, expect } from "vitest";
import { getFeatureFlags, isKgTerminologyBindingEnabled } from "@/services/feature_flags";
import { getClusterDiagnoses, getAllClusterIds, type ClusterDiagnosis } from "@/services/kg";

describe("A7.4 — KG Terminology Binding (active)", () => {
  it("feature flag is enabled", () => {
    expect(getFeatureFlags().enable_kg_terminology_binding).toBe(true);
    expect(isKgTerminologyBindingEnabled()).toBe(true);
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

  it("every cluster entry is bound to a SNOMED concept, with no collisions", () => {
    const ids = getAllClusterIds();
    expect(ids.length).toBeGreaterThan(0);
    const conceptToName = new Map<string, string>();
    for (const id of ids) {
      for (const d of getClusterDiagnoses(id)) {
        expect(typeof d.diagnosis_name).toBe("string");
        expect(d.base_relevance).toBeGreaterThanOrEqual(0);
        expect(d.base_relevance).toBeLessThanOrEqual(1);
        expect(d.snomed_id, `unbound: ${d.diagnosis_name}`).toMatch(/^\d+$/);
        const key = d.snomed_id as string;
        const seen = conceptToName.get(key);
        const name = d.diagnosis_name.trim().toLowerCase();
        if (seen) expect(seen, `collision on ${key}`).toBe(name);
        else conceptToName.set(key, name);
      }
    }
  });
});
