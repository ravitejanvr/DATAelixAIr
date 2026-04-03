/**
 * Clinical Authority Enforcer
 *
 * Post-CAL, pre-freeze module that enforces must-not-miss priority
 * when systemic instability is detected. This ensures that dangerous
 * systemic conditions (e.g., sepsis) are never ranked below a safe
 * threshold, regardless of Bayesian posteriors.
 *
 * Invariants:
 *   - Pure function: no side effects, no async, no randomness
 *   - Deterministic: identical inputs → identical output
 *   - Feature-flagged: enable_execution_authority_fix
 *   - Does NOT force rank — uses deterministic re-scoring only
 *   - Output sum normalised to 1.0
 */

import {
  computeSystemicState,
  matchDiseaseProfile,
  type SystemicState,
  type VitalsInput,
} from "@/services/physiology_engine/systemic_state";

// ── Types ──

export interface EnforcerDiagnosis {
  diagnosis_id: string;
  diagnosis_name: string;
  canonical_name: string;
  posterior_probability: number;
  rank: number;
  must_not_miss?: boolean;
  [key: string]: any;
}

export interface EnforcerInput {
  diagnoses: EnforcerDiagnosis[];
  vitals?: VitalsInput;
  systemic_state?: SystemicState | null;
}

export interface EnforcerAdjustment {
  diagnosis_id: string;
  diagnosis_name: string;
  reason: string;
  before: number;
  after: number;
}

export interface EnforcerMetadata {
  applied: boolean;
  systemic_strength: number;
  severity: string;
  adjustments: EnforcerAdjustment[];
  authority_signal: {
    type: string;
    condition: string | null;
    priority: string;
  } | null;
  skip_reason?: string;
}

export interface EnforcerOutput {
  diagnoses: EnforcerDiagnosis[];
  enforcer_metadata: EnforcerMetadata;
}

// ── Constants ──

const SYSTEMIC_MNM_FLOOR = 0.15; // Must-not-miss systemic diagnosis gets at least 15% when HIGH instability

// ── Main Function ──

export function enforceClinicalPriority(input: EnforcerInput): EnforcerOutput {
  const { diagnoses, vitals, systemic_state } = input;

  if (!diagnoses || diagnoses.length === 0) {
    return { diagnoses, enforcer_metadata: buildSkip("no_diagnoses") };
  }

  const state = systemic_state || (vitals ? computeSystemicState(vitals) : null);

  if (!state) {
    return { diagnoses, enforcer_metadata: buildSkip("no_physiology_data") };
  }

  // Only enforce when systemic instability is HIGH (≥3 signals)
  if (state.signal_count < 3) {
    return {
      diagnoses,
      enforcer_metadata: {
        applied: false,
        systemic_strength: state.signal_count,
        severity: state.severity,
        adjustments: [],
        authority_signal: null,
        skip_reason: `signal_count ${state.signal_count} < 3`,
      },
    };
  }

  console.log(`[AUTHORITY_ENFORCER] ACTIVATED — strength=${state.signal_count}, severity=${state.severity}`);

  const adjustments: EnforcerAdjustment[] = [];
  let authoritySignal: EnforcerMetadata["authority_signal"] = null;
  let modified = [...diagnoses];

  // Enforce must-not-miss systemic floor
  for (let i = 0; i < modified.length; i++) {
    const d = modified[i];
    const profile = matchDiseaseProfile(d.canonical_name);

    if (profile?.requires_systemic_instability && d.must_not_miss) {
      const floor = SYSTEMIC_MNM_FLOOR * (state.signal_count / 5);
      if (d.posterior_probability < floor) {
        const before = d.posterior_probability;
        modified[i] = { ...d, posterior_probability: floor };
        adjustments.push({
          diagnosis_id: d.diagnosis_id,
          diagnosis_name: d.diagnosis_name,
          reason: "must_not_miss_systemic_floor",
          before: Math.round(before * 10000) / 10000,
          after: Math.round(floor * 10000) / 10000,
        });
        authoritySignal = {
          type: "SYSTEMIC_PRIORITY",
          condition: d.canonical_name,
          priority: "MAX",
        };
      }
    }
  }

  if (adjustments.length === 0) {
    return {
      diagnoses,
      enforcer_metadata: {
        applied: false,
        systemic_strength: state.signal_count,
        severity: state.severity,
        adjustments: [],
        authority_signal: null,
        skip_reason: "no_adjustments_needed",
      },
    };
  }

  // Normalize to sum = 1.0
  const total = modified.reduce((s, d) => s + d.posterior_probability, 0);
  if (total > 0 && Math.abs(total - 1.0) > 0.001) {
    const factor = 1.0 / total;
    modified = modified.map(d => ({
      ...d,
      posterior_probability: Math.round(d.posterior_probability * factor * 10000) / 10000,
    }));
  }

  // Re-sort and re-rank
  modified.sort((a, b) => b.posterior_probability - a.posterior_probability);
  modified = modified.map((d, idx) => ({ ...d, rank: idx + 1 }));

  // Log
  for (const adj of adjustments) {
    console.log(`[AUTHORITY_ENFORCER] ${adj.diagnosis_name}: ${(adj.before * 100).toFixed(1)}% → ${(adj.after * 100).toFixed(1)}% [${adj.reason}]`);
  }

  return {
    diagnoses: modified,
    enforcer_metadata: {
      applied: true,
      systemic_strength: state.signal_count,
      severity: state.severity,
      adjustments,
      authority_signal: authoritySignal,
    },
  };
}

// ── Helper ──

function buildSkip(reason: string): EnforcerMetadata {
  return {
    applied: false,
    systemic_strength: 0,
    severity: "LOW",
    adjustments: [],
    authority_signal: null,
    skip_reason: reason,
  };
}
