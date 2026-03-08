/**
 * Layer 5: Safety Controller API
 * 
 * Provides medication safety validation including RxNorm normalization,
 * drug-drug interaction checks, allergy conflict detection, dose
 * sanity rules, dangerous vitals detection, emergency symptom
 * pattern matching, and context completeness validation. All results 
 * are presented for clinician review — no autonomous overrides.
 * 
 * Safety flags are logged to audit_logs for governance and monitoring.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase Edge Functions
 * 
 * Consumers:
 *   - Layer 1 (UI): Safety check summary display
 *   - Layer 2 (Workflow): Prescription validation
 *   - Layer 4 (AI Agents): Safety context for SOAP generation
 */

export interface NormalizedDrug {
  original_name: string;
  rxnorm_id: string | null;
  canonical_name: string | null;
  confidence_level: "high" | "moderate" | "low";
  warning: string | null;
}

export interface InteractionFlag {
  interaction_warning: boolean;
  severity: "mild" | "moderate" | "severe";
  drug_a: string;
  drug_b: string;
  description: string;
}

export interface AllergyFlag {
  medication: string;
  allergy: string;
  severity: "high";
  message: string;
}

export interface DoseWarning {
  medication: string;
  issue: string;
  message: string;
}

export interface VitalsDanger {
  parameter: string;
  value: number;
  severity: "warning" | "critical";
  message: string;
  action_hint: string;
}

export interface EmergencyPattern {
  pattern: string;
  severity: "warning" | "critical";
  matched_indicators: string[];
  message: string;
  action_hint: string;
}

export interface ContextCompletenessIssue {
  field: string;
  severity: "blocking" | "warning";
  message: string;
}

export interface ContextCompleteness {
  issues: ContextCompletenessIssue[];
  context_complete: boolean;
  ai_suggestions_blocked: boolean;
}

export interface OutputPolicy {
  label: string;
  conservative_language: boolean;
  evidence_required: boolean;
}

export interface SafetyResults {
  normalized_drugs: NormalizedDrug[];
  interaction_flags: InteractionFlag[];
  allergy_flags: AllergyFlag[];
  dose_warnings: DoseWarning[];
  vitals_dangers: VitalsDanger[];
  emergency_patterns: EmergencyPattern[];
  context_completeness: ContextCompleteness;
  confidence_level: "low" | "moderate" | "high";
  requires_manual_review: boolean;
  ai_suggestions_blocked: boolean;
  output_policy: OutputPolicy;
  timestamp: string;
}

/** Color class for severity badges */
export function severityColor(sev: string): string {
  if (sev === "severe" || sev === "high" || sev === "critical" || sev === "blocking") return "text-destructive bg-destructive/10 border-destructive/20";
  if (sev === "moderate" || sev === "warning") return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800";
  return "text-muted-foreground bg-muted/50 border-border";
}

/** AI Draft label constant */
export const AI_DRAFT_LABEL = "AI Draft — Clinician Review Required";
