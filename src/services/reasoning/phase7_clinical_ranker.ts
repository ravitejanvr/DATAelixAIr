/**
 * Phase 7 — Clinical Intelligence Ranking Engine
 *
 * Post-processes Intelligence Core output (Phase 6) with structured
 * clinical reasoning:
 *   1. Base normalization
 *   2. Temporal fit adjustment
 *   3. Clinical pattern matching (NOT keyword overlap)
 *   4. Mismatch penalty
 *   5. Competition suppression (domain grouping)
 *   6. Epidemiology prior
 *   7. Clinical coherence validation
 *   8. Final re-ranking
 *
 * Invariants:
 *   - NEVER adds or removes diagnoses
 *   - Deterministic, explainable
 *   - MNM diagnoses are protected (penalties capped)
 *   - Pure function (no side effects beyond logging)
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import type { RankedDiagnosis, IntelligenceCoreResult } from "./intelligence_core";
import { clamp, roundTo } from "./scoring_utils";
import { recordOversightEvent } from "@/services/oversight_engine";

// ── Types ──

export interface Phase7Input {
  icResult: IntelligenceCoreResult;
  context: ClinicalContext;
}

export interface Phase7Adjustment {
  temporal_fit: number;
  pattern_boost: number;
  symptom_density: number;
  safety_weight: number;
  domain_consistency: number;
  generic_penalty: number;
  mismatch_penalty: number;
  competition_adjustment: number;
  epi_prior: number;
  coherence_bonus: number;
  pattern_label: string;
  epi_band: string;
  domain: string;
  coherence_explanation: string;
}

export interface Phase7RankedDiagnosis extends RankedDiagnosis {
  phase7: Phase7Adjustment;
  phase7_score: number;
}

export interface Phase7Result {
  ranked: Phase7RankedDiagnosis[];
  top_score: number;
  candidate_count: number;
  execution_ms: number;
  phase7_reordered: boolean;
  reorder_summary: string;
}

// ── Clinical Pattern Definitions ──

interface ClinicalPattern {
  id: string;
  label: string;
  /** Symptom/signal requirements (ANY set match triggers) */
  signal_groups: string[][];
  /** Duration requirement: "acute" (<14d), "subacute" (14d-8w), "chronic" (>8w), null = any */
  temporal_window: "acute" | "subacute" | "chronic" | null;
  /** Diagnoses that match this pattern get boosted */
  matching_diagnoses: string[];
  /** Boost amount: 0.2-0.4 */
  boost: number;
  /** Context requirements (age, risk factors) */
  context_filter?: (ctx: ClinicalContext) => boolean;
}

