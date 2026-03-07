import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Stabilize Transcript (Enhanced Pipeline)
 * 
 * Full pipeline:
 *   1. Clinical vocabulary normalization (lexicon lookup)
 *   2. Language detection
 *   3. AI-powered stabilization (Gemini, temp 0.1)
 * 
 * The lexicon annotations are embedded as hints for the AI stabilizer
 * so it can produce a clean, medically interpretable transcript.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "Transcript is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: Lexicon-based normalization ───────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: lexicon } = await supabase
      .from("regional_lexicon")
      .select("regional_phrase, clinical_term, category, language");

    const sortedLexicon = (lexicon || []).sort(
      (a: any, b: any) => b.regional_phrase.length - a.regional_phrase.length
    );

    let annotatedTranscript = transcript;
    const matchedTerms: Array<{ original: string; clinical: string; category: string; language: string }> = [];
    const detectedLanguages = new Set<string>(["english"]);

    for (const entry of sortedLexicon) {
      const phrase = entry.regional_phrase.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
      if (regex.test(annotatedTranscript.toLowerCase())) {
        matchedTerms.push({
          original: entry.regional_phrase,
          clinical: entry.clinical_term,
          category: entry.category,
          language: entry.language,
        });
        detectedLanguages.add(entry.language);
      }
    }

    // Build lexicon context for the AI
    const lexiconContext = matchedTerms.length > 0
      ? `\n\nClinical vocabulary matches found in this transcript:\n${matchedTerms.map(m => `- "${m.original}" → ${m.clinical} (${m.category})`).join("\n")}\nUse these mappings to inform your understanding but do NOT replace the original terms in the output.`
      : "";

    const languageContext = detectedLanguages.size > 1
      ? `\nDetected languages: ${Array.from(detectedLanguages).join(", ")}. This is a multilingual consultation.`
      : "";

    // ── Step 2: AI Stabilization with lexicon context ────────
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a conservative multilingual clinical transcript stabilizer for a healthcare platform in Hyderabad, India.

Rules:
- Do NOT translate between languages.
- Do NOT summarize.
- Do NOT infer medical meaning beyond what is explicitly stated.
- Do NOT restructure content or reorder sentences.
- Preserve sentence order exactly.
- Preserve Telugu, Hindi, Urdu words exactly as spoken.
- Preserve negations strictly (no, ledu, nahi, without, denies).
- Correct obvious English medical term splits (e.g., "Meta form in" → "Metformin", "para ceta mol" → "Paracetamol").
- Remove immediate repetition (e.g., "pain pain in chest" → "pain in chest").
- If unsure about a word, keep it and append [?].
- Never introduce new symptoms or diagnoses.
- Return ONLY the stabilized transcript text. No explanations, no labels, no markdown.
${lexiconContext}${languageContext}

Example:
Input: "patient ki gunde noppy ledu but gas problem undi sugar bhi hai"
Output: "patient ki gunde noppi[?] ledu but gas problem undi sugar bhi hai"

Never output: "No cardiac pain but gastritis. Has diabetes."`;

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

    // ── Step 3: Return enriched result ────────────────────────
    return new Response(JSON.stringify({
      stabilized_transcript: stabilized,
      original_transcript: transcript,
      normalization_results: matchedTerms,
      detected_languages: Array.from(detectedLanguages),
      match_count: matchedTerms.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stabilize-transcript error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
