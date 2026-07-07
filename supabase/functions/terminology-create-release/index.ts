// Register a terminology release + seed its import job queue.
// Requires platform_admin auth. Input: { code_system_short_name, manifest }
// where manifest matches the preprocessing script output (release_identifier,
// effective_date, source_sha256, chunks: [{index, target_table, storage_path, expected_rows}]).

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

  let body: { code_system_short_name?: string; manifest?: Manifest };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const shortName = body.code_system_short_name ?? "snomed-ct";
  const manifest = body.manifest;
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
