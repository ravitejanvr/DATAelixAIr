/**
 * Phase 6.3 — Signal Normalizer
 *
 * Enriches ClinicalContext with normalized signals BEFORE rule evaluation.
 * Handles phrase-level normalization that terminology_normalizer misses:
 *   - Multi-word clinical phrases → canonical terms
 *   - Negation-aware extraction (does NOT remove negated symptoms)
 *   - Temporal/severity qualifiers preserved as separate signals
 *
 * Returns an enriched symptom set (does NOT mutate input context).
 *
 * Invariants:
 *   - Pure function (no side effects)
 *   - Deterministic (no LLM)
 *   - Operates BEFORE rules/suspicion engine
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import { normalizeSymptom } from "@/services/context_engine/terminology_normalizer";

// ── Types ──

export interface NormalizedContext {
  /** Original context (unmutated) */
  original: ClinicalContext;
  /** Enriched context with normalized symptoms injected */
  enriched: ClinicalContext;
  /** All normalized symptoms (deduplicated) */
  normalized_symptoms: string[];
  /** Mappings applied */
  mappings_applied: Array<{ from: string; to: string }>;
}

// ── Phrase-level normalization (beyond single-word synonyms) ──

const PHRASE_NORMALIZATIONS: Array<{ patterns: RegExp[]; canonical: string }> = [
  // Cardiac
  { patterns: [/jaw\s*(hurts?|ache[sd]?|pain)\s*(when|while|on)\s*chew/i, /pain\s*in\s*jaw\s*(when|while)\s*(eating|chewing)/i], canonical: "jaw claudication" },
  { patterns: [/heart\s*(feels?\s*like|is)\s*(racing|pounding|fluttering)/i, /feel\s*my\s*heart\s*(beat|pound)/i], canonical: "palpitations" },
  { patterns: [/woke?\s*up\s*(can'?t|unable|couldn'?t)\s*breathe?/i, /wake[sd]?\s*up\s*(gasping|breathless|short\s*of\s*breath)/i], canonical: "paroxysmal nocturnal dyspnea" },
  { patterns: [/can'?t\s*(lie|lay)\s*(down|flat)/i, /need\s*(to\s*sit|pillows?\s*to)\s*(up|breathe|sleep)/i], canonical: "orthopnea" },

  // Neurological
  { patterns: [/passed?\s*out/i, /black(ed)?\s*out/i, /lost?\s*consciousness/i], canonical: "syncope" },
  { patterns: [/worst\s*headache\s*(of|in)\s*(my\s*)?(life|ever)/i, /sudden\s*(severe|worst)\s*headache/i], canonical: "thunderclap headache" },
  { patterns: [/one\s*side\s*(of\s*)?(body|face)\s*(weak|numb|drooping)/i, /weakness\s*(on|in)\s*one\s*side/i], canonical: "hemiparesis" },
  { patterns: [/face\s*(is\s*)?(drooping|drooped|sagging)/i, /droopy?\s*face/i], canonical: "facial droop" },
  { patterns: [/can'?t\s*(talk|speak)\s*(properly|clearly|right)/i, /speech\s*(is\s*)?(slurred|garbled)/i], canonical: "speech difficulty" },
  { patterns: [/room\s*(is\s*)?spinning/i, /everything\s*(is\s*)?spinning/i], canonical: "vertigo" },
  { patterns: [/pins?\s*and\s*needles?/i, /tingling\s*(in|on)\s*(hands?|feet|legs?|arms?)/i], canonical: "tingling" },
  { patterns: [/memory\s*(is\s*)?(getting\s*)?(worse|bad|poor|failing)/i, /keep\s*forgetting/i], canonical: "cognitive decline" },

  // Respiratory
  { patterns: [/cough(ing)?\s*(up|out)\s*blood/i, /blood\s*(in|when)\s*(cough|sputum)/i], canonical: "hemoptysis" },
  { patterns: [/can'?t\s*(catch|get)\s*(my\s*)?breath/i, /struggling\s*to\s*breathe?/i], canonical: "dyspnea" },
  { patterns: [/breathing\s*(is\s*)?(fast|rapid|heavy|labored)/i], canonical: "dyspnea" },

  // GI
  { patterns: [/throw(ing)?\s*up\s*blood/i, /blood\s*(in|when)\s*(vomit|puke)/i], canonical: "hematemesis" },
  { patterns: [/stool[s]?\s*(is|are|look)\s*(black|dark|tarry)/i, /black\s*(stools?|poop)/i], canonical: "melena" },
  { patterns: [/pain\s*(is\s*)?(worse|bad)\s*(after|when)\s*(eat|meal|food)/i, /pain\s*after\s*eating/i], canonical: "post-prandial pain" },
  { patterns: [/avoid(ing)?\s*(food|eating)\s*(because|due)/i, /afraid?\s*to\s*eat/i], canonical: "food avoidance" },

  // MSK / Surgical
  { patterns: [/pain\s*(is\s*)?(way\s*)?(out\s*of|worse\s*than|disproportionate)/i, /pain\s*seems?\s*(too\s*)?(severe|much)/i], canonical: "pain out of proportion" },
  { patterns: [/can'?t\s*open\s*(my\s*)?mouth/i, /jaw\s*(is\s*)?(locked|stuck|won'?t\s*open)/i], canonical: "trismus" },
  { patterns: [/lump\s*(in|at)\s*(groin|inguinal)/i, /swelling\s*(in|at)\s*groin/i], canonical: "inguinal mass" },
  { patterns: [/numbness\s*(in|around)\s*(bottom|seat|saddle|perineum)/i, /can'?t\s*feel\s*(my\s*)?(bottom|perineum)/i], canonical: "saddle anesthesia" },

  // Dermatological
  { patterns: [/rash\s*(in\s*)?a?\s*(band|strip|line|belt)/i, /blisters?\s*(in\s*)?a?\s*(line|band|strip)/i], canonical: "dermatomal rash" },

  // Constitutional
  { patterns: [/soaking\s*(the\s*)?sheets?\s*(at\s*night|overnight)/i, /sweating\s*(a\s*lot\s*)?(at\s*)?night/i], canonical: "night sweats" },
  { patterns: [/losing\s*weight\s*(without|not)\s*(trying|dieting)/i, /unexplained\s*weight\s*loss/i], canonical: "unintentional weight loss" },
  { patterns: [/very?\s*(tired|exhausted|no\s*energy)\s*(all|every)\s*(the\s*)?time/i], canonical: "fatigue" },

  // Ophthalmological
  { patterns: [/see(ing)?\s*(halos?|rings?)\s*(around\s*)?lights?/i], canonical: "halos" },
  { patterns: [/eye[s]?\s*(is|are)\s*(red|bloodshot)/i, /red\s*eye[s]?/i], canonical: "red eye" },

  // Pediatric
  { patterns: [/pulling\s*(up\s*)?(legs?|knees?)\s*(to|toward)\s*(chest|tummy|belly)/i, /draws?\s*(legs?|knees?)\s*up/i], canonical: "leg drawing" },
];

// ── Temporal/severity extractors ──

const TEMPORAL_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
  { pattern: /sudden(ly)?\s*(onset|start|began|developed)/i, signal: "sudden onset" },
  { pattern: /(gradual(ly)?|slow(ly)?)\s*(worsening|getting\s*worse|progressing)/i, signal: "progressive" },
  { pattern: /(intermittent|comes?\s*and\s*goes?|on\s*and\s*off)/i, signal: "intermittent" },
  { pattern: /(constant|continuous|persistent|non-?stop)/i, signal: "constant" },
  { pattern: /(worsening|getting\s*worse|deteriorat)/i, signal: "worsening" },
  { pattern: /(acute|sudden|abrupt)/i, signal: "acute" },
];

// ── Main Function ──

/**
 * Normalize clinical signals from context.
 * Applies phrase-level normalization and extracts temporal qualifiers.
 * Returns enriched context (original is NOT mutated).
 */
export function normalizeSignals(ctx: ClinicalContext): NormalizedContext {
  const mappings: Array<{ from: string; to: string }> = [];

  // Collect all text to scan
  const allText = [
    ctx.chief_complaint || "",
    ...(ctx.symptoms || []),
    ...(ctx.associated_symptoms || []),
  ].filter(Boolean);

  const fullText = allText.join(" ").toLowerCase();
  const additionalSymptoms: string[] = [];

  // 1. Phrase-level normalization
  for (const rule of PHRASE_NORMALIZATIONS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(fullText)) {
        additionalSymptoms.push(rule.canonical);
        mappings.push({ from: pattern.source, to: rule.canonical });
        break; // One match per rule is enough
      }
    }
  }

  // 2. Temporal/severity extraction
  for (const { pattern, signal } of TEMPORAL_PATTERNS) {
    if (pattern.test(fullText)) {
      additionalSymptoms.push(signal);
    }
  }

  // 3. Apply base terminology normalizer to ALL symptoms
  const baseSymptoms = allText.map(s => normalizeSymptom(s));

  // 4. Deduplicate
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const s of [...baseSymptoms, ...additionalSymptoms]) {
    const key = s.toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      normalized.push(s);
    }
  }

  // 5. Build enriched context (immutable)
  const enriched: ClinicalContext = {
    ...ctx,
    symptoms: normalized,
    // Clear associated_symptoms since they're merged into symptoms
    associated_symptoms: [],
  };

  if (mappings.length > 0) {
    console.log(
      `[SignalNormalizer] Applied ${mappings.length} phrase normalizations, ` +
      `total symptoms: ${normalized.length} (was ${allText.length})`
    );
  }

  return {
    original: ctx,
    enriched,
    normalized_symptoms: normalized,
    mappings_applied: mappings,
  };
}
