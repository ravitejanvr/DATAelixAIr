// Read-only terminology import recovery report.
// Does not retry, repair, reset, move, copy, or seed anything.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StorageObject = {
  name: string;
  id: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_accessed_at: string | null;
  metadata: Record<string, unknown> | null;
  path: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

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

  let body: { release_identifier?: string; release_folder?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const releaseIdentifier = (body.release_identifier ?? "SnomedCT_INT_20260701").trim();
  const releaseFolder = (body.release_folder ?? `snomed/${releaseIdentifier}`).replace(/\/+$/, "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(releaseIdentifier)) {
    return json({ error: "invalid release_identifier" }, 400);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(releaseFolder)) {
    return json({ error: "invalid release_folder" }, 400);
  }

  const parentFolder = releaseFolder.includes("/") ? releaseFolder.slice(0, releaseFolder.lastIndexOf("/")) : releaseFolder;
  const parentManifestPath = `${parentFolder}/manifest.json`;
  const expectedManifestPath = `${releaseFolder}/manifest.json`;

  const checkObject = async (path: string) => {
    const { data, error } = await admin.storage.from("ontology").download(path);
    return {
      path: `ontology/${path}`,
      exists: !error && !!data,
      error: error?.message ?? null,
    };
  };

  const listAll = async (folder: string) => {
    const limit = 1000;
    let offset = 0;
    const objects: StorageObject[] = [];
    for (;;) {
      const { data, error } = await admin.storage.from("ontology").list(folder, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`list ontology/${folder}: ${error.message}`);
      const batch = data ?? [];
      for (const obj of batch) {
        objects.push({ ...(obj as Omit<StorageObject, "path">), path: `ontology/${folder}/${obj.name}` });
      }
      if (batch.length < limit) break;
      offset += limit;
    }
    return objects;
  };

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    const [parentManifest, expectedManifest, parentObjects, expectedObjects] = await Promise.all([
      checkObject(parentManifestPath),
      checkObject(expectedManifestPath),
      listAll(parentFolder),
      listAll(releaseFolder),
    ]);

    const jobs = await sql<Array<{
      chunk_index: number;
      target_table: string;
      storage_path: string;
      attempted_storage_path: string | null;
      status: string;
      error: string | null;
      stack_trace: string | null;
      claimed_at: string | null;
      completed_at: string | null;
      created_at: string;
    }>>`
      select j.chunk_index,
             j.target_table,
             j.storage_path,
             coalesce(j.attempted_storage_path, j.storage_path) as attempted_storage_path,
             j.status,
             j.last_error as error,
             j.last_error_stack as stack_trace,
             j.claimed_at::text,
             j.completed_at::text,
             j.created_at::text
        from terminology.import_jobs j
        join terminology.releases r on r.id = j.release_id
       where r.release_identifier = ${releaseIdentifier}
       order by j.chunk_index, j.target_table
    `;

    const releaseRows = await sql<Array<{
      id: string;
      release_identifier: string;
      status: string;
      import_paused_at: string | null;
      created_at: string;
    }>>`
      select id::text, release_identifier, status, import_paused_at::text, created_at::text
        from terminology.releases
       where release_identifier = ${releaseIdentifier}
       order by created_at desc
    `;

    return json({
      ok: true,
      read_only: true,
      release_identifier: releaseIdentifier,
      release_folder: `ontology/${releaseFolder}/`,
      checked_at: new Date().toISOString(),
      manifests: {
        parent: parentManifest,
        expected: expectedManifest,
      },
      storage: {
        parent_folder: `ontology/${parentFolder}/`,
        expected_folder: `ontology/${releaseFolder}/`,
        parent_objects: parentObjects,
        expected_objects: expectedObjects,
      },
      releases: releaseRows,
      jobs: jobs.map((j) => ({
        ...j,
        exact_storage_download_path_attempted: `ontology/${j.attempted_storage_path ?? j.storage_path}`,
        stack_trace: j.stack_trace ?? "No stack trace was captured for this earlier failure; future loader failures store it here.",
      })),
    });
  } catch (e) {
    console.error("recovery-report error", e);
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
