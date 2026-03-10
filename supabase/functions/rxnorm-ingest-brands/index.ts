import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const startTime = Date.now();
    let ingested = 0;
    let mapped = 0;
    let errors = 0;

    // Get all ingredients
    const { data: ingredients } = await admin
      .from("drug_ingredients")
      .select("rxnorm_cui, generic_name")
      .limit(500);

    if (!ingredients || ingredients.length === 0) {
      return respond({ status: "no_ingredients", ingested: 0 });
    }

    const brandBatch: any[] = [];
    const mapBatch: any[] = [];

    for (const ingredient of ingredients) {
      try {
        // Get brand names for this ingredient
        const relRes = await fetch(
          `${RXNORM_BASE}/rxcui/${ingredient.rxnorm_cui}/related.json?tty=BN`
        );
        if (!relRes.ok) continue;

        const relData = await relRes.json();
        const groups = relData?.relatedGroup?.conceptGroup || [];

        for (const g of groups) {
          if (g.tty === "BN" && g.conceptProperties?.length) {
            for (const brand of g.conceptProperties) {
              brandBatch.push({
                brand_name: brand.name,
                generic_name: ingredient.generic_name,
                rxnorm_id: brand.rxcui,
                strength: null,
                manufacturer: null,
                country: "US",
              });

              mapBatch.push({
                brand_name: brand.name,
                generic_name: ingredient.generic_name,
                rxnorm_cui: brand.rxcui,
                ingredient_cui: ingredient.rxnorm_cui,
              });
            }
          }
        }
      } catch (e) {
        console.error(`Failed to fetch brands for ${ingredient.generic_name}:`, e);
        errors++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    }

    // Upsert drug_brands
    const chunkSize = 50;
    for (let i = 0; i < brandBatch.length; i += chunkSize) {
      const chunk = brandBatch.slice(i, i + chunkSize);
      const { error } = await admin
        .from("drug_brands")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
      if (error) {
        console.error("Brand upsert error:", error);
        errors++;
      } else {
        ingested += chunk.length;
      }
    }

    // Upsert brand-generic map
    for (let i = 0; i < mapBatch.length; i += chunkSize) {
      const chunk = mapBatch.slice(i, i + chunkSize);
      const { error } = await admin
        .from("drug_brand_generic_map")
        .upsert(chunk, { onConflict: "id", ignoreDuplicates: true });
      if (error) {
        console.error("Map upsert error:", error);
        errors++;
      } else {
        mapped += chunk.length;
      }
    }

    const durationMs = Date.now() - startTime;

    // Log to monitoring_events
    await admin.from("monitoring_events").insert({
      event_type: "rxnorm_brand_ingestion",
      agent_name: "rxnorm-ingest-brands",
      duration_ms: durationMs,
      success: errors === 0,
      metadata: { brands_ingested: ingested, mappings_created: mapped, errors, total_ingredients: ingredients.length },
    });

    return respond({ status: "completed", brands_ingested: ingested, mappings_created: mapped, errors, duration_ms: durationMs });
  } catch (err: any) {
    console.error("rxnorm-ingest-brands error:", err);
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
