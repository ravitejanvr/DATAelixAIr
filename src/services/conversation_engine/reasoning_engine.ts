/**
 * Reasoning Engine — Clinical Decision Logic
 *
 * Determines the next action based on session state.
 * This replaces hardcoded question sequences with context-aware decisions.
 *
 * Decision flow:
 *   1. Check what data is missing
 *   2. Prioritize by clinical importance
 *   3. Consider attempt history (rephrase after 2 failures)
 *   4. Return exactly ONE action
 */

import type { SessionContextManager } from "../session_context";
import type { ClinicalQuestion } from "../pipeline/types";
import type { SupportedLanguage } from "../canonical/types";
import type { UserIntent } from "./intent_classifier";
import type { LLMNextQuestion } from "./llm_extraction";
import {
  getSystemMessage,
  translateQuestion,
  toConversationalTone as toConversationalToneML,
} from "./translations";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export type NextAction =
  | { type: "ask_question"; question: ClinicalQuestion; displayText: string }
  | { type: "acknowledge"; text: string }
  | { type: "clarify"; text: string }
  | { type: "proceed"; text: string }
  | { type: "greet"; text: string }
  | { type: "none" };

export interface QuestionMeta {
  askedQuestionIds: Set<string>;
  askedQuestionTexts: Set<string>;
  attempts: Map<string, number>; // field → attempt count
}

/** Clinical field priority order */
const FIELD_PRIORITY: Array<{ field: string; category: string }> = [
  { field: "symptoms", category: "chief_complaint" },
  { field: "severity", category: "severity" },
  { field: "duration", category: "duration" },
  { field: "associated_symptoms", category: "associated_symptoms" },
  { field: "risk_factors", category: "risk_factors" },
  { field: "medications", category: "medications" },
  { field: "allergies", category: "allergies" },
  { field: "age", category: "demographics" },
  { field: "sex", category: "demographics" },
];

/** Fallback questions when LLM question is unavailable */
const FALLBACK_QUESTIONS: Record<string, Record<string, string>> = {
  symptoms: {
    en: "What symptoms are you experiencing?",
    hi: "आपको क्या तकलीफ हो रही है?",
    te: "మీకు ఏమి సమస్యలు ఉన్నాయి?",
    ta: "உங்களுக்கு என்ன அறிகுறிகள் உள்ளன?",
  },
  severity: {
    en: "How severe are your symptoms — mild, moderate, or severe?",
    hi: "आपकी तकलीफ कितनी है — हल्की, मध्यम, या गंभीर?",
    te: "మీ లక్షణాలు ఎంత తీవ్రంగా ఉన్నాయి — తేలికగా, మధ్యస్తంగా, లేదా తీవ్రంగా?",
    ta: "உங்கள் அறிகுறிகள் எவ்வளவு தீவிரமானவை — லேசானவை, மிதமானவை, அல்லது கடுமையானவை?",
  },
  duration: {
    en: "How long have you had these symptoms?",
    hi: "यह तकलीफ कब से है?",
    te: "ఈ లక్షణాలు ఎన్ని రోజులుగా ఉన్నాయి?",
    ta: "இந்த அறிகுறிகள் எவ்வளவு காலமாக உள்ளன?",
  },
  associated_symptoms: {
    en: "Any other symptoms along with this?",
    hi: "इसके साथ और कोई तकलीफ है?",
    te: "దీనితో పాటు మరేమైనా సమస్యలు ఉన్నాయా?",
    ta: "இதனுடன் வேறு ஏதேனும் அறிகுறிகள் உள்ளனவா?",
  },
  risk_factors: {
    en: "Any recent travel or exposure to sick people?",
    hi: "हाल ही में कहीं यात्रा की या किसी बीमार व्यक्ति के संपर्क में आए?",
    te: "ఇటీవల ఎక్కడైనా ప్రయాణం చేశారా లేదా అనారోగ్య వ్యక్తులతో సంపర్కం ఉందా?",
    ta: "சமீபத்தில் பயணம் செய்தீர்களா அல்லது நோயாளிகளுடன் தொடர்பு இருந்ததா?",
  },
  medications: {
    en: "Are you currently taking any medications?",
    hi: "क्या आप अभी कोई दवाई ले रहे हैं?",
    te: "మీరు ప్రస్తుతం ఏమైనా మందులు వాడుతున్నారా?",
    ta: "தற்போது ஏதேனும் மருந்துகள் எடுத்துக்கொள்கிறீர்களா?",
  },
  allergies: {
    en: "Do you have any known allergies?",
    hi: "क्या आपको किसी चीज़ से एलर्जी है?",
    te: "మీకు ఏమైనా అలర్జీలు ఉన్నాయా?",
    ta: "உங்களுக்கு ஏதேனும் ஒவ்வாமை உள்ளதா?",
  },
  age: {
    en: "May I know your age?",
    hi: "आपकी उम्र क्या है?",
    te: "మీ వయస్సు ఎంత?",
    ta: "உங்கள் வயது என்ன?",
  },
  sex: {
    en: "What is your sex — male or female?",
    hi: "आपका लिंग क्या है?",
    te: "మీ లింగం ఏమిటి?",
    ta: "உங்கள் பாலினம் என்ன?",
  },
};

