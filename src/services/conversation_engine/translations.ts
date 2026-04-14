/**
 * Multilingual Translation Layer for Conversation Engine
 *
 * Provides translations for:
 *   - Clinical questions (from Question Engine protocols)
 *   - System messages (greeting, confirmations, alerts)
 *   - Conversational tone wrappers
 *
 * Supported languages: English, Hindi, Telugu
 * Rule: If no translation exists, return English as fallback ONLY if language is "en" or "unknown"
 */

import type { SupportedLanguage } from "../canonical/types";

// ══════════════════════════════════════════════
// SYSTEM MESSAGE TRANSLATIONS
// ══════════════════════════════════════════════

const SYSTEM_MESSAGES: Record<string, Record<string, string>> = {
  greeting: {
    en: "Hello, what brings you in today?",
    hi: "नमस्ते, आज आपको क्या तकलीफ है?",
    te: "నమస్కారం, మీకు ఈ రోజు ఏమి సమస్య ఉంది?",
    ta: "வணக்கம், இன்று உங்களுக்கு என்ன பிரச்சனை?",
  },
  noted: {
    en: "Noted: {features}. Confidence: {confidence}%",
    hi: "नोट किया: {features}। विश्वसनीयता: {confidence}%",
    te: "గమనించాను: {features}. నమ్మకం: {confidence}%",
    ta: "குறிப்பிடப்பட்டது: {features}. நம்பகத்தன்மை: {confidence}%",
  },
  safety_alert: {
    en: "⚠️ {condition} — {action}",
    hi: "⚠️ {condition} — {action}",
    te: "⚠️ {condition} — {action}",
    ta: "⚠️ {condition} — {action}",
  },
  vitals_recorded: {
    en: "Vitals recorded.",
    hi: "महत्वपूर्ण संकेत दर्ज किए गए।",
    te: "వైటల్స్ నమోదు చేయబడ్డాయి.",
    ta: "உயிர்நிலை பதிவு செய்யப்பட்டது.",
  },
  files_attached: {
    en: "Files attached: {names}",
    hi: "फाइलें संलग्न: {names}",
    te: "ఫైళ్ళు జోడించబడ్డాయి: {names}",
    ta: "கோப்புகள் இணைக்கப்பட்டன: {names}",
  },
};

// ══════════════════════════════════════════════
// CLINICAL QUESTION TRANSLATIONS
// ══════════════════════════════════════════════

