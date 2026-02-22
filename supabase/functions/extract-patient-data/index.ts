import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "Transcript is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a medical data extraction assistant. Given a doctor's voice transcription about a patient, extract structured patient data.

You MUST call the extract_patient_data function with the extracted fields. Only include fields that are clearly mentioned in the transcript. Leave fields empty if not mentioned.

Guidelines:
- name: Patient's name
- age: Patient's age as a number string
- gender: "male", "female", or "other"
- conditions: Comma-separated medical conditions and lab values (e.g. "Type 2 Diabetes, HbA1c 7.8")
- symptoms: Comma-separated symptoms and history (e.g. "blurring vision 2 months, headache")
- ethnicity: Ethnic background if mentioned
- medications: Comma-separated current medications (e.g. "Metformin 500mg, Atorvastatin")
- clinicalQuery: The doctor's question or what they want assessed`;

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
          { role: "user", content: `Doctor's voice transcript:\n\n"${transcript}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_patient_data",
              description: "Extract structured patient data from the transcript",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Patient name" },
                  age: { type: "string", description: "Patient age" },
                  gender: { type: "string", enum: ["male", "female", "other"], description: "Patient gender" },
                  conditions: { type: "string", description: "Comma-separated conditions and lab values" },
                  symptoms: { type: "string", description: "Comma-separated symptoms and history" },
                  ethnicity: { type: "string", description: "Ethnic background" },
                  medications: { type: "string", description: "Comma-separated current medications" },
                  clinicalQuery: { type: "string", description: "What the doctor wants assessed" },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_patient_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