/** Rephrase templates for repeated failures */
const REPHRASE_TEMPLATES: Record<string, Record<string, string>> = {
  symptoms: {
    en: "Could you describe what's bothering you? For example: fever, cough, headache, stomach pain.",
    hi: "क्या आप बता सकते हैं कि आपको क्या तकलीफ है? जैसे: बुखार, खांसी, सिरदर्द, पेट दर्द।",
    te: "మీకు ఏమి ఇబ్బంది ఉందో చెప్పగలరా? ఉదాహరణకు: జ్వరం, దగ్గు, తలనొప్పి, కడుపు నొప్పి.",
    ta: "உங்களுக்கு என்ன தொந்தரவு என்று சொல்ல முடியுமா? உதாரணமாக: காய்ச்சல், இருமல், தலைவலி, வயிற்று வலி.",
  },
};

/** Acknowledgment templates for conversational flow */
const ACKNOWLEDGMENTS: Record<string, string[]> = {
  en: [
    "Got it.",
    "Understood.",
    "Noted.",
    "I see.",
  ],
  hi: [
    "समझ गया।",
    "ठीक है।",
    "नोट कर लिया।",
  ],
  te: [
    "అర్థమైంది.",
    "సరే.",
    "గమనించాను.",
  ],
  ta: [
    "புரிந்தது.",
    "சரி.",
    "குறிப்பிட்டேன்.",
  ],
};

const CLARIFICATION_RESPONSES: Record<string, string> = {
  en: "I didn't quite catch that. Could you describe your symptoms? For example: fever, cough, pain.",
  hi: "मैं समझ नहीं पाया। क्या आप अपनी तकलीफ बता सकते हैं? जैसे: बुखार, खांसी, दर्द।",
  te: "నాకు అర్థం కాలేదు. మీ సమస్యలు చెప్పగలరా? ఉదాహరణకు: జ్వరం, దగ్గు, నొప్పి.",
  ta: "என்னால் புரிந்துகொள்ள முடியவில்லை. உங்கள் அறிகுறிகளை விவரிக்க முடியுமா? உதாரணமாக: காய்ச்சல், இருமல், வலி.",
};

// ══════════════════════════════════════════════
// CORE REASONING
// ══════════════════════════════════════════════

/**
 * Determine the next step based on current session state and intent.
 *
 * This is the BRAIN of the conversation engine.
 */
