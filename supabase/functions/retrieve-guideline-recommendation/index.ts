import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { diagnosis } = await req.json();

    if (!diagnosis || typeof diagnosis !== "string") {
      return new Response(JSON.stringify({ error: "diagnosis string is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();

    // Step 1: Find diagnosis
    const { data: diagMatch, error: diagErr } = await supabase
      .from("diagnoses")
      .select("id, diagnosis_name, icd10_code")
      .ilike("diagnosis_name", diagnosis.trim())
      .limit(1)
      .maybeSingle();

    if (diagErr) throw diagErr;

    if (!diagMatch) {
      return new Response(JSON.stringify({
        diagnosis,
        recommendations: [],
        disclaimer: "No matching diagnosis found in knowledge graph.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 2-4: Retrieve guideline_rules joined with authorities, sorted by priority
    const { data: rules, error: rulesErr } = await supabase
      .from("guideline_rules")
      .select("id, treatment_generic_name, recommendation, evidence_level, guideline_authorities(id, authority_name, country, priority)")
      .eq("diagnosis_id", diagMatch.id);

    if (rulesErr) throw rulesErr;

    // Sort by authority priority (lower = higher authority)
    const sorted = (rules || [])
      .sort((a: any, b: any) => {
        const pA = a.guideline_authorities?.priority ?? 999;
        const pB = b.guideline_authorities?.priority ?? 999;
        return pA - pB;
      })
      .map((r: any) => ({
        treatment_generic_name: r.treatment_generic_name,
        recommendation: r.recommendation,
        evidence_level: r.evidence_level,
        authority: r.guideline_authorities?.authority_name || "unknown",
        authority_country: r.guideline_authorities?.country || "global",
        authority_priority: r.guideline_authorities?.priority ?? 999,
      }));

    // Top recommendation
    const topRecommendation = sorted.length > 0 ? sorted[0] : null;

    const durationMs = Date.now() - startTime;

    // Log to monitoring_events
    try {
      await supabase.from("monitoring_events").insert({
        event_type: "guideline_recommendation_query",
        agent_name: "retrieve-guideline-recommendation",
        duration_ms: durationMs,
        success: true,
        metadata: {
          diagnosis: diagMatch.diagnosis_name,
          diagnosis_id: diagMatch.id,
          rules_found: sorted.length,
          top_authority: topRecommendation?.authority || null,
        },
      });
    } catch (e) {
      console.error("Failed to log guideline query:", e);
    }

    return new Response(JSON.stringify({
      diagnosis: diagMatch.diagnosis_name,
      icd10_code: diagMatch.icd10_code,
      recommended_treatment: topRecommendation?.treatment_generic_name || null,
      authority: topRecommendation?.authority || null,
      evidence_level: topRecommendation?.evidence_level || null,
      all_recommendations: sorted,
      disclaimer: "Guideline-based suggestions for clinician review. All recommendations require clinical evaluation.",
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("retrieve-guideline-recommendation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
