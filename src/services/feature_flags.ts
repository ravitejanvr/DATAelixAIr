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
  enable_phase10_candidate_completeness: boolean;
  enable_phase5_context_candidates: boolean;
  enable_phase6_intelligence_core: boolean;
  enable_phase6_safetynet: boolean;
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
  enable_phase10_candidate_completeness: false,
  enable_phase5_context_candidates: true,
  enable_phase6_intelligence_core: true,
  enable_phase6_safetynet: true,
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

export function isPhase10CandidateCompletenessEnabled(): boolean {
  return currentFlags.enable_phase10_candidate_completeness;
}

export function isPhase5ContextCandidatesEnabled(): boolean {
  return currentFlags.enable_phase5_context_candidates;
}

export function isPhase6IntelligenceCoreEnabled(): boolean {
  return currentFlags.enable_phase6_intelligence_core;
}

export function isPhase6SafetyNetEnabled(): boolean {
  return currentFlags.enable_phase6_safetynet;
}