const QUESTION_TRANSLATIONS: Record<string, Record<string, string>> = {
  // Demographics
  "What is the patient's age?": {
    hi: "रोगी की उम्र क्या है?",
    te: "రోగి వయస్సు ఎంత?",
    ta: "நோயாளியின் வயது என்ன?",
  },
  "What is the patient's sex?": {
    hi: "रोगी का लिंग क्या है?",
    te: "రోగి లింగం ఏమిటి?",
    ta: "நோயாளியின் பாலினம் என்ன?",
  },
  "What is the primary reason for this visit?": {
    hi: "इस मुलाकात का मुख्य कारण क्या है?",
    te: "ఈ సందర్శనకు ప్రధాన కారణం ఏమిటి?",
    ta: "இந்த வருகையின் முதன்மை காரணம் என்ன?",
  },
  "Does the patient have any known allergies?": {
    hi: "क्या रोगी को कोई ज्ञात एलर्जी है?",
    te: "రోగికి ఏవైనా తెలిసిన అలెర్జీలు ఉన్నాయా?",
    ta: "நோயாளிக்கு ஏதேனும் அறியப்பட்ட ஒவ்வாமை உள்ளதா?",
  },

  // FEVER protocol
  "How high is the fever?": {
    hi: "बुखार कितना है?",
    te: "జ్వరం ఎంత ఉంది?",
    ta: "காய்ச்சல் எவ்வளவு?",
  },
  "How long have you had the fever?": {
    hi: "बुखार कितने दिनों से है?",
    te: "జ్వరం ఎన్ని రోజులుగా ఉంది?",
    ta: "காய்ச்சல் எத்தனை நாட்களாக உள்ளது?",
  },
  "Any chills or rigors?": {
    hi: "क्या ठंड लग रही है या कंपकंपी हो रही है?",
    te: "చలి గడగడలు లేదా వణుకు ఉన్నాయా?",
    ta: "குளிர் அல்லது நடுக்கம் உள்ளதா?",
  },
  "Any recent travel history?": {
    hi: "क्या हाल ही में कहीं यात्रा की?",
    te: "ఇటీవల ఎక్కడైనా ప్రయాణం చేశారా?",
    ta: "சமீபத்தில் எங்காவது பயணம் செய்தீர்களா?",
  },

  // CHEST_PAIN protocol
  "Is the pain radiating to your left arm or jaw?": {
    hi: "क्या दर्द बाएं हाथ या जबड़े तक जा रहा है?",
    te: "నొప్పి ఎడమ చేతి లేదా దవడకు వ్యాపిస్తుందా?",
    ta: "வலி இடது கை அல்லது தாடைக்கு பரவுகிறதா?",
  },
  "Are you experiencing sweating or breathlessness?": {
    hi: "क्या पसीना या सांस फूलना हो रहा है?",
    te: "చెమట లేదా ఊపిరి ఆడకపోవడం ఉందా?",
    ta: "வியர்வை அல்லது மூச்சு திணறல் உள்ளதா?",
  },
  "Does the pain worsen with exertion?": {
    hi: "क्या मेहनत करने पर दर्द बढ़ता है?",
    te: "శ్రమ చేసినప్పుడు నొప్పి పెరుగుతుందా?",
    ta: "உடல் உழைப்பின் போது வலி அதிகரிக்கிறதா?",
  },
  "Have you had similar episodes before?": {
    hi: "क्या पहले भी ऐसा हुआ है?",
    te: "ఇంతకు ముందు ఇలా జరిగిందా?",
    ta: "முன்பு இது போன்ற நிகழ்வுகள் ஏற்பட்டதா?",
  },

  // HEADACHE protocol
  "Any nausea or vomiting?": {
    hi: "क्या जी मिचलाना या उल्टी हो रही है?",
    te: "వాంతి లేదా వికారం ఉందా?",
    ta: "குமட்டல் அல்லது வாந்தி உள்ளதா?",
  },
  "Any sensitivity to light?": {
    hi: "क्या रोशनी से तकलीफ हो रही है?",
    te: "కాంతి పట్ల సున్నితత్వం ఉందా?",
    ta: "ஒளியால் தொந்தரவு உள்ளதா?",
  },
  "Any neck stiffness?": {
    hi: "क्या गर्दन में अकड़न है?",
    te: "మెడ కండరాలు బిగుసుకుపోతున్నాయా?",
    ta: "கழுத்து விறைப்பு உள்ளதா?",
  },
  "Is the headache throbbing or constant?": {
    hi: "सिरदर्द धड़कता है या लगातार है?",
    te: "తలనొప్పి కొట్టుకునేలా ఉందా లేదా నిరంతరంగా ఉందా?",
    ta: "தலைவலி துடிப்பானதா அல்லது தொடர்ச்சியானதா?",
  },

  // ABDOMINAL_PAIN protocol
  "Where exactly is the pain located?": {
    hi: "दर्द ठीक कहाँ है?",
    te: "నొప్పి ఖచ్చితంగా ఎక్కడ ఉంది?",
    ta: "வலி சரியாக எங்கே உள்ளது?",
  },
  "Any nausea, vomiting, or diarrhea?": {
    hi: "क्या मतली, उल्टी या दस्त हो रहा है?",
    te: "వాంతి, వికారం లేదా విరేచనాలు ఉన్నాయా?",
    ta: "குமட்டல், வாந்தி அல்லது வயிற்றுப்போக்கு உள்ளதா?",
  },
  "Any blood in stool?": {
    hi: "क्या मल में खून आ रहा है?",
    te: "మలంలో రక్తం ఉందా?",
    ta: "மலத்தில் இரத்தம் உள்ளதா?",
  },
  "Is the pain related to meals?": {
    hi: "क्या दर्द खाने से जुड़ा है?",
    te: "నొప్పి భోజనంతో సంబంధం ఉందా?",
    ta: "வலி உணவுடன் தொடர்புடையதா?",
  },

  // DYSPNEA protocol
  "Does it occur at rest or with exertion?": {
    hi: "क्या यह आराम करते समय या मेहनत करते समय होता है?",
    te: "ఇది విశ్రాంతిలో ఉన్నప్పుడు లేదా శ్రమ చేసినప్పుడు వస్తుందా?",
    ta: "இது ஓய்வின்போது அல்லது உடல் உழைப்பின்போது ஏற்படுகிறதா?",
  },
  "Any wheezing or chest tightness?": {
    hi: "क्या सांस लेने में सीटी बज रही है या छाती में जकड़न है?",
    te: "ఊపిరి పీల్చేటప్పుడు శబ్దం లేదా ఛాతీ బిగుతు ఉందా?",
    ta: "மூச்சிரைப்பு அல்லது நெஞ்சு இறுக்கம் உள்ளதா?",
  },
  "Can you lie flat comfortably?": {
    hi: "क्या आप आराम से सीधे लेट सकते हैं?",
    te: "మీరు సుఖంగా వెల్లకిలా పడుకోగలరా?",
    ta: "நீங்கள் சௌகரியமாக படுக்க முடியுமா?",
  },
  "Any leg swelling?": {
    hi: "क्या पैरों में सूजन है?",
    te: "కాళ్ళ వాపు ఉందా?",
    ta: "கால் வீக்கம் உள்ளதா?",
  },

  // DIZZINESS protocol
  "Do you feel the room is spinning?": {
    hi: "क्या आपको लगता है कि कमरा घूम रहा है?",
    te: "గది తిరుగుతున్నట్లు అనిపిస్తుందా?",
    ta: "அறை சுழல்வது போல் உணர்கிறீர்களா?",
  },
  "Any hearing loss or ringing in ears?": {
    hi: "क्या कान में सुनाई कम हो रहा है या घंटी बज रही है?",
    te: "వినికిడి తగ్గడం లేదా చెవులలో మోగడం ఉందా?",
    ta: "காது கேளாமை அல்லது காதில் ஓசை உள்ளதா?",
  },
  "Any recent falls or fainting?": {
    hi: "क्या हाल ही में गिरना या बेहोशी हुई है?",
    te: "ఇటీవల పడిపోవడం లేదా మూర్ఛ పోవడం జరిగిందా?",
    ta: "சமீபத்தில் விழுந்தீர்களா அல்லது மயக்கம் ஏற்பட்டதா?",
  },

  // COUGH protocol
  "Is the cough dry or productive?": {
    hi: "खांसी सूखी है या कफ वाली?",
    te: "దగ్గు పొడిగా ఉందా లేదా కఫంతో ఉందా?",
    ta: "இருமல் வறண்டதா அல்லது சளியுடனா?",
  },
  "Any blood in sputum?": {
    hi: "क्या कफ में खून आ रहा है?",
    te: "కఫంలో రక్తం ఉందా?",
    ta: "சளியில் இரத்தம் உள்ளதா?",
  },
  "Any associated fever or chest pain?": {
    hi: "क्या बुखार या सीने में दर्द भी है?",
    te: "జ్వరం లేదా ఛాతీ నొప్పి కూడా ఉందా?",
    ta: "காய்ச்சல் அல்லது நெஞ்சு வலி உள்ளதா?",
  },
};

