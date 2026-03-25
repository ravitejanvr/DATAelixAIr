/**
 * PCIE — Terminology Normalizer
 * 
 * Resolves symptom synonyms to canonical forms recognized by the knowledge graph.
 * This ensures the reasoning pipeline matches symptoms regardless of phrasing.
 */

const SYNONYM_MAP: Record<string, string> = {
  // Respiratory
  "productive cough": "productive cough",
  "cough with sputum": "productive cough",
  "cough with phlegm": "productive cough",
  "phlegmy cough": "productive cough",
  "wet cough": "productive cough",
  "dry cough": "dry cough",
  "nonproductive cough": "dry cough",
  "shortness of breath": "dyspnea",
  "breathlessness": "dyspnea",
  "difficulty breathing": "dyspnea",
  "breathing difficulty": "dyspnea",
  "can't breathe": "dyspnea",
  "labored breathing": "dyspnea",
  "sob": "dyspnea",
  "runny nose": "runny nose",
  "rhinorrhea": "runny nose",
  "nasal discharge": "runny nose",
  "stuffy nose": "nasal congestion",
  "blocked nose": "nasal congestion",
  "nose block": "nasal congestion",
  "sinus pressure": "facial pain",
  "sinus pain": "facial pain",
  "coughing up blood": "hemoptysis",
  "blood in sputum": "hemoptysis",

  // GI
  "stomach pain": "abdominal pain",
  "belly pain": "abdominal pain",
  "tummy pain": "abdominal pain",
  "stomach ache": "abdominal pain",
  "abdominal discomfort": "abdominal pain",
  "stomach cramps": "abdominal cramps",
  "belly cramps": "abdominal cramps",
  "throwing up": "vomiting",
  "puking": "vomiting",
  "emesis": "vomiting",
  "feeling sick": "nausea",
  "queasy": "nausea",
  "loose stools": "diarrhea",
  "loose motions": "diarrhea",
  "watery stools": "diarrhea",
  "frequent stools": "diarrhea",
  "acid reflux": "heartburn",
  "acidity": "heartburn",
  "burning in stomach": "epigastric pain",
  "upper stomach pain": "epigastric pain",
  "gas": "bloating",
  "flatulence": "bloating",
  "indigestion": "bloating",
  "no appetite": "loss of appetite",
  "not hungry": "loss of appetite",
  "poor appetite": "loss of appetite",
  "decreased appetite": "loss of appetite",
  "blood in stool": "bloody stool",
  "rectal bleeding": "bloody stool",
  "passing blood": "bloody stool",

  // Cardiovascular
  "heart racing": "palpitations",
  "heart pounding": "palpitations",
  "irregular heartbeat": "palpitations",
  "fast heart": "tachycardia",
  "rapid pulse": "tachycardia",
  "chest tightness": "chest pain",
  "chest pressure": "chest pain",
  "chest discomfort": "chest pain",
  "heavy sweating": "diaphoresis",
  "profuse sweating": "diaphoresis",
  "cold sweats": "diaphoresis",
  "swollen legs": "peripheral edema",
  "swollen feet": "peripheral edema",
  "ankle swelling": "peripheral edema",
  "leg swelling": "peripheral edema",
  "fluid retention": "edema",
  "cannot lie flat": "orthopnea",
  "wakes up breathless": "paroxysmal nocturnal dyspnea",

  // Neurological
  "head pain": "headache",
  "migraine": "headache",
  "giddiness": "dizziness",
  "lightheadedness": "dizziness",
  "vertigo": "dizziness",
  "room spinning": "dizziness",
  "passed out": "syncope",
  "fainted": "syncope",
  "fainting": "syncope",
  "loss of consciousness": "syncope",
  "stiff neck": "neck stiffness",
  "neck rigidity": "neck stiffness",
  "sensitivity to light": "photophobia",
  "light sensitivity": "photophobia",
  "can't see clearly": "blurred vision",
  "vision blurry": "blurred vision",
  "double vision": "blurred vision",
  "pins and needles": "tingling",
  "prickling": "tingling",
  "weakness in arm": "weakness",
  "weakness in leg": "weakness",
  "general weakness": "weakness",
  "body weakness": "weakness",
  "slurred speech": "speech difficulty",
  "difficulty speaking": "speech difficulty",
  "cannot speak": "speech difficulty",

  // Musculoskeletal
  "body pain": "body aches",
  "generalized pain": "body aches",
  "all over pain": "body aches",
  "muscle ache": "muscle pain",
  "myalgia": "muscle pain",
  "muscle soreness": "muscle pain",
  "joint ache": "joint pain",
  "arthralgia": "joint pain",
  "knee pain": "joint pain",
  "hip pain": "joint pain",
  "shoulder pain": "joint pain",
  "low back pain": "back pain",
  "lower back pain": "back pain",
  "lumbar pain": "back pain",
  "lbp": "back pain",

  // Genitourinary
  "painful urination": "dysuria",
  "burning urination": "dysuria",
  "urinary burning": "dysuria",
  "burning when peeing": "dysuria",
  "peeing a lot": "polyuria",
  "frequent urination": "polyuria",
  "urinary frequency": "polyuria",
  "blood in urine": "hematuria",
  "side pain": "flank pain",
  "kidney area pain": "flank pain",
  "excessive thirst": "polydipsia",
  "always thirsty": "polydipsia",

  // Dermatological
  "skin rash": "rash",
  "eruption": "rash",
  "skin lesion": "rash",
  "hives": "rash",
  "pruritus": "itching",
  "scratching": "itching",
  "itchy skin": "itching",

  // General/Constitutional
  "tiredness": "fatigue",
  "exhaustion": "fatigue",
  "no energy": "fatigue",
  "lethargic": "fatigue",
  "lethargy": "fatigue",
  "feeling tired": "fatigue",
  "low grade fever": "mild fever",
  "slight fever": "mild fever",
  "high fever": "fever",
  "temperature": "fever",
  "febrile": "fever",
  "pyrexia": "fever",
  "rigor": "chills",
  "shivering": "chills",
  "cold feeling": "chills",
  "unable to sleep": "insomnia",
  "sleep problems": "insomnia",
  "sweating at night": "night sweats",
  "nocturnal sweating": "night sweats",
  "lost weight": "weight loss",
  "losing weight": "weight loss",
  "unintentional weight loss": "weight loss",
  "gained weight": "weight gain",
  "putting on weight": "weight gain",
  "feeling unwell": "malaise",
  "generally unwell": "malaise",
  "not feeling well": "malaise",
  "dehydrated": "dehydration",
  "dry mouth": "dehydration",

  // Hallmark / high-specificity symptoms
  "rebound tenderness": "rebound tenderness",
  "murphy sign": "Murphy sign",
  "murphy's sign": "Murphy sign",
  "kernig sign": "Kernig sign",
  "kernig's sign": "Kernig sign",
  "brudzinski sign": "Brudzinski sign",
  "brudzinski's sign": "Brudzinski sign",
  "kussmaul breathing": "Kussmaul breathing",
  "deep rapid breathing": "Kussmaul breathing",
  "fruity breath": "fruity breath odor",
  "tracheal deviation": "tracheal deviation",
  "jugular vein distension": "jugular venous distension",
  "jvd": "jugular venous distension",
  "neck vein distension": "jugular venous distension",

  // Cardiac-specific (additional)
  "pnd": "paroxysmal nocturnal dyspnea",
  "waking up short of breath": "paroxysmal nocturnal dyspnea",
  "foot swelling": "peripheral edema",
  "positional chest pain": "pleuritic chest pain",
  "sharp chest pain with breathing": "pleuritic chest pain",
  "pain worse with breathing": "pleuritic chest pain",
  "friction rub": "pericardial friction rub",

  // Neurological hallmarks
  "face drooping": "facial droop",
  "face droop": "facial droop",
  "one sided weakness": "arm weakness",
  "trouble speaking": "speech difficulty",

  // Dermatological hallmarks
  "dermatomal rash": "dermatomal rash",
  "band-like rash": "dermatomal rash",
  "blisters": "vesicular rash",
  "vesicles": "vesicular rash",
  "silvery scales": "silvery scales",
  "scaly patches": "scaling plaques",
  "burrow marks": "burrow tracks",

  // GI hallmarks
  "vomiting blood": "hematemesis",
  "blood in vomit": "hematemesis",
  "black stool": "melena",
  "tarry stool": "melena",
  "dark stool": "melena",

  // Psychiatric
  "feeling depressed": "depressed mood",
  "feeling sad": "depressed mood",
  "feeling low": "depressed mood",
  "no interest in anything": "anhedonia",
  "lost interest": "anhedonia",
  "worrying too much": "excessive worry",
  "constant worry": "excessive worry",
  "muscle tightness": "muscle tension",

  // Pediatric
  "barking cough": "barking cough",
  "stridor": "stridor",
  "projectile vomiting": "projectile vomiting",
  "white pupil": "leukocoria",
  "white eye reflex": "leukocoria",
  "squint": "strabismus",
  "drawing legs up": "leg drawing",

  // Surgical / MSK
  "pain out of proportion": "pain out of proportion",
  "crepitus": "crepitus",
  "gas in tissue": "crepitus",
  "irreducible lump": "irreducible hernia",
  "groin lump": "inguinal mass",
  "saddle numbness": "saddle anesthesia",
  "saddle area numbness": "saddle anesthesia",
  "pain with stretch": "pain with passive stretch",

  // Ophthalmological
  "halos around lights": "halos",
  "white glow in eye": "leukocoria",
  "eye redness": "red eye",
  "red eye": "red eye",
  "mid dilated pupil": "mid-dilated pupil",

  // Toxicological
  "cherry red skin": "cherry red discoloration",
  "fruity smell breath": "fruity breath odor",
  "symptoms worse indoors": "environmental exposure",
  "drooling": "sialorrhea",
  "excessive saliva": "sialorrhea",

  // ENT / Airway
  "trismus": "trismus",
  "can't open mouth": "trismus",
  "jaw lock": "trismus",
  "muffled voice": "muffled voice",
  "hot potato voice": "muffled voice",
  "odynophagia": "painful swallowing",
  "painful swallowing": "odynophagia",

  // Constitutional / Systemic
  "cyclical fever": "cyclical fever",
  "step ladder fever": "step-ladder fever",
  "rigors": "rigors",
  "relative bradycardia": "relative bradycardia",
  "coated tongue": "coated tongue",
  "conjunctival suffusion": "conjunctival suffusion",
  "mottled skin": "mottled skin",
  "skin mottling": "mottled skin",
  "hyperpigmentation": "hyperpigmentation",
  "dark skin patches": "hyperpigmentation",
  "salt craving": "salt craving",

  // Cardiac additional
  "jaw claudication": "jaw claudication",
  "scalp tenderness": "scalp tenderness",
  "absent pulses": "absent pulses",
  "pulse deficit": "pulse deficit",
  "board like abdomen": "abdominal rigidity",
  "abdominal rigidity": "abdominal rigidity",

  // Neurological additional
  "thunderclap headache": "thunderclap headache",
  "worst headache of life": "thunderclap headache",
  "ascending weakness": "ascending weakness",
  "bilateral weakness": "bilateral leg weakness",
  "lucid interval": "lucid interval",
  "automatisms": "automatisms",
  "eye deviation": "eye deviation",
  "lhermittes sign": "Lhermitte sign",
  "electric down spine": "Lhermitte sign",
  "gait disturbance": "gait disturbance",
  "shuffling gait": "gait disturbance",
  "urinary incontinence": "urinary incontinence",
  "cognitive decline": "cognitive decline",
  "memory loss": "cognitive decline",
};

/**
 * Normalize a single symptom string to its canonical form.
 */
export function normalizeSymptom(symptom: string): string {
  const lower = symptom.toLowerCase().trim();
  return SYNONYM_MAP[lower] || lower;
}

/**
 * Normalize an array of symptoms, deduplicating after normalization.
 */
export function normalizeSymptoms(symptoms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const s of symptoms) {
    const normalized = normalizeSymptom(s);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

/**
 * Get the canonical form and whether normalization changed the input.
 */
export function normalizeWithTrace(symptoms: string[]): {
  normalized: string[];
  mappings: Array<{ original: string; canonical: string; changed: boolean }>;
} {
  const seen = new Set<string>();
  const normalized: string[] = [];
  const mappings: Array<{ original: string; canonical: string; changed: boolean }> = [];

  for (const s of symptoms) {
    const canonical = normalizeSymptom(s);
    mappings.push({ original: s, canonical, changed: s.toLowerCase().trim() !== canonical });
    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalized.push(canonical);
    }
  }

  return { normalized, mappings };
}
