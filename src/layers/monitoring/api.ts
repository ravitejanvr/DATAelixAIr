/**
 * Layer 8: Continuous Monitoring API
 * 
 * Tracks audit logs, usage metrics, and visit analytics.
 * All clinical mutations should be logged through this layer.
 * No PHI in logs — only event types, actor IDs, and target references.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client, audit_logs & usage_metrics tables
 * 
 * Consumers:
 *   - Layer 1 (UI): Admin dashboard audit view
 *   - Layer 2 (Workflow): Mutation logging
 *   - Layer 9 (Governance): Compliance audit trail
 */

import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  actor_id: string;
  event_type: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event. Fire-and-forget by default.
 * All clinical mutations should call this.
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
