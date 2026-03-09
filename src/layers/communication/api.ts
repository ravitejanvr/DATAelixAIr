/**
 * Communication Layer API
 * 
 * Defines notification trigger events, channel routing, and message templates
 * for patient communication throughout the visit lifecycle.
 * 
 * Channels: SMS, WhatsApp, Email (future)
 * Provider: MSG91 (default), extensible
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase Edge Functions (send-patient-update)
 *   - Layer 2 (Workflow): Visit status transitions trigger notifications
 * 
 * Consumers:
 *   - Layer 2 (Workflow): update-visit-status calls notification triggers
 *   - Layer 1 (UI): Notification logs display
 */

import { supabase } from "@/integrations/supabase/client";

// ────────────────────────────────────────────────────────────────────────────
// Notification Trigger Events
// ────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_EVENTS = {
  // Visit lifecycle events
  VISIT_REGISTERED: "visit_registered",
  VISIT_CONFIRMED: "visit_confirmed",
  QUEUE_CALLED: "queue_called",
  CONSULTATION_STARTED: "consultation_started",
  CONSULTATION_COMPLETE: "consultation_complete",
  
  // Clinical output events
  PRESCRIPTION_READY: "prescription_ready",
  LAB_ORDERED: "lab_ordered",
  LAB_RESULTS_READY: "lab_results_ready",
  REPORT_GENERATED: "report_generated",
  
  // Follow-up events
  FOLLOWUP_REMINDER: "followup_reminder",
  MEDICATION_REMINDER: "medication_reminder",
  
  // Billing events
  INVOICE_GENERATED: "invoice_generated",
  PAYMENT_RECEIVED: "payment_received",
} as const;

export type NotificationEvent = typeof NOTIFICATION_EVENTS[keyof typeof NOTIFICATION_EVENTS];

// ────────────────────────────────────────────────────────────────────────────
// Channel Configuration
// ────────────────────────────────────────────────────────────────────────────

export type NotificationChannel = "sms" | "whatsapp" | "email";

export interface ChannelConfig {
  channel: NotificationChannel;
  enabled: boolean;
  priority: number; // Lower = higher priority
  fallbackTo?: NotificationChannel;
}

export const DEFAULT_CHANNEL_PRIORITY: ChannelConfig[] = [
  { channel: "whatsapp", enabled: true, priority: 1, fallbackTo: "sms" },
  { channel: "sms", enabled: true, priority: 2 },
  { channel: "email", enabled: false, priority: 3 },
];

// ────────────────────────────────────────────────────────────────────────────
// Notification Templates
// ────────────────────────────────────────────────────────────────────────────

export interface NotificationTemplate {
  event: NotificationEvent;
  name: string;
  defaultMessage: string;
  variables: string[];
}

