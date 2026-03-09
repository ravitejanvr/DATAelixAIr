/**
 * Ethics & Compliance Layer API
 * 
 * Ensures responsible AI usage, patient privacy, bias monitoring,
 * compliance logging, and role-based access enforcement.
 * 
 * Regulatory Alignment:
 *   - India DPDP 2023 (Digital Personal Data Protection)
 *   - HIPAA (Health Insurance Portability and Accountability Act)
 *   - EU AI Act (Article 6 — High-Risk AI Systems)
 *   - WHO AI Ethics Guidelines
 *   - ISO 27001 principles
 * 
 * Core Principles:
 *   - AI transparency: All AI outputs clearly labeled
 *   - Patient data minimization: Only clinically necessary data collected
 *   - Bias monitoring: Track AI output patterns across demographics
 *   - Immutable audit trail: Every significant action logged
 *   - Role-based access: Enforced via RLS + has_role() at DB level
 */

// ────────────────────────────────────────────────────────────────────────────
// AI Transparency
// ────────────────────────────────────────────────────────────────────────────

export const AI_TRANSPARENCY_RULES = {
  /** Every AI-generated output must display this label */
  AI_DRAFT_LABEL: "AI Draft — Clinician Review Required",

  /** AI confidence must be shown for clinical suggestions */
  CONFIDENCE_REQUIRED: true,

  /** AI must never present itself as final medical authority */
  NO_AUTONOMOUS_DECISIONS: true,

  /** AI model version must be logged for every invocation */
  MODEL_VERSION_LOGGING: true,

  /** AI-generated summaries limited to prevent information overload */
  MAX_SUMMARY_SENTENCES: 3,

  /** Maximum citations per consultation */
  MAX_CITATIONS: 6,
} as const;

