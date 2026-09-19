/**
 * Deterministic Engine Forcing — for the V1-vs-V3 benchmark comparison.
 *
 * Two independent gates decide which engine a request actually gets
 * (see engine_registry.ts and rollout_controller.ts):
 *   1. engine_registry's `active_engine` config.
 *   2. rollout_controller's per-identifier bucket, which can override #1
 *      down to V1 even when active_engine is "v3" (orchestrator.ts:1211).
 *
 * Benchmark cases (see case_to_context.ts) never set user_id/is_admin/
 * is_internal, so they always fall through to rollout_controller's default
 * bucket (10% v3 / 90% v1) — meaning naive comparisons here would mostly
 * be comparing V1 against V1. forceEngine() pins both gates so a run is
 * unambiguously 100% one engine, verifiable via InferenceResult.engine_version
 * on the actual result rather than trusted from a label.
 */

import { getEngineConfig, setEngineConfig, type EngineVersion } from "@/services/engine_registry";
import { getRolloutConfig, updateRolloutConfig } from "@/services/rollout_controller";

export interface EngineForceHandle {
  /** Restores the exact engine_registry + rollout_controller config captured before forcing. */
  restore: () => void;
}

export function forceEngine(version: EngineVersion): EngineForceHandle {
  const prevEngineConfig = getEngineConfig();
  const prevRolloutConfig = getRolloutConfig();

  setEngineConfig({ active_engine: version, shadow_engine: null });
  updateRolloutConfig({
    rollout_percentage: version === "v1" ? 0 : 100,
    enabled: true,
  });

  return {
    restore: () => {
      setEngineConfig({ ...prevEngineConfig });
      updateRolloutConfig({ ...prevRolloutConfig });
    },
  };
}
