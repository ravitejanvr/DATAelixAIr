/**
 * Canonical Normalizer — SINGLE UNIFIED SYNONYM MAP
 *
 * This is the ONE AND ONLY place where synonym resolution happens.
 * Consolidates: terminology_normalizer, language_processor code-mixed map,
 * concept_mapper built-in synonyms, and canonical/mappings.ts.
 *
 * Rules:
 * - No other file may define synonym mappings
 * - All inputs go through canonicalize() before entering the pipeline
 * - Output is CanonicalFeature[] — structured, language-agnostic
 */

import type {
  CanonicalEntry,
  CanonicalFeature,
  CanonicalizationResult,
  CanonicalizationTrace,
  SupportedLanguage,
} from "./types";

// ══════════════════════════════════════════════
// UNIFIED CANONICAL MAP — Single Source of Truth
// ══════════════════════════════════════════════

const CANONICAL_MAP: Record<string, CanonicalEntry> = {
  // ── Constitutional ──
  FEVER: {
    canonical_id: "FEVER", label: "Fever", snomed_id: "386661006", category: "constitutional",
    synonyms: ["fever", "pyrexia", "high temperature", "febrile", "bukhar", "high fever", "temperature", "low grade fever", "slight fever", "mild fever", "बुखार", "జ్వరం", "காய்ச்சல்"],
  },
  CHILLS: {
    canonical_id: "CHILLS", label: "Chills", snomed_id: "43724002", category: "constitutional",
    synonyms: ["chills", "rigor", "rigors", "shivering", "cold feeling"],
  },
  FATIGUE: {
    canonical_id: "FATIGUE", label: "Fatigue", snomed_id: "84229001", category: "constitutional",
    synonyms: ["fatigue", "tiredness", "exhaustion", "no energy", "lethargic", "lethargy", "feeling tired", "thakan"],
  },
  MALAISE: {
    canonical_id: "MALAISE", label: "Malaise", snomed_id: "367391008", category: "constitutional",
    synonyms: ["malaise", "feeling unwell", "generally unwell", "not feeling well"],
  },
  NIGHT_SWEATS: {
    canonical_id: "NIGHT_SWEATS", label: "Night Sweats", snomed_id: "42984000", category: "constitutional",
    synonyms: ["night sweats", "sweating at night", "nocturnal sweating"],
  },
  WEIGHT_LOSS: {
    canonical_id: "WEIGHT_LOSS", label: "Weight Loss", snomed_id: "89362005", category: "constitutional",
    synonyms: ["weight loss", "lost weight", "losing weight", "unintentional weight loss"],
  },
  WEIGHT_GAIN: {
    canonical_id: "WEIGHT_GAIN", label: "Weight Gain", snomed_id: "8943002", category: "constitutional",
    synonyms: ["weight gain", "gained weight", "putting on weight"],
  },
  DEHYDRATION: {
    canonical_id: "DEHYDRATION", label: "Dehydration", snomed_id: "34095006", category: "constitutional",
    synonyms: ["dehydration", "dehydrated", "dry mouth"],
  },

  // ── Respiratory ──
  COUGH: {
    canonical_id: "COUGH", label: "Cough", snomed_id: "49727002", category: "respiratory",
    synonyms: ["cough", "khansi", "खांसी", "దగ్గు", "இருமல்"],
  },
  PRODUCTIVE_COUGH: {
    canonical_id: "PRODUCTIVE_COUGH", label: "Productive Cough", snomed_id: "28743005", category: "respiratory",
    synonyms: ["productive cough", "cough with sputum", "cough with phlegm", "phlegmy cough", "wet cough"],
  },
  DRY_COUGH: {
    canonical_id: "DRY_COUGH", label: "Dry Cough", snomed_id: "11833005", category: "respiratory",
    synonyms: ["dry cough", "nonproductive cough"],
  },
  DYSPNEA: {
    canonical_id: "DYSPNEA", label: "Dyspnea", snomed_id: "267036007", category: "respiratory",
    synonyms: ["dyspnea", "breathlessness", "shortness of breath", "difficulty breathing", "breathing difficulty", "can't breathe", "labored breathing", "sob", "sans lene mein taklif", "सांस की तकलीफ", "ఊపిరి ఆడటం లేదు", "மூச்சுத்திணறல்"],
  },
  WHEEZING: {
    canonical_id: "WHEEZING", label: "Wheezing", snomed_id: "56018004", category: "respiratory",
    synonyms: ["wheezing"],
  },
  HEMOPTYSIS: {
    canonical_id: "HEMOPTYSIS", label: "Hemoptysis", snomed_id: "66857006", category: "respiratory",
    synonyms: ["hemoptysis", "coughing up blood", "blood in sputum"],
  },
  NASAL_CONGESTION: {
    canonical_id: "NASAL_CONGESTION", label: "Nasal Congestion", snomed_id: "68235000", category: "respiratory",
    synonyms: ["nasal congestion", "stuffy nose", "blocked nose", "nose block"],
  },
  RUNNY_NOSE: {
    canonical_id: "RUNNY_NOSE", label: "Runny Nose", snomed_id: "64531003", category: "respiratory",
    synonyms: ["runny nose", "rhinorrhea", "nasal discharge", "running nose"],
  },
  SORE_THROAT: {
    canonical_id: "SORE_THROAT", label: "Sore Throat", snomed_id: "162397003", category: "respiratory",
    synonyms: ["sore throat", "gala kharab"],
  },

  // ── Cardiovascular ──
  CHEST_PAIN: {
    canonical_id: "CHEST_PAIN", label: "Chest Pain", snomed_id: "29857009", category: "cardiovascular",
    synonyms: ["chest pain", "thoracic pain", "seene mein dard", "chest tightness", "chest pressure", "chest discomfort"],
  },
  PALPITATIONS: {
    canonical_id: "PALPITATIONS", label: "Palpitations", snomed_id: "80313002", category: "cardiovascular",
    synonyms: ["palpitations", "heart racing", "heart pounding", "irregular heartbeat"],
  },
  PERIPHERAL_EDEMA: {
    canonical_id: "PERIPHERAL_EDEMA", label: "Peripheral Edema", snomed_id: "271809000", category: "cardiovascular",
    synonyms: ["peripheral edema", "swollen legs", "swollen feet", "ankle swelling", "leg swelling", "foot swelling"],
  },
  ORTHOPNEA: {
    canonical_id: "ORTHOPNEA", label: "Orthopnea", snomed_id: "62744007", category: "cardiovascular",
    synonyms: ["orthopnea", "cannot lie flat"],
  },
  PND: {
    canonical_id: "PND", label: "Paroxysmal Nocturnal Dyspnea", snomed_id: "55442000", category: "cardiovascular",
    synonyms: ["paroxysmal nocturnal dyspnea", "pnd", "wakes up breathless", "waking up short of breath"],
  },
  DIAPHORESIS: {
    canonical_id: "DIAPHORESIS", label: "Diaphoresis", snomed_id: "52613005", category: "cardiovascular",
    synonyms: ["diaphoresis", "heavy sweating", "profuse sweating", "cold sweats", "sweating"],
  },
  TACHYCARDIA: {
    canonical_id: "TACHYCARDIA", label: "Tachycardia", snomed_id: "3424008", category: "cardiovascular",
    synonyms: ["tachycardia", "fast heart", "rapid pulse"],
  },
  PLEURITIC_CHEST_PAIN: {
    canonical_id: "PLEURITIC_CHEST_PAIN", label: "Pleuritic Chest Pain", snomed_id: "2237002", category: "cardiovascular",
    synonyms: ["pleuritic chest pain", "positional chest pain", "sharp chest pain with breathing", "pain worse with breathing"],
  },

  // ── Gastrointestinal ──
  ABDOMINAL_PAIN: {
    canonical_id: "ABDOMINAL_PAIN", label: "Abdominal Pain", snomed_id: "21522001", category: "gastrointestinal",
    synonyms: ["abdominal pain", "stomach pain", "tummy pain", "belly pain", "stomach ache", "abdominal discomfort", "pet dard", "pet mein dard"],
  },
  NAUSEA: {
    canonical_id: "NAUSEA", label: "Nausea", snomed_id: "422587007", category: "gastrointestinal",
    synonyms: ["nausea", "feeling sick", "queasy"],
  },
  VOMITING: {
    canonical_id: "VOMITING", label: "Vomiting", snomed_id: "422400008", category: "gastrointestinal",
    synonyms: ["vomiting", "emesis", "throwing up", "puking", "ulti"],
  },
  DIARRHEA: {
    canonical_id: "DIARRHEA", label: "Diarrhea", snomed_id: "62315008", category: "gastrointestinal",
    synonyms: ["diarrhea", "diarrhoea", "loose motions", "loose stools", "watery stools", "frequent stools", "dast"],
  },
  HEARTBURN: {
    canonical_id: "HEARTBURN", label: "Heartburn", snomed_id: "16331000", category: "gastrointestinal",
    synonyms: ["heartburn", "acid reflux", "acidity"],
  },
  EPIGASTRIC_PAIN: {
    canonical_id: "EPIGASTRIC_PAIN", label: "Epigastric Pain", snomed_id: "79922009", category: "gastrointestinal",
    synonyms: ["epigastric pain", "burning in stomach", "upper stomach pain"],
  },
  BLOATING: {
    canonical_id: "BLOATING", label: "Bloating", snomed_id: "248490000", category: "gastrointestinal",
    synonyms: ["bloating", "gas", "flatulence", "indigestion"],
  },
  LOSS_OF_APPETITE: {
    canonical_id: "LOSS_OF_APPETITE", label: "Loss of Appetite", snomed_id: "79890006", category: "gastrointestinal",
    synonyms: ["loss of appetite", "no appetite", "not hungry", "poor appetite", "decreased appetite", "bhookh nahi lagti"],
  },
  BLOODY_STOOL: {
    canonical_id: "BLOODY_STOOL", label: "Bloody Stool", snomed_id: "405729008", category: "gastrointestinal",
    synonyms: ["bloody stool", "blood in stool", "rectal bleeding", "passing blood"],
  },
  HEMATEMESIS: {
    canonical_id: "HEMATEMESIS", label: "Hematemesis", snomed_id: "8765009", category: "gastrointestinal",
    synonyms: ["hematemesis", "vomiting blood", "blood in vomit"],
  },
  MELENA: {
    canonical_id: "MELENA", label: "Melena", snomed_id: "2901004", category: "gastrointestinal",
    synonyms: ["melena", "black stool", "tarry stool", "dark stool"],
  },
  CONSTIPATION: {
    canonical_id: "CONSTIPATION", label: "Constipation", snomed_id: "14760008", category: "gastrointestinal",
    synonyms: ["constipation"],
  },
  ABDOMINAL_CRAMPS: {
    canonical_id: "ABDOMINAL_CRAMPS", label: "Abdominal Cramps", snomed_id: "73063007", category: "gastrointestinal",
    synonyms: ["abdominal cramps", "stomach cramps", "belly cramps"],
  },

  // ── Neurological ──
  HEADACHE: {
    canonical_id: "HEADACHE", label: "Headache", snomed_id: "25064002", category: "neurological",
    synonyms: ["headache", "head pain", "cephalalgia", "sir dard", "sir mein dard", "migraine"],
  },
  DIZZINESS: {
    canonical_id: "DIZZINESS", label: "Dizziness", snomed_id: "404640003", category: "neurological",
    synonyms: ["dizziness", "vertigo", "lightheadedness", "giddiness", "room spinning", "chakkar", "chakkar aa raha hai"],
  },
  SYNCOPE: {
    canonical_id: "SYNCOPE", label: "Syncope", snomed_id: "271594007", category: "neurological",
    synonyms: ["syncope", "passed out", "fainted", "fainting", "loss of consciousness"],
  },
  NECK_STIFFNESS: {
    canonical_id: "NECK_STIFFNESS", label: "Neck Stiffness", snomed_id: "161882006", category: "neurological",
    synonyms: ["neck stiffness", "stiff neck", "neck rigidity"],
  },
  PHOTOPHOBIA: {
    canonical_id: "PHOTOPHOBIA", label: "Photophobia", snomed_id: "409668002", category: "neurological",
    synonyms: ["photophobia", "sensitivity to light", "light sensitivity"],
  },
  BLURRED_VISION: {
    canonical_id: "BLURRED_VISION", label: "Blurred Vision", snomed_id: "246636008", category: "neurological",
    synonyms: ["blurred vision", "can't see clearly", "vision blurry", "double vision"],
  },
  TINGLING: {
    canonical_id: "TINGLING", label: "Tingling", snomed_id: "62507009", category: "neurological",
    synonyms: ["tingling", "pins and needles", "prickling", "paresthesia"],
  },
  WEAKNESS: {
    canonical_id: "WEAKNESS", label: "Weakness", snomed_id: "13791008", category: "neurological",
    synonyms: ["weakness", "weakness in arm", "weakness in leg", "general weakness", "body weakness"],
  },
  SPEECH_DIFFICULTY: {
    canonical_id: "SPEECH_DIFFICULTY", label: "Speech Difficulty", snomed_id: "29164008", category: "neurological",
    synonyms: ["speech difficulty", "slurred speech", "difficulty speaking", "cannot speak", "trouble speaking"],
  },
  CONFUSION: {
    canonical_id: "CONFUSION", label: "Confusion", snomed_id: "40917007", category: "neurological",
    synonyms: ["confusion"],
  },
  SEIZURE: {
    canonical_id: "SEIZURE", label: "Seizure", snomed_id: "91175000", category: "neurological",
    synonyms: ["seizure", "fits"],
  },
  THUNDERCLAP_HEADACHE: {
    canonical_id: "THUNDERCLAP_HEADACHE", label: "Thunderclap Headache", snomed_id: "95659009", category: "neurological",
    synonyms: ["thunderclap headache", "worst headache of life"],
  },
  FACIAL_DROOP: {
    canonical_id: "FACIAL_DROOP", label: "Facial Droop", snomed_id: "425390006", category: "neurological",
    synonyms: ["facial droop", "face drooping", "face droop"],
  },

  // ── Musculoskeletal ──
  BODY_ACHES: {
    canonical_id: "BODY_ACHES", label: "Body Aches", snomed_id: "68962001", category: "musculoskeletal",
    synonyms: ["body aches", "body pain", "generalized pain", "all over pain", "badan dard"],
  },
  MUSCLE_PAIN: {
    canonical_id: "MUSCLE_PAIN", label: "Muscle Pain", snomed_id: "68962001", category: "musculoskeletal",
    synonyms: ["muscle pain", "muscle ache", "myalgia", "muscle soreness"],
  },
  JOINT_PAIN: {
    canonical_id: "JOINT_PAIN", label: "Joint Pain", snomed_id: "57676002", category: "musculoskeletal",
    synonyms: ["joint pain", "joint ache", "arthralgia", "knee pain", "hip pain", "shoulder pain", "ghutne mein dard"],
  },
  BACK_PAIN: {
    canonical_id: "BACK_PAIN", label: "Back Pain", snomed_id: "161891005", category: "musculoskeletal",
    synonyms: ["back pain", "low back pain", "lower back pain", "lumbar pain", "lbp", "kamar dard"],
  },

  // ── Genitourinary ──
  DYSURIA: {
    canonical_id: "DYSURIA", label: "Dysuria", snomed_id: "49650001", category: "genitourinary",
    synonyms: ["dysuria", "painful urination", "burning urination", "urinary burning", "burning when peeing"],
  },
  POLYURIA: {
    canonical_id: "POLYURIA", label: "Polyuria", snomed_id: "56574000", category: "genitourinary",
    synonyms: ["polyuria", "peeing a lot", "frequent urination", "urinary frequency"],
  },
  HEMATURIA: {
    canonical_id: "HEMATURIA", label: "Hematuria", snomed_id: "34436003", category: "genitourinary",
    synonyms: ["hematuria", "blood in urine"],
  },
  FLANK_PAIN: {
    canonical_id: "FLANK_PAIN", label: "Flank Pain", snomed_id: "247355005", category: "genitourinary",
    synonyms: ["flank pain", "side pain", "kidney area pain"],
  },
  POLYDIPSIA: {
    canonical_id: "POLYDIPSIA", label: "Polydipsia", snomed_id: "17173007", category: "genitourinary",
    synonyms: ["polydipsia", "excessive thirst", "always thirsty"],
  },

  // ── Dermatological ──
  RASH: {
    canonical_id: "RASH", label: "Rash", snomed_id: "271807003", category: "dermatological",
    synonyms: ["rash", "skin rash", "eruption", "skin lesion", "hives", "rashes"],
  },
  ITCHING: {
    canonical_id: "ITCHING", label: "Itching", snomed_id: "418290006", category: "dermatological",
    synonyms: ["itching", "pruritus", "scratching", "itchy skin"],
  },
  SWELLING: {
    canonical_id: "SWELLING", label: "Swelling", snomed_id: "65124004", category: "dermatological",
    synonyms: ["swelling", "swollen", "edema", "fluid retention"],
  },

  // ── Psychiatric ──
  DEPRESSED_MOOD: {
    canonical_id: "DEPRESSED_MOOD", label: "Depressed Mood", snomed_id: "366979004", category: "psychiatric",
    synonyms: ["depressed mood", "feeling depressed", "feeling sad", "feeling low"],
  },
  ANHEDONIA: {
    canonical_id: "ANHEDONIA", label: "Anhedonia", snomed_id: "28475009", category: "psychiatric",
    synonyms: ["anhedonia", "no interest in anything", "lost interest"],
  },
  INSOMNIA: {
    canonical_id: "INSOMNIA", label: "Insomnia", snomed_id: "193462001", category: "psychiatric",
    synonyms: ["insomnia", "unable to sleep", "sleep problems", "neend nahi aati"],
  },
  ANXIETY: {
    canonical_id: "ANXIETY", label: "Anxiety", snomed_id: "48694002", category: "psychiatric",
    synonyms: ["anxiety", "worrying too much", "constant worry", "excessive worry"],
  },

  // ── ENT / Airway ──
  TRISMUS: {
    canonical_id: "TRISMUS", label: "Trismus", snomed_id: "87866006", category: "ent",
    synonyms: ["trismus", "can't open mouth", "jaw lock"],
  },
  MUFFLED_VOICE: {
    canonical_id: "MUFFLED_VOICE", label: "Muffled Voice", snomed_id: "49909004", category: "ent",
    synonyms: ["muffled voice", "hot potato voice"],
  },
  ODYNOPHAGIA: {
    canonical_id: "ODYNOPHAGIA", label: "Odynophagia", snomed_id: "30233002", category: "ent",
    synonyms: ["odynophagia", "painful swallowing"],
  },

  // ── Hallmark / Physical Exam Signs ──
  REBOUND_TENDERNESS: {
    canonical_id: "REBOUND_TENDERNESS", label: "Rebound Tenderness", snomed_id: "35611005", category: "gastrointestinal",
    synonyms: ["rebound tenderness"],
  },
  MURPHY_SIGN: {
    canonical_id: "MURPHY_SIGN", label: "Murphy Sign", snomed_id: "72300008", category: "gastrointestinal",
    synonyms: ["murphy sign", "murphy's sign"],
  },
  KERNIG_SIGN: {
    canonical_id: "KERNIG_SIGN", label: "Kernig Sign", snomed_id: "246771007", category: "neurological",
    synonyms: ["kernig sign", "kernig's sign"],
  },
  KUSSMAUL_BREATHING: {
    canonical_id: "KUSSMAUL_BREATHING", label: "Kussmaul Breathing", snomed_id: "267100002", category: "respiratory",
    synonyms: ["kussmaul breathing", "deep rapid breathing"],
  },
  JVD: {
    canonical_id: "JVD", label: "Jugular Venous Distension", snomed_id: "271653008", category: "cardiovascular",
    synonyms: ["jugular venous distension", "jugular vein distension", "jvd", "neck vein distension"],
  },
  ABDOMINAL_RIGIDITY: {
    canonical_id: "ABDOMINAL_RIGIDITY", label: "Abdominal Rigidity", snomed_id: "72300008", category: "gastrointestinal",
    synonyms: ["abdominal rigidity", "board like abdomen"],
  },
  SADDLE_ANESTHESIA: {
    canonical_id: "SADDLE_ANESTHESIA", label: "Saddle Anesthesia", snomed_id: "3723001", category: "neurological",
    synonyms: ["saddle anesthesia", "saddle numbness", "saddle area numbness"],
  },

  // ── Hallmark Signs (from terminology_normalizer consolidation) ──
  FACIAL_PAIN: {
    canonical_id: "FACIAL_PAIN", label: "Facial Pain", snomed_id: "95668009", category: "ent",
    synonyms: ["facial pain", "sinus pressure", "sinus pain"],
  },
  STRIDOR: {
    canonical_id: "STRIDOR", label: "Stridor", snomed_id: "70407001", category: "respiratory",
    synonyms: ["stridor"],
  },
  BARKING_COUGH: {
    canonical_id: "BARKING_COUGH", label: "Barking Cough", snomed_id: "17986004", category: "pediatric",
    synonyms: ["barking cough"],
  },
  PROJECTILE_VOMITING: {
    canonical_id: "PROJECTILE_VOMITING", label: "Projectile Vomiting", snomed_id: "249488009", category: "pediatric",
    synonyms: ["projectile vomiting"],
  },
  LEUKOCORIA: {
    canonical_id: "LEUKOCORIA", label: "Leukocoria", snomed_id: "95725002", category: "ophthalmological",
    synonyms: ["leukocoria", "white pupil", "white eye reflex", "white glow in eye"],
  },
  RED_EYE: {
    canonical_id: "RED_EYE", label: "Red Eye", snomed_id: "75705005", category: "ophthalmological",
    synonyms: ["red eye", "eye redness"],
  },
  CREPITUS: {
    canonical_id: "CREPITUS", label: "Crepitus", snomed_id: "12698005", category: "musculoskeletal",
    synonyms: ["crepitus", "gas in tissue"],
  },
  SIALORRHEA: {
    canonical_id: "SIALORRHEA", label: "Sialorrhea", snomed_id: "59828007", category: "neurological",
    synonyms: ["sialorrhea", "drooling", "excessive saliva"],
  },
  MOTTLED_SKIN: {
    canonical_id: "MOTTLED_SKIN", label: "Mottled Skin", snomed_id: "72100002", category: "dermatological",
    synonyms: ["mottled skin", "skin mottling"],
  },
  DERMATOMAL_RASH: {
    canonical_id: "DERMATOMAL_RASH", label: "Dermatomal Rash", snomed_id: "400079006", category: "dermatological",
    synonyms: ["dermatomal rash", "band-like rash"],
  },
  VESICULAR_RASH: {
    canonical_id: "VESICULAR_RASH", label: "Vesicular Rash", snomed_id: "271761007", category: "dermatological",
    synonyms: ["vesicular rash", "blisters", "vesicles"],
  },
  TRACHEAL_DEVIATION: {
    canonical_id: "TRACHEAL_DEVIATION", label: "Tracheal Deviation", snomed_id: "4119001", category: "respiratory",
    synonyms: ["tracheal deviation"],
  },
  PERICARDIAL_FRICTION_RUB: {
    canonical_id: "PERICARDIAL_FRICTION_RUB", label: "Pericardial Friction Rub", snomed_id: "7036007", category: "cardiovascular",
    synonyms: ["pericardial friction rub", "friction rub"],
  },
  BRUDZINSKI_SIGN: {
    canonical_id: "BRUDZINSKI_SIGN", label: "Brudzinski Sign", snomed_id: "246770008", category: "neurological",
    synonyms: ["brudzinski sign", "brudzinski's sign"],
  },
  GAIT_DISTURBANCE: {
    canonical_id: "GAIT_DISTURBANCE", label: "Gait Disturbance", snomed_id: "22325002", category: "neurological",
    synonyms: ["gait disturbance", "shuffling gait"],
  },
  URINARY_INCONTINENCE: {
    canonical_id: "URINARY_INCONTINENCE", label: "Urinary Incontinence", snomed_id: "165232002", category: "genitourinary",
    synonyms: ["urinary incontinence"],
  },
  COGNITIVE_DECLINE: {
    canonical_id: "COGNITIVE_DECLINE", label: "Cognitive Decline", snomed_id: "386806002", category: "neurological",
    synonyms: ["cognitive decline", "memory loss"],
  },
  LHERMITTE_SIGN: {
    canonical_id: "LHERMITTE_SIGN", label: "Lhermitte Sign", snomed_id: "246578001", category: "neurological",
    synonyms: ["lhermitte sign", "lhermittes sign", "electric down spine"],
  },
  FRUITY_BREATH: {
    canonical_id: "FRUITY_BREATH", label: "Fruity Breath Odor", snomed_id: "300893006", category: "endocrine",
    synonyms: ["fruity breath odor", "fruity breath", "fruity smell breath"],
  },
  HYPERPIGMENTATION: {
    canonical_id: "HYPERPIGMENTATION", label: "Hyperpigmentation", snomed_id: "49765009", category: "dermatological",
    synonyms: ["hyperpigmentation", "dark skin patches"],
  },
  ASCENDING_WEAKNESS: {
    canonical_id: "ASCENDING_WEAKNESS", label: "Ascending Weakness", snomed_id: "249888000", category: "neurological",
    synonyms: ["ascending weakness"],
  },
  HEMATEMESIS_SIGN: {
    canonical_id: "HEMATEMESIS_SIGN", label: "Hematemesis", snomed_id: "8765009", category: "gastrointestinal",
    synonyms: ["hematemesis", "vomiting blood", "blood in vomit"],
  },
  JAW_CLAUDICATION: {
    canonical_id: "JAW_CLAUDICATION", label: "Jaw Claudication", snomed_id: "274738001", category: "cardiovascular",
    synonyms: ["jaw claudication"],
  },
  SCALP_TENDERNESS: {
    canonical_id: "SCALP_TENDERNESS", label: "Scalp Tenderness", snomed_id: "298327007", category: "neurological",
    synonyms: ["scalp tenderness"],
  },
};

