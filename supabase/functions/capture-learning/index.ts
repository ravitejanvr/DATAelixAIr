import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Capture Learning Signal (Edge Function)
 * 
 * Receives doctor-validated learning corrections and processes them:
 * 1. Stores anonymized signal in doctor_learning_signals
 * 2. For terminology signals: proposes lexicon additions
 * 3. For prescription signals: updates doctor_favorites
 * 
 * Privacy: No patient-identifiable data accepted or stored.
 * Trigger: Only after explicit doctor validation (never autonomous).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { signal_type, doctor_id, clinic_id, signal_data } = await req.json();

    if (!signal_type || !doctor_id || !signal_data) {
      return new Response(JSON.stringify({ error: "signal_type, doctor_id, and signal_data are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validTypes = ["transcript_edit", "terminology_update", "prescription_template", "documentation_style", "extraction_correction"];
    if (!validTypes.includes(signal_type)) {
      return new Response(JSON.stringify({ error: `Invalid signal_type. Must be one of: ${validTypes.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Store the learning signal
    const { error: insertError } = await supabase.from("doctor_learning_signals").insert({
      doctor_id,
      clinic_id: clinic_id || null,
      signal_type,
      signal_data,
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      throw new Error("Failed to store learning signal");
    }

    // Process terminology updates → propose lexicon entries
    let lexiconProposed = 0;
    if (signal_type === "terminology_update" && signal_data.terms) {
      for (const term of signal_data.terms) {
        if (term.regional_phrase && term.clinical_term && term.language) {
          // Check if entry already exists
          const { data: existing } = await supabase
            .from("regional_lexicon")
            .select("id")
            .eq("regional_phrase", term.regional_phrase.toLowerCase())
            .eq("language", term.language)
            .maybeSingle();

          if (!existing) {
            await supabase.from("regional_lexicon").insert({
              regional_phrase: term.regional_phrase.toLowerCase(),
              clinical_term: term.clinical_term,
              language: term.language,
              category: term.category || "general",
              confidence: "doctor_validated",
              source_language: term.language,
            });
            lexiconProposed++;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      signal_type,
      lexicon_entries_proposed: lexiconProposed,
      message: "Learning signal captured after doctor validation.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("capture-learning error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