export const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    event: NOTIFICATION_EVENTS.VISIT_REGISTERED,
    name: "Visit Registration",
    defaultMessage: "Hello {patient_name}, you have been registered at {clinic_name}. Your token number is {token}. Track your visit: {visit_link}",
    variables: ["patient_name", "clinic_name", "token", "visit_link"],
  },
  {
    event: NOTIFICATION_EVENTS.VISIT_CONFIRMED,
    name: "Visit Confirmation",
    defaultMessage: "Hi {patient_name}, your arrival at {clinic_name} has been confirmed. Token: {token}. Estimated wait: {wait_time} mins.",
    variables: ["patient_name", "clinic_name", "token", "wait_time"],
  },
  {
    event: NOTIFICATION_EVENTS.QUEUE_CALLED,
    name: "Queue Called",
    defaultMessage: "{patient_name}, please proceed to the consultation room. You are next!",
    variables: ["patient_name"],
  },
  {
    event: NOTIFICATION_EVENTS.CONSULTATION_COMPLETE,
    name: "Consultation Complete",
    defaultMessage: "Hi {patient_name}, your consultation with {doctor_name} is complete. Your prescription and report will be shared shortly.",
    variables: ["patient_name", "doctor_name"],
  },
  {
    event: NOTIFICATION_EVENTS.PRESCRIPTION_READY,
    name: "Prescription Ready",
    defaultMessage: "{patient_name}, your prescription is ready. Please collect from {pharmacy_name} or view online: {report_link}",
    variables: ["patient_name", "pharmacy_name", "report_link"],
  },
  {
    event: NOTIFICATION_EVENTS.LAB_ORDERED,
    name: "Lab Test Ordered",
    defaultMessage: "Hi {patient_name}, lab tests have been ordered by {doctor_name}. Please visit the lab at your convenience.",
    variables: ["patient_name", "doctor_name"],
  },
  {
    event: NOTIFICATION_EVENTS.LAB_RESULTS_READY,
    name: "Lab Results Ready",
    defaultMessage: "{patient_name}, your lab results are ready. View online: {report_link} or collect from {clinic_name}.",
    variables: ["patient_name", "report_link", "clinic_name"],
  },
  {
    event: NOTIFICATION_EVENTS.REPORT_GENERATED,
    name: "Report Generated",
    defaultMessage: "Hi {patient_name}, your clinical report from {clinic_name} is ready. View: {report_link}",
    variables: ["patient_name", "clinic_name", "report_link"],
  },
  {
    event: NOTIFICATION_EVENTS.FOLLOWUP_REMINDER,
    name: "Follow-up Reminder",
    defaultMessage: "Hi {patient_name}, this is a reminder for your follow-up visit at {clinic_name} on {followup_date}.",
    variables: ["patient_name", "clinic_name", "followup_date"],
  },
  {
    event: NOTIFICATION_EVENTS.INVOICE_GENERATED,
    name: "Invoice Generated",
    defaultMessage: "{patient_name}, your invoice of ₹{amount} from {clinic_name} is ready. Payment methods: Cash/UPI/Card.",
    variables: ["patient_name", "amount", "clinic_name"],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Notification API Functions
// ────────────────────────────────────────────────────────────────────────────

export interface SendNotificationParams {
  patientId: string;
  visitId?: string;
  clinicId?: string;
  triggerEvent: NotificationEvent;
  extraVars?: Record<string, string>;
}

export interface NotificationResult {
  status: "sent" | "queued" | "failed" | "skipped";
  reason?: string;
  messageSent?: string;
}

/**
 * Send a notification to a patient via the configured channel.
 * Calls the send-patient-update edge function.
 */
export async function sendPatientNotification(
  params: SendNotificationParams
): Promise<NotificationResult> {
  const { patientId, visitId, clinicId, triggerEvent, extraVars } = params;

  const { data, error } = await supabase.functions.invoke("send-patient-update", {
    body: {
      patient_id: patientId,
      visit_id: visitId,
      clinic_id: clinicId,
      trigger_event: triggerEvent,
      extra_vars: extraVars,
    },
  });

  if (error) {
    console.error("Notification send error:", error);
    return { status: "failed", reason: error.message };
  }

  return {
    status: data?.status || "queued",
    reason: data?.reason,
    messageSent: data?.message_sent,
  };
}

/**
 * Get notification logs for a patient or visit.
 */
export async function getNotificationLogs(
  patientId: string,
  visitId?: string,
  limit = 20
) {
  let query = supabase
    .from("notification_logs")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (visitId) {
    query = query.eq("visit_id", visitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch notification logs:", error);
    return [];
  }

  return data || [];
}

// ────────────────────────────────────────────────────────────────────────────
// Event-to-Status Mapping for Automatic Triggers
// ────────────────────────────────────────────────────────────────────────────

export const STATUS_TO_NOTIFICATION: Record<string, NotificationEvent | null> = {
  registered: NOTIFICATION_EVENTS.VISIT_REGISTERED,
  arrived: NOTIFICATION_EVENTS.VISIT_CONFIRMED,
  doctor: NOTIFICATION_EVENTS.QUEUE_CALLED,
  complete: NOTIFICATION_EVENTS.CONSULTATION_COMPLETE,
  billing: NOTIFICATION_EVENTS.INVOICE_GENERATED,
};

/**
 * Get the notification event for a visit status transition.
 */
export function getNotificationForStatus(newStatus: string): NotificationEvent | null {
  return STATUS_TO_NOTIFICATION[newStatus] || null;
}
