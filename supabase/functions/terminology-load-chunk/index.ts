// Terminology chunk loader.
// Idempotent, resumable. Invoked by pg_cron; safe to invoke manually.
// Claims one pending chunk with SELECT ... FOR UPDATE SKIP LOCKED,
// streams the gzipped NDJSON from Storage, and bulk-inserts into the
// SNOMED staging tables in batches of 5,000 via a direct pg connection.
//
// Platform notes:
//  - Direct pg on port 5432 via SUPABASE_DB_URL (POC-validated).
//  - COPY FROM STDIN is unavailable in this runtime (POC-proven);
//    batched INSERT ... VALUES achieves ~35k rows/s at batch=5000.
//  - Safe per-invocation ceiling: ~200k rows; chunks are pre-sized to 150k.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BATCH = 5000;
const ALLOWED_TABLES = new Set(["snomed_concepts", "snomed_descriptions", "snomed_relationships"]);

interface Job {
  id: string;
  release_id: string;
  chunk_index: number;
  storage_path: string;
  target_table: string;
  expected_rows: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    connect_timeout: 10,
    onnotice: () => {},
  });

  let job: Job | null = null;
  const t0 = performance.now();

  try {
    // Atomic claim
    const claimed = await sql<Job[]>`
      update terminology.import_jobs
      set status = 'running',
          claimed_at = now(),
          attempts = attempts + 1,
          attempted_storage_path = storage_path,
          last_error_stack = null
      where id = (
        select j.id
        from terminology.import_jobs j
        join terminology.releases r on r.id = j.release_id
        where j.status = 'pending'
          and r.import_paused_at is null
        order by j.created_at
        limit 1
        for update skip locked
      )
      returning id, release_id::text, chunk_index, storage_path, target_table, expected_rows
    `;
    if (claimed.length === 0) {
      return json({ ok: true, message: "no pending jobs" });
    }
    job = claimed[0];

    if (!ALLOWED_TABLES.has(job.target_table)) {
      throw new Error(`disallowed target_table: ${job.target_table}`);
    }

    // Download + decompress
    const { data: file, error: dlErr } = await supabase.storage
      .from("ontology")
      .download(job.storage_path);
    if (dlErr || !file) throw new Error(`storage download failed: ${dlErr?.message ?? "no file"}`);

    const decompressed = file.stream().pipeThrough(new DecompressionStream("gzip"));
    const text = await new Response(decompressed).text();
    const lines = text.split("\n");

    // Parse
    const rows: Record<string, unknown>[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      rows.push(JSON.parse(trimmed));
    }

    // Bulk insert
    let inserted = 0;
    // postgres.js requires the table identifier passed via sql(name)
    const tableIdent = sql(`terminology.${job.target_table}`);
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await sql`insert into ${tableIdent} ${sql(slice)} on conflict do nothing`;
      inserted += slice.length;
    }

    await sql`
      update terminology.import_jobs
      set status = 'done', loaded_rows = ${inserted}, completed_at = now(), last_error = null
      where id = ${job.id}
    `;

    // Roll up onto release row
    await sql`
      update terminology.releases r
      set row_counts = coalesce(row_counts, '{}'::jsonb) ||
        jsonb_build_object(
          ${job.target_table},
          coalesce((row_counts->>${job.target_table})::bigint, 0) + ${inserted}
        )
      where r.id = ${job.release_id}
    `;

    return json({
      ok: true,
      job_id: job.id,
      chunk_index: job.chunk_index,
      target_table: job.target_table,
      rows_loaded: inserted,
      elapsed_ms: Math.round(performance.now() - t0),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? e.message) : String(e);
    if (job) {
      try {
        await sql`
          update terminology.import_jobs
          set status = 'failed',
              last_error = ${msg.slice(0, 2000)},
              last_error_stack = ${stack.slice(0, 4000)},
              attempted_storage_path = ${job.storage_path},
              completed_at = now()
          where id = ${job.id}
        `;
      } catch { /* swallow */ }
    }
    console.error("load-chunk error", stack);
    return json({ ok: false, error: msg, stack, job_id: job?.id ?? null, attempted_storage_path: job?.storage_path ?? null }, 500);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
