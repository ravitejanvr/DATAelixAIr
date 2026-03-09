import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { paper } = await req.json();
    if (!paper?.title) {
      return new Response(JSON.stringify({ success: false, error: "Paper metadata required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a healthcare AI research editor for DATAelixAIr. Given a research paper's metadata and abstract, generate a structured article draft. Output valid JSON with fields: title (string), summary (string, 2-3 sentences), key_findings (string[], 3-5 bullet points), clinical_implications (string, 2-3 sentences), category (one of: "Clinical AI & Decision Support", "Patient Safety & Clinical Governance", "Healthcare Operations & Workflow", "Digital Health & Interoperability", "Research & Evidence"), keywords (string[], 3-5 terms). Keep language precise, clinical, and evidence-based.`;

    const userPrompt = `Research Paper:
Title: ${paper.title}
Authors: ${(paper.authors || []).join(", ")}
Journal: ${paper.journal || "Unknown"}
Year: ${paper.year || "Unknown"}
Abstract: ${paper.abstract || "Not available"}

Generate a structured article draft.`;

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
                key_findings: { type: "array", items: { type: "string" } },
                clinical_implications: { type: "string" },
                category: { type: "string", enum: ["Clinical AI & Decision Support", "Patient Safety & Clinical Governance", "Healthcare Operations & Workflow", "Digital Health & Interoperability", "Research & Evidence"] },
                keywords: { type: "array", items: { type: "string" } },
              },
              required: ["title", "summary", "key_findings", "clinical_implications", "category", "keywords"],
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

    return new Response(JSON.stringify({
      success: true,
      draft: {
        ...draft,
        status: "Draft",
        source_paper: { title: paper.title, url: paper.url, journal: paper.journal, year: paper.year },
        generated_at: new Date().toISOString(),
      },
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
