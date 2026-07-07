// Pause a terminology import without retrying, repairing, or modifying completed chunks.
// Requires platform_admin. The loader is gated by releases.import_paused_at and only
// claims pending jobs for unpaused releases.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

  let body: { release_identifier?: string; release_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const releaseIdentifier = body.release_identifier?.trim();
  const releaseId = body.release_id?.trim();
  if (!releaseIdentifier && !releaseId) {
    return json({ error: "release_identifier or release_id is required" }, 400);
  }
  if (releaseIdentifier && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(releaseIdentifier)) {
    return json({ error: "invalid release_identifier" }, 400);
  }
  if (releaseId && !/^[0-9a-fA-F-]{36}$/.test(releaseId)) {
    return json({ error: "invalid release_id" }, 400);
  }

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    const releaseRows = releaseId
      ? await sql<Array<{ id: string; release_identifier: string }>>`
          update terminology.releases
             set import_paused_at = now()
           where id = ${releaseId}
           returning id::text, release_identifier
        `
      : await sql<Array<{ id: string; release_identifier: string }>>`
          update terminology.releases
             set import_paused_at = now()
           where release_identifier = ${releaseIdentifier}
           returning id::text, release_identifier
        `;

    if (releaseRows.length === 0) return json({ error: "release not found" }, 404);
    const ids = releaseRows.map((r) => r.id);

    const pausedJobs = await sql<Array<{ n: number }>>`
      update terminology.import_jobs
         set status = 'paused'
       where release_id in ${sql(ids)}
         and status = 'pending'
       returning 1 as n
    `;

    let cronJobDisabled = false;
    let cronDisableError: string | null = null;
    try {
      const cronRows = await sql<Array<{ jobname: string }>>`
        update cron.job
           set active = false
         where jobname = 'terminology-load-chunk-30s'
            or command ilike '%terminology-load-chunk%'
        returning jobname
      `;
      cronJobDisabled = cronRows.length > 0;
    } catch (e) {
      cronDisableError = e instanceof Error ? e.message : String(e);
    }

    return json({
      ok: true,
      releases_paused: releaseRows,
      pending_jobs_paused: pausedJobs.length,
      cron_job_disabled: cronJobDisabled,
      cron_disable_error: cronDisableError,
      note: "Completed and failed chunks were not modified. The loader will not claim chunks while this release is paused.",
    });
  } catch (e) {
    console.error("pause-import error", e);
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
