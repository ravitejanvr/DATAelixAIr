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
    let errors = 0;

    // Fetch all drug classes from drug_master to get relevant ingredients
    const { data: drugMaster } = await admin
      .from("drug_master")
      .select("generic_name, rxnorm_id")
      .limit(500);

    if (!drugMaster || drugMaster.length === 0) {
      return respond({ status: "no_drugs_in_master", ingested: 0 });
    }

    const batch: { rxnorm_cui: string; generic_name: string; ingredient_type: string }[] = [];

    for (const drug of drugMaster) {
      try {
        let rxcui = drug.rxnorm_id;

        // If no rxnorm_id, look it up
        if (!rxcui) {
          const res = await fetch(`${RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(drug.generic_name)}&search=1`);
          if (res.ok) {
            const data = await res.json();
            rxcui = data?.idGroup?.rxnormId?.[0] || null;
          }
        }

        if (!rxcui) {
          errors++;
          continue;
        }

        // Get ingredient concept
        const relRes = await fetch(`${RXNORM_BASE}/rxcui/${rxcui}/related.json?tty=IN`);
        if (relRes.ok) {
          const relData = await relRes.json();
          const groups = relData?.relatedGroup?.conceptGroup || [];
          for (const g of groups) {
            if (g.tty === "IN" && g.conceptProperties?.length) {
              for (const cp of g.conceptProperties) {
                batch.push({
                  rxnorm_cui: cp.rxcui,
                  generic_name: cp.name,
                  ingredient_type: "active",
                });
              }
            }
          }
        }

        // Also add the drug itself as ingredient if it's an IN type
        batch.push({
          rxnorm_cui: rxcui,
          generic_name: drug.generic_name,
          ingredient_type: "active",
        });
      } catch (e) {
        console.error(`Failed to process ${drug.generic_name}:`, e);
        errors++;
      }

      // Rate limit: RxNorm allows ~20 req/sec
      await new Promise(r => setTimeout(r, 100));
    }

    // Deduplicate by rxnorm_cui
    const unique = new Map<string, typeof batch[0]>();
    for (const item of batch) {
      if (!unique.has(item.rxnorm_cui)) {
        unique.set(item.rxnorm_cui, item);
      }
    }

    // Upsert in chunks
    const items = Array.from(unique.values());
    const chunkSize = 50;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const { error } = await admin
        .from("drug_ingredients")
        .upsert(chunk, { onConflict: "rxnorm_cui", ignoreDuplicates: true });
      if (error) {
        console.error("Upsert error:", error);
        errors++;
      } else {
        ingested += chunk.length;
      }
    }

    const durationMs = Date.now() - startTime;

    // Log to monitoring_events
    await admin.from("monitoring_events").insert({
      event_type: "rxnorm_ingredient_ingestion",
      agent_name: "rxnorm-ingest-ingredients",
      duration_ms: durationMs,
      success: errors === 0,
      metadata: { ingested, errors, total_master: drugMaster.length },
    });

    return respond({ status: "completed", ingested, errors, duration_ms: durationMs });
  } catch (err: any) {
    console.error("rxnorm-ingest-ingredients error:", err);
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
