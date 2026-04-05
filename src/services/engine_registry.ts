/**
 * Engine Registry — Single Source of Truth
 *
 * ALL probabilistic engine calls MUST go through this module.
 * No layer (UI, evaluation, benchmark, orchestrator) is allowed
 * to directly reference a specific engine version.
 *
 * To add V4: register it here, set active_engine = "v4". Done.
 */

import { supabase } from "@/integrations/supabase/client";
import type { BayesianInput, BayesianResult } from "./bayesian_engine/client";

// ── Engine Version Type ──

export type EngineVersion = "v1" | "v2" | "v3";

// ── Engine Interface ──

export interface EngineAdapter {
  /** Human-readable label */
  label: string;
  /** Edge function name to invoke */
  edgeFunctionName: string;
  /** Run inference */
  run: (input: BayesianInput) => Promise<BayesianResult | null>;
}

// ── Engine Implementations ──

const V1_ENGINE: EngineAdapter = {
  label: "V1 (Rule-Weighted)",
  edgeFunctionName: "calculate-diagnostic-probabilities",
  run: async (input) => {
    const { data, error } = await supabase.functions.invoke(
      "calculate-diagnostic-probabilities",
      { body: input },
    );
    if (error) {
      console.error("[EngineRegistry] V1 failed:", error);
      return null;
    }
    return data as BayesianResult;
  },
};

const V2_ENGINE: EngineAdapter = {
  label: "V2 (Latent-State)",
  edgeFunctionName: "calculate-diagnostic-probabilities-v2",
  run: async (input) => {
    const { data, error } = await supabase.functions.invoke(
      "calculate-diagnostic-probabilities-v2",
      { body: input },
    );
    if (error) {
      console.error("[EngineRegistry] V2 failed:", error);
      return null;
    }
    return data as BayesianResult;
  },
};

const V3_ENGINE: EngineAdapter = {
  label: "V3 (Discriminative-Competitive)",
  edgeFunctionName: "calculate-diagnostic-probabilities-v3",
  run: async (input) => {
    const { data, error } = await supabase.functions.invoke(
      "calculate-diagnostic-probabilities-v3",
      { body: input },
    );
    if (error) {
      console.error("[EngineRegistry] V3 failed:", error);
      return null;
    }
    return data as BayesianResult;
  },
};

// ── Registry ──

export const ENGINE_REGISTRY: Record<EngineVersion, EngineAdapter> = {
  v1: V1_ENGINE,
  v2: V2_ENGINE,
  v3: V3_ENGINE,
};

// ── Global Config ──

export interface EngineConfig {
  /** The active engine for production */
  active_engine: EngineVersion;
  /** Optional shadow engine for comparison (fire-and-forget) */
  shadow_engine: EngineVersion | null;
  /** Whether engine selection is enabled at all */
  enabled: boolean;
}

const DEFAULT_CONFIG: EngineConfig = {
  active_engine: "v3",
  shadow_engine: "v2",
  enabled: true,
};

let currentConfig: EngineConfig = { ...DEFAULT_CONFIG };
const configListeners: Set<(config: EngineConfig) => void> = new Set();

export function getEngineConfig(): Readonly<EngineConfig> {
  return currentConfig;
}

export function setEngineConfig(patch: Partial<EngineConfig>): void {
  const prev = currentConfig;
  currentConfig = { ...currentConfig, ...patch };
  console.log(`[EngineRegistry] Config updated: ${prev.active_engine} → ${currentConfig.active_engine}`, {
    shadow: currentConfig.shadow_engine,
    enabled: currentConfig.enabled,
  });
  configListeners.forEach((fn) => {
    try { fn(currentConfig); } catch { /* non-blocking */ }
  });
}

export function onEngineConfigChange(fn: (config: EngineConfig) => void): () => void {
  configListeners.add(fn);
  return () => configListeners.delete(fn);
}

// ── Resolver ──

/**
 * Resolve the active engine adapter. No layer overrides this.
 */
export function resolveEngine(version?: EngineVersion): EngineAdapter {
  const v = version || currentConfig.active_engine;
  const engine = ENGINE_REGISTRY[v];
  if (!engine) {
    console.error(`[EngineRegistry] FATAL: Unknown engine "${v}", falling back to v1`);
    return ENGINE_REGISTRY.v1;
  }
  return engine;
}

/**
 * Get the currently active engine version string.
 */
export function getActiveEngineVersion(): EngineVersion {
  return currentConfig.active_engine;
}

