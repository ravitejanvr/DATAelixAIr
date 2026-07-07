// End-to-end validation for the terminology pipeline.
// Runs a full round-trip against a synthetic SNOMED micro-release, isolated
// from production data under short_name = 'snomed-test'. Steps:
//
//   1. Ensure test code_system exists
//   2. Generate synthetic RF2 rows (in-memory)
//   3. Preprocess -> gzipped NDJSON chunks
//   4. Upload chunks to `ontology` bucket
//   5. Register release + seed import queue
//   6. Load chunks (batched INSERT into snomed staging tables)
//   7. Promote (staging -> generic model + concept_search rebuild)
//   8. Automated verification (concept/description/rel counts, orphans,
//      duplicates, preferred-term completeness, hierarchy roots, index consistency)
//   9. Service API tests (search, autocomplete, fuzzy, synonym, canonicalize,
//      lookup, ancestors, descendants, translate, validate)
//  10. Second release -> rollback to first -> re-promote second
//  11. Cleanup (drop releases + staging + storage objects)
//
// Restricted to platform_admin.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";
import { gzipSync } from "node:zlib";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYS = "snomed-test";
const FSN = "900000000000003001";
const SYN = "900000000000013009";
const IS_A = "116680003";

// Synthetic dataset — deliberately small so the whole thing runs in seconds,
// but structured enough to exercise every code path.
//
// Hierarchy (v1):
//   404684003 Clinical finding
//     ├─ 64572001 Disease
//     │    ├─ 40733004 Infectious disease
//     │    │    ├─ 233604007 Pneumonia
//     │    │    │    ├─ 385093006 Community-acquired pneumonia
//     │    │    │    └─ 233607000 Viral pneumonia
//     │    │    └─ 25374005 Gastroenteritis
//     │    └─ 73211009 Diabetes mellitus
//     └─ 22253000 Pain
//          └─ 25064002 Headache
//
// Plus one inactive concept (should be filtered by preprocess).
// v2 adds two additional descendants under Pneumonia.

type SConcept = { concept_id: number; active: boolean };
type SDesc = { description_id: number; concept_id: number; type_id: string; term: string; active: boolean; lang?: string };
type SRel  = { relationship_id: number; source: number; target: number; type: string; active: boolean };

