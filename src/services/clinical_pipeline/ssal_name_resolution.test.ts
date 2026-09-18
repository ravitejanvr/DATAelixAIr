import { describe, it, expect } from "vitest";
import { buildSsalNameMap, enrichBayesianWithNames } from "./ssal_name_resolution";
import type { BayesianResult } from "@/services/bayesian_engine";
import type { DDXResult } from "@/services/ddx_engine/client";

function uuid(n: number): string {
  return `${String(n).padStart(8, "0")}-0000-0000-0000-000000000000`;
}

function bayesianOf(diagnoses: Array<{ diagnosis_id: string; posterior_probability: number; must_not_miss?: boolean }>): BayesianResult {
  return {
    diagnoses: diagnoses.map((d) => ({
      diagnosis_id: d.diagnosis_id,
      posterior_probability: d.posterior_probability,
      prior: 0.01,
      symptom_likelihood: d.posterior_probability,
      physiology_likelihood: 1,
      risk_modifier: 1,
      supporting_evidence: [],
      must_not_miss: d.must_not_miss ?? false,
    })),
    total_candidates: diagnoses.length,
    symptoms_resolved: 0,
    physiology_states_used: 0,
    risk_factors_applied: 0,
    execution_ms: 0,
    source: "bayesian",
  };
}

function ddxOf(pairs: Array<[string, string]>): DDXResult {
  return {
    differential_diagnoses: pairs.map(([id, name]) => ({
      diagnosis_id: id,
      diagnosis_name: name,
      probability: 50,
      category: "",
      must_not_miss: false,
      supporting_symptoms: [],
      contradicting_factors: [],
    })) as any,
    recommended_labs: [],
    suggested_medications: [],
  } as any;
}

describe("buildSsalNameMap", () => {
  it("maps diagnosis_id to diagnosis_name from DDX results", () => {
    const map = buildSsalNameMap(ddxOf([[uuid(1), "Community-Acquired Pneumonia"]]));
    expect(map.get(uuid(1))).toBe("Community-Acquired Pneumonia");
  });

  it("returns an empty map when no sources are given", () => {
    expect(buildSsalNameMap(null, null).size).toBe(0);
  });
});

describe("enrichBayesianWithNames — the O1/O2 parity bug", () => {
  // This is exactly the shape calculateDiagnosticProbabilities (and benchmark_mode's
  // ddx-fallback branches) produce: diagnosis_id only, no diagnosis_name.
  it("resolves real diagnosis names onto a raw Bayesian result, not the bare UUID", () => {
    const raw = bayesianOf([
      { diagnosis_id: uuid(1), posterior_probability: 0.7 },
      { diagnosis_id: uuid(2), posterior_probability: 0.2 },
    ]);
    const ddx = ddxOf([
      [uuid(1), "Community-Acquired Pneumonia"],
      [uuid(2), "Acute Bronchitis"],
    ]);

    const enriched = enrichBayesianWithNames(raw, { ddxResult: ddx, freeze: false });

    expect(enriched).not.toBeNull();
    for (const d of enriched!.diagnoses) {
      expect((d as any).diagnosis_name).toBeTruthy();
      // The regression: before the fix, every diagnosis_name here was the raw UUID.
      expect((d as any).diagnosis_name).not.toMatch(/^[0-9a-f]{8}-/i);
    }
    expect((enriched!.diagnoses[0] as any).diagnosis_name).toBe("Community-Acquired Pneumonia");
    expect((enriched!.diagnoses[1] as any).diagnosis_name).toBe("Acute Bronchitis");
  });

  it("sorts by posterior probability descending when CPR was not applied", () => {
    const raw = bayesianOf([
      { diagnosis_id: uuid(1), posterior_probability: 0.2 },
      { diagnosis_id: uuid(2), posterior_probability: 0.7 },
    ]);
    const ddx = ddxOf([[uuid(1), "Low"], [uuid(2), "High"]]);
    const enriched = enrichBayesianWithNames(raw, { ddxResult: ddx, freeze: false });
    expect((enriched!.diagnoses[0] as any).diagnosis_name).toBe("High");
    expect((enriched!.diagnoses[0] as any).rank).toBe(1);
  });

  it("preserves existing order when CPR was applied, without re-sorting", () => {
    const raw = bayesianOf([
      { diagnosis_id: uuid(1), posterior_probability: 0.2 },
      { diagnosis_id: uuid(2), posterior_probability: 0.7 },
    ]);
    const ddx = ddxOf([[uuid(1), "Low"], [uuid(2), "High"]]);
    const enriched = enrichBayesianWithNames(raw, { ddxResult: ddx, cprApplied: true, freeze: false });
    expect((enriched!.diagnoses[0] as any).diagnosis_name).toBe("Low");
  });

  it("falls back to the raw diagnosis_id only when no name source resolves it at all", () => {
    const raw = bayesianOf([{ diagnosis_id: uuid(9), posterior_probability: 0.5 }]);
    const enriched = enrichBayesianWithNames(raw, { freeze: false });
    expect((enriched!.diagnoses[0] as any).diagnosis_name).toBe(uuid(9));
  });

  it("returns null/empty input unchanged", () => {
    expect(enrichBayesianWithNames(null)).toBeNull();
    const empty = bayesianOf([]);
    expect(enrichBayesianWithNames(empty)?.diagnoses).toEqual([]);
  });
});