// ══════════════════════════════════════════════
// REVERSE INDEX — Built once at module load
// ══════════════════════════════════════════════

const SYNONYM_INDEX = new Map<string, string>();

for (const [id, entry] of Object.entries(CANONICAL_MAP)) {
  // Index the label itself
  SYNONYM_INDEX.set(entry.label.toLowerCase(), id);
  for (const syn of entry.synonyms) {
    SYNONYM_INDEX.set(syn.toLowerCase(), id);
  }
}

// ══════════════════════════════════════════════
// LANGUAGE DETECTION
// ══════════════════════════════════════════════

const SCRIPT_RANGES: Record<Exclude<SupportedLanguage, "unknown">, RegExp> = {
  hi: /[\u0900-\u097F]/,
  te: /[\u0C00-\u0C7F]/,
  ta: /[\u0B80-\u0BFF]/,
  en: /[a-zA-Z]/,
};

export function detectLanguage(text: string): SupportedLanguage {
  if (!text?.trim()) return "unknown";
  const counts: Record<string, number> = { en: 0, hi: 0, te: 0, ta: 0 };
  for (const char of text) {
    if (SCRIPT_RANGES.hi.test(char)) counts.hi++;
    else if (SCRIPT_RANGES.te.test(char)) counts.te++;
    else if (SCRIPT_RANGES.ta.test(char)) counts.ta++;
    else if (SCRIPT_RANGES.en.test(char)) counts.en++;
  }
  const total = counts.en + counts.hi + counts.te + counts.ta;
  if (total === 0) return "en";
  if (counts.hi / total > 0.3) return "hi";
  if (counts.te / total > 0.3) return "te";
  if (counts.ta / total > 0.3) return "ta";
  return "en";
}

