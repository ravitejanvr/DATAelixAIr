/**
 * Must-Not-Miss Escalation — the single deterministic safety-detection path
 * (ROADMAP items 9 + 10).
 *
 * Before this module, three independent rule sets checked the same
 * must-not-miss presentations (ACS, meningitis, PE, stroke, sepsis, ...),
 * each with its own thresholds and matching strategy:
 *   1. `clinical-safety` edge function — vitals bands + emergency patterns
 *      (substring matching on free text). Feeds the cockpit override gate,
 *      `finalize-consultation`'s server-side block, and four other edge
 *      functions.
 *   2. V4 `services/safety/analyzeSafety` — canonical-ID cluster rules.
 *      Feeds V4 authority promotion.
 *   3. O1 `context_engine` — `risk_flag_engine` (string-set rules) plus
 *      `context_aware_safety` (comorbidity/age rules; computed in the
 *      orchestrator and then discarded except for an oversight event).
 * They are now adapters over `evaluateMustNotMiss()`; this file is the only
 * place the rules live.
 *
 * Design constraints:
 *   - Pure and deterministic: no I/O, no clock, no randomness. Same input,
 *     same output, in Deno (edge functions) and in the browser/vitest.
 *   - No imports, so it can be shared between `supabase/functions/*` and
 *     `src/*` (same pattern as `guideline_precedence.ts`).
 *   - Monotonic: adding a symptom, a feature, a history item or making a
 *     vital more abnormal never removes an escalation. Every rule is a
 *     conjunction of "present" facts, never of absences.
 *   - Decoupled from differential diagnosis: nothing here reads DDX/Bayesian
 *     output. Must-not-miss escalation is evaluated on the presentation
 *     alone, so it can be tested and measured on its own (item 10).
 *
 * Two tiers:
 *   - "escalation": a must-not-miss presentation. Surfaces as severity
 *     "critical" in every adapter, which is what the cockpit override gate
 *     and `finalize-consultation` block on.
 *   - "advisory": shown to the clinician, never gates finalize.
 *
 * Bump MNM_RULESET_VERSION whenever a rule, threshold or term changes; the
 * version is recorded with every safety check and every finalize ledger
 * entry so each decision can be traced to the exact rule set that made it.
 */

export const MNM_RULESET_VERSION = "mnm-2026.10.02-1";

// ══════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════

export type MnmTier = "escalation" | "advisory";
export type MnmKind = "vital" | "pattern" | "context";

export interface MnmVitals {
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse?: number | null;
  /** °C or °F — values > 50 are treated as °F and converted. */
  temperature?: number | null;
  spo2?: number | null;
  respiratory_rate?: number | null;
  /** mg/dL */
  blood_sugar?: number | null;
}

export interface MnmInput {
  /** Free-text symptoms / chief complaint / findings. Canonical IDs (e.g. "CHEST_PAIN") are also accepted here. */
  symptoms?: string[] | null;
  /** Canonical feature IDs from `services/canonical`. */
  features?: string[] | null;
  vitals?: MnmVitals | null;
  /** Years. Fractions allowed (neonates). */
  age?: number | null;
  /** Free-text history, comorbidities and risk factors. */
  history?: string[] | null;
}

export interface MnmTrigger {
  /** Stable rule identifier — what an audit trail should key on. */
  rule_id: string;
  /** Condition name used to match diagnoses (e.g. V4 authority promotion). */
  condition: string;
  /** Display name. Kept identical to the pre-unification names where one existed. */
  label: string;
  tier: MnmTier;
  kind: MnmKind;
  /** What in the input matched — the audit evidence for this trigger. */
  evidence: string[];
  action: string;
  /** Vital-sign triggers only. */
  vital?: { parameter: MnmVitalKey; value: number; direction: "low" | "high" };
}

export interface MnmResult {
  /** True iff at least one escalation-tier trigger fired. */
  escalate: boolean;
  triggers: MnmTrigger[];
  ruleset_version: string;
}

export type MnmVitalKey =
  | "bp_systolic" | "bp_diastolic" | "pulse" | "temperature"
  | "spo2" | "respiratory_rate" | "blood_sugar";

// ══════════════════════════════════════════════
// Concepts — how a clinical finding is recognised in the input
// ══════════════════════════════════════════════
//
// A concept is present if any of its canonical IDs is in `features` (or
// appears as an upper-case ID in `symptoms`), or any of its terms appears in
// the free text starting at a word boundary (suffixes allowed: "sweat"
// matches "sweating", "arm" does not match "warm").
//
// The terms are the keyword lists the three legacy paths already used,
// merged; they are safety-trigger vocabulary, not a canonicalization map
// (that remains `services/canonical/normalizer.ts`).

interface Concept {
  ids: string[];
  terms: string[];
}

