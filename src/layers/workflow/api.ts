/**
 * Layer 2: Clinical Workflow API
 * 
 * Manages patient intake, vitals recording, visit tracking,
 * prescription management, and billing.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client, Auth context
 *   - Layer 5 (Safety): Drug safety checks for prescriptions
 *   - Layer 8 (Monitoring): Audit logging for mutations
 * 
 * Consumers:
 *   - Layer 1 (UI): Clinical workspace pages
 */

// Shared types for the workflow layer
export interface VitalEntry {
  bp_systolic: string;
  bp_diastolic: string;
  pulse: string;
  temperature: string;
  spo2: string;
  weight_kg: string;
  blood_sugar: string;
  notes: string;
}

export interface LineItem {
  description: string;
  amount: string;
}

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

export const VISIT_STATUSES = [
  "registered", "vitals", "doctor", "lab", "pharmacy", "billing", "complete"
] as const;

export type VisitStatus = typeof VISIT_STATUSES[number];

export const VISIT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  registered: { label: "Registered", color: "bg-blue-100 text-blue-800 border-blue-200" },
  vitals: { label: "Vitals", color: "bg-purple-100 text-purple-800 border-purple-200" },
  doctor: { label: "Doctor", color: "bg-primary/10 text-primary border-primary/20" },
  lab: { label: "Lab", color: "bg-amber-100 text-amber-800 border-amber-200" },
  pharmacy: { label: "Pharmacy", color: "bg-orange-100 text-orange-800 border-orange-200" },
  billing: { label: "Billing", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  complete: { label: "Complete", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

export const EMPTY_VITALS: VitalEntry = {
  bp_systolic: "", bp_diastolic: "", pulse: "", temperature: "",
  spo2: "", weight_kg: "", blood_sugar: "", notes: "",
};
