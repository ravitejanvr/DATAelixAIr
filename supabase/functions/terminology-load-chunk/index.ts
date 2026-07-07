// Terminology chunk loader — INSTRUMENTED build.
//
// This build is intentionally verbose. It is here to answer three questions:
//   1. What exactly happens for every chunk (start/end/rows/commit/error/stack/elapsed)?
//   2. Are the phase preconditions satisfied before a description/relationship
//      chunk is allowed to run? (i.e. do concept counts match the manifest?)
//   3. What SQL / parameter structure does postgres.js emit for the concept
//      batch that triggers "could not determine data type of parameter $1" /
//      "cannot cast type boolean to boolean[]"?
//
// Nothing here changes the phase-gating logic or the insert strategy. It only
// adds logging + a hard precondition check before descriptions/relationships.

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

// Structured logger — one JSON object per event so logs are grep-able.
function log(event: string, data: Record<string, unknown> = {}) {
  try {
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }));
  } catch {
    console.log(event, data);
  }
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
  const startedAt = new Date();
  const t0 = performance.now();
  let committed = false;
  let insertedRows = 0;

  try {
    // ---------- Claim ----------
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
      log("no_eligible_job");
      return json({ ok: true, message: "no eligible pending jobs (phase-gated or queue empty)" });
    }
    job = claimed[0];

    if (!ALLOWED_TABLES.has(job.target_table)) {
      throw new Error(`disallowed target_table: ${job.target_table}`);
    }

    // ---------- Phase transition detection ----------
    // Is this the FIRST job of its phase for this release to run?
    const [phaseStats] = await sql<Array<{
      total: number; done: number; running: number; pending: number; failed: number;
    }>>`
      select
        count(*)::int                                          as total,
        count(*) filter (where status = 'done')::int           as done,
        count(*) filter (where status = 'running')::int        as running,
        count(*) filter (where status = 'pending')::int        as pending,
        count(*) filter (where status = 'failed')::int         as failed
      from terminology.import_jobs
      where release_id = ${job.release_id}
        and target_table = ${job.target_table}
    `;
    const isPhaseStart = phaseStats.done === 0 && phaseStats.running === 1; // this job is the running one
    if (isPhaseStart) {
      log("phase_start", {
        release_id: job.release_id,
        phase: job.target_table.replace("snomed_", ""),
        message: `START ${cap(job.target_table.replace("snomed_", ""))}`,
        chunks_total: phaseStats.total,
      });
    }

    // ---------- Precondition: descriptions/relationships require concepts loaded ----------
    if (job.target_table === "snomed_descriptions" || job.target_table === "snomed_relationships") {
      const [{ count: liveConcepts }] = await sql<Array<{ count: string }>>`
        select count(*)::text as count from terminology.snomed_concepts
      `;
      const [{ expected }] = await sql<Array<{ expected: string }>>`
        select coalesce(sum(expected_rows), 0)::text as expected
        from terminology.import_jobs
        where release_id = ${job.release_id} and target_table = 'snomed_concepts'
      `;
      const live = BigInt(liveConcepts);
      const exp = BigInt(expected);
      log("phase_precondition_check", {
        release_id: job.release_id,
        target_table: job.target_table,
        chunk_index: job.chunk_index,
        live_concepts: liveConcepts,
        expected_concepts_from_manifest: expected,
        ok: live === exp,
      });
      if (live !== exp) {
        // Refuse to start this phase — release the claim back to pending.
        await sql`
          update terminology.import_jobs
          set status = 'pending', claimed_at = null,
              last_error = ${'phase precondition failed: snomed_concepts count ' + liveConcepts + ' != expected ' + expected}
          where id = ${job.id}
        `;
        log("phase_precondition_refused", {
          release_id: job.release_id,
          target_table: job.target_table,
          live_concepts: liveConcepts,
          expected_concepts_from_manifest: expected,
        });
        return json({
          ok: false,
          refused: true,
          reason: "phase_precondition_failed",
          target_table: job.target_table,
          live_concepts: liveConcepts,
          expected_concepts_from_manifest: expected,
        }, 409);
      }
    }

    // ---------- Download + parse ----------
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

    log("chunk_start", {
      release_id: job.release_id,
      chunk_index: job.chunk_index,
      target_table: job.target_table,
      rows_in_chunk: rows.length,
      storage_path: job.storage_path,
      start_time: startedAt.toISOString(),
    });

    // ---------- Insert ----------
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      try {
        await insertBatch(sql, job.target_table, slice);
      } catch (batchErr) {
        // Dump exactly what we tried to send so we can diagnose the postgres.js
        // parameter-type problem without guessing.
        dumpBatchDiagnostics(job.target_table, slice, i, batchErr);
        throw batchErr;
      }
      insertedRows += slice.length;
    }

    await sql`
      update terminology.import_jobs
      set status = 'done', loaded_rows = ${insertedRows}, completed_at = now(), last_error = null
      where id = ${job.id}
    `;

    await sql`
      update terminology.releases r
      set row_counts = coalesce(row_counts, '{}'::jsonb) ||
        jsonb_build_object(
          ${job.target_table},
          coalesce((row_counts->>${job.target_table})::bigint, 0) + ${insertedRows}
        )
      where r.id = ${job.release_id}
    `;
    committed = true;

    const endedAt = new Date();
    const elapsed = Math.round(performance.now() - t0);
    log("chunk_end", {
      release_id: job.release_id,
      chunk_index: job.chunk_index,
      target_table: job.target_table,
      rows_in_chunk: rows.length,
      rows_inserted: insertedRows,
      start_time: startedAt.toISOString(),
      end_time: endedAt.toISOString(),
      transaction_committed: committed,
      error: null,
      stack: null,
      elapsed_ms: elapsed,
    });

    // ---------- Phase-complete detection ----------
    const [postStats] = await sql<Array<{ total: number; done: number }>>`
      select count(*)::int as total, count(*) filter (where status = 'done')::int as done
      from terminology.import_jobs
      where release_id = ${job.release_id} and target_table = ${job.target_table}
    `;
    if (postStats.done === postStats.total) {
      const phase = job.target_table.replace("snomed_", "");
      log("phase_complete", {
        release_id: job.release_id,
        phase,
        message: `${cap(phase)} complete`,
        chunks_total: postStats.total,
      });
    }

    return json({
      ok: true,
      job_id: job.id,
      chunk_index: job.chunk_index,
      target_table: job.target_table,
      rows_loaded: insertedRows,
      elapsed_ms: elapsed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? (e.stack ?? e.message) : String(e);
    const endedAt = new Date();
    const elapsed = Math.round(performance.now() - t0);
    if (job) {
      log("chunk_error", {
        release_id: job.release_id,
        chunk_index: job.chunk_index,
        target_table: job.target_table,
        rows_inserted: insertedRows,
        start_time: startedAt.toISOString(),
        end_time: endedAt.toISOString(),
        transaction_committed: committed,
        error: msg,
        stack,
        elapsed_ms: elapsed,
      });
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
    } else {
      log("claim_error", { error: msg, stack });
    }
    console.error("load-chunk error", stack);
    return json({ ok: false, error: msg, stack, job_id: job?.id ?? null, attempted_storage_path: job?.storage_path ?? null }, 500);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
});