// ── Unified Inference Entry Point ──

export interface InferenceResult {
  result: BayesianResult | null;
  engine_version: EngineVersion;
  engine_label: string;
  shadow_result?: BayesianResult | null;
  shadow_engine_version?: EngineVersion;
  latency_ms: number;
  fallback_used: boolean;
  fallback_reason: string | null;
}

/**
 * Single entry point for ALL probabilistic inference.
 * UI, evaluation, benchmark, orchestrator — ALL must use this.
 */
export async function runInference(input: BayesianInput): Promise<InferenceResult> {
  const version = currentConfig.active_engine;
  const engine = resolveEngine(version);
  const t0 = performance.now();
  
  let result: BayesianResult | null = null;
  let fallbackUsed = false;
  let fallbackReason: string | null = null;

  try {
    result = await engine.run(input);
    if (!result) {
      fallbackUsed = true;
      fallbackReason = "null_result";
    }
  } catch (err) {
    console.error(`[EngineRegistry] ${version} execution error:`, err);
    fallbackUsed = true;
    fallbackReason = "error";
  }

  const latency = Math.round(performance.now() - t0);

  // Shadow mode — fire-and-forget comparison
  let shadowResult: BayesianResult | null | undefined;
  if (currentConfig.shadow_engine && currentConfig.shadow_engine !== version) {
    const shadowEngine = resolveEngine(currentConfig.shadow_engine);
    shadowEngine.run(input).then((sr) => {
      if (sr && result) {
        logShadowComparison(version, currentConfig.shadow_engine!, result, sr);
      }
    }).catch((err) => {
      console.warn(`[EngineRegistry] Shadow (${currentConfig.shadow_engine}) failed:`, err);
    });
  }

  console.log(`[ENGINE_AUDIT] ══════════════════════════════════`);
  console.log(`[ENGINE_AUDIT] ENGINE_SELECTED: ${version.toUpperCase()} (${engine.label})`);
  console.log(`[ENGINE_AUDIT] RESULT: ${result ? `${result.diagnoses?.length ?? 0} diagnoses` : "NULL"}`);
  console.log(`[ENGINE_AUDIT] LATENCY: ${latency}ms`);
  console.log(`[ENGINE_AUDIT] SHADOW: ${currentConfig.shadow_engine || "none"}`);
  console.log(`[ENGINE_AUDIT] ══════════════════════════════════`);

  return {
    result,
    engine_version: version,
    engine_label: engine.label,
    shadow_result: shadowResult,
    shadow_engine_version: currentConfig.shadow_engine ?? undefined,
    latency_ms: latency,
    fallback_used: fallbackUsed,
    fallback_reason: fallbackReason,
  };
}

// ── Shadow Comparison Logger ──

function logShadowComparison(
  primaryVersion: EngineVersion,
  shadowVersion: EngineVersion,
  primary: BayesianResult,
  shadow: BayesianResult,
): void {
  const pTop5 = primary.diagnoses.slice(0, 5);
  const sTop5 = shadow.diagnoses.slice(0, 5);

  console.log(`[ShadowCompare] ═══════════════════════════════════`);
  console.log(`[ShadowCompare] ${primaryVersion.toUpperCase()} (primary) vs ${shadowVersion.toUpperCase()} (shadow)`);
  console.log(`[ShadowCompare] ───────────────────────────────────`);

  for (let i = 0; i < Math.max(pTop5.length, sTop5.length); i++) {
    const pd = pTop5[i];
    const sd = sTop5[i];
    const pStr = pd ? `${pd.diagnosis_id.substring(0, 8)} ${(pd.posterior_probability * 100).toFixed(1)}%` : "—";
    const sStr = sd ? `${sd.diagnosis_id.substring(0, 8)} ${(sd.posterior_probability * 100).toFixed(1)}%` : "—";
    console.log(`[ShadowCompare] #${i + 1}: ${primaryVersion}=${pStr} | ${shadowVersion}=${sStr}`);
  }

  const pIds = pTop5.map((d) => d.diagnosis_id);
  const sIds = sTop5.map((d) => d.diagnosis_id);
  const top1Match = pIds[0] === sIds[0];
  const top3Overlap = pIds.slice(0, 3).filter((id) => sIds.slice(0, 3).includes(id)).length;
  console.log(`[ShadowCompare] Top-1 match: ${top1Match}, Top-3 overlap: ${top3Overlap}/3`);
  console.log(`[ShadowCompare] ═══════════════════════════════════`);
}