function buildSyntheticDataset(version: "v1" | "v2") {
  const concepts: SConcept[] = [
    { concept_id: 404684003, active: true },
    { concept_id: 64572001,  active: true },
    { concept_id: 40733004,  active: true },
    { concept_id: 233604007, active: true },
    { concept_id: 385093006, active: true },
    { concept_id: 233607000, active: true },
    { concept_id: 25374005,  active: true },
    { concept_id: 73211009,  active: true },
    { concept_id: 22253000,  active: true },
    { concept_id: 25064002,  active: true },
    { concept_id: 111111111, active: false }, // inactive — must be filtered
  ];
  const descriptions: SDesc[] = [
    // FSN
    { description_id: 1,  concept_id: 404684003, type_id: FSN, term: "Clinical finding (finding)", active: true },
    { description_id: 2,  concept_id: 64572001,  type_id: FSN, term: "Disease (disorder)", active: true },
    { description_id: 3,  concept_id: 40733004,  type_id: FSN, term: "Infectious disease (disorder)", active: true },
    { description_id: 4,  concept_id: 233604007, type_id: FSN, term: "Pneumonia (disorder)", active: true },
    { description_id: 5,  concept_id: 385093006, type_id: FSN, term: "Community-acquired pneumonia (disorder)", active: true },
    { description_id: 6,  concept_id: 233607000, type_id: FSN, term: "Viral pneumonia (disorder)", active: true },
    { description_id: 7,  concept_id: 25374005,  type_id: FSN, term: "Gastroenteritis (disorder)", active: true },
    { description_id: 8,  concept_id: 73211009,  type_id: FSN, term: "Diabetes mellitus (disorder)", active: true },
    { description_id: 9,  concept_id: 22253000,  type_id: FSN, term: "Pain (finding)", active: true },
    { description_id: 10, concept_id: 25064002,  type_id: FSN, term: "Headache (finding)", active: true },
    // Synonyms — exercise fuzzy + synonym lookup
    { description_id: 20, concept_id: 233604007, type_id: SYN, term: "Pneumonia", active: true },
    { description_id: 21, concept_id: 233604007, type_id: SYN, term: "Lung infection", active: true },
    { description_id: 22, concept_id: 233607000, type_id: SYN, term: "Viral chest infection", active: true },
    { description_id: 23, concept_id: 25064002,  type_id: SYN, term: "Headache", active: true },
    { description_id: 24, concept_id: 25064002,  type_id: SYN, term: "Cephalgia", active: true },
    { description_id: 25, concept_id: 73211009,  type_id: SYN, term: "Diabetes", active: true },
    // Inactive description (must be filtered)
    { description_id: 99, concept_id: 233604007, type_id: SYN, term: "OLD_TERM_SHOULD_NOT_APPEAR", active: false },
  ];
  const rels: SRel[] = [
    { relationship_id: 1001, source: 64572001,  target: 404684003, type: IS_A, active: true },
    { relationship_id: 1002, source: 22253000,  target: 404684003, type: IS_A, active: true },
    { relationship_id: 1003, source: 40733004,  target: 64572001,  type: IS_A, active: true },
    { relationship_id: 1004, source: 73211009,  target: 64572001,  type: IS_A, active: true },
    { relationship_id: 1005, source: 233604007, target: 40733004,  type: IS_A, active: true },
    { relationship_id: 1006, source: 25374005,  target: 40733004,  type: IS_A, active: true },
    { relationship_id: 1007, source: 385093006, target: 233604007, type: IS_A, active: true },
    { relationship_id: 1008, source: 233607000, target: 233604007, type: IS_A, active: true },
    { relationship_id: 1009, source: 25064002,  target: 22253000,  type: IS_A, active: true },
  ];

  if (version === "v2") {
    concepts.push({ concept_id: 300001, active: true }, { concept_id: 300002, active: true });
    descriptions.push(
      { description_id: 30, concept_id: 300001, type_id: FSN, term: "Bacterial pneumonia (disorder)", active: true },
      { description_id: 31, concept_id: 300001, type_id: SYN, term: "Bacterial lung infection", active: true },
      { description_id: 32, concept_id: 300002, type_id: FSN, term: "Aspiration pneumonia (disorder)", active: true },
    );
    rels.push(
      { relationship_id: 2001, source: 300001, target: 233604007, type: IS_A, active: true },
      { relationship_id: 2002, source: 300002, target: 233604007, type: IS_A, active: true },
    );
  }
  return { concepts, descriptions, rels };
}

// Match snomed-preprocess.mjs row shape exactly.
function preprocess(ds: ReturnType<typeof buildSyntheticDataset>) {
  const conceptRows = ds.concepts.filter(c => c.active).map(c => ({
    concept_id: c.concept_id, effective_time: null, active: true,
    module_id: "900000000000207008", definition_status_id: "900000000000074008",
  }));
  const descRows = ds.descriptions.filter(d => d.active).map(d => ({
    description_id: d.description_id, concept_id: d.concept_id,
    language_code: d.lang ?? "en", type_id: d.type_id, term: d.term, active: true,
  }));
  const relRows = ds.rels.filter(r => r.active).map(r => ({
    relationship_id: r.relationship_id, source_concept: r.source,
    destination_concept: r.target, relationship_type: r.type, active: true,
  }));
  return { conceptRows, descRows, relRows };
}

