/**
 * Phase 5.4 — Clinical Pattern Recognition & Priority Layer
 *
 * Operates BEFORE Bayesian scoring to detect high-signal clinical patterns
 * and produce deterministic priority adjustments (boost/suppress multipliers).
 *
 * Invariants:
 *   - Pure function — does NOT mutate inputs
 *   - Deterministic: identical inputs → identical output
 *   - Does NOT inject new diagnoses — only adjusts weights of existing candidates
 *   - Feature-flagged via enable_pattern_priority_layer
 */

import type { ClinicalContext } from "@/lib/clinical-context";

// ── Output Types ──

export interface PatternDetection {
  pattern_name: string;
  confidence: number; // 0–1
  triggered_by: string[];
  clinical_significance: "low" | "moderate" | "high" | "critical";
}

export interface PriorityAdjustment {
  diagnosis: string; // lowercase match key
  weight_multiplier: number;
}

export interface PatternPriorityResult {
  patterns_detected: PatternDetection[];
  priority_adjustments: {
    boost: PriorityAdjustment[];
    suppress: PriorityAdjustment[];
  };
  global_modifiers: {
    risk_level: "low" | "moderate" | "high" | "critical";
    dominant_pattern: string | null;
  };
}

// ── Internal Helpers ──

function syms(ctx: ClinicalContext): Set<string> {
  const all: string[] = [];
  if (ctx.chief_complaint) all.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) all.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) all.push(...ctx.associated_symptoms);
  return new Set(all.map(s => s.toLowerCase().trim()));
}

function has(set: Set<string>, ...kw: string[]): boolean {
  return kw.some(k => [...set].some(s => s.includes(k)));
}

function histHas(ctx: ClinicalContext, ...kw: string[]): boolean {
  const h = [...(ctx.medical_history || []), ...(ctx.risk_factors || [])].map(s => s.toLowerCase());
  return kw.some(k => h.some(s => s.includes(k)));
}

function bpSystolic(ctx: ClinicalContext): number | null {
  if (!ctx.blood_pressure) return null;
  const v = parseInt(ctx.blood_pressure.split("/")[0]);
  return isNaN(v) ? null : v;
}

// ── Pattern Definitions ──

interface PatternDef {
  name: string;
  detect: (ctx: ClinicalContext, s: Set<string>) => { confidence: number; triggers: string[] } | null;
  significance: "low" | "moderate" | "high" | "critical";
  boost: Array<{ match: string[]; multiplier: number }>;
  suppress: Array<{ match: string[]; multiplier: number }>;
}

