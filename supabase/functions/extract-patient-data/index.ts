import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "Transcript is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a conservative clinical data extraction assistant for doctors in Hyderabad, India.

Given a consultation transcript (which may be in English, Hindi, Telugu, Urdu, or code-mixed), extract ONLY clearly mentioned clinical facts.

RULES:
- Extract ONLY what is explicitly stated in the transcript
- Do NOT infer or assume anything not mentioned
- Leave fields as empty strings if not clearly mentioned
- Be conservative — when in doubt, leave blank
- Preserve medical terms and drug names exactly as spoken
- For vitals, include units if mentioned (e.g. "BP 130/80 mmHg")

You MUST call the extract_clinical_data function with the extracted fields.`;

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
          { role: "user", content: `Consultation transcript:\n\n"${transcript}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_clinical_data",
              description: "Extract structured clinical data from a consultation transcript",
              parameters: {
                type: "object",
                properties: {
                  chief_complaint: { type: "string", description: "Primary reason for visit" },
                  duration: { type: "string", description: "Duration of symptoms (e.g. '2 weeks', '3 days')" },
                  associated_symptoms: { type: "string", description: "Comma-separated associated symptoms" },
                  vitals: { type: "string", description: "Any mentioned vitals: BP, HR, temp, SpO2, weight, etc." },
                  chronic_conditions: { type: "string", description: "Comma-separated chronic/existing conditions" },
                  current_medications: { type: "string", description: "Comma-separated current medications with dosages if mentioned" },
                  allergies: { type: "string", description: "Comma-separated known allergies" },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_clinical_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured data");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-patient-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
