// Promote a fully-loaded release from SNOMED staging tables into the
// generic FHIR-shaped terminology model (concepts / designations /
// relationships), rebuild the concept_search index, and flip the
// active_release_id pointer on the code_system. Requires platform_admin.
//
// All server-side INSERT ... SELECT operations. Expected wall-clock at
// SNOMED International scale: 20-60s. If it grows past 120s in future,
// split into per-file promote steps.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// SNOMED CT metadata concept ids
const FSN_TYPE = "900000000000003001";
const SYNONYM_TYPE = "900000000000013009";
const IS_A_TYPE = "116680003";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: role } = await admin
    .from("user_roles").select("role").eq("user_id", user.id).eq("role", "platform_admin").maybeSingle();
  if (!role) return json({ error: "forbidden" }, 403);

  let body: { release_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  const releaseId = body.release_id;
  if (!releaseId) return json({ error: "release_id required" }, 400);

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
  const timings: Record<string, number> = {};
  const time = async <T>(name: string, fn: () => Promise<T>) => {
    const t0 = performance.now();
    const r = await fn();
    timings[name] = Math.round(performance.now() - t0);
    return r;
  };

  try {
    // Validate release + no pending chunks remaining
    const [rel] = await sql<Array<{ id: string; code_system_id: string; status: string; pending: number; failed: number }>>`
      select r.id::text, r.code_system_id::text, r.status,
        (select count(*)::int from terminology.import_jobs j where j.release_id = r.id and j.status = 'pending') as pending,
        (select count(*)::int from terminology.import_jobs j where j.release_id = r.id and j.status = 'failed') as failed
      from terminology.releases r where r.id = ${releaseId}
    `;
    if (!rel) return json({ error: "release not found" }, 404);
    if (rel.pending > 0 || rel.failed > 0) {
      return json({ error: `release not ready: ${rel.pending} pending, ${rel.failed} failed chunks` }, 400);
    }
    if (rel.status === "active") {
      return json({ ok: true, message: "already active", release_id: rel.id });
    }

    const csId = rel.code_system_id;

    await sql`update terminology.releases set status = 'loading' where id = ${releaseId}`;

    // 1. Concepts (SNOMED code -> generic concepts row per release)
    await time("concepts", async () => {
      await sql`
        insert into terminology.concepts (code_system_id, release_id, code, display, active)
        select ${csId}::uuid, ${releaseId}::uuid, sc.concept_id::text,
               coalesce(fsn.term, sc.concept_id::text), sc.active
        from terminology.snomed_concepts sc
        left join lateral (
          select term from terminology.snomed_descriptions sd
          where sd.concept_id = sc.concept_id
            and sd.type_id = ${FSN_TYPE} and sd.active
          limit 1
        ) fsn on true
        where sc.active
        on conflict (code_system_id, release_id, code) do nothing
      `;
    });

    // 2. Designations
    await time("designations", async () => {
      await sql`
        insert into terminology.designations (concept_id, language, term, use_type, active)
        select c.id, sd.language_code, sd.term,
               case sd.type_id
                 when ${FSN_TYPE} then 'fsn'
                 when ${SYNONYM_TYPE} then 'synonym'
                 else 'synonym'
               end,
               sd.active
        from terminology.snomed_descriptions sd
        join terminology.concepts c
          on c.code = sd.concept_id::text
         and c.release_id = ${releaseId}::uuid
        where sd.active
      `;
    });

    // 3. Relationships (is-a only for MVP; other types can be added later)
    await time("relationships", async () => {
      await sql`
        insert into terminology.relationships
          (code_system_id, release_id, source_concept_id, target_concept_id, relationship_type, active)
        select ${csId}::uuid, ${releaseId}::uuid, src.id, dst.id, 'is-a', sr.active
        from terminology.snomed_relationships sr
        join terminology.concepts src
          on src.code = sr.source_concept::text and src.release_id = ${releaseId}::uuid
        join terminology.concepts dst
          on dst.code = sr.destination_concept::text and dst.release_id = ${releaseId}::uuid
        where sr.active and sr.relationship_type = ${IS_A_TYPE}
      `;
    });

    // 4. Rebuild concept_search for this code system
    await time("search_rebuild", async () => {
      await sql`delete from terminology.concept_search where code_system_id = ${csId}::uuid`;
      await sql`
        insert into terminology.concept_search
          (concept_id, code_system_id, code, preferred_term, term, term_norm, language, source, weight, active)
        select c.id, c.code_system_id, c.code, c.display, d.term,
               lower(unaccent(d.term)), d.language,
               case d.use_type when 'fsn' then 'fsn' when 'preferred' then 'preferred' else 'synonym' end,
               case d.use_type when 'preferred' then 1.0 when 'fsn' then 0.9 else 0.7 end,
               d.active
        from terminology.concepts c
        join terminology.designations d on d.concept_id = c.id
        where c.release_id = ${releaseId}::uuid and d.active
      `;
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
    });

    await time("analyze", async () => {
      await sql`analyze terminology.concept_search`;
      await sql`analyze terminology.concepts`;
      await sql`analyze terminology.designations`;
    });

    // 5. Activate release + archive previous
    await time("activate", async () => {
      await sql`
        update terminology.releases set status = 'archived'
        where code_system_id = ${csId}::uuid and status = 'active' and id <> ${releaseId}::uuid
      `;
      await sql`
        update terminology.releases
        set status = 'active', activated_at = now(),
            loaded_at = coalesce(loaded_at, now())
        where id = ${releaseId}::uuid
      `;
      await sql`
        update terminology.code_systems
        set active_release_id = ${releaseId}::uuid, updated_at = now()
        where id = ${csId}::uuid
      `;
    });

    // Verification counts
    const [counts] = await sql<Array<{ concepts: number; designations: number; relationships: number; search_rows: number }>>`
      select
        (select count(*)::int from terminology.concepts where release_id = ${releaseId}::uuid) as concepts,
        (select count(*)::int from terminology.designations d
          join terminology.concepts c on c.id = d.concept_id where c.release_id = ${releaseId}::uuid) as designations,
        (select count(*)::int from terminology.relationships where release_id = ${releaseId}::uuid) as relationships,
        (select count(*)::int from terminology.concept_search where code_system_id = ${csId}::uuid) as search_rows
    `;

    return json({ ok: true, release_id: releaseId, timings_ms: timings, counts });
  } catch (e) {
    console.error("promote-release error", e);
    await sql`update terminology.releases set status = 'failed' where id = ${releaseId}`.catch(() => {});
    return json({ error: e instanceof Error ? e.message : String(e), timings_ms: timings }, 500);
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
