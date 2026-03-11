import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Uncertainty Calibration Engine v2
 * 
 * Computes calibrated confidence using:
 *   1. Evidence strength (graph support, citations, guideline authority)
 *   2. Missing data detection (vitals, history, labs)
 *   3. Conflicting signal analysis (diagnostic disagreement, safety flags, paradigm divergence)
 * 
 * Output categories: High, Moderate, Low, Very Uncertain
 */

// ─── Weighted Confidence Model ───
const WEIGHTS = {
  evidence_strength: 0.40,   // How strong is the evidence?
  data_completeness: 0.25,   // How complete is the clinical picture?
  signal_coherence: 0.35,    // How consistent are the signals?
};

// Authority strength for guideline sources
const AUTHORITY_STRENGTH: Record<string, number> = {
  ICMR: 1.0, WHO: 0.95, NICE: 0.9, CDC: 0.85,
  IDSA: 0.8, AHA: 0.8, ESC: 0.8, ADA: 0.75, ACOG: 0.75, ATLS: 0.75,
};

// Evidence level weights
const EVIDENCE_LEVEL_WEIGHT: Record<string, number> = {
  A: 1.0, IA: 1.0, IB: 0.9, B: 0.7, IIA: 0.7, IIB: 0.6, C: 0.4, III: 0.3,
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
  contradicting_factors?: string[];
  must_not_miss?: boolean;
  symptom_coverage?: string;
  paradigm_sources?: string[];
  fused_probability?: number;
}

