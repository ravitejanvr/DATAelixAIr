/**
 * Regression test (ROADMAP item 25, Wave 0b): mergePatientHistoryIntoContext()
 * must only fill medical_history/allergies/current_medications when this
 * visit's own context doesn't already have them, and must be a safe no-op
 * for a null history (the common case — most patients have no prior
 * consultations yet).
 */
import { describe, it, expect } from "vitest";
import { mergePatientHistoryIntoContext } from "./orchestrator";
import type { ClinicalContext } from "@/lib/clinical-context";
import type { PatientHistorySummary } from "@/services/patient_history/types";

function baseContext(overrides: Partial<ClinicalContext> = {}): ClinicalContext {
  return {
    chief_complaint: "",
    symptoms: [],
    ...overrides,
  } as ClinicalContext;
}

function history(overrides: Partial<PatientHistorySummary> = {}): PatientHistorySummary {
  return {
    allergies: [],
    current_medications: [],
    medical_history: [],
    recent_consultations: [],
    ...overrides,
  };
}

describe("mergePatientHistoryIntoContext", () => {
  it("is a no-op when history is null (no prior consultations)", () => {
    const ctx = baseContext();
    expect(mergePatientHistoryIntoContext(ctx, null)).toBe(ctx);
  });

  it("fills empty fields from history", () => {
    const ctx = baseContext();
    const merged = mergePatientHistoryIntoContext(
      ctx,
      history({ allergies: ["penicillin"], current_medications: ["metformin"], medical_history: ["diabetes"] }),
    );
    expect(merged.allergies).toEqual(["penicillin"]);
    expect(merged.current_medications).toEqual(["metformin"]);
    expect(merged.medical_history).toEqual(["diabetes"]);
  });

  it("never overwrites fields this visit's own intake already provided", () => {
    const ctx = baseContext({
      allergies: ["sulfa"],
      current_medications: ["aspirin"],
      medical_history: ["hypertension"],
    });
    const merged = mergePatientHistoryIntoContext(
      ctx,
      history({ allergies: ["penicillin"], current_medications: ["metformin"], medical_history: ["diabetes"] }),
    );
    expect(merged.allergies).toEqual(["sulfa"]);
    expect(merged.current_medications).toEqual(["aspirin"]);
    expect(merged.medical_history).toEqual(["hypertension"]);
  });
});
