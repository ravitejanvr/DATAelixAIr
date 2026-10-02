/**
 * Patient History — client-side fetch.
 *
 * Reuses the exact query shape already proven in src/pages/PatientDetail.tsx
 * (patients row + consultations by patient_id), shaped into a plain summary
 * for reasoning context. Returns null fast when there's nothing to add —
 * this must be a cheap no-op for the common case of a patient with no
 * consultation history yet.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PatientHistorySummary, RecentConsultationSummary } from "./types";

const RECENT_CONSULTATIONS_LIMIT = 3;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export async function getPatientHistorySummary(
  patientId: string,
): Promise<PatientHistorySummary | null> {
  const [patientRes, consultRes] = await Promise.all([
    supabase
      .from("patients")
      .select("allergies, current_medications, medical_history")
      .eq("id", patientId)
      .maybeSingle(),
    supabase
      .from("consultations")
      .select("chief_complaint, ai_summary, soap_assessment, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(RECENT_CONSULTATIONS_LIMIT),
  ]);

  if (patientRes.error) {
    console.error("[PatientHistory] Fetch error:", patientRes.error);
    return null;
  }
  if (consultRes.error) {
    console.error("[PatientHistory] Consultations fetch error:", consultRes.error);
  }

  const consultations = consultRes.data ?? [];
  if (consultations.length === 0 && !patientRes.data) {
    return null;
  }

  const recent_consultations: RecentConsultationSummary[] = consultations.map((c) => ({
    date: c.created_at,
    chief_complaint: c.chief_complaint,
    summary: c.ai_summary ?? c.soap_assessment,
  }));

  return {
    allergies: asStringArray(patientRes.data?.allergies),
    current_medications: asStringArray(patientRes.data?.current_medications),
    medical_history: asStringArray(patientRes.data?.medical_history),
    recent_consultations,
  };
}
