import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Weights ────────────────────────────────────────────────
const WEIGHTS = {
  symptom_match: 0.35,
  vital_support: 0.15,
  guideline_strength: 0.20,
  lab_confirmation: 0.20,
  missing_data_penalty: 0.05,
  conflict_penalty: 0.05,
};

// ─── Authority strength map ─────────────────────────────────
const AUTHORITY_STRENGTH: Record<string, number> = {
  WHO: 1.0,
  NICE: 0.9,
  ICMR: 0.8,
  CDC: 0.75,
  IDSA: 0.7,
  AHA: 0.7,
  ESC: 0.7,
  ADA: 0.7,
};

function classifyConfidence(score: number): string {
  if (score > 0.75) return "High";
  if (score >= 0.50) return "Moderate";
  if (score >= 0.25) return "Low";
  return "Very Uncertain";
}

interface Diagnosis {
  diagnosis_name?: string;
  diagnosis?: string;
  probability?: number;
  confidence?: number;
  supporting_symptoms?: string[];
  must_not_miss?: boolean;
}

interface UncertaintyInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  differential_diagnoses: Diagnosis[];
  suggested_labs?: Array<{ test_name: string; priority?: string }>;
  guideline_sources?: string[];
  guideline_recommendations?: Array<{ authority?: string; evidence_level?: string }>;
  safety_flags?: string[];
  safety_score?: number;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  matched_symptoms?: string[];
  unmatched_symptoms?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input: UncertaintyInput = await req.json();
    const startMs = performance.now();

    const symptoms = input.symptoms || [];
    const diagnoses = input.differential_diagnoses || [];
    const suggestedLabs = input.suggested_labs || [];
    const guidelineSources = input.guideline_sources || [];
    const guidelineRecs = input.guideline_recommendations || [];
    const safetyFlags = input.safety_flags || [];
    const matchedSymptoms = input.matched_symptoms || [];
    const unmatchedSymptoms = input.unmatched_symptoms || [];
    const vitals = input.vitals || {};

    // ─── 1. Symptom match score ───────────────────────────
    const totalSymptoms = symptoms.length || 1;
    const matchedCount = matchedSymptoms.length || Math.min(symptoms.length, diagnoses.length > 0 ? symptoms.length : 0);
    const symptom_match_score = matchedCount / totalSymptoms;

    // ─── 2. Vital support score ───────────────────────────
    let vital_support_score = 0;
    const vitalKeys = Object.keys(vitals).filter(k => vitals[k] != null);
    const expectedVitals = ["temperature", "spo2", "pulse", "bp", "bp_systolic", "bp_diastolic"];
    const presentVitals = expectedVitals.filter(v => vitals[v] != null);
    vital_support_score = presentVitals.length / Math.max(expectedVitals.length, 1);

    // ─── 3. Guideline strength score ──────────────────────
    let guideline_score = 0;
    if (guidelineSources.length > 0 || guidelineRecs.length > 0) {
      const sources = guidelineSources.length > 0 ? guidelineSources : guidelineRecs.map(g => g.authority || "");
      const strengths = sources
        .map(s => AUTHORITY_STRENGTH[s.toUpperCase()] || 0.5)
        .filter(s => s > 0);
      guideline_score = strengths.length > 0
        ? strengths.reduce((a, b) => a + b, 0) / strengths.length
        : 0;
    }

    // ─── 4. Lab confirmation score ────────────────────────
    // Higher if labs are available that can confirm top diagnoses
    const lab_confirmation_score = suggestedLabs.length > 0
      ? Math.min(suggestedLabs.length / 3, 1) * 0.5  // Labs suggested but not yet confirmed = partial
      : 0;

    // ─── 5. Missing data detection ────────────────────────
    const missing_evidence: string[] = [];
    if (!vitals.temperature && !vitals.temp) missing_evidence.push("Temperature not recorded");
    if (!vitals.spo2) missing_evidence.push("SpO2 not recorded");
    if (!vitals.pulse) missing_evidence.push("Pulse not recorded");
    if (!vitals.bp && !vitals.bp_systolic) missing_evidence.push("Blood pressure not recorded");
    if (!input.medical_history?.length) missing_evidence.push("Medical history not provided");
    if (!input.allergies?.length) missing_evidence.push("Allergy information not provided");
    if (!input.current_medications?.length) missing_evidence.push("Current medications not listed");
    if (unmatchedSymptoms.length > 0) missing_evidence.push(`${unmatchedSymptoms.length} symptom(s) not mapped in knowledge graph`);
    if (suggestedLabs.length > 0) {
      const highPriorityLabs = suggestedLabs.filter(l => l.priority === "essential" || l.priority === "high");
      if (highPriorityLabs.length > 0) {
        missing_evidence.push(`Lab confirmation needed: ${highPriorityLabs.map(l => l.test_name).join(", ")}`);
      }
    }
    if (guidelineSources.length === 0 && guidelineRecs.length === 0) {
      missing_evidence.push("No guideline sources matched");
    }

    const missing_data_penalty_score = Math.min(missing_evidence.length * 0.08, 1);

    // ─── 6. Conflict detection ────────────────────────────
    let diagnostic_conflict = false;
    const conflict_details: string[] = [];

    // Check if top diagnoses have contradicting categories
    if (diagnoses.length >= 2) {
      const top = diagnoses[0];
      const second = diagnoses[1];
      const topProb = top.probability || (top.confidence ? top.confidence * 100 : 0);
      const secondProb = second.probability || (second.confidence ? second.confidence * 100 : 0);
      if (topProb > 0 && secondProb > 0 && (topProb - secondProb) < 15) {
        diagnostic_conflict = true;
        conflict_details.push(`Close differential: ${top.diagnosis_name || top.diagnosis} (${topProb}%) vs ${second.diagnosis_name || second.diagnosis} (${secondProb}%)`);
      }
    }

    // Check if safety flags contradict treatment plan
    if (safetyFlags.length > 0) {
      diagnostic_conflict = true;
      conflict_details.push(`${safetyFlags.length} safety flag(s) active`);
    }

    const conflict_penalty_score = diagnostic_conflict ? Math.min(conflict_details.length * 0.15, 1) : 0;

    // ─── 7. Safety risk adjustment ────────────────────────
    const safety_penalty = safetyFlags.length > 0 ? Math.min(safetyFlags.length * 0.10, 0.30) : 0;

    // ─── 8. Compute final confidence ──────────────────────
    let confidence_score =
      (WEIGHTS.symptom_match * symptom_match_score) +
      (WEIGHTS.vital_support * vital_support_score) +
      (WEIGHTS.guideline_strength * guideline_score) +
      (WEIGHTS.lab_confirmation * lab_confirmation_score) -
      (WEIGHTS.missing_data_penalty * missing_data_penalty_score) -
      (WEIGHTS.conflict_penalty * conflict_penalty_score) -
      safety_penalty;

    // Clamp 0–1
    confidence_score = Math.max(0, Math.min(1, confidence_score));
    confidence_score = Math.round(confidence_score * 100) / 100;

    const confidence_label = classifyConfidence(confidence_score);

    // ─── 9. Build output ──────────────────────────────────
    const topDiagnosis = diagnoses[0];
    const mustNotMiss = diagnoses.filter(d => d.must_not_miss).map(d => d.diagnosis_name || d.diagnosis || "");

    const result = {
      confidence_score,
      confidence_label,
      top_diagnosis: topDiagnosis?.diagnosis_name || topDiagnosis?.diagnosis || "Unknown",
      alternative_diagnoses: diagnoses.slice(1, 4).map(d => ({
        name: d.diagnosis_name || d.diagnosis || "",
        probability: d.probability || (d.confidence ? Math.round(d.confidence * 100) : 0),
      })),
      must_not_miss: mustNotMiss,
      missing_evidence,
      diagnostic_conflict,
      conflict_details,
      guideline_sources: guidelineSources,
      safety_flags: safetyFlags,
      scoring_breakdown: {
        symptom_match: Math.round(symptom_match_score * 100) / 100,
        vital_support: Math.round(vital_support_score * 100) / 100,
        guideline_strength: Math.round(guideline_score * 100) / 100,
        lab_confirmation: Math.round(lab_confirmation_score * 100) / 100,
        missing_data_penalty: Math.round(missing_data_penalty_score * 100) / 100,
        conflict_penalty: Math.round(conflict_penalty_score * 100) / 100,
        safety_penalty: Math.round(safety_penalty * 100) / 100,
      },
      execution_ms: Math.round(performance.now() - startMs),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("uncertainty-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
