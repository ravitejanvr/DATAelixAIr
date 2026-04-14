import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_input, session_state, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a clinical intake assistant. Your job is TWO things:

1. EXTRACT clinical entities from the user's input
2. GENERATE the next best follow-up question based on what's known and what's missing

RULES:
- Respond ONLY via the tool call, never as plain text
- Extract ALL clinical information from the input (symptoms, duration, severity, associated symptoms, risk factors, medications, allergies, demographics)
- For the next question: look at collected_fields to see what's already known. Only ask about MISSING information.
- Question priority: chief_complaint → severity → duration → associated_symptoms → red_flags → risk_factors → medications → allergies → demographics
- If the user says "no" / "none" / "nahi" / "levu" to a question about allergies/medications/history, mark that field as collected with value "none"
- Generate the question in the SAME language as the user input
- Make questions conversational and natural (2nd person: "you"/"మీ"/"आप")
- NEVER repeat a question about something already collected
- Include an acknowledgment of what you understood from the user's input`;

    const collectedSummary = session_state?.collected_fields
      ? Object.entries(session_state.collected_fields)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join("\n")
      : "Nothing collected yet";

    const userPrompt = `Language: ${language || "auto-detect"}
User input: "${user_input}"

Already collected information:
${collectedSummary}

Extract entities from the input and generate the next follow-up question.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "process_clinical_input",
              description: "Extract clinical entities and generate the next question",
              parameters: {
                type: "object",
                properties: {
                  extracted_entities: {
                    type: "object",
                    description: "Clinical entities extracted from user input",
                    properties: {
                      symptoms: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string", description: "Symptom name in English for canonical mapping" },
                            original_text: { type: "string", description: "Original text as spoken by user" },
                          },
                          required: ["name"],
                        },
                      },
                      duration: { type: "string", description: "Duration if mentioned (e.g. '2 days', '1 week')" },
                      severity: { type: "string", enum: ["mild", "moderate", "severe", "unknown"] },
                      associated_symptoms: {
                        type: "array",
                        items: { type: "string" },
                        description: "Associated symptoms mentioned (e.g. chills, nausea)",
                      },
                      risk_factors: {
                        type: "array",
                        items: { type: "string" },
                        description: "Risk factors mentioned (e.g. smoking, diabetes)",
                      },
                      medications: {
                        type: "array",
                        items: { type: "string" },
                      },
                      allergies: {
                        type: "array",
                        items: { type: "string" },
                        description: "Allergies. Use ['none'] if user explicitly denies",
                      },
                      age: { type: "number" },
                      sex: { type: "string", enum: ["male", "female", "other"] },
                      negations: {
                        type: "array",
                        items: { type: "string" },
                        description: "Things the user explicitly denied (e.g. 'no vomiting')",
                      },
                    },
                    required: ["symptoms"],
                  },
                  acknowledgment: {
                    type: "string",
                    description: "Brief acknowledgment of what was understood, in user's language",
                  },
                  next_question: {
                    type: "object",
                    properties: {
                      text: { type: "string", description: "The follow-up question in user's language" },
                      field: {
                        type: "string",
                        description: "Which field this question targets",
                        enum: [
                          "chief_complaint", "severity", "duration",
                          "associated_symptoms", "red_flags", "risk_factors",
                          "medications", "allergies", "age", "sex",
                          "medical_history", "family_history",
                        ],
                      },
                      options: {
                        type: "array",
                        items: { type: "string" },
                        description: "Optional: quick-reply options in user's language",
                      },
                      priority: {
                        type: "string",
                        enum: ["critical", "high", "medium", "low"],
                      },
                    },
                    required: ["text", "field", "priority"],
                  },
                  all_fields_collected: {
                    type: "boolean",
                    description: "True if minimum clinical context is met and no more questions needed",
                  },
                },
                required: ["extracted_entities", "acknowledgment", "next_question", "all_fields_collected"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "process_clinical_input" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured output from AI" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clinical-entity-extraction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
