/**
 * Layer 8: Continuous Monitoring API
 * 
 * Tracks AI performance, doctor corrections, safety alerts,
 * transcription confidence, system errors, and workflow bottlenecks.
 * All clinical mutations should be logged through this layer.
 * No PHI in logs — only event types, timing, and anonymized metrics.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client, monitoring_events & audit_logs tables
 * 
 * Consumers:
 *   - Layer 1 (UI): Platform Admin monitoring dashboard
 *   - Layer 2 (Workflow): Pipeline performance tracking
 *   - Layer 9 (Governance): Compliance audit trail
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Audit Logging ──────────────────────────────────────────

export interface AuditEntry {
  actor_id: string;
  event_type: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event. Fire-and-forget by default.
 */
export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      actor_id: entry.actor_id,
      event_type: entry.event_type,
      target_type: entry.target_type || "",
      target_id: entry.target_id || "",
      metadata: entry.metadata || {},
    });
  } catch (err) {
    console.error("[Monitoring] Audit log failed:", err);
  }
}

// ─── Monitoring Event Types ─────────────────────────────────

export type MonitoringEventType =
  | "pipeline_step_completed"
  | "pipeline_step_failed"
  | "safety_alert_triggered"
  | "session_completed"
  | "transcription_confidence"
  | "system_error"
  | "copilot_graph_query"
  | "copilot_guideline_query"
  | "copilot_action"
  | "action_bar_click"
  | "care_plan_generation";

export interface MonitoringEvent {
  event_type: MonitoringEventType;
  agent_name?: string;
  duration_ms?: number;
  success?: boolean;
  metadata?: Record<string, any>;
}

// ─── Metric Emission ────────────────────────────────────────

/**
 * Emit a monitoring event. Fire-and-forget — never blocks clinical workflow.
 * No PHI is stored — only agent names, timing, success status, and anonymized counts.
 */
export function emitMonitoringEvent(event: MonitoringEvent): void {
  try {
    supabase.from("monitoring_events" as any).insert({
      event_type: event.event_type,
      agent_name: event.agent_name || null,
      duration_ms: event.duration_ms || null,
      success: event.success !== false,
      metadata: event.metadata || {},
    });
  } catch (err) {
    console.error("[Monitoring] Event emission failed:", err);
  }
}

// ─── Pipeline Step Timer ────────────────────────────────────

/**
 * Creates a timer that auto-emits a monitoring event when stopped.
 * Usage:
 *   const timer = startPipelineTimer("stabilizer");
 *   // ... do work ...
 *   timer.stop(true); // success
 *   timer.stop(false, { error: "timeout" }); // failure
 */
export function startPipelineTimer(agentName: string) {
  const startTime = performance.now();
  return {
    stop(success: boolean, extraMetadata?: Record<string, any>) {
      const durationMs = Math.round(performance.now() - startTime);
      emitMonitoringEvent({
        event_type: success ? "pipeline_step_completed" : "pipeline_step_failed",
        agent_name: agentName,
        duration_ms: durationMs,
        success,
        metadata: { ...extraMetadata },
      });
    },
  };
}

/**
 * Emit a safety alert monitoring event (no PHI — only alert types and counts).
 */
export function emitSafetyAlertMetric(alertCounts: {
  interactions: number;
  allergies: number;
  dose_warnings: number;
  vitals_dangers: number;
  emergency_patterns: number;
}): void {
  const totalAlerts = Object.values(alertCounts).reduce((a, b) => a + b, 0);
  if (totalAlerts === 0) return;
  emitMonitoringEvent({
    event_type: "safety_alert_triggered",
    agent_name: "safety_controller",
    metadata: { ...alertCounts, total_alerts: totalAlerts },
  });
}

/**
 * Emit session completion metric with anonymized summary.
 */
export function emitSessionCompletedMetric(meta: {
  transcript_edited: boolean;
  extraction_corrected: boolean;
  soap_edited: boolean;
  safety_alerts_count: number;
  total_duration_ms: number;
}): void {
  emitMonitoringEvent({
    event_type: "session_completed",
    agent_name: "pipeline",
    duration_ms: meta.total_duration_ms,
    metadata: {
      transcript_accepted_as_is: !meta.transcript_edited,
      extraction_accepted_as_is: !meta.extraction_corrected,
      soap_accepted_as_is: !meta.soap_edited,
      safety_alerts_count: meta.safety_alerts_count,
    },
  });
}

