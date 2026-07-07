// Register a terminology release + seed its import job queue.
// Requires platform_admin auth. Loads manifest.json from the ontology bucket
// (either via manifest_path or release_folder), then validates that every
// chunk's storage_path already exists in the bucket before seeding jobs.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TABLES = new Set(["snomed_concepts", "snomed_descriptions", "snomed_relationships"]);

interface Chunk {
  index: number;
  target_table: string;
  storage_path: string;
  expected_rows: number;
}
interface Manifest {
  release_identifier: string;
  effective_date?: string | null;
  source_sha256?: Record<string, string>;
  chunks: Chunk[];
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
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (!role) return json({ error: "forbidden" }, 403);

  let body: { code_system_short_name?: string; manifest?: Manifest; manifest_path?: string; release_folder?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const shortName = body.code_system_short_name ?? "snomed-ct";
  let manifest = body.manifest;
  let releaseFolder = body.release_folder?.replace(/\/+$/, "") ?? null;

  // Support loading manifest.json directly from the ontology bucket.
  if (!manifest && (body.manifest_path || releaseFolder)) {
    let path = body.manifest_path;
    if (!path && releaseFolder) path = `${releaseFolder}/manifest.json`;
    if (!path || !/^[A-Za-z0-9][A-Za-z0-9._\-/]*manifest\.json$/.test(path)) {
      return json({ error: "invalid manifest_path" }, 400);
    }
    const dl = await admin.storage.from("ontology").download(path);
    if (dl.error || !dl.data) {
      return json({ error: `manifest not found at ontology/${path}: ${dl.error?.message ?? "no data"}` }, 404);
    }
    try {
      manifest = JSON.parse(await dl.data.text()) as Manifest;
    } catch (e) {
      return json({ error: `manifest.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}` }, 400);
    }
  }

  if (!manifest || !manifest.release_identifier || !Array.isArray(manifest.chunks)) {
    return json({ error: "manifest.release_identifier and chunks[] are required" }, 400);
  }
  for (const c of manifest.chunks) {
    if (!ALLOWED_TABLES.has(c.target_table)) {
      return json({ error: `disallowed target_table: ${c.target_table}` }, 400);
    }
    if (typeof c.index !== "number" || !c.storage_path) {
      return json({ error: "each chunk needs index and storage_path" }, 400);
    }
  }

  // ---- Validate every chunk exists in Storage before seeding jobs. ----
  // Group expected paths by folder, then list each folder once.
  const expectedByFolder = new Map<string, Set<string>>();
  for (const c of manifest.chunks) {
    const slash = c.storage_path.lastIndexOf("/");
    const folder = slash >= 0 ? c.storage_path.slice(0, slash) : "";
    const file = slash >= 0 ? c.storage_path.slice(slash + 1) : c.storage_path;
    if (!expectedByFolder.has(folder)) expectedByFolder.set(folder, new Set());
    expectedByFolder.get(folder)!.add(file);
  }

  const present = new Set<string>();
  for (const folder of expectedByFolder.keys()) {
    const { data: listed, error: listErr } = await admin.storage
      .from("ontology")
      .list(folder, { limit: 1000 });
    if (listErr) {
      return json({ error: `failed to list ontology/${folder}: ${listErr.message}` }, 500);
    }
    for (const obj of listed ?? []) {
      if (obj.name && !obj.name.endsWith("/")) present.add(`${folder}/${obj.name}`);
    }
  }

  const missing = manifest.chunks
    .map((c) => c.storage_path)
    .filter((p) => !present.has(p));

  if (missing.length > 0) {
    // Look for the same basenames in the parent folder (one level up) so the
    // client can offer a one-click "Repair paths" that moves them into place.
    const repairCandidates: Array<{ from: string; to: string }> = [];
    const parents = new Set<string>();
    for (const p of missing) {
      const slash = p.lastIndexOf("/");
      const folder = slash >= 0 ? p.slice(0, slash) : "";
      const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
      if (parent) parents.add(parent);
    }
    const parentIndex = new Map<string, Set<string>>();
    for (const parent of parents) {
      const { data: listed } = await admin.storage
        .from("ontology")
        .list(parent, { limit: 1000 });
      const names = new Set<string>();
      for (const obj of listed ?? []) if (obj.name && !obj.name.endsWith("/")) names.add(obj.name);
      parentIndex.set(parent, names);
    }
    for (const p of missing) {
      const slash = p.lastIndexOf("/");
      const folder = slash >= 0 ? p.slice(0, slash) : "";
      const file = slash >= 0 ? p.slice(slash + 1) : p;
      const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
      const parentNames = parentIndex.get(parent);
      if (parentNames?.has(file)) {
        repairCandidates.push({ from: `${parent}/${file}`, to: p });
      }
    }

    return json({
      error: "missing_objects",
      message: `${missing.length} chunk object(s) referenced by manifest are not in ontology/. No jobs were seeded.`,
      release_identifier: manifest.release_identifier,
      release_folder: releaseFolder,
      missing,
      repair_candidates: repairCandidates,
    }, 409);
  }

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    const [cs] = await sql<Array<{ id: string }>>`
      select id::text from terminology.code_systems where short_name = ${shortName}
    `;
    if (!cs) return json({ error: `unknown code_system: ${shortName}` }, 404);

    // Upsert release
    const [rel] = await sql<Array<{ id: string }>>`
      insert into terminology.releases (
        code_system_id, release_identifier, effective_date,
        source_sha256, status, chunk_manifest
      ) values (
        ${cs.id}, ${manifest.release_identifier},
        ${manifest.effective_date ?? null},
        ${JSON.stringify(manifest.source_sha256 ?? {})}::jsonb,
        'pending',
        ${JSON.stringify(manifest)}::jsonb
      )
      on conflict (code_system_id, release_identifier) do update
        set chunk_manifest = excluded.chunk_manifest,
            source_sha256 = excluded.source_sha256,
            status = case
              when terminology.releases.status in ('active','archived') then terminology.releases.status
              else 'pending'
            end
      returning id::text
    `;

    // Seed jobs (idempotent on unique(release_id, chunk_index, target_table))
    const jobRows = manifest.chunks.map((c) => ({
      release_id: rel.id,
      chunk_index: c.index,
      storage_path: c.storage_path,
      target_table: c.target_table,
      expected_rows: c.expected_rows ?? 0,
      status: "pending",
    }));

    if (jobRows.length > 0) {
      await sql`
        insert into terminology.import_jobs ${sql(jobRows)}
        on conflict (release_id, chunk_index, target_table) do nothing
      `;
    }

    return json({
      ok: true,
      release_id: rel.id,
      chunks_seeded: jobRows.length,
      validated_paths: manifest.chunks.length,
    });
  } catch (e) {
    console.error("create-release error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
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
