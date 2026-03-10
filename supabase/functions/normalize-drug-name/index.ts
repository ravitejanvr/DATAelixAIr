import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { drug_input } = body;

    if (!drug_input || typeof drug_input !== "string" || !drug_input.trim()) {
      return new Response(JSON.stringify({ error: "drug_input required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = drug_input.trim();
    const inputLower = input.toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Step 1: Check brand-generic map for brand match
    const { data: brandMatch } = await admin
      .from("drug_brand_generic_map")
      .select("*")
      .ilike("brand_name", inputLower)
      .limit(1)
      .maybeSingle();

    if (brandMatch) {
      // Found brand → resolve ingredient
      const doseOptions = await fetchDoseOptions(admin, brandMatch.ingredient_cui);
      return respond({
        generic_name: brandMatch.generic_name,
        brand_name: brandMatch.brand_name,
        rxnorm_cui: brandMatch.rxnorm_cui,
        ingredient_cui: brandMatch.ingredient_cui,
        match_type: "brand_local",
        confidence: "high",
        recommended_dose_options: doseOptions.doses,
        recommended_frequency_options: doseOptions.frequencies,
      });
    }

    // Step 2: Check brand-generic map for generic match
    const { data: genericMatch } = await admin
      .from("drug_brand_generic_map")
      .select("*")
      .ilike("generic_name", inputLower)
      .limit(1)
      .maybeSingle();

    if (genericMatch) {
      const doseOptions = await fetchDoseOptions(admin, genericMatch.ingredient_cui);
      return respond({
        generic_name: genericMatch.generic_name,
        brand_name: genericMatch.brand_name,
        rxnorm_cui: genericMatch.rxnorm_cui,
        ingredient_cui: genericMatch.ingredient_cui,
        match_type: "generic_local",
        confidence: "high",
        recommended_dose_options: doseOptions.doses,
        recommended_frequency_options: doseOptions.frequencies,
      });
    }

    // Step 3: Check drug_ingredients directly
    const { data: ingredientMatch } = await admin
      .from("drug_ingredients")
      .select("*")
      .ilike("generic_name", inputLower)
      .limit(1)
      .maybeSingle();

    if (ingredientMatch) {
      const doseOptions = await fetchDoseOptions(admin, ingredientMatch.rxnorm_cui);
      return respond({
        generic_name: ingredientMatch.generic_name,
        brand_name: null,
        rxnorm_cui: null,
        ingredient_cui: ingredientMatch.rxnorm_cui,
        match_type: "ingredient_local",
        confidence: "high",
        recommended_dose_options: doseOptions.doses,
        recommended_frequency_options: doseOptions.frequencies,
      });
    }

    // Step 4: Fallback to RxNorm API
    let rxnormResult = await rxnormLookup(input);

    if (rxnormResult) {
      const doseOptions = await fetchDoseOptions(admin, rxnormResult.rxcui);
      return respond({
        generic_name: rxnormResult.name,
        brand_name: rxnormResult.isBrand ? input : null,
        rxnorm_cui: rxnormResult.rxcui,
        ingredient_cui: rxnormResult.ingredientCui || rxnormResult.rxcui,
        match_type: "rxnorm_api",
        confidence: rxnormResult.confidence,
        recommended_dose_options: doseOptions.doses,
        recommended_frequency_options: doseOptions.frequencies,
      });
    }

    // Step 5: No match found
    return respond({
      generic_name: null,
      brand_name: null,
      rxnorm_cui: null,
      ingredient_cui: null,
      match_type: "unresolved",
      confidence: "low",
      warning: `Could not normalize "${input}". Please verify the drug name.`,
      recommended_dose_options: [],
      recommended_frequency_options: [],
    });
  } catch (err: any) {
    console.error("normalize-drug-name error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rxnormLookup(name: string): Promise<{
  rxcui: string;
  name: string;
  isBrand: boolean;
  ingredientCui: string | null;
  confidence: string;
} | null> {
  try {
    // Exact match
    const res = await fetch(`${RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(name)}&search=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const rxcui = data?.idGroup?.rxnormId?.[0];

    if (rxcui) {
      const propRes = await fetch(`${RXNORM_BASE}/rxcui/${rxcui}/properties.json`);
      const propData = propRes.ok ? await propRes.json() : null;
      const tty = propData?.properties?.tty || "";
      const canonicalName = propData?.properties?.name || name;
      const isBrand = ["BN", "BPCK", "SBD", "SBDC", "SBDF"].includes(tty);

      let ingredientCui: string | null = null;
      if (isBrand) {
        try {
          const relRes = await fetch(`${RXNORM_BASE}/rxcui/${rxcui}/related.json?tty=IN`);
          if (relRes.ok) {
            const relData = await relRes.json();
            const groups = relData?.relatedGroup?.conceptGroup || [];
            for (const g of groups) {
              if (g.tty === "IN" && g.conceptProperties?.length) {
                ingredientCui = g.conceptProperties[0].rxcui;
                break;
              }
            }
          }
        } catch { /* skip */ }
      }

      return { rxcui, name: canonicalName, isBrand, ingredientCui, confidence: "high" };
    }

    // Approximate match
    const approxRes = await fetch(`${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(name)}&maxEntries=1`);
    if (!approxRes.ok) return null;
    const approxData = await approxRes.json();
    const candidate = approxData?.approximateGroup?.candidate?.[0];
    if (candidate?.rxcui) {
      const propRes2 = await fetch(`${RXNORM_BASE}/rxcui/${candidate.rxcui}/properties.json`);
      const propData2 = propRes2.ok ? await propRes2.json() : null;
      const score = parseInt(candidate.score) || 0;
      return {
        rxcui: candidate.rxcui,
        name: propData2?.properties?.name || candidate.name || name,
        isBrand: false,
        ingredientCui: null,
        confidence: score > 50 ? "moderate" : "low",
      };
    }

    return null;
  } catch (e) {
    console.error("RxNorm lookup error:", e);
    return null;
  }
}

async function fetchDoseOptions(admin: any, ingredientCui: string | null): Promise<{
  doses: any[];
  frequencies: any[];
}> {
  if (!ingredientCui) return { doses: [], frequencies: [] };

  try {
    const { data: guidelines } = await admin
      .from("drug_dose_guidelines")
      .select("adult_standard_dose, adult_max_dose, pediatric_dose, frequency_options, duration_defaults")
      .eq("ingredient_cui", ingredientCui)
      .limit(1)
      .maybeSingle();

    const { data: forms } = await admin
      .from("drug_dosage_forms")
      .select("dose, unit, route, form")
      .eq("ingredient_cui", ingredientCui)
      .limit(10);

    return {
      doses: forms || [],
      frequencies: guidelines?.frequency_options || [],
    };
  } catch {
    return { doses: [], frequencies: [] };
  }
}
