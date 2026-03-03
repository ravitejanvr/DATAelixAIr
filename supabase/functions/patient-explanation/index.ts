import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { soap_summary, language } = await req.json();

    if (!soap_summary || typeof soap_summary !== "string") {
      return new Response(JSON.stringify({ error: "soap_summary required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLang = language === "telugu" ? "Telugu" : "English";
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a patient communication assistant. Convert the following clinical SOAP summary into a simple, patient-friendly explanation in ${targetLang}.

Rules:
- Use simple, everyday language a patient can understand
- No medical jargon — explain conditions in plain terms
- Keep it brief (max 10 sentences)
- Conservative, reassuring tone
- Do NOT add any information not in the original summary
- Do NOT give medical advice beyond what the doctor has prescribed
- End with: "This explanation does not replace medical advice. Please follow your doctor's instructions."
${targetLang === "Telugu" ? "- Use Telugu script (తెలుగు)" : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: soap_summary },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 402) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${res.status}`);
    }

    const data = await res.json();
    const explanation = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ explanation, language: targetLang.toLowerCase() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("patient-explanation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
