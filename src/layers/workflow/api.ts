/**
 * Layer 2: Clinical Workflow API
 * 
 * Manages patient intake, triage, vitals recording, visit tracking,
 * prescription management, lab ordering, and billing.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client, Auth context
 *   - Layer 5 (Safety): Drug safety checks for prescriptions
 *   - Layer 8 (Monitoring): Audit logging for mutations
 * 
 * Consumers:
 *   - Layer 1 (UI): Clinical workspace pages
 */

// ── Visit Status Pipeline ────────────────────────────────────

export const VISIT_STATUSES = [
  "registered", "arrived", "triage", "vitals", "doctor", "lab", "pharmacy", "billing", "complete"
] as const;

export type VisitStatus = typeof VISIT_STATUSES[number];

export const VISIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  registered: { label: "Registered", color: "bg-blue-100 text-blue-800 border-blue-200" },
  arrived:    { label: "Arrived", color: "bg-teal-100 text-teal-800 border-teal-200" },
  triage:     { label: "Triage", color: "bg-pink-100 text-pink-800 border-pink-200" },
  vitals:     { label: "Vitals", color: "bg-purple-100 text-purple-800 border-purple-200" },
  doctor:     { label: "Doctor", color: "bg-primary/10 text-primary border-primary/20" },
  lab:        { label: "Lab", color: "bg-amber-100 text-amber-800 border-amber-200" },
  pharmacy:   { label: "Pharmacy", color: "bg-orange-100 text-orange-800 border-orange-200" },
  billing:    { label: "Billing", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  complete:   { label: "Complete", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

// ── Triage Types ─────────────────────────────────────────────

export interface TriageEntry {
  chief_complaint: string;
  symptom_duration: string;
  pain_score: string;
  allergies_noted: string;
  pregnancy_status: string;
  priority: string;
  notes: string;
}

export const EMPTY_TRIAGE: TriageEntry = {
  chief_complaint: "",
  symptom_duration: "",
  pain_score: "",
  allergies_noted: "",
  pregnancy_status: "not_applicable",
  priority: "routine",
  notes: "",
};

export const PAIN_SCORES = [
  { value: "0", label: "0 — No pain" },
  { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3 — Mild" },
  { value: "4", label: "4" }, { value: "5", label: "5 — Moderate" },
  { value: "6", label: "6" }, { value: "7", label: "7 — Severe" },
  { value: "8", label: "8" }, { value: "9", label: "9" }, { value: "10", label: "10 — Worst" },
];

export const PREGNANCY_OPTIONS = [
  { value: "not_applicable", label: "N/A" },
  { value: "not_pregnant", label: "Not Pregnant" },
  { value: "pregnant", label: "Pregnant" },
  { value: "unknown", label: "Unknown" },
];

export const PRIORITY_OPTIONS = [
  { value: "routine", label: "Routine", color: "bg-blue-100 text-blue-800" },
  { value: "urgent", label: "Urgent", color: "bg-amber-100 text-amber-800" },
  { value: "emergent", label: "Emergent", color: "bg-red-100 text-red-800" },
];

// ── Vitals Types ─────────────────────────────────────────────

export interface VitalEntry {
  bp_systolic: string;
  bp_diastolic: string;
  pulse: string;
  temperature: string;
  spo2: string;
  respiratory_rate: string;
  weight_kg: string;
  height_cm: string;
  blood_sugar: string;
  notes: string;
}

export const EMPTY_VITALS: VitalEntry = {
  bp_systolic: "", bp_diastolic: "", pulse: "", temperature: "",
  spo2: "", respiratory_rate: "", weight_kg: "", height_cm: "",
  blood_sugar: "", notes: "",
};

// ── Prescription Types ───────────────────────────────────────

export interface DrugEntry {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  severity: string;
  interactions: any;
}

// ── Billing Types ────────────────────────────────────────────

export interface LineItem {
  description: string;
  amount: string;
}

// ── Workflow Config (clinic-configurable) ────────────────────

export interface WorkflowConfig {
  intake_enabled: boolean;
  triage_enabled: boolean;
  vitals_required: boolean;
  lab_enabled: boolean;
  pharmacy_enabled: boolean;
  billing_enabled: boolean;
  favorite_prescriptions_enabled: boolean;
  default_consultation_fee: number;
  workflow_order: string[];
}

export const DEFAULT_WORKFLOW_ORDER = [
  "intake", "triage", "vitals", "doctor", "lab", "pharmacy", "billing"
];

/**
 * Returns the active workflow steps for a clinic config.
 * Clinics can skip triage or vitals via their config.
 */
export function getActiveWorkflowSteps(config?: Partial<WorkflowConfig> | null): VisitStatus[] {
  const base: VisitStatus[] = ["registered", "arrived"];
  
  if (config?.triage_enabled !== false) base.push("triage");
  if (config?.vitals_required !== false) base.push("vitals");
  
  base.push("doctor");
  
  if (config?.lab_enabled !== false) base.push("lab");
  if (config?.pharmacy_enabled !== false) base.push("pharmacy");
  if (config?.billing_enabled !== false) base.push("billing");
  
  base.push("complete");
  return base;
}

/**
 * Get the next workflow status after the current one.
 */
export function getNextStatus(
  current: VisitStatus,
  config?: Partial<WorkflowConfig> | null
): VisitStatus | null {
  const steps = getActiveWorkflowSteps(config);
  const idx = steps.indexOf(current);
  if (idx === -1 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
}
