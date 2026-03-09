/**
 * Clinical Context Engine
 * 
 * Aggregates patient demographics, vitals, intake, and extracted data
 * into a unified clinical context for downstream pipeline stages.
 * 
 * Re-exports existing buildClinicalContext for backward compatibility
 * and adds enrichment capabilities for the new pipeline.
 */

export { 
  buildClinicalContext, 
  EMPTY_CLINICAL_CONTEXT 
} from "@/lib/clinical-context";

export type { ClinicalContext } from "@/lib/clinical-context";

export interface EnrichedClinicalContext {
  /** Core clinical context from existing system */
  core: import("@/lib/clinical-context").ClinicalContext;
  /** Visit metadata */
  visit_id: string | null;
  consultation_id: string | null;
  clinic_id: string | null;
  /** Intake approval status */
  intake_approved: boolean;
  /** Timestamp of context assembly */
  assembled_at: string;
}

/**
 * Build an enriched context that wraps the existing ClinicalContext
 * with visit-level metadata for the new pipeline.
 */
export function buildEnrichedContext(
  core: import("@/lib/clinical-context").ClinicalContext,
  opts: {
    visit_id?: string | null;
    consultation_id?: string | null;
    clinic_id?: string | null;
    intake_approved?: boolean;
  } = {}
): EnrichedClinicalContext {
  return {
    core,
    visit_id: opts.visit_id ?? null,
    consultation_id: opts.consultation_id ?? null,
    clinic_id: opts.clinic_id ?? null,
    intake_approved: opts.intake_approved ?? false,
    assembled_at: new Date().toISOString(),
  };
}

/**
 * Validate that minimum required fields are present for AI processing.
 * Returns list of missing critical fields.
 */
export function validateContextCompleteness(
  ctx: import("@/lib/clinical-context").ClinicalContext
): string[] {
  const missing: string[] = [];
  if (ctx.patient_age == null) missing.push("patient_age");
  if (!ctx.patient_sex) missing.push("patient_sex");
  if (!ctx.chief_complaint) missing.push("chief_complaint");
  return missing;
}
