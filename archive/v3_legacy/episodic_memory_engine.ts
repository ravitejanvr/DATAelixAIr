/**
 * Episodic Memory Engine — Cognitive Layer
 *
 * Stores completed consultation cases as episodic memories and retrieves
 * the most similar past cases for a given symptom vector using Jaccard
 * similarity. Runs asynchronously after consultation completion.
 *
 * This complements the existing episodic_memory/client.ts (which queries
 * the edge function for patient/doctor/clinic memory) by providing a
 * case-level similarity search over the episodic_case_memory table.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface EpisodicCase {
  id: string;
  visit_id: string | null;
  symptom_vector: string[];
  chief_complaint: string | null;
  final_diagnosis: string | null;
  ai_top_diagnosis: string | null;
  was_ai_correct: boolean | null;
  organ_system: string | null;
  confidence_score: number | null;
  outcome_status: string;
  patient_age: number | null;
  patient_sex: string | null;
  created_at: string;
  similarity?: number;
}

export interface StoreCaseInput {
  visit_id?: string;
  patient_id: string;
  clinic_id: string;
  doctor_id: string;
  symptom_vector: string[];
  chief_complaint?: string;
  final_diagnosis?: string;
  final_diagnosis_id?: string;
  ai_top_diagnosis?: string;
  was_ai_correct?: boolean;
  organ_system?: string;
  confidence_score?: number;
  differential_diagnoses?: any[];
  patient_age?: number;
  patient_sex?: string;
}

// ── Similarity ──

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── Public API ──

/**
 * Store a completed consultation as an episodic case memory.
 * Called asynchronously after consultation finalization.
 */
export async function storeEpisodicCase(input: StoreCaseInput): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("episodic_case_memory" as any)
      .insert({
        visit_id: input.visit_id || null,
        patient_id: input.patient_id,
        clinic_id: input.clinic_id,
        doctor_id: input.doctor_id,
        symptom_vector: input.symptom_vector,
        chief_complaint: input.chief_complaint || null,
        final_diagnosis: input.final_diagnosis || null,
        final_diagnosis_id: input.final_diagnosis_id || null,
        ai_top_diagnosis: input.ai_top_diagnosis || null,
        was_ai_correct: input.was_ai_correct ?? null,
        organ_system: input.organ_system || null,
        confidence_score: input.confidence_score ?? null,
        differential_diagnoses: input.differential_diagnoses || [],
        patient_age: input.patient_age ?? null,
        patient_sex: input.patient_sex || null,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("[EpisodicMemoryEngine] Store failed:", error);
      return null;
    }
    return (data as any)?.id || null;
  } catch (e) {
    console.error("[EpisodicMemoryEngine] Error:", e);
    return null;
  }
}

/**
 * Retrieve the top-K most similar past cases from the clinic's episodic memory.
 * Uses client-side Jaccard similarity on symptom vectors.
 * Target: <100ms for typical clinic volumes.
 */
export async function retrieveSimilarCases(
  clinicId: string,
  symptoms: string[],
  topK = 5,
  organSystem?: string,
): Promise<EpisodicCase[]> {
  try {
    let query = supabase
      .from("episodic_case_memory" as any)
      .select("*")
      .eq("clinic_id", clinicId)
      .not("final_diagnosis", "is", null)
      .order("created_at", { ascending: false })
      .limit(200); // Pull recent cases for similarity ranking

    if (organSystem) {
      query = query.eq("organ_system", organSystem);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    const scored = (data as any[]).map(c => ({
      ...c,
      similarity: jaccardSimilarity(symptoms, c.symptom_vector || []),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK).filter(c => c.similarity > 0.1);
  } catch (e) {
    console.error("[EpisodicMemoryEngine] Retrieval error:", e);
    return [];
  }
}

/**
 * Build prior boosts from similar past cases.
 * Returns Map<diagnosis_lower, multiplier>.
 */
export function buildCasePriors(cases: EpisodicCase[]): Map<string, number> {
  const priors = new Map<string, number>();
  if (cases.length === 0) return priors;

  for (const c of cases) {
    if (!c.final_diagnosis) continue;
    const key = c.final_diagnosis.toLowerCase();
    const boost = Math.min(1.3, 1.0 + (c.similarity || 0) * 0.4);
    priors.set(key, Math.max(priors.get(key) || 1.0, boost));
  }

  return priors;
}
