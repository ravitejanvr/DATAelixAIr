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

// ── Step 1: Knowledge ingestion from multiple sources ──

async function fetchPubMed(query: string, max = 6): Promise<Paper[]> {
  try {
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
  } catch (e) {
    console.error("PubMed fetch error:", e);
    return [];
  }
}

async function fetchEuropePMC(query: string, max = 6): Promise<Paper[]> {
  try {
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
  } catch (e) {
    console.error("Europe PMC fetch error:", e);
    return [];
  }
}

async function fetchFDASafetyAlerts(max = 4): Promise<Paper[]> {
  try {
    const url = `https://api.fda.gov/drug/event.json?search=patient.drug.openfda.brand_name:_exists_+AND+serious:1&limit=${max}&sort=receivedate:desc`;
    const res = await fetch(url);
    const data = await res.json();
    return (data?.results || []).map((r: any) => ({
      title: `FDA Safety Alert: ${r.patient?.drug?.[0]?.openfda?.brand_name?.[0] || "Drug Event"} — ${r.patient?.reaction?.[0]?.reactionmeddrapt || "Adverse Event"}`,
      authors: ["U.S. Food and Drug Administration"],
      journal: "FDA FAERS",
      year: parseInt(r.receivedate?.substring(0, 4)) || new Date().getFullYear(),
      abstract: `Serious adverse event reported. Primary suspect: ${r.patient?.drug?.[0]?.medicinalproduct || "Unknown"}. Reaction: ${(r.patient?.reaction || []).map((rx: any) => rx.reactionmeddrapt).join(", ")}. Outcome: ${r.patient?.reaction?.[0]?.reactionoutcome || "Unknown"}.`,
      url: "https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program",
      source: "FDA FAERS",
    }));
  } catch (e) {
    console.error("FDA fetch error:", e);
    return [];
  }
}

async function fetchWHOGuidelines(query: string, max = 4): Promise<Paper[]> {
  try {
    // Use Europe PMC filtered to WHO publications
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query + " (AUTH:\"World Health Organization\" OR SRC:\"WHO\")")}&format=json&pageSize=${max}&sort=DATE_CREATED desc`;
    const res = await fetch(url);
    const data = await res.json();
    return (data?.resultList?.result || []).map((r: any) => ({
      title: r.title || "",
      authors: r.authorString ? r.authorString.split(", ") : ["World Health Organization"],
      journal: r.journalTitle || "WHO Publications",
      year: parseInt(r.pubYear) || new Date().getFullYear(),
      abstract: r.abstractText || "",
      url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
      source: "WHO Guidelines",
    }));
  } catch (e) {
    console.error("WHO fetch error:", e);
    return [];
  }
}

async function fetchNHSAILab(max = 3): Promise<Paper[]> {
  try {
    // Use Europe PMC filtered to NHS / UK digital health AI
    const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent("NHS artificial intelligence healthcare regulation UK")}&format=json&pageSize=${max}&sort=DATE_CREATED desc`;
    const res = await fetch(url);
    const data = await res.json();
    return (data?.resultList?.result || []).map((r: any) => ({
      title: r.title || "",
      authors: r.authorString ? r.authorString.split(", ") : [],
      journal: r.journalTitle || "NHS Digital Health",
      year: parseInt(r.pubYear) || new Date().getFullYear(),
      abstract: r.abstractText || "",
      url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
      source: "NHS AI Lab",
    }));
  } catch (e) {
    console.error("NHS AI Lab fetch error:", e);
    return [];
  }
}

async function fetchPlatformTelemetry(sb: any) {
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
  "clinical AI interoperability FHIR",
  "AI drug interaction detection healthcare",
];

async function generateInsights(papers: Paper[], telemetry: any, apiKey: string) {
  const sourceBreakdown = papers.reduce((acc, p) => {
    acc[p.source] = (acc[p.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const systemPrompt = `You are a Product Innovation Analyst for DATAelixAIr, a clinical AI platform for Indian private clinics. Analyze research papers, safety alerts, and regulatory guidance to generate product improvement insights.

Knowledge sources analyzed: ${Object.entries(sourceBreakdown).map(([k, v]) => `${k}: ${v}`).join(", ")}
Platform telemetry context: ${telemetry.summary}

For each relevant finding, generate a structured innovation insight. Focus on actionable improvements for clinical documentation, AI copilot, safety guardrails, and workflow automation. Output valid JSON array of insights.`;

  const paperSummaries = papers.slice(0, 12).map((p) =>
    `[${p.source}] Title: ${p.title}\nJournal: ${p.journal} (${p.year})\nAbstract: ${p.abstract || "N/A"}\nURL: ${p.url}`
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
        { role: "user", content: `Analyze these research papers, safety alerts, and guidelines to generate 3-6 product innovation insights:\n\n${paperSummaries}\n\nPlatform Data:\n- AI output edit rate: ${telemetry.ai_output_edits} edits\n- Safety overrides: ${telemetry.safety_overrides}\n- System failure rate: ${telemetry.failure_rate}%` },
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
    const { dry_run = false, generate_summary = false } = await req.json().catch(() => ({}));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Step 1: Ingest from all knowledge sources in parallel
    const query = RESEARCH_QUERIES[Math.floor(Math.random() * RESEARCH_QUERIES.length)];
    const [pubmed, europepmc, fda, who, nhs, telemetry] = await Promise.all([
      fetchPubMed(query, 6),
      fetchEuropePMC(query, 6),
      fetchFDASafetyAlerts(4),
      fetchWHOGuidelines("artificial intelligence healthcare", 4),
      fetchNHSAILab(3),
      fetchPlatformTelemetry(sb),
    ]);
    const allPapers = [...pubmed, ...europepmc, ...fda, ...who, ...nhs];

    const sourceBreakdown = {
      pubmed: pubmed.length,
      europepmc: europepmc.length,
      fda: fda.length,
      who: who.length,
      nhs: nhs.length,
      total: allPapers.length,
    };

    if (dry_run) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        sources: sourceBreakdown,
        telemetry,
        query_used: query,
        sample_papers: allPapers.slice(0, 3).map(p => ({ title: p.title, source: p.source })),
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
        source_urls: allPapers.filter(p => p.source === insight.evidence_source || insight.evidence_source.includes(p.source)).slice(0, 3).map(p => p.url),
        status: "pending",
      });
      if (!error) saved++;
    }

    // Step 5: Generate daily summary if requested
    let summary = null;
    if (generate_summary && saved > 0) {
      const summaryResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: "You are a concise healthcare AI product analyst. Generate a brief daily digest (5-8 bullet points) summarizing the most important innovation insights for a platform owner. Be actionable and specific." },
            { role: "user", content: `Today's innovation analysis:\n\nSources scanned: ${JSON.stringify(sourceBreakdown)}\n\nInsights generated:\n${insights.map((i: any) => `- [${i.priority.toUpperCase()}] ${i.title}: ${i.suggested_improvement}`).join("\n")}\n\nPlatform health: ${telemetry.summary}` },
          ],
        }),
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        summary = summaryData.choices?.[0]?.message?.content || null;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      insights_generated: insights.length,
      insights_saved: saved,
      sources: sourceBreakdown,
      telemetry_summary: telemetry.summary,
      daily_summary: summary,
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