// ══════════════════════════════════════════════
// CONVERSATIONAL TONE TEMPLATES
// ══════════════════════════════════════════════

const CONVERSATIONAL_PREFIX: Record<string, string> = {
  en: "Can you tell me more about the",
  hi: "क्या आप मुझे इसके बारे में और बता सकते हैं:",
  te: "దయచేసి దీని గురించి మరింత చెప్పగలరా:",
  ta: "தயவுசெய்து இதைப் பற்றி மேலும் சொல்ல முடியுமா:",
};

// ══════════════════════════════════════════════
// OPTION TRANSLATIONS
// ══════════════════════════════════════════════

const OPTION_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Male": { hi: "पुरुष", te: "పురుషుడు", ta: "ஆண்" },
  "Female": { hi: "महिला", te: "స్త్రీ", ta: "பெண்" },
  "Other": { hi: "अन्य", te: "ఇతరం", ta: "பிற" },
  "Mild (37.5–38°C)": { hi: "हल्का (37.5–38°C)", te: "తేలికపాటి (37.5–38°C)", ta: "லேசானது (37.5–38°C)" },
  "Moderate (38–39°C)": { hi: "मध्यम (38–39°C)", te: "మితమైన (38–39°C)", ta: "மிதமானது (38–39°C)" },
  "High (>39°C)": { hi: "तेज (>39°C)", te: "ఎక్కువ (>39°C)", ta: "அதிகமானது (>39°C)" },
};