export function decideNextStep(
  session: SessionContextManager,
  intent: UserIntent,
  language: SupportedLanguage,
  meta: QuestionMeta,
  llmQuestion: LLMNextQuestion | null,
  pipelineQuestions: ClinicalQuestion[],
): NextAction {
  const lang = language === "unknown" ? "en" : language;

  // ── Intent-based routing ──
  if (intent === "GREETING") {
    return {
      type: "greet",
      text: getSystemMessage("greeting", language),
    };
  }

  if (intent === "ACKNOWLEDGEMENT") {
    const acks = ACKNOWLEDGMENTS[lang] || ACKNOWLEDGMENTS.en;
    return {
      type: "acknowledge",
      text: acks[Math.floor(Math.random() * acks.length)],
    };
  }

  // ── Find the first missing critical field ──
  const missingField = findFirstMissingField(session);

  // If nothing missing → proceed
  if (!missingField) {
    return {
      type: "proceed",
      text: lang === "en" ? "I have all the information I need. Processing your clinical data."
        : lang === "hi" ? "सभी जानकारी मिल गई है। आपकी जानकारी का विश्लेषण कर रहा हूँ।"
        : lang === "te" ? "అన్ని సమాచారం అందింది. మీ క్లినికల్ డేటాను ప్రాసెస్ చేస్తున్నాను."
        : "அனைத்து தகவல்களும் கிடைத்துவிட்டன. உங்கள் மருத்துவ தரவை செயலாக்குகிறேன்.",
    };
  }

  // ── Build question for missing field ──
  const attempts = meta.attempts.get(missingField.field) ?? 0;

  // LLM question takes priority (if it targets the right field and hasn't been asked)
  if (llmQuestion && !isDuplicate(llmQuestion.text, meta)) {
    const questionId = `llm_q_${llmQuestion.field}_${Date.now()}`;
    return {
      type: "ask_question",
      question: {
        question_id: questionId,
        text: llmQuestion.text,
        category: llmQuestion.field,
        priority: llmQuestion.priority,
        options: llmQuestion.options,
      },
      displayText: llmQuestion.text,
    };
  }

  // Pipeline question fallback (filtered, first non-duplicate)
  const pipelineQ = pipelineQuestions.find(q =>
    !meta.askedQuestionIds.has(q.question_id) &&
    !isDuplicate(q.text, meta) &&
    !session.hasData(q.category)
  );

  if (pipelineQ) {
    const translated = translateQuestion(pipelineQ.text, language);
    const conversational = toConversationalToneML(translated, language);
    return {
      type: "ask_question",
      question: pipelineQ,
      displayText: conversational,
    };
  }

  // Static fallback question for the missing field
  const questionText = getQuestionForField(missingField.field, lang, attempts);
  if (questionText && !isDuplicate(questionText, meta)) {
    const questionId = `fallback_${missingField.field}_${Date.now()}`;
    return {
      type: "ask_question",
      question: {
        question_id: questionId,
        text: questionText,
        category: missingField.category,
        priority: missingField.field === "symptoms" ? "critical" : "medium",
      },
      displayText: questionText,
    };
  }

  // If even fallback is duplicate, move to next missing field
  return { type: "none" };
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════

function findFirstMissingField(
  session: SessionContextManager,
): { field: string; category: string } | null {
  for (const entry of FIELD_PRIORITY) {
    if (!session.hasData(entry.field)) {
      return entry;
    }
  }
  return null;
}

function getQuestionForField(field: string, lang: string, attempts: number): string | null {
  // After 2 attempts, use rephrase template if available
  if (attempts >= 2 && REPHRASE_TEMPLATES[field]) {
    return REPHRASE_TEMPLATES[field][lang] || REPHRASE_TEMPLATES[field].en;
  }

  const questions = FALLBACK_QUESTIONS[field];
  if (!questions) return null;
  return questions[lang] || questions.en;
}

function isDuplicate(text: string, meta: QuestionMeta): boolean {
  const normalized = text.normalize("NFKD").toLowerCase().replace(/\s+/g, " ").trim();
  return meta.askedQuestionTexts.has(normalized);
}

/**
 * Get a clarification response when no meaningful input was extracted.
 */
export function getClarificationResponse(language: SupportedLanguage): string {
  const lang = language === "unknown" ? "en" : language;
  return CLARIFICATION_RESPONSES[lang] || CLARIFICATION_RESPONSES.en;
}

/**
 * Get a simple acknowledgment in the session language.
 */
export function getAcknowledgment(language: SupportedLanguage): string {
  const lang = language === "unknown" ? "en" : language;
  const acks = ACKNOWLEDGMENTS[lang] || ACKNOWLEDGMENTS.en;
  return acks[0]; // Deterministic — always first
}
