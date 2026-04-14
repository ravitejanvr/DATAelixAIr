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

/** Patterns for intent detection — multilingual */
const GREETING_PATTERNS = [
  // English
  /^(hi|hello|hey|good\s*(morning|afternoon|evening)|namaste|namaskar)\b/i,
  // Hindi
  /^(नमस्ते|नमस्कार|प्रणाम)\b/,
  // Telugu
  /^(నమస్కారం|నమస్తే|బాగున్నారా)\b/,
  // Tamil
  /^(வணக்கம்|நமஸ்காரம்)\b/,
];

const ACKNOWLEDGEMENT_PATTERNS = [
  /^(ok|okay|sure|yes|yeah|yep|got it|understood|alright|fine|right)\b/i,
  /^(हाँ|जी|ठीक|अच्छा|समझ गया)\b/,
  /^(సరే|అవును|బాగుంది|తెలిసింది)\b/,
  /^(சரி|ஆமா|புரிந்தது)\b/,
];

const NEGATION_PATTERNS = [
  /^(no|nope|nah|none|nothing|not really|don't have|no\s+allergies|no\s+medications)\b/i,
  /^(नहीं|नही|कुछ नहीं|कोई नहीं)\b/,
  /^(లేదు|ఏమీ లేదు|లేవు)\b/,
  /^(இல்லை|ஒன்றும் இல்லை)\b/,
];

/** Clinical signal words that indicate symptom/medical content */
const CLINICAL_SIGNAL_WORDS = [
  // English symptoms
  /\b(fever|cough|pain|headache|vomit|nausea|diarrhea|cold|sore|ache|burning|itching|bleeding|swelling|dizzy|breathless|fatigue|weakness|rash|cramp)\b/i,
  // Duration markers
  /\b(\d+\s*(day|week|month|hour|din|roz|rojulu)s?)\b/i,
  // Severity markers
  /\b(mild|moderate|severe|high|low|very|extreme|terrible|unbearable)\b/i,
  // Hindi symptoms
  /\b(बुखार|खांसी|दर्द|सिरदर्द|उल्टी|जी मिचलाना|दस्त|सर्दी|जलन|खुजली|सूजन|चक्कर|कमजोरी)\b/,
  // Telugu symptoms
  /\b(జ్వరం|దగ్గు|నొప్పి|తలనొప్పి|వాంతి|విరేచనాలు|జలుబు|మంట|దురద|వాపు|తిరగడం|బలహీనత)\b/,
  // Tamil symptoms
  /\b(காய்ச்சல்|இருமல்|வலி|தலைவலி|வாந்தி|வயிற்றுப்போக்கு|சளி|எரிச்சல்|அரிப்பு|வீக்கம்|மயக்கம்)\b/,
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
