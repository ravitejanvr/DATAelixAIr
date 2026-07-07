// Operator recovery: truncate SNOMED staging tables and reset the import queue
// for one release back to `pending`. Does NOT touch uploaded Storage objects.
// Requires platform_admin.
//
// After this runs, the phase-based loader will re-import from scratch in the
// correct order: concepts → descriptions → relationships.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import postgres from "npm:postgres@3.4.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let body: { release_identifier?: string; resume_cron?: boolean };
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const releaseIdentifier = body.release_identifier;
  if (!releaseIdentifier) return json({ error: "release_identifier required" }, 400);
  const resumeCron = body.resume_cron !== false;

  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { max: 1, prepare: false, idle_timeout: 5 });
  try {
    const [rel] = await sql<Array<{ id: string }>>`
      select id::text from terminology.releases where release_identifier = ${releaseIdentifier} limit 1
    `;
    if (!rel) return json({ error: "release_not_found" }, 404);

    // Truncate staging (safe: not exposed to app; promote-release copies out).
    // CASCADE because snomed_descriptions and snomed_relationships have FKs
    // back to snomed_concepts. All three are staging tables truncated together.
    await sql`truncate terminology.snomed_concepts, terminology.snomed_descriptions, terminology.snomed_relationships cascade`;

    // Reset all jobs for the release.
    const reset = await sql<Array<{ n: number }>>`
      with u as (
        update terminology.import_jobs
        set status = 'pending',
            claimed_at = null,
            completed_at = null,
            loaded_rows = 0,
            last_error = null,
            last_error_stack = null,
            attempts = 0
        where release_id = ${rel.id}
        returning 1
      )
      select count(*)::int as n from u
    `;

    // Zero the release row_counts and unpause.
    await sql`
      update terminology.releases
      set row_counts = '{}'::jsonb,
          status = 'pending',
          import_paused_at = null,
          loaded_at = null
      where id = ${rel.id}
    `;

    let cronActivated = false;
    if (resumeCron) {
      const [jobRow] = await sql<Array<{ jobid: number }>>`
        select jobid from cron.job where jobname = 'terminology-load-chunk-30s' limit 1
      `;
      if (jobRow) {
        await sql`select cron.alter_job(${jobRow.jobid}::bigint, active := true)`;
        cronActivated = true;
      }
    }

    return json({
      ok: true,
      release_identifier: releaseIdentifier,
      jobs_reset: reset[0]?.n ?? 0,
      staging_truncated: true,
      cron_activated: cronActivated,
      note: "Loader will now run in phase order: concepts → descriptions → relationships.",
    });
  } catch (e) {
    console.error("reset-import error", e);
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
