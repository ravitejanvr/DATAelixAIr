/**
 * Clinical Oversight Engine
 * 
 * Aggregates safety signals, audit events, and quality metrics
 * across the pipeline for governance and accountability.
 * 
 * Provides a single view of all safety-relevant decisions made
 * during a consultation, including overrides and flags.
 */

export interface OversightEvent {
  event_type: 
    | "safety_flag_raised"
    | "safety_override"
    | "guideline_deviation"
    | "context_incomplete"
    | "hypothesis_low_confidence"
    | "pipeline_error"
    | "dangerous_diagnosis_injected"
    | "epidemiological_cluster"
    | "cognitive_pruning"
    | "candidate_fallback_triggered"
    | "candidate_fallback_v2_triggered"
    | "phase5_context_expansion"
    | "context_aware_safety";
  severity: "info" | "warning" | "critical";
  stage: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface OversightReport {
  visit_id: string | null;
  consultation_id: string | null;
  events: OversightEvent[];
  safety_score: number; // 0-100, higher = safer
  requires_review: boolean;
  generated_at: string;
}

const activeEvents: OversightEvent[] = [];

/**
 * Record an oversight event during pipeline execution.
 */
export function recordOversightEvent(event: Omit<OversightEvent, "timestamp">): void {
  const full: OversightEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  activeEvents.push(full);

  if (event.severity === "critical") {
    console.error(`[Oversight] 🚨 CRITICAL: ${event.stage} — ${event.message}`);
  } else if (event.severity === "warning") {
    console.warn(`[Oversight] ⚠️ ${event.stage} — ${event.message}`);
  } else {
    console.log(`[Oversight] ℹ️ ${event.stage} — ${event.message}`);
  }
}

/**
 * Generate a summary oversight report for the current pipeline run.
 */
export function generateOversightReport(
  visit_id: string | null,
  consultation_id: string | null
): OversightReport {
  const criticalCount = activeEvents.filter(e => e.severity === "critical").length;
  const warningCount = activeEvents.filter(e => e.severity === "warning").length;

  // Simple safety score: start at 100, deduct for issues
  const safetyScore = Math.max(0, 100 - criticalCount * 30 - warningCount * 10);

  return {
    visit_id,
    consultation_id,
    events: [...activeEvents],
    safety_score: safetyScore,
    requires_review: criticalCount > 0 || safetyScore < 70,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Clear oversight events for a new pipeline run.
 */
export function clearOversightEvents(): void {
  activeEvents.length = 0;
}