interface UncertaintyInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  differential_diagnoses: Diagnosis[];
  suggested_labs?: Array<{ test_name: string; priority?: string }>;
  guideline_sources?: string[];
  guideline_recommendations?: Array<{ authority?: string; evidence_level?: string; guideline_name?: string }>;
  evidence_citations?: Array<{ source?: string; title?: string; evidence_strength?: string }>;
  pubmed_citations?: any[];
  safety_flags?: string[];
  safety_score?: number;
  medical_history?: string[];
  current_medications?: string[];
  allergies?: string[];
  matched_symptoms?: string[];
  unmatched_symptoms?: string[];
  dangerous_diagnoses?: any[];
  // Hybrid reasoning inputs
  paradigm_agreement?: string;
  reasoning_confidence?: string;
  conflicts?: any[];
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
    const conflicts = input.conflicts || [];

    // ═══════════════════════════════════════════════════════
    // COMPONENT 1: Evidence Strength (0.40)
    // Combines graph support, citation quality, guideline authority
    // ═══════════════════════════════════════════════════════

    // 1a: Graph support — symptom → diagnosis mapping quality
    const totalSymptoms = symptoms.length || 1;
    const matchedCount = matchedSymptoms.length || 0;
    const symptomMatchRatio = matchedCount / totalSymptoms;

    const topDxProbability = diagnoses.length > 0
      ? (diagnoses[0].probability || diagnoses[0].fused_probability || 0) / 100
      : 0;
    const dxCountSignal = Math.min(diagnoses.length / 3, 1.0);
    const graphSupport = (symptomMatchRatio * 0.50) + (topDxProbability * 0.30) + (dxCountSignal * 0.20);

    // 1b: Citation quality — weighted by evidence strength
    let citationQuality = 0;
    if (evidenceCitations.length > 0) {
      const strengthScores = evidenceCitations.map((c: any) => {
        const strength = (c.evidence_strength || "moderate").toLowerCase();
        if (strength === "strong") return 1.0;
        if (strength === "moderate") return 0.7;
        if (strength === "emerging") return 0.4;
        return 0.5;
      });
      citationQuality = Math.min(
        strengthScores.reduce((s: number, v: number) => s + v, 0) / 3, // 3 strong citations = max
        1.0
      );
    }

    // 1c: Guideline authority strength
    let guidelineStrength = 0;
    const allAuthorities = [
      ...guidelineSources,
      ...guidelineRecs.map(g => g.authority || g.guideline_name || ""),
    ].filter(Boolean);

    if (allAuthorities.length > 0) {
      const strengths = allAuthorities.map(s => {
        const upper = s.toUpperCase();
        for (const [key, val] of Object.entries(AUTHORITY_STRENGTH)) {
          if (upper.includes(key)) return val;
        }
        return 0.5;
      });
      const maxStrength = Math.max(...strengths);
      const coverageBonus = Math.min((strengths.length - 1) * 0.1, 0.2);
      guidelineStrength = Math.min(maxStrength + coverageBonus, 1.0);
    }

    // Evidence level boost
    const evidenceLevels = guidelineRecs
      .map(g => (g.evidence_level || "").toUpperCase().replace(/\s/g, ""))
      .filter(Boolean);
    const bestEvidenceLevel = evidenceLevels.reduce((best, level) => {
      const weight = EVIDENCE_LEVEL_WEIGHT[level] || 0.3;
      return Math.max(best, weight);
    }, 0);
    if (bestEvidenceLevel > 0) {
      guidelineStrength = Math.min(guidelineStrength + bestEvidenceLevel * 0.1, 1.0);
    }

    // Combined evidence strength
    const evidenceStrength = (graphSupport * 0.40) + (citationQuality * 0.30) + (guidelineStrength * 0.30);

    // ═══════════════════════════════════════════════════════
    // COMPONENT 2: Data Completeness (0.25)
    // Checks for missing vitals, history, allergies, labs
    // ═══════════════════════════════════════════════════════
    const completenessItems: Array<{ field: string; present: boolean; weight: number }> = [
      { field: "temperature", present: vitals.temperature != null, weight: 1.0 },
      { field: "spo2", present: vitals.spo2 != null, weight: 1.0 },
      { field: "pulse", present: vitals.pulse != null, weight: 1.0 },
      { field: "blood_pressure", present: vitals.bp_systolic != null || vitals.bp != null, weight: 1.0 },
      { field: "respiratory_rate", present: vitals.respiratory_rate != null, weight: 0.8 },
      { field: "medical_history", present: (input.medical_history?.length || 0) > 0, weight: 0.9 },
      { field: "allergies", present: (input.allergies?.length || 0) > 0, weight: 0.8 },
      { field: "current_medications", present: (input.current_medications?.length || 0) > 0, weight: 0.7 },
      { field: "symptoms", present: symptoms.length > 0, weight: 1.0 },
      { field: "lab_results", present: suggestedLabs.length > 0, weight: 0.6 },
    ];

    const totalWeight = completenessItems.reduce((s, i) => s + i.weight, 0);
    const presentWeight = completenessItems.filter(i => i.present).reduce((s, i) => s + i.weight, 0);
    const dataCompleteness = presentWeight / totalWeight;

    // ═══════════════════════════════════════════════════════
    // COMPONENT 3: Signal Coherence (0.35)
    // Detects conflicting signals that reduce confidence
    // ═══════════════════════════════════════════════════════
    let coherenceScore = 1.0; // Start at max, apply penalties
    const conflictDetails: string[] = [];

    // 3a: Diagnostic disagreement — top two diagnoses too close
    if (diagnoses.length >= 2) {
      const topProb = diagnoses[0].probability || diagnoses[0].fused_probability || 0;
      const secondProb = diagnoses[1].probability || diagnoses[1].fused_probability || 0;
      if (topProb > 0 && secondProb > 0 && (topProb - secondProb) < 10) {
        coherenceScore -= 0.20;
        const name1 = diagnoses[0].diagnosis_name || diagnoses[0].diagnosis || "?";
        const name2 = diagnoses[1].diagnosis_name || diagnoses[1].diagnosis || "?";
        conflictDetails.push(`Close differential: ${name1} (${topProb}%) vs ${name2} (${secondProb}%) — gap < 10%`);
      } else if (topProb > 0 && secondProb > 0 && (topProb - secondProb) < 20) {
        coherenceScore -= 0.10;
        conflictDetails.push(`Moderate differential uncertainty: gap < 20%`);
      }
    }

    // 3b: Contradicting factors present
    const totalContradictions = diagnoses.reduce((s, d) => s + (d.contradicting_factors?.length || 0), 0);
    if (totalContradictions > 0) {
      const penalty = Math.min(totalContradictions * 0.05, 0.15);
      coherenceScore -= penalty;
      conflictDetails.push(`${totalContradictions} contradicting clinical factor(s) detected`);
    }

    // 3c: Safety flags active
    if (safetyFlags.length > 0) {
      coherenceScore -= Math.min(safetyFlags.length * 0.05, 0.15);
      conflictDetails.push(`${safetyFlags.length} safety flag(s) active`);
    }

    // 3d: Dangerous diagnoses present — these inherently add uncertainty
    if (dangerousDx.length > 0) {
      coherenceScore -= 0.10;
      conflictDetails.push(`${dangerousDx.length} must-not-miss diagnosis(es) in differential`);
    }

    // 3e: Unmatched symptoms — knowledge graph gaps
    if (unmatchedSymptoms.length > 0 && symptoms.length > 0) {
      const unmatchedRatio = unmatchedSymptoms.length / symptoms.length;
      if (unmatchedRatio > 0.5) {
        coherenceScore -= 0.15;
        conflictDetails.push(`${unmatchedSymptoms.length}/${symptoms.length} symptoms not found in knowledge graph`);
      } else if (unmatchedRatio > 0.25) {
        coherenceScore -= 0.08;
        conflictDetails.push(`${unmatchedSymptoms.length} symptom(s) not mapped in graph`);
      }
    }

    // 3f: Paradigm divergence (from hybrid reasoning)
    if (input.paradigm_agreement === "divergent") {
      coherenceScore -= 0.15;
      conflictDetails.push("Symbolic and probabilistic reasoning paradigms diverge");
    } else if (input.paradigm_agreement === "moderate_agreement") {
      coherenceScore -= 0.05;
    }

    // 3g: Explicit conflicts from guideline compliance
    if (conflicts.length > 0) {
      coherenceScore -= Math.min(conflicts.length * 0.08, 0.20);
      conflictDetails.push(`${conflicts.length} guideline conflict(s) detected`);
    }

    coherenceScore = Math.max(0, coherenceScore);

    // ═══════════════════════════════════════════════════════
    // FINAL CONFIDENCE SCORE
    // ═══════════════════════════════════════════════════════
    let confidenceScore =
      (WEIGHTS.evidence_strength * evidenceStrength) +
      (WEIGHTS.data_completeness * dataCompleteness) +
      (WEIGHTS.signal_coherence * coherenceScore);

    confidenceScore = Math.max(0, Math.min(1, confidenceScore));
    confidenceScore = Math.round(confidenceScore * 100) / 100;

    const confidenceLabel = classifyConfidence(confidenceScore);

    // ─── Missing evidence gaps ───
    const missingEvidence: string[] = [];
    for (const item of completenessItems) {
      if (!item.present) {
        const labels: Record<string, string> = {
          temperature: "Temperature not recorded",
          spo2: "SpO2 not recorded",
          pulse: "Pulse not recorded",
          blood_pressure: "Blood pressure not recorded",
          respiratory_rate: "Respiratory rate not recorded",
          medical_history: "Medical history not provided",
          allergies: "Allergy information not provided",
          current_medications: "Current medications not documented",
          symptoms: "No symptoms provided",
          lab_results: "No lab results available",
        };
        missingEvidence.push(labels[item.field] || `${item.field} missing`);
      }
    }
    if (matchedCount === 0 && symptoms.length > 0) {
      missingEvidence.push("No symptoms matched in knowledge graph");
    }
    if (evidenceCitations.length === 0) {
      missingEvidence.push("No evidence citations available");
    }
    if (allAuthorities.length === 0) {
      missingEvidence.push("No guideline sources matched");
    }

    // ─── Build output ───
    const topDiagnosis = diagnoses[0];
    const mustNotMiss = diagnoses.filter(d => d.must_not_miss).map(d => d.diagnosis_name || d.diagnosis || "");

    const result = {
      confidence_score: confidenceScore,
      confidence_label: confidenceLabel,
      top_diagnosis: topDiagnosis?.diagnosis_name || topDiagnosis?.diagnosis || "Unknown",
      alternative_diagnoses: diagnoses.slice(1, 4).map(d => ({
        name: d.diagnosis_name || d.diagnosis || "",
        probability: d.probability || d.fused_probability || (d.confidence ? Math.round(d.confidence * 100) : 0),
      })),
      must_not_miss: mustNotMiss,
      missing_evidence: missingEvidence,
      diagnostic_conflict: conflictDetails.length > 0,
      conflict_details: conflictDetails,
      guideline_sources: allAuthorities,
      safety_flags: safetyFlags,
      scoring_breakdown: {
        evidence_strength: Math.round(evidenceStrength * 100) / 100,
        evidence_components: {
          graph_support: Math.round(graphSupport * 100) / 100,
          citation_quality: Math.round(citationQuality * 100) / 100,
          guideline_strength: Math.round(guidelineStrength * 100) / 100,
        },
        data_completeness: Math.round(dataCompleteness * 100) / 100,
        signal_coherence: Math.round(coherenceScore * 100) / 100,
        conflict_count: conflictDetails.length,
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