// ─── Dashboard Query Helpers (Platform Admin) ───────────────

export interface MonitoringDashboardData {
  totalSessions: number;
  aiAcceptanceRate: number;
  avgSoapDurationMs: number;
  avgTranscriptionConfidence: number;
  safetyAlertRate: number;
  errorRate: number;
  recentEvents: Array<{
    event_type: string;
    agent_name: string | null;
    duration_ms: number | null;
    success: boolean;
    metadata: Record<string, any>;
    created_at: string;
  }>;
  agentPerformance: Array<{
    agent: string;
    avgDuration: number;
    successRate: number;
    count: number;
  }>;
}

/**
 * Fetch aggregated monitoring dashboard data for platform admins.
 * Queries monitoring_events table — no PHI accessed.
 */
export async function fetchMonitoringDashboard(
  daysBack: number = 30
): Promise<MonitoringDashboardData> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  const sinceIso = since.toISOString();

  const { data: events } = await supabase
    .from("monitoring_events" as any)
    .select("*")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1000) as any;

  const allEvents: any[] = events || [];

  // Sessions completed
  const sessions = allEvents.filter(e => e.event_type === "session_completed");
  const totalSessions = sessions.length;

  // AI acceptance rate (sessions where transcript+extraction+soap were accepted as-is)
  const fullyAccepted = sessions.filter(e => {
    const m = e.metadata || {};
    return m.transcript_accepted_as_is && m.extraction_accepted_as_is && m.soap_accepted_as_is;
  });
  const aiAcceptanceRate = totalSessions > 0 ? Math.round((fullyAccepted.length / totalSessions) * 100) : 0;

  // Average SOAP generation time
  const soapEvents = allEvents.filter(e => e.agent_name === "documentation" && e.duration_ms);
  const avgSoapDurationMs = soapEvents.length > 0
    ? Math.round(soapEvents.reduce((s, e) => s + e.duration_ms, 0) / soapEvents.length)
    : 0;

  // Transcription confidence
  const confEvents = allEvents.filter(e => e.event_type === "transcription_confidence" && e.metadata?.confidence);
  const avgTranscriptionConfidence = confEvents.length > 0
    ? Math.round(confEvents.reduce((s, e) => s + (e.metadata.confidence || 0), 0) / confEvents.length)
    : 0;

  // Safety alert rate
  const safetyEvents = allEvents.filter(e => e.event_type === "safety_alert_triggered");
  const safetyAlertRate = totalSessions > 0 ? Math.round((safetyEvents.length / totalSessions) * 100) : 0;

  // Error rate
  const failedEvents = allEvents.filter(e => !e.success);
  const errorRate = allEvents.length > 0 ? Math.round((failedEvents.length / allEvents.length) * 100) : 0;

  // Per-agent performance
  const agentMap: Record<string, { totalDuration: number; successes: number; total: number }> = {};
  for (const e of allEvents.filter(ev => ev.agent_name)) {
    const a = e.agent_name!;
    if (!agentMap[a]) agentMap[a] = { totalDuration: 0, successes: 0, total: 0 };
    agentMap[a].total++;
    if (e.success) agentMap[a].successes++;
    if (e.duration_ms) agentMap[a].totalDuration += e.duration_ms;
  }
  const agentPerformance = Object.entries(agentMap).map(([agent, d]) => ({
    agent,
    avgDuration: d.total > 0 ? Math.round(d.totalDuration / d.total) : 0,
    successRate: d.total > 0 ? Math.round((d.successes / d.total) * 100) : 0,
    count: d.total,
  }));

  return {
    totalSessions,
    aiAcceptanceRate,
    avgSoapDurationMs,
    avgTranscriptionConfidence,
    safetyAlertRate,
    errorRate,
    recentEvents: allEvents.slice(0, 50),
    agentPerformance,
  };
}
