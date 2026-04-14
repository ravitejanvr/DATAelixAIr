/**
 * PCIE — Clinical Concept Mapping Module (V4 DELEGATING)
 * 
 * Maps extracted symptom phrases to canonical clinical concepts.
 * V4: Checks canonical normalizer FIRST, then falls back to
 * symptom_language_map → clinical_condition_map → passthrough.
 */
import { supabase } from "@/integrations/supabase/client";
import { resolveCanonicalId, getCanonicalEntry } from "@/services/canonical/normalizer";

export interface MappedConcept {
  original_phrase: string;
  canonical_concept: string;
  snomed_id: string | null;
  confidence: number;
  source: "symptom_language_map" | "clinical_condition_map" | "synonym_fallback" | "passthrough";
}

// Local synonym cache for fast lookups (loaded on first call)
let synonymCache: Map<string, { concept: string; snomed_id: string | null; confidence: number }> | null = null;

const BUILT_IN_SYNONYMS: Record<string, string> = {
  "breathlessness": "dyspnea",
  "shortness of breath": "dyspnea",
  "difficulty breathing": "dyspnea",
  "heart attack": "myocardial infarction",
  "high blood pressure": "hypertension",
  "high bp": "hypertension",
  "sugar": "diabetes mellitus",
  "sugar problem": "diabetes mellitus",
  "low blood sugar": "hypoglycemia",
  "fits": "seizure",
  "loose motions": "diarrhea",
  "loose stools": "diarrhea",
  "stomach pain": "abdominal pain",
  "tummy pain": "abdominal pain",
  "tiredness": "fatigue",
  "body ache": "body pain",
  "body aches": "body pain",
  "running nose": "runny nose",
  "throwing up": "vomiting",
  "feeling sick": "nausea",
  "rashes": "rash",
  "swollen": "swelling",
  "pins and needles": "paresthesia",
  "burning urination": "dysuria",
  "urinary burning": "dysuria",
  "blood pressure": "hypertension",
};

/**
 * Load symptom_language_map from database into memory cache.
 */
async function loadSynonymCache(): Promise<void> {
  if (synonymCache) return;
  synonymCache = new Map();

  try {
    const { data } = await supabase
      .from("symptom_language_map")
      .select("phrase, normalized_phrase, clinical_concept, snomed_id, confidence_score")
      .limit(1000);

    if (data) {
      for (const row of data) {
        synonymCache.set(row.phrase.toLowerCase(), {
          concept: row.clinical_concept,
          snomed_id: row.snomed_id,
          confidence: row.confidence_score ?? 1.0,
        });
      }
    }
  } catch (err) {
    console.warn("[ConceptMapper] Failed to load synonym cache:", err);
  }
}

/**
 * Map a list of extracted phrases to canonical clinical concepts.
 */
export async function mapToClinicalConcepts(
  phrases: string[]
): Promise<MappedConcept[]> {
  await loadSynonymCache();

  const results: MappedConcept[] = [];

  for (const phrase of phrases) {
    const lower = phrase.toLowerCase().trim();
    if (!lower) continue;

    // V4: Check canonical normalizer FIRST
    const canonicalId = resolveCanonicalId(lower);
    if (canonicalId) {
      const entry = getCanonicalEntry(canonicalId);
      results.push({
        original_phrase: phrase,
        canonical_concept: entry?.label ?? canonicalId,
        snomed_id: entry?.snomed_id ?? null,
        confidence: 1.0,
        source: "synonym_fallback", // canonical system
      });
      continue;
    }

    // 1. Check symptom_language_map cache
    const cached = synonymCache?.get(lower);
    if (cached) {
      results.push({
        original_phrase: phrase,
        canonical_concept: cached.concept,
        snomed_id: cached.snomed_id,
        confidence: cached.confidence,
        source: "symptom_language_map",
      });
      continue;
    }

    // 2. Check built-in synonyms (DEPRECATED — kept for coverage gap)
    const builtIn = BUILT_IN_SYNONYMS[lower];
    if (builtIn) {
      results.push({
        original_phrase: phrase,
        canonical_concept: builtIn,
        snomed_id: null,
        confidence: 0.9,
        source: "synonym_fallback",
      });
      continue;
    }

    // 3. Check clinical_condition_map via database
    try {
      const { data } = await supabase
        .from("clinical_condition_map")
        .select("canonical_condition")
        .or(`synonyms.cs.{${lower}},canonical_condition.ilike.%${lower}%`)
        .limit(1);

      if (data && data.length > 0) {
        results.push({
          original_phrase: phrase,
          canonical_concept: data[0].canonical_condition,
          snomed_id: null,
          confidence: 0.85,
          source: "clinical_condition_map",
        });
        continue;
      }
    } catch {
      // Fallthrough to passthrough
    }

    // 4. Passthrough — use phrase as-is
    results.push({
      original_phrase: phrase,
      canonical_concept: lower,
      snomed_id: null,
      confidence: 0.5,
      source: "passthrough",
    });
  }

  return results;
}

/**
 * Reset the synonym cache (useful after bulk inserts).
 */
export function resetConceptCache(): void {
  synonymCache = null;
}
