import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Hypothesis Testing Engine
 *
 * Validates DDX candidates against symptom_likelihoods from the knowledge graph.
 * For each candidate diagnosis, computes:
 *   - supporting evidence (symptoms with high P(symptom|disease))
 *   - contradicting evidence (expected symptoms that are absent)
 *   - evidence score (weighted ratio of supporting vs expected)
 *
 * This is a deterministic, graph-only engine — no LLM calls.
 * Designed to run in <200ms.
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
    const symptomLower = patient_symptoms.map((s: string) => s.toLowerCase().trim());

    // ══════════════════════════════════════════════
    // STEP 1: Fetch symptom_likelihoods for all candidate diagnoses
    // ══════════════════════════════════════════════
    const { data: likelihoods, error: likErr } = await supabase
      .from("symptom_likelihoods")
      .select("diagnosis_id, symptom_id, likelihood, symptoms(symptom_name)")
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
          likelihood: row.likelihood,
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
      // Evidence score modulates original probability: strong evidence boosts, weak reduces
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
        verdict = "indeterminate"; // no data to test against
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
      // Check age-based contradictions
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
