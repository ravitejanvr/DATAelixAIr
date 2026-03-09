import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Trusted source whitelist — only these domains are allowed */
const TRUSTED_SOURCES: Record<string, { label: string; searchQuery: string }> = {
  "nature.com": { label: "Nature Digital Medicine", searchQuery: "site:nature.com digital medicine clinical AI" },
  "mckinsey.com": { label: "McKinsey Health", searchQuery: "site:mckinsey.com healthcare AI clinical" },
  "who.int": { label: "WHO Guidelines", searchQuery: "site:who.int clinical guidelines digital health" },
  "nhsx.nhs.uk": { label: "NHS AI Lab", searchQuery: "site:nhsx.nhs.uk AI clinical" },
  "sciencedirect.com": { label: "ScienceDirect", searchQuery: "site:sciencedirect.com clinical AI healthcare" },
  "gov.health": { label: "Government Health", searchQuery: "government health department clinical AI guidelines" },
};

/** Keyword → platform feature mapping for auto-linking */
const KEYWORD_FEATURE_MAP: Record<string, { text: string; link: string }> = {
  "ai documentation": {
    text: "The DATAelixAIr Clinical Documentation Workspace addresses this by allowing clinicians to review and edit AI-generated SOAP notes before finalization.",
    link: "/clinical",
  },
  "clinical safety": {
    text: "The DATAelixAIr Clinical Guardrail Engine verifies AI outputs against trusted medical guidelines before they reach the patient record.",
    link: "/vision",
  },
  "ai decision support": {
    text: "The DATAelixAIr AI Copilot provides decision support while keeping the clinician in full control of clinical judgement.",
    link: "/vision",
  },
  "clinical governance": {
    text: "DATAelixAIr's Trust & Governance Layer ensures every AI action is auditable, explainable, and clinically validated.",
    link: "/vision",
  },
  "drug interaction": {
    text: "DATAelixAIr's Medication Safety Engine automatically cross-references prescriptions against known drug interaction databases in real-time.",
    link: "/vision",
  },
  "clinical workflow": {
    text: "The DATAelixAIr Workflow Automation Engine streamlines consultation pipelines from recording to structured clinical output.",
    link: "/clinical",
  },
  "patient safety": {
    text: "DATAelixAIr embeds patient safety checks throughout the clinical workflow, from prescription validation to diagnostic consistency verification.",
    link: "/vision",
  },
  "interoperability": {
    text: "DATAelixAIr follows FHIR-ready data architecture principles to support healthcare interoperability across clinical systems.",
    link: "/vision",
  },
  "medical records": {
    text: "DATAelixAIr generates structured, reviewable clinical records from consultation audio, ensuring accuracy and completeness.",
    link: "/clinical",
  },
};

/** Generate the Platform Insight section appended to every article */
function generatePlatformInsight(keywords: string[]): string {
  const matched = keywords.find(k => KEYWORD_FEATURE_MAP[k.toLowerCase()]);
  const feature = matched ? KEYWORD_FEATURE_MAP[matched.toLowerCase()] : null;

  const insightText = feature
    ? feature.text
    : "DATAelixAIr is designed with a Clinical Guardrail Engine that verifies AI outputs against trusted medical guidelines before they reach the patient record.";

  return `\n\n---\n\n## Platform Insight\n\n${insightText}\n\n[Learn more about DATAelixAIr →](/vision)`;
}

/** Insert contextual platform references into article content */
function insertPlatformLinks(content: string, keywords: string[]): string {
  let enriched = content;
  const used = new Set<string>();

  for (const [keyword, ref] of Object.entries(KEYWORD_FEATURE_MAP)) {
    if (used.size >= 3) break; // max 3 insertions
    const regex = new RegExp(`(${keyword})`, "gi");
    if (regex.test(enriched) && !used.has(keyword)) {
      used.add(keyword);
      enriched = enriched.replace(regex, `$1. ${ref.text}`);
    }
  }

  // Also check keywords array
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (KEYWORD_FEATURE_MAP[lower] && !used.has(lower)) {
      if (used.size >= 3) break;
      used.add(lower);
    }
  }

  return enriched;
}

