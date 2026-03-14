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
  "swollen legs": "edema",
  "swollen feet": "edema",
  "ankle swelling": "edema",
  "leg swelling": "edema",
  "fluid retention": "edema",
  "cannot lie flat": "orthopnea",
  "wakes up breathless": "orthopnea",

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