const PATTERNS: PatternDef[] = [
  // ── SEPSIS / SYSTEMIC INFECTION ──
  {
    name: "sepsis_systemic_infection",
    detect: (ctx, s) => {
      const triggers: string[] = [];
      if (ctx.temperature != null && ctx.temperature >= 38.0) triggers.push("fever≥38°C");
      if (ctx.pulse != null && ctx.pulse > 100) triggers.push("tachycardia>100");
      const sbp = bpSystolic(ctx);
      if (sbp != null && sbp < 100) triggers.push("hypotension<100");
      if (ctx.respiratory_rate != null && ctx.respiratory_rate > 20) triggers.push("tachypnea>20");
      if (has(s, "dizziness", "confusion", "altered")) triggers.push("altered_mentation");
      if (triggers.length < 2) return null;
      return { confidence: triggers.length >= 3 ? 0.9 : 0.7, triggers };
    },
    significance: "critical",
    boost: [
      { match: ["sepsis", "septic shock", "systemic infection", "bacteremia", "urosepsis"], multiplier: 3.0 },
      { match: ["pneumonia"], multiplier: 1.8 },
    ],
    suppress: [
      { match: ["migraine", "tension headache", "benign positional vertigo"], multiplier: 0.4 },
      { match: ["hypoglycemia"], multiplier: 0.5 },
    ],
  },

  // ── HYPOGLYCEMIA ──
  {
    name: "hypoglycemia",
    detect: (ctx, s) => {
      const triggers: string[] = [];
      if (ctx.blood_sugar != null && ctx.blood_sugar < 70) triggers.push("low_glucose");
      if (histHas(ctx, "diabetes")) triggers.push("diabetes_history");
      if (has(s, "dizziness", "confusion", "sweating", "tremor")) triggers.push("autonomic_symptoms");
      if (triggers.length < 2) return null;
      // Downgrade if competing systemic pattern signals present
      const hasFever = ctx.temperature != null && ctx.temperature >= 38.0;
      const hasHypotension = (bpSystolic(ctx) ?? 120) < 100;
      const confidence = (hasFever || hasHypotension) ? 0.4 : 0.7;
      return { confidence, triggers };
    },
    significance: "high",
    boost: [
      { match: ["hypoglycemia", "hypoglycemic episode", "insulin reaction"], multiplier: 1.8 },
    ],
    suppress: [],
  },

  // ── NEURO INFECTION (MENINGITIS) ──
  {
    name: "neuro_infection_meningitis",
    detect: (ctx, s) => {
      const triggers: string[] = [];
      if (has(s, "headache")) triggers.push("headache");
      if (ctx.temperature != null && ctx.temperature >= 38.0) triggers.push("fever");
      if (has(s, "photophobia")) triggers.push("photophobia");
      if (has(s, "neck stiffness", "nuchal rigidity")) triggers.push("neck_stiffness");
      if (triggers.length < 2) return null;
      const confidence = triggers.length >= 3 ? 0.85 : 0.55;
      return { confidence, triggers };
    },
    significance: "critical",
    boost: [
      { match: ["meningitis", "bacterial meningitis", "viral meningitis", "encephalitis"], multiplier: 2.5 },
    ],
    suppress: [
      { match: ["tension headache"], multiplier: 0.4 },
    ],
  },

  // ── CARDIO-PULMONARY DISTRESS ──
  {
    name: "cardiopulmonary_distress",
    detect: (ctx, s) => {
      const triggers: string[] = [];
      if (has(s, "breathless", "shortness of breath", "dyspnea")) triggers.push("dyspnea");
      if (ctx.oxygen_saturation != null && ctx.oxygen_saturation < 94) triggers.push("hypoxia<94");
      if (ctx.pulse != null && ctx.pulse > 100) triggers.push("tachycardia");
      if (triggers.length < 2) return null;
      const hasFever = ctx.temperature != null && ctx.temperature >= 38.0;
      const hasHypotension = (bpSystolic(ctx) ?? 120) < 100;
      const confidence = (hasFever || hasHypotension) ? 0.85 : 0.7;
      return { confidence, triggers };
    },
    significance: "high",
    boost: [
      { match: ["pulmonary embolism", "pe"], multiplier: 2.2 },
      { match: ["pneumonia", "community-acquired pneumonia"], multiplier: 2.0 },
      { match: ["acute coronary syndrome", "acs", "myocardial infarction"], multiplier: 1.8 },
      { match: ["heart failure", "congestive heart failure"], multiplier: 1.6 },
    ],
    suppress: [
      { match: ["gastritis", "gerd", "acid reflux"], multiplier: 0.5 },
    ],
  },

  // ── ACUTE CORONARY SYNDROME ──
  {
    name: "acute_coronary_syndrome",
    detect: (ctx, s) => {
      const triggers: string[] = [];
      if (has(s, "chest pain", "chest pressure", "crushing")) triggers.push("chest_pain");
      if (has(s, "diaphoresis", "sweating")) triggers.push("diaphoresis");
      if (has(s, "left arm", "jaw pain", "arm pain")) triggers.push("radiation");
      if (ctx.pulse != null && ctx.pulse > 100) triggers.push("tachycardia");
      if (triggers.length < 2) return null;
      const hasCardiacRisk = histHas(ctx, "hypertension", "diabetes", "smoking", "cardiac", "cholesterol");
      const confidence = hasCardiacRisk ? 0.85 : 0.65;
      return { confidence, triggers };
    },
    significance: "critical",
    boost: [
      { match: ["acute coronary syndrome", "acs", "myocardial infarction", "mi", "unstable angina", "nstemi", "stemi"], multiplier: 2.8 },
    ],
    suppress: [
      { match: ["gerd", "gastritis", "acid reflux", "costochondritis"], multiplier: 0.4 },
    ],
  },

  // ── STROKE / CEREBROVASCULAR ──
  {
    name: "cerebrovascular_event",
    detect: (ctx, s) => {
      const triggers: string[] = [];
      if (has(s, "weakness", "hemiparesis", "facial droop", "arm weakness")) triggers.push("focal_deficit");
      if (has(s, "slurred speech", "dysarthria", "aphasia")) triggers.push("speech_deficit");
      if (has(s, "visual field", "diplopia", "vision loss")) triggers.push("visual_deficit");
      if (has(s, "sudden onset", "acute")) triggers.push("acute_onset");
      if (triggers.length < 2) return null;
      const hasRisk = histHas(ctx, "hypertension", "atrial fibrillation", "diabetes") || (ctx.patient_age != null && ctx.patient_age > 55);
      return { confidence: hasRisk ? 0.85 : 0.6, triggers };
    },
    significance: "critical",
    boost: [
      { match: ["stroke", "cerebrovascular accident", "cva", "tia", "transient ischemic"], multiplier: 2.5 },
    ],
    suppress: [
      { match: ["migraine", "tension headache", "benign positional vertigo"], multiplier: 0.4 },
    ],
  },
];

// ── Conflict Resolution ──

const SIGNIFICANCE_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  low: 1,
};

// ── Main Function ──

/**
 * Detect clinical patterns and produce priority adjustments.
 * Pure, deterministic, does not mutate inputs.
 */
