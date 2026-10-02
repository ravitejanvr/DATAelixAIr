/**
 * Regression test (ROADMAP item 25): getPatientHistorySummary() must return
 * null fast when a patient has no history, and must cap recent consultations
 * at the configured limit rather than returning an unbounded list.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockPatientResult: { data: unknown; error: unknown };
let mockConsultationRows: unknown[];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "patients") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => mockPatientResult,
            }),
          }),
        };
      }
      if (table === "consultations") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: (n: number) => ({
                  then: (resolve: (v: { data: unknown[]; error: null }) => void) =>
                    resolve({ data: mockConsultationRows.slice(0, n), error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
  },
}));

import { getPatientHistorySummary } from "./client";

describe("getPatientHistorySummary", () => {
  beforeEach(() => {
    mockPatientResult = { data: null, error: null };
    mockConsultationRows = [];
  });

  it("returns null when the patient has no record and no consultations", async () => {
    const result = await getPatientHistorySummary("patient-without-history");
    expect(result).toBeNull();
  });

  it("returns a populated summary when the patient has a record", async () => {
    mockPatientResult = {
      data: { allergies: ["penicillin"], current_medications: ["metformin"], medical_history: ["diabetes"] },
      error: null,
    };
    const result = await getPatientHistorySummary("patient-1");
    expect(result).toEqual({
      allergies: ["penicillin"],
      current_medications: ["metformin"],
      medical_history: ["diabetes"],
      recent_consultations: [],
    });
  });

  it("caps recent consultations at the configured limit (3), even if more exist", async () => {
    mockPatientResult = { data: { allergies: [], current_medications: [], medical_history: [] }, error: null };
    mockConsultationRows = [
      { created_at: "2026-10-01", chief_complaint: "fever", ai_summary: "viral illness" },
      { created_at: "2026-09-15", chief_complaint: "cough", ai_summary: "bronchitis" },
      { created_at: "2026-08-01", chief_complaint: "headache", ai_summary: null, soap_assessment: "migraine" },
      { created_at: "2026-07-01", chief_complaint: "back pain", ai_summary: "strain" },
      { created_at: "2026-06-01", chief_complaint: "rash", ai_summary: "dermatitis" },
    ];
    const result = await getPatientHistorySummary("patient-with-many-visits");
    expect(result?.recent_consultations).toHaveLength(3);
    expect(result?.recent_consultations[0].chief_complaint).toBe("fever");
  });

  it("falls back to soap_assessment when ai_summary is null", async () => {
    mockPatientResult = { data: { allergies: [], current_medications: [], medical_history: [] }, error: null };
    mockConsultationRows = [
      { created_at: "2026-08-01", chief_complaint: "headache", ai_summary: null, soap_assessment: "migraine" },
    ];
    const result = await getPatientHistorySummary("patient-2");
    expect(result?.recent_consultations[0].summary).toBe("migraine");
  });
});
