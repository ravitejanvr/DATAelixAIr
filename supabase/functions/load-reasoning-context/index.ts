import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Load Reasoning Context — Single Batch Graph Data Loader
 *
 * Returns all knowledge graph data needed for reasoning in ONE call:
 *   - symptoms (matched by input)
 *   - symptom_likelihoods (for matched symptoms)
 *   - disease_priors
 *   - dangerous_diagnoses
 *   - physiological_states (via symptom_physiology_map)
 *   - physiology_diagnosis_map
 *
 * This eliminates per-module DB queries during reasoning.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { symptoms = [] } = body;

    if (!symptoms.length) {
      return new Response(JSON.stringify({ error: "symptoms[] is required" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());

    // ── SINGLE BATCH: All graph data in parallel ──
    const [
      symptomRes,
      dangerousRes,
      priorsRes,
    ] = await Promise.all([
      // 1. Resolve symptoms
      supabase.from("symptoms").select("id, symptom_name").in("symptom_name", normalizedSymptoms),
      // 2. Dangerous diagnoses
      supabase.from("dangerous_diagnoses")
        .select("*, diagnoses(id, diagnosis_name, icd10_code, category)")
        .eq("must_not_miss", true)
        .order("priority", { ascending: true }),
      // 3. Disease priors
      supabase.from("disease_priors")
        .select("diagnosis_id, base_prevalence, age_modifier, sex_modifier, region_modifier, diagnoses(diagnosis_name)")
        .limit(1000),
    ]);

    const matchedSymptoms = symptomRes.data || [];
    const symptomIds = matchedSymptoms.map((s: any) => s.id);

    // Fuzzy match unmatched symptoms
    const matchedNames = new Set(matchedSymptoms.map((s: any) => s.symptom_name));
    const unmatched = normalizedSymptoms.filter((s: string) => !matchedNames.has(s));
    
    if (unmatched.length > 0) {
      const fuzzyPromises = unmatched.map((s: string) =>
        supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
      );
      const fuzzyResults = await Promise.all(fuzzyPromises);
      for (const res of fuzzyResults) {
        for (const s of res.data || []) {
          if (!symptomIds.includes(s.id)) {
            symptomIds.push(s.id);
            matchedSymptoms.push(s);
          }
        }
      }
    }

    // Now load symptom-dependent data
    const [likelihoodRes, physMapRes, physDiagRes] = await Promise.all([
      // 4. Symptom likelihoods for matched symptoms
      symptomIds.length > 0
        ? supabase.from("symptom_likelihoods")
            .select("symptom_id, diagnosis_id, likelihood, diagnoses(id, diagnosis_name, category, icd10_code)")
            .in("symptom_id", symptomIds)
            .order("likelihood", { ascending: false })
        : Promise.resolve({ data: [] }),
      // 5. Symptom → physiology map
      symptomIds.length > 0
        ? supabase.from("symptom_physiology_map")
            .select("symptom_id, physiological_state_id, confidence, physiological_states(id, state_name, description, anatomical_systems(system_name))")
            .in("symptom_id", symptomIds)
        : Promise.resolve({ data: [] }),
      // 6. Physiology → diagnosis map
      supabase.from("physiology_diagnosis_map")
        .select("physiological_state_id, diagnosis_id, confidence_score, physiological_states(state_name), diagnoses(id, diagnosis_name, category)")
        .limit(2000),
    ]);

    const executionMs = Date.now() - start;

    return new Response(JSON.stringify({
      matched_symptoms: matchedSymptoms,
      unmatched_symptoms: unmatched,
      symptom_likelihoods: likelihoodRes.data || [],
      disease_priors: priorsRes.data || [],
      dangerous_diagnoses: dangerousRes.data || [],
      symptom_physiology_map: physMapRes.data || [],
      physiology_diagnosis_map: physDiagRes.data || [],
      execution_ms: executionMs,
      source: "load-reasoning-context",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[load-reasoning-context] Error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
