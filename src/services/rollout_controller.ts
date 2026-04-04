/**
 * V2 Engine Rollout Controller
 * 
 * Controls staged activation of the probabilistic engine V2.
 * Supports: user-level targeting, percentage-based rollout, audit logging.
 */

export interface RolloutConfig {
  /** Current rollout percentage (0-100) */
  rollout_percentage: number;
  /** User IDs that always get V2 (internal testers) */
  internal_user_ids: string[];
  /** Whether rollout is active at all */
  enabled: boolean;
  /** Log predictions above this confidence for audit */
  high_confidence_audit_threshold: number;
}

const DEFAULT_ROLLOUT: RolloutConfig = {
  rollout_percentage: 10,
  internal_user_ids: [],
  enabled: true,
  high_confidence_audit_threshold: 0.85,
};

let currentConfig: RolloutConfig = { ...DEFAULT_ROLLOUT };

export function getRolloutConfig(): Readonly<RolloutConfig> {
  return currentConfig;
}

export function updateRolloutConfig(patch: Partial<RolloutConfig>): void {
  currentConfig = { ...currentConfig, ...patch };
  console.log(`[Rollout] Config updated:`, {
    percentage: currentConfig.rollout_percentage,
    enabled: currentConfig.enabled,
    internal_users: currentConfig.internal_user_ids.length,
  });
}

/**
 * Determine whether a given user/session should use V2.
 * Priority: internal user list > percentage-based hash.
 */
export function shouldUseV2(userId?: string, visitId?: string): boolean {
  if (!currentConfig.enabled) return false;

  // Internal users always get V2
  if (userId && currentConfig.internal_user_ids.includes(userId)) {
    return true;
  }

  // Percentage-based: deterministic hash from visitId or random
  const hashSource = visitId || userId || crypto.randomUUID();
  const hash = simpleHash(hashSource);
  const bucket = hash % 100;

  return bucket < currentConfig.rollout_percentage;
}

/**
 * Check if a prediction should be audit-logged based on confidence.
 */
export function shouldAuditLog(topConfidence: number): boolean {
  return topConfidence >= currentConfig.high_confidence_audit_threshold;
}

/** Simple deterministic hash for consistent bucketing */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit int
  }
  return Math.abs(hash);
}

// ── Audit Logger ──

export interface V2AuditEntry {
  visit_id: string;
  engine: "v1" | "v2";
  top_diagnosis_id: string;
  top_confidence: number;
  v1_v2_delta?: number;
  ranking_changed: boolean;
  timestamp: string;
}

const auditBuffer: V2AuditEntry[] = [];
const AUDIT_FLUSH_SIZE = 20;

export function logV2Audit(entry: V2AuditEntry): void {
  auditBuffer.push(entry);
  console.log(
    `[V2Audit] ${entry.engine.toUpperCase()} | top=${entry.top_diagnosis_id.substring(0, 8)} ` +
    `conf=${(entry.top_confidence * 100).toFixed(1)}% | delta=${entry.v1_v2_delta?.toFixed(3) ?? "N/A"} | ` +
    `rank_changed=${entry.ranking_changed}`
  );

  if (auditBuffer.length >= AUDIT_FLUSH_SIZE) {
    flushAuditBuffer();
  }
}

export function getAuditBuffer(): readonly V2AuditEntry[] {
  return auditBuffer;
}

async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;
  const batch = auditBuffer.splice(0, auditBuffer.length);
  console.log(`[V2Audit] Flushed ${batch.length} audit entries`);
  // Future: persist to supabase table
}
