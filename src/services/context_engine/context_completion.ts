/**
 * PCIE — Context Completion Module
 * 
 * Identifies missing diagnostic information based on the
 * chief complaint and symptoms. Generates follow-up suggestions
 * to improve context completeness.
 */

import { supabase } from "@/integrations/supabase/client";

export interface MissingField {
  field: string;
  reason: string;
  priority: "high" | "medium" | "low";
  suggested_questions?: string[];
}

// Symptom → associated follow-up questions
const FOLLOW_UP_MAP: Record<string, string[]> = {
  "chest pain": [
    "Is the pain radiating to left arm or jaw?",
    "Are you experiencing sweating or shortness of breath?",
    "Does the pain worsen with exertion?",
    "Have you had similar episodes before?",
  ],
  "headache": [
    "Do you have nausea or vomiting?",
    "Is there sensitivity to light?",
    "Any neck stiffness?",
    "Is the headache throbbing or constant?",
  ],
  "dizziness": [
    "Do you feel the room is spinning?",
    "Any hearing loss or ringing in ears?",
    "Do you experience blurred vision?",
    "Any recent falls or fainting?",
  ],
  "abdominal pain": [
    "Where exactly is the pain located?",
    "Any nausea, vomiting, or diarrhea?",
    "Any blood in stool?",
    "Is the pain related to meals?",
  ],
  "fever": [
    "How high is the fever?",
    "Any chills or rigors?",
    "Any rash present?",
    "Any recent travel history?",
  ],
  "cough": [
    "Is the cough dry or productive?",
    "Any blood in sputum?",
    "Any associated fever or chest pain?",
    "Duration of cough?",
  ],
  "shortness of breath": [
    "Does it occur at rest or with exertion?",
    "Any wheezing or chest tightness?",
    "Can you lie flat comfortably?",
    "Any leg swelling?",
  ],
  "dyspnea": [
    "Does it occur at rest or with exertion?",
    "Any wheezing or chest tightness?",
    "Can you lie flat comfortably?",
    "Any leg swelling?",
  ],
};

/**
 * Identify missing information based on current context.
 */
export function identifyMissingInformation(params: {
  chief_complaint: string;
  symptoms: string[];
  vitals: Record<string, unknown> | null;
  allergies: string[];
  medications: string[];
  patient_age: number | null;
  patient_sex: string | null;
}): MissingField[] {
  const missing: MissingField[] = [];

  // Critical demographic gaps
  if (params.patient_age == null) {
    missing.push({
      field: "patient_age",
      reason: "Age is required for differential diagnosis scoring",
      priority: "high",
    });
  }
  if (!params.patient_sex) {
    missing.push({
      field: "patient_sex",
      reason: "Sex is needed for sex-specific diagnoses",
      priority: "high",
    });
  }

  // Missing chief complaint
  if (!params.chief_complaint) {
    missing.push({
      field: "chief_complaint",
      reason: "Chief complaint is the primary input for diagnosis",
      priority: "high",
    });
  }

  // Missing vitals
  if (!params.vitals || Object.keys(params.vitals).length === 0) {
    missing.push({
      field: "vitals",
      reason: "Vitals are needed for clinical assessment",
      priority: "medium",
    });
  }

  // Missing allergy information
  if (params.allergies.length === 0) {
    missing.push({
      field: "allergies",
      reason: "Allergy status needed for safe prescribing",
      priority: "medium",
    });
  }

  // Symptom-specific follow-ups
  const allSymptoms = [params.chief_complaint, ...params.symptoms].filter(Boolean);
  for (const symptom of allSymptoms) {
    const lower = symptom.toLowerCase();
    const questions = FOLLOW_UP_MAP[lower];
    if (questions) {
      missing.push({
        field: `follow_up_${lower.replace(/\s+/g, "_")}`,
        reason: `Additional details needed for ${symptom}`,
        priority: "medium",
        suggested_questions: questions,
      });
    }
  }

  return missing;
}

/**
 * AI-powered context completion via edge function.
 * Returns suggested follow-up questions for the specific clinical scenario.
 */
export async function getAICompletionSuggestions(
  chiefComplaint: string,
  symptoms: string[]
): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("smart-suggestions", {
      body: {
        type: "follow_up",
        chief_complaint: chiefComplaint,
        symptoms,
      },
    });
    if (error || !data?.suggestions) return [];
    return data.suggestions;
  } catch {
    return [];
  }
}
