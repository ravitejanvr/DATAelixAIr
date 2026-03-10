import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { drug_input } = await req.json();
    if (!drug_input || typeof drug_input !== "string") {
      return new Response(JSON.stringify({ error: "drug_input string required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const input = drug_input.trim();

    // --- STEP 1: Extract dose, frequency code, and drug name ---
    // Known frequency codes
    const freqCodes = ["QID", "TID", "BD", "OD", "SOS"];
    const freqPattern = new RegExp(`\\b(${freqCodes.join("|")})\\b`, "i");
    const freqMatch = input.match(freqPattern);
    const parsedFreqCode = freqMatch ? freqMatch[1].toUpperCase() : null;

    // Remove frequency code from input for further parsing
    const inputWithoutFreq = parsedFreqCode
      ? input.replace(freqPattern, "").trim()
      : input;

    // Extract numeric dose + optional unit
    const doseMatch = inputWithoutFreq.match(/^(.+?)\s+(\d+)\s*(mg|mcg|g|ml|iu|%)?$/i);
    const parsedName = doseMatch ? doseMatch[1].trim() : inputWithoutFreq.replace(/\s+$/, "");
    const parsedDose = doseMatch ? parseInt(doseMatch[2], 10) : null;
    const parsedUnit = doseMatch && doseMatch[3] ? doseMatch[3].toLowerCase() : (parsedDose ? "mg" : null);

    // --- STEP 2: Identify Brand ---
    const { data: brandRows } = await supabase
      .from("drug_brands")
      .select("brand_name, generic_name, strength, manufacturer, country")
      .ilike("brand_name", parsedName);

    let brandDetected: string | null = null;
    let genericName: string | null = null;

    if (brandRows && brandRows.length > 0) {
      // Try to match exact strength if dose was parsed
      let match = parsedDose
        ? brandRows.find(b => {
            const s = b.strength?.replace(/\s/g, "").toLowerCase() || "";
            return s === `${parsedDose}${parsedUnit}` || s === `${parsedDose}`;
          })
        : null;
      if (!match) match = brandRows[0];

      brandDetected = match.brand_name;
      genericName = match.generic_name;
    }

    // --- STEP 3: Identify Generic ---
    if (!genericName) {
      const { data: genericRows } = await supabase
        .from("drug_master")
        .select("generic_name")
        .ilike("generic_name", parsedName)
        .limit(1);

      if (genericRows && genericRows.length > 0) {
        genericName = genericRows[0].generic_name;
      }
    }

    // --- STEP 4: Extract Frequency from dictionary ---
    let frequency: string | null = null;
    let timesPerDay: number | null = null;

    if (parsedFreqCode) {
      const { data: freqRows } = await supabase
        .from("dose_frequency_dictionary")
        .select("code, meaning, times_per_day")
        .ilike("code", parsedFreqCode)
        .limit(1);

      if (freqRows && freqRows.length > 0) {
        frequency = freqRows[0].meaning;
        timesPerDay = freqRows[0].times_per_day;
      } else {
        frequency = parsedFreqCode;
      }
    }

    // --- STEP 5: Build structured result ---
    const result = {
      resolved: !!genericName,
      input,
      generic_name: genericName,
      brand_name: brandDetected,
      dose: parsedDose,
      unit: parsedUnit,
      frequency,
      times_per_day: timesPerDay,
    };

    // --- STEP 6: Log to monitoring_events ---
    await supabase.from("monitoring_events").insert({
      event_type: "medication_normalized",
      success: !!genericName,
      metadata: {
        drug_input: input,
        generic_name: genericName,
        brand_name: brandDetected,
        dose: parsedDose,
        unit: parsedUnit,
        frequency,
      },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("normalize-medication error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
