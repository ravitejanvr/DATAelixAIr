/**
 * Evidence Planner — Cognitive Layer
 *
 * Wraps the existing evidence_planning engine and persists information
 * gain calculations to the diagnostic_information_gain table for
 * longitudinal learning about which tests proved most discriminative.
 */

import { supabase } from "@/integrations/supabase/client";
import { planEvidence, type EvidencePlanResult, type EvidencePlanInput } from "@/services/evidence_planning/client";

// ── Types ──

export interface EvidencePlanWithPersistence extends EvidencePlanResult {
  persisted: boolean;
}

// ── Public API ──

/**
 * Plan optimal investigations and persist the information gain data.
 */
export async function planAndPersistEvidence(
  input: EvidencePlanInput,
  clinicId: string,
  visitId?: string,
): Promise<EvidencePlanWithPersistence | null> {
  const result = await planEvidence(input);
  if (!result) return null;

  // Persist each planned test's information gain
  let persisted = false;
  try {
    const rows = result.planned_tests.map(t => ({
      visit_id: visitId || null,
      clinic_id: clinicId,
      test_name: t.test_name,
      test_category: t.category,
      information_gain: t.information_gain,
      discrimination_score: t.discrimination_score,
      differentiates_between: t.differentiates_between,
      supports_diagnoses: t.supports_diagnoses,
      rules_out_diagnoses: t.rules_out_diagnoses,
      priority: t.priority,
      was_ordered: false,
    }));

    if (rows.length > 0) {
      await supabase.from("diagnostic_information_gain" as any).insert(rows as any);
      persisted = true;
    }
  } catch (e) {
    console.warn("[EvidencePlanner] Persist failed:", e);
  }

  return { ...result, persisted };
}

/**
 * Mark a test as ordered (for feedback loop).
 */
export async function markTestOrdered(
  clinicId: string,
  testName: string,
  visitId?: string,
): Promise<void> {
  try {
    let query = supabase
      .from("diagnostic_information_gain" as any)
      .update({ was_ordered: true } as any)
      .eq("clinic_id", clinicId)
      .eq("test_name", testName);

    if (visitId) {
      query = query.eq("visit_id", visitId);
    }

    await query;
  } catch (e) {
    console.warn("[EvidencePlanner] Mark ordered failed:", e);
  }
}

/**
 * Get historical test effectiveness for a clinic.
 * Shows which tests were most frequently recommended and ordered.
 */
export async function getTestEffectiveness(
  clinicId: string,
  lookbackDays = 90,
): Promise<Array<{ test_name: string; recommended_count: number; ordered_count: number; avg_information_gain: number }>> {
  try {
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    const { data, error } = await supabase
      .from("diagnostic_information_gain" as any)
      .select("test_name, information_gain, was_ordered")
      .eq("clinic_id", clinicId)
      .gte("created_at", since);

    if (error || !data) return [];

    const grouped = new Map<string, { rec: number; ord: number; gainSum: number }>();
    for (const d of data as any[]) {
      const entry = grouped.get(d.test_name) || { rec: 0, ord: 0, gainSum: 0 };
      entry.rec++;
      if (d.was_ordered) entry.ord++;
      entry.gainSum += d.information_gain || 0;
      grouped.set(d.test_name, entry);
    }

    return Array.from(grouped.entries())
      .map(([test_name, e]) => ({
        test_name,
        recommended_count: e.rec,
        ordered_count: e.ord,
        avg_information_gain: e.rec > 0 ? e.gainSum / e.rec : 0,
      }))
      .sort((a, b) => b.recommended_count - a.recommended_count);
  } catch {
    return [];
  }
}
