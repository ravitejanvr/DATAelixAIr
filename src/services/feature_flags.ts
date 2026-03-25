/**
 * Feature Flag Registry
 * 
 * Controls activation of new architectural layers.
 * When a flag is disabled, the system behaves exactly as before.
 */

export interface FeatureFlags {
  enable_new_clinical_pipeline: boolean;
  use_ddx_engine: boolean;
  enable_uncertainty_engine: boolean;
  enable_counterfactual_analysis: boolean;
  enable_bias_monitoring: boolean;
  enable_meta_learning: boolean;
  enable_population_intelligence: boolean;
  enable_phase9_safety_decoupling: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enable_new_clinical_pipeline: true,
  use_ddx_engine: true,
  enable_uncertainty_engine: true,
  enable_counterfactual_analysis: true,
  enable_bias_monitoring: true,
  enable_meta_learning: true,
  enable_population_intelligence: true,
  enable_phase9_safety_decoupling: false,
};

let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS };

export function getFeatureFlags(): Readonly<FeatureFlags> {
  return currentFlags;
}

export function setFeatureFlag<K extends keyof FeatureFlags>(
  key: K,
  value: FeatureFlags[K]
): void {
  currentFlags = { ...currentFlags, [key]: value };
  console.log(`[FeatureFlag] ${key} = ${value}`);
}

export function isNewPipelineEnabled(): boolean {
  return currentFlags.enable_new_clinical_pipeline;
}

export function isDdxEngineEnabled(): boolean {
  return currentFlags.use_ddx_engine;
}

export function isUncertaintyEngineEnabled(): boolean {
  return currentFlags.enable_uncertainty_engine;
}

export function isCounterfactualEnabled(): boolean {
  return currentFlags.enable_counterfactual_analysis;
}

export function isBiasMonitoringEnabled(): boolean {
  return currentFlags.enable_bias_monitoring;
}

export function isMetaLearningEnabled(): boolean {
  return currentFlags.enable_meta_learning;
}

export function isPopulationIntelligenceEnabled(): boolean {
  return currentFlags.enable_population_intelligence;
}

export function isPhase9SafetyDecouplingEnabled(): boolean {
  return currentFlags.enable_phase9_safety_decoupling;
}
