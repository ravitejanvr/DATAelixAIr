/**
 * Episodic Memory Client
 *
 * Typed client for the episodic-memory edge function with
 * session-level caching (30-minute TTL).
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface PastVisitSummary {
  visit_id: string;
  visit_date: string;
  chief_complaint: string | null;
  diagnoses: string[];
  medications_prescribed: string[];
  outcome_status: string | null;
  days_since: number;
}

export interface PatientMemory {
  total_past_visits: number;
  visits: PastVisitSummary[];
  recurring_conditions: Array<{ condition: string; frequency: number }>;
  chronic_medications: string[];
  past_adverse_reactions: string[];
  longitudinal_risk_signals: string[];
}

export interface DoctorPattern {
  top_diagnoses: Array<{ diagnosis: string; frequency: number }>;
  correction_rate: number;
  preferred_medications: string[];
  avg_consultation_duration_days: number | null;
  diagnostic_tendencies: string[];
}

export interface EpidemiologicalSignal {
  symptom_cluster: string[];
  patient_count: number;
  first_seen: string;
  last_seen: string;
  common_diagnosis: string | null;
  alert_level: "none" | "watch" | "elevated" | "outbreak";
}

export interface CrossPatientMemory {
  recent_symptom_clusters: EpidemiologicalSignal[];
  clinic_prevalence: Array<{ diagnosis: string; count_last_30d: number }>;
  seasonal_alerts: string[];
}

export interface EpisodicMemoryResult {
  patient_memory: PatientMemory | null;
  doctor_patterns: DoctorPattern | null;
  cross_patient: CrossPatientMemory | null;
  execution_ms: number;
  memory_signals: string[];
}

export interface EpisodicMemoryInput {
  patient_id?: string;
  doctor_id?: string;
  clinic_id?: string;
  symptoms: string[];
  chief_complaint?: string;
  patient_age?: number | null;
  patient_sex?: string | null;
}

// ── Session Cache ──

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map<string, { result: EpisodicMemoryResult; timestamp: number }>();

function cacheKey(input: EpisodicMemoryInput): string {
  return `${input.patient_id || ""}:${input.doctor_id || ""}:${input.clinic_id || ""}:${input.symptoms.sort().join(",")}`;
}

// ── Public API ──

export async function queryEpisodicMemory(
  input: EpisodicMemoryInput,
): Promise<EpisodicMemoryResult> {
  const key = cacheKey(input);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log("[EpisodicMemory] Cache hit");
    return cached.result;
  }

  const { data, error } = await supabase.functions.invoke("episodic-memory", {
    body: input,
  });

  if (error) throw new Error(`Episodic memory failed: ${error.message}`);

  const result = data as EpisodicMemoryResult;
  cache.set(key, { result, timestamp: Date.now() });
  return result;
}

/**
 * Extract diagnostic priors boost from episodic memory.
 * Returns a map of diagnosis_name → multiplier based on:
 *   - Patient recurrence (boosts recurring conditions)
 *   - Clinic prevalence (boosts locally common diagnoses)
 *   - Doctor patterns (slight boost for doctor's frequent diagnoses)
 */
export function buildEpisodicPriors(
  memory: EpisodicMemoryResult,
): Map<string, number> {
  const priors = new Map<string, number>();

  // Patient recurrences → strong boost (1.2-1.4x)
  if (memory.patient_memory) {
    for (const r of memory.patient_memory.recurring_conditions) {
      const key = r.condition.toLowerCase();
      const boost = Math.min(1.4, 1.0 + r.frequency * 0.1);
      priors.set(key, Math.max(priors.get(key) || 1.0, boost));
    }
  }

  // Clinic prevalence → mild boost (1.05-1.15x)
  if (memory.cross_patient) {
    for (const p of memory.cross_patient.clinic_prevalence.slice(0, 5)) {
      const key = p.diagnosis.toLowerCase();
      const boost = Math.min(1.15, 1.0 + p.count_last_30d * 0.005);
      if (!priors.has(key)) priors.set(key, boost);
    }
  }

  // Doctor's frequent diagnoses → minimal boost (1.03x) to avoid anchoring bias
  if (memory.doctor_patterns) {
    for (const d of memory.doctor_patterns.top_diagnoses.slice(0, 3)) {
      const key = d.diagnosis.toLowerCase();
      if (!priors.has(key)) priors.set(key, 1.03);
    }
  }

  return priors;
}
