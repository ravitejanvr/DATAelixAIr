/**
 * Layer 5: Safety Controller API
 * 
 * Provides medication safety validation including RxNorm normalization,
 * drug-drug interaction checks, allergy conflict detection, and dose
 * sanity rules. All results are presented for clinician review — no
 * autonomous overrides.
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

export interface SafetyResults {
  normalized_drugs: NormalizedDrug[];
  interaction_flags: InteractionFlag[];
  allergy_flags: AllergyFlag[];
  dose_warnings: DoseWarning[];
  confidence_level: "low" | "moderate" | "high";
  requires_manual_review: boolean;
  timestamp: string;
}

/** Color class for severity badges */
export function severityColor(sev: string): string {
  if (sev === "severe" || sev === "high") return "text-destructive bg-destructive/10 border-destructive/20";
  if (sev === "moderate") return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800";
  return "text-muted-foreground bg-muted/50 border-border";
}