// ══════════════════════════════════════════════
// CODE-MIXED TRANSLATION (Hinglish → English)
// ══════════════════════════════════════════════

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

function translateCodeMixed(text: string): string {
  let result = text.toLowerCase();
  const sorted = Object.entries(CODE_MIXED_MAP).sort(([a], [b]) => b.length - a.length);
  for (const [phrase, english] of sorted) {
    result = result.replace(new RegExp(phrase, "gi"), english);
  }
  return result;
}

// ══════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════

/**
 * Map a single raw input to its canonical ID.
 * Returns null if no mapping exists.
 */
export function resolveCanonicalId(input: string): string | null {
  const normalized = input.toLowerCase().trim();
  return SYNONYM_INDEX.get(normalized) ?? null;
}

/**
 * Get full canonical entry by ID.
 */
export function getCanonicalEntry(canonicalId: string): CanonicalEntry | null {
  return CANONICAL_MAP[canonicalId] ?? null;
}

/**
 * Canonicalize a list of raw clinical inputs.
 * This is the PRIMARY entry point for converting raw strings → CanonicalFeature[].
 */
export function canonicalize(
  rawInputs: string[],
  source: CanonicalFeature["source"] = "patient"
): CanonicalizationResult {
  const language = detectLanguage(rawInputs.join(" "));
  const features: CanonicalFeature[] = [];
  const unmapped: string[] = [];
  const trace: CanonicalizationTrace[] = [];
  const seen = new Set<string>();

  for (const raw of rawInputs) {
    if (!raw?.trim()) continue;

    // Step 1: Normalize text
    let normalized = raw.toLowerCase().trim().replace(/\s+/g, " ");

    // Step 2: Translate code-mixed phrases
    if (language !== "en" || Object.keys(CODE_MIXED_MAP).some(k => normalized.includes(k))) {
      normalized = translateCodeMixed(normalized);
    }

    // Step 3: Resolve canonical ID
    const canonicalId = SYNONYM_INDEX.get(normalized);

    if (canonicalId && !seen.has(canonicalId)) {
      seen.add(canonicalId);
      const entry = CANONICAL_MAP[canonicalId];
      features.push({
        feature_id: canonicalId,
        presence: true,
        intensity: "unknown",
        duration: "",
        snomed_id: entry?.snomed_id ?? null,
        source,
      });
      trace.push({
        raw_input: raw,
        normalized,
        canonical_id: canonicalId,
        mapping_source: "synonym_map",
        confidence: 1.0,
      });
    } else if (!canonicalId) {
      unmapped.push(raw);
      trace.push({
        raw_input: raw,
        normalized,
        canonical_id: null,
        mapping_source: "passthrough",
        confidence: 0.0,
      });
    }
  }

  return { features, unmapped, language_detected: language, trace };
}

/**
 * Get all canonical IDs currently registered.
 */
export function getAllCanonicalIds(): string[] {
  return Object.keys(CANONICAL_MAP);
}

/**
 * Get total synonym count for coverage metrics.
 */
export function getSynonymCount(): number {
  return SYNONYM_INDEX.size;
}
