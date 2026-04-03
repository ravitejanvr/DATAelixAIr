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
}

export interface SystemicOverrideResult {
  diagnoses: SystemicOverrideInput["bayesianDiagnoses"];
  applied: boolean;
  reason: string;
  before_top?: string;
  after_top?: string;
}

const SEPSIS_KEYWORDS = ["sepsis", "septicemia", "septicaemia", "systemic infection"];
const BOOST_CAP = 0.6;
const MIN_SIGNALS = 3;

function isSepsisCandidate(id: string): boolean {
  const lower = (id || "").toLowerCase();
  return SEPSIS_KEYWORDS.some(kw => lower.includes(kw));
}

function deriveSystemicState(
  ctx: SystemicOverrideInput["physiologicalContext"],
  vitals?: SystemicOverrideInput["vitals"],
): { state: string; signalCount: number } {
  // Primary: compute directly from vitals (most reliable)
  if (vitals) {
    let count = 0;
    if (vitals.bp_systolic != null && vitals.bp_systolic < 90) count++;
    if (vitals.pulse != null && vitals.pulse > 100) count++;
    if (vitals.respiratory_rate != null && vitals.respiratory_rate > 22) count++;
    if (vitals.temperature != null && vitals.temperature > 100.4) count++;
    if (vitals.spo2 != null && vitals.spo2 < 94) count++;

    if (count >= 3) return { state: "HIGH", signalCount: count };
    if (count >= 1) return { state: "MODERATE", signalCount: count };
    return { state: "LOW", signalCount: count };
  }

  // Fallback: upstream-provided fields
  if (ctx?.systemic_state && typeof ctx.systemic_signal_count === "number") {
    return { state: ctx.systemic_state, signalCount: ctx.systemic_signal_count };
  }

  // Fallback: pattern-match physiological_states
  if (ctx?.physiological_states?.length) {
    const states = ctx.physiological_states;
    const systemicIndicators = states.filter((s: any) => {
      const name = (typeof s === "string" ? s : s?.state_name || s?.state || s?.name || "").toLowerCase();
      return name.includes("shock") || name.includes("sirs") || name.includes("sepsis") ||
             name.includes("hypotension") || name.includes("tachycardia") ||
             name.includes("fever") || name.includes("hypoxia");
    });
    const count = systemicIndicators.length;
    if (count >= 3) return { state: "HIGH", signalCount: count };
    if (count >= 1) return { state: "MODERATE", signalCount: count };
  }

  return { state: "LOW", signalCount: 0 };
}

export function applySystemicOverride(input: SystemicOverrideInput): SystemicOverrideResult {
  const { bayesianDiagnoses, physiologicalContext, vitals } = input;

  // Guard: no diagnoses
  if (!bayesianDiagnoses || bayesianDiagnoses.length === 0) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "No diagnoses to override" };
  }

  // Derive systemic state from vitals (primary) or physiology context (fallback)
  const { state, signalCount } = deriveSystemicState(physiologicalContext, vitals);

  console.log("[SystemicOverride] State:", state, "Signals:", signalCount);

  // Guard: only activate on HIGH
  if (state !== "HIGH") {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: `Systemic state is ${state} (${signalCount} signals), no override needed` };
  }

  // Guard: require minimum signal count
  if (signalCount < MIN_SIGNALS) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: `Signal count ${signalCount} < ${MIN_SIGNALS}, insufficient for override` };
  }

  // Find sepsis candidate
  const sepsisIdx = bayesianDiagnoses.findIndex(d => isSepsisCandidate(d.diagnosis_id));
  if (sepsisIdx === -1) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "No sepsis candidate found in diagnoses" };
  }

  // Already rank 1 — no override needed
  if (sepsisIdx === 0) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "Sepsis already rank #1" };
  }

  // Apply controlled boost
  const cloned = bayesianDiagnoses.map(d => ({ ...d }));
  const currentTopScore = cloned[0].posterior_probability;
  const sepsisEntry = cloned[sepsisIdx];
  const originalSepsisScore = sepsisEntry.posterior_probability;

  // Boost: max of (top * 1.05) or (sepsis * 2.0), capped at BOOST_CAP
  const boostedScore = Math.min(
    Math.max(currentTopScore * 1.05, originalSepsisScore * 2.0),
    BOOST_CAP,
  );
  sepsisEntry.posterior_probability = boostedScore;

  // Re-sort by posterior_probability descending
  cloned.sort((a, b) => b.posterior_probability - a.posterior_probability);

  console.log("[SystemicOverride] OVERRIDE_INPUT", bayesianDiagnoses.slice(0, 3).map(d => `${d.diagnosis_id}: ${(d.posterior_probability * 100).toFixed(1)}%`));
  console.log("[SystemicOverride] OVERRIDE_OUTPUT", cloned.slice(0, 3).map(d => `${d.diagnosis_id}: ${(d.posterior_probability * 100).toFixed(1)}%`));

  return {
    diagnoses: cloned,
    applied: true,
    reason: `HIGH systemic instability (${signalCount} signals) — Sepsis boosted from ${(originalSepsisScore * 100).toFixed(1)}% to ${(boostedScore * 100).toFixed(1)}%`,
    before_top: bayesianDiagnoses[0].diagnosis_id,
    after_top: cloned[0].diagnosis_id,
  };
}
