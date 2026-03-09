import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Trusted sources for automated ingestion */
const TRUSTED_QUERIES = [
  { source: "Nature Digital Medicine", query: "nature digital medicine clinical AI" },
  { source: "McKinsey Health", query: "mckinsey healthcare AI transformation" },
  { source: "WHO", query: "WHO clinical guidelines digital health AI" },
  { source: "NHS AI Lab", query: "NHS AI lab clinical safety" },
  { source: "ScienceDirect", query: "sciencedirect clinical decision support AI" },
  { source: "Government Health", query: "government health AI policy clinical safety" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: { source: string; drafted: number; skipped: number; errors: number }[] = [];

    for (const { source, query } of TRUSTED_QUERIES) {
      try {
        // Fetch research papers
        const fetchRes = await fetch(`${SUPABASE_URL}/functions/v1/fetch-research`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ query, max_results: 2 }),
        });

        const fetchData = await fetchRes.json();
        const papers = fetchData?.papers || [];
        let drafted = 0, skipped = 0, errors = 0;

        for (const paper of papers.slice(0, 2)) {
          // Check if article already exists by title
          const { data: existing } = await supabase
            .from("blog_articles")
            .select("id")
            .ilike("title", `%${paper.title?.substring(0, 50)}%`)
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            continue;
          }

          // Generate draft
          const draftRes = await fetch(`${SUPABASE_URL}/functions/v1/draft-article`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ paper, source_filter: source }),
          });

          const draftData = await draftRes.json();
          if (!draftData?.success || !draftData?.draft) {
            errors++;
            continue;
          }

          const draft = draftData.draft;
          const slug = (draft.title || paper.title || "untitled")
            .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 80);

          const { error: insertError } = await supabase.from("blog_articles").insert({
            title: draft.title || paper.title,
            slug: `${slug}-${Date.now().toString(36)}`,
            summary: draft.summary || "",
            content: draft.content || "",
            category: draft.category || "Research & Evidence",
            keywords: draft.keywords || [],
            key_findings: draft.key_findings || [],
            clinical_implications: draft.clinical_implications || "",
            source_type: "Research",
            source_name: source,
            source_url: paper.url || "",
            source_journal: paper.journal || source,
            source_year: paper.year || new Date().getFullYear(),
            author: (paper.authors || []).slice(0, 3).join(", ") || "Research Team",
            status: "draft",
            meta_title: draft.meta_title || (draft.title || "").substring(0, 60),
            meta_description: draft.meta_description || (draft.summary || "").substring(0, 160),
            publish_date: new Date().toISOString().split("T")[0],
            reading_time_min: draft.reading_time_min || 5,
          });

          if (insertError) {
            console.error("Insert error:", insertError);
            errors++;
          } else {
            drafted++;
          }
        }

        results.push({ source, drafted, skipped, errors });
      } catch (e) {
        console.error(`Error processing ${source}:`, e);
        results.push({ source, drafted: 0, skipped: 0, errors: 1 });
      }
    }

    const totalDrafted = results.reduce((s, r) => s + r.drafted, 0);
    const totalSkipped = results.reduce((s, r) => s + r.skipped, 0);

    // Log monitoring event
    await supabase.from("monitoring_events").insert({
      event_type: "weekly_research_ingestion",
      agent_name: "research-ingestion-agent",
      success: true,
      metadata: { results, total_drafted: totalDrafted, total_skipped: totalSkipped },
    });

    return new Response(JSON.stringify({
      success: true,
      summary: `${totalDrafted} new drafts created, ${totalSkipped} duplicates skipped`,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("weekly-research-ingestion error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