// ------------------------------------------------------------------
// Insert. Unchanged strategy — kept typed-unnest so the diagnostic dump
// below reflects the SAME SQL the failing chunk uses.
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

// ------------------------------------------------------------------
// Diagnostic dump for a failing insert batch. Prints:
//   - the exact SQL template we submitted
//   - each parameter's JS type, isArray, length, first 3 values
//   - a sample of the raw row we tried to insert
// This is what we need to figure out why postgres.js emits
// "could not determine data type of parameter $1" or the boolean[] cast error.
// ------------------------------------------------------------------
function dumpBatchDiagnostics(
  table: TargetTable,
  rows: Array<Record<string, unknown>>,
  offset: number,
  err: unknown,
) {
  const errMsg = err instanceof Error ? err.message : String(err);
  const params = buildParamsForDiagnostics(table, rows);
  const sqlTemplate = SQL_TEMPLATES[table];

  log("batch_diagnostic", {
    table,
    batch_offset: offset,
    rows_in_batch: rows.length,
    error: errMsg,
    generated_sql: sqlTemplate,
    parameters: params.map((p, idx) => ({
      index: idx + 1,
      declared_cast: p.cast,
      js_type: Array.isArray(p.value) ? "array" : typeof p.value,
      is_array: Array.isArray(p.value),
      length: Array.isArray(p.value) ? p.value.length : null,
      all_null: Array.isArray(p.value) ? p.value.every((v) => v === null || v === undefined) : null,
      sample_values: Array.isArray(p.value) ? p.value.slice(0, 3) : p.value,
      sample_types: Array.isArray(p.value)
        ? p.value.slice(0, 3).map((v) => (v === null ? "null" : typeof v))
        : typeof p.value,
    })),
    sample_input_row: rows[0] ?? null,
  });
}