export interface AITransparencyIndicator {
  component: string;
  isAIGenerated: boolean;
  modelUsed?: string;
  confidenceLevel?: "high" | "moderate" | "low";
  reviewStatus: "pending" | "reviewed" | "approved" | "rejected";
  generatedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Data Protection & Privacy
// ────────────────────────────────────────────────────────────────────────────

export const DATA_PROTECTION_POLICY = {
  /** Excluded from storage and exports */
  EXCLUDED_FIELDS: [
    "aadhaar_number",
    "national_id",
    "home_address",
    "bank_details",
    "insurance_number",
  ],

  /** Stored as hash only */
  HASHED_FIELDS: ["aadhaar_hash"],

  /** Minimal data for clinical workflow */
  REQUIRED_CLINICAL_FIELDS: [
    "name",
    "age",
    "gender",
    "chief_complaint",
    "allergies",
    "current_medications",
  ],

  /** Data retention policy */
  RETENTION: {
    consultation_records: "indefinite", // Clinical records must be retained
    audit_logs: "7_years",
    monitoring_events: "1_year",
    learning_signals: "3_years",
    session_storage: "session_only",
  },

  /** Consent requirements */
  CONSENT: {
    voice_recording: "explicit_per_session",
    ai_processing: "informed_once",
    data_sharing: "explicit_opt_in",
    research_use: "not_collected",
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Bias Monitoring
// ────────────────────────────────────────────────────────────────────────────

export interface BiasMonitoringMetric {
  dimension: "age_group" | "gender" | "language" | "region";
  metric: string;
  value: number;
  baseline: number;
  deviation_percent: number;
  alert: boolean;
}

export interface BiasReport {
  period: { start: string; end: string };
  total_consultations: number;
  metrics: BiasMonitoringMetric[];
  recommendations: string[];
  generated_at: string;
}

/**
 * Dimensions to monitor for AI bias.
 * Tracked anonymously — no individual patient identification.
 */
export const BIAS_MONITORING_DIMENSIONS = {
  age_groups: ["0-12", "13-17", "18-30", "31-50", "51-65", "65+"],
  genders: ["male", "female", "other"],
  languages: ["english", "hindi", "telugu", "urdu", "tamil", "kannada"],
  metrics_tracked: [
    "ai_confidence_score",
    "safety_alert_rate",
    "doctor_override_rate",
    "extraction_accuracy",
    "transcript_edit_ratio",
  ],
} as const;

// ────────────────────────────────────────────────────────────────────────────
// Compliance Logging
// ────────────────────────────────────────────────────────────────────────────

export interface ComplianceEvent {
  event_type: ComplianceEventType;
  actor_id: string;
  resource_type: string;
  resource_id?: string;
  details: string;
  regulatory_reference?: string;
  timestamp: string;
}

export type ComplianceEventType =
  | "data_access"
  | "data_export"
  | "data_deletion_request"
  | "consent_recorded"
  | "consent_withdrawn"
  | "ai_decision_logged"
  | "safety_override"
  | "role_escalation"
  | "phi_access"
  | "audit_review";

export const REGULATORY_REFERENCES: Record<string, string> = {
  data_access: "DPDP 2023 §4 — Purpose limitation",
  data_export: "DPDP 2023 §17 — Cross-border data transfer",
  data_deletion_request: "DPDP 2023 §12 — Right to erasure",
  consent_recorded: "DPDP 2023 §6 — Consent",
  ai_decision_logged: "EU AI Act Art. 14 — Human oversight",
  safety_override: "EU AI Act Art. 14 — Human intervention capability",
  role_escalation: "ISO 27001 A.9 — Access control",
  phi_access: "HIPAA §164.312 — Access controls",
};

// ────────────────────────────────────────────────────────────────────────────
// RBAC Enforcement
// ────────────────────────────────────────────────────────────────────────────

export interface AccessControlRule {
  resource: string;
  action: "create" | "read" | "update" | "delete";
  allowedRoles: string[];
  requireClinicMembership: boolean;
  auditRequired: boolean;
}

/**
 * Access control matrix enforced at DB level via RLS.
 * This client-side mirror is for UI route gating only.
 */
export const ACCESS_CONTROL_RULES: AccessControlRule[] = [
  // Patient data
  { resource: "patients", action: "create", allowedRoles: ["doctor", "receptionist", "front_desk", "clinic_admin"], requireClinicMembership: true, auditRequired: true },
  { resource: "patients", action: "read", allowedRoles: ["doctor", "nurse", "allied_health", "pharmacist", "lab", "care_coordinator", "clinic_admin", "receptionist", "front_desk"], requireClinicMembership: true, auditRequired: false },
  { resource: "patients", action: "update", allowedRoles: ["doctor"], requireClinicMembership: true, auditRequired: true },
  { resource: "patients", action: "delete", allowedRoles: ["doctor"], requireClinicMembership: true, auditRequired: true },

  // Consultations
  { resource: "consultations", action: "create", allowedRoles: ["doctor"], requireClinicMembership: true, auditRequired: true },
  { resource: "consultations", action: "read", allowedRoles: ["doctor", "nurse", "allied_health", "pharmacist", "lab", "care_coordinator"], requireClinicMembership: true, auditRequired: false },
  { resource: "consultations", action: "update", allowedRoles: ["doctor"], requireClinicMembership: true, auditRequired: true },

  // Prescriptions
  { resource: "prescriptions", action: "create", allowedRoles: ["doctor"], requireClinicMembership: true, auditRequired: true },
  { resource: "prescriptions", action: "read", allowedRoles: ["doctor", "pharmacist"], requireClinicMembership: true, auditRequired: false },

  // Lab orders
  { resource: "lab_orders", action: "create", allowedRoles: ["doctor"], requireClinicMembership: true, auditRequired: true },
  { resource: "lab_orders", action: "read", allowedRoles: ["doctor", "lab", "clinic_admin"], requireClinicMembership: true, auditRequired: false },

  // Audit logs
  { resource: "audit_logs", action: "read", allowedRoles: ["platform_admin"], requireClinicMembership: false, auditRequired: true },

  // Platform management
  { resource: "clinics", action: "create", allowedRoles: ["platform_admin"], requireClinicMembership: false, auditRequired: true },
  { resource: "clinics", action: "update", allowedRoles: ["platform_admin"], requireClinicMembership: false, auditRequired: true },
];

/**
 * Check if a role has access to a resource action (client-side UI gating).
 * Actual enforcement is at DB level via RLS policies.
 */
export function hasAccess(
  role: string,
  resource: string,
  action: "create" | "read" | "update" | "delete"
): boolean {
  const rule = ACCESS_CONTROL_RULES.find(
    (r) => r.resource === resource && r.action === action
  );
  if (!rule) return false;
  return rule.allowedRoles.includes(role);
}

/**
 * Get all resources a role can access.
 */
export function getAccessibleResources(role: string): string[] {
  const resources = new Set<string>();
  ACCESS_CONTROL_RULES
    .filter((r) => r.allowedRoles.includes(role))
    .forEach((r) => resources.add(r.resource));
  return [...resources];
}

// ────────────────────────────────────────────────────────────────────────────
// Responsible AI Checklist
// ────────────────────────────────────────────────────────────────────────────

export interface ResponsibleAICheck {
  principle: string;
  description: string;
  implemented: boolean;
  enforcement: "technical" | "policy" | "both";
}

export const RESPONSIBLE_AI_CHECKLIST: ResponsibleAICheck[] = [
  { principle: "Human Oversight", description: "All AI outputs require clinician review before finalization", implemented: true, enforcement: "both" },
  { principle: "Transparency", description: "AI-generated content clearly labeled with confidence indicators", implemented: true, enforcement: "technical" },
  { principle: "Data Minimization", description: "Only clinically necessary data collected and processed", implemented: true, enforcement: "both" },
  { principle: "Bias Monitoring", description: "AI output patterns tracked across demographics", implemented: true, enforcement: "technical" },
  { principle: "Explainability", description: "Evidence citations provided for AI suggestions", implemented: true, enforcement: "technical" },
  { principle: "Safety First", description: "Automated safety checks before any clinical output", implemented: true, enforcement: "technical" },
  { principle: "Audit Trail", description: "Immutable logging of all AI decisions and overrides", implemented: true, enforcement: "technical" },
  { principle: "Conservative Language", description: "AI uses tentative phrasing — 'Likely', 'Consider', 'Provisional'", implemented: true, enforcement: "policy" },
  { principle: "No Autonomous Decisions", description: "AI never makes final clinical decisions without clinician approval", implemented: true, enforcement: "both" },
  { principle: "Right to Explanation", description: "Patients can request plain-language explanation of AI involvement", implemented: true, enforcement: "policy" },
];
