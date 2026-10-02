/**
 * Finalize-time safety gate for the cockpit (Clinical.tsx).
 *
 * Two bugs this module exists to prevent from coming back:
 *
 * 1. Stale gate. Finalize used to run validation when it hadn't been run,
 *    but then gated on the `safetyResults` React state captured *before*
 *    that validation (a stale closure). Critical alerts the validation
 *    found never opened the override dialog; the ledger recorded
 *    "accepted" and `finalize-consultation` received `safety_override: true`.
 *    `decideFinalizeGate` takes only the fresh result, so the decision
 *    cannot be made from pre-check state.
 *
 * 2. Missing context. The cockpit's safety check was sent without
 *    `clinical_context`, so the server's completeness check reported chief
 *    complaint, age and sex as "blocking" on every call — every validated
 *    finalize demanded an override, which trains clinicians to override
 *    past real alerts. `buildSafetyCheckRequest` always includes it.
 */
import type { SafetyResults } from "@/layers/safety/api";
import type { ClinicalContext } from "@/lib/clinical-context";
import type { SafetyAlert } from "@/components/SafetyOverrideDialog";
import { getCriticalSafetyAlerts } from "./finalize_ledger";

export interface SafetyCheckRequest {
  medications: string[];
  allergies: string[];
  vitals: Record<string, number | null>;
  symptoms: string[];
  clinical_context: ClinicalContext;
}

export function buildSafetyCheckRequest(params: {
  medications: string[];
  allergies: string[];
  vitals: Record<string, number | null>;
  symptoms: string[];
  clinicalContext: ClinicalContext;
  /** Cockpit-entered chief complaint, preferred over the context's own. */
  chiefComplaint?: string | null;
}): SafetyCheckRequest {
  const chief = params.chiefComplaint?.trim() || params.clinicalContext.chief_complaint || "";
  return {
    medications: params.medications,
    allergies: params.allergies,
    vitals: params.vitals,
    symptoms: params.symptoms,
    clinical_context: { ...params.clinicalContext, chief_complaint: chief },
  };
}

export type FinalizeGateDecision =
  | { kind: "check_failed" }
  | { kind: "needs_override"; safety: SafetyResults; critical: SafetyAlert[] }
  | { kind: "proceed"; safety: SafetyResults; critical: SafetyAlert[] };

const MIN_OVERRIDE_REASON_LENGTH = 10;

/**
 * Decide whether finalize may proceed, from the safety check run *at
 * finalize time*. A failed check blocks (never fails open).
 */
export function decideFinalizeGate(params: {
  freshSafety: SafetyResults | null;
  overrideReason?: string;
}): FinalizeGateDecision {
  if (!params.freshSafety) return { kind: "check_failed" };
  const critical = getCriticalSafetyAlerts(params.freshSafety);
  const reasonOk = (params.overrideReason?.trim().length ?? 0) >= MIN_OVERRIDE_REASON_LENGTH;
  if (critical.length > 0 && !reasonOk) {
    return { kind: "needs_override", safety: params.freshSafety, critical };
  }
  return { kind: "proceed", safety: params.freshSafety, critical };
}