const CONCEPTS = {
  CHEST_PAIN: { ids: ["CHEST_PAIN", "PLEURITIC_CHEST_PAIN"], terms: ["chest pain", "chest tightness", "chest pressure", "chest discomfort", "pain in chest", "pain in the chest", "seene mein dard", "seene me dard", "gunde noppi", "thoracic pain", "सीने में दर्द", "ఛాతీ నొప్పి", "நெஞ்சு வலி", "pain worse with breathing"] },
  PLEURITIC_CHEST_PAIN: { ids: ["PLEURITIC_CHEST_PAIN"], terms: ["pleuritic", "pain on breathing", "pain when breathing", "pain on inspiration", "sharp chest pain when breathing", "positional chest pain", "sharp chest pain with breathing", "pain worse with breathing"] },
  RADIATING_PAIN: { ids: [], terms: ["arm", "jaw", "back", "shoulder", "radiat"] },
  DIAPHORESIS: { ids: ["DIAPHORESIS"], terms: ["sweat", "diaphor", "clammy"] },
  NAUSEA: { ids: ["NAUSEA"], terms: ["nausea", "nauseous", "nauseated", "queasy", "feeling sick"] },
  DYSPNEA: { ids: ["DYSPNEA", "ORTHOPNEA", "PND"], terms: ["breathless", "dyspn", "shortness of breath", "short of breath", "difficulty breathing", "difficulty in breathing", "trouble breathing", "can't breathe", "cannot breathe", "breathing difficulty", "laboured breathing", "labored breathing", "air hunger", "orthopn", "oopiritittanam", "saans", "sans lene mein taklif", "सांस की तकलीफ", "ఊపిరి ఆడటం లేదు", "மூச்சுத்திணறல்", "cannot lie flat", "pnd"] },
  RESPIRATORY_SYMPTOM: { ids: ["DYSPNEA", "ORTHOPNEA", "PND", "WHEEZING", "STRIDOR"], terms: ["breathless", "dyspn", "shortness of breath", "short of breath", "difficulty breathing", "difficulty in breathing", "trouble breathing", "can't breathe", "cannot breathe", "breathing difficulty", "oopiritittanam", "saans", "sans lene mein taklif", "wheez", "stridor", "labored breathing", "सांस की तकलीफ", "ఊపిరి ఆడటం లేదు", "மூச்சுத்திணறல்", "orthopnea", "cannot lie flat", "pnd"] },
  HEMOPTYSIS: { ids: ["HEMOPTYSIS"], terms: ["hemoptysis", "haemoptysis", "coughing blood", "coughing up blood", "cough with blood", "blood in sputum", "bloody sputum"] },
  TACHYCARDIA: { ids: ["TACHYCARDIA"], terms: ["tachycard", "racing heart", "heart racing", "fast heart", "rapid pulse"] },
  FEVER: { ids: ["FEVER"], terms: ["fever", "febrile", "pyrexia", "high temperature", "bukhar", "jvaram", "बुखार", "జ్వరం", "காய்ச்சல்"] },
  CHILLS: { ids: ["CHILLS"], terms: ["chill", "rigor", "shiver", "cold feeling"] },
  INFECTION_SIGN: { ids: ["FEVER", "CHILLS"], terms: ["fever", "febrile", "pyrexia", "chill", "rigor", "infection", "infected", "bukhar", "jvaram", "pus", "wound", "बुखार", "జ్వరం", "காய்ச்சல்", "high temperature", "shivering", "cold feeling"] },
  FATIGUE: { ids: ["FATIGUE", "MALAISE"], terms: ["fatigue", "tired", "letharg", "exhaust", "malaise", "thakan", "no energy", "feeling unwell", "generally unwell", "not feeling well"] },
  CONFUSION: { ids: ["CONFUSION"], terms: ["confus", "disorient", "altered mental", "altered sensorium", "delirium"] },
  WEAKNESS: { ids: ["WEAKNESS", "ASCENDING_WEAKNESS"], terms: ["weakness", "paralys", "hemiparesis", "hemiplegia", "कमज़ोरी", "బలహీనత", "பலவீனம்"] },
  NUMBNESS: { ids: [], terms: ["numbness"] },
  TINGLING: { ids: ["TINGLING"], terms: ["tingl", "pins and needles", "numb", "prickling", "paresthesia"] },
  SPEECH_DIFFICULTY: { ids: ["SPEECH_DIFFICULTY"], terms: ["slurred", "speech difficult", "difficulty speaking", "difficulty in speaking", "trouble speaking", "aphasia", "dysarthria", "cannot speak"] },
  FACIAL_DROOP: { ids: ["FACIAL_DROOP"], terms: ["facial droop", "face droop", "drooping face", "face drooping", "facial asymmetry", "facial weakness", "facial palsy"] },
  SEIZURE: { ids: ["SEIZURE"], terms: ["seizure", "convuls", "fitting", "fits"] },
  LOSS_OF_CONSCIOUSNESS: { ids: [], terms: ["loss of consciousness", "lost consciousness"] },
  HEADACHE: { ids: ["HEADACHE", "THUNDERCLAP_HEADACHE"], terms: ["headache", "head ache", "head pain", "sir dard", "sir mein dard", "cephalalgia", "migraine", "सिर दर्द", "తలనొప్పి", "தலைவலி"] },
  THUNDERCLAP_HEADACHE: { ids: ["THUNDERCLAP_HEADACHE"], terms: ["thunderclap", "worst headache", "sudden headache", "sudden severe headache", "sudden onset headache", "sudden-onset headache"] },
  NECK_STIFFNESS: { ids: ["NECK_STIFFNESS", "KERNIG_SIGN", "BRUDZINSKI_SIGN"], terms: ["neck stiff", "stiff neck", "nuchal rigidity", "neck rigidity", "kernig", "brudzinski"] },
  PHOTOPHOBIA: { ids: ["PHOTOPHOBIA"], terms: ["photophobia", "light sensitiv", "sensitivity to light", "sensitive to light"] },
  RASH: { ids: ["RASH", "VESICULAR_RASH", "DERMATOMAL_RASH"], terms: ["rash", "hives", "urticaria", "eruption", "skin lesion", "blisters", "vesicles"] },
  SWELLING: { ids: ["SWELLING"], terms: ["swelling", "swollen", "angioedema"] },
  BACK_PAIN: { ids: ["BACK_PAIN"], terms: ["back pain", "backache", "low back", "lower back", "kamar dard", "lumbar pain", "lbp"] },
  SADDLE_ANESTHESIA: { ids: ["SADDLE_ANESTHESIA"], terms: ["saddle", "perineal numbness", "groin numbness"] },
  VOMITING: { ids: ["VOMITING", "PROJECTILE_VOMITING", "HEMATEMESIS", "HEMATEMESIS_SIGN"], terms: ["vomit", "emesis", "ulti", "throwing up", "puking", "उल्टी", "వాంతి", "வாந்தி", "hematemesis"] },
  DIARRHEA: { ids: ["DIARRHEA"], terms: ["diarr", "loose stool", "loose motion", "dast", "watery stools", "frequent stools", "दस्त", "విరేచనాలు", "வயிற்றுப்போக்கு"] },
  ABDOMINAL_PAIN: { ids: ["ABDOMINAL_PAIN", "EPIGASTRIC_PAIN", "ABDOMINAL_CRAMPS"], terms: ["abdominal pain", "stomach pain", "stomach ache", "belly pain", "tummy pain", "abdominal cramp", "epigastric", "pet dard", "pet mein dard", "abdominal discomfort", "पेट दर्द", "కడుపు నొప్పి", "வயிற்று வலி", "burning in stomach", "stomach cramps", "belly cramps"] },
  EPIGASTRIC_PAIN: { ids: ["EPIGASTRIC_PAIN"], terms: ["epigastric", "burning in stomach", "upper stomach pain"] },
  LOSS_OF_APPETITE: { ids: ["LOSS_OF_APPETITE"], terms: ["loss of appetite", "no appetite", "poor appetite", "anorexia", "bhookh nahi", "not hungry", "decreased appetite"] },
  DEHYDRATION_SIGN: { ids: ["DEHYDRATION"], terms: ["dehydrat", "dry mouth", "no urine", "sunken eyes", "lethargy"] },
  FLUID_LOSS: { ids: ["VOMITING", "PROJECTILE_VOMITING", "DIARRHEA"], terms: ["vomit", "diarr", "emesis", "throwing up", "puking", "ulti", "उल्टी", "వాంతి", "வாந்தி", "loose motions", "loose stools", "watery stools", "frequent stools", "dast", "दस्त", "విరేచనాలు", "வயிற்றுப்போக்கு"] },
  VISUAL_DISTURBANCE: { ids: ["BLURRED_VISION"], terms: ["vision", "blurr", "eye", "can't see clearly"] },
  BLURRED_VISION: { ids: ["BLURRED_VISION"], terms: ["blurred vision", "blurry vision", "blurring of vision", "vision loss", "loss of vision", "can't see clearly", "vision blurry", "double vision"] },
  ALTERED_CONSCIOUSNESS: { ids: ["CONFUSION"], terms: ["confus", "drowsy", "sweating", "tremor", "unresponsive"] },
  DIZZINESS: { ids: ["DIZZINESS"], terms: ["dizz", "vertigo", "lightheaded", "light-headed", "chakkar", "giddiness", "room spinning", "चक्कर", "తల తిరగడం", "தலைச்சுற்றல்"] },
  SYNCOPE: { ids: ["SYNCOPE"], terms: ["syncope", "faint", "passed out", "loss of consciousness", "collapse"] },
  COUGH: { ids: ["COUGH", "PRODUCTIVE_COUGH", "DRY_COUGH", "BARKING_COUGH"], terms: ["cough", "khansi", "खांसी", "దగ్గు", "இருமல்"] },
  WEIGHT_LOSS: { ids: ["WEIGHT_LOSS"], terms: ["weight loss", "lost weight", "losing weight"] },
  NIGHT_SWEATS: { ids: ["NIGHT_SWEATS"], terms: ["night sweat", "sweating at night", "nocturnal sweating"] },
  PERIPHERAL_EDEMA: { ids: ["PERIPHERAL_EDEMA"], terms: ["leg swelling", "ankle swelling", "pedal edema", "pedal oedema", "swollen leg", "swollen ankle", "edema", "oedema", "swollen feet", "foot swelling"] },
  BLOODY_STOOL: { ids: ["BLOODY_STOOL", "MELENA"], terms: ["blood in stool", "bloody stool", "red currant", "melena", "malaena", "black stool", "rectal bleeding", "passing blood", "tarry stool", "dark stool"] },
  FRUITY_BREATH: { ids: ["FRUITY_BREATH", "KUSSMAUL_BREATHING"], terms: ["fruity breath", "acetone breath", "kussmaul", "fruity smell breath", "deep rapid breathing"] },
  POLYURIA: { ids: ["POLYURIA"], terms: ["polyuria", "frequent urination", "urinating a lot", "passing urine frequently", "peeing a lot", "urinary frequency"] },
  POLYDIPSIA: { ids: ["POLYDIPSIA"], terms: ["polydipsia", "excessive thirst", "very thirsty", "increased thirst", "always thirsty"] },
} satisfies Record<string, Concept>;

