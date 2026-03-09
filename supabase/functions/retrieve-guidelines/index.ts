import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { visit_id, patient_context, hypotheses } = await req.json();
    if (!visit_id || !patient_context) {
      return new Response(
        JSON.stringify({ error: "visit_id and patient_context are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get visit + clinic info
    const { data: visit } = await supabase
      .from("patient_visits")
      .select("clinic_id, clinics(country, specialty)")
      .eq("id", visit_id)
      .single();

    if (!visit) {
      return new Response(JSON.stringify({ error: "Visit not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase
      .rpc("is_clinic_member", { _user_id: user.id, _clinic_id: visit.clinic_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clinicCountry = (visit as any).clinics?.country || "IN";
    const clinicSpecialty = (visit as any).clinics?.specialty || "general";

    // Build search terms from context + hypotheses
    const searchTerms: string[] = [];
    if (patient_context.chief_complaint) searchTerms.push(patient_context.chief_complaint);
    if (hypotheses?.length) {
      hypotheses.slice(0, 3).forEach((h: any) => {
        if (h.diagnosis) searchTerms.push(h.diagnosis);
      });
    }
    if (patient_context.medications?.length) {
      searchTerms.push(...patient_context.medications.slice(0, 3));
    }

    // Query guideline_registry with tier-priority ranking
    // Step 1: Match by country (national tier) or global
    const { data: guidelines } = await supabase
      .from("guideline_registry")
      .select("*")
      .eq("is_active", true)
      .or(`country.eq.${clinicCountry},country.eq.global`)
      .order("tier", { ascending: true })
      .limit(50);

    if (!guidelines || guidelines.length === 0) {
      // Also try the legacy clinical_guidelines table
      const { data: legacyGuidelines } = await supabase
        .from("clinical_guidelines")
        .select("*")
        .eq("is_active", true)
        .limit(50);

      const matched = matchGuidelines(legacyGuidelines || [], searchTerms, clinicSpecialty);

      const duration_ms = Date.now() - start;
      await logMonitoring(supabase, visit.clinic_id, visit_id, matched.length, duration_ms, "legacy");

      return new Response(JSON.stringify({
        guidelines: matched.map((g: any) => ({
          guideline_source: `${g.source_organization} — ${g.title}`,
          tier: mapLegacyTier(g.source),
          recommendation: g.recommendation_text,
          evidence_grade: g.evidence_grade,
          condition: g.condition,
        })),
        source: "legacy_clinical_guidelines",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score and rank guidelines by relevance + tier
    const scored = guidelines.map((g) => {
      let relevance = 0;
      const gText = `${g.title} ${g.condition} ${g.summary} ${(g.keywords || []).join(" ")} ${(g.applicable_drugs || []).join(" ")} ${(g.applicable_tests || []).join(" ")}`.toLowerCase();

      for (const term of searchTerms) {
        if (gText.includes(term.toLowerCase())) relevance += 1;
      }

      // Specialty match bonus
      if (g.specialty === clinicSpecialty || g.specialty === "general") relevance += 0.5;

      // Country match bonus (national guidelines prioritized)
      if (g.country === clinicCountry) relevance += 1;

      return { ...g, relevance_score: relevance };
    })
      .filter((g) => g.relevance_score > 0)
      .sort((a, b) => {
        // Primary: tier (ascending = higher priority)
        if (a.tier !== b.tier) return a.tier - b.tier;
        // Secondary: relevance (descending)
        return b.relevance_score - a.relevance_score;
      })
      .slice(0, 5);

    // Log usage
    for (const g of scored) {
      await supabase.from("guideline_usage_logs").insert({
        visit_id,
        guideline_id: g.id,
        clinic_id: visit.clinic_id,
        tier: g.tier,
        matched_condition: g.condition,
        recommendation_used: g.recommendation_text,
      });
    }

    const duration_ms = Date.now() - start;
    await logMonitoring(supabase, visit.clinic_id, visit_id, scored.length, duration_ms, "registry");

    return new Response(JSON.stringify({
      guidelines: scored.map((g) => ({
        guideline_id: g.id,
        guideline_source: `${g.organization} — ${g.title}`,
        tier: g.tier,
        tier_label: tierLabel(g.tier),
        country: g.country,
        recommendation: g.recommendation_text,
        condition: g.condition,
        version: g.version,
        relevance_score: g.relevance_score,
      })),
      source: "guideline_registry",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("retrieve-guidelines error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function tierLabel(tier: number): string {
  switch (tier) {
    case 1: return "National";
    case 2: return "Global";
    case 3: return "Specialty Society";
    case 4: return "Clinical Trial";
    case 5: return "Literature";
    default: return "Unknown";
  }
}

function mapLegacyTier(source: string): number {
  const s = source.toLowerCase();
  if (s.includes("icmr") || s.includes("nhs") || s.includes("national")) return 1;
  if (s.includes("who")) return 2;
  if (s.includes("ada") || s.includes("esc") || s.includes("nice") || s.includes("aha")) return 3;
  return 5;
}

function matchGuidelines(guidelines: any[], searchTerms: string[], specialty: string): any[] {
  return guidelines
    .map((g) => {
      let score = 0;
      const text = `${g.title} ${g.condition} ${g.summary} ${(g.keywords || []).join(" ")}`.toLowerCase();
      for (const term of searchTerms) {
        if (text.includes(term.toLowerCase())) score++;
      }
      if (g.clinical_topic === specialty) score += 0.5;
      return { ...g, score };
    })
    .filter((g) => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function logMonitoring(
  supabase: any,
  clinicId: string,
  visitId: string,
  matchCount: number,
  durationMs: number,
  source: string
) {
  await supabase.from("monitoring_events").insert({
    event_type: "guideline_retrieval",
    agent_name: "retrieve-guidelines",
    clinic_id: clinicId,
    success: true,
    duration_ms: durationMs,
    metadata: { visit_id: visitId, match_count: matchCount, source },
  });
}
