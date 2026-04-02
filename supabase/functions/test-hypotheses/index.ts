import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ══════════════════════════════════════════════════════════════
// INLINE TERMINOLOGY NORMALIZER
// ══════════════════════════════════════════════════════════════
const SYNONYM_MAP: Record<string, string> = {
  "cough with sputum": "productive cough",
  "cough with phlegm": "productive cough",
  "phlegmy cough": "productive cough",
  "wet cough": "productive cough",
  "nonproductive cough": "dry cough",
  "shortness of breath": "dyspnea",
  "breathlessness": "dyspnea",
  "difficulty breathing": "dyspnea",
  "breathing difficulty": "dyspnea",
  "can't breathe": "dyspnea",
  "labored breathing": "dyspnea",
  "sob": "dyspnea",
  "stomach pain": "abdominal pain",
  "belly pain": "abdominal pain",
  "tummy pain": "abdominal pain",
  "stomach ache": "abdominal pain",
  "abdominal discomfort": "abdominal pain",
  "stomach cramps": "abdominal cramps",
  "belly cramps": "abdominal cramps",
  "throwing up": "vomiting",
  "puking": "vomiting",
  "emesis": "vomiting",
  "feeling sick": "nausea",
  "queasy": "nausea",
  "loose stools": "diarrhea",
  "loose motions": "diarrhea",
  "watery stools": "diarrhea",
  "frequent stools": "diarrhea",
  "acid reflux": "heartburn",
  "acidity": "heartburn",
  "burning in stomach": "epigastric pain",
  "upper stomach pain": "epigastric pain",
  "no appetite": "loss of appetite",
  "not hungry": "loss of appetite",
  "poor appetite": "loss of appetite",
  "decreased appetite": "loss of appetite",
  "blood in stool": "bloody stool",
  "rectal bleeding": "bloody stool",
  "heart racing": "palpitations",
  "heart pounding": "palpitations",
  "irregular heartbeat": "palpitations",
  "chest tightness": "chest pain",
  "chest pressure": "chest pain",
  "chest discomfort": "chest pain",
  "heavy sweating": "diaphoresis",
  "profuse sweating": "diaphoresis",
  "cold sweats": "diaphoresis",
  "swollen legs": "edema",
  "swollen feet": "edema",
  "head pain": "headache",
  "migraine": "headache",
  "giddiness": "dizziness",
  "lightheadedness": "dizziness",
  "vertigo": "dizziness",
  "room spinning": "dizziness",
  "passed out": "syncope",
  "fainted": "syncope",
  "stiff neck": "neck stiffness",
  "neck rigidity": "neck stiffness",
  "sensitivity to light": "photophobia",
  "light sensitivity": "photophobia",
  "body pain": "body aches",
  "generalized pain": "body aches",
  "muscle ache": "muscle pain",
  "myalgia": "muscle pain",
  "joint ache": "joint pain",
  "arthralgia": "joint pain",
  "low back pain": "back pain",
  "lower back pain": "back pain",
  "lumbar pain": "back pain",
  "painful urination": "dysuria",
  "burning urination": "dysuria",
  "burning when peeing": "dysuria",
  "peeing a lot": "polyuria",
  "frequent urination": "polyuria",
  "blood in urine": "hematuria",
  "side pain": "flank pain",
  "kidney area pain": "flank pain",
  "skin rash": "rash",
  "hives": "rash",
  "pruritus": "itching",
  "itchy skin": "itching",
  "tiredness": "fatigue",
  "exhaustion": "fatigue",
  "no energy": "fatigue",
  "lethargic": "fatigue",
  "lethargy": "fatigue",
  "feeling tired": "fatigue",
  "low grade fever": "mild fever",
  "slight fever": "mild fever",
  "high fever": "fever",
  "temperature": "fever",
  "febrile": "fever",
  "pyrexia": "fever",
  "rigor": "chills",
  "shivering": "chills",
  "feeling unwell": "malaise",
  "generally unwell": "malaise",
  "not feeling well": "malaise",
  "dehydrated": "dehydration",
  "dry mouth": "dehydration",
};

