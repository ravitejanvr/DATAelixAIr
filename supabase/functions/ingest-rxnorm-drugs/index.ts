import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";

interface RxConcept {
  rxcui: string;
  name: string;
  tty: string;
}

async function fetchRxNormConcepts(tty: string): Promise<RxConcept[]> {
  const url = `${RXNORM_BASE}/allconcepts.json?tty=${tty}`;
  console.log(`Fetching RxNorm concepts for tty=${tty}...`);
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RxNorm API error (${res.status}): ${text}`);
  }
  const data = await res.json();
  const concepts: RxConcept[] =
    data?.minConceptGroup?.minConcept || [];
  console.log(`Fetched ${concepts.length} ${tty} concepts`);
  return concepts;
}

async function resolveIngredient(rxcui: string): Promise<string | null> {
  try {
    const url = `${RXNORM_BASE}/rxcui/${rxcui}/related.json?tty=IN`;
    const res = await fetch(url);
    if (!res.ok) {
      await res.text();
      return null;
    }
    const data = await res.json();
    const groups = data?.relatedGroup?.conceptGroup || [];
    for (const group of groups) {
      if (group.tty === "IN" && group.conceptProperties?.length > 0) {
        return group.conceptProperties[0].name;
      }
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const step = body.step || "ingredients"; // "ingredients" | "brands" | "full"
    const brandBatchSize = body.brand_batch_size || 50; // limit brand resolution per call
    const brandOffset = body.brand_offset || 0;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const results: Record<string, unknown> = { step };

    // STEP 1: Ingest Ingredients
    if (step === "ingredients" || step === "full") {
      const ingredients = await fetchRxNormConcepts("IN");

      let inserted = 0;
      let skipped = 0;
      const BATCH = 500;

      // Deduplicate by generic_name (RxNorm can have multiple rxcuis for same name)
      const seen = new Set<string>();
      const dedupedIngredients = ingredients.filter((c) => {
        const key = c.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      for (let i = 0; i < dedupedIngredients.length; i += BATCH) {
        const batch = dedupedIngredients.slice(i, i + BATCH).map((c) => ({
          generic_name: c.name,
          rxnorm_id: c.rxcui,
          drug_class: "",
          mechanism: "",
        }));

        const { error } = await supabase
          .from("drug_master")
          .upsert(batch, {
            onConflict: "generic_name",
            ignoreDuplicates: false,
          });

        if (error) {
          console.error(`Batch upsert error at offset ${i}:`, error.message);
          skipped += batch.length;
        } else {
          inserted += batch.length;
        }
      }

      results.ingredients = { total: ingredients.length, inserted, skipped };
    }

    // STEP 2: Ingest Brands (with relationship resolution)
    if (step === "brands" || step === "full") {
      const allBrands = await fetchRxNormConcepts("BN");

      // Apply pagination for brand resolution (API-heavy)
      const brandsToProcess = allBrands.slice(
        brandOffset,
        brandOffset + brandBatchSize
      );

      let inserted = 0;
      let skipped = 0;
      let unresolved = 0;

      for (const brand of brandsToProcess) {
        // Resolve ingredient relationship
        const genericName = await resolveIngredient(brand.rxcui);

        if (!genericName) {
          unresolved++;
          continue;
        }

        // Check if generic exists in drug_master
        const { data: masterRow } = await supabase
          .from("drug_master")
          .select("generic_name")
          .eq("generic_name", genericName)
          .limit(1)
          .maybeSingle();

        if (!masterRow) {
          // Insert the generic first
          await supabase.from("drug_master").upsert(
            { generic_name: genericName, drug_class: "", mechanism: "" },
            { onConflict: "generic_name", ignoreDuplicates: true }
          );
        }

        const { error } = await supabase.from("drug_brands").upsert(
          {
            brand_name: brand.name,
            generic_name: genericName,
            rxnorm_id: brand.rxcui,
          },
          { onConflict: "rxnorm_id", ignoreDuplicates: true }
        );

        if (error) {
          console.error(`Brand upsert error for ${brand.name}:`, error.message);
          skipped++;
        } else {
          inserted++;
        }
      }

      results.brands = {
        total_available: allBrands.length,
        batch_processed: brandsToProcess.length,
        inserted,
        skipped,
        unresolved,
        next_offset: brandOffset + brandBatchSize,
        complete: brandOffset + brandBatchSize >= allBrands.length,
      };
    }

    // Log to monitoring_events
    await supabase.from("monitoring_events").insert({
      event_type: "rxnorm_ingestion",
      agent_name: "ingest-rxnorm-drugs",
      success: true,
      metadata: {
        source: "rxnorm",
        step,
        ...results,
        timestamp: new Date().toISOString(),
      },
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-rxnorm-drugs error:", e);

    // Attempt to log failure
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase.from("monitoring_events").insert({
        event_type: "rxnorm_ingestion",
        agent_name: "ingest-rxnorm-drugs",
        success: false,
        metadata: {
          source: "rxnorm",
          error: e instanceof Error ? e.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
      });
    } catch {}

    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
