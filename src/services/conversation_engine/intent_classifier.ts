/**
 * Intent Classifier — Pre-Pipeline Input Classification
 *
 * Classifies user input intent BEFORE triggering clinical extraction.
 * Only SYMPTOM_INPUT and QUESTION_ANSWER intents trigger the full pipeline.
 *
 * This prevents unnecessary LLM calls for greetings, acknowledgments, etc.
 */

import type { SupportedLanguage } from "../canonical/types";

export type UserIntent =
  | "GREETING"
  | "ACKNOWLEDGEMENT"
  | "NEGATION"
  | "SYMPTOM_INPUT"
  | "QUESTION_ANSWER"
  | "CLARIFICATION_REQUEST"
  | "OTHER";

/**
 * Patterns for intent detection — multilingual.
 * Uses Unicode-safe boundaries: (?:^|\s) and (?:\s|$) instead of \b
 * because \b does not work with Devanagari, Telugu, or Tamil scripts.
 */
const GREETING_PATTERNS = [
  // English
  /^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|namaskar)(?:\s|$)/i,
  // Hindi (no \b — use anchors)
  /^(नमस्ते|नमस्कार|प्रणाम)(?:\s|$)/,
  // Telugu
  /^(నమస్కారం|నమస్తే|బాగున్నారా)(?:\s|$)/,
  // Tamil
  /^(வணக்கம்|நமஸ்காரம்)(?:\s|$)/,
];

const ACKNOWLEDGEMENT_PATTERNS = [
  /^(ok|okay|sure|yes|yeah|yep|got it|understood|alright|fine|right)(?:\s|$)/i,
  /^(हाँ|जी|ठीक|अच्छा|समझ गया)(?:\s|$)/,
  /^(సరే|అవును|బాగుంది|తెలిసింది)(?:\s|$)/,
  /^(சரி|ஆமா|புரிந்தது)(?:\s|$)/,
];

const NEGATION_PATTERNS = [
  /^(no|nope|nah|none|nothing|not really|don't have|no\s+allergies|no\s+medications)(?:\s|$)/i,
  /^(नहीं|नही|कुछ नहीं|कोई नहीं)(?:\s|$)/,
  /^(లేదు|ఏమీ లేదు|లేవు)(?:\s|$)/,
  /^(இல்லை|ஒன்றும் இல்லை)(?:\s|$)/,
];

/** Clinical signal words that indicate symptom/medical content */
const CLINICAL_SIGNAL_WORDS = [
  // English symptoms (ASCII \b works for Latin script)
  /\b(fever|cough|pain|headache|vomit|nausea|diarrhea|cold|sore|ache|burning|itching|bleeding|swelling|dizzy|breathless|fatigue|weakness|rash|cramp)\b/i,
  // Duration markers
  /\b(\d+\s*(day|week|month|hour|din|roz|rojulu)s?)\b/i,
  // Severity markers
  /\b(mild|moderate|severe|high|low|very|extreme|terrible|unbearable)\b/i,
  // Hindi symptoms (Unicode-safe: no \b, use lookaround-free matching)
  /(?:^|\s)(बुखार|खांसी|दर्द|सिरदर्द|उल्टी|जी मिचलाना|दस्त|सर्दी|जलन|खुजली|सूजन|चक्कर|कमजोरी)(?:\s|$)/,
  // Telugu symptoms
  /(?:^|\s)(జ్వరం|దగ్గు|నొప్పి|తలనొప్పి|వాంతి|విరేచనాలు|జలుబు|మంట|దురద|వాపు|తిరగడం|బలహీనత)(?:\s|$)/,
  // Tamil symptoms
  /(?:^|\s)(காய்ச்சல்|இருமல்|வலி|தலைவலி|வாந்தி|வயிற்றுப்போக்கு|சளி|எரிச்சல்|அரிப்பு|வீக்கம்|மயக்கம்)(?:\s|$)/,
];

/**
 * Classify the intent of user input.
 *
 * Priority: NEGATION > GREETING > ACKNOWLEDGEMENT > SYMPTOM detection > OTHER
 *
 * Short negations ("no", "nahi", "levu") are classified as NEGATION
 * even if they could be acknowledgments, because in clinical context
 * they typically answer a yes/no question.
 */
export function classifyIntent(
  input: string,
  _language: SupportedLanguage,
  hasActiveQuestion: boolean,
): UserIntent {
  const trimmed = input.trim();
  if (!trimmed) return "OTHER";

  // Short negation responses (especially important for yes/no clinical questions)
  if (NEGATION_PATTERNS.some(p => p.test(trimmed))) {
    return hasActiveQuestion ? "QUESTION_ANSWER" : "NEGATION";
  }

  // Pure greeting (short, no clinical content)
  if (trimmed.split(/\s+/).length <= 4 && GREETING_PATTERNS.some(p => p.test(trimmed))) {
    return "GREETING";
  }

  // Check for clinical signal words — this is SYMPTOM_INPUT regardless of other patterns
  if (CLINICAL_SIGNAL_WORDS.some(p => p.test(trimmed))) {
    return "SYMPTOM_INPUT";
  }

  // Short acknowledgment with active question = answering the question
  if (hasActiveQuestion && ACKNOWLEDGEMENT_PATTERNS.some(p => p.test(trimmed))) {
    return "QUESTION_ANSWER";
  }

  // Pure acknowledgment (no question active)
  if (ACKNOWLEDGEMENT_PATTERNS.some(p => p.test(trimmed))) {
    return "ACKNOWLEDGEMENT";
  }

  // If there's an active question, treat any non-classified input as an answer
  if (hasActiveQuestion) {
    return "QUESTION_ANSWER";
  }

  // Default: treat as symptom input (user describing something clinical)
  // This is safer than "OTHER" — we don't want to lose clinical data
  return "SYMPTOM_INPUT";
}
