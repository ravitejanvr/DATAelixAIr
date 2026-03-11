import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Evidence-Weighted Confidence Model ─────────────────────
// confidence = 0.35 * graph_support
//            + 0.25 * evidence_support
//            + 0.20 * guideline_support
//            + 0.20 * data_completeness
const WEIGHTS = {
  graph_support: 0.35,
  evidence_support: 0.25,
  guideline_support: 0.20,
  data_completeness: 0.20,
};

const AUTHORITY_STRENGTH: Record<string, number> = {
  ICMR: 1.0,
  WHO: 0.95,
  NICE: 0.9,
  CDC: 0.85,
  IDSA: 0.8,
  AHA: 0.8,
  ESC: 0.8,
  ADA: 0.75,
  ACOG: 0.75,
  ATLS: 0.75,
};

function classifyConfidence(score: number): string {
  if (score >= 0.80) return "High";
  if (score >= 0.60) return "Moderate";
  if (score >= 0.40) return "Low";
  return "Very Uncertain";
}

interface Diagnosis {
  diagnosis_name?: string;
  diagnosis?: string;
  probability?: number;
  confidence?: number;
  supporting_symptoms?: string[];
  must_not_miss?: boolean;
  symptom_coverage?: string;
}

interface UncertaintyInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  differential_diagnoses: Diagnosis[];
  suggested_labs?: Array<{ test_name: string; priority?: string }>;
  guideline_sources?: string[];
  guideline_recommendations?: Array<{ authority?: string; evidence_level?: string; guideline_name?: string }>;
  evidence_citations?: Array<{ source?: string; title?: string }>;
  pubmed_citations?: any[];
  safety_flags?: string[];
  safety_score?: number;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  matched_symptoms?: string[];
  unmatched_symptoms?: string[];
  dangerous_diagnoses?: any[];
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
    const evidenceCitations = input.evidence_citations || input.pubmed_citations || [];
    const safetyFlags = input.safety_flags || [];
    const matchedSymptoms = input.matched_symptoms || [];
    const unmatchedSymptoms = input.unmatched_symptoms || [];
    const vitals = input.vitals || {};
    const dangerousDx = input.dangerous_diagnoses || [];

    // ═══════════════════════════════════════════════════════
    // COMPONENT 1: Graph Support (0.35)
    // How well do the patient's symptoms map to the knowledge graph?
    // ═══════════════════════════════════════════════════════
    const totalSymptoms = symptoms.length || 1;
    const matchedCount = matchedSymptoms.length || 0;
    const symptomMatchRatio = matchedCount / totalSymptoms;

    // Top diagnosis probability as a signal of graph confidence
    const topDxProbability = diagnoses.length > 0
      ? (diagnoses[0].probability || 0) / 100
      : 0;

    // Diagnosis count signal: having multiple plausible diagnoses = good graph coverage
    const dxCountSignal = Math.min(diagnoses.length / 3, 1.0);

    // Weighted graph support: symptom match is primary, dx probability secondary
    const graph_support = (symptomMatchRatio * 0.50) + (topDxProbability * 0.30) + (dxCountSignal * 0.20);

    // ═══════════════════════════════════════════════════════
    // COMPONENT 2: Evidence Support (0.25)
    // Citations from medical literature, PubMed, evidence sources
    // ═══════════════════════════════════════════════════════
    let evidence_support = 0;

    // Each citation adds credibility, up to a cap
    const citationCount = evidenceCitations.length;
    if (citationCount > 0) {
      evidence_support = Math.min(citationCount / 3, 1.0); // 3+ citations = full score
    }

    // If we have suggested labs that can differentiate, that's partial evidence
    if (suggestedLabs.length > 0 && evidence_support < 1.0) {
      const labBoost = Math.min(suggestedLabs.length / 4, 0.5);
      evidence_support = Math.min(evidence_support + labBoost, 1.0);
    }

    // Dangerous diagnosis detection counts as evidence strength
    if (dangerousDx.length > 0) {
      evidence_support = Math.min(evidence_support + 0.2, 1.0);
    }

    // ═══════════════════════════════════════════════════════
    // COMPONENT 3: Guideline Support (0.20)
    // Authoritative clinical guidelines backing the recommendation
    // ═══════════════════════════════════════════════════════
    let guideline_support = 0;

    const allAuthorities = [
      ...guidelineSources,
      ...guidelineRecs.map(g => g.authority || g.guideline_name || ""),
    ].filter(Boolean);

    if (allAuthorities.length > 0) {
      // Map each authority to its strength
      const strengths = allAuthorities.map(s => {
        const upper = s.toUpperCase();
        // Check for partial matches (e.g., "AHA/ACC STEMI Guidelines" → AHA)
        for (const [key, val] of Object.entries(AUTHORITY_STRENGTH)) {
          if (upper.includes(key)) return val;
        }
        return 0.5; // Unknown authority still counts
      });

      // Use max authority strength (strongest guideline matters most)
      const maxStrength = Math.max(...strengths);
      // Coverage: how many guidelines matched
      const coverageBonus = Math.min((strengths.length - 1) * 0.1, 0.2);

      guideline_support = Math.min(maxStrength + coverageBonus, 1.0);
    }

    // Evidence level boost (A > B > C)
    const evidenceLevels = guidelineRecs
      .map(g => (g.evidence_level || "").toUpperCase())
      .filter(Boolean);
    if (evidenceLevels.includes("A")) {
      guideline_support = Math.min(guideline_support + 0.1, 1.0);
    }

    // ═══════════════════════════════════════════════════════
    // COMPONENT 4: Data Completeness (0.20)
    // Presence of vitals, labs, history, allergies
    // ═══════════════════════════════════════════════════════
    let completenessChecks = 0;
    let completenessTotal = 0;

    // Vitals (5 checks)
    const vitalChecks = ["temperature", "spo2", "pulse", "bp_systolic", "respiratory_rate"];
    for (const v of vitalChecks) {
      completenessTotal++;
      if (vitals[v] != null) completenessChecks++;
    }

    // History
    completenessTotal++;
    if (input.medical_history && input.medical_history.length > 0) completenessChecks++;

    // Allergies
    completenessTotal++;
    if (input.allergies && input.allergies.length > 0) completenessChecks++;

    // Current medications
    completenessTotal++;
    if (input.current_medications && input.current_medications.length > 0) completenessChecks++;

    // Symptoms provided
    completenessTotal++;
    if (symptoms.length > 0) completenessChecks++;

    const data_completeness = completenessChecks / completenessTotal;

    // ═══════════════════════════════════════════════════════
    // FINAL CONFIDENCE SCORE
    // ═══════════════════════════════════════════════════════
    let confidence_score =
      (WEIGHTS.graph_support * graph_support) +
      (WEIGHTS.evidence_support * evidence_support) +
      (WEIGHTS.guideline_support * guideline_support) +
      (WEIGHTS.data_completeness * data_completeness);

    // Clamp and round
    confidence_score = Math.max(0, Math.min(1, confidence_score));
    confidence_score = Math.round(confidence_score * 100) / 100;

    const confidence_label = classifyConfidence(confidence_score);

    // ─── Missing evidence gaps ────────────────────────────
    const missing_evidence: string[] = [];
    if (matchedCount === 0 && symptoms.length > 0) missing_evidence.push("No symptoms matched in knowledge graph");
    if (unmatchedSymptoms.length > 0) missing_evidence.push(`${unmatchedSymptoms.length} symptom(s) not mapped in knowledge graph`);
    if (!vitals.temperature) missing_evidence.push("Temperature not recorded");
    if (!vitals.spo2) missing_evidence.push("SpO2 not recorded");
    if (!vitals.pulse) missing_evidence.push("Pulse not recorded");
    if (!vitals.bp_systolic) missing_evidence.push("Blood pressure not recorded");
    if (!input.medical_history?.length) missing_evidence.push("Medical history not provided");
    if (!input.allergies?.length) missing_evidence.push("Allergy information not provided");
    if (citationCount === 0) missing_evidence.push("No evidence citations available");
    if (allAuthorities.length === 0) missing_evidence.push("No guideline sources matched");

    // ─── Diagnostic conflict detection ────────────────────
    let diagnostic_conflict = false;
    const conflict_details: string[] = [];
    if (diagnoses.length >= 2) {
      const topProb = diagnoses[0].probability || 0;
      const secondProb = diagnoses[1].probability || 0;
      if (topProb > 0 && secondProb > 0 && (topProb - secondProb) < 15) {
        diagnostic_conflict = true;
        conflict_details.push(
          `Close differential: ${diagnoses[0].diagnosis_name || diagnoses[0].diagnosis} (${topProb}%) vs ${diagnoses[1].diagnosis_name || diagnoses[1].diagnosis} (${secondProb}%)`
        );
      }
    }
    if (safetyFlags.length > 0) {
      diagnostic_conflict = true;
      conflict_details.push(`${safetyFlags.length} safety flag(s) active`);
    }

    // ─── Build output ─────────────────────────────────────
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
      guideline_sources: allAuthorities,
      safety_flags: safetyFlags,
      scoring_breakdown: {
        graph_support: Math.round(graph_support * 100) / 100,
        evidence_support: Math.round(evidence_support * 100) / 100,
        guideline_support: Math.round(guideline_support * 100) / 100,
        data_completeness: Math.round(data_completeness * 100) / 100,
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
