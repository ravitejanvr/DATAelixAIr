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
    const { text, sourceLang, targetLang } = await req.json();

    if (!text || !sourceLang || !targetLang) {
      return new Response(JSON.stringify({ error: "text, sourceLang, and targetLang are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a medical translator. Translate the following clinical text from ${sourceLang} to ${targetLang}. 
Preserve all medical terminology, drug names, dosages, and numbers exactly as they are. 
Keep proper nouns (patient names, places) unchanged.
Return ONLY the translated text, no explanations.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        temperature: 0.2,
      }),
    });

    if (response.status === 429 || response.status === 402) {
      return new Response(JSON.stringify({ error: "AI service rate limited. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const translated = result.choices?.[0]?.message?.content?.trim() || "";

    return new Response(JSON.stringify({ translated, sourceLang, targetLang }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Translation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
