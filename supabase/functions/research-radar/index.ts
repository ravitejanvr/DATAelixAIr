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

// ── Step 1: Fetch research from PubMed + Europe PMC ──
async function fetchPubMed(query: string, max = 8): Promise<Paper[]> {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max}&sort=date&retmode=json`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const ids: string[] = searchData?.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const fetchRes = await fetch(fetchUrl);
  const fetchData = await fetchRes.json();

  const papers: Paper[] = [];
  for (const id of ids) {
    const item = fetchData?.result?.[id];
    if (!item) continue;
    papers.push({
      title: item.title || "",
      authors: (item.authors || []).map((a: any) => a.name),
      journal: item.fulljournalname || item.source || "",
      year: parseInt(item.pubdate?.split(" ")[0]) || new Date().getFullYear(),
      abstract: "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: "PubMed",
    });
  }
  return papers;
}

async function fetchEuropePMC(query: string, max = 8): Promise<Paper[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${max}&sort=DATE_CREATED desc`;
  const res = await fetch(url);
  const data = await res.json();
  const results = data?.resultList?.result || [];
  return results.map((r: any) => ({
    title: r.title || "",
    authors: r.authorString ? r.authorString.split(", ") : [],
    journal: r.journalTitle || "",
    year: parseInt(r.pubYear) || new Date().getFullYear(),
    abstract: r.abstractText || "",
    url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
    source: "Europe PMC",
  }));
}

// ── Step 2: Relevance scoring ──
const HIGH_IMPACT_JOURNALS = [
  "lancet", "bmj", "jama", "nature", "nejm", "npj digital medicine",
  "plos medicine", "annals of internal medicine", "scientific american",
];

const RELEVANCE_KEYWORDS = [
  "artificial intelligence", "machine learning", "clinical decision",
  "patient safety", "electronic health record", "clinical documentation",
  "ai diagnosis", "deep learning", "natural language processing",
  "healthcare automation", "drug interaction", "clinical workflow",
  "telemedicine", "digital health", "medical ai",
];

function scoreRelevance(paper: Paper): number {
  let score = 0;
  const text = `${paper.title} ${paper.abstract}`.toLowerCase();

  // Keyword relevance (0-50)
  for (const kw of RELEVANCE_KEYWORDS) {
    if (text.includes(kw)) score += 10;
  }
  score = Math.min(score, 50);

  // Journal reputation (0-30)
  const jLower = paper.journal.toLowerCase();
  if (HIGH_IMPACT_JOURNALS.some((j) => jLower.includes(j))) score += 30;
  else if (jLower.includes("med") || jLower.includes("health") || jLower.includes("clinical")) score += 15;

  // Recency (0-20)
  const currentYear = new Date().getFullYear();
  if (paper.year >= currentYear) score += 20;
  else if (paper.year >= currentYear - 1) score += 10;

  return score;
}

const RELEVANCE_THRESHOLD = 20;

// ── Step 3: AI insight generation ──
async function generateInsight(paper: Paper, apiKey: string) {
  const systemPrompt = `You are a healthcare AI research analyst for DATAelixAIr. Given a research paper's metadata and abstract, generate a structured insight. Output valid JSON with: title (string), summary (string, 2-3 sentences), key_findings (string[], 3-5 bullets), clinical_implications (string, 2-3 sentences), why_it_matters (string, 1-2 sentences explaining relevance to healthcare AI), category (one of: "Clinical AI & Decision Support", "Patient Safety & Clinical Governance", "Healthcare Operations & Workflow", "Digital Health & Interoperability", "Research & Evidence"), keywords (string[], 3-5 terms). Keep language precise, clinical, and evidence-based.`;

  const userPrompt = `Research Paper:\nTitle: ${paper.title}\nAuthors: ${paper.authors.slice(0, 5).join(", ")}\nJournal: ${paper.journal}\nYear: ${paper.year}\nAbstract: ${paper.abstract || "Not available"}\n\nGenerate a structured insight.`;

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
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_research_insight",
          description: "Create a structured research insight from paper metadata.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              key_findings: { type: "array", items: { type: "string" } },
              clinical_implications: { type: "string" },
              why_it_matters: { type: "string" },
              category: { type: "string", enum: ["Clinical AI & Decision Support", "Patient Safety & Clinical Governance", "Healthcare Operations & Workflow", "Digital Health & Interoperability", "Research & Evidence"] },
              keywords: { type: "array", items: { type: "string" } },
            },
            required: ["title", "summary", "key_findings", "clinical_implications", "why_it_matters", "category", "keywords"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "create_research_insight" } },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw new Error("RATE_LIMIT");
    if (status === 402) throw new Error("CREDITS_REQUIRED");
    throw new Error(`AI gateway error: ${status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("No structured output from AI");
  return JSON.parse(toolCall.function.arguments);
}

// ── Step 4: Save as draft article ──
function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query = "clinical AI healthcare patient safety", max_results = 6, dry_run = false } = await req.json().catch(() => ({}));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Step 1: Fetch
    const [pubmed, europepmc] = await Promise.all([
      fetchPubMed(query, max_results),
      fetchEuropePMC(query, max_results),
    ]);
    const allPapers = [...pubmed, ...europepmc];

    // Step 2: Score & filter
    const scored = allPapers
      .map((p) => ({ paper: p, score: scoreRelevance(p) }))
      .filter((s) => s.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (dry_run) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        total_fetched: allPapers.length,
        above_threshold: scored.length,
        papers: scored.map((s) => ({ title: s.paper.title, score: s.score, journal: s.paper.journal })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 3 & 4: Generate insights + save as drafts
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const results: any[] = [];
    for (const { paper, score } of scored) {
      try {
        const insight = await generateInsight(paper, LOVABLE_API_KEY);
        const slug = generateSlug(insight.title || paper.title);

        // Check if slug already exists
        const { data: existing } = await sb.from("blog_articles").select("id").eq("slug", slug).maybeSingle();
        if (existing) {
          results.push({ title: paper.title, status: "skipped", reason: "already exists" });
          continue;
        }

        const content = [
          `## Summary\n\n${insight.summary}`,
          `## Key Findings\n\n${(insight.key_findings || []).map((f: string) => `- ${f}`).join("\n")}`,
          `## Clinical Implications\n\n${insight.clinical_implications}`,
          `## Why It Matters\n\n${insight.why_it_matters}`,
        ].join("\n\n");

        const { error } = await sb.from("blog_articles").insert({
          title: insight.title || paper.title,
          slug,
          summary: insight.summary,
          content,
          category: insight.category || "Research & Evidence",
          keywords: insight.keywords || [],
          key_findings: insight.key_findings || [],
          clinical_implications: insight.clinical_implications,
          source_type: "Research",
          source_name: paper.source,
          source_url: paper.url,
          source_journal: paper.journal,
          source_year: paper.year,
          author: paper.authors.slice(0, 3).join(", ") || "Research Team",
          reading_time_min: 4,
          status: "draft",
          related_platform_features: [],
        });

        results.push({
          title: insight.title || paper.title,
          score,
          status: error ? "error" : "drafted",
          error: error?.message,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown";
        if (msg === "RATE_LIMIT" || msg === "CREDITS_REQUIRED") {
          results.push({ title: paper.title, status: "error", error: msg });
          break; // Stop processing on rate limit
        }
        results.push({ title: paper.title, status: "error", error: msg });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_fetched: allPapers.length,
      above_threshold: scored.length,
      processed: results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("research-radar error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("RATE_LIMIT") ? 429 : msg.includes("CREDITS") ? 402 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
