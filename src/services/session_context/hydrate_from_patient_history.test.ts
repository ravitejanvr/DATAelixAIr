/**
 * Regression test (ROADMAP item 25): hydrateFromPatientHistory() must be
 * additive — it must never erase what the session already collected this
 * turn, since prior-visit history is a supplement, not an override.
 */
import { describe, it, expect } from "vitest";
import { SessionContextManager } from "./index";
import type { PatientHistorySummary } from "../patient_history/types";

function summary(overrides: Partial<PatientHistorySummary> = {}): PatientHistorySummary {
  return {
    allergies: [],
    current_medications: [],
    medical_history: [],
    recent_consultations: [],
    ...overrides,
  };
}

describe("SessionContextManager.hydrateFromPatientHistory", () => {
  it("populates empty fields from the patient's prior history", () => {
    const session = new SessionContextManager();
    session.hydrateFromPatientHistory(
      summary({
        allergies: ["penicillin"],
        current_medications: ["metformin"],
        medical_history: ["type 2 diabetes"],
      }),
    );
    const snapshot = session.getSnapshot();
    expect(snapshot.allergies).toEqual(["penicillin"]);
    expect(snapshot.medications).toEqual(["metformin"]);
    expect(snapshot.medical_history).toEqual(["type 2 diabetes"]);
  });

  it("never erases data the session already collected this turn", () => {
    const session = new SessionContextManager();
    session.setMedications(["aspirin"]);
    session.setAllergies(["sulfa"]);

    session.hydrateFromPatientHistory(
      summary({
        allergies: ["penicillin"],
        current_medications: ["metformin"],
        medical_history: [],
      }),
    );

    const snapshot = session.getSnapshot();
    // Additive/deduped union — this turn's data survives alongside history.
    expect(snapshot.medications).toEqual(expect.arrayContaining(["aspirin", "metformin"]));
    expect(snapshot.allergies).toEqual(expect.arrayContaining(["sulfa", "penicillin"]));
  });

  it("deduplicates when history overlaps with session-collected data", () => {
    const session = new SessionContextManager();
    session.setMedications(["metformin"]);

    session.hydrateFromPatientHistory(summary({ current_medications: ["metformin"] }));

    expect(session.getSnapshot().medications).toEqual(["metformin"]);
  });

  it("setPatientId is reflected in toPipelineInput and reset clears it", () => {
    const session = new SessionContextManager();
    session.setPatientId("patient-123");
    expect(session.toPipelineInput().patient_id).toBe("patient-123");
    expect(session.getSnapshot().patient_id).toBe("patient-123");

    session.reset();
    expect(session.toPipelineInput().patient_id).toBeNull();
  });
});
