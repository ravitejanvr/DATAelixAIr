/**
 * Clinical-context completeness check used by the `clinical-safety` edge
 * function. Shared (no imports, no Deno APIs) so the client-side request
 * builder can be tested against the exact check the server runs: a safety
 * check sent without `clinical_context` reports chief complaint, age and sex
 * as "blocking" issues, which the cockpit override gate treats as critical.
 */

export interface ContextCompletenessIssue {
  field: string;
  severity: "blocking" | "warning";
  message: string;
}

export function checkContextCompleteness(clinical_context: any): {
  issues: ContextCompletenessIssue[];
  context_complete: boolean;
  ai_suggestions_blocked: boolean;
} {
  const issues: ContextCompletenessIssue[] = [];

  // Blocking checks — these prevent AI from generating suggestions
  if (!clinical_context?.chief_complaint || clinical_context.chief_complaint.trim() === "") {
    issues.push({ field: "chief_complaint", severity: "blocking", message: "Chief complaint is required before AI analysis can proceed." });
  }

  if (clinical_context?.patient_age == null) {
    issues.push({ field: "patient_age", severity: "blocking", message: "Patient age is required for safe clinical reasoning." });
  }

  if (!clinical_context?.patient_sex || clinical_context.patient_sex.trim() === "") {
    issues.push({ field: "patient_sex", severity: "blocking", message: "Patient sex is required for accurate clinical assessment." });
  }

  // Warning checks — these allow AI but flag missing data
  const hasAnyVitals = clinical_context?.blood_pressure || clinical_context?.pulse ||
    clinical_context?.temperature || clinical_context?.oxygen_saturation;
  if (!hasAnyVitals) {
    issues.push({ field: "vitals", severity: "warning", message: "No vitals recorded. Consider recording vitals for comprehensive assessment." });
  }

  if (clinical_context?.oxygen_saturation == null && clinical_context?.respiratory_rate == null) {
    issues.push({ field: "respiratory_vitals", severity: "warning", message: "SpO₂ and respiratory rate not recorded. Recommended for respiratory complaints." });
  }

  if (!clinical_context?.allergies || clinical_context.allergies.length === 0) {
    issues.push({ field: "allergies", severity: "warning", message: "No allergy information recorded. Verify with patient before prescribing." });
  }

  if (!clinical_context?.current_medications || clinical_context.current_medications.length === 0) {
    issues.push({ field: "current_medications", severity: "warning", message: "No current medications recorded. Verify to prevent drug interactions." });
  }

  const blockingIssues = issues.filter(i => i.severity === "blocking");
  return {
    issues,
    context_complete: blockingIssues.length === 0,
    ai_suggestions_blocked: blockingIssues.length > 0,
  };
}
