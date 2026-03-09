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

// ============================================================
// Global Clinical Safety Engine Types
// ============================================================

export interface ClinicalAlert {
  id?: string;
  consultation_id?: string;
  visit_id?: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  alert_type: string;
  severity: "warning" | "high" | "critical";
  category: string;
  title: string;
  message: string;
  matched_indicators: string[];
  action_hint?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  override_reason?: string;
  created_at?: string;
}

export interface MedicationAlertRecord {
  id?: string;
  consultation_id?: string;
  prescription_id?: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  alert_type: string;
  severity: "warning" | "high" | "critical";
  drug_a?: string;
  drug_b?: string;
  allergy_conflict?: string;
  dose_issue?: string;
  message: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  override_reason?: string;
  created_at?: string;
}

export interface DiagnosticFlagRecord {
  id?: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  flag_type: string;
  severity: "advisory" | "warning";
  inconsistency_detail: string;
  recommendation?: string;
  acknowledged_at?: string;
  created_at?: string;
}

export interface PopulationSignalRecord {
  id?: string;
  clinic_id?: string;
  signal_type: string;
  signal_name: string;
  severity: string;
  affected_count: number;
  time_window_hours: number;
  indicators: string[];
  is_resolved: boolean;
  created_at?: string;
}

export interface OutcomeTrackingRecord {
  id?: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  follow_up_scheduled_date?: string;
  follow_up_actual_date?: string;
  follow_up_missed: boolean;
  outcome_status: string;
  outcome_notes?: string;
  treatment_effective?: boolean;
  created_at?: string;
}

export interface SafetyEngineResult {
  clinical_alerts: ClinicalAlert[];
  medication_alerts: MedicationAlertRecord[];
  diagnostic_flags: DiagnosticFlagRecord[];
  population_signal?: PopulationSignalRecord;
  outcome_tracking: { follow_up_scheduled_date?: string; outcome_status: string };
  summary: {
    critical_count: number;
    high_count: number;
    warning_count: number;
    advisory_count: number;
  };
}

export interface SafetyEngineInput {
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  visit_id?: string;
  chief_complaint?: string;
  symptoms?: string[];
  diagnosis?: string;
  soap_assessment?: string;
  soap_plan?: string;
  tests_ordered?: string[];
  medications?: Array<{
    drug_name: string;
    dosage: string;
    frequency?: string;
    duration?: string;
  }>;
  vitals?: {
    bp_systolic?: number;
    bp_diastolic?: number;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    respiratory_rate?: number;
    blood_sugar?: number;
  };
  patient_age?: number;
  patient_sex?: string;
  allergies?: string[];
  current_medications?: string[];
  follow_up_date?: string;
}

/** Run the Global Clinical Safety Engine */
export async function runSafetyEngine(input: SafetyEngineInput): Promise<SafetyEngineResult> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data, error } = await supabase.functions.invoke("global-safety-engine", {
    body: input,
  });
  if (error) throw new Error(`Safety engine failed: ${error.message}`);
  return data as SafetyEngineResult;
}

/** Fetch alerts for a consultation */
export async function fetchConsultationAlerts(consultationId: string): Promise<{
  clinical: ClinicalAlert[];
  medication: MedicationAlertRecord[];
  diagnostic: DiagnosticFlagRecord[];
}> {
  const { supabase } = await import("@/integrations/supabase/client");
  const [clinicalRes, medRes, diagRes] = await Promise.all([
    supabase.from("clinical_alerts").select("*").eq("consultation_id", consultationId).order("created_at", { ascending: false }),
    supabase.from("medication_alerts").select("*").eq("consultation_id", consultationId).order("created_at", { ascending: false }),
    supabase.from("diagnostic_flags").select("*").eq("consultation_id", consultationId).order("created_at", { ascending: false }),
  ]);
  return {
    clinical: (clinicalRes.data || []) as ClinicalAlert[],
    medication: (medRes.data || []) as MedicationAlertRecord[],
    diagnostic: (diagRes.data || []) as DiagnosticFlagRecord[],
  };
}

/** Acknowledge a safety alert */
export async function acknowledgeAlert(
  table: "clinical_alerts" | "medication_alerts" | "diagnostic_flags",
  alertId: string,
  userId: string,
  overrideReason?: string
): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.from(table).update({
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: userId,
    ...(overrideReason ? { override_reason: overrideReason } : {}),
  }).eq("id", alertId);
}

/** Fetch active population signals for a clinic */
export async function fetchPopulationSignals(clinicId: string): Promise<PopulationSignalRecord[]> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("population_signals")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("is_resolved", false)
    .order("created_at", { ascending: false });
  return (data || []) as PopulationSignalRecord[];
}

// ============================================================
// Original helpers
// ============================================================

/** Color class for severity badges */
export function severityColor(sev: string): string {
  if (sev === "severe" || sev === "high" || sev === "critical" || sev === "blocking") return "text-destructive bg-destructive/10 border-destructive/20";
  if (sev === "moderate" || sev === "warning") return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800";
  return "text-muted-foreground bg-muted/50 border-border";
}

/** AI Draft label constant */
export const AI_DRAFT_LABEL = "AI Draft — Clinician Review Required";
