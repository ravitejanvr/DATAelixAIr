/**
 * V4 Canonical Mapping Layer
 *
 * All clinical inputs must pass through this layer before
 * entering the reasoning pipeline. No raw strings allowed
 * beyond this boundary.
 */

export interface CanonicalEntry {
  canonical_id: string;
  label: string;
  snomed_id: string | null;
  synonyms: string[];
}

const CANONICAL_MAP: Record<string, CanonicalEntry> = {
  FEVER: {
    canonical_id: "FEVER",
    label: "Fever",
    snomed_id: "386661006",
    synonyms: ["fever", "pyrexia", "high temperature", "febrile", "bukhar"],
  },
  HEADACHE: {
    canonical_id: "HEADACHE",
    label: "Headache",
    snomed_id: "25064002",
    synonyms: ["headache", "head pain", "cephalalgia", "sir dard"],
  },
  CHEST_PAIN: {
    canonical_id: "CHEST_PAIN",
    label: "Chest Pain",
    snomed_id: "29857009",
    synonyms: ["chest pain", "thoracic pain", "seene mein dard"],
  },
  COUGH: {
    canonical_id: "COUGH",
    label: "Cough",
    snomed_id: "49727002",
    synonyms: ["cough", "khansi"],
  },
  DYSPNEA: {
    canonical_id: "DYSPNEA",
    label: "Dyspnea",
    snomed_id: "267036007",
    synonyms: ["dyspnea", "breathlessness", "shortness of breath", "difficulty breathing", "sans lene mein taklif"],
  },
  ABDOMINAL_PAIN: {
    canonical_id: "ABDOMINAL_PAIN",
    label: "Abdominal Pain",
    snomed_id: "21522001",
    synonyms: ["abdominal pain", "stomach pain", "tummy pain", "pet dard", "pet mein dard"],
  },
  VOMITING: {
    canonical_id: "VOMITING",
    label: "Vomiting",
    snomed_id: "422400008",
    synonyms: ["vomiting", "emesis", "throwing up", "ulti"],
  },
  DIARRHEA: {
    canonical_id: "DIARRHEA",
    label: "Diarrhea",
    snomed_id: "62315008",
    synonyms: ["diarrhea", "diarrhoea", "loose motions", "loose stools", "dast"],
  },
  FATIGUE: {
    canonical_id: "FATIGUE",
    label: "Fatigue",
    snomed_id: "84229001",
    synonyms: ["fatigue", "tiredness", "exhaustion", "thakan"],
  },
  DIZZINESS: {
    canonical_id: "DIZZINESS",
    label: "Dizziness",
    snomed_id: "404640003",
    synonyms: ["dizziness", "vertigo", "lightheadedness", "chakkar"],
  },
};

/** Reverse lookup: synonym → canonical_id */
const SYNONYM_INDEX = new Map<string, string>();

for (const [id, entry] of Object.entries(CANONICAL_MAP)) {
  for (const syn of entry.synonyms) {
    SYNONYM_INDEX.set(syn.toLowerCase(), id);
  }
}

/**
 * Map a raw clinical input string to its canonical ID.
 * Throws if no mapping exists — enforces Canonical Contract.
 */
export function mapToCanonical(input: string): string {
  const normalized = input.toLowerCase().trim();
  const id = SYNONYM_INDEX.get(normalized);
  if (!id) {
    throw new Error(`[Canonical Contract Violation] No mapping for: "${input}"`);
  }
  return id;
}

/**
 * Safe version — returns null instead of throwing.
 */
export function tryMapToCanonical(input: string): string | null {
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
 * Map multiple inputs, returning both mapped and unmapped.
 */
export function mapBatch(inputs: string[]): {
  mapped: Array<{ input: string; canonical_id: string }>;
  unmapped: string[];
} {
  const mapped: Array<{ input: string; canonical_id: string }> = [];
  const unmapped: string[] = [];

  for (const input of inputs) {
    const id = tryMapToCanonical(input);
    if (id) {
      mapped.push({ input, canonical_id: id });
    } else {
      unmapped.push(input);
    }
  }

  return { mapped, unmapped };
}

/**
 * Trace log structure for canonical mapping stage.
 */
export interface CanonicalTrace {
  input: Record<string, string>;
  states: Array<{ state: string; activation: number }>;
  contributions: Array<{ diagnosis: string; state: string; value: number }>;
  final_scores: Record<string, number>;
  ranking: string[];
}
