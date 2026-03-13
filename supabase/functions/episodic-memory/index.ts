/**
 * Episodic Memory Engine — Edge Function
 *
 * Three memory axes:
 *   1. Patient Longitudinal Memory — past visits, diagnoses, treatments, outcomes
 *   2. Doctor Pattern Memory — individual doctor's diagnostic tendencies & preferences
 *   3. Cross-Patient Epidemiological Memory — clinic-level symptom clusters & outbreak detection
 *
 * Deterministic, graph-based. No LLM. Target: <300ms.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EpisodicMemoryInput {
  patient_id?: string;
  doctor_id?: string;
  clinic_id?: string;
  symptoms: string[];
  chief_complaint?: string;
  patient_age?: number | null;
  patient_sex?: string | null;
}

// ── Patient Longitudinal Memory ──

interface PastVisitSummary {
  visit_id: string;
  visit_date: string;
  chief_complaint: string | null;
  diagnoses: string[];
  medications_prescribed: string[];
  outcome_status: string | null;
  days_since: number;
}

interface PatientMemory {
  total_past_visits: number;
  visits: PastVisitSummary[];
  recurring_conditions: Array<{ condition: string; frequency: number }>;
  chronic_medications: string[];
  past_adverse_reactions: string[];
  longitudinal_risk_signals: string[];
}

// ── Doctor Pattern Memory ──

interface DoctorPattern {
  top_diagnoses: Array<{ diagnosis: string; frequency: number }>;
  correction_rate: number;
  preferred_medications: string[];
  avg_consultation_duration_days: number | null;
  diagnostic_tendencies: string[];
}

// ── Cross-Patient Epidemiological Memory ──

interface EpidemiologicalSignal {
  symptom_cluster: string[];
  patient_count: number;
  first_seen: string;
  last_seen: string;
  common_diagnosis: string | null;
  alert_level: "none" | "watch" | "elevated" | "outbreak";
}

interface CrossPatientMemory {
  recent_symptom_clusters: EpidemiologicalSignal[];
  clinic_prevalence: Array<{ diagnosis: string; count_last_30d: number }>;
  seasonal_alerts: string[];
}

// ── Combined Result ──

interface EpisodicMemoryResult {
  patient_memory: PatientMemory | null;
  doctor_patterns: DoctorPattern | null;
  cross_patient: CrossPatientMemory | null;
  execution_ms: number;
  memory_signals: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = performance.now();

  try {
    const input: EpisodicMemoryInput = await req.json();
    const { patient_id, doctor_id, clinic_id, symptoms, chief_complaint, patient_age, patient_sex } = input;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const memorySignals: string[] = [];

    // ═══════════════════════════════════════════
    // 1. PATIENT LONGITUDINAL MEMORY
    // ═══════════════════════════════════════════
    let patientMemory: PatientMemory | null = null;
    if (patient_id) {
      // Past visits with consultations
      const { data: pastVisits } = await supabase
        .from("patient_visits")
        .select(`
          id, check_in_time, status, chief_complaint,
          consultations(
            soap_assessment, drug_recommendations, 
            tests_ordered, status
          )
        `)
        .eq("patient_id", patient_id)
        .order("check_in_time", { ascending: false })
        .limit(20);

      // Past outcomes
      const { data: outcomes } = await supabase
        .from("outcome_feedback")
        .select("ai_diagnosis, doctor_final_diagnosis, outcome_status, days_to_resolution, visit_id, created_at")
        .eq("patient_id", patient_id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Past prescriptions for chronic medication detection
      const { data: prescriptions } = await supabase
        .from("prescriptions")
        .select("generic_name, created_at")
        .eq("patient_id", patient_id)
        .order("created_at", { ascending: false })
        .limit(50);

      // Past clinical alerts (adverse reactions)
      const { data: alerts } = await supabase
        .from("clinical_alerts")
        .select("title, category, severity, created_at")
        .eq("patient_id", patient_id)
        .in("category", ["allergy", "adverse_reaction", "drug_interaction"])
        .limit(10);

      const now = Date.now();
      const visits: PastVisitSummary[] = (pastVisits || []).map((v: any) => {
        const consultDiagnoses = (v.consultations || [])
          .map((c: any) => c.soap_assessment)
          .filter(Boolean);
        const medsRaw = (v.consultations || [])
          .flatMap((c: any) => {
            const recs = c.drug_recommendations;
            if (Array.isArray(recs)) return recs.map((r: any) => r.generic_name || r.name || "");
            return [];
          })
          .filter(Boolean);
        const outcomeMatch = (outcomes || []).find((o: any) => o.visit_id === v.id);

        return {
          visit_id: v.id,
          visit_date: v.check_in_time,
          chief_complaint: v.chief_complaint,
          diagnoses: consultDiagnoses,
          medications_prescribed: [...new Set(medsRaw)],
          outcome_status: outcomeMatch?.outcome_status || null,
          days_since: Math.round((now - new Date(v.check_in_time).getTime()) / 86400000),
        };
      });

      // Detect recurring conditions (same chief complaint or diagnosis ≥2 times)
      const conditionCounts: Record<string, number> = {};
      for (const v of visits) {
        if (v.chief_complaint) {
          const key = v.chief_complaint.toLowerCase().trim();
          conditionCounts[key] = (conditionCounts[key] || 0) + 1;
        }
        for (const d of v.diagnoses) {
          const key = d.toLowerCase().trim();
          conditionCounts[key] = (conditionCounts[key] || 0) + 1;
        }
      }
      const recurringConditions = Object.entries(conditionCounts)
        .filter(([, count]) => count >= 2)
        .map(([condition, frequency]) => ({ condition, frequency }))
        .sort((a, b) => b.frequency - a.frequency);

      // Chronic medications (prescribed ≥3 times)
      const medCounts: Record<string, number> = {};
      for (const p of prescriptions || []) {
        const key = (p.generic_name || "").toLowerCase();
        if (key) medCounts[key] = (medCounts[key] || 0) + 1;
      }
      const chronicMedications = Object.entries(medCounts)
        .filter(([, c]) => c >= 3)
        .map(([name]) => name);

      // Adverse reactions from alerts
      const pastAdverseReactions = (alerts || []).map((a: any) => a.title);

      // Longitudinal risk signals
      const riskSignals: string[] = [];
      if (recurringConditions.length > 0) {
        riskSignals.push(`Recurring: ${recurringConditions.map(r => `${r.condition} (×${r.frequency})`).join(", ")}`);
        memorySignals.push(`patient_recurring_conditions:${recurringConditions.length}`);
      }
      if (chronicMedications.length > 0) {
        riskSignals.push(`Chronic medications: ${chronicMedications.join(", ")}`);
        memorySignals.push(`chronic_medications:${chronicMedications.length}`);
      }
      if (pastAdverseReactions.length > 0) {
        riskSignals.push(`Past adverse reactions: ${pastAdverseReactions.length}`);
        memorySignals.push(`adverse_reactions:${pastAdverseReactions.length}`);
      }

      // Check if current complaint matches a recurring condition
      if (chief_complaint) {
        const ccLower = chief_complaint.toLowerCase();
        const matchingRecurrence = recurringConditions.find(r => 
          ccLower.includes(r.condition) || r.condition.includes(ccLower)
        );
        if (matchingRecurrence) {
          riskSignals.push(`⚠ Current complaint "${chief_complaint}" is a recurrence (×${matchingRecurrence.frequency})`);
          memorySignals.push(`current_complaint_recurrence:${matchingRecurrence.frequency}`);
        }
      }

      patientMemory = {
        total_past_visits: visits.length,
        visits: visits.slice(0, 10), // Cap to 10 most recent
        recurring_conditions: recurringConditions,
        chronic_medications: chronicMedications,
        past_adverse_reactions: pastAdverseReactions,
        longitudinal_risk_signals: riskSignals,
      };
    }

    // ═══════════════════════════════════════════
    // 2. DOCTOR PATTERN MEMORY
    // ═══════════════════════════════════════════
    let doctorPatterns: DoctorPattern | null = null;
    if (doctor_id) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      // Doctor's recent consultations for diagnosis patterns
      const { data: recentConsults } = await supabase
        .from("consultations")
        .select("soap_assessment, drug_recommendations, created_at")
        .eq("doctor_id", doctor_id)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(100);

      // Doctor's learning signals (corrections)
      const { data: corrections } = await supabase
        .from("doctor_learning_signals")
        .select("signal_type, signal_data, created_at")
        .eq("doctor_id", doctor_id)
        .eq("signal_type", "diagnostic_correction")
        .gte("created_at", thirtyDaysAgo)
        .limit(50);

      // Doctor favorites (preferred medications)
      const { data: favorites } = await supabase
        .from("doctor_favorites")
        .select("generic_name")
        .eq("doctor_id", doctor_id)
        .limit(20);

      // Diagnosis frequency
      const diagCounts: Record<string, number> = {};
      for (const c of recentConsults || []) {
        if (c.soap_assessment) {
          const key = c.soap_assessment.toLowerCase().trim().slice(0, 100);
          diagCounts[key] = (diagCounts[key] || 0) + 1;
        }
      }
      const topDiagnoses = Object.entries(diagCounts)
        .map(([diagnosis, frequency]) => ({ diagnosis, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);

      const totalConsults = (recentConsults || []).length;
      const correctionCount = (corrections || []).length;
      const correctionRate = totalConsults > 0 ? correctionCount / totalConsults : 0;

      const preferredMeds = (favorites || []).map((f: any) => f.generic_name);

      // Detect diagnostic tendencies
      const tendencies: string[] = [];
      if (correctionRate > 0.3) {
        tendencies.push("high_correction_rate");
        memorySignals.push("doctor_high_correction_rate");
      }
      if (topDiagnoses.length > 0 && topDiagnoses[0].frequency > totalConsults * 0.3) {
        tendencies.push(`frequent_diagnosis:${topDiagnoses[0].diagnosis}`);
      }

      doctorPatterns = {
        top_diagnoses: topDiagnoses,
        correction_rate: Math.round(correctionRate * 100) / 100,
        preferred_medications: preferredMeds,
        avg_consultation_duration_days: null,
        diagnostic_tendencies: tendencies,
      };
      memorySignals.push(`doctor_consults_30d:${totalConsults}`);
    }

    // ═══════════════════════════════════════════
    // 3. CROSS-PATIENT EPIDEMIOLOGICAL MEMORY
    // ═══════════════════════════════════════════
    let crossPatient: CrossPatientMemory | null = null;
    if (clinic_id && symptoms.length > 0) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      // Recent visits with similar chief complaints at same clinic
      const { data: recentVisits } = await supabase
        .from("patient_visits")
        .select("chief_complaint, check_in_time, id")
        .eq("clinic_id", clinic_id)
        .gte("check_in_time", sevenDaysAgo)
        .order("check_in_time", { ascending: false })
        .limit(200);

      // Recent consultations at this clinic for diagnosis prevalence
      const { data: recentDiagnoses } = await supabase
        .from("consultations")
        .select("soap_assessment, created_at")
        .eq("clinic_id", clinic_id)
        .gte("created_at", thirtyDaysAgo)
        .not("soap_assessment", "is", null)
        .limit(200);

      // Symptom cluster detection
      const symptomLower = symptoms.map(s => s.toLowerCase().trim());
      const matchingVisits = (recentVisits || []).filter((v: any) => {
        if (!v.chief_complaint) return false;
        const cc = v.chief_complaint.toLowerCase();
        return symptomLower.some(s => cc.includes(s));
      });

      const clusters: EpidemiologicalSignal[] = [];
      if (matchingVisits.length >= 3) {
        const dates = matchingVisits.map((v: any) => v.check_in_time).sort();
        let alertLevel: "none" | "watch" | "elevated" | "outbreak" = "none";
        if (matchingVisits.length >= 10) alertLevel = "outbreak";
        else if (matchingVisits.length >= 6) alertLevel = "elevated";
        else if (matchingVisits.length >= 3) alertLevel = "watch";

        clusters.push({
          symptom_cluster: symptomLower.slice(0, 5),
          patient_count: matchingVisits.length,
          first_seen: dates[0],
          last_seen: dates[dates.length - 1],
          common_diagnosis: null,
          alert_level: alertLevel,
        });

        memorySignals.push(`symptom_cluster:${matchingVisits.length}:${alertLevel}`);
      }

      // Diagnosis prevalence last 30 days
      const diagPrev: Record<string, number> = {};
      for (const c of recentDiagnoses || []) {
        if (c.soap_assessment) {
          const key = c.soap_assessment.toLowerCase().trim().slice(0, 80);
          diagPrev[key] = (diagPrev[key] || 0) + 1;
        }
      }
      const clinicPrevalence = Object.entries(diagPrev)
        .map(([diagnosis, count_last_30d]) => ({ diagnosis, count_last_30d }))
        .sort((a, b) => b.count_last_30d - a.count_last_30d)
        .slice(0, 10);

      // Seasonal alerts (simple heuristic)
      const seasonalAlerts: string[] = [];
      const month = new Date().getMonth();
      if (month >= 5 && month <= 9) {
        // Monsoon season (India) — dengue, malaria, leptospirosis
        const monsoonDx = clinicPrevalence.filter(p =>
          ["dengue", "malaria", "leptospirosis", "viral fever"].some(d => p.diagnosis.includes(d))
        );
        if (monsoonDx.length > 0) {
          seasonalAlerts.push(`Monsoon-season spike: ${monsoonDx.map(d => d.diagnosis).join(", ")}`);
          memorySignals.push("seasonal_monsoon_alert");
        }
      }
      if (month >= 10 || month <= 1) {
        // Winter — respiratory infections
        const winterDx = clinicPrevalence.filter(p =>
          ["upper respiratory", "pneumonia", "bronchitis", "influenza"].some(d => p.diagnosis.includes(d))
        );
        if (winterDx.length > 0) {
          seasonalAlerts.push(`Winter respiratory surge: ${winterDx.map(d => d.diagnosis).join(", ")}`);
          memorySignals.push("seasonal_winter_respiratory");
        }
      }

      crossPatient = {
        recent_symptom_clusters: clusters,
        clinic_prevalence: clinicPrevalence,
        seasonal_alerts: seasonalAlerts,
      };
    }

    const executionMs = Math.round(performance.now() - startMs);

    const result: EpisodicMemoryResult = {
      patient_memory: patientMemory,
      doctor_patterns: doctorPatterns,
      cross_patient: crossPatient,
      execution_ms: executionMs,
      memory_signals: memorySignals,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[episodic-memory] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, execution_ms: Math.round(performance.now() - startMs) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