export type MnmConcept = keyof typeof CONCEPTS;

// Escape a literal term for use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-start boundary that also works for Devanagari/Telugu/Tamil: the term
// must not be preceded by a letter or digit. Suffixes are allowed.
const TERM_PATTERNS: Record<string, RegExp> = {};
function termPattern(term: string): RegExp {
  let re = TERM_PATTERNS[term];
  if (!re) {
    re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term.toLowerCase())}`, "u");
    TERM_PATTERNS[term] = re;
  }
  return re;
}

const CANONICAL_ID_RE = /^[A-Z][A-Z0-9_]+$/;

interface PreparedInput {
  text: string;
  featureIds: Set<string>;
  vitals: Required<{ [K in MnmVitalKey]: number | null }>;
  age: number | null;
  history: string;
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Normalise temperature to °C without mutating the caller's object. */
export function temperatureCelsius(t: number | null | undefined): number | null {
  const v = finite(t);
  if (v == null) return null;
  return v <= 50 ? v : Math.round(((v - 32) * 5 / 9) * 10) / 10;
}

function prepare(input: MnmInput): PreparedInput {
  const featureIds = new Set<string>();
  for (const f of input.features ?? []) {
    if (typeof f === "string" && f.trim()) featureIds.add(f.trim().toUpperCase());
  }
  const textParts: string[] = [];
  for (const s of input.symptoms ?? []) {
    if (typeof s !== "string") continue;
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (CANONICAL_ID_RE.test(trimmed)) featureIds.add(trimmed);
    else textParts.push(trimmed.toLowerCase().replace(/\s+/g, " "));
  }
  const v = input.vitals ?? {};
  return {
    // " | " separates items so a term can't straddle two symptoms.
    text: textParts.join(" | "),
    featureIds,
    vitals: {
      bp_systolic: finite(v.bp_systolic),
      bp_diastolic: finite(v.bp_diastolic),
      pulse: finite(v.pulse),
      temperature: temperatureCelsius(v.temperature),
      spo2: finite(v.spo2),
      respiratory_rate: finite(v.respiratory_rate),
      blood_sugar: finite(v.blood_sugar),
    },
    age: finite(input.age),
    history: (input.history ?? [])
      .filter((h): h is string => typeof h === "string")
      .map(h => h.toLowerCase())
      .join(" | "),
  };
}

/** Returns the evidence string if the concept is present, else null. */
function findConcept(p: PreparedInput, key: MnmConcept): string | null {
  const c: Concept = CONCEPTS[key];
  for (const id of c.ids) if (p.featureIds.has(id)) return id;
  if (p.text) {
    for (const term of c.terms) {
      const m = termPattern(term).exec(p.text);
      if (m) return term;
    }
  }
  return null;
}

/** Vital-derived concepts, so a documented vital counts even if the word wasn't said. */
function derivedConcept(p: PreparedInput, key: MnmConcept): string | null {
  const v = p.vitals;
  if (key === "TACHYCARDIA" && v.pulse != null && v.pulse > 100) return `HR ${v.pulse}`;
  if (key === "FEVER" && v.temperature != null && v.temperature >= 38.0) return `Temp ${v.temperature}°C`;
  return null;
}

function has(p: PreparedInput, key: MnmConcept): string | null {
  return findConcept(p, key) ?? derivedConcept(p, key);
}

// History keywords match whole words (optional plural "s"), so "af" does not
// match "after" and "dm" does not match "admitted" — the legacy substring
// match did both.
const HISTORY_PATTERNS: Record<string, RegExp> = {};
function hasHistory(p: PreparedInput, keywords: string[]): string | null {
  if (!p.history) return null;
  for (const k of keywords) {
    let re = HISTORY_PATTERNS[k];
    if (!re) {
      re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(k)}s?(?![\\p{L}\\p{N}])`, "u");
      HISTORY_PATTERNS[k] = re;
    }
    if (re.test(p.history)) return k;
  }
  return null;
}

