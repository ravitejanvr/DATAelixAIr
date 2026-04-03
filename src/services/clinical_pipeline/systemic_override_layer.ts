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

function deriveSystemicState(ctx: SystemicOverrideInput["physiologicalContext"]): {
  state: string;
  signalCount: number;
} {
  if (!ctx) return { state: "LOW", signalCount: 0 };

  // If already computed upstream, use it
  if (ctx.systemic_state && typeof ctx.systemic_signal_count === "number") {
    return { state: ctx.systemic_state, signalCount: ctx.systemic_signal_count };
  }

  // Derive from physiological_states if available
  const states = ctx.physiological_states || [];
  const systemicIndicators = states.filter((s: any) => {
    const name = (typeof s === "string" ? s : s?.state_name || "").toLowerCase();
    return name.includes("shock") || name.includes("sirs") || name.includes("sepsis") ||
           name.includes("hypotension") || name.includes("tachycardia") ||
           name.includes("fever") || name.includes("hypoxia");
  });

  const count = systemicIndicators.length;
  const state = count >= 3 ? "HIGH" : count >= 1 ? "MODERATE" : "LOW";
  return { state, signalCount: count };
}

export function applySystemicOverride(input: SystemicOverrideInput): SystemicOverrideResult {
  const { bayesianDiagnoses, physiologicalContext } = input;

  // Guard: no diagnoses
  if (!bayesianDiagnoses || bayesianDiagnoses.length === 0) {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: "No diagnoses to override" };
  }

  // Derive systemic state
  const { state, signalCount } = deriveSystemicState(physiologicalContext);

  // Guard: only activate on HIGH
  if (state !== "HIGH") {
    return { diagnoses: bayesianDiagnoses, applied: false, reason: `Systemic state is ${state}, no override needed` };
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

  // Boost: max of (top * 1.05) or (sepsis * 2.0), capped at BOOST_CAP
  const boostedScore = Math.min(
    Math.max(currentTopScore * 1.05, sepsisEntry.posterior_probability * 2.0),
    BOOST_CAP,
  );
  sepsisEntry.posterior_probability = boostedScore;

  // Re-sort by posterior_probability descending
  cloned.sort((a, b) => b.posterior_probability - a.posterior_probability);

  return {
    diagnoses: cloned,
    applied: true,
    reason: `HIGH systemic instability (${signalCount} signals) — Sepsis boosted from ${(bayesianDiagnoses[sepsisIdx].posterior_probability * 100).toFixed(1)}% to ${(boostedScore * 100).toFixed(1)}%`,
    before_top: bayesianDiagnoses[0].diagnosis_id,
    after_top: cloned[0].diagnosis_id,
  };
}
