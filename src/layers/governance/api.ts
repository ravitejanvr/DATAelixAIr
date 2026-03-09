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
  // Clinical workflow events
  "patient_created", "visit_registered", "visit_status_changed",
  "consultation_started", "consultation_updated", "consultation_finalized",
  "prescription_added", "prescription_modified", "lab_ordered", "invoice_generated",
  // AI events
  "ai_pipeline_invoked", "ai_output_generated", "ai_output_edited",
  "ai_suggestion_accepted", "ai_suggestion_rejected",
  // Safety events
  "safety_check_performed", "safety_alert_triggered", "safety_override_confirmed",
  "emergency_pattern_detected", "allergy_conflict_detected", "interaction_detected",
  // Governance actions
  "pilot_approved", "pilot_rejected", "clinic_suspended", "clinic_activated",
  "role_assigned", "role_revoked", "config_changed",
  // Report/delivery events
  "report_generated", "report_delivered", "prescription_delivered",
  // Session events
  "session_started", "session_completed", "user_login", "user_logout",
] as const;
export type GovernanceEventType = typeof GOVERNANCE_EVENT_TYPES[number];

// ────────────────────────────────────────────────────────────────────────────
// Audit Logging Functions
// ────────────────────────────────────────────────────────────────────────────

import { logAuditEvent as _logAudit, type AuditEntry } from "@/layers/monitoring/api";

export interface AuditLogEntry extends AuditEntry {
  event_type: GovernanceEventType;
  clinic_id?: string;
}

/**
 * Log a governance audit event (delegates to monitoring layer).
 */
export async function logGovernanceEvent(entry: AuditLogEntry): Promise<void> {
  await _logAudit({
    event_type: entry.event_type,
    actor_id: entry.actor_id,
    target_type: entry.target_type || "",
    target_id: entry.target_id || "",
    metadata: {
      ...(entry.metadata || {}),
      clinic_id: entry.clinic_id,
    },
  });
}

/**
 * Log a safety override with full traceability.
 */
export async function logSafetyOverride(
  actorId: string,
  clinicId: string | null,
  overrideReason: string,
  acknowledgedAlerts: string[],
  consultationId?: string
): Promise<void> {
  await logGovernanceEvent({
    event_type: "safety_override_confirmed",
    actor_id: actorId,
    target_type: "consultation",
    target_id: consultationId,
    clinic_id: clinicId || undefined,
    metadata: {
      override_reason: overrideReason,
      acknowledged_alerts: acknowledgedAlerts,
      acknowledged_count: acknowledgedAlerts.length,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Log an AI pipeline invocation for traceability.
 */
export async function logAIPipelineInvocation(
  actorId: string,
  clinicId: string | null,
  pipelineStages: string[],
  durationMs: number,
  success: boolean,
  modelVersions?: Record<string, string>
): Promise<void> {
  await logGovernanceEvent({
    event_type: "ai_pipeline_invoked",
    actor_id: actorId,
    clinic_id: clinicId || undefined,
    metadata: {
      stages_executed: pipelineStages,
      duration_ms: durationMs,
      success,
      model_versions: modelVersions || {},
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Log when a clinician edits AI-generated output.
 */
export async function logAIOutputEdit(
  actorId: string,
  clinicId: string | null,
  editStage: "transcript" | "extraction" | "soap" | "prescription",
  editMetrics: { originalLength: number; editedLength: number; significantChange: boolean },
  consultationId?: string
): Promise<void> {
  await logGovernanceEvent({
    event_type: "ai_output_edited",
    actor_id: actorId,
    target_type: "consultation",
    target_id: consultationId,
    clinic_id: clinicId || undefined,
    metadata: {
      edit_stage: editStage,
      original_length: editMetrics.originalLength,
      edited_length: editMetrics.editedLength,
      significant_change: editMetrics.significantChange,
      edit_ratio: editMetrics.originalLength > 0
        ? Math.round(((editMetrics.editedLength - editMetrics.originalLength) / editMetrics.originalLength) * 100)
        : 0,
      timestamp: new Date().toISOString(),
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Compliance Checks
// ────────────────────────────────────────────────────────────────────────────

export interface ComplianceCheck {
  check: string;
  status: "pass" | "fail" | "warning";
  message: string;
}

/**
 * Run basic compliance checks for a consultation before finalization.
 */
export function runComplianceChecks(
  consultation: {
    doctor_id: string;
    patient_id: string;
    review_confirmed?: boolean;
    safety_flags?: unknown[];
    raw_transcript?: string;
    soap_subjective?: string;
  }
): ComplianceCheck[] {
  const checks: ComplianceCheck[] = [];

  // Doctor review required
  checks.push({
    check: "clinician_review",
    status: consultation.review_confirmed ? "pass" : "fail",
    message: consultation.review_confirmed
      ? "Clinician review confirmed"
      : "Clinician review not yet confirmed",
  });

  // Safety flags acknowledged
  const safetyFlags = consultation.safety_flags || [];
  checks.push({
    check: "safety_review",
    status: safetyFlags.length === 0 ? "pass" : "warning",
    message: safetyFlags.length === 0
      ? "No safety alerts"
      : `${safetyFlags.length} safety alert(s) present`,
  });

  // Minimum documentation
  const hasTranscript = (consultation.raw_transcript?.length || 0) > 20;
  const hasSoap = (consultation.soap_subjective?.length || 0) > 10;
  checks.push({
    check: "documentation_completeness",
    status: hasTranscript && hasSoap ? "pass" : "warning",
    message: hasTranscript && hasSoap
      ? "Documentation complete"
      : "Documentation may be incomplete",
  });

  return checks;
}

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
