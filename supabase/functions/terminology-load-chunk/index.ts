// Terminology chunk loader.
// Phase-based, idempotent, resumable. Invoked by pg_cron; safe to invoke manually.
//
// Phase ordering (enforced in the claim query):
//   1. snomed_concepts   — must all be `done` before any descriptions start
//   2. snomed_descriptions — must all be `done` before any relationships start
//   3. snomed_relationships
//
// Any concept/description/relationship chunk that is still pending/running/failed
// blocks the next phase from starting for that release. This prevents the FK
// violations we saw when descriptions or relationships loaded before their
// referenced concepts.
//
// Insert strategy: `unnest(<typed arrays>)`. This gives every column an explicit
// Postgres type so all-null batches don't hit `could not determine data type of
// parameter $1` (the bug that killed snomed_concepts chunk 2).

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BATCH = 5000;

type TargetTable = "snomed_concepts" | "snomed_descriptions" | "snomed_relationships";

const PHASE_ORDER: Record<TargetTable, number> = {
  snomed_concepts: 1,
  snomed_descriptions: 2,
  snomed_relationships: 3,
};

const ALLOWED_TABLES = new Set<TargetTable>([
  "snomed_concepts",
  "snomed_descriptions",
  "snomed_relationships",
]);

interface Job {
  id: string;
  release_id: string;
  chunk_index: number;
  storage_path: string;
  target_table: TargetTable;
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
    // Phase-gated atomic claim.
    // A pending job is only eligible if, for the same release, no job in an
    // earlier phase is still non-`done`. Phases are encoded via a CASE.
    const claimed = await sql<Job[]>`
      with phase as (
        select
          j.*,
          case j.target_table
            when 'snomed_concepts'      then 1
            when 'snomed_descriptions'  then 2
            when 'snomed_relationships' then 3
            else 99
          end as phase_order
        from terminology.import_jobs j
      )
      update terminology.import_jobs
      set status = 'running',
          claimed_at = now(),
          attempts = attempts + 1,
          attempted_storage_path = storage_path,
          last_error_stack = null
      where id = (
        select p.id
        from phase p
        join terminology.releases r on r.id = p.release_id
        where p.status = 'pending'
          and r.import_paused_at is null
          and not exists (
            select 1 from phase prior
            where prior.release_id = p.release_id
              and prior.phase_order < p.phase_order
              and prior.status <> 'done'
          )
        order by p.phase_order, p.created_at
        limit 1
        for update skip locked
      )
      returning id, release_id::text, chunk_index, storage_path, target_table, expected_rows
    `;
    if (claimed.length === 0) {
      return json({ ok: true, message: "no eligible pending jobs (phase-gated or queue empty)" });
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

    const rows: Record<string, unknown>[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      rows.push(JSON.parse(trimmed));
    }

    // Bulk insert via typed unnest — every column has an explicit Postgres type.
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await insertBatch(sql, job.target_table, slice);
      inserted += slice.length;
    }

    await sql`
      update terminology.import_jobs
      set status = 'done', loaded_rows = ${inserted}, completed_at = now(), last_error = null
      where id = ${job.id}
    `;

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

// ------------------------------------------------------------------
// Typed-array insert. Fixes "could not determine data type of parameter $1"
// by giving every array parameter an explicit Postgres cast (::bigint[], etc.)
// so all-null batches are no longer ambiguous.
// ------------------------------------------------------------------

async function insertBatch(
  sql: ReturnType<typeof postgres>,
  table: TargetTable,
  rows: Array<Record<string, unknown>>,
) {
  if (rows.length === 0) return;

  if (table === "snomed_concepts") {
    const concept_id = rows.map((r) => toBigIntStr(r.concept_id));
    const effective_time = rows.map((r) => (r.effective_time as string | null) ?? null);
    const active = rows.map((r) => Boolean(r.active));
    const module_id = rows.map((r) => (r.module_id as string | null) ?? null);
    const definition_status_id = rows.map((r) => (r.definition_status_id as string | null) ?? null);
    await sql`
      insert into terminology.snomed_concepts
        (concept_id, effective_time, active, module_id, definition_status_id)
      select * from unnest(
        ${concept_id}::bigint[],
        ${effective_time}::date[],
        ${active}::bool[],
        ${module_id}::text[],
        ${definition_status_id}::text[]
      )
      on conflict do nothing
    `;
    return;
  }

  if (table === "snomed_descriptions") {
    const description_id = rows.map((r) => toBigIntStr(r.description_id));
    const concept_id = rows.map((r) => toBigIntStrOrNull(r.concept_id));
    const language_code = rows.map((r) => (r.language_code as string | null) ?? null);
    const type_id = rows.map((r) => (r.type_id as string | null) ?? null);
    const term = rows.map((r) => (r.term as string | null) ?? null);
    const active = rows.map((r) => Boolean(r.active));
    await sql`
      insert into terminology.snomed_descriptions
        (description_id, concept_id, language_code, type_id, term, active)
      select * from unnest(
        ${description_id}::bigint[],
        ${concept_id}::bigint[],
        ${language_code}::text[],
        ${type_id}::text[],
        ${term}::text[],
        ${active}::bool[]
      )
      on conflict do nothing
    `;
    return;
  }

  if (table === "snomed_relationships") {
    const relationship_id = rows.map((r) => toBigIntStr(r.relationship_id));
    const source_concept = rows.map((r) => toBigIntStrOrNull(r.source_concept));
    const destination_concept = rows.map((r) => toBigIntStrOrNull(r.destination_concept));
    const relationship_type = rows.map((r) => (r.relationship_type as string | null) ?? null);
    const active = rows.map((r) => Boolean(r.active));
    await sql`
      insert into terminology.snomed_relationships
        (relationship_id, source_concept, destination_concept, relationship_type, active)
      select * from unnest(
        ${relationship_id}::bigint[],
        ${source_concept}::bigint[],
        ${destination_concept}::bigint[],
        ${relationship_type}::text[],
        ${active}::bool[]
      )
      on conflict do nothing
    `;
    return;
  }

  throw new Error(`unhandled table: ${table}`);
}

// SNOMED IDs are 64-bit; pass as strings so JS Number precision loss never
// happens and postgres.js binds them to bigint[] cleanly.
function toBigIntStr(v: unknown): string {
  if (v === null || v === undefined) throw new Error("required bigint is null");
  return String(v);
}
function toBigIntStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
