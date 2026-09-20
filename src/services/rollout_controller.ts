/**
 * Engine Rollout Controller
 *
 * Controls staged activation of the promoted engine (V3 as of the item
 * 6/7 decision, see ROADMAP.md — this file predates that and its comments
 * used to say V2; the default engine, not the rollout mechanism, changed).
 * ALL users are deterministically bucketed — no exceptions.
 * Admins/internal users get rollout_percentage = 100 (always the promoted engine).
 */

export interface RolloutConfig {
  /** Current rollout percentage (0-100) */
  rollout_percentage: number;
  /** User IDs that always get 100% rollout */
  internal_user_ids: string[];
  /** Whether rollout is active at all */
  enabled: boolean;
}

const DEFAULT_ROLLOUT: RolloutConfig = {
  rollout_percentage: 10,
  internal_user_ids: [],
  enabled: true,
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

// ── Engine Selection ──

export type EngineVersion = "v1" | "v2" | "v3";

export interface RolloutDecision {
  engine_selected: EngineVersion;
  primary_engine: EngineVersion;
  bucket: number;
  rollout_percentage: number;
  is_internal: boolean;
  is_admin: boolean;
  force_override: EngineVersion | null;
  fallback_reason: string | null;
}

export interface RolloutInput {
  userId?: string;
  sessionId?: string;
  isAdmin?: boolean;
  isInternalUser?: boolean;
  force_engine?: EngineVersion;
}

/**
 * Determine engine version for a given user/session.
 * Every caller is deterministically bucketed — no exceptions.
 */
export function selectEngine(input: RolloutInput): RolloutDecision {
  const { userId, sessionId, isAdmin = false, isInternalUser = false, force_engine } = input;

  // 1. Deterministic bucket — MANDATORY for all users
  const identifier = userId || sessionId || "anonymous";
  const bucket = simpleHash(identifier) % 100;

  if (bucket < 0 || bucket > 99) {
    throw new Error(`[Rollout] FATAL: Invalid bucket ${bucket} for identifier "${identifier}"`);
  }

  // 2. Effective rollout percentage — admins/internal always get 100%
  const effectivePercentage = (isAdmin || isInternalUser || currentConfig.internal_user_ids.includes(identifier))
    ? 100
    : currentConfig.rollout_percentage;

  // 3. Engine selection
  let engine: EngineVersion;
  let forceOverride: EngineVersion | null = null;

  if (force_engine === "v3" || force_engine === "v2" || force_engine === "v1") {
    engine = force_engine;
    forceOverride = force_engine;
  } else if (!currentConfig.enabled) {
    engine = "v1";
  } else if (bucket < effectivePercentage) {
    // Default promoted engine is now V3
    engine = "v3";
  } else {
    engine = "v1";
  }

  const decision: RolloutDecision = {
    engine_selected: engine,
    primary_engine: engine,
    bucket,
    rollout_percentage: effectivePercentage,
    is_internal: isInternalUser || currentConfig.internal_user_ids.includes(identifier),
    is_admin: isAdmin,
    force_override: forceOverride,
    fallback_reason: null,
  };

  // 4. Audit log
  console.log(`[ENGINE_ROLLOUT]`, JSON.stringify(decision));

  return decision;
}

/** Simple deterministic hash for consistent bucketing */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
