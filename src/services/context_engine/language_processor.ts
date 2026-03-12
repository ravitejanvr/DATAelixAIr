/**
 * PCIE — Language Processing Module
 * 
 * Detects language, normalizes text, and prepares input for
 * medical phrase extraction. Works with existing transcript
 * stabilization pipeline.
 */

export type SupportedLanguage = "en" | "hi" | "te" | "ta" | "unknown";

const LANGUAGE_PATTERNS: Record<SupportedLanguage, RegExp> = {
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
  ta: /[\u0B80-\u0BFF]/,
  en: /^[a-zA-Z0-9\s.,!?;:'"()-]+$/,
  unknown: /./,
};

/**
 * Detect primary language of input text.
 * Uses Unicode script detection for Indic languages.
 */
export function detectLanguage(text: string): SupportedLanguage {
  if (!text || text.trim().length === 0) return "unknown";

  const cleaned = text.trim();
  const charCounts: Record<SupportedLanguage, number> = { en: 0, hi: 0, te: 0, ta: 0, unknown: 0 };

  for (const char of cleaned) {
    if (LANGUAGE_PATTERNS.hi.test(char)) charCounts.hi++;
    else if (LANGUAGE_PATTERNS.te.test(char)) charCounts.te++;
    else if (LANGUAGE_PATTERNS.ta.test(char)) charCounts.ta++;
    else if (/[a-zA-Z]/.test(char)) charCounts.en++;
  }

  const total = charCounts.en + charCounts.hi + charCounts.te + charCounts.ta;
  if (total === 0) return "en"; // default for numeric/punctuation-only

  // If >30% Indic script, classify as that language
  if (charCounts.hi / total > 0.3) return "hi";
  if (charCounts.te / total > 0.3) return "te";
  if (charCounts.ta / total > 0.3) return "ta";
  return "en";
}

/**
 * Normalize text for downstream processing.
 * Trims whitespace, lowercases, removes extra spaces.
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

/**
 * Common code-mixed (Hinglish) medical phrases mapped to English.
 * Extends the existing regional lexicon approach.
 */
const CODE_MIXED_MAP: Record<string, string> = {
  "bukhar": "fever",
  "sir dard": "headache",
  "sir mein dard": "headache",
  "pet dard": "abdominal pain",
  "pet mein dard": "abdominal pain",
  "chakkar": "dizziness",
  "chakkar aa raha hai": "dizziness",
  "sans lene mein taklif": "shortness of breath",
  "khansi": "cough",
  "ulti": "vomiting",
  "dast": "diarrhea",
  "jukham": "cold",
  "badan dard": "body pain",
  "seene mein dard": "chest pain",
  "gala kharab": "sore throat",
  "kamar dard": "back pain",
  "ghutne mein dard": "knee pain",
  "neend nahi aati": "insomnia",
  "thakan": "fatigue",
  "bhookh nahi lagti": "loss of appetite",
};

/**
 * Translate code-mixed phrases to canonical English.
 * Handles Hinglish and romanized Indic inputs.
 */
export function translateCodeMixed(text: string): string {
  let result = text.toLowerCase();
  // Sort by phrase length descending to match longer phrases first
  const sortedPhrases = Object.entries(CODE_MIXED_MAP).sort(
    ([a], [b]) => b.length - a.length
  );
  for (const [phrase, english] of sortedPhrases) {
    result = result.replace(new RegExp(phrase, "gi"), english);
  }
  return result;
}