/** Validate that a URL belongs to a trusted source */
function isTrustedSource(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return Object.keys(TRUSTED_SOURCES).some(domain => lower.includes(domain)) ||
    lower.includes(".gov") || lower.includes("government");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paper, source_filter } = await req.json();
    if (!paper?.title) {
      return new Response(JSON.stringify({ success: false, error: "Paper metadata required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate source against whitelist
    if (paper.url && !isTrustedSource(paper.url)) {
      return new Response(JSON.stringify({
        success: false,
        error: "Source rejected: URL does not belong to a trusted source. Only whitelisted domains (nature.com, mckinsey.com, who.int, nhsx.nhs.uk, sciencedirect.com, government health sites) are allowed.",
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a healthcare AI research editor for DATAelixAIr. Given a research paper's metadata and abstract, generate a structured article draft. Output valid JSON with fields: title (string), summary (string, 2-3 sentences), content (string, 400-600 word markdown article body with sections), key_findings (string[], 3-5 bullet points), clinical_implications (string, 2-3 sentences), policy_implications (string, 2-3 sentences about regulatory/policy impact), category (one of: "Clinical AI & Decision Support", "Patient Safety & Clinical Governance", "Healthcare Operations & Workflow", "Digital Health & Interoperability", "Research & Evidence"), keywords (string[], 3-5 terms), meta_title (string, max 60 chars, SEO optimized), meta_description (string, max 160 chars, SEO optimized), reading_time_min (number, estimated reading time). Keep language precise, clinical, and evidence-based.`;

    const userPrompt = `Research Paper:
Title: ${paper.title}
Authors: ${(paper.authors || []).join(", ")}
Journal: ${paper.journal || "Unknown"}
Year: ${paper.year || "Unknown"}
Abstract: ${paper.abstract || "Not available"}
Source: ${paper.url || "Unknown"}
${source_filter ? `Source Filter: ${source_filter}` : ""}

Generate a structured article draft with full content body, meta fields, and policy implications.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
            name: "create_article_draft",
            description: "Create a structured article draft from research paper metadata.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                content: { type: "string" },
                key_findings: { type: "array", items: { type: "string" } },
                clinical_implications: { type: "string" },
                policy_implications: { type: "string" },
                category: { type: "string", enum: ["Clinical AI & Decision Support", "Patient Safety & Clinical Governance", "Healthcare Operations & Workflow", "Digital Health & Interoperability", "Research & Evidence"] },
                keywords: { type: "array", items: { type: "string" } },
                meta_title: { type: "string" },
                meta_description: { type: "string" },
                reading_time_min: { type: "number" },
              },
              required: ["title", "summary", "content", "key_findings", "clinical_implications", "policy_implications", "category", "keywords", "meta_title", "meta_description", "reading_time_min"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_article_draft" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "AI credits required. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let draft;
    if (toolCall?.function?.arguments) {
      draft = JSON.parse(toolCall.function.arguments);
    } else {
      throw new Error("No structured output from AI");
    }

    // Enrich content with platform links and insight section
    let enrichedContent = draft.content || "";
    enrichedContent = insertPlatformLinks(enrichedContent, draft.keywords || []);
    enrichedContent += generatePlatformInsight(draft.keywords || []);

    return new Response(JSON.stringify({
      success: true,
      draft: {
        ...draft,
        content: enrichedContent,
        publish_date: new Date().toISOString().split("T")[0],
        status: "Draft",
        source_paper: { title: paper.title, url: paper.url, journal: paper.journal, year: paper.year },
        generated_at: new Date().toISOString(),
      },
      trusted_sources: TRUSTED_SOURCES,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("draft-article error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