function normalizeSymptom(s: string): string {
  const lower = s.toLowerCase().trim();
  return SYNONYM_MAP[lower] || lower;
}

function normalizeSymptomList(symptoms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const s of symptoms) {
    const n = normalizeSymptom(s);
    if (!seen.has(n)) { seen.add(n); result.push(n); }
  }
  return result;
}

/**
 * Hypothesis Testing Engine v2
 *
 * v2 fixes:
 *   - Uses correct column name `likelihood_value` (was `likelihood`)
 *   - Adds terminology normalization for patient symptoms before matching
 *
 * Validates DDX candidates against symptom_likelihoods from the knowledge graph.
 * Deterministic, graph-only engine — no LLM calls. Target <200ms.
 */

interface TestedHypothesis {
  diagnosis_id: string;
  diagnosis_name: string;
  icd10_code: string | null;
  original_probability: number;
  evidence_score: number;
  adjusted_probability: number;
  verdict: "supported" | "partially_supported" | "weakly_supported" | "indeterminate";
  supporting_symptoms: Array<{ symptom: string; likelihood: number }>;
  missing_expected_symptoms: Array<{ symptom: string; likelihood: number }>;
  contradicting_factors: string[];
  must_not_miss: boolean;
  coverage_ratio: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      candidate_diagnoses,
      patient_symptoms,
      patient_age,
      patient_sex,
      allergies,
      current_medications,
    } = body;

    if (!candidate_diagnoses || !Array.isArray(candidate_diagnoses) || candidate_diagnoses.length === 0) {
      return new Response(
        JSON.stringify({ error: "candidate_diagnoses array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!patient_symptoms || !Array.isArray(patient_symptoms) || patient_symptoms.length === 0) {
      return new Response(
        JSON.stringify({ error: "patient_symptoms array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const diagnosisIds = candidate_diagnoses.map((d: any) => d.diagnosis_id).filter(Boolean);
    // Normalize patient symptoms before matching
    const symptomLower = normalizeSymptomList(patient_symptoms);

    // ══════════════════════════════════════════════
    // STEP 1: Fetch symptom_likelihoods for all candidate diagnoses
    // FIX: Use correct column name `likelihood_value` (was `likelihood`)
    // ══════════════════════════════════════════════
    const { data: likelihoods, error: likErr } = await supabase
      .from("symptom_likelihoods")
      .select("diagnosis_id, symptom_id, likelihood_value, symptoms(symptom_name)")
      .in("diagnosis_id", diagnosisIds);

    if (likErr) {
      console.error("[HypothesisTesting] Failed to fetch likelihoods:", likErr);
    }

    // Build lookup: diagnosis_id → [{ symptom_name, likelihood }]
    const likelihoodMap = new Map<string, Array<{ symptom_name: string; likelihood: number }>>();
    if (likelihoods) {
      for (const row of likelihoods) {
        const symptomName = (row as any).symptoms?.symptom_name?.toLowerCase() || "";
        if (!symptomName) continue;
        if (!likelihoodMap.has(row.diagnosis_id)) {
          likelihoodMap.set(row.diagnosis_id, []);
        }
        likelihoodMap.get(row.diagnosis_id)!.push({
          symptom_name: symptomName,
          likelihood: row.likelihood_value,
        });
      }
    }

    // ══════════════════════════════════════════════
    // STEP 2: Test each hypothesis against the evidence
    // ══════════════════════════════════════════════
    const testedHypotheses: TestedHypothesis[] = [];

    for (const candidate of candidate_diagnoses) {
      const dxId = candidate.diagnosis_id;
      const dxName = candidate.diagnosis_name || "";
      const originalProb = candidate.probability || 0;
      const mustNotMiss = candidate.must_not_miss || false;
      const icd10 = candidate.icd10_code || null;

      const expectedSymptoms = likelihoodMap.get(dxId) || [];

      // Match patient symptoms against expected symptoms
      const supporting: Array<{ symptom: string; likelihood: number }> = [];
      const missingExpected: Array<{ symptom: string; likelihood: number }> = [];

      for (const expected of expectedSymptoms) {
        const isPresent = symptomLower.some(
          (s) => s.includes(expected.symptom_name) || expected.symptom_name.includes(s),
        );
        if (isPresent) {
          supporting.push({ symptom: expected.symptom_name, likelihood: expected.likelihood });
        } else if (expected.likelihood >= 0.5) {
          // Only count high-likelihood symptoms as "missing expected"
          missingExpected.push({ symptom: expected.symptom_name, likelihood: expected.likelihood });
        }
      }

      // Compute evidence score
      let evidenceScore = 0.5; // neutral baseline
      if (expectedSymptoms.length > 0) {
        const totalExpectedWeight = expectedSymptoms.reduce((sum, e) => sum + e.likelihood, 0);
        const supportingWeight = supporting.reduce((sum, s) => sum + s.likelihood, 0);
        evidenceScore = totalExpectedWeight > 0 ? supportingWeight / totalExpectedWeight : 0.5;
      }

      // Compute coverage ratio
      const coverageRatio = expectedSymptoms.length > 0
        ? supporting.length / expectedSymptoms.length
        : 0;

      // Compute adjusted probability
      const evidenceMultiplier = 0.5 + evidenceScore; // range: 0.5 to 1.5
      let adjustedProb = Math.round(originalProb * evidenceMultiplier);
      
      // Must-not-miss diagnoses maintain a visibility floor
      if (mustNotMiss) {
        adjustedProb = Math.max(adjustedProb, Math.max(15, Math.round(originalProb * 0.8)));
      }
      
      // Cap at 95
      adjustedProb = Math.min(95, Math.max(1, adjustedProb));

      // Determine verdict
      let verdict: TestedHypothesis["verdict"] = "indeterminate";
      if (expectedSymptoms.length === 0) {
        verdict = "indeterminate";
      } else if (evidenceScore >= 0.6) {
        verdict = "supported";
      } else if (evidenceScore >= 0.4) {
        verdict = "partially_supported";
      } else {
        verdict = "weakly_supported";
      }

      // Build contradicting factors
      const contradicting: string[] = [];
      if (missingExpected.length > 0) {
        contradicting.push(
          `Missing expected symptoms: ${missingExpected.map((m) => m.symptom_name).join(", ")}`,
        );
      }
      if (patient_age !== undefined && patient_age !== null) {
        if (dxName.toLowerCase().includes("pediatric") && patient_age > 18) {
          contradicting.push("Patient age does not match pediatric diagnosis");
        }
      }

      testedHypotheses.push({
        diagnosis_id: dxId,
        diagnosis_name: dxName,
        icd10_code: icd10,
        original_probability: originalProb,
        evidence_score: Math.round(evidenceScore * 100) / 100,
        adjusted_probability: adjustedProb,
        verdict,
        supporting_symptoms: supporting,
        missing_expected_symptoms: missingExpected,
        contradicting_factors: contradicting,
        must_not_miss: mustNotMiss,
        coverage_ratio: Math.round(coverageRatio * 100) / 100,
      });
    }

    // Sort by adjusted probability descending
    testedHypotheses.sort((a, b) => b.adjusted_probability - a.adjusted_probability);

    const execution_ms = Date.now() - start;

    // Summary stats
    const supported = testedHypotheses.filter((h) => h.verdict === "supported").length;
    const partial = testedHypotheses.filter((h) => h.verdict === "partially_supported").length;
    const weak = testedHypotheses.filter((h) => h.verdict === "weakly_supported").length;
    const indeterminate = testedHypotheses.filter((h) => h.verdict === "indeterminate").length;

    console.log(
      `[HypothesisTesting] Tested ${testedHypotheses.length} hypotheses in ${execution_ms}ms. ` +
      `Supported=${supported}, Partial=${partial}, Weak=${weak}, Indeterminate=${indeterminate}`,
    );

    return new Response(
      JSON.stringify({
        tested_hypotheses: testedHypotheses,
        summary: {
          total_tested: testedHypotheses.length,
          supported,
          partially_supported: partial,
          weakly_supported: weak,
          indeterminate,
          likelihoods_available: likelihoodMap.size,
        },
        execution_ms,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[HypothesisTesting] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
