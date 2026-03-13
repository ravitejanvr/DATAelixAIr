/**
 * Supervised Learning Engine — Cognitive Layer
 *
 * Records diagnostic outcomes and doctor corrections into the
 * diagnostic_outcomes table. Computes correction signals that feed
 * back into the calibration pipeline (calibrate-priors edge function).
 *
 * Safety constraints:
 *   - No live probability updates during consultations
 *   - Updates require doctor validation + outcome confirmation
 *   - Batch calibration only (via edge function)
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface OutcomeRecord {
  visit_id?: string;
  consultation_id?: string;
  patient_id: string;
  clinic_id: string;
  doctor_id: string;
  ai_diagnosis: string;
  ai_diagnosis_id?: string;
  doctor_final_diagnosis: string;
  doctor_diagnosis_id?: string;
  confirmed_diagnosis?: string;
  confirmed_diagnosis_id?: string;
  outcome_status: string;
  days_to_resolution?: number;
  treatment_effective?: boolean;
  follow_up_required?: boolean;
  correction_type?: string;
}

export interface LearningUpdateRecord {
  clinic_id: string;
  update_type: string;
  target_entity: string;
  target_id?: string;
  old_value: number;
  new_value: number;
  delta: number;
  direction: string;
  sample_size: number;
  confidence: string;
  source: string;
  batch_id?: string;
}

// ── Similarity scoring for diagnosis correction ──

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function diagnosisSimilarity(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshteinDistance(na, nb) / maxLen;
}

// ── Public API ──

/**
 * Record a diagnostic outcome for supervised learning.
 */
export async function recordDiagnosticOutcome(input: OutcomeRecord): Promise<string | null> {
  try {
    const similarity = diagnosisSimilarity(input.ai_diagnosis, input.doctor_final_diagnosis);

    const { data, error } = await supabase
      .from("diagnostic_outcomes" as any)
      .insert({
        visit_id: input.visit_id || null,
        consultation_id: input.consultation_id || null,
        patient_id: input.patient_id,
        clinic_id: input.clinic_id,
        doctor_id: input.doctor_id,
        ai_diagnosis: input.ai_diagnosis,
        ai_diagnosis_id: input.ai_diagnosis_id || null,
        doctor_final_diagnosis: input.doctor_final_diagnosis,
        doctor_diagnosis_id: input.doctor_diagnosis_id || null,
        confirmed_diagnosis: input.confirmed_diagnosis || null,
        confirmed_diagnosis_id: input.confirmed_diagnosis_id || null,
        outcome_status: input.outcome_status,
        days_to_resolution: input.days_to_resolution ?? null,
        treatment_effective: input.treatment_effective ?? null,
        follow_up_required: input.follow_up_required ?? false,
        correction_type: input.correction_type || (similarity >= 0.85 ? "match" : "replacement"),
        similarity_score: similarity,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("[SupervisedLearning] Record failed:", error);
      return null;
    }
    return (data as any)?.id || null;
  } catch (e) {
    console.error("[SupervisedLearning] Error:", e);
    return null;
  }
}

/**
 * Record a learning update (probability adjustment) for audit trail.
 */
export async function recordLearningUpdate(input: LearningUpdateRecord): Promise<void> {
  try {
    await supabase.from("learning_updates" as any).insert({
      clinic_id: input.clinic_id,
      update_type: input.update_type,
      target_entity: input.target_entity,
      target_id: input.target_id || null,
      old_value: input.old_value,
      new_value: input.new_value,
      delta: input.delta,
      direction: input.direction,
      sample_size: input.sample_size,
      confidence: input.confidence,
      source: input.source,
      batch_id: input.batch_id || null,
    } as any);
  } catch (e) {
    console.error("[SupervisedLearning] Learning update record failed:", e);
  }
}

/**
 * Get correction rate for a clinic over a period.
 */
export async function getCorrectionRate(
  clinicId: string,
  lookbackDays = 30,
): Promise<{ total: number; corrected: number; rate: number }> {
  try {
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    const { data, error } = await supabase
      .from("diagnostic_outcomes" as any)
      .select("correction_type")
      .eq("clinic_id", clinicId)
      .gte("created_at", since);

    if (error || !data) return { total: 0, corrected: 0, rate: 0 };

    const total = (data as any[]).length;
    const corrected = (data as any[]).filter(d => d.correction_type !== "match").length;
    return { total, corrected, rate: total > 0 ? corrected / total : 0 };
  } catch {
    return { total: 0, corrected: 0, rate: 0 };
  }
}
