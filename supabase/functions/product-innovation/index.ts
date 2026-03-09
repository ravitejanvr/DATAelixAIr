import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Paper {
  title: string;
  authors: string[];
  journal: string;
  year: number;
  abstract: string;
  url: string;
  source: string;
}

// ── Step 1: Knowledge ingestion ──

async function fetchPubMed(query: string, max = 6): Promise<Paper[]> {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max}&sort=date&retmode=json`;
  const res = await fetch(searchUrl);
  const data = await res.json();
  const ids: string[] = data?.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const fRes = await fetch(fetchUrl);
  const fData = await fRes.json();

  return ids.map((id) => {
    const item = fData?.result?.[id];
    if (!item) return null;
    return {
      title: item.title || "",
      authors: (item.authors || []).map((a: any) => a.name),
      journal: item.fulljournalname || item.source || "",
      year: parseInt(item.pubdate?.split(" ")[0]) || new Date().getFullYear(),
      abstract: "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: "PubMed",
    };
  }).filter(Boolean) as Paper[];
}

async function fetchEuropePMC(query: string, max = 6): Promise<Paper[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${max}&sort=DATE_CREATED desc`;
  const res = await fetch(url);
  const data = await res.json();
  return (data?.resultList?.result || []).map((r: any) => ({
    title: r.title || "",
    authors: r.authorString ? r.authorString.split(", ") : [],
    journal: r.journalTitle || "",
    year: parseInt(r.pubYear) || new Date().getFullYear(),
    abstract: r.abstractText || "",
    url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
    source: "Europe PMC",
  }));
}

async function fetchPlatformTelemetry(sb: any) {
  // Aggregate signals from monitoring events and audit logs
  const [monRes, auditRes] = await Promise.all([
    sb.from("monitoring_events").select("event_type, success, metadata").order("created_at", { ascending: false }).limit(50),
    sb.from("audit_logs").select("event_type, metadata").order("created_at", { ascending: false }).limit(50),
  ]);

  const failureRate = (monRes.data || []).filter((e: any) => !e.success).length / Math.max((monRes.data || []).length, 1);
  const aiEdits = (auditRes.data || []).filter((e: any) => e.event_type === "ai_output_edited").length;
  const safetyOverrides = (auditRes.data || []).filter((e: any) => e.event_type === "safety_override").length;

  return {
    total_events: (monRes.data || []).length,
    failure_rate: Math.round(failureRate * 100),
    ai_output_edits: aiEdits,
    safety_overrides: safetyOverrides,
    summary: `Platform telemetry: ${failureRate > 0.1 ? "High failure rate (" + Math.round(failureRate * 100) + "%)" : "System healthy"}. ${aiEdits} AI outputs edited by clinicians. ${safetyOverrides} safety overrides recorded.`,
  };
}

// ── Step 2 & 3: RAG retrieval + insight generation ──

const RESEARCH_QUERIES = [
  "AI clinical decision support safety evaluation",
  "healthcare workflow automation AI",
  "AI medical documentation patient safety",
  "healthcare AI regulation compliance",
];

async function generateInsights(papers: Paper[], telemetry: any, apiKey: string) {
  const systemPrompt = `You are a Product Innovation Analyst for DATAelixAIr, a clinical AI platform. Analyze research papers and platform telemetry to generate product improvement insights.

Platform telemetry context: ${telemetry.summary}

For each relevant finding, generate a structured innovation insight. Output valid JSON array of insights.`;

  const paperSummaries = papers.slice(0, 8).map((p) =>
    `Title: ${p.title}\nJournal: ${p.journal} (${p.year})\nAbstract: ${p.abstract || "N/A"}\nURL: ${p.url}`
  ).join("\n\n---\n\n");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze these research papers and platform data to generate 3-5 product innovation insights:\n\n${paperSummaries}\n\nPlatform Data:\n- AI output edit rate: ${telemetry.ai_output_edits} edits\n- Safety overrides: ${telemetry.safety_overrides}\n- System failure rate: ${telemetry.failure_rate}%` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_innovation_insights",
          description: "Create structured product innovation insights.",
          parameters: {
            type: "object",
            properties: {
              insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    evidence_source: { type: "string" },
                    problem_detected: { type: "string" },
                    clinical_impact: { type: "string" },
                    suggested_improvement: { type: "string" },
                    priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                    category: { type: "string", enum: ["safety", "workflow", "ai_performance", "regulation"] },
                    keywords: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "evidence_source", "problem_detected", "clinical_impact", "suggested_improvement", "priority", "category", "keywords"],
                  additionalProperties: false,
                },
              },
            },
            required: ["insights"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_innovation_insights" } },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
    if (response.status === 402) throw new Error("AI credits required. Please add funds.");
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("No structured output from AI");
  const parsed = JSON.parse(toolCall.function.arguments);
  return parsed.insights || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dry_run = false } = await req.json().catch(() => ({}));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Step 1: Ingest from multiple sources
    const query = RESEARCH_QUERIES[Math.floor(Math.random() * RESEARCH_QUERIES.length)];
    const [pubmed, europepmc, telemetry] = await Promise.all([
      fetchPubMed(query, 6),
      fetchEuropePMC(query, 6),
      fetchPlatformTelemetry(sb),
    ]);
    const allPapers = [...pubmed, ...europepmc];

    if (dry_run) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        papers_fetched: allPapers.length,
        telemetry,
        query_used: query,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Steps 2 & 3: Generate insights
    const insights = await generateInsights(allPapers, telemetry, LOVABLE_API_KEY);

    // Step 4: Save to database
    let saved = 0;
    for (const insight of insights) {
      const { error } = await sb.from("innovation_insights").insert({
        title: insight.title,
        evidence_source: insight.evidence_source,
        problem_detected: insight.problem_detected,
        clinical_impact: insight.clinical_impact,
        suggested_improvement: insight.suggested_improvement,
        priority: insight.priority,
        category: insight.category,
        keywords: insight.keywords || [],
        source_urls: allPapers.slice(0, 3).map((p) => p.url),
        status: "pending",
      });
      if (!error) saved++;
    }

    return new Response(JSON.stringify({
      success: true,
      insights_generated: insights.length,
      insights_saved: saved,
      papers_analyzed: allPapers.length,
      telemetry_summary: telemetry.summary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("product-innovation error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