// ══════════════════════════════════════════════
// Rule tables
// ══════════════════════════════════════════════

// ── 1. Vital-sign bands ──
// From `clinical-safety` (the bands the cockpit gate has always used),
// with SpO₂ and SBP critical thresholds raised to V4/risk-flag's more
// sensitive values (SpO₂ < 92, SBP < 90) so no path loses an escalation it
// had before.
interface VitalBand {
  key: MnmVitalKey;
  label: string;
  /** value < criticalBelow → escalation */
  criticalBelow?: number;
  /** value <= criticalAtOrBelow → escalation */
  criticalAtOrBelow?: number;
  /** value <= warnAtOrBelow → advisory */
  warnAtOrBelow?: number;
  /** value >= warnAtOrAbove → advisory */
  warnAtOrAbove?: number;
  /** value >= criticalAtOrAbove → escalation */
  criticalAtOrAbove?: number;
  lowAction?: string;
  highAction?: string;
}

const VITAL_BANDS: VitalBand[] = [
  { key: "bp_systolic", label: "Systolic BP", criticalBelow: 90, warnAtOrBelow: 90, warnAtOrAbove: 160, criticalAtOrAbove: 180,
    lowAction: "Evaluate for shock. IV access recommended.", highAction: "Hypertensive crisis. Evaluate end-organ damage." },
  { key: "bp_diastolic", label: "Diastolic BP", criticalAtOrBelow: 50, warnAtOrBelow: 60, warnAtOrAbove: 100, criticalAtOrAbove: 120,
    lowAction: "Evaluate for hypotension and perfusion.", highAction: "Severe hypertension. Urgent evaluation needed." },
  { key: "pulse", label: "Heart Rate", criticalAtOrBelow: 40, warnAtOrBelow: 50, warnAtOrAbove: 120, criticalAtOrAbove: 150,
    lowAction: "Evaluate for bradycardia. ECG recommended.", highAction: "Tachycardia. Rule out sepsis, dehydration, arrhythmia." },
  { key: "temperature", label: "Temperature (°C)", criticalAtOrBelow: 35.0, warnAtOrBelow: 36.0, warnAtOrAbove: 38.5, criticalAtOrAbove: 40.0,
    lowAction: "Hypothermia. Active rewarming needed.", highAction: "High fever. Evaluate for infection or sepsis." },
  { key: "spo2", label: "SpO₂", criticalBelow: 92, warnAtOrBelow: 93,
    lowAction: "Hypoxia. Supplemental oxygen. Evaluate for respiratory distress." },
  { key: "respiratory_rate", label: "Respiratory Rate", criticalAtOrBelow: 8, warnAtOrBelow: 10, warnAtOrAbove: 24, criticalAtOrAbove: 30,
    lowAction: "Bradypnea. Evaluate for CNS depression.", highAction: "Tachypnea. Evaluate for respiratory distress or acidosis." },
  { key: "blood_sugar", label: "Blood Sugar (mg/dL)", criticalAtOrBelow: 54, warnAtOrBelow: 70, warnAtOrAbove: 250, criticalAtOrAbove: 400,
    lowAction: "Hypoglycemia. Administer glucose immediately.", highAction: "Severe hyperglycemia. Evaluate for DKA/HHS." },
];

function evaluateVitals(p: PreparedInput, out: MnmTrigger[]): void {
  for (const b of VITAL_BANDS) {
    const val = p.vitals[b.key];
    if (val == null) continue;
    if ((b.criticalBelow != null && val < b.criticalBelow) || (b.criticalAtOrBelow != null && val <= b.criticalAtOrBelow)) {
      out.push(vitalTrigger(b, val, "low", "escalation", `${b.label} critically low: ${val}`, b.lowAction));
    } else if (b.warnAtOrBelow != null && val <= b.warnAtOrBelow) {
      out.push(vitalTrigger(b, val, "low", "advisory", `${b.label} below normal: ${val}`, b.lowAction));
    }
    if (b.criticalAtOrAbove != null && val >= b.criticalAtOrAbove) {
      out.push(vitalTrigger(b, val, "high", "escalation", `${b.label} critically high: ${val}`, b.highAction));
    } else if (b.warnAtOrAbove != null && val >= b.warnAtOrAbove) {
      out.push(vitalTrigger(b, val, "high", "advisory", `${b.label} above normal: ${val}`, b.highAction));
    }
  }
}

function vitalTrigger(b: VitalBand, value: number, direction: "low" | "high", tier: MnmTier, message: string, action?: string): MnmTrigger {
  return {
    rule_id: `vital_${b.key}_${direction}`,
    condition: b.label,
    label: b.label,
    tier,
    kind: "vital",
    evidence: [message],
    action: action || (tier === "escalation" ? "Urgent evaluation required." : "Monitor closely."),
    vital: { parameter: b.key, value, direction },
  };
}

// ── 2. Presentation patterns ──
// Each pattern is identified by its condition. A pattern fires if any of its
// matchers fires; all matched evidence is merged into one trigger. Sources
// noted per matcher: CS = clinical-safety, V4 = services/safety,
// RF = context_engine/risk_flag_engine.
interface PatternMatch {
  tier: MnmTier;
  evidence: string[];
}

interface PatternRule {
  rule_id: string;
  condition: string;
  label: string;
  action: string;
  match: (p: PreparedInput) => PatternMatch | null;
}

/** All concepts present → evidence list, else null. */
function all(p: PreparedInput, keys: MnmConcept[]): string[] | null {
  const ev: string[] = [];
  for (const k of keys) {
    const e = has(p, k);
    if (!e) return null;
    ev.push(e);
  }
  return ev;
}

