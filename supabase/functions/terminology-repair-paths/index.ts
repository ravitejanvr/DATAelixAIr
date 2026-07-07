// Move misplaced ontology objects into the folder the manifest expects, then
// reset any failed import_jobs for the matching release back to pending so the
// loader can resume. Requires platform_admin.
//
// Input: { release_folder: string, manifest_path?: string }
// Behavior:
//   1. Load manifest.json from ontology/<release_folder>/manifest.json
//   2. For each chunk.storage_path missing at expected location, look for the
//      same basename in the parent folder and move it into place.
//   3. If a release row exists for manifest.release_identifier, reset all
//      failed import_jobs on that release back to pending.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Chunk { index: number; target_table: string; storage_path: string; expected_rows: number; }
interface Manifest { release_identifier: string; chunks: Chunk[]; }

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

  let body: { release_folder?: string; manifest_path?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const releaseFolder = body.release_folder?.replace(/\/+$/, "");
  const manifestPath = body.manifest_path ?? (releaseFolder ? `${releaseFolder}/manifest.json` : undefined);
  if (!manifestPath || !/^[A-Za-z0-9][A-Za-z0-9._\-/]*manifest\.json$/.test(manifestPath)) {
    return json({ error: "release_folder or manifest_path is required" }, 400);
  }

  let dl = await admin.storage.from("ontology").download(manifestPath);
  // Fallback: manifest may still be in the parent folder (pre-repair state).
  if ((dl.error || !dl.data) && releaseFolder && releaseFolder.includes("/")) {
    const parent = releaseFolder.slice(0, releaseFolder.lastIndexOf("/"));
    const parentManifest = `${parent}/manifest.json`;
    const alt = await admin.storage.from("ontology").download(parentManifest);
    if (!alt.error && alt.data) {
      dl = alt;
      // Move the manifest into the expected folder so subsequent runs find it.
      await admin.storage.from("ontology").move(parentManifest, manifestPath).catch(() => {});
    }
  }
  if (dl.error || !dl.data) return json({ error: `manifest not found at ontology/${manifestPath} (also checked parent folder)` }, 404);

  let manifest: Manifest;
  try { manifest = JSON.parse(await dl.data.text()) as Manifest; }
  catch (e) { return json({ error: `manifest.json invalid: ${e instanceof Error ? e.message : String(e)}` }, 400); }

  // Build parent-folder index of existing objects for basename lookup.
  const expectedFolders = new Set<string>();
  for (const c of manifest.chunks) {
    const slash = c.storage_path.lastIndexOf("/");
    const folder = slash >= 0 ? c.storage_path.slice(0, slash) : "";
    expectedFolders.add(folder);
  }
  const parents = new Set<string>();
  for (const folder of expectedFolders) {
    const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";
    if (parent) parents.add(parent);
  }

  const listFolder = async (folder: string) => {
    const { data, error } = await admin.storage.from("ontology").list(folder, { limit: 1000 });
    if (error) throw new Error(`list ontology/${folder}: ${error.message}`);
    const names = new Set<string>();
    for (const obj of data ?? []) if (obj.name && !obj.name.endsWith("/")) names.add(obj.name);
    return names;
  };

  try {
    const existingByFolder = new Map<string, Set<string>>();
    for (const f of expectedFolders) existingByFolder.set(f, await listFolder(f));
    const parentByFolder = new Map<string, Set<string>>();
    for (const p of parents) parentByFolder.set(p, await listFolder(p));

    const moved: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ from: string; to: string; error: string }> = [];

    for (const c of manifest.chunks) {
      const slash = c.storage_path.lastIndexOf("/");
      const folder = slash >= 0 ? c.storage_path.slice(0, slash) : "";
      const file = slash >= 0 ? c.storage_path.slice(slash + 1) : c.storage_path;
      const parent = folder.includes("/") ? folder.slice(0, folder.lastIndexOf("/")) : "";

      if (existingByFolder.get(folder)?.has(file)) { skipped.push(c.storage_path); continue; }
      const parentNames = parentByFolder.get(parent);
      if (!parentNames?.has(file)) continue; // nothing to repair for this chunk

      const from = `${parent}/${file}`;
      const to = c.storage_path;
      const { error: mvErr } = await admin.storage.from("ontology").move(from, to);
      if (mvErr) failed.push({ from, to, error: mvErr.message });
      else moved.push(to);
    }

    // Reset failed jobs for the release if it already exists.
    let jobsReset = 0;
    const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
    try {
      const rows = await sql<Array<{ n: number }>>`
        with r as (
          select id from terminology.releases where release_identifier = ${manifest.release_identifier}
        )
        update terminology.import_jobs j
           set status='pending', last_error=null, claimed_at=null
         where j.release_id in (select id from r) and j.status='failed'
        returning 1 as n
      `;
      jobsReset = rows.length;
    } finally {
      await sql.end({ timeout: 5 }).catch(() => {});
    }

    return json({
      ok: failed.length === 0,
      release_identifier: manifest.release_identifier,
      moved,
      skipped_already_in_place: skipped,
      failed,
      jobs_reset_to_pending: jobsReset,
    });
  } catch (e) {
    console.error("repair-paths error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
