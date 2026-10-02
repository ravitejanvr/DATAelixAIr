import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildSafetyCheckRequest, decideFinalizeGate } from "./finalize_gate";
import { checkContextCompleteness } from "../../../supabase/functions/_shared/context_completeness.ts";
import { EMPTY_CLINICAL_CONTEXT, type ClinicalContext } from "@/lib/clinical-context";
import type { SafetyResults } from "@/layers/safety/api";

const base: SafetyResults = {
  normalized_drugs: [],
  interaction_flags: [],
  allergy_flags: [],
  dose_warnings: [],
  vitals_dangers: [],
  emergency_patterns: [],
  context_completeness: { issues: [], context_complete: true, ai_suggestions_blocked: false },
  confidence_level: "high",
  requires_manual_review: false,
  ai_suggestions_blocked: false,
  output_policy: { label: "AI Draft", conservative_language: true, evidence_required: true },
  timestamp: "2026-10-02T00:00:00Z",
};

const withCriticalEmergency: SafetyResults = {
  ...base,
  emergency_patterns: [{
    pattern: "Possible Acute Coronary Syndrome", severity: "critical",
    matched_indicators: ["chest pain", "diaphoresis/nausea"], message: "", action_hint: "",
  }],
};

describe("decideFinalizeGate", () => {
  // Regression: finalize used to gate on safetyResults captured before the
  // finalize-time validation ran. The gate now only accepts the fresh result.
  it("blocks for override when the finalize-time check finds a critical alert", () => {
    const d = decideFinalizeGate({ freshSafety: withCriticalEmergency });
    expect(d.kind).toBe("needs_override");
  });

  it("blocks when the safety check could not run (never fails open)", () => {
    expect(decideFinalizeGate({ freshSafety: null }).kind).toBe("check_failed");
    expect(decideFinalizeGate({ freshSafety: null, overrideReason: "a sufficiently long reason" }).kind).toBe("check_failed");
  });

  it("requires a real override reason, not a token one", () => {
    expect(decideFinalizeGate({ freshSafety: withCriticalEmergency, overrideReason: "ok" }).kind).toBe("needs_override");
    const d = decideFinalizeGate({ freshSafety: withCriticalEmergency, overrideReason: "ECG normal, troponin negative x2" });
    expect(d.kind).toBe("proceed");
    if (d.kind === "proceed") expect(d.critical).toHaveLength(1);
  });

  it("proceeds without override when nothing is critical", () => {
    const d = decideFinalizeGate({ freshSafety: base });
    expect(d.kind).toBe("proceed");
    if (d.kind === "proceed") expect(d.critical).toEqual([]);
  });

  // Structural guard for the same class of bug: inside finalizeConsultation,
  // nothing may read the pre-check `safetyResults` / `criticalSafetyAlerts`
  // state — only the fresh result returned by the gate.
  it("Clinical.tsx finalize reads only the fresh gate result", () => {
    const src = readFileSync(join(__dirname, "..", "..", "pages", "Clinical.tsx"), "utf8");
    const start = src.indexOf("const finalizeConsultation = async");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf("\n  };\n", start);
    // Comments may mention the old state names; only code matters.
    const body = src.slice(start, end).replace(/\/\/.*$/gm, "");
    expect(body).toMatch(/decideFinalizeGate\(/);
    expect(body).toMatch(/await fetchSafetyResults\(\)/);
    expect(body).not.toMatch(/\bcriticalSafetyAlerts\b/);
    expect(body).not.toMatch(/\bsafetyResults\b(?!:)/);
  });
});

describe("buildSafetyCheckRequest", () => {
  const populated: ClinicalContext = {
    ...EMPTY_CLINICAL_CONTEXT,
    patient_age: 58,
    patient_sex: "female",
    chief_complaint: "chest pain",
    pulse: 96,
    allergies: ["penicillin"],
    current_medications: ["metformin"],
  };

  // Regression: the cockpit sent the safety check without clinical_context,
  // so the server's completeness check flagged chief complaint, age and sex as
  // "blocking" on every call, and every validated finalize demanded an override.
  it("carries the clinical context the server's completeness check needs", () => {
    const body = buildSafetyCheckRequest({
      medications: ["aspirin"], allergies: [], vitals: { pulse: 96 }, symptoms: ["chest pain"],
      clinicalContext: populated,
    });
    const completeness = checkContextCompleteness(body.clinical_context);
    expect(completeness.issues.filter(i => i.severity === "blocking")).toEqual([]);
  });

  it("still reports genuinely missing context as blocking", () => {
    const body = buildSafetyCheckRequest({
      medications: [], allergies: [], vitals: {}, symptoms: [],
      clinicalContext: { ...populated, patient_age: null },
    });
    expect(checkContextCompleteness(body.clinical_context).issues.map(i => i.field)).toContain("patient_age");
  });

  it("is used for every clinical-safety call in Clinical.tsx", () => {
    const src = readFileSync(join(__dirname, "..", "..", "pages", "Clinical.tsx"), "utf8");
    const calls = src.match(/functions\.invoke\("clinical-safety"/g) ?? [];
    const built = src.match(/buildSafetyCheckRequest\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(built.length).toBe(calls.length);
  });

  it("prefers the cockpit's chief complaint", () => {
    const body = buildSafetyCheckRequest({
      medications: [], allergies: [], vitals: {}, symptoms: [],
      clinicalContext: { ...populated, chief_complaint: "" }, chiefComplaint: "breathlessness",
    });
    expect(body.clinical_context.chief_complaint).toBe("breathlessness");
  });
});
