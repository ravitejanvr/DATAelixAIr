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

    // Step 1: Parse strength from input (e.g. "Crocin 650" → name="Crocin", strength="650")
    const strengthMatch = input.match(/^(.+?)\s+(\d+\s*(?:mg|mcg|g|ml|iu|%)?)\s*$/i);
    const parsedName = strengthMatch ? strengthMatch[1].trim() : input;
    const parsedStrength = strengthMatch ? strengthMatch[2].trim() : null;

    // Step 2: Check drug_brands for brand match (case-insensitive)
    const { data: brandRows } = await supabase
      .from("drug_brands")
      .select("brand_name, generic_name, strength, manufacturer, country")
      .ilike("brand_name", parsedName);

    let brandDetected: string | null = null;
    let genericName: string | null = null;
    let matchedStrength: string | null = parsedStrength;

    if (brandRows && brandRows.length > 0) {
      // If strength was parsed, try to match exact strength first
      let match = parsedStrength
        ? brandRows.find(b => b.strength?.replace(/\s/g, "").toLowerCase() === parsedStrength!.replace(/\s/g, "").toLowerCase())
        : null;
      if (!match) match = brandRows[0];
      
      brandDetected = match.brand_name;
      genericName = match.generic_name;
      matchedStrength = parsedStrength || match.strength || null;
    }

    // Step 3: If no brand match, check if input is itself a generic name
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

    // Step 4: Retrieve drug_master data
    let drugMaster: any = null;
    if (genericName) {
      const { data: masterRows } = await supabase
        .from("drug_master")
        .select("*")
        .eq("generic_name", genericName)
        .limit(1);

      if (masterRows && masterRows.length > 0) {
        drugMaster = masterRows[0];
      }
    }

    // Step 5: Check interactions from drug_interactions table
    let interactions: any[] = [];
    if (genericName) {
      const { data: interactionRows } = await supabase
        .from("drug_interactions")
        .select("*")
        .or(`drug_a.ilike.${genericName},drug_b.ilike.${genericName}`);

      interactions = interactionRows || [];
    }

    const result = {
      resolved: !!genericName,
      input: input,
      brand_detected: brandDetected,
      generic_name: genericName,
      strength: matchedStrength,
      drug_class: drugMaster?.drug_class || null,
      mechanism: drugMaster?.mechanism || null,
      max_daily_dose_mg: drugMaster?.max_daily_dose_mg || null,
      pregnancy_category: drugMaster?.pregnancy_category || null,
      renal_adjustment: drugMaster?.renal_adjustment || null,
      hepatic_adjustment: drugMaster?.hepatic_adjustment || null,
      common_indications: drugMaster?.common_indications || [],
      known_interactions: interactions.map(i => ({
        drug_a: i.drug_a,
        drug_b: i.drug_b,
        severity: i.severity,
        description: i.interaction_description,
        recommended_action: i.recommended_action,
      })),
    };

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
