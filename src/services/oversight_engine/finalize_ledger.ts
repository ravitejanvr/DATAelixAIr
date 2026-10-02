/**
 * Builds the AI-decision-ledger entry for a consultation finalization.
 *
 * This is the enforcement point for the conscience loop (ROADMAP item 23):
 * a consultation with unresolved critical safety alerts cannot produce a
 * ledger entry without a logged override reason. Kept as a pure function,
 * independent of the Clinical.tsx UI flow, so the invariant is testable
 * without a full component harness and can't be silently bypassed by a
 * UI wiring change.
 */
import type { SafetyResults } from "@/layers/safety/api";
import { safetyResultsToAlerts, type SafetyAlert } from "@/components/SafetyOverrideDialog";
import type { LedgerEntry } from "./client";

const MIN_OVERRIDE_REASON_LENGTH = 10;

export function getCriticalSafetyAlerts(safetyResults: SafetyResults | null): SafetyAlert[] {
  if (!safetyResults) return [];
  return safetyResultsToAlerts(safetyResults).filter(
    (a) => a.severity === "critical" || a.severity === "blocking"
  );
}

export interface BuildFinalizeLedgerEntryParams {
  consultationId: string;
  safetyResults: SafetyResults | null;
  overrideReason?: string;
  acknowledgedAlertIds?: string[];
}

/**
 * Throws if there are unresolved critical safety alerts and no valid
 * override reason — this is what makes bypassing the conscience loop
 * impossible from calling code, not just discouraged by the UI.
 */
export function buildFinalizeLedgerEntry(params: BuildFinalizeLedgerEntryParams): LedgerEntry {
  const critical = getCriticalSafetyAlerts(params.safetyResults);

  if (critical.length > 0) {
    const reason = params.overrideReason?.trim() ?? "";
    if (reason.length < MIN_OVERRIDE_REASON_LENGTH) {
      throw new Error(
        `Cannot finalize with ${critical.length} unresolved critical safety alert(s) without a logged override reason (min ${MIN_OVERRIDE_REASON_LENGTH} chars).`
      );
    }
    return {
      ai_output: JSON.stringify(critical),
      ai_output_type: "safety_override",
      consultation_id: params.consultationId,
      safety_status: "critical",
      doctor_action: "overridden",
      override_reason: reason,
      metadata: {
        acknowledged_alert_ids: params.acknowledgedAlertIds ?? [],
        alert_count: critical.length,
      },
    };
  }

  return {
    ai_output: JSON.stringify({ safety_results: params.safetyResults }),
    ai_output_type: "safety_review",
    consultation_id: params.consultationId,
    safety_status: "safe",
    doctor_action: "accepted",
  };
}