/** Fires on the first matching combo of each tier; escalation beats advisory. */
function combos(p: PreparedInput, escalation: MnmConcept[][], advisory: MnmConcept[][] = []): PatternMatch | null {
  for (const c of escalation) {
    const ev = all(p, c);
    if (ev) return { tier: "escalation", evidence: ev };
  }
  for (const c of advisory) {
    const ev = all(p, c);
    if (ev) return { tier: "advisory", evidence: ev };
  }
  return null;
}

function mergeMatches(...ms: Array<PatternMatch | null>): PatternMatch | null {
  const hits = ms.filter((m): m is PatternMatch => m != null);
  if (hits.length === 0) return null;
  const tier: MnmTier = hits.some(h => h.tier === "escalation") ? "escalation" : "advisory";
  const evidence = Array.from(new Set(hits.flatMap(h => h.evidence)));
  return { tier, evidence };
}

const PATTERN_RULES: PatternRule[] = [
  {
    rule_id: "hypertensive_crisis",
    condition: "Hypertensive Crisis",
    label: "Hypertensive Crisis",
    action: "Immediate BP reduction. Evaluate for end-organ damage (brain, heart, kidneys). Consider IV antihypertensives.",
    match: p => {
      // CS: SBP ≥ 180 or DBP ≥ 120, symptoms are supporting evidence only.
      const s = p.vitals.bp_systolic, d = p.vitals.bp_diastolic;
      if (!((s != null && s >= 180) || (d != null && d >= 120))) return null;
      const ev = [`BP ${s ?? "?"}/${d ?? "?"}`];
      if (has(p, "HEADACHE") || termPattern("head").test(p.text)) ev.push("headache");
      if (has(p, "VISUAL_DISTURBANCE")) ev.push("visual disturbance");
      if (has(p, "CHEST_PAIN") || termPattern("chest").test(p.text)) ev.push("chest pain");
      return { tier: "escalation", evidence: ev };
    },
  },
  {
    rule_id: "sepsis",
    condition: "Sepsis",
    label: "Possible Sepsis",
    action: "Blood cultures, IV fluids, broad-spectrum antibiotics within 1 hour. Lactate level. Consider ICU referral.",
    match: p => {
      // CS: ≥2 SIRS criteria + any infection sign. Temperature is compared
      // in °C here — the legacy check compared a °C-converted value against
      // °F thresholds, so the temperature criterion was always met.
      const t = p.vitals.temperature, hr = p.vitals.pulse, rr = p.vitals.respiratory_rate;
      const sirs: string[] = [];
      if (t != null && (t > 38.0 || t < 36.0)) sirs.push(`Temp ${t}°C`);
      if (hr != null && hr > 90) sirs.push(`HR ${hr}`);
      if (rr != null && rr > 20) sirs.push(`RR ${rr}`);
      const infection = has(p, "INFECTION_SIGN");
      const cs: PatternMatch | null = sirs.length >= 2 && infection
        ? { tier: "escalation", evidence: [...sirs, "infection signs"] }
        : null;
      return mergeMatches(
        cs,
        combos(p,
          [
            ["FEVER", "CONFUSION", "TACHYCARDIA"],   // V4
            ["FEVER", "WEAKNESS", "TACHYCARDIA"],    // V4
            ["FEVER", "CONFUSION", "WEAKNESS"],      // RF
          ],
          [
            ["FEVER", "CHILLS", "FATIGUE"],          // RF (was critical) — advisory: too common to gate on
          ],
        ),
      );
    },
  },
  {
    rule_id: "respiratory_distress",
    condition: "Respiratory Distress",
    label: "Respiratory Distress",
    action: "Supplemental O₂. Position upright. ABG if available. Evaluate for pneumonia, PE, asthma exacerbation.",
    match: p => {
      // CS, unchanged thresholds; escalation only when SpO₂ < 90.
      const spo2 = p.vitals.spo2, rr = p.vitals.respiratory_rate;
      const breathing = has(p, "RESPIRATORY_SYMPTOM");
      const fires =
        (spo2 != null && rr != null && spo2 < 92 && rr > 24) ||
        (spo2 != null && spo2 < 88) ||
        (breathing && ((spo2 != null && spo2 < 94) || (rr != null && rr > 22)));
      if (!fires) return null;
      const ev: string[] = [];
      if (spo2 != null && spo2 < 94) ev.push(`SpO₂ ${spo2}%`);
      if (rr != null && rr > 22) ev.push(`RR ${rr}`);
      if (breathing) ev.push("breathing difficulty");
      return { tier: spo2 != null && spo2 < 90 ? "escalation" : "advisory", evidence: ev };
    },
  },
  {
    rule_id: "hypoglycemic_emergency",
    condition: "Hypoglycemia",
    label: "Hypoglycemic Emergency",
    action: "IV dextrose (25g D50) or oral glucose if conscious. Recheck in 15 min. Identify cause.",
    match: p => {
      const bs = p.vitals.blood_sugar;
      if (bs == null || bs > 54) return null;
      const ev = [`Sugar ${bs} mg/dL`];
      if (has(p, "ALTERED_CONSCIOUSNESS")) ev.push("altered consciousness");
      return { tier: "escalation", evidence: ev };
    },
  },
  {
    rule_id: "acs",
    condition: "Acute Coronary Syndrome",
    label: "Possible Acute Coronary Syndrome",
    action: "ECG immediately. Aspirin 325mg. Troponin. Consider referral to cardiology/ED.",
    match: p => {
      const chest = has(p, "CHEST_PAIN");
      let cs: PatternMatch | null = null;
      if (chest) {
        // CS: chest pain + (radiation | sweating/nausea | HR > 100)
        const ev = ["chest pain"];
        const rad = has(p, "RADIATING_PAIN");
        const sweat = has(p, "DIAPHORESIS") || has(p, "NAUSEA");
        const hr = p.vitals.pulse;
        if (rad) ev.push("radiating pain");
        if (sweat) ev.push("diaphoresis/nausea");
        if (hr != null && hr > 100) ev.push(`HR ${hr}`);
        if (ev.length > 1) cs = { tier: "escalation", evidence: ev };
      }
      return mergeMatches(
        cs,
        combos(p, [
          ["CHEST_PAIN", "DIAPHORESIS"],  // V4, RF
          ["CHEST_PAIN", "DYSPNEA"],      // V4, RF
          ["CHEST_PAIN", "NAUSEA"],       // V4, RF
        ]),
      );
    },
  },
  {
    rule_id: "neurological_deficit",
    condition: "Neurological Deficit",
    label: "Neurological Deficit",
    action: "FAST assessment. CT head if stroke suspected. Neurology referral. Monitor GCS.",
    match: p => {
      // CS: any acute neurological symptom escalates (unchanged).
      const ev: string[] = [];
      if (has(p, "WEAKNESS")) ev.push("motor deficit");
      if (has(p, "NUMBNESS")) ev.push("sensory deficit");
      if (has(p, "SPEECH_DIFFICULTY")) ev.push("speech disturbance");
      if (has(p, "SEIZURE")) ev.push("seizure");
      if (has(p, "FACIAL_DROOP")) ev.push("facial droop");
      if (has(p, "CONFUSION")) ev.push("confusion");
      if (has(p, "LOSS_OF_CONSCIOUSNESS")) ev.push("loss of consciousness");
      return ev.length > 0 ? { tier: "escalation", evidence: ev } : null;
    },
  },
  {
    rule_id: "severe_dehydration",
    condition: "Severe Dehydration",
    label: "Severe Dehydration",
    action: "IV fluid resuscitation. Electrolytes. Monitor urine output. Assess for underlying cause.",
    match: p => {
      // CS (unchanged): escalation only when HR > 120.
      const signs = has(p, "DEHYDRATION_SIGN");
      const loss = has(p, "FLUID_LOSS");
      const hr = p.vitals.pulse;
      if (!(signs || (loss && hr != null && hr > 100))) return null;
      const ev: string[] = [];
      if (signs) ev.push("dehydration signs");
      if (loss) ev.push("fluid loss (vomiting/diarrhea)");
      if (hr != null && hr > 100) ev.push(`HR ${hr}`);
      return { tier: hr != null && hr > 120 ? "escalation" : "advisory", evidence: ev };
    },
  },
  {
    rule_id: "meningitis",
    condition: "Meningitis",
    label: "Possible Meningitis",
    action: "Urgent LP. Start empirical antibiotics immediately.",
    match: p => combos(p, [
      ["FEVER", "NECK_STIFFNESS"],                     // V4, RF
      ["FEVER", "HEADACHE", "PHOTOPHOBIA"],            // V4, RF
      ["HEADACHE", "NECK_STIFFNESS", "CONFUSION"],     // V4, RF
    ]),
  },
  {
    rule_id: "pulmonary_embolism",
    condition: "Pulmonary Embolism",
    label: "Possible Pulmonary Embolism",
    action: "CTPA. Start anticoagulation if high clinical probability.",
    match: p => combos(p, [
      ["DYSPNEA", "PLEURITIC_CHEST_PAIN"],             // V4
      ["DYSPNEA", "HEMOPTYSIS"],                       // V4, RF
      ["DYSPNEA", "CHEST_PAIN"],                       // RF (V4 required tachycardia too)
    ]),
  },
  {
    rule_id: "stroke",
    condition: "Stroke",
    label: "Possible Stroke / TIA",
    action: "FAST assessment. Urgent CT head. Neurology referral.",
    match: p => combos(p, [
      ["FACIAL_DROOP", "WEAKNESS"],                    // V4, RF
      ["SPEECH_DIFFICULTY", "WEAKNESS"],               // V4, RF
      ["THUNDERCLAP_HEADACHE"],                        // V4
      ["CONFUSION", "WEAKNESS", "NUMBNESS"],           // RF
    ]),
  },
  {
    rule_id: "anaphylaxis",
    condition: "Anaphylaxis",
    label: "Possible Anaphylaxis",
    action: "Epinephrine IM. Secure airway. Monitor closely.",
    match: p => combos(p, [
      ["RASH", "DYSPNEA", "SWELLING"],                 // V4, RF
      ["RASH", "DYSPNEA"],                             // RF (urticaria + dyspnea; rash + difficulty breathing)
    ]),
  },
  {
    rule_id: "cauda_equina",
    condition: "Cauda Equina Syndrome",
    label: "Possible Cauda Equina Syndrome",
    action: "Urgent MRI spine. Surgical consultation.",
    match: p => combos(p, [["BACK_PAIN", "SADDLE_ANESTHESIA"]]),  // V4
  },
  {
    rule_id: "dka",
    condition: "Diabetic Ketoacidosis",
    label: "Possible Diabetic Ketoacidosis",
    action: "Check blood glucose and ketones urgently. IV fluids.",
    match: p => combos(p, [], [
      ["NAUSEA", "VOMITING", "ABDOMINAL_PAIN"],        // RF (high)
      ["FATIGUE", "VOMITING", "CONFUSION"],            // RF (high)
    ]),
  },
  {
    rule_id: "appendicitis",
    condition: "Appendicitis",
    label: "Possible Appendicitis",
    action: "Clinical exam. Consider ultrasound or CT abdomen.",
    match: p => combos(p, [], [
      ["ABDOMINAL_PAIN", "NAUSEA", "FEVER"],           // RF (high)
      ["ABDOMINAL_PAIN", "VOMITING", "LOSS_OF_APPETITE"], // RF (high)
    ]),
  },
];

