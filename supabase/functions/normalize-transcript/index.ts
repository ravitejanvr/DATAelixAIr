import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Normalize Clinical Transcript
 * 
 * Pipeline: Raw transcript → Lexicon lookup → Annotated output
 * 
 * This function:
 * 1. Loads the regional_lexicon from the database
 * 2. Scans the transcript for matching phrases (longest match first)
 * 3. Returns the original text with clinical annotations inline
 * 4. Detects languages present in the transcript
 * 5. Increments usage_count for matched phrases
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(JSON.stringify({ error: "transcript is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load full lexicon (cached per cold start)
    const { data: lexicon, error: lexError } = await supabase
      .from("regional_lexicon")
      .select("id, regional_phrase, clinical_term, category, language")
      .order("regional_phrase", { ascending: false }); // Longer phrases first for greedy matching

    if (lexError) {
      console.error("Lexicon fetch error:", lexError);
      throw new Error("Failed to load clinical lexicon");
    }

    // Sort by phrase length descending for longest-match-first
    const sortedLexicon = (lexicon || []).sort(
      (a, b) => b.regional_phrase.length - a.regional_phrase.length
    );

    // Normalize: scan transcript for matches
    let normalizedText = transcript;
    const matchedTerms: Array<{
      original: string;
      clinical: string;
      category: string;
      language: string;
    }> = [];
    const matchedIds: string[] = [];
    const detectedLanguages = new Set<string>();

    // Always mark English as detected
    detectedLanguages.add("english");

    for (const entry of sortedLexicon) {
      const phrase = entry.regional_phrase.toLowerCase();
      const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");

      if (regex.test(normalizedText.toLowerCase())) {
        matchedTerms.push({
          original: entry.regional_phrase,
          clinical: entry.clinical_term,
          category: entry.category,
          language: entry.language,
        });
        matchedIds.push(entry.id);
        detectedLanguages.add(entry.language);

        // Annotate inline: "gas trouble" → "gas trouble [gastritis]"
        normalizedText = normalizedText.replace(regex, (match) => {
          // Don't double-annotate
          return `${match} [${entry.clinical_term}]`;
        });
      }
    }

    // Increment usage counts for matched phrases (fire-and-forget)
    if (matchedIds.length > 0) {
      supabase.rpc("increment_lexicon_usage", { ids: matchedIds }).catch(() => {});
    }

    return new Response(JSON.stringify({
      normalized_transcript: normalizedText,
      original_transcript: transcript,
      matched_terms: matchedTerms,
      detected_languages: Array.from(detectedLanguages),
      match_count: matchedTerms.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("normalize-transcript error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
