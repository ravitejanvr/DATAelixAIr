import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symptoms } = await req.json();

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return new Response(JSON.stringify({ error: "symptoms array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();

    // Step 1: Find matching symptoms
    const normalizedSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());

    const { data: matchedSymptoms, error: symErr } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .in("symptom_name", normalizedSymptoms);

    if (symErr) throw symErr;

    const symptomIds = (matchedSymptoms || []).map((s: any) => s.id);

    if (symptomIds.length === 0) {
      await logQuery(supabase, symptoms, 0, Date.now() - startTime);
      return new Response(JSON.stringify({
        diagnoses: [],
        suggested_labs: [],
        suggested_drugs: [],
        matched_symptoms: [],
        disclaimer: "No matching symptoms found in clinical knowledge graph.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 2: Get diagnoses linked to symptoms, ranked by confidence
    const { data: diagnosisLinks, error: dlErr } = await supabase
      .from("symptom_diagnosis_map")
      .select("diagnosis_id, confidence_score, diagnoses(id, diagnosis_name, category, icd10_code)")
      .in("symptom_id", symptomIds)
      .order("confidence_score", { ascending: false });

    if (dlErr) throw dlErr;

    // Aggregate diagnoses — sum confidence across matched symptoms
    const diagnosisMap = new Map<string, { diagnosis: any; total_confidence: number; symptom_count: number }>();
    for (const link of diagnosisLinks || []) {
      const d = (link as any).diagnoses;
      if (!d) continue;
      const existing = diagnosisMap.get(d.id);
      if (existing) {
        existing.total_confidence += link.confidence_score;
        existing.symptom_count += 1;
      } else {
        diagnosisMap.set(d.id, {
          diagnosis: d,
          total_confidence: link.confidence_score,
          symptom_count: 1,
        });
      }
    }

    const rankedDiagnoses = Array.from(diagnosisMap.values())
      .sort((a, b) => b.total_confidence - a.total_confidence)
      .slice(0, 10)
      .map((entry) => ({
        ...entry.diagnosis,
        confidence: Math.round((entry.total_confidence / symptomIds.length) * 100) / 100,
        matching_symptoms: entry.symptom_count,
      }));

    const diagnosisIds = rankedDiagnoses.map((d) => d.id);

    // Step 3: Get associated drugs
    let suggestedDrugs: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: drugLinks, error: drugErr } = await supabase
        .from("diagnosis_drug_map")
        .select("generic_name, line_of_treatment, diagnosis_id")
        .in("diagnosis_id", diagnosisIds);

      if (drugErr) throw drugErr;

      // Enrich with drug_master data
      const genericNames = [...new Set((drugLinks || []).map((d: any) => d.generic_name))];
      if (genericNames.length > 0) {
        const { data: drugDetails } = await supabase
          .from("drug_master")
          .select("generic_name, drug_class, max_daily_dose_mg, pregnancy_category")
          .in("generic_name", genericNames);

        const drugDetailMap = new Map((drugDetails || []).map((d: any) => [d.generic_name, d]));

        suggestedDrugs = (drugLinks || []).map((link: any) => {
          const detail = drugDetailMap.get(link.generic_name) || {};
          const diagName = rankedDiagnoses.find((d) => d.id === link.diagnosis_id)?.diagnosis_name;
          return {
            generic_name: link.generic_name,
            line_of_treatment: link.line_of_treatment,
            for_diagnosis: diagName || "unknown",
            ...(detail as object),
          };
        });
      }
    }

    // Step 4: Get associated lab tests
    let suggestedLabs: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: labLinks, error: labErr } = await supabase
        .from("diagnosis_lab_map")
        .select("priority, diagnosis_id, lab_tests(id, test_name, category)")
        .in("diagnosis_id", diagnosisIds);

      if (labErr) throw labErr;

      suggestedLabs = (labLinks || []).map((link: any) => {
        const diagName = rankedDiagnoses.find((d) => d.id === link.diagnosis_id)?.diagnosis_name;
        return {
          test_name: link.lab_tests?.test_name,
          category: link.lab_tests?.category,
          priority: link.priority,
          for_diagnosis: diagName || "unknown",
        };
      });
    }

    const durationMs = Date.now() - startTime;
    await logQuery(supabase, symptoms, rankedDiagnoses.length, durationMs);

    return new Response(JSON.stringify({
      matched_symptoms: (matchedSymptoms || []).map((s: any) => s.symptom_name),
      diagnoses: rankedDiagnoses,
      suggested_drugs: suggestedDrugs,
      suggested_labs: suggestedLabs,
      disclaimer: "AI-assisted clinical graph suggestions for clinician review. All recommendations require clinical evaluation.",
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("query-clinical-graph error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function logQuery(supabase: any, symptoms: string[], resultCount: number, durationMs: number) {
  try {
    await supabase.from("monitoring_events").insert({
      event_type: "clinical_graph_query",
      agent_name: "query-clinical-graph",
      duration_ms: durationMs,
      success: true,
      metadata: { symptoms, result_count: resultCount },
    });
  } catch (e) {
    console.error("Failed to log graph query:", e);
  }
}