// ── 3. Context rules (comorbidity / age) ──
// From `context_aware_safety`. Before unification these were computed in the
// O1 orchestrator and then discarded (only an oversight event survived).
// Rules that fire on a single common symptom in a common comorbidity are
// advisory; only the specific ones escalate.
interface ContextRule {
  rule_id: string;
  condition: string;
  label: string;
  tier: MnmTier;
  action: string;
  /** Returns a context-evidence string when the patient context applies. */
  context: (p: PreparedInput) => string | null;
  features: MnmConcept[];
  minSignals: number;
  /** If set on an advisory rule: escalate once this many features match. */
  escalateAtSignals?: number;
}

const DIABETES = ["diabetes", "diabetic", "dm", "t2dm", "t1dm", "type 2 diabetes", "type 1 diabetes", "insulin dependent"];
const HYPERTENSION = ["hypertension", "hypertensive", "htn", "high blood pressure", "elevated bp"];
const SMOKER_COPD = ["smoker", "smoking", "copd", "chronic bronchitis", "emphysema", "tobacco"];
const THROMBO = ["atrial fibrillation", "af", "afib", "dvt", "deep vein thrombosis", "previous pe", "thromboembolism"];
const IMMUNO = ["hiv", "aids", "immunocompromised", "chemotherapy", "transplant", "immunosuppressed", "steroid", "corticosteroid"];
const PREGNANCY = ["pregnant", "pregnancy", "gravid", "postpartum"];

