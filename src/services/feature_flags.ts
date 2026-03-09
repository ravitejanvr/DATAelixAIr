/**
 * Feature Flag Registry
 * 
 * Controls activation of new architectural layers.
 * When a flag is disabled, the system behaves exactly as before.
 */

export interface FeatureFlags {
  enable_new_clinical_pipeline: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  enable_new_clinical_pipeline: false,
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
