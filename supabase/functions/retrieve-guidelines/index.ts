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

    // ══════════════════════════════════════════════
    // PRIMARY PATH: Relational traversal via guideline_rules
    // diagnoses → guideline_rules → guideline_authorities
    // ══════════════════════════════════════════════
    let relationalGuidelines: any[] = [];
    const diagnosisNames = (hypotheses || [])
      .slice(0, 5)
      .map((h: any) => h.diagnosis)
      .filter(Boolean);

    if (diagnosisNames.length > 0) {
      // Look up diagnosis IDs from diagnoses table
      const { data: diagRows } = await supabase
        .from("diagnoses")
        .select("id, diagnosis_name")
        .or(diagnosisNames.map((d: string) => `diagnosis_name.ilike.%${d.replace(/'/g, "''")}%`).join(","));

      const diagnosisIds = (diagRows || []).map((d: any) => d.id);

      if (diagnosisIds.length > 0) {
        // Traverse: guideline_rules → guideline_authorities
        const { data: rules } = await supabase
          .from("guideline_rules")
          .select(`
            id,
            recommendation,
            evidence_level,
            treatment_generic_name,
            diagnosis_id,
            diagnoses(diagnosis_name),
            guideline_authorities(authority_name, country, priority)
          `)
          .in("diagnosis_id", diagnosisIds)
          .order("created_at", { ascending: false });

        if (rules && rules.length > 0) {
          relationalGuidelines = rules.map((r: any) => ({
            guideline_source: `${(r as any).guideline_authorities?.authority_name || "Unknown"} — ${(r as any).diagnoses?.diagnosis_name || ""}`,
            authority: (r as any).guideline_authorities?.authority_name || "Unknown",
            authority_priority: (r as any).guideline_authorities?.priority ?? 10,
            recommendation: r.recommendation,
            evidence_level: r.evidence_level,
            treatment: r.treatment_generic_name,
            condition: (r as any).diagnoses?.diagnosis_name || "",
            country: (r as any).guideline_authorities?.country || "global",
            source: "guideline_rules",
          }));

          // Sort by authority priority (WHO=1, NICE=2, etc.)
          relationalGuidelines.sort((a: any, b: any) => a.authority_priority - b.authority_priority);
        }
      }
    }

    // ══════════════════════════════════════════════
    // FALLBACK: guideline_registry keyword matching
    // ══════════════════════════════════════════════
    let registryGuidelines: any[] = [];
    if (relationalGuidelines.length < 3) {
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

      const { data: guidelines } = await supabase
        .from("guideline_registry")
        .select("*")
        .eq("is_active", true)
        .or(`country.eq.${clinicCountry},country.eq.global`)
        .order("tier", { ascending: true })
        .limit(50);

      if (guidelines && guidelines.length > 0) {
        const scored = guidelines.map((g: any) => {
          let relevance = 0;
          const gText = `${g.title} ${g.condition} ${g.summary} ${(g.keywords || []).join(" ")} ${(g.applicable_drugs || []).join(" ")} ${(g.applicable_tests || []).join(" ")}`.toLowerCase();
          for (const term of searchTerms) {
            if (gText.includes(term.toLowerCase())) relevance += 1;
          }
          if (g.specialty === clinicSpecialty || g.specialty === "general") relevance += 0.5;
          if (g.country === clinicCountry) relevance += 1;
          return { ...g, relevance_score: relevance };
        })
          .filter((g: any) => g.relevance_score > 0)
          .sort((a: any, b: any) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return b.relevance_score - a.relevance_score;
          })
          .slice(0, 5);

        registryGuidelines = scored.map((g: any) => ({
          guideline_id: g.id,
          guideline_source: `${g.organization} — ${g.title}`,
          authority: g.organization,
          tier: g.tier,
          tier_label: tierLabel(g.tier),
          country: g.country,
          recommendation: g.recommendation_text,
          evidence_level: g.evidence_grade || "N/A",
          condition: g.condition,
          version: g.version,
          relevance_score: g.relevance_score,
          source: "guideline_registry",
        }));
      }
    }

    // Also check legacy clinical_guidelines if still thin
    if (relationalGuidelines.length + registryGuidelines.length < 2) {
      const searchTerms = diagnosisNames.length > 0 ? diagnosisNames : [patient_context.chief_complaint].filter(Boolean);
      const { data: legacyGuidelines } = await supabase
        .from("clinical_guidelines")
        .select("*")
        .eq("is_active", true)
        .limit(50);

      if (legacyGuidelines) {
        const matched = matchGuidelines(legacyGuidelines, searchTerms, clinicSpecialty);
        for (const g of matched.slice(0, 3)) {
          registryGuidelines.push({
            guideline_source: `${g.source_organization} — ${g.title}`,
            authority: g.source_organization,
            tier: mapLegacyTier(g.source),
            recommendation: g.recommendation_text,
            evidence_level: g.evidence_grade,
            condition: g.condition,
            source: "legacy_clinical_guidelines",
          });
        }
      }
    }

    // Combine all guidelines, deduplicate, sort by priority
    const allGuidelines = [...relationalGuidelines, ...registryGuidelines]
      .slice(0, 10);

    // Log guideline usage
    for (const g of allGuidelines.slice(0, 5)) {
      try {
        if (g.guideline_id) {
          await supabase.from("guideline_usage_logs").insert({
            visit_id,
            guideline_id: g.guideline_id,
            clinic_id: visit.clinic_id,
            tier: g.tier || g.authority_priority || 5,
            matched_condition: g.condition,
            recommendation_used: typeof g.recommendation === "string" ? g.recommendation.substring(0, 500) : "",
            guideline_name: g.guideline_source,
          });
        }
      } catch { /* non-critical */ }
    }

    const duration_ms = Date.now() - start;
    await supabase.from("monitoring_events").insert({
      event_type: "guideline_retrieval",
      agent_name: "retrieve-guidelines",
      clinic_id: visit.clinic_id,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        relational_count: relationalGuidelines.length,
        registry_count: registryGuidelines.length,
        total_count: allGuidelines.length,
        source: relationalGuidelines.length > 0 ? "guideline_rules+registry" : "registry_only",
      },
    });

    return new Response(JSON.stringify({
      guidelines: allGuidelines,
      source: relationalGuidelines.length > 0 ? "guideline_rules" : "guideline_registry",
      relational_matches: relationalGuidelines.length,
      registry_matches: registryGuidelines.length,
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
    .map((g: any) => {
      let score = 0;
      const text = `${g.title} ${g.condition} ${g.summary} ${(g.keywords || []).join(" ")}`.toLowerCase();
      for (const term of searchTerms) {
        if (text.includes(term.toLowerCase())) score++;
      }
      if (g.clinical_topic === specialty) score += 0.5;
      return { ...g, score };
    })
    .filter((g: any) => g.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 5);
}