const comorb = (keywords: string[]) => (p: PreparedInput) => {
  const k = hasHistory(p, keywords);
  return k ? `[comorbidity: ${k}]` : null;
};
const ageIn = (lo: number, hi: number) => (p: PreparedInput) =>
  p.age != null && p.age >= lo && p.age <= hi ? `[age: ${p.age}]` : null;

const CONTEXT_RULES: ContextRule[] = [
  { rule_id: "diabetic_acs_risk", condition: "Acute Coronary Syndrome", label: "Elevated ACS Risk (Diabetic Patient)", tier: "advisory",
    action: "Diabetic patients may present atypically (no chest pain). Order ECG + Troponin. Low threshold for cardiology referral.",
    context: comorb(DIABETES), features: ["CHEST_PAIN", "DYSPNEA", "FATIGUE", "NAUSEA", "DIAPHORESIS", "EPIGASTRIC_PAIN"], minSignals: 1, escalateAtSignals: 2 },
  { rule_id: "diabetic_sepsis_risk", condition: "Sepsis", label: "Elevated Sepsis Risk (Diabetic Patient)", tier: "advisory",
    action: "Diabetics are immunocompromised. Lower threshold for blood cultures and lactate. Consider empirical antibiotics early.",
    context: comorb(DIABETES), features: ["FEVER", "CHILLS", "CONFUSION", "FATIGUE"], minSignals: 1 },
  { rule_id: "diabetic_dka_risk", condition: "Diabetic Ketoacidosis", label: "DKA Risk (Diabetic Patient)", tier: "advisory",
    action: "Check blood glucose, ketones, ABG urgently. IV fluids if confirmed.",
    context: comorb(DIABETES), features: ["NAUSEA", "VOMITING", "ABDOMINAL_PAIN", "CONFUSION", "FRUITY_BREATH", "POLYURIA", "POLYDIPSIA", "DEHYDRATION_SIGN"], minSignals: 1 },
  { rule_id: "htn_stroke_risk", condition: "Stroke", label: "Elevated Stroke Risk (Hypertensive Patient)", tier: "advisory",
    action: "FAST assessment. Urgent CT head. Monitor BP closely. Neurology referral if focal deficits.",
    context: comorb(HYPERTENSION), features: ["HEADACHE", "CONFUSION", "WEAKNESS", "TINGLING", "SPEECH_DIFFICULTY", "BLURRED_VISION", "DIZZINESS", "FACIAL_DROOP"], minSignals: 1 },
  { rule_id: "htn_dissection_risk", condition: "Aortic Dissection", label: "Possible Aortic Dissection (Hypertensive)", tier: "advisory",
    action: "Tearing chest/back pain + HTN = high suspicion. Urgent CT angiography. BP control.",
    context: comorb(HYPERTENSION), features: ["CHEST_PAIN", "BACK_PAIN"], minSignals: 1 },
  { rule_id: "smoker_pe_risk", condition: "Pulmonary Embolism", label: "Elevated PE Risk (Smoker/COPD)", tier: "advisory",
    action: "Consider D-dimer + CTPA. Wells score assessment.",
    context: comorb(SMOKER_COPD), features: ["DYSPNEA", "CHEST_PAIN", "HEMOPTYSIS", "TACHYCARDIA", "PERIPHERAL_EDEMA"], minSignals: 1 },
  { rule_id: "af_stroke_risk", condition: "Stroke", label: "Elevated Stroke Risk (AF/Thromboembolic History)", tier: "advisory",
    action: "Check anticoagulation status. FAST assessment. Urgent imaging if neurological symptoms.",
    context: comorb(THROMBO), features: ["WEAKNESS", "TINGLING", "CONFUSION", "SPEECH_DIFFICULTY", "FACIAL_DROOP", "BLURRED_VISION", "HEADACHE"], minSignals: 1 },
  { rule_id: "thrombo_pe_risk", condition: "Pulmonary Embolism", label: "Elevated PE Risk (Thromboembolic History)", tier: "advisory",
    action: "High pre-test probability. Consider direct CTPA (skip D-dimer). Check anticoagulation compliance.",
    context: comorb(THROMBO), features: ["DYSPNEA", "CHEST_PAIN", "HEMOPTYSIS", "TACHYCARDIA"], minSignals: 1 },
  { rule_id: "immuno_infection_risk", condition: "Opportunistic Infection", label: "Elevated Infection Risk (Immunocompromised)", tier: "advisory",
    action: "Atypical pathogens possible. Lower threshold for imaging, cultures, and empirical broad-spectrum antibiotics.",
    context: comorb(IMMUNO), features: ["FEVER", "COUGH", "FATIGUE", "WEIGHT_LOSS", "NIGHT_SWEATS", "RASH", "DIARRHEA"], minSignals: 1 },
  { rule_id: "pregnancy_pe_risk", condition: "Pulmonary Embolism", label: "Elevated PE Risk (Pregnant/Postpartum)", tier: "advisory",
    action: "Pregnancy increases VTE risk 5x. D-dimer unreliable. Consider CTPA or V/Q scan.",
    context: comorb(PREGNANCY), features: ["DYSPNEA", "CHEST_PAIN", "PERIPHERAL_EDEMA", "TACHYCARDIA"], minSignals: 1 },
  { rule_id: "pregnancy_preeclampsia_risk", condition: "Pre-eclampsia", label: "Pre-eclampsia Risk", tier: "advisory",
    action: "Check BP, proteinuria, liver function. Monitor for HELLP syndrome signs.",
    context: comorb(PREGNANCY), features: ["HEADACHE", "BLURRED_VISION", "EPIGASTRIC_PAIN", "SWELLING", "NAUSEA"], minSignals: 1 },
  { rule_id: "elderly_acs_atypical", condition: "Acute Coronary Syndrome", label: "Atypical ACS Presentation (Elderly)", tier: "advisory",
    action: "Elderly may present with only dyspnea, fatigue, or confusion. Low threshold for ECG + Troponin.",
    context: ageIn(65, 150), features: ["FATIGUE", "DYSPNEA", "CONFUSION", "SYNCOPE", "NAUSEA", "WEAKNESS", "EPIGASTRIC_PAIN"], minSignals: 2, escalateAtSignals: 3 },
  { rule_id: "elderly_pe_risk", condition: "Pulmonary Embolism", label: "Elevated PE Risk (Elderly, Immobile)", tier: "advisory",
    action: "Consider immobility as DVT risk factor. Wells score. D-dimer less specific in elderly.",
    context: ageIn(65, 150), features: ["DYSPNEA", "CHEST_PAIN", "TACHYCARDIA", "PERIPHERAL_EDEMA"], minSignals: 1 },
  { rule_id: "peds_meningitis_risk", condition: "Meningitis", label: "Elevated Meningitis Risk (Pediatric)", tier: "advisory",
    action: "Non-verbal children may not report neck stiffness. Low threshold for LP if febrile + irritable/lethargic.",
    context: ageIn(0, 5), features: ["FEVER", "VOMITING", "RASH"], minSignals: 2 },
  { rule_id: "peds_intussusception", condition: "Intussusception", label: "Possible Intussusception (Pediatric)", tier: "advisory",
    action: "Episodic crying + vomiting in infant. Ultrasound abdomen urgently.",
    context: ageIn(0, 5), features: ["ABDOMINAL_PAIN", "VOMITING", "BLOODY_STOOL"], minSignals: 2 },
  { rule_id: "neonatal_sepsis_risk", condition: "Sepsis", label: "Neonatal Sepsis Risk", tier: "escalation",
    action: "Any fever in neonate = full septic workup. Blood culture, LP, urine. Empirical antibiotics immediately.",
    context: ageIn(0, 0.08), features: ["FEVER"], minSignals: 1 },
];

