import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ComplianceRequest {
  diagnoses: string[];
  medications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  tests: string[];
  care_plan: string;
  patient_age?: number;
  patient_sex?: string;
  chief_complaint?: string;
}

interface GuidelineMatch {
  guideline_id: string;
  title: string;
  source: string;
  source_organization: string;
  year: number;
  evidence_grade: string;
  recommendation_text: string;
  guideline_url: string;
}

interface ComplianceResult {
  item: string;
  item_type: "diagnosis" | "medication" | "test" | "care_plan";
  compliance_status: "guideline_aligned" | "evidence_supported" | "review_suggested";
  explanation: string;
  matching_guidelines: GuidelineMatch[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body: ComplianceRequest = await req.json();
    const { diagnoses = [], medications = [], tests = [], care_plan = "", patient_age, patient_sex, chief_complaint } = body;

    // ── Step 1: RAG retrieval — find matching guidelines ──
    const searchTerms = [
      ...diagnoses,
      ...medications.map(m => m.drug_name),
      ...tests,
      chief_complaint,
    ].filter(Boolean);

    // Query clinical_guidelines using keyword matching
    let allGuidelines: any[] = [];
    
    // Search by condition match
    for (const term of searchTerms.slice(0, 6)) {
      const { data } = await sb
        .from("clinical_guidelines")
        .select("*")
        .eq("is_active", true)
        .or(`condition.ilike.%${term}%,clinical_topic.ilike.%${term}%,title.ilike.%${term}%,recommendation_text.ilike.%${term}%`)
        .limit(5);
      if (data) allGuidelines.push(...data);
    }

    // Search by applicable_drugs for medications
    for (const med of medications.slice(0, 4)) {
      const { data } = await sb
        .from("clinical_guidelines")
        .select("*")
        .eq("is_active", true)
        .contains("applicable_drugs", [med.drug_name.toLowerCase()])
        .limit(3);
      if (data) allGuidelines.push(...data);
    }

    // Search by applicable_tests
    for (const test of tests.slice(0, 4)) {
      const { data } = await sb
        .from("clinical_guidelines")
        .select("*")
        .eq("is_active", true)
        .contains("applicable_tests", [test.toLowerCase()])
        .limit(3);
      if (data) allGuidelines.push(...data);
    }

    // Deduplicate
    const seenIds = new Set<string>();
    allGuidelines = allGuidelines.filter(g => {
      if (seenIds.has(g.id)) return false;
      seenIds.add(g.id);
      return true;
    });

    // ── Step 2: AI compliance evaluation ──
    const itemsToEvaluate = [
      ...diagnoses.map(d => ({ item: d, type: "diagnosis" })),
      ...medications.map(m => ({ item: `${m.drug_name} ${m.dose} ${m.frequency}`, type: "medication" })),
      ...tests.map(t => ({ item: t, type: "test" })),
      ...(care_plan ? [{ item: care_plan, type: "care_plan" }] : []),
    ];

    if (itemsToEvaluate.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        results: [],
        guidelines_matched: 0,
        message: "No items to evaluate",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const guidelineContext = allGuidelines.slice(0, 12).map(g =>
      `[${g.source_organization}] ${g.title} (${g.year})\nTopic: ${g.clinical_topic}\nCondition: ${g.condition}\nGrade: ${g.evidence_grade}\nRecommendation: ${g.recommendation_text}\nDrugs: ${(g.applicable_drugs || []).join(", ")}\nTests: ${(g.applicable_tests || []).join(", ")}`
    ).join("\n\n---\n\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a clinical guideline compliance evaluator for DATAelixAIr. Compare AI-generated clinical recommendations against trusted medical guidelines. For each item, classify it as:
- "guideline_aligned": Directly matches a specific guideline recommendation
- "evidence_supported": Consistent with evidence but no exact guideline match found
- "review_suggested": May deviate from guidelines or insufficient evidence

Be conservative — only mark "guideline_aligned" when a clear guideline match exists. Provide a brief explanation (1-2 sentences) for each evaluation. Reference the specific guideline source when applicable.

Patient context: Age ${patient_age || "unknown"}, Sex ${patient_sex || "unknown"}, Chief complaint: ${chief_complaint || "not specified"}.`,
          },
          {
            role: "user",
            content: `Evaluate these clinical recommendations against the guidelines below.

Items to evaluate:
${itemsToEvaluate.map((item, i) => `${i + 1}. [${item.type}] ${item.item}`).join("\n")}

Available Guidelines:
${guidelineContext || "No matching guidelines found in database. Evaluate based on general clinical evidence."}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "evaluate_compliance",
            description: "Evaluate clinical recommendations against guidelines",
            parameters: {
              type: "object",
              properties: {
                evaluations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      item_type: { type: "string", enum: ["diagnosis", "medication", "test", "care_plan"] },
                      compliance_status: { type: "string", enum: ["guideline_aligned", "evidence_supported", "review_suggested"] },
                      explanation: { type: "string" },
                      matching_guideline_source: { type: "string" },
                    },
                    required: ["item", "item_type", "compliance_status", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["evaluations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "evaluate_compliance" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("Rate limit exceeded");
      if (response.status === 402) throw new Error("AI credits required");
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured output from AI");

    const parsed = JSON.parse(toolCall.function.arguments);
    const evaluations = parsed.evaluations || [];

    // Enrich evaluations with matching guideline details
    const results: ComplianceResult[] = evaluations.map((ev: any) => {
      const matchingGuidelines: GuidelineMatch[] = [];
      if (ev.matching_guideline_source) {
        const matched = allGuidelines.filter(g =>
          g.source_organization?.toLowerCase().includes(ev.matching_guideline_source.toLowerCase()) ||
          g.title?.toLowerCase().includes(ev.matching_guideline_source.toLowerCase())
        );
        matched.slice(0, 2).forEach(g => {
          matchingGuidelines.push({
            guideline_id: g.id,
            title: g.title,
            source: g.source,
            source_organization: g.source_organization,
            year: g.year,
            evidence_grade: g.evidence_grade,
            recommendation_text: g.recommendation_text,
            guideline_url: g.guideline_url || "",
          });
        });
      }

      return {
        item: ev.item,
        item_type: ev.item_type,
        compliance_status: ev.compliance_status,
        explanation: ev.explanation,
        matching_guidelines: matchingGuidelines,
      };
    });

    return new Response(JSON.stringify({
      success: true,
      results,
      guidelines_matched: allGuidelines.length,
      guidelines_sources: [...new Set(allGuidelines.map(g => g.source_organization))],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("guideline-compliance error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
