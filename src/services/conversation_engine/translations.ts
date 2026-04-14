/**
 * Multilingual Translation Layer for Conversation Engine
 *
 * Rule: once a session language is locked to a non-English language,
 * missing translations MUST throw instead of silently leaking English.
 */

import type { SupportedLanguage } from "../canonical/types";

type TranslationLanguage = Exclude<SupportedLanguage, "unknown">;

// ══════════════════════════════════════════════
// SYSTEM MESSAGE TRANSLATIONS (2nd person — "you", not "patient")
// ══════════════════════════════════════════════

const SYSTEM_MESSAGES: Record<string, Record<string, string>> = {
  greeting: {
    en: "Hello, what brings you in today?",
    hi: "नमस्ते, आज आपको क्या तकलीफ है?",
    te: "నమస్కారం, మీకు ఈ రోజు ఏమి సమస్య ఉంది?",
    ta: "வணக்கம், இன்று உங்களுக்கு என்ன பிரச்சனை?",
  },
  noted: {
    en: "I've noted your symptoms. Confidence: {confidence}%",
    hi: "मैंने आपके लक्षण नोट कर लिए हैं। विश्वसनीयता: {confidence}%",
    te: "మీ లక్షణాలను గమనించాను. నమ్మకం: {confidence}%",
    ta: "உங்கள் அறிகுறிகளை பதிவு செய்துள்ளேன். நம்பகத்தன்மை: {confidence}%",
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
// CLINICAL QUESTION TRANSLATIONS (2nd person)
// ══════════════════════════════════════════════

const QUESTION_TRANSLATIONS: Record<string, Record<string, string>> = {
  // Demographics — all use "you" / "మీ" / "आप" / "உங்கள்"
  "What is the patient's age?": {
    hi: "आपकी उम्र क्या है?",
    te: "మీ వయస్సు ఎంత?",
    ta: "உங்கள் வயது என்ன?",
  },
  "What is the patient's sex?": {
    hi: "आपका लिंग क्या है?",
    te: "మీ లింగం ఏమిటి?",
    ta: "உங்கள் பாலினம் என்ன?",
  },
  "What is the primary reason for this visit?": {
    hi: "आज आप यहाँ क्यों आए हैं?",
    te: "మీరు ఈ రోజు ఎందుకు వచ్చారు?",
    ta: "இன்று நீங்கள் ஏன் வந்தீர்கள்?",
  },
  "Does the patient have any known allergies?": {
    hi: "क्या आपको किसी चीज़ से एलर्जी है?",
    te: "మీకు ఏమైనా అలర్జీలు ఉన్నాయా?",
    ta: "உங்களுக்கு ஏதேனும் ஒவ்வாமை உள்ளதா?",
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
  "Yes": { hi: "हाँ", te: "అవును", ta: "ஆம்" },
  "No": { hi: "नहीं", te: "లేదు", ta: "இல்லை" },
};

const SAFETY_CONDITION_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Acute Coronary Syndrome": { hi: "तीव्र कोरोनरी सिंड्रोम", te: "తీవ్రమైన కరోనరీ సిండ్రోమ్", ta: "தீவிர கரோனரி சிண்ட்ரோம்" },
  "Meningitis": { hi: "मेनिन्जाइटिस", te: "మెనింజిటిస్", ta: "மெனிஞ்ஜைட்டிஸ்" },
  "Pulmonary Embolism": { hi: "पल्मोनरी एम्बोलिज़्म", te: "పల్మనరీ ఎంబోలిజం", ta: "புல்மனரி எம்பாலிசம்" },
  "Stroke / TIA": { hi: "स्ट्रोक / टीआईए", te: "స్ట్రోక్ / టిఐఏ", ta: "ஸ்ட்ரோக் / டிஐஏ" },
  "Sepsis": { hi: "सेप्सिस", te: "సెప్సిస్", ta: "செப்சிஸ்" },
  "Anaphylaxis": { hi: "एनाफिलैक्सिस", te: "అనాఫైలాక్సిస్", ta: "அனாபைலக்ஸிஸ்" },
  "Cauda Equina Syndrome": { hi: "कौडा इक्वाइना सिंड्रोम", te: "కౌడా ఈక్వైనా సిండ్రోమ్", ta: "காவ்டா இக்வினா சிண்ட்ரோம்" },
  "High Fever (≥39.5°C)": { hi: "उच्च बुखार (≥39.5°C)", te: "అధిక జ్వరం (≥39.5°C)", ta: "அதிக காய்ச்சல் (≥39.5°C)" },
  "Hypoxia (SpO₂ < 92%)": { hi: "हाइपॉक्सिया (SpO₂ < 92%)", te: "హైపాక్సియా (SpO₂ < 92%)", ta: "ஹைப்பாக்ஸியா (SpO₂ < 92%)" },
  "Tachycardia (HR > 120)": { hi: "टैकीकार्डिया (HR > 120)", te: "టాకికార్డియా (HR > 120)", ta: "டாக்கிகார்டியா (HR > 120)" },
  "Hypertensive Urgency (SBP ≥ 180)": { hi: "हाइपरटेंसिव अर्जेंसी (SBP ≥ 180)", te: "హైపర్టెన్సివ్ అత్యవసర స్థితి (SBP ≥ 180)", ta: "அதிக இரத்த அழுத்த அவசரம் (SBP ≥ 180)" },
  "Hypotension (SBP < 90)": { hi: "हाइपोटेंशन (SBP < 90)", te: "హైపోటెన్షన్ (SBP < 90)", ta: "ஹைப்போடென்ஷன் (SBP < 90)" },
};

const SAFETY_ACTION_TRANSLATIONS: Record<string, Record<string, string>> = {
  "Immediate ECG, troponin, aspirin. Consider emergency referral.": {
    hi: "तुरंत ECG, ट्रोपोनिन और एस्पिरिन दें। आपातकालीन रेफरल पर विचार करें।",
    te: "తక్షణం ECG, ట్రోపోనిన్, ఆస్పిరిన్ ఇవ్వండి. అత్యవసర రిఫరల్‌ను పరిగణించండి.",
    ta: "உடனடி ECG, டிரோபோனின், அஸ்பிரின். அவசர ரெஃபரலை பரிசீலிக்கவும்.",
  },
  "Urgent LP. Start empirical antibiotics immediately.": {
    hi: "तुरंत LP करें। अनुभवाधारित एंटीबायोटिक्स तुरंत शुरू करें।",
    te: "తక్షణం LP చేయండి. అనుభవాధారిత యాంటీబయాటిక్స్ వెంటనే ప్రారంభించండి.",
    ta: "அவசர LP செய்யவும். அனுபவ அடிப்படையிலான ஆன்டிபயாட்டிக்ஸை உடனே தொடங்கவும்.",
  },
  "CTPA. Start anticoagulation if high clinical probability.": {
    hi: "CTPA करें। नैदानिक संभावना अधिक हो तो एंटीकोआग्यूलेशन शुरू करें।",
    te: "CTPA చేయండి. క్లినికల్ అవకాశాలు ఎక్కువైతే యాంటీకోగ్యులేషన్ ప్రారంభించండి.",
    ta: "CTPA செய்யவும். மருத்துவ சாத்தியம் அதிகமாக இருந்தால் ஆன்டிகோகுலேஷனை தொடங்கவும்.",
  },
  "FAST assessment. Urgent CT head. Neurology referral.": {
    hi: "FAST आकलन करें। तुरंत CT हेड करें। न्यूरोलॉजी रेफरल दें।",
    te: "FAST అంచనా వేయండి. అత్యవసర CT head చేయండి. న్యూరాలజీ రిఫరల్ ఇవ్వండి.",
    ta: "FAST மதிப்பீடு செய்யவும். அவசர CT head எடுக்கவும். நரம்பியல் ரெஃபரல் செய்யவும்.",
  },
  "Blood cultures, lactate, fluid resuscitation. Sepsis-3 criteria.": {
    hi: "ब्लड कल्चर, लैक्टेट और फ्लूइड रीससिटेशन करें। Sepsis-3 मानदंड देखें।",
    te: "బ్లడ్ కల్చర్లు, లాక్టేట్, ఫ్లూయిడ్ రీससిటేషన్ చేయండి. Sepsis-3 ప్రమాణాలు చూడండి.",
    ta: "இரத்த கல்ச்சர்கள், லாக்டேட், திரவ மீட்பு செய்யவும். Sepsis-3 அளவுகோல்களை பார்க்கவும்.",
  },
  "Epinephrine IM. Secure airway. Monitor closely.": {
    hi: "इंट्रामस्क्युलर एपिनेफ्रिन दें। वायुमार्ग सुरक्षित करें। नज़दीकी निगरानी रखें।",
    te: "IM ఎపినెఫ్రిన్ ఇవ్వండి. వాయుమార్గాన్ని భద్రపరచండి. సమీపంగా పర్యవేక్షించండి.",
    ta: "IM எபினெப்ரின் கொடுக்கவும். காற்றுவழியை பாதுகாக்கவும். நெருக்கமாக கண்காணிக்கவும்.",
  },
  "Urgent MRI spine. Surgical consultation.": {
    hi: "तुरंत MRI spine करें। सर्जिकल परामर्श लें।",
    te: "అత్యవసరంగా MRI spine చేయండి. శస్త్రచికిత్స సలహా పొందండి.",
    ta: "அவசர MRI spine செய்யவும். அறுவை சிகிச்சை ஆலோசனை பெறவும்.",
  },
  "Investigate source. Blood cultures if >40°C.": {
    hi: "कारण की जाँच करें। तापमान >40°C हो तो ब्लड कल्चर करें।",
    te: "కారణాన్ని పరిశీలించండి. >40°C అయితే బ్లడ్ కల్చర్లు చేయండి.",
    ta: "காரணத்தை ஆராயவும். >40°C என்றால் இரத்த கல்ச்சர்கள் எடுக்கவும்.",
  },
  "Supplemental oxygen. Investigate cause urgently.": {
    hi: "पूरक ऑक्सीजन दें। कारण की तुरंत जाँच करें।",
    te: "అదనపు ఆక్సిజన్ ఇవ్వండి. కారణాన్ని అత్యవసరంగా పరిశీలించండి.",
    ta: "சேர்க்கை ஆக்சிஜன் கொடுக்கவும். காரணத்தை அவசரமாக ஆராயவும்.",
  },
  "ECG. Assess for dehydration, infection, or cardiac cause.": {
    hi: "ECG करें। डिहाइड्रेशन, संक्रमण या हृदय कारण का आकलन करें।",
    te: "ECG చేయండి. డీహైడ్రేషన్, ఇన్ఫెక్షన్ లేదా గుండె కారణాన్ని అంచనా వేయండి.",
    ta: "ECG செய்யவும். நீரிழப்பு, தொற்று அல்லது இதய காரணத்தை மதிப்பிடவும்.",
  },
  "Assess for target organ damage. Oral antihypertensive.": {
    hi: "लक्षित अंग क्षति का आकलन करें। मौखिक एंटीहाइपरटेंसिव दें।",
    te: "లక్ష్య అవయవ నష్టాన్ని అంచనా వేయండి. మౌఖిక యాంటీహైపర్టెన్సివ్ ఇవ్వండి.",
    ta: "இலக்கு உறுப்புச் சேதத்தை மதிப்பிடவும். வாய்வழி இரத்தஅழுத்தக் கட்டுப்பாட்டு மருந்து கொடுக்கவும்.",
  },
  "IV fluid resuscitation. Monitor for shock.": {
    hi: "IV फ्लूइड रीससिटेशन करें। शॉक के लिए निगरानी रखें।",
    te: "IV ఫ్లూయిడ్ రీससిటేషన్ చేయండి. షాక్ కోసం పర్యవేక్షించండి.",
    ta: "IV திரவ மீட்பு செய்யவும். ஷாக் அறிகுறிகளை கண்காணிக்கவும்.",
  },
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
// STT CLEANUP — remove artifacts from voice transcription
// ══════════════════════════════════════════════

/**
 * Clean STT output: remove repeated fragments, mixed-language garbage,
 * and broken partial words typical of realtime transcription.
 */
export function cleanTranscript(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Remove replacement characters (broken unicode)
  text = text.replace(/\uFFFD/g, "");

  // Collapse repeated words/phrases (e.g. "మీరు ఇప్పుడు మీరు ఇప్పుడు మీరు ఇప్పుడు")
  // Detect and remove 3+ consecutive repetitions of word groups
  const words = text.split(/\s+/);
  if (words.length >= 6) {
    // Try pattern sizes from 1 to 4 words
    for (let patLen = 1; patLen <= 4; patLen++) {
      const pattern = words.slice(0, patLen).join(" ");
      let count = 0;
      let i = 0;
      while (i + patLen <= words.length) {
        const chunk = words.slice(i, i + patLen).join(" ");
        if (chunk === pattern) {
          count++;
          i += patLen;
        } else {
          break;
        }
      }
      // If entire text is just repetitions of the pattern
      if (count >= 3 && i >= words.length - 1) {
        // This is echo/feedback — return empty to skip
        console.log("STT_CLEANUP: Detected echo/feedback, discarding:", raw.substring(0, 50));
        return "";
      }
    }
  }

  // Remove leading broken characters (partial word starts)
  text = text.replace(/^[^\s\u0C00-\u0C7F\u0900-\u097F\u0B80-\u0BFF\u0041-\u005A\u0061-\u007A]+/, "");

  // Collapse multiple spaces
  text = text.replace(/\s+/g, " ").trim();

  // If result is too short to be meaningful (< 2 chars), skip
  if (text.length < 2) return "";

  return text;
}

// ══════════════════════════════════════════════
// ANSWER MAPPING — natural responses to structured data
// ══════════════════════════════════════════════

/** Maps natural language negations/affirmations to canonical values */
const NEGATIVE_RESPONSES: Record<string, string[]> = {
  en: ["no", "none", "nope", "nothing", "no allergies", "not any", "nil"],
  hi: ["नहीं", "कोई नहीं", "कुछ नहीं", "नहीं है"],
  te: ["లేదు", "లేవు", "ఏమీ లేదు", "ఏమీ లేవు", "లేడు"],
  ta: ["இல்லை", "எதுவும் இல்லை", "ஒன்றும் இல்லை"],
};

const AFFIRMATIVE_RESPONSES: Record<string, string[]> = {
  en: ["yes", "yeah", "yep", "correct", "right"],
  hi: ["हाँ", "हां", "जी", "जी हाँ", "सही"],
  te: ["అవును", "ఔను", "అవునండి"],
  ta: ["ஆம்", "ஆமா", "ஆமாம்"],
};

export function isNegativeResponse(text: string, lang: SupportedLanguage): boolean {
  const lower = text.toLowerCase().trim();
  for (const responses of Object.values(NEGATIVE_RESPONSES)) {
    if (responses.some(r => lower === r || lower.includes(r))) return true;
  }
  return false;
}

export function isAffirmativeResponse(text: string, lang: SupportedLanguage): boolean {
  const lower = text.toLowerCase().trim();
  for (const responses of Object.values(AFFIRMATIVE_RESPONSES)) {
    if (responses.some(r => lower === r || lower.includes(r))) return true;
  }
  return false;
}

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/** Resolve language key from SupportedLanguage */
function langKey(lang: SupportedLanguage): TranslationLanguage {
  if (lang === "unknown") return "en";
  return lang;
}

function throwMissingTranslation(kind: string, source: string, lang: SupportedLanguage): never {
  throw new Error(`[language-lock] Missing ${kind} translation for ${lang}: ${source}`);
}

/** Medical/technical abbreviations allowed in all languages */
const MEDICAL_TERM_WHITELIST = new Set([
  "ECG", "MRI", "CT", "LP", "CTPA", "FAST", "IV", "IM", "HR", "SBP",
  "SpO", "Sepsis", "head", "spine", "PCR", "CBC", "CRP", "ESR", "ABG",
  "ICU", "OPD", "BP", "CPR", "AED", "BPM", "mmHg", "mg", "ml", "kg",
  "TIA", "GCS", "AVPU", "APGAR", "BMI", "HbA1c", "LDH", "TSH", "INR",
]);

export function assertNoEnglishFallback(text: string, lang: SupportedLanguage, context: string): string {
  if (lang === "en" || lang === "unknown") return text;

  // Strip whitelisted medical terms, numbers, and units before checking
  const stripped = text.replace(/\b[A-Za-z0-9°≥<>₂]+\b/g, (match) => {
    if (MEDICAL_TERM_WHITELIST.has(match)) return "";
    if (/^[0-9°≥<>₂.%]+$/.test(match)) return "";
    if (match.length <= 2) return "";
    return match;
  });

  // Check if remaining text has 4+ consecutive Latin alpha chars (likely English sentence)
  if (/[A-Za-z]{4,}/.test(stripped)) {
    throw new Error(`[language-lock] English fallback detected in ${context} for ${lang}: ${text}`);
  }
  return text;
}

/** Get a system message in the specified language */
export function getSystemMessage(
  key: keyof typeof SYSTEM_MESSAGES,
  lang: SupportedLanguage,
  vars?: Record<string, string>
): string {
  const lk = langKey(lang);
  const translations = SYSTEM_MESSAGES[key];
  if (lk !== "en" && !translations?.[lk]) {
    throwMissingTranslation("system message", String(key), lang);
  }
  let msg = translations?.[lk] ?? translations?.en ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  if (key === "files_attached") return msg;
  return assertNoEnglishFallback(msg, lang, `system:${String(key)}`);
}

/** Translate a clinical question text to target language */
export function translateQuestion(text: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  if (lk === "en") return text;
  const translated = QUESTION_TRANSLATIONS[text]?.[lk];
  if (!translated) {
    throwMissingTranslation("question", text, lang);
  }
  return assertNoEnglishFallback(translated, lang, `question:${text}`);
}

/** Translate a single option label for display while keeping raw option values canonical */
export function translateOptionLabel(option: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  if (lk === "en") return option;
  const translated = OPTION_TRANSLATIONS[option]?.[lk];
  // Gracefully return original if no translation (e.g. numeric options)
  if (!translated) return option;
  return translated;
}

export function translateSafetyCondition(condition: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  if (lk === "en") return condition;
  const translated = SAFETY_CONDITION_TRANSLATIONS[condition]?.[lk];
  if (!translated) {
    throwMissingTranslation("safety condition", condition, lang);
  }
  return assertNoEnglishFallback(translated, lang, `safety-condition:${condition}`);
}

export function translateSafetyAction(action: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  if (lk === "en") return action;
  const translated = SAFETY_ACTION_TRANSLATIONS[action]?.[lk];
  if (!translated) {
    throwMissingTranslation("safety action", action, lang);
  }
  return assertNoEnglishFallback(translated, lang, `safety-action:${action}`);
}

/** Conversational tone in target language */
export function toConversationalTone(text: string, lang: SupportedLanguage): string {
  const lk = langKey(lang);
  // Already conversational?
  if (/^(can you|could you|how|what|do you|have you|are you|is there|does|did|when|where|क्या|कैसे|कब|कहाँ|ఏమి|ఎంత|ఎక్కడ|எப்படி|எங்கே|என்ன)/i.test(text)) {
    return assertNoEnglishFallback(text, lang, "conversational-tone");
  }
  // Terse label → wrap in conversational prefix
  if (/^(duration|severity|onset|location)/i.test(text)) {
    if (lk !== "en") {
      throwMissingTranslation("conversational label", text, lang);
    }
    const prefix = CONVERSATIONAL_PREFIX[lk] ?? CONVERSATIONAL_PREFIX.en;
    return assertNoEnglishFallback(`${prefix} ${text.toLowerCase()}?`, lang, "conversational-tone");
  }
  return assertNoEnglishFallback(text, lang, "conversational-tone");
}

/** Get voice ID for a language */
export function getVoiceId(lang: SupportedLanguage): string {
  return VOICE_ID_MAP[langKey(lang)] ?? VOICE_ID_MAP.en;
}