const CLINICAL_PATTERNS: ClinicalPattern[] = [
  // ── Respiratory Infection ──
  {
    id: "acute_respiratory_infection",
    label: "Acute respiratory infection pattern",
    signal_groups: [
      ["cough", "fever"],
      ["cough", "sputum"],
      ["cough", "chest", "fatigue"],
      ["dyspnea", "fever"],
      ["shortness of breath", "cough"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["pneumonia", "bronchitis", "acute bronchitis", "community acquired pneumonia",
      "lower respiratory tract infection", "covid-19", "influenza"],
    boost: 0.35,
  },
  {
    id: "vague_respiratory",
    label: "Vague respiratory illness (atypical)",
    signal_groups: [
      ["fatigue", "chest heaviness"],
      ["fatigue", "mild cough"],
      ["chest heaviness", "cough"],
      ["malaise", "cough"],
      ["loss of appetite", "cough"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["pneumonia", "bronchitis", "tuberculosis", "pleural effusion"],
    boost: 0.3,
  },
  // ── Cardiac ──
  {
    id: "acute_cardiac",
    label: "Acute cardiac event pattern",
    signal_groups: [
      ["chest pain", "diaphoresis"],
      ["chest pain", "radiation"],
      ["crushing chest"],
      ["chest pain", "shortness of breath"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["myocardial infarction", "acute coronary syndrome", "unstable angina"],
    boost: 0.35,
  },
  {
    id: "atypical_arrhythmia",
    label: "Atypical arrhythmia presentation",
    signal_groups: [
      ["fatigue", "weakness"],
      ["exercise intolerance", "fatigue"],
      ["dizziness", "fatigue"],
      ["palpitations", "fatigue"],
    ],
    temporal_window: null,
    matching_diagnoses: ["atrial fibrillation", "svt", "wpw syndrome", "sick sinus syndrome"],
    boost: 0.3,
    context_filter: (ctx) => (ctx.patient_age ?? 0) > 50,
  },
  {
    id: "heart_failure_pattern",
    label: "Congestive heart failure pattern",
    signal_groups: [
      ["dyspnea", "edema"],
      ["orthopnea", "fatigue"],
      ["shortness of breath", "ankle swelling"],
      ["fatigue", "weight gain", "nocturnal cough"],
    ],
    temporal_window: null,
    matching_diagnoses: ["heart failure", "congestive heart failure"],
    boost: 0.3,
    context_filter: (ctx) => (ctx.patient_age ?? 0) > 45,
  },
  // ── Abdominal ──
  {
    id: "acute_abdomen",
    label: "Acute abdomen pattern",
    signal_groups: [
      ["abdominal pain", "vomiting"],
      ["abdominal pain", "fever"],
      ["abdominal pain", "guarding"],
      ["right lower quadrant", "nausea"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["appendicitis", "cholecystitis", "pancreatitis", "bowel obstruction", "diverticulitis"],
    boost: 0.3,
  },
  {
    id: "referred_biliary",
    label: "Referred biliary pain (Kehr's sign)",
    signal_groups: [
      ["shoulder pain", "nausea"],
      ["right shoulder", "abdominal pain"],
      ["shoulder pain", "vomiting"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["cholecystitis", "acute cholecystitis", "biliary colic"],
    boost: 0.35,
  },
  // ── Neurological ──
  {
    id: "acute_stroke",
    label: "Acute stroke pattern",
    signal_groups: [
      ["weakness", "speech"],
      ["facial droop", "arm weakness"],
      ["sudden headache", "vomiting"],
      ["confusion", "unilateral weakness"],
      ["dizziness", "vertigo", "weakness"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["stroke", "posterior circulation stroke", "tia", "subarachnoid hemorrhage"],
    boost: 0.35,
  },
  {
    id: "meningeal_pattern",
    label: "Meningeal irritation pattern",
    signal_groups: [
      ["headache", "fever", "neck stiffness"],
      ["headache", "photophobia", "fever"],
      ["fever", "confusion", "neck pain"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["meningitis", "subarachnoid hemorrhage", "encephalitis"],
    boost: 0.35,
  },
  // ── Systemic infection ──
  {
    id: "systemic_infection",
    label: "Systemic infection / sepsis pattern",
    signal_groups: [
      ["fever", "chills", "confusion"],
      ["fever", "tachycardia", "weakness"],
      ["lethargy", "fever"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["sepsis", "pneumonia", "urinary tract infection", "pyelonephritis", "infective endocarditis"],
    boost: 0.3,
    context_filter: (ctx) => (ctx.patient_age ?? 0) > 60,
  },
  {
    id: "subacute_infection",
    label: "Subacute infection pattern",
    signal_groups: [
      ["fatigue", "fever", "weight loss"],
      ["night sweats", "fever"],
      ["malaise", "low grade fever"],
      ["fatigue", "fever"],
    ],
    temporal_window: "subacute",
    matching_diagnoses: ["tuberculosis", "infective endocarditis", "lymphoma", "hiv"],
    boost: 0.25,
  },
  // ── Endocrine ──
  {
    id: "dka_pattern",
    label: "DKA prodrome pattern",
    signal_groups: [
      ["polyuria", "polydipsia", "nausea"],
      ["thirst", "vomiting", "abdominal pain"],
      ["fruity breath", "confusion"],
    ],
    temporal_window: "acute",
    matching_diagnoses: ["diabetic ketoacidosis"],
    boost: 0.35,
  },
  // ── Effusion / Fluid ──
  {
    id: "pleural_effusion_pattern",
    label: "Pleural effusion pattern",
    signal_groups: [
      ["dyspnea", "lying down"],
      ["shortness of breath", "positional"],
      ["chest heaviness", "dyspnea"],
      ["orthopnea", "chest heaviness"],
    ],
    temporal_window: null,
    matching_diagnoses: ["pleural effusion", "heart failure", "pericardial effusion"],
    boost: 0.3,
  },
];

// ── Epidemiology Bands ──

interface EpiBand {
  label: string;
  adjustment: number;
  /** Minimum evidence strength required to rank in top 3 */
  evidence_floor: number;
}

const EPI_BANDS: Record<string, EpiBand> = {
  very_common: { label: "Very Common", adjustment: 0.3, evidence_floor: 0.1 },
  common: { label: "Common", adjustment: 0.2, evidence_floor: 0.15 },
  moderately_common: { label: "Moderately Common", adjustment: 0.0, evidence_floor: 0.2 },
  rare: { label: "Rare", adjustment: -0.2, evidence_floor: 0.35 },
  very_rare: { label: "Very Rare", adjustment: -0.4, evidence_floor: 0.5 },
};

const DIAGNOSIS_EPI: Record<string, string> = {
  // Very common in primary care
  "upper respiratory tract infection": "very_common",
  "viral upper respiratory infection": "very_common",
  "gastroenteritis": "very_common",
  "urinary tract infection": "very_common",
  "tension headache": "very_common",
  "migraine": "very_common",
  "allergic rhinitis": "very_common",

  // Common
  "pneumonia": "common",
  "bronchitis": "common",
  "acute bronchitis": "common",
  "asthma exacerbation": "common",
  "gerd": "common",
  "peptic ulcer disease": "common",
  "irritable bowel syndrome": "common",
  "type 2 diabetes mellitus": "common",
  "hypertension": "common",
  "atrial fibrillation": "common",
  "anxiety disorder": "common",
  "depression": "common",
  "costochondritis": "common",

  // Moderately common
  "heart failure": "moderately_common",
  "copd exacerbation": "moderately_common",
  "cholecystitis": "moderately_common",
  "appendicitis": "moderately_common",
  "dvt": "moderately_common",
  "cellulitis": "moderately_common",
  "diverticulitis": "moderately_common",
  "pleural effusion": "moderately_common",
  "pyelonephritis": "moderately_common",
  "stable angina": "moderately_common",

  // Rare
  "pulmonary embolism": "rare",
  "myocardial infarction": "rare",
  "acute coronary syndrome": "rare",
  "stroke": "rare",
  "meningitis": "rare",
  "sepsis": "rare",
  "pancreatitis": "rare",
  "aortic dissection": "rare",
  "infective endocarditis": "rare",
  "cauda equina syndrome": "rare",
  "diabetic ketoacidosis": "rare",
  "tuberculosis": "rare",
  "bowel obstruction": "rare",

  // Very rare
  "subarachnoid hemorrhage": "very_rare",
  "anaphylaxis": "very_rare",
  "cardiac tamponade": "very_rare",
  "tension pneumothorax": "very_rare",
  "ruptured aaa": "very_rare",
  "fournier gangrene": "very_rare",
  "neuroleptic malignant syndrome": "very_rare",
  "retinoblastoma": "very_rare",
  "lithium toxicity": "very_rare",
};

// ── Generic / Vague Diagnoses ──
const GENERIC_DIAGNOSES = new Set([
  "anxiety disorder", "viral syndrome", "nonspecific illness",
  "viral upper respiratory infection", "tension headache",
  "irritable bowel syndrome", "costochondritis", "functional dyspepsia",
  "somatization disorder", "benign positional vertigo", "panic disorder",
  "generalized anxiety disorder", "stress reaction",
]);

// ── MNM Safety Diagnoses ──
const MNM_SAFETY_SET = new Set([
  "pulmonary embolism", "myocardial infarction", "acute coronary syndrome",
  "stroke", "posterior circulation stroke", "subarachnoid hemorrhage",
  "sepsis", "meningitis", "aortic dissection", "cardiac tamponade",
  "cauda equina syndrome", "necrotizing fasciitis", "diabetic ketoacidosis",
  "ruptured aaa", "tension pneumothorax", "anaphylaxis",
  "bowel obstruction", "ectopic pregnancy",
]);

// ── Domain Groups for Competition ──

const DOMAIN_GROUPS: Record<string, string[]> = {
  respiratory_infection: ["pneumonia", "bronchitis", "acute bronchitis", "community acquired pneumonia", "influenza", "covid-19"],
  chronic_respiratory: ["copd exacerbation", "tuberculosis", "lung cancer", "pleural effusion"],
  cardiac_acute: ["myocardial infarction", "acute coronary syndrome", "unstable angina"],
  cardiac_chronic: ["atrial fibrillation", "stable angina", "heart failure", "pericardial effusion"],
  abdominal_acute: ["appendicitis", "cholecystitis", "pancreatitis", "bowel obstruction", "diverticulitis"],
  neuro_acute: ["stroke", "posterior circulation stroke", "subarachnoid hemorrhage", "meningitis", "tia"],
  infection_systemic: ["sepsis", "infective endocarditis", "pyelonephritis"],
  functional: ["anxiety disorder", "irritable bowel syndrome", "costochondritis", "tension headache"],
  malignancy: ["lung cancer", "lymphoma", "retinoblastoma"],
  autoimmune: ["systemic lupus erythematosus", "rheumatoid arthritis", "multiple sclerosis"],
  renal: ["acute kidney injury", "nephrotic syndrome", "pyelonephritis"],
  psychiatric: ["panic disorder", "generalized anxiety disorder", "somatization disorder"],
};

// ── Coherence Expectations ──
// Maps diagnosis → minimum expected symptom keywords for coherence

const COHERENCE_EXPECTATIONS: Record<string, { required_any: string[][]; min_groups: number }> = {
  "pneumonia": { required_any: [["cough", "mild cough", "productive cough"], ["fever", "temperature"], ["fatigue", "malaise", "weakness"], ["chest", "dyspnea", "shortness of breath"]], min_groups: 2 },
  "bronchitis": { required_any: [["cough"], ["sputum", "mucus"], ["chest"]], min_groups: 1 },
  "atrial fibrillation": { required_any: [["palpitations", "irregular"], ["fatigue", "weakness", "exercise intolerance"], ["dizziness", "syncope"]], min_groups: 1 },
  "pleural effusion": { required_any: [["dyspnea", "shortness of breath", "breathlessness"], ["chest", "heaviness"], ["lying down", "orthopnea"]], min_groups: 1 },
  "heart failure": { required_any: [["dyspnea", "shortness of breath"], ["edema", "swelling"], ["fatigue", "weakness"]], min_groups: 2 },
  "cholecystitis": { required_any: [["abdominal pain", "epigastric", "right upper"], ["nausea", "vomiting"], ["fever"]], min_groups: 2 },
  "appendicitis": { required_any: [["abdominal pain", "right lower"], ["nausea", "vomiting"], ["fever"]], min_groups: 2 },
  "stroke": { required_any: [["weakness", "paralysis"], ["speech", "slurred"], ["confusion", "altered"]], min_groups: 1 },
  "pulmonary embolism": { required_any: [["dyspnea", "shortness of breath"], ["chest pain", "pleuritic"], ["tachycardia"]], min_groups: 1 },
  "sepsis": { required_any: [["fever", "chills"], ["confusion", "altered mental"], ["tachycardia", "hypotension"]], min_groups: 2 },
  "tuberculosis": { required_any: [["cough"], ["night sweats", "weight loss"], ["fever"]], min_groups: 2 },
  "meningitis": { required_any: [["headache"], ["fever"], ["neck stiffness", "photophobia"]], min_groups: 2 },
  "myocardial infarction": { required_any: [["chest pain", "chest tightness"], ["diaphoresis", "sweating"], ["radiation", "arm", "jaw"]], min_groups: 1 },
  "infective endocarditis": { required_any: [["fever"], ["fatigue", "malaise"], ["murmur", "valve"]], min_groups: 2 },
};

// ── Core Implementation ──

function extractAllSymptoms(ctx: ClinicalContext): string[] {
  const syms: string[] = [];
  if (ctx.chief_complaint) syms.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) syms.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) syms.push(...ctx.associated_symptoms);
  return [...new Set(syms)].map(s => s.toLowerCase().trim());
}

function parseDurationDays(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const d = duration.toLowerCase();
  const num = parseFloat(d.replace(/[^\d.]/g, ""));
  if (isNaN(num)) return null;
  if (d.includes("hour")) return num / 24;
  if (d.includes("day")) return num;
  if (d.includes("week")) return num * 7;
  if (d.includes("month")) return num * 30;
  if (d.includes("year")) return num * 365;
  return num; // Assume days
}

function getTemporalWindow(days: number | null): "acute" | "subacute" | "chronic" | null {
  if (days === null) return null;
  if (days <= 14) return "acute";
  if (days <= 56) return "subacute";
  return "chronic";
}

function hasAnySignal(symptoms: string[], targets: string[]): boolean {
  return targets.some(t =>
    symptoms.some(s => s.includes(t.toLowerCase()) || t.toLowerCase().includes(s))
  );
}

function matchSignalGroup(symptoms: string[], group: string[]): boolean {
  return group.every(term => hasAnySignal(symptoms, [term]));
}

function getDiagnosisDomain(diagLower: string): string {
  for (const [domain, members] of Object.entries(DOMAIN_GROUPS)) {
    if (members.some(m => diagLower.includes(m) || m.includes(diagLower))) {
      return domain;
    }
  }
  return "other";
}

function getEpiBand(diagLower: string): { band: EpiBand; key: string } {
  const key = DIAGNOSIS_EPI[diagLower] || "moderately_common";
  return { band: EPI_BANDS[key] || EPI_BANDS.moderately_common, key };
}

function computeCoherence(diagLower: string, symptoms: string[]): { score: number; explanation: string } {
  const expectations = COHERENCE_EXPECTATIONS[diagLower];
  if (!expectations) {
    return { score: 0, explanation: "no coherence profile" };
  }

  let groupsMatched = 0;
  const matchedGroups: string[] = [];
  for (const group of expectations.required_any) {
    if (hasAnySignal(symptoms, group)) {
      groupsMatched++;
      matchedGroups.push(group[0]);
    }
  }

  const totalGroups = expectations.required_any.length;
  const coverage = groupsMatched / totalGroups;
  const meetsMinimum = groupsMatched >= expectations.min_groups;

  const score = meetsMinimum
    ? clamp(coverage * 0.3, 0, 0.3)  // Bonus up to 0.3
    : clamp(-0.15 * (1 - coverage), -0.15, 0);  // Penalty for poor fit

  const explanation = meetsMinimum
    ? `Coherent: ${groupsMatched}/${totalGroups} groups matched [${matchedGroups.join(",")}]`
    : `Weak coherence: ${groupsMatched}/${totalGroups} groups (needs ${expectations.min_groups})`;

  return { score, explanation };
}

// ── Tier Classification ──

type RankingTier = 1 | 2 | 3;

function classifyTier(
  patternBoost: number,
  symptomDensity: number,
  isMNM: boolean,
  isGeneric: boolean,
  hasStructuredAlternative: boolean,
  coherenceGroupsMatched: number,
  coherenceMinGroups: number,
): RankingTier {
  // Tier 1: Strong pattern match + good symptom density, OR MNM with evidence
  if (patternBoost >= 0.5) return 1;
  if (isMNM && (symptomDensity >= 0.1 || patternBoost > 0)) return 1;
  if (patternBoost > 0 && symptomDensity >= 0.15) return 1;
  if (coherenceGroupsMatched >= coherenceMinGroups && coherenceGroupsMatched >= 2 && patternBoost > 0) return 1;

  // Tier 3: Generic fallback when structured alternatives exist
  if (isGeneric && hasStructuredAlternative) return 3;

  // Tier 2: Everything else (partial matches, weak signals)
  return 2;
}

// ── Main Function ──

export function applyPhase7Ranking(input: Phase7Input): Phase7Result {
  const t0 = performance.now();
  const { icResult, context } = input;
  const symptoms = extractAllSymptoms(context);
  const durationDays = parseDurationDays(context.symptom_duration);
  const temporalWindow = getTemporalWindow(durationDays);

  // Track original order for reorder detection
  const originalOrder = icResult.ranked.map(r => r.diagnosis);

  // ── Pre-compute domain signal counts for domain consistency ──
  const domainSignalCounts = new Map<string, number>();
  for (const candidate of icResult.ranked) {
    const d = getDiagnosisDomain(candidate.diagnosis.toLowerCase().trim());
    if (d !== "other") {
      domainSignalCounts.set(d, (domainSignalCounts.get(d) || 0) + 1);
    }
  }

  // Check if any structured (non-generic) diagnosis exists
  const hasStructuredCandidate = icResult.ranked.some(c => {
    const dl = c.diagnosis.toLowerCase().trim();
    return !GENERIC_DIAGNOSES.has(dl) && c.score > 0.1;
  });

  const phase7Ranked: Phase7RankedDiagnosis[] = icResult.ranked.map(candidate => {
    const diagLower = candidate.diagnosis.toLowerCase().trim();
    const isMNM = candidate.reasoning.mnm_flag || MNM_SAFETY_SET.has(diagLower);

    // ── STEP 1: Base normalization (use IC score as base) ──
    let adjustedScore = candidate.score;

    // ── STEP 2: Temporal fit (AMPLIFIED) ──
    let temporalFit = 0;
    if (temporalWindow === "acute") {
      const chronicDx = ["tuberculosis", "lung cancer", "lymphoma", "copd", "chronic mesenteric ischemia"];
      if (chronicDx.some(c => diagLower.includes(c))) {
        temporalFit = -0.5;
      }
    } else if (temporalWindow === "chronic") {
      const acuteDx = ["anaphylaxis", "pneumothorax", "testicular torsion"];
      if (acuteDx.some(a => diagLower.includes(a))) {
        temporalFit = -0.6;
      }
    }
    if (isMNM && temporalFit < -0.15) temporalFit = -0.15;

    // ── STEP 3: Pattern matching (AMPLIFIED: up to +1.0) ──
    let patternBoost = 0;
    let patternLabel = "none";
    for (const pattern of CLINICAL_PATTERNS) {
      if (pattern.temporal_window && temporalWindow && pattern.temporal_window !== temporalWindow) continue;
      if (pattern.context_filter && !pattern.context_filter(context)) continue;
      if (!pattern.matching_diagnoses.some(m => diagLower.includes(m) || m.includes(diagLower))) continue;
      const signalMatch = pattern.signal_groups.some(group => matchSignalGroup(symptoms, group));
      if (signalMatch) {
        // Amplify: original boost 0.25-0.35 → now ×2.85 giving 0.7-1.0
        const amplifiedBoost = roundTo(pattern.boost * 2.85, 3);
        if (amplifiedBoost > patternBoost) {
          patternBoost = amplifiedBoost;
          patternLabel = pattern.label;
        }
      }
    }

    // ── STEP 4: Symptom Density Score (AMPLIFIED: up to +0.5) ──
    let symptomDensity = 0;
    let coherenceGroupsMatched = 0;
    let coherenceMinGroups = 1;
    const coherenceExpect = COHERENCE_EXPECTATIONS[diagLower];
    if (coherenceExpect) {
      coherenceMinGroups = coherenceExpect.min_groups;
      for (const group of coherenceExpect.required_any) {
        if (hasAnySignal(symptoms, group)) coherenceGroupsMatched++;
      }
      const totalGroups = coherenceExpect.required_any.length;
      // Density bonus scales with coverage: 0 to 0.5
      symptomDensity = roundTo(clamp((coherenceGroupsMatched / Math.max(totalGroups, 1)) * 0.5, 0, 0.5), 3);
    } else {
      // For diagnoses without coherence profiles, use IC symptom_match as proxy
      symptomDensity = roundTo(clamp(candidate.reasoning.symptom_match * 0.25, 0, 0.25), 3);
    }

    // ── STEP 5: Safety Weight (MNM priority — AMPLIFIED: up to +0.8) ──
    let safetyWeight = 0;
    if (isMNM) {
      safetyWeight = 0.4; // Base MNM floor
      if (candidate.reasoning.symptom_match > 0.3 || patternBoost > 0) {
        safetyWeight = 0.6;
      }
      if (patternBoost >= 0.7) {
        safetyWeight = 0.8; // Strong pattern + MNM = maximum safety priority
      }
    }

    // ── STEP 6: Domain Consistency (AMPLIFIED) ──
    const domain = getDiagnosisDomain(diagLower);
    let domainConsistency = 0;
    if (domain !== "other") {
      const domainCount = domainSignalCounts.get(domain) || 0;
      if (domainCount >= 3) domainConsistency = 0.35;
      else if (domainCount >= 2) domainConsistency = 0.2;
    }

    // ── STEP 7: Generic Penalty (AMPLIFIED: down to -1.0) ──
    let genericPenalty = 0;
    if (GENERIC_DIAGNOSES.has(diagLower) && hasStructuredCandidate) {
      genericPenalty = -0.5;
      // If a pattern-matched structured diagnosis exists, max penalty
      if (icResult.ranked.some(c => {
        const cl = c.diagnosis.toLowerCase().trim();
        return !GENERIC_DIAGNOSES.has(cl) && c.score > 0.15;
      })) {
        genericPenalty = -1.0;
      }
    }

    // ── STEP 8: Mismatch penalty (AMPLIFIED) ──
    let mismatchPenalty = 0;
    if (coherenceExpect) {
      if (coherenceGroupsMatched === 0) {
        mismatchPenalty = isMNM ? -0.15 : -0.6;
      } else if (coherenceGroupsMatched < coherenceExpect.min_groups) {
        mismatchPenalty = isMNM ? -0.05 : -0.3;
      }
    }

    // ── STEP 9: Epidemiology prior (AMPLIFIED) ──
    const { band: epiBand, key: epiKey } = getEpiBand(diagLower);
    let epiAdjustment = epiBand.adjustment;
    // Scale rare penalties more aggressively
    if (epiAdjustment < 0) {
      epiAdjustment *= 1.5;
      if (isMNM) epiAdjustment = Math.max(epiAdjustment, -0.15);
    } else {
      epiAdjustment *= 1.3;
    }

    // ── STEP 10: Clinical coherence (AMPLIFIED) ──
    const coherence = computeCoherence(diagLower, symptoms);
    let coherenceBonus = coherence.score * 2.0; // Double the coherence effect
    if (isMNM && coherenceBonus < 0) coherenceBonus = 0;

    // ── FINAL: Composite Score (unclamped for tier separation) ──
    adjustedScore = adjustedScore
      + temporalFit
      + patternBoost
      + symptomDensity
      + safetyWeight
      + domainConsistency
      + genericPenalty
      + mismatchPenalty
      + epiAdjustment
      + coherenceBonus;

    // Classify tier BEFORE clamping
    const tier = classifyTier(
      patternBoost,
      symptomDensity,
      isMNM,
      GENERIC_DIAGNOSES.has(diagLower),
      hasStructuredCandidate,
      coherenceGroupsMatched,
      coherenceMinGroups,
    );

    // Add tier separation: Tier 1 gets +2.0, Tier 2 gets +1.0, Tier 3 gets +0.0
    // This ensures tiers never overlap in score space
    const tierOffset = tier === 1 ? 2.0 : tier === 2 ? 1.0 : 0.0;
    adjustedScore += tierOffset;

    return {
      ...candidate,
      score: candidate.score,
      phase7: {
        temporal_fit: roundTo(temporalFit, 3),
        pattern_boost: roundTo(patternBoost, 3),
        symptom_density: symptomDensity,
        safety_weight: roundTo(safetyWeight, 3),
        domain_consistency: roundTo(domainConsistency, 3),
        generic_penalty: roundTo(genericPenalty, 3),
        mismatch_penalty: roundTo(mismatchPenalty, 3),
        competition_adjustment: 0,
        epi_prior: roundTo(epiAdjustment, 3),
        coherence_bonus: roundTo(coherenceBonus, 3),
        pattern_label: patternLabel,
        epi_band: epiBand.label,
        domain,
        coherence_explanation: `[T${tier}] ${coherence.explanation}`,
      },
      phase7_score: roundTo(adjustedScore, 4),
    } as Phase7RankedDiagnosis & { _tier: RankingTier };
  });

  // ── Sort: Tier first, then score within tier ──
  phase7Ranked.sort((a, b) => b.phase7_score - a.phase7_score);

  // ── Hard Ranking Rules (post-sort enforcement) ──

  // Rule 1: MNM cannot fall below Top-5
  const mnmOutsideTop5 = phase7Ranked
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => {
      const dl = c.diagnosis.toLowerCase().trim();
      return i >= 5 && (c.reasoning.mnm_flag || MNM_SAFETY_SET.has(dl));
    })
    .filter(({ c }) => {
      // Only enforce if there's some symptom evidence
      return c.reasoning.symptom_match > 0.2 || c.phase7.pattern_boost > 0 || c.phase7.safety_weight > 0;
    });

  for (const { c: mnmCandidate } of mnmOutsideTop5) {
    // Find lowest-ranked non-MNM in top-5 and swap
    for (let i = 4; i >= 0; i--) {
      const occupant = phase7Ranked[i];
      const occLower = occupant.diagnosis.toLowerCase().trim();
      if (!occupant.reasoning.mnm_flag && !MNM_SAFETY_SET.has(occLower)) {
        // Boost MNM above occupant
        const boost = occupant.phase7_score - mnmCandidate.phase7_score + 0.05;
        mnmCandidate.phase7.competition_adjustment = roundTo(boost, 3);
        mnmCandidate.phase7_score = roundTo(mnmCandidate.phase7_score + boost, 4);
        break;
      }
    }
  }

  // Rule 2: Generic CANNOT be Top-1 if structured exists
  phase7Ranked.sort((a, b) => b.phase7_score - a.phase7_score);
  const top = phase7Ranked[0];
  if (top && GENERIC_DIAGNOSES.has(top.diagnosis.toLowerCase().trim())) {
    const bestStructured = phase7Ranked.find(c =>
      !GENERIC_DIAGNOSES.has(c.diagnosis.toLowerCase().trim())
    );
    if (bestStructured) {
      const boost = top.phase7_score - bestStructured.phase7_score + 0.1;
      bestStructured.phase7.competition_adjustment = roundTo(
        bestStructured.phase7.competition_adjustment + boost, 3
      );
      bestStructured.phase7_score = roundTo(bestStructured.phase7_score + boost, 4);
    }
  }

  // ── Domain competition suppression (stronger) ──
  phase7Ranked.sort((a, b) => b.phase7_score - a.phase7_score);
  const domainBest = new Map<string, number>();
  for (const c of phase7Ranked) {
    const d = c.phase7.domain;
    if (d === "other") continue;
    const current = domainBest.get(d);
    if (!current || c.phase7_score > current) {
      domainBest.set(d, c.phase7_score);
    }
  }

  for (const c of phase7Ranked) {
    const d = c.phase7.domain;
    if (d === "other") continue;
    const bestInDomain = domainBest.get(d) ?? 0;
    const dl = c.diagnosis.toLowerCase().trim();
    if (c.phase7_score < bestInDomain && !c.reasoning.mnm_flag && !MNM_SAFETY_SET.has(dl)) {
      const gap = bestInDomain - c.phase7_score;
      const suppression = -clamp(gap * 0.5, 0, 0.3);
      c.phase7.competition_adjustment = roundTo(c.phase7.competition_adjustment + suppression, 3);
      c.phase7_score = roundTo(c.phase7_score + suppression, 4);
    }
  }

  // Final sort
  phase7Ranked.sort((a, b) => b.phase7_score - a.phase7_score);

  // Normalize scores back to 0-1 range for display (preserve ordering)
  const maxScore = phase7Ranked[0]?.phase7_score ?? 1;
  if (maxScore > 1) {
    for (const c of phase7Ranked) {
      c.phase7_score = roundTo(clamp(c.phase7_score / maxScore, 0.01, 1.0), 4);
    }
  }

  // Detect reordering
  const newOrder = phase7Ranked.map(r => r.diagnosis);
  const reordered = originalOrder.some((d, i) => newOrder[i] !== d);
  const reorderSummary = reordered
    ? `Top reorder: ${originalOrder[0]} → ${newOrder[0]}`
    : "No reorder";

  const executionMs = Math.round(performance.now() - t0);

  // Log Phase 7 activity
  if (reordered || phase7Ranked.some(c => c.phase7.pattern_boost > 0)) {
    console.log(
      `[Phase7] Re-ranked ${phase7Ranked.length} candidates in ${executionMs}ms. ${reorderSummary}. ` +
      `Top-3: [${newOrder.slice(0, 3).join(", ")}]`
    );

    recordOversightEvent({
      event_type: "phase6_safetynet" as any,
      severity: "info",
      stage: "phase7_ranking",
      message: `Phase 7 ranking: ${reorderSummary}`,
      metadata: {
        reordered,
        top3_before: originalOrder.slice(0, 3),
        top3_after: newOrder.slice(0, 3),
        adjustments: phase7Ranked.slice(0, 5).map(c => ({
          dx: c.diagnosis,
          ic_score: c.score,
          p7_score: c.phase7_score,
          pattern: c.phase7.pattern_label,
          tier: c.phase7.coherence_explanation.match(/\[T(\d)\]/)?.[1] || "?",
          epi: c.phase7.epi_band,
        })),
      } as any,
    });
  }

  return {
    ranked: phase7Ranked,
    top_score: phase7Ranked[0]?.phase7_score ?? 0,
    candidate_count: phase7Ranked.length,
    execution_ms: executionMs,
    phase7_reordered: reordered,
    reorder_summary: reorderSummary,
  };
}