const SQL_TEMPLATES: Record<TargetTable, string> = {
  snomed_concepts: `insert into terminology.snomed_concepts
  (concept_id, effective_time, active, module_id, definition_status_id)
select * from unnest($1::bigint[], $2::date[], $3::bool[], $4::text[], $5::text[])
on conflict do nothing`,
  snomed_descriptions: `insert into terminology.snomed_descriptions
  (description_id, concept_id, language_code, type_id, term, active)
select * from unnest($1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::text[], $6::bool[])
on conflict do nothing`,
  snomed_relationships: `insert into terminology.snomed_relationships
  (relationship_id, source_concept, destination_concept, relationship_type, active)
select * from unnest($1::bigint[], $2::bigint[], $3::text[], $4::text[], $5::bool[])
on conflict do nothing`,
};

function buildParamsForDiagnostics(
  table: TargetTable,
  rows: Array<Record<string, unknown>>,
): Array<{ cast: string; value: unknown }> {
  if (table === "snomed_concepts") {
    return [
      { cast: "bigint[]", value: rows.map((r) => safe(() => toBigIntStr(r.concept_id))) },
      { cast: "date[]",   value: rows.map((r) => (r.effective_time as string | null) ?? null) },
      { cast: "bool[]",   value: rows.map((r) => Boolean(r.active)) },
      { cast: "text[]",   value: rows.map((r) => (r.module_id as string | null) ?? null) },
      { cast: "text[]",   value: rows.map((r) => (r.definition_status_id as string | null) ?? null) },
    ];
  }
  if (table === "snomed_descriptions") {
    return [
      { cast: "bigint[]", value: rows.map((r) => safe(() => toBigIntStr(r.description_id))) },
      { cast: "bigint[]", value: rows.map((r) => toBigIntStrOrNull(r.concept_id)) },
      { cast: "text[]",   value: rows.map((r) => (r.language_code as string | null) ?? null) },
      { cast: "text[]",   value: rows.map((r) => (r.type_id as string | null) ?? null) },
      { cast: "text[]",   value: rows.map((r) => (r.term as string | null) ?? null) },
      { cast: "bool[]",   value: rows.map((r) => Boolean(r.active)) },
    ];
  }
  return [
    { cast: "bigint[]", value: rows.map((r) => safe(() => toBigIntStr(r.relationship_id))) },
    { cast: "bigint[]", value: rows.map((r) => toBigIntStrOrNull(r.source_concept)) },
    { cast: "bigint[]", value: rows.map((r) => toBigIntStrOrNull(r.destination_concept)) },
    { cast: "text[]",   value: rows.map((r) => (r.relationship_type as string | null) ?? null) },
    { cast: "bool[]",   value: rows.map((r) => Boolean(r.active)) },
  ];
}

function safe<T>(fn: () => T): T | string {
  try { return fn(); } catch (e) { return `<ERR: ${e instanceof Error ? e.message : String(e)}>`; }
}

function toBigIntStr(v: unknown): string {
  if (v === null || v === undefined) throw new Error("required bigint is null");
  return String(v);
}
function toBigIntStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
