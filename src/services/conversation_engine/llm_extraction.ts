/**
 * LLM-Driven Clinical Entity Extraction + Dynamic Question Generation
 *
 * Calls the clinical-entity-extraction edge function to:
 * 1. Extract structured clinical entities from free-text input
 * 2. Generate the next intelligent follow-up question
 *
 * This replaces the hardcoded question sequence with context-aware questioning.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupportedLanguage } from "../canonical/types";

// ══════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════

export interface ExtractedEntities {
  symptoms: Array<{ name: string; original_text?: string }>;
  duration?: string;
  severity?: "mild" | "moderate" | "severe" | "unknown";
  associated_symptoms?: string[];
  risk_factors?: string[];
  medications?: string[];
  allergies?: string[];
  age?: number;
  sex?: "male" | "female" | "other";
  negations?: string[];
}

export interface LLMNextQuestion {
  text: string;
  field: string;
  options?: string[];
  priority: "critical" | "high" | "medium" | "low";
}

export interface LLMExtractionResult {
  extracted_entities: ExtractedEntities;
  acknowledgment: string;
  next_question: LLMNextQuestion;
  all_fields_collected: boolean;
}

/** Collected fields tracker — what we already know */
export interface CollectedFields {
  chief_complaint?: string[];
  severity?: string;
  duration?: string;
  associated_symptoms?: string[];
  red_flags?: string[];
  risk_factors?: string[];
  medications?: string[];
  allergies?: string[];
  age?: number;
  sex?: string;
  medical_history?: string[];
  family_history?: string[];
}

// ══════════════════════════════════════════════
// LLM EXTRACTION CALL
// ══════════════════════════════════════════════

/**
 * Call the LLM entity extraction edge function.
 * Returns structured entities + next question + acknowledgment.
 */
export async function extractClinicalEntitiesLLM(
  userInput: string,
  collectedFields: CollectedFields,
  language: SupportedLanguage
): Promise<LLMExtractionResult | null> {
  try {
    console.log("[LLM_EXTRACT] Input:", userInput);
    console.log("[LLM_EXTRACT] Already collected:", JSON.stringify(collectedFields));

    const { data, error } = await supabase.functions.invoke("clinical-entity-extraction", {
      body: {
        user_input: userInput,
        session_state: { collected_fields: collectedFields },
        language: language === "unknown" ? "auto-detect" : language,
      },
    });

    if (error) {
      console.error("[LLM_EXTRACT] Edge function error:", error);
      return null;
    }

    if (data?.error) {
      console.error("[LLM_EXTRACT] AI error:", data.error);
      return null;
    }

    console.log("[LLM_EXTRACT] Result:", JSON.stringify(data));
    return data as LLMExtractionResult;
  } catch (err) {
    console.error("[LLM_EXTRACT] Exception:", err);
    return null;
  }
}

// ══════════════════════════════════════════════
// MERGE EXTRACTED ENTITIES INTO COLLECTED FIELDS
// ══════════════════════════════════════════════

/**
 * Merge new LLM-extracted entities into collected fields.
 * Does not overwrite existing valid data.
 */
export function mergeEntitiesIntoCollected(
  current: CollectedFields,
  entities: ExtractedEntities
): CollectedFields {
  const merged = { ...current };

  // Symptoms → chief_complaint
  if (entities.symptoms.length > 0) {
    const newSymptoms = entities.symptoms.map(s => s.name);
    merged.chief_complaint = [
      ...new Set([...(merged.chief_complaint || []), ...newSymptoms]),
    ];
  }

  // Associated symptoms
  if (entities.associated_symptoms?.length) {
    merged.associated_symptoms = [
      ...new Set([...(merged.associated_symptoms || []), ...entities.associated_symptoms]),
    ];
  }

  // Duration — only set if not already known
  if (entities.duration && !merged.duration) {
    merged.duration = entities.duration;
  }

  // Severity — only set if not already known
  if (entities.severity && entities.severity !== "unknown" && !merged.severity) {
    merged.severity = entities.severity;
  }

  // Risk factors
  if (entities.risk_factors?.length) {
    merged.risk_factors = [
      ...new Set([...(merged.risk_factors || []), ...entities.risk_factors]),
    ];
  }

  // Medications
  if (entities.medications?.length) {
    merged.medications = [
      ...new Set([...(merged.medications || []), ...entities.medications]),
    ];
  }

  // Allergies
  if (entities.allergies?.length) {
    merged.allergies = [
      ...new Set([...(merged.allergies || []), ...entities.allergies]),
    ];
  }

  // Demographics
  if (entities.age != null && !merged.age) {
    merged.age = entities.age;
  }
  if (entities.sex && !merged.sex) {
    merged.sex = entities.sex;
  }

  return merged;
}