// ══════════════════════════════════════════════
// VOICE ID MAP PER LANGUAGE
// ══════════════════════════════════════════════

export const VOICE_ID_MAP: Record<string, string> = {
  en: "EXAVITQu4vr4xnSDxMaL",  // Sarah - multilingual
  hi: "EXAVITQu4vr4xnSDxMaL",  // Sarah - multilingual v2 supports Hindi
  te: "EXAVITQu4vr4xnSDxMaL",  // Sarah - multilingual v2 supports Telugu
  ta: "EXAVITQu4vr4xnSDxMaL",  // Sarah - multilingual v2 supports Tamil
  unknown: "EXAVITQu4vr4xnSDxMaL",
};

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/** Resolve language key from SupportedLanguage */
function langKey(lang: SupportedLanguage): string {
  if (lang === "unknown") return "en";
  return lang;
}

/** Get a system message in the specified language */
export function getSystemMessage(
  key: keyof typeof SYSTEM_MESSAGES,
  lang: SupportedLanguage,
  vars?: Record<string, string>
): string {
  const lk = langKey(lang);
  let msg = SYSTEM_MESSAGES[key]?.[lk] ?? SYSTEM_MESSAGES[key]?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  return msg;
}

/** Translate a clinical question text to target language */
export function translateQuestion(text: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  if (lk === "en") return text;
  return QUESTION_TRANSLATIONS[text]?.[lk] ?? text;
}

/** Translate options array */
export function translateOptions(options: string[] | undefined, lang: SupportedLanguage): string[] | undefined {
  if (!options) return undefined;
  const lk = langKey(lang);
  if (lk === "en") return options;
  return options.map(o => OPTION_TRANSLATIONS[o]?.[lk] ?? o);
}

/** Conversational tone in target language */
export function toConversationalTone(text: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  // Already conversational?
  if (/^(can you|could you|how|what|do you|have you|are you|is there|does|did|when|where|क्या|कैसे|कब|कहाँ|ఏమి|ఎంత|ఎక్కడ|எப்படி|எங்கே|என்ன)/i.test(text)) {
    return text;
  }
  // Terse label → wrap in conversational prefix
  if (/^(duration|severity|onset|location)/i.test(text)) {
    const prefix = CONVERSATIONAL_PREFIX[lk] ?? CONVERSATIONAL_PREFIX.en;
    return `${prefix} ${text.toLowerCase()}?`;
  }
  return text;
}

/** Get voice ID for a language */
export function getVoiceId(lang: SupportedLanguage): string {
  return VOICE_ID_MAP[langKey(lang)] ?? VOICE_ID_MAP.en;
}
