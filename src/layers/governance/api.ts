/**
 * Layer 9: Governance API
 * 
 * Manages pilot approval workflows, clinic lifecycle,
 * and role-based access control.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client, RLS policies
 *   - Layer 8 (Monitoring): Audit logging for governance actions
 * 
 * Consumers:
 *   - Layer 1 (UI): Platform admin dashboard, Auth routing
 */

import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const CLINICAL_ROLES: AppRole[] = [
  "doctor", "nurse", "clinic_admin", "receptionist", 
  "pharmacist", "allied_health", "lab", "care_coordinator", "front_desk"
];

export const ROLE_LABELS: Record<AppRole, string> = {
  doctor: "Doctor",
  nurse: "Nurse",
  clinic_admin: "Clinic Admin",
  receptionist: "Receptionist",
  pharmacist: "Pharmacist",
  patient: "Patient",
  admin: "Admin",
  allied_health: "Allied Health",
  lab: "Lab",
  care_coordinator: "Care Coordinator",
  front_desk: "Front Desk",
  platform_admin: "Platform Admin",
};

/** Maps role to the default route after login */
export function getDefaultRouteForRole(role: AppRole | null): string {
  switch (role) {
    case "platform_admin": return "/platform-admin";
    case "clinic_admin": return "/dashboard";
    case "doctor": return "/dashboard";
    case "nurse": return "/vitals";
    case "receptionist": return "/dashboard";
    case "patient": return "/patient-portal";
    case "pharmacist": return "/prescriptions";
    default: return "/dashboard";
  }
}

export const PILOT_STATUSES = ["pending", "approved", "rejected"] as const;
export type PilotStatus = typeof PILOT_STATUSES[number];

/**
 * AI Model Version Registry
 * Tracks which models power each pipeline agent for governance/audit.
 */
export interface ModelVersion {
  agent: string;
  model: string;
  version: string;
  provider: string;
  lastUpdated: string;
}

export const MODEL_REGISTRY: ModelVersion[] = [
  { agent: "Transcript Stabilizer", model: "gemini-3-flash-preview", version: "3.0-flash", provider: "Google", lastUpdated: "2026-03-01" },
  { agent: "Patient Data Extractor", model: "gemini-3-flash-preview", version: "3.0-flash", provider: "Google", lastUpdated: "2026-03-01" },
  { agent: "Clinical Safety Controller", model: "gemini-3-flash-preview", version: "3.0-flash", provider: "Google", lastUpdated: "2026-03-01" },
  { agent: "SOAP Generator", model: "gemini-3-flash-preview", version: "3.0-flash", provider: "Google", lastUpdated: "2026-03-01" },
  { agent: "Evidence Summarizer", model: "gemini-2.5-flash", version: "2.5-flash", provider: "Google", lastUpdated: "2026-02-15" },
  { agent: "Patient Explainer", model: "gemini-3-flash-preview", version: "3.0-flash", provider: "Google", lastUpdated: "2026-03-01" },
  { agent: "Clinical Translator", model: "gemini-3-flash-preview", version: "3.0-flash", provider: "Google", lastUpdated: "2026-03-01" },
];

/** Governance audit event types */
export const GOVERNANCE_EVENT_TYPES = [
  "pilot_approved", "pilot_rejected", "clinic_suspended", "clinic_activated",
  "role_assigned", "role_revoked", "ai_output_generated", "ai_output_edited",
  "session_completed", "safety_override", "config_changed",
] as const;
export type GovernanceEventType = typeof GOVERNANCE_EVENT_TYPES[number];

/** Data isolation check: returns roles that have access to a given resource type */
/** Data isolation check: returns roles that have access to a given resource type */
export const DATA_ACCESS_MATRIX: Record<string, AppRole[]> = {
  consultations: ["doctor", "nurse", "allied_health", "pharmacist", "lab", "care_coordinator", "clinic_admin"],
  patients: ["doctor", "nurse", "allied_health", "pharmacist", "lab", "care_coordinator", "clinic_admin", "receptionist", "front_desk"],
  prescriptions: ["doctor", "pharmacist", "clinic_admin"],
  vitals: ["doctor", "nurse", "clinic_admin"],
  lab_orders: ["doctor", "lab", "clinic_admin"],
  lab_results: ["doctor", "lab", "clinic_admin"],
  invoices: ["doctor", "receptionist", "clinic_admin"],
  audit_logs: ["platform_admin"],
  monitoring_events: ["platform_admin"],
  pilot_requests: ["platform_admin"],
  clinics: ["platform_admin"],
  clinic_members: ["clinic_admin", "platform_admin"],
};

/**
 * Multi-tenancy isolation model:
 * - All clinical tables include clinic_id
 * - RLS policies enforce tenant isolation via is_clinic_member()
 * - clinic_members table supports multi-clinic user membership
 * - profiles.clinic_id remains as primary/default clinic shortcut
 */
export const TENANT_ISOLATED_TABLES = [
  "patients", "patient_visits", "consultations", "prescriptions",
  "lab_orders", "lab_results", "vitals", "triage", "invoices",
  "doctor_favorites", "doctor_learning_signals", "doctor_preferences",
  "clinic_workflow_config", "audit_logs", "clinic_members",
] as const;
