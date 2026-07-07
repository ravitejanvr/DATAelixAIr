// Chunked, resumable rebuild of terminology.concept_search for a release.
//
// Actions (POST body):
//   { release_id, action: "init",     chunks_total?: number }
//     -> empties concept_search for the release's code_system,
//        seeds N pending chunk rows (default 20). Idempotent.
//
//   { release_id, action: "chunk",    chunk_index?: number }
//     -> processes one chunk. If chunk_index omitted, picks the
//        oldest pending chunk (FOR UPDATE SKIP LOCKED). Marks
//        running -> done. Returns per-chunk timing + rows_indexed.
//
//   { release_id, action: "finalize" }
//     -> when all chunks are done: inserts local_synonyms,
//        ANALYZEs, archives previous active release, flips release
//        to active + sets active_release_id + clears import pause.
//
//   { release_id, action: "status" }
//     -> returns progress summary { chunks_total, chunks_completed,
//        rows_indexed, last_chunk_completed_at, remaining }.
//
// Every request requires platform_admin. Each chunk INSERT is its own
// autocommit statement so an edge-function timeout cannot corrupt state.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: role } = await admin
    .from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "platform_admin").maybeSingle();
  if (!role) return json({ error: "forbidden" }, 403);

  let body: {
    release_id?: string;
    action?: "init" | "chunk" | "finalize" | "status";
    chunks_total?: number;
    chunk_index?: number;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const releaseId = body.release_id;
  const action = body.action ?? "status";
  if (!releaseId) return json({ error: "release_id required" }, 400);

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, {
    max: 1,
    prepare: false,
    idle_timeout: 5,
    // Raise DB-side timeout — search-index chunks routinely need 60-150s;
    // default 120s statement_timeout was killing later, denser partitions.
    connection: { statement_timeout: "600000" },
  });

  try {
    const [rel] = await sql<Array<{ id: string; code_system_id: string; status: string }>>`
      select id::text, code_system_id::text, status
      from terminology.releases where id = ${releaseId}
    `;
    if (!rel) return json({ error: "release not found" }, 404);
    const csId = rel.code_system_id;

    // ---------------- INIT ----------------
    if (action === "init") {
      const chunksTotal = Math.max(1, Math.min(200, body.chunks_total ?? 20));

      // Nuke concept_search for this code system and reseed progress rows.
      await sql`delete from terminology.concept_search where code_system_id = ${csId}::uuid`;
      await sql`delete from terminology.concept_search_rebuild_progress where release_id = ${releaseId}::uuid`;

      // Seed pending chunks
      const values = Array.from({ length: chunksTotal }, (_, i) => ({
        release_id: releaseId,
        chunk_index: i,
        chunks_total: chunksTotal,
      }));
      await sql`
        insert into terminology.concept_search_rebuild_progress ${sql(values, "release_id", "chunk_index", "chunks_total")}
      `;

      // Make sure release is in a loading state (idempotent — no side effects if already loading/active)
      if (rel.status !== "active") {
        await sql`update terminology.releases set status='loading' where id = ${releaseId}::uuid`;
      }

      return json({ ok: true, action: "init", chunks_total: chunksTotal });
    }

    // ---------------- CHUNK ----------------
    if (action === "chunk") {
      // Pick the chunk to run
      const claimed = await sql<Array<{ chunk_index: number; chunks_total: number }>>`
        with next as (
          select id from terminology.concept_search_rebuild_progress
           where release_id = ${releaseId}::uuid
             and status = 'pending'
             ${body.chunk_index !== undefined ? sql`and chunk_index = ${body.chunk_index}` : sql``}
           order by chunk_index
           for update skip locked
           limit 1
        )
        update terminology.concept_search_rebuild_progress p
           set status = 'running', started_at = now(), error = null
          from next
         where p.id = next.id
        returning p.chunk_index, p.chunks_total
      `;
      if (claimed.length === 0) {
        return json({ ok: true, action: "chunk", note: "no pending chunks" });
      }
      const { chunk_index: idx, chunks_total: total } = claimed[0];

      const t0 = performance.now();
      let inserted = 0;
      try {
        const result = await sql`
          insert into terminology.concept_search
            (concept_id, code_system_id, code, preferred_term, term, term_norm, language, source, weight, active)
          select c.id, c.code_system_id, c.code, c.display, d.term,
                 lower(unaccent(d.term)), d.language,
                 case d.use_type when 'fsn' then 'fsn' when 'preferred' then 'preferred' else 'synonym' end,
                 case d.use_type when 'preferred' then 1.0 when 'fsn' then 0.9 else 0.7 end,
                 d.active
          from terminology.concepts c
          join terminology.designations d on d.concept_id = c.id
          where c.release_id = ${releaseId}::uuid
            and d.active
            and (c.id % ${total}) = ${idx}
        `;
        inserted = result.count ?? 0;
        await sql`
          update terminology.concept_search_rebuild_progress
             set status='done', rows_indexed=${inserted}, completed_at=now()
           where release_id=${releaseId}::uuid and chunk_index=${idx}
        `;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sql`
          update terminology.concept_search_rebuild_progress
             set status='failed', error=${msg}, completed_at=now()
           where release_id=${releaseId}::uuid and chunk_index=${idx}
        `;
        return json({ ok: false, action: "chunk", chunk_index: idx, error: msg }, 500);
      }

      return json({
        ok: true,
        action: "chunk",
        chunk_index: idx,
        chunks_total: total,
        rows_indexed: inserted,
        elapsed_ms: Math.round(performance.now() - t0),
      });
    }

    // ---------------- FINALIZE ----------------
    if (action === "finalize") {
      const [prog] = await sql<Array<{
        chunks_total: number; chunks_done: number; chunks_failed: number;
        chunks_pending_running: number; rows_indexed: string;
      }>>`
        select
          count(*)::int as chunks_total,
          count(*) filter (where status='done')::int as chunks_done,
          count(*) filter (where status='failed')::int as chunks_failed,
          count(*) filter (where status in ('pending','running'))::int as chunks_pending_running,
          coalesce(sum(rows_indexed),0)::text as rows_indexed
        from terminology.concept_search_rebuild_progress
        where release_id = ${releaseId}::uuid
      `;
      if (!prog || prog.chunks_total === 0) {
        return json({ error: "no rebuild in progress; run init first" }, 400);
      }
      if (prog.chunks_failed > 0 || prog.chunks_pending_running > 0) {
        return json({
          error: "cannot finalize: chunks not all done",
          progress: prog,
        }, 400);
      }

      // Local synonyms (small)
      await sql`
        insert into terminology.concept_search
          (concept_id, code_system_id, code, preferred_term, term, term_norm, language, source, weight, active)
        select c.id, c.code_system_id, c.code, c.display, ls.term,
               lower(unaccent(ls.term)), ls.language, 'local', ls.confidence, ls.active
        from terminology.local_synonyms ls
        join terminology.concepts c
          on c.code_system_id = ls.code_system_id
         and c.code = ls.code
         and c.release_id = ${releaseId}::uuid
        where ls.active
      `;

      await sql`analyze terminology.concept_search`;
      await sql`analyze terminology.concepts`;
      await sql`analyze terminology.designations`;

      await sql`
        update terminology.releases set status='archived'
         where code_system_id = ${csId}::uuid and status='active' and id <> ${releaseId}::uuid
      `;
      await sql`
        update terminology.releases
           set status='active',
               activated_at=now(),
               loaded_at=coalesce(loaded_at, now()),
               import_paused_at=null
         where id = ${releaseId}::uuid
      `;
      await sql`
        update terminology.code_systems
           set active_release_id = ${releaseId}::uuid, updated_at=now()
         where id = ${csId}::uuid
      `;

      const [counts] = await sql<Array<{
        search_rows: string; concepts: string; designations: string; relationships: string;
      }>>`
        select
          (select count(*)::text from terminology.concept_search where code_system_id=${csId}::uuid) as search_rows,
          (select count(*)::text from terminology.concepts where release_id=${releaseId}::uuid) as concepts,
          (select count(*)::text from terminology.designations d
             join terminology.concepts c on c.id=d.concept_id where c.release_id=${releaseId}::uuid) as designations,
          (select count(*)::text from terminology.relationships where release_id=${releaseId}::uuid) as relationships
      `;

      return json({ ok: true, action: "finalize", counts, progress: prog });
    }

    // ---------------- STATUS ----------------
    const [status] = await sql<Array<{
      chunks_total: number; chunks_completed: number; chunks_failed: number;
      chunks_pending: number; chunks_running: number;
      rows_indexed: string; last_chunk_completed_at: string | null;
    }>>`
      select
        count(*)::int as chunks_total,
        count(*) filter (where status='done')::int as chunks_completed,
        count(*) filter (where status='failed')::int as chunks_failed,
        count(*) filter (where status='pending')::int as chunks_pending,
        count(*) filter (where status='running')::int as chunks_running,
        coalesce(sum(rows_indexed),0)::text as rows_indexed,
        max(completed_at)::text as last_chunk_completed_at
      from terminology.concept_search_rebuild_progress
      where release_id = ${releaseId}::uuid
    `;
    return json({ ok: true, action: "status", release_status: rel.status, progress: status });
  } catch (e) {
    console.error("rebuild-search-chunk error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
});
