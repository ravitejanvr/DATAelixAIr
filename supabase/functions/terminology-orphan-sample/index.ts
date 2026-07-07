// One-shot diagnostic: download one description chunk, extract concept_ids,
// and report which ones are missing from terminology.snomed_concepts.
// No writes. Read-only proof for the FK-failure root cause.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  const path = url.searchParams.get("path")
    ?? "snomed/SnomedCT_INT_20260701/snomed_descriptions_0000.ndjson.gz";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
    max: 1, prepare: false, idle_timeout: 5, connect_timeout: 10,
  });

  try {
    const { data: file, error } = await supabase.storage.from("ontology").download(path);
    if (error || !file) throw new Error(`download failed: ${error?.message}`);

    const decompressed = file.stream().pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(decompressed).text();
    const lines = text.split("\n").filter((l) => l.trim());

    const conceptIds = new Set<string>();
    const inactiveDescCount = { active: 0, inactive: 0 };
    let sampleRow: unknown = null;
    for (const line of lines) {
      const r = JSON.parse(line);
      if (!sampleRow) sampleRow = r;
      if (r.concept_id !== null && r.concept_id !== undefined && r.concept_id !== "") {
        conceptIds.add(String(r.concept_id));
      }
      if (r.active === true || r.active === 1 || r.active === "1") inactiveDescCount.active++;
      else inactiveDescCount.inactive++;
    }

    const idArray = [...conceptIds];
    // Which of these concept_ids exist in snomed_concepts?
    const found = await sql<Array<{ concept_id: string }>>`
      select concept_id::text as concept_id
      from terminology.snomed_concepts
      where concept_id = any(${idArray}::bigint[])
    `;
    const foundSet = new Set(found.map((r) => r.concept_id));
    const missing = idArray.filter((id) => !foundSet.has(id));

    return new Response(JSON.stringify({
      path,
      total_description_rows: lines.length,
      description_active_counts: inactiveDescCount,
      unique_concept_ids_referenced: idArray.length,
      concept_ids_present_in_staging: foundSet.size,
      concept_ids_missing: missing.length,
      missing_sample_first_20: missing.slice(0, 20),
      sample_description_row: sampleRow,
    }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
});