export function detectPatternPriorities(ctx: ClinicalContext): PatternPriorityResult {
  const symptomSet = syms(ctx);
  const detected: PatternDetection[] = [];
  const boostMap = new Map<string, number>(); // diagnosis key → max multiplier
  const suppressMap = new Map<string, number>(); // diagnosis key → min multiplier

  for (const pattern of PATTERNS) {
    const result = pattern.detect(ctx, symptomSet);
    if (!result) continue;

    detected.push({
      pattern_name: pattern.name,
      confidence: result.confidence,
      triggered_by: result.triggers,
      clinical_significance: pattern.significance,
    });

    // Apply boosts (take max multiplier per diagnosis)
    for (const b of pattern.boost) {
      for (const dx of b.match) {
        const key = dx.toLowerCase();
        const scaled = 1.0 + (b.multiplier - 1.0) * result.confidence;
        boostMap.set(key, Math.max(boostMap.get(key) ?? 1.0, scaled));
      }
    }

    // Apply suppressions (take min multiplier per diagnosis)
    for (const s of pattern.suppress) {
      for (const dx of s.match) {
        const key = dx.toLowerCase();
        const scaled = 1.0 - (1.0 - s.multiplier) * result.confidence;
        suppressMap.set(key, Math.min(suppressMap.get(key) ?? 1.0, scaled));
      }
    }
  }

  // Determine dominant pattern by significance then confidence
  const sorted = [...detected].sort((a, b) => {
    const sigDiff = (SIGNIFICANCE_ORDER[b.clinical_significance] || 0) - (SIGNIFICANCE_ORDER[a.clinical_significance] || 0);
    if (sigDiff !== 0) return sigDiff;
    return b.confidence - a.confidence;
  });

  const dominant = sorted[0] ?? null;

  // Determine global risk level
  let riskLevel: "low" | "moderate" | "high" | "critical" = "low";
  if (detected.some(p => p.clinical_significance === "critical" && p.confidence >= 0.7)) {
    riskLevel = "critical";
  } else if (detected.some(p => p.clinical_significance === "critical") || detected.some(p => p.clinical_significance === "high" && p.confidence >= 0.7)) {
    riskLevel = "high";
  } else if (detected.length > 0) {
    riskLevel = "moderate";
  }

  const boost: PriorityAdjustment[] = [];
  for (const [dx, mult] of boostMap.entries()) {
    if (mult > 1.05) boost.push({ diagnosis: dx, weight_multiplier: Math.round(mult * 100) / 100 });
  }

  const suppress: PriorityAdjustment[] = [];
  for (const [dx, mult] of suppressMap.entries()) {
    if (mult < 0.95) suppress.push({ diagnosis: dx, weight_multiplier: Math.round(mult * 100) / 100 });
  }

  if (detected.length > 0) {
    console.log(
      `[PatternPriority] Detected ${detected.length} patterns: [${detected.map(p => `${p.pattern_name}(${p.confidence})`).join(", ")}] ` +
      `| Boosts: ${boost.length} | Suppressions: ${suppress.length} | Risk: ${riskLevel}`
    );
  }

  return {
    patterns_detected: detected,
    priority_adjustments: { boost, suppress },
    global_modifiers: {
      risk_level: riskLevel,
      dominant_pattern: dominant?.pattern_name ?? null,
    },
  };
}

/**
 * Apply pattern priority adjustments to DDX probabilities.
 * Returns a new array — does NOT mutate input.
 */
export function applyPatternPriority<T extends { diagnosis_name: string; probability: number; must_not_miss?: boolean }>(
  diagnoses: T[],
  result: PatternPriorityResult,
): T[] {
  if (result.patterns_detected.length === 0) return diagnoses;

  const boostLookup = new Map(result.priority_adjustments.boost.map(b => [b.diagnosis, b.weight_multiplier]));
  const suppressLookup = new Map(result.priority_adjustments.suppress.map(s => [s.diagnosis, s.weight_multiplier]));

  const adjusted = diagnoses.map(d => {
    const key = d.diagnosis_name.toLowerCase();
    let multiplier = 1.0;

    // Check exact and partial matches for boost
    for (const [bk, bm] of boostLookup) {
      if (key.includes(bk) || bk.includes(key)) {
        multiplier = Math.max(multiplier, bm);
      }
    }

    // Check exact and partial matches for suppress
    for (const [sk, sm] of suppressLookup) {
      if (key.includes(sk) || sk.includes(key)) {
        multiplier = Math.min(multiplier, sm);
      }
    }

    // MNM diagnoses: never suppress below original
    if (d.must_not_miss && multiplier < 1.0) {
      multiplier = 1.0;
    }

    if (multiplier === 1.0) return d;

    const newProb = Math.max(1, Math.min(95, Math.round(d.probability * multiplier)));
    return { ...d, probability: newProb };
  });

  // Re-sort by probability descending
  adjusted.sort((a, b) => b.probability - a.probability);
  return adjusted;
}
