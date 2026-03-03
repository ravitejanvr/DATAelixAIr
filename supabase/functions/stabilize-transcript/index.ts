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

    const systemPrompt = `You are a conservative multilingual clinical transcript stabilizer.

Rules:
- Do NOT translate between languages.
- Do NOT summarize.
- Do NOT infer medical meaning.
- Do NOT restructure content.
- Preserve sentence order.
- Preserve Telugu, Hindi, Urdu words exactly.
- Preserve negations strictly (no, ledu, nahi, without, denies).
- Correct obvious English medical term splits (e.g., "Meta form in" → "Metformin", "para ceta mol" → "Paracetamol").
- Remove immediate repetition (e.g., "pain pain in chest" → "pain in chest").
- If unsure about a word, keep it and append [?].
- Never introduce new symptoms or diagnoses.
- Return ONLY the stabilized transcript text. No explanations, no labels, no formatting.

Example:
Input: "patient ki gunde noppy ledu but gas problem undi"
Output: "patient ki gunde noppi[?] ledu but gas problem undi"

Never output: "No cardiac pain but gastritis."`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
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
    const stabilized = result.choices?.[0]?.message?.content?.trim();

    if (!stabilized) {
      throw new Error("AI did not return stabilized text");
    }

    return new Response(JSON.stringify({ stabilized_transcript: stabilized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stabilize-transcript error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