function evaluateContext(p: PreparedInput, out: MnmTrigger[]): void {
  for (const r of CONTEXT_RULES) {
    const ctx = r.context(p);
    if (!ctx) continue;
    const matched: string[] = [];
    for (const f of r.features) {
      const e = has(p, f);
      if (e) matched.push(e);
    }
    if (matched.length < r.minSignals) continue;
    const tier: MnmTier = r.escalateAtSignals != null && matched.length >= r.escalateAtSignals ? "escalation" : r.tier;
    out.push({
      rule_id: r.rule_id, condition: r.condition, label: r.label, tier, kind: "context",
      evidence: [...matched, ctx], action: r.action,
    });
  }

  // Vital-amplified context rules.
  const bs = p.vitals.blood_sugar;
  const diabetic = hasHistory(p, DIABETES);
  if (bs != null && bs > 300 && diabetic) {
    out.push({
      rule_id: "vital_dka_confirmed", condition: "Diabetic Ketoacidosis", label: "Probable DKA (Blood Sugar > 300 + Diabetic)",
      tier: "escalation", kind: "context",
      evidence: [`blood sugar: ${bs} mg/dL`, `[comorbidity: ${diabetic}]`],
      action: "Confirm DKA: check ABG, ketones, electrolytes. Start IV insulin protocol.",
    });
  }
  const sbp = p.vitals.bp_systolic;
  if (sbp != null && sbp < 90 && p.age != null && p.age > 60) {
    out.push({
      rule_id: "elderly_shock_risk", condition: "Shock", label: "Hypotensive Elderly — Shock Risk",
      tier: "escalation", kind: "context",
      evidence: [`BP: ${sbp}/${p.vitals.bp_diastolic ?? "?"}`, `[age: ${p.age}]`],
      action: "IV access. Fluid resuscitation. Identify cause: septic, cardiogenic, hypovolemic.",
    });
  }
}

// ══════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════

/**
 * Evaluate must-not-miss escalation for one presentation.
 * Trigger order is deterministic: vitals, then patterns, then context rules,
 * each in table order.
 */
export function evaluateMustNotMiss(input: MnmInput): MnmResult {
  const p = prepare(input);
  const triggers: MnmTrigger[] = [];

  evaluateVitals(p, triggers);

  for (const r of PATTERN_RULES) {
    const m = r.match(p);
    if (!m) continue;
    triggers.push({
      rule_id: r.rule_id, condition: r.condition, label: r.label, tier: m.tier, kind: "pattern",
      evidence: m.evidence, action: r.action,
    });
  }

  evaluateContext(p, triggers);

  return {
    escalate: triggers.some(t => t.tier === "escalation"),
    triggers,
    ruleset_version: MNM_RULESET_VERSION,
  };
}

/** Every rule id the evaluator can emit — for coverage tests and audit tooling. */
export function listMustNotMissRuleIds(): string[] {
  const vital = VITAL_BANDS.flatMap(b => [
    ...(b.criticalBelow != null || b.criticalAtOrBelow != null || b.warnAtOrBelow != null ? [`vital_${b.key}_low`] : []),
    ...(b.criticalAtOrAbove != null || b.warnAtOrAbove != null ? [`vital_${b.key}_high`] : []),
  ]);
  return [
    ...vital,
    ...PATTERN_RULES.map(r => r.rule_id),
    ...CONTEXT_RULES.map(r => r.rule_id),
    "vital_dka_confirmed",
    "elderly_shock_risk",
  ];
}

/** Exposed for the vocabulary-coverage contract test only. */
export function listMustNotMissConcepts(): Record<string, { ids: readonly string[]; terms: readonly string[] }> {
  return CONCEPTS;
}

// ══════════════════════════════════════════════
// Adapter: clinical-safety response shape
// ══════════════════════════════════════════════
// Kept here (not in the edge function) so it is unit-testable from vitest
// and so the edge function cannot drift from the evaluator.

export interface ClinicalSafetyVitalsDanger {
  parameter: string;
  value: number;
  severity: "warning" | "critical";
  message: string;
  action_hint: string;
}

export interface ClinicalSafetyEmergencyPattern {
  pattern: string;
  severity: "warning" | "critical";
  matched_indicators: string[];
  message: string;
  action_hint: string;
}

export function toClinicalSafetyShape(result: MnmResult): {
  vitals_dangers: ClinicalSafetyVitalsDanger[];
  emergency_patterns: ClinicalSafetyEmergencyPattern[];
} {
  const vitals_dangers: ClinicalSafetyVitalsDanger[] = [];
  const emergency_patterns: ClinicalSafetyEmergencyPattern[] = [];
  for (const t of result.triggers) {
    const severity = t.tier === "escalation" ? "critical" : "warning";
    if (t.kind === "vital" && t.vital) {
      vitals_dangers.push({
        parameter: t.label,
        value: t.vital.value,
        severity,
        message: t.evidence[0] ?? t.label,
        action_hint: t.action,
      });
    } else {
      emergency_patterns.push({
        pattern: t.label,
        severity,
        matched_indicators: t.evidence,
        message: `${t.label}: ${t.evidence.join(", ")}`,
        action_hint: t.action,
      });
    }
  }
  return { vitals_dangers, emergency_patterns };
}
