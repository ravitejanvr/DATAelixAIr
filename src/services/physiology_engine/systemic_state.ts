/**
 * Systemic State Engine (Physiology-First Architecture)
 *
 * Deterministic, pure module that computes systemic instability
 * directly from vitals and symptoms. This is the PRIMARY TRUTH
 * layer — diagnosis ranking emerges from physiological reality.
 *
 * No ML, no randomness, no side effects.
 */

// ── Types ──

export interface SystemicSignals {
  hypotension: boolean;
  tachycardia: boolean;
  tachypnea: boolean;
  fever: boolean;
  hypoxia: boolean;
}

export type SystemicSeverity = "LOW" | "MODERATE" | "HIGH";
export type SystemicPhenotype = "stable" | "compensated_shock" | "decompensated_shock";

export interface SystemicState {
  systemic_strength: number;     // 0–1 (signal_count / 5)
  signals: SystemicSignals;
  signal_count: number;          // 0–5
  severity: SystemicSeverity;
  phenotype: SystemicPhenotype;
}

export interface VitalsInput {
  bp_systolic?: number | null;
  pulse?: number | null;
  heart_rate?: number | null;
  respiratory_rate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
}

// ── Thresholds (clinically grounded, deterministic) ──

const THRESHOLDS = {
  HYPOTENSION_SBP: 100,
  TACHYCARDIA_HR: 100,
  TACHYPNEA_RR: 22,
  FEVER_TEMP_F: 100.4,
  HYPOXIA_SPO2: 94,
} as const;

// ── Disease Systemic Profiles ──

export type DiseaseType = "systemic" | "organ" | "metabolic" | "neurological" | "vascular";

export interface DiseaseSystemicProfile {
  type: DiseaseType;
  requires_systemic_instability: boolean;
  systemic_weight: number;  // 0–1: how much systemic state should influence scoring
  keywords: string[];
}

/**
 * Canonical disease profiles for physiology-first conditioning.
 * systemic_weight determines how much systemic_strength amplifies or suppresses
 * a diagnosis relative to its Bayesian base.
 */
export const DISEASE_PROFILES: DiseaseSystemicProfile[] = [
  {
    type: "systemic",
    requires_systemic_instability: true,
    systemic_weight: 1.0,
    keywords: ["sepsis", "septic", "septicemia", "septicaemia", "bacteremia", "urosepsis", "systemic infection"],
  },
  {
    type: "organ",
    requires_systemic_instability: false,
    systemic_weight: 0.4,
    keywords: ["pneumonia", "cap", "community acquired pneumonia", "community-acquired pneumonia"],
  },
  {
    type: "metabolic",
    requires_systemic_instability: false,
    systemic_weight: 0.3,
    keywords: ["hypoglycemia", "hypoglycemic", "dka", "diabetic ketoacidosis"],
  },
  {
    type: "organ",
    requires_systemic_instability: false,
    systemic_weight: 0.5,
    keywords: ["meningitis", "encephalitis"],
  },
  {
    type: "vascular",
    requires_systemic_instability: false,
    systemic_weight: 0.5,
    keywords: ["pulmonary embolism", "pe"],
  },
  {
    type: "vascular",
    requires_systemic_instability: false,
    systemic_weight: 0.5,
    keywords: ["acute coronary syndrome", "acs", "myocardial infarction", "mi", "nstemi", "stemi"],
  },
  {
    type: "neurological",
    requires_systemic_instability: false,
    systemic_weight: 0.2,
    keywords: ["stroke", "cerebrovascular", "cva", "tia"],
  },
  {
    type: "organ",
    requires_systemic_instability: false,
    systemic_weight: 0.4,
    keywords: ["appendicitis"],
  },
  {
    type: "metabolic",
    requires_systemic_instability: false,
    systemic_weight: 0.2,
    keywords: ["thyroid storm", "thyrotoxicosis"],
  },
  {
    type: "organ",
    requires_systemic_instability: false,
    systemic_weight: 0.35,
    keywords: ["urinary tract infection", "uti", "pyelonephritis"],
  },
];

// ── Core Computation ──

/**
 * Compute systemic state from vitals. Pure, deterministic.
 */
export function computeSystemicState(vitals: VitalsInput): SystemicState {
  const hr = vitals.pulse ?? vitals.heart_rate ?? null;

  const signals: SystemicSignals = {
    hypotension: vitals.bp_systolic != null && vitals.bp_systolic < THRESHOLDS.HYPOTENSION_SBP,
    tachycardia: hr != null && hr > THRESHOLDS.TACHYCARDIA_HR,
    tachypnea: vitals.respiratory_rate != null && vitals.respiratory_rate > THRESHOLDS.TACHYPNEA_RR,
    fever: vitals.temperature != null && vitals.temperature > THRESHOLDS.FEVER_TEMP_F,
    hypoxia: vitals.spo2 != null && vitals.spo2 < THRESHOLDS.HYPOXIA_SPO2,
  };

  const signal_count = Object.values(signals).filter(Boolean).length;
  const systemic_strength = signal_count / 5;

  const severity: SystemicSeverity =
    signal_count >= 4 ? "HIGH" :
    signal_count >= 2 ? "MODERATE" :
    "LOW";

  const phenotype: SystemicPhenotype =
    signal_count >= 4 ? "decompensated_shock" :
    signal_count >= 2 ? "compensated_shock" :
    "stable";

  return {
    systemic_strength,
    signals,
    signal_count,
    severity,
    phenotype,
  };
}

/**
 * Match a canonical diagnosis name to a disease profile.
 * Returns null if no profile matches.
 */
export function matchDiseaseProfile(canonicalName: string): DiseaseSystemicProfile | null {
  const lower = canonicalName.toLowerCase();
  return DISEASE_PROFILES.find(p => p.keywords.some(kw => lower.includes(kw))) ?? null;
}

/**
 * Compute physiology-conditioned multiplier for a diagnosis.
 *
 * For systemic diseases (requires_systemic_instability):
 *   - HIGH systemic: multiplier = 1.5–2.5 (scales with strength)
 *   - LOW systemic: multiplier = 0.5 (suppressed — no physiological basis)
 *
 * For organ/metabolic/etc:
 *   - multiplier = 1 - (systemic_strength × (1 - systemic_weight))
 *   - High systemic state suppresses organ diagnoses proportionally
 */
export function computePhysioMultiplier(
  systemicState: SystemicState,
  profile: DiseaseSystemicProfile | null,
): number {
  if (!profile) {
    // Unknown disease: mild suppression proportional to systemic instability
    return 1 - (systemicState.systemic_strength * 0.3);
  }

  if (profile.requires_systemic_instability) {
    // Systemic diseases: boost when physiology supports, suppress when it doesn't
    if (systemicState.systemic_strength >= 0.6) {
      // Linear scale: 0.6 → 1.5, 0.8 → 2.0, 1.0 → 2.5
      return 1.5 + (systemicState.systemic_strength - 0.6) * 2.5;
    } else {
      // Insufficient systemic evidence — suppress
      return 0.5;
    }
  }

  // Non-systemic diseases: suppress proportionally to systemic instability
  // High systemic → organ diagnoses get diminished
  return 1 - (systemicState.systemic_strength * (1 - profile.systemic_weight));
}
