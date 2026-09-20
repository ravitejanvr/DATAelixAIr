import { describe, it, expect } from "vitest";
import { buildFinalizeLedgerEntry, getCriticalSafetyAlerts } from "./finalize_ledger";
import type { SafetyResults } from "@/layers/safety/api";
import { AI_DRAFT_LABEL } from "@/layers/safety/api";

function safetyResultsOf(overrides: Partial<SafetyResults>): SafetyResults {
  return {
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
    output_policy: { label: AI_DRAFT_LABEL, conservative_language: true, evidence_required: true },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const CRITICAL_ALLERGY = safetyResultsOf({
  allergy_flags: [{ medication: "Amoxicillin", allergy: "Penicillin", severity: "high", message: "Patient has a documented penicillin allergy" }],
});

const CRITICAL_EMERGENCY = safetyResultsOf({
  emergency_patterns: [{ pattern: "Chest pain + dyspnea", severity: "critical", matched_indicators: ["chest pain", "dyspnea"], message: "Possible ACS", action_hint: "Refer to ED" }],
});

describe("getCriticalSafetyAlerts", () => {
  it("returns nothing when there are no safety results", () => {
    expect(getCriticalSafetyAlerts(null)).toEqual([]);
  });

  it("returns nothing when nothing is flagged as critical", () => {
    const safe = safetyResultsOf({
      dose_warnings: [{ medication: "Paracetamol", issue: "high_dose", message: "Slightly above usual dose" }],
    });
    expect(getCriticalSafetyAlerts(safe)).toEqual([]);
  });

  it("treats any allergy flag as critical", () => {
    expect(getCriticalSafetyAlerts(CRITICAL_ALLERGY)).toHaveLength(1);
  });

  it("treats a critical-severity emergency pattern as critical", () => {
    expect(getCriticalSafetyAlerts(CRITICAL_EMERGENCY)).toHaveLength(1);
  });
});

describe("buildFinalizeLedgerEntry — the conscience-loop gate", () => {
  it("regression: refuses to build a ledger entry for critical alerts with no override reason", () => {
    // This is the exact failure mode item 23 exists to close: a doctor finalizing a
    // consultation with a critical safety alert (e.g. a documented drug allergy) without
    // ever having to explain why. If this stops throwing, the override loop has been
    // silently bypassed again — same shape as the four born-dead safety modules the
    // 2026-09-20 architecture inventory found.
    expect(() =>
      buildFinalizeLedgerEntry({ consultationId: "c1", safetyResults: CRITICAL_ALLERGY })
    ).toThrow(/unresolved critical safety alert/i);
  });

  it("regression: refuses a reason under the minimum length (rubber-stamp override text)", () => {
    expect(() =>
      buildFinalizeLedgerEntry({ consultationId: "c1", safetyResults: CRITICAL_ALLERGY, overrideReason: "ok" })
    ).toThrow(/unresolved critical safety alert/i);
  });

  it("records a proper override entry once a real reason is given", () => {
    const entry = buildFinalizeLedgerEntry({
      consultationId: "c1",
      safetyResults: CRITICAL_ALLERGY,
      overrideReason: "Re-confirmed with patient: prior reaction was GI upset, not true allergy.",
      acknowledgedAlertIds: ["allergy-0"],
    });
    expect(entry.doctor_action).toBe("overridden");
    expect(entry.safety_status).toBe("critical");
    expect(entry.ai_output_type).toBe("safety_override");
    expect(entry.consultation_id).toBe("c1");
    expect(entry.override_reason).toContain("prior reaction");
    expect(entry.metadata?.acknowledged_alert_ids).toEqual(["allergy-0"]);
  });

  it("records a routine acceptance entry when there are no critical alerts", () => {
    const entry = buildFinalizeLedgerEntry({
      consultationId: "c2",
      safetyResults: safetyResultsOf({}),
    });
    expect(entry.doctor_action).toBe("accepted");
    expect(entry.safety_status).toBe("safe");
    expect(entry.ai_output_type).toBe("safety_review");
    expect(entry.override_reason).toBeUndefined();
  });

  it("does not require a reason when safety_results is null (nothing to override)", () => {
    const entry = buildFinalizeLedgerEntry({ consultationId: "c3", safetyResults: null });
    expect(entry.doctor_action).toBe("accepted");
  });
});
