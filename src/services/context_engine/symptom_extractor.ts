/**
 * PCIE — Medical Phrase Extraction Module
 * 
 * Extracts symptoms, duration, severity, medications, and allergies
 * from normalized patient text using pattern matching.
 */

export interface ExtractionResult {
  symptoms: string[];
  duration: string;
  severity: string;
  medications: string[];
  allergies: string[];
  raw_phrases: string[];
}

// Common symptom phrases for pattern matching
const SYMPTOM_PATTERNS = [
  "fever", "headache", "cough", "cold", "body pain", "chest pain",
  "abdominal pain", "back pain", "knee pain", "joint pain", "neck pain",
  "sore throat", "runny nose", "nasal congestion", "shortness of breath",
  "difficulty breathing", "dizziness", "nausea", "vomiting", "diarrhea",
  "constipation", "fatigue", "weakness", "loss of appetite", "weight loss",
  "weight gain", "insomnia", "anxiety", "palpitations", "sweating",
  "rash", "itching", "swelling", "numbness", "tingling", "blurred vision",
  "ear pain", "toothache", "urinary burning", "frequent urination",
  "blood in urine", "blood in stool", "muscle pain", "cramps",
  "wheezing", "sneezing", "chills", "night sweats", "heartburn",
  "bloating", "gas", "hiccups", "jaw pain", "arm pain", "leg pain",
  "stiff neck", "photophobia", "confusion", "fainting", "seizure",
  "dyspnea", "diaphoresis", "urticaria", "edema", "tinnitus",
];

// Duration extraction patterns
const DURATION_PATTERNS = [
  /(?:since|for|from|past)\s+(\d+\s*(?:day|days|week|weeks|month|months|hour|hours|year|years))/i,
  /(\d+\s*(?:day|days|week|weeks|month|months|hour|hours|year|years))\s+(?:ago|back)/i,
  /(?:since\s+)?(?:yesterday|today|last\s+(?:night|week|month))/i,
  /(\d+)\s*(?:din|hafta|mahine)/i, // Hindi duration words
];

// Severity indicators
const SEVERITY_MAP: Record<string, string> = {
  "mild": "mild",
  "slight": "mild",
  "thoda": "mild",
  "moderate": "moderate",
  "severe": "severe",
  "intense": "severe",
  "unbearable": "critical",
  "worst": "critical",
  "bahut": "severe",
  "bahut zyada": "critical",
  "excruciating": "critical",
};

// Common OTC medication patterns
const MEDICATION_PATTERNS = [
  /(?:taking|took|using|on)\s+([\w\s]+?)(?:\s+(?:tablet|capsule|syrup|mg|dose))/i,
  /(?:paracetamol|ibuprofen|aspirin|crocin|dolo|combiflam|cetrizine|azithromycin|amoxicillin|metformin|atorvastatin|omeprazole|pantoprazole|amlodipine|losartan|telmisartan)/i,
];

// Allergy markers
const ALLERGY_MARKERS = [
  /(?:allergic\s+to|allergy\s+to|cannot\s+take|sensitive\s+to)\s+([\w\s,]+)/i,
];

/**
 * Extract medical phrases from normalized patient text.
 */
export function extractMedicalPhrases(text: string): ExtractionResult {
  const lower = text.toLowerCase();
  const result: ExtractionResult = {
    symptoms: [],
    duration: "",
    severity: "unknown",
    medications: [],
    allergies: [],
    raw_phrases: [],
  };

  // 1. Extract symptoms via keyword matching
  const foundSymptoms = new Set<string>();
  for (const symptom of SYMPTOM_PATTERNS) {
    if (lower.includes(symptom)) {
      foundSymptoms.add(symptom);
    }
  }
  result.symptoms = Array.from(foundSymptoms);
  result.raw_phrases = [...result.symptoms];

  // 2. Extract duration
  for (const pattern of DURATION_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      result.duration = normalizeDuration(match[0]);
      break;
    }
  }

  // 3. Extract severity
  for (const [keyword, level] of Object.entries(SEVERITY_MAP)) {
    if (lower.includes(keyword)) {
      result.severity = level;
      break;
    }
  }

  // 4. Extract medications
  for (const pattern of MEDICATION_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const med = match[1] || match[0];
      result.medications.push(med.trim());
    }
  }

  // 5. Extract allergies
  for (const pattern of ALLERGY_MARKERS) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const allergyList = match[1].split(/[,&]/).map(a => a.trim()).filter(Boolean);
      result.allergies.push(...allergyList);
    }
  }

  return result;
}

function normalizeDuration(raw: string): string {
  const cleaned = raw.replace(/^(?:since|for|from|past)\s+/i, "").trim();
  // Map Hindi duration words
  return cleaned
    .replace(/din/i, "days")
    .replace(/hafta/i, "weeks")
    .replace(/mahine/i, "months")
    .replace(/yesterday/i, "1 day")
    .replace(/today/i, "today")
    .replace(/last\s+night/i, "1 day")
    .replace(/last\s+week/i, "1 week")
    .replace(/last\s+month/i, "1 month");
}
