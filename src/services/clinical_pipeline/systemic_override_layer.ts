/**
 * Systemic Override Layer
 *
 * Conditional authority correction that activates ONLY when physiology
 * signals indicate HIGH systemic instability and Sepsis is not ranked #1.
 *
 * Does NOT modify Bayesian engine, DDX engine, or any upstream logic.
 * Controlled by feature flag: enable_systemic_override
 * Deterministic. Reversible. Read-safe.
 */

export interface SystemicOverrideInput {
  bayesianDiagnoses: Array<{
    diagnosis_id: string;
    posterior_probability: number;
    [key: string]: any;
  }>;
  physiologicalContext: {
    systemic_state?: string;
    systemic_signal_count?: number;
    physiological_states?: any[];
    affected_systems?: any[];
    [key: string]: any;
  } | null;
  vitals?: {
    temperature?: number | null;
    pulse?: number | null;
    bp_systolic?: number | null;
    respiratory_rate?: number | null;
    spo2?: number | null;
  };
  /** UUID → clinical name map from DDX engine */
  diagnosisNameMap?: Map<string, string>;
}

export interface SystemicOverrideResult {
  diagnoses: SystemicOverrideInput["bayesianDiagnoses"];
  applied: boolean;
  reason: string;
  before_top?: string;
  after_top?: string;
}

const SEPSIS_KEYWORDS = ["sepsis", "septicemia", "septicaemia", "systemic infection"];
const PNEUMONIA_KEYWORDS = ["pneumonia", "cap", "community acquired pneumonia", "community-acquired pneumonia"];
const SEPSIS_FLOOR = 0.55;
const PNEUMONIA_SUPPRESSION = 0.7;
const MIN_SIGNALS = 3;

function resolveNameForId(id: string, nameMap?: Map<string, string>): string {
  // Try name map first (DDX-provided clinical names)
  if (nameMap) {
    const mapped = nameMap.get(id);
    if (mapped) return mapped.toLowerCase();
  }
  // Fallback: check if ID itself contains keywords (non-UUID fallback IDs)
  return (id || "").toLowerCase();
}

function isSepsisCandidate(id: string, nameMap?: Map<string, string>): boolean {
  const name = resolveNameForId(id, nameMap);
  return SEPSIS_KEYWORDS.some(kw => name.includes(kw));
}

function isPneumoniaCandidate(id: string, nameMap?: Map<string, string>): boolean {
  const name = resolveNameForId(id, nameMap);
  return PNEUMONIA_KEYWORDS.some(kw => name.includes(kw));
}

function computeSystemicSignalCount(vitals?: SystemicOverrideInput["vitals"]): number {
  if (!vitals) return 0;
  let count = 0;
  if (vitals.bp_systolic != null && vitals.bp_systolic < 100) count++;
  if (vitals.pulse != null && vitals.pulse > 100) count++;
  if (vitals.respiratory_rate != null && vitals.respiratory_rate > 22) count++;
  if (vitals.temperature != null && vitals.temperature > 100.4) count++;
  if (vitals.spo2 != null && vitals.spo2 < 94) count++;
  return count;
}

export function applySystemicOverride(input: SystemicOverrideInput): SystemicOverrideResult {
  const { bayesianDiagnoses, vitals, diagnosisNameMap } = input;

  if (!bayesianDiagnoses || bayesianDiagnoses.length === 0) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "No diagnoses to override" };
  }

  // Compute systemic signal from vitals directly
  const signalCount = computeSystemicSignalCount(vitals);

  console.log("[SystemicOverride] Vitals-based signal count:", signalCount);

  if (signalCount < MIN_SIGNALS) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: `Systemic signals ${signalCount} < ${MIN_SIGNALS}, no override` };
  }

  // Find sepsis candidate using name resolution
  const sepsisIdx = bayesianDiagnoses.findIndex(d => isSepsisCandidate(d.diagnosis_id, diagnosisNameMap));

  console.log("[SystemicOverride] Sepsis candidate index:", sepsisIdx,
    "| Name map entries:", diagnosisNameMap?.size ?? 0,
    "| Diagnoses:", bayesianDiagnoses.map(d => `${d.diagnosis_id} → ${resolveNameForId(d.diagnosis_id, diagnosisNameMap)}`).join(", "));

  if (sepsisIdx === -1) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "No sepsis candidate found (checked names via DDX map)" };
  }

  if (sepsisIdx === 0) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "Sepsis already rank #1" };
  }

  // Clone all diagnoses
  const cloned = bayesianDiagnoses.map(d => ({ ...d }));
  const originalSepsisScore = cloned[sepsisIdx].posterior_probability;

  // FIX 3: Hard clinical override — ensure sepsis floor at 0.55
  cloned[sepsisIdx].posterior_probability = Math.max(cloned[sepsisIdx].posterior_probability, SEPSIS_FLOOR);

  // FIX 4: Suppress pneumonia candidates
  for (let i = 0; i < cloned.length; i++) {
    if (isPneumoniaCandidate(cloned[i].diagnosis_id, diagnosisNameMap)) {
      cloned[i].posterior_probability *= PNEUMONIA_SUPPRESSION;
    }
  }

  // FIX 5: Re-sort
  cloned.sort((a, b) => b.posterior_probability - a.posterior_probability);

  // Normalize to sum = 1
  const total = cloned.reduce((s, d) => s + d.posterior_probability, 0);
  if (total > 0) {
    for (const d of cloned) {
      d.posterior_probability = Math.round((d.posterior_probability / total) * 10000) / 10000;
    }
  }

  const sepsisName = resolveNameForId(bayesianDiagnoses[sepsisIdx].diagnosis_id, diagnosisNameMap);
  const newSepsisScore = cloned.find(d => isSepsisCandidate(d.diagnosis_id, diagnosisNameMap))?.posterior_probability ?? 0;

  console.log("[SystemicOverride] OVERRIDE_INPUT", bayesianDiagnoses.slice(0, 3).map(d =>
    `${resolveNameForId(d.diagnosis_id, diagnosisNameMap)}: ${(d.posterior_probability * 100).toFixed(1)}%`));
  console.log("[SystemicOverride] OVERRIDE_OUTPUT", cloned.slice(0, 3).map(d =>
    `${resolveNameForId(d.diagnosis_id, diagnosisNameMap)}: ${(d.posterior_probability * 100).toFixed(1)}%`));

  return {
    diagnoses: cloned,
    applied: true,
    reason: `HIGH systemic instability (${signalCount}/5 signals) — ${sepsisName} boosted from ${(originalSepsisScore * 100).toFixed(1)}% to ${(newSepsisScore * 100).toFixed(1)}%`,
    before_top: bayesianDiagnoses[0].diagnosis_id,
    after_top: cloned[0].diagnosis_id,
  };
}