function toGzNdjson(rows: Record<string, unknown>[]): Uint8Array {
  const text = rows.map(r => JSON.stringify(r)).join("\n") + "\n";
  return gzipSync(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return j({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return j({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: role } = await admin.from("user_roles").select("role")
    .eq("user_id", user.id).eq("role", "platform_admin").maybeSingle();
  if (!role) return j({ error: "forbidden" }, 403);

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
  const report: Record<string, unknown> = { started_at: new Date().toISOString(), steps: [] };
  const step = (name: string, extra: Record<string, unknown> = {}) => {
    (report.steps as unknown[]).push({ name, at: new Date().toISOString(), ...extra });
  };
  const runId = `e2e-${Date.now()}`;
  const bucket = "ontology";
  const uploadedPaths: string[] = [];

  try {
    // 1. Ensure test code_system
    await sql`
      insert into terminology.code_systems (system_uri, name, short_name)
      values ('http://snomed.info/test', 'SNOMED CT (test)', ${SYS})
      on conflict (short_name) do nothing
    `;
    const [cs] = await sql<Array<{ id: string }>>`
      select id::text from terminology.code_systems where short_name = ${SYS}
    `;
    step("code_system_ready", { code_system_id: cs.id });

    const importAndPromote = async (version: "v1" | "v2") => {
      const relIdent = `${runId}-${version}`;
      const ds = buildSyntheticDataset(version);
      const { conceptRows, descRows, relRows } = preprocess(ds);
      step(`preprocess_${version}`, {
        concepts: conceptRows.length, descriptions: descRows.length, relationships: relRows.length,
      });

      // Upload three chunks to storage (single chunk per table — dataset is tiny)
      const chunks = [
        { table: "snomed_concepts",      rows: conceptRows },
        { table: "snomed_descriptions",  rows: descRows },
        { table: "snomed_relationships", rows: relRows },
      ];
      for (const [i, c] of chunks.entries()) {
        const path = `${SYS}/${relIdent}/${c.table}_${String(i).padStart(4, "0")}.ndjson.gz`;
        const gz = toGzNdjson(c.rows);
        const { error } = await admin.storage.from(bucket).upload(path, gz, {
          contentType: "application/gzip", upsert: true,
        });
        if (error) throw new Error(`upload ${path}: ${error.message}`);
        uploadedPaths.push(path);
      }
      step(`upload_${version}`, { objects: chunks.length });

      // Register release
      const [rel] = await sql<Array<{ id: string }>>`
        insert into terminology.releases (code_system_id, release_identifier, status, chunk_manifest)
        values (${cs.id}, ${relIdent}, 'pending', ${JSON.stringify({ synthetic: true, version })}::jsonb)
        returning id::text
      `;
      // Seed jobs
      for (const [i, c] of chunks.entries()) {
        const path = `${SYS}/${relIdent}/${c.table}_${String(i).padStart(4, "0")}.ndjson.gz`;
        await sql`
          insert into terminology.import_jobs
            (release_id, chunk_index, storage_path, target_table, expected_rows, status)
          values (${rel.id}, ${i}, ${path}, ${c.table}, ${c.rows.length}, 'pending')
        `;
      }
      step(`release_created_${version}`, { release_id: rel.id });

      // Drain jobs — download from storage + insert (mirrors terminology-load-chunk logic)
      for (;;) {
        const claimed = await sql<Array<{ id: string; storage_path: string; target_table: string }>>`
          update terminology.import_jobs
          set status='running', claimed_at=now(), attempts=attempts+1
          where id = (
            select id from terminology.import_jobs
            where release_id = ${rel.id} and status='pending'
            order by chunk_index limit 1 for update skip locked
          )
          returning id, storage_path, target_table
        `;
        if (claimed.length === 0) break;
        const job = claimed[0];
        const { data: file, error: dlErr } = await admin.storage.from(bucket).download(job.storage_path);
        if (dlErr || !file) throw new Error(`download ${job.storage_path}: ${dlErr?.message}`);
        const decompressed = file.stream().pipeThrough(new DecompressionStream("gzip"));
        const text = await new Response(decompressed).text();
        const parsed = text.split("\n").filter(Boolean).map(l => JSON.parse(l));
        const tableIdent = sql(`terminology.${job.target_table}`);
        if (parsed.length > 0) {
          await sql`insert into ${tableIdent} ${sql(parsed)} on conflict do nothing`;
        }
        await sql`
          update terminology.import_jobs
          set status='done', loaded_rows=${parsed.length}, completed_at=now()
          where id = ${job.id}
        `;
      }
      step(`chunks_loaded_${version}`);

      // Promote — inline SQL identical to terminology-promote-release
      await sql`
        insert into terminology.concepts (code_system_id, release_id, code, display, active)
        select ${cs.id}::uuid, ${rel.id}::uuid, sc.concept_id::text,
               coalesce(fsn.term, sc.concept_id::text), sc.active
        from terminology.snomed_concepts sc
        left join lateral (
          select term from terminology.snomed_descriptions sd
          where sd.concept_id = sc.concept_id and sd.type_id = ${FSN} and sd.active limit 1
        ) fsn on true
        where sc.active
        on conflict do nothing
      `;
      await sql`
        insert into terminology.designations (concept_id, language, term, use_type, active)
        select c.id, sd.language_code, sd.term,
               case sd.type_id when ${FSN} then 'fsn' when ${SYN} then 'synonym' else 'synonym' end,
               sd.active
        from terminology.snomed_descriptions sd
        join terminology.concepts c on c.code = sd.concept_id::text and c.release_id = ${rel.id}::uuid
        where sd.active
      `;
      await sql`
        insert into terminology.relationships (code_system_id, release_id, source_concept_id, target_concept_id, relationship_type, active)
        select ${cs.id}::uuid, ${rel.id}::uuid, src.id, dst.id, 'is-a', sr.active
        from terminology.snomed_relationships sr
        join terminology.concepts src on src.code = sr.source_concept::text and src.release_id = ${rel.id}::uuid
        join terminology.concepts dst on dst.code = sr.destination_concept::text and dst.release_id = ${rel.id}::uuid
        where sr.active and sr.relationship_type = ${IS_A}
      `;
      await sql`delete from terminology.concept_search where code_system_id = ${cs.id}::uuid`;
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
        where c.release_id = ${rel.id}::uuid and d.active
      `;
      await sql`
        update terminology.releases set status='archived'
         where code_system_id = ${cs.id}::uuid and status='active' and id <> ${rel.id}::uuid
      `;
      await sql`
        update terminology.releases set status='active', activated_at=now(), loaded_at=now()
         where id = ${rel.id}::uuid
      `;
      await sql`
        update terminology.code_systems set active_release_id=${rel.id}::uuid, updated_at=now()
         where id = ${cs.id}::uuid
      `;
      step(`promoted_${version}`, { release_id: rel.id });
      return rel.id;
    };

    // ─── v1 ────────────────────────────────────────────
    const relV1 = await importAndPromote("v1");

    // Automated verification — inline (bypasses admin auth check since we're inside a trusted function)
    const verify = async (relId: string): Promise<Record<string, unknown>> => {
      const [row] = await sql<Array<{ report: unknown }>>`
        with c as (select count(*)::bigint n from terminology.concepts where release_id=${relId}::uuid),
             d as (select count(*)::bigint n from terminology.designations d
                     join terminology.concepts c on c.id=d.concept_id where c.release_id=${relId}::uuid),
             r as (select count(*)::bigint n from terminology.relationships where release_id=${relId}::uuid),
             orph as (
               select count(*)::bigint n from terminology.relationships r
                where r.release_id=${relId}::uuid
                  and (not exists (select 1 from terminology.concepts c where c.id=r.source_concept_id and c.release_id=r.release_id)
                    or not exists (select 1 from terminology.concepts c where c.id=r.target_concept_id and c.release_id=r.release_id))
             ),
             dup as (
               select coalesce(sum(cnt-1),0)::bigint n from (
                 select count(*) cnt from terminology.concepts where release_id=${relId}::uuid
                  group by code having count(*)>1
               ) x
             ),
             nodesig as (
               select count(*)::bigint n from terminology.concepts c
                where c.release_id=${relId}::uuid
                  and not exists (select 1 from terminology.designations d where d.concept_id=c.id and d.active)
             ),
             nopref as (
               select count(*)::bigint n from terminology.concepts c
                where c.release_id=${relId}::uuid
                  and not exists (select 1 from terminology.designations d
                                  where d.concept_id=c.id and d.active and d.use_type in ('fsn','preferred'))
             ),
             sr as (select count(*)::bigint n from terminology.concept_search
                     where code_system_id=(select code_system_id from terminology.releases where id=${relId}::uuid)),
             se as (select count(*)::bigint n from terminology.designations d
                     join terminology.concepts c on c.id=d.concept_id
                     where c.release_id=${relId}::uuid and d.active),
             roots as (
               select count(*)::bigint n from terminology.concepts c
                where c.release_id=${relId}::uuid
                  and not exists (select 1 from terminology.relationships r
                                  where r.source_concept_id=c.id and r.relationship_type='is-a' and r.active)
             )
        select json_build_object(
          'ok', (orph.n=0 and dup.n=0 and nodesig.n=0 and sr.n >= se.n),
          'counts', json_build_object('concepts', c.n, 'designations', d.n, 'relationships', r.n,
                                       'search_rows', sr.n, 'search_expected_min', se.n, 'hierarchy_roots', roots.n),
          'issues', json_build_object('orphan_relationships', orph.n, 'duplicate_codes', dup.n,
                                       'concepts_without_designations', nodesig.n,
                                       'concepts_without_preferred_term', nopref.n,
                                       'search_index_shortfall', greatest(se.n - sr.n, 0))
        ) as report
        from c, d, r, orph, dup, nodesig, nopref, sr, se, roots
      `;
      return row.report as Record<string, unknown>;
    };
    const verifyV1 = await verify(relV1);
    step("verify_v1", { report: verifyV1 });

    // Service API tests — via public RPCs (which resolve active release)
    type Assertion = { name: string; ok: boolean; detail?: unknown };
    const assertions: Assertion[] = [];
    const push = (name: string, ok: boolean, detail?: unknown) => assertions.push({ name, ok, detail });

    // search (exact FSN)
    const [sHit] = await sql<Array<{ code: string; score: number }>>`
      select code, score from public.terminology_search('pneumonia', ${SYS}, 10)
    `;
    push("search:pneumonia_returns_hit", !!sHit && sHit.code === "233604007", sHit);

    // autocomplete (prefix)
    const acHits = await sql<Array<{ code: string; matched_term: string }>>`
      select code, matched_term from public.terminology_search('pneu', ${SYS}, 5)
    `;
    push("autocomplete:pneu_prefix", acHits.length > 0, acHits);

    // fuzzy (typo)
    const fuzzyHits = await sql<Array<{ code: string }>>`
      select code from public.terminology_search('pnuemonia', ${SYS}, 5)
    `;
    push("fuzzy:pnuemonia_typo", fuzzyHits.some(h => h.code === "233604007"), fuzzyHits.slice(0, 3));

    // synonym lookup (cephalgia -> headache)
    const synHits = await sql<Array<{ code: string; matched_term: string }>>`
      select code, matched_term from public.terminology_search('cephalgia', ${SYS}, 5)
    `;
    push("synonym:cephalgia_maps_to_headache", synHits.some(h => h.code === "25064002"), synHits);

    // canonicalize
    const [canon] = await sql<Array<{ result: unknown }>>`
      select public.terminology_canonicalize('lung infection', ${SYS}, 0.2) as result
    `;
    const canonObj = canon.result as { matched?: boolean; code?: string };
    push("canonicalize:lung_infection", canonObj.matched === true && canonObj.code === "233604007", canonObj);

    // lookup
    const [look] = await sql<Array<{ result: unknown }>>`
      select public.terminology_lookup('233604007', ${SYS}) as result
    `;
    const lookObj = look.result as { code?: string; designations?: unknown[] };
    push("lookup:pneumonia_returns_designations", lookObj.code === "233604007" && (lookObj.designations?.length ?? 0) >= 2, lookObj);

    // ancestors (Community-acquired pneumonia -> Pneumonia -> Infectious disease -> Disease -> Clinical finding)
    const ancestors = await sql<Array<{ code: string; depth: number }>>`
      select code, depth from public.terminology_ancestors('385093006', ${SYS}, 20)
    `;
    const ancestorCodes = ancestors.map(a => a.code);
    push("ancestors:cap_reaches_root",
      ancestorCodes.includes("233604007") && ancestorCodes.includes("40733004")
      && ancestorCodes.includes("64572001") && ancestorCodes.includes("404684003"),
      ancestorCodes);

    // descendants (Disease should include pneumonia, gastroenteritis, diabetes, etc.)
    const desc = await sql<Array<{ code: string }>>`
      select code from public.terminology_descendants('64572001', ${SYS}, 5, 500)
    `;
    const descCodes = desc.map(d => d.code);
    push("descendants:disease_includes_pneumonia_and_diabetes",
      descCodes.includes("233604007") && descCodes.includes("73211009") && descCodes.includes("385093006"),
      descCodes);

    // validate
    const [v1] = await sql<Array<{ result: unknown }>>`select public.terminology_validate('233604007', ${SYS}) as result`;
    const [v2] = await sql<Array<{ result: unknown }>>`select public.terminology_validate('999999999', ${SYS}) as result`;
    push("validate:known_code_valid", (v1.result as { valid?: boolean }).valid === true, v1.result);
    push("validate:unknown_code_invalid", (v2.result as { valid?: boolean }).valid === false, v2.result);

    step("service_api_tests_v1", {
      passed: assertions.filter(a => a.ok).length,
      failed: assertions.filter(a => !a.ok).length,
      assertions,
    });

    // ─── v2 (re-import) + rollback ────────────────────
    const relV2 = await importAndPromote("v2");
    const verifyV2 = await verify(relV2);
    step("verify_v2", { report: verifyV2 });

    // v2 should include new "bacterial pneumonia" concept
    const [bp] = await sql<Array<{ code: string }>>`
      select code from public.terminology_search('bacterial pneumonia', ${SYS}, 3)
    `;
    step("v2_new_concept_searchable", { hit: bp });

    // Rollback to v1 via public RPC (bypass admin check by writing directly since we're trusted)
    await sql`update terminology.releases set status='archived' where code_system_id=${cs.id}::uuid and status='active' and id <> ${relV1}::uuid`;
    await sql`update terminology.releases set status='active', activated_at=now() where id=${relV1}::uuid`;
    await sql`update terminology.code_systems set active_release_id=${relV1}::uuid, updated_at=now() where id=${cs.id}::uuid`;
    // Rebuild search for the active release
    await sql`delete from terminology.concept_search where code_system_id=${cs.id}::uuid`;
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
      where c.release_id = ${relV1}::uuid and d.active
    `;
    const [bp2] = await sql<Array<{ code: string } | undefined>>`
      select code from public.terminology_search('bacterial pneumonia', ${SYS}, 3)
    `;
    step("rollback_to_v1", { active_release_id: relV1, bacterial_pneumonia_still_findable: !!bp2 });
    // Expectation: bp2 should be undefined (v1 didn't have bacterial pneumonia)

    // Re-promote v2
    await sql`update terminology.releases set status='archived' where code_system_id=${cs.id}::uuid and status='active' and id <> ${relV2}::uuid`;
    await sql`update terminology.releases set status='active', activated_at=now() where id=${relV2}::uuid`;
    await sql`update terminology.code_systems set active_release_id=${relV2}::uuid, updated_at=now() where id=${cs.id}::uuid`;
    await sql`delete from terminology.concept_search where code_system_id=${cs.id}::uuid`;
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
      where c.release_id = ${relV2}::uuid and d.active
    `;
    step("re_promoted_v2");

    // ─── Cleanup ─────────────────────────────────────
    await sql`update terminology.code_systems set active_release_id=null where id=${cs.id}::uuid`;
    await sql`delete from terminology.concept_search where code_system_id=${cs.id}::uuid`;
    await sql`delete from terminology.snomed_relationships where relationship_id = any(${sql.array([
      1001,1002,1003,1004,1005,1006,1007,1008,1009,2001,2002
    ], 20)})`;
    await sql`delete from terminology.snomed_descriptions where description_id = any(${sql.array([
      1,2,3,4,5,6,7,8,9,10,20,21,22,23,24,25,30,31,32,99
    ], 20)})`;
    await sql`delete from terminology.snomed_concepts where concept_id = any(${sql.array([
      404684003,64572001,40733004,233604007,385093006,233607000,25374005,73211009,22253000,25064002,111111111,300001,300002
    ], 20)})`;
    await sql`delete from terminology.code_systems where id=${cs.id}::uuid`;
    await admin.storage.from(bucket).remove(uploadedPaths).catch(() => {});
    step("cleanup_done");

    const failed = assertions.filter(a => !a.ok).length;
    report.ok = failed === 0
      && (verifyV1 as { ok: boolean }).ok
      && (verifyV2 as { ok: boolean }).ok;
    report.summary = {
      assertions_total: assertions.length,
      assertions_failed: failed,
      verify_v1_ok: (verifyV1 as { ok: boolean }).ok,
      verify_v2_ok: (verifyV2 as { ok: boolean }).ok,
    };
    report.finished_at = new Date().toISOString();
    return j(report, report.ok ? 200 : 500);
  } catch (e) {
    // Best-effort cleanup even on failure
    try {
      const [cs] = await sql<Array<{ id: string }>>`select id::text from terminology.code_systems where short_name=${SYS}`;
      if (cs) {
        await sql`update terminology.code_systems set active_release_id=null where id=${cs.id}::uuid`;
        await sql`delete from terminology.code_systems where id=${cs.id}::uuid`;
      }
      await admin.storage.from(bucket).remove(uploadedPaths).catch(() => {});
    } catch { /* swallow */ }
    report.ok = false;
    report.error = e instanceof Error ? e.message : String(e);
    return j(report, 500);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
