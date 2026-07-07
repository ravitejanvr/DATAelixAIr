// Unified HTTP surface for the terminology subsystem.
// AI/UI components MUST use this instead of touching terminology.* tables.
// Operations:
//   { op: "search",        q, system?, limit? }
//   { op: "lookup",        code, system? }
//   { op: "ancestors",     code, system?, max_depth? }
//   { op: "descendants",   code, system?, max_depth?, limit? }
//   { op: "canonicalize",  q, system?, min_score? }
//   { op: "translate",     source_code, source_system, target_system }
//   { op: "validate",      code, system? }
//
// Uses the anon key (RPCs run SECURITY DEFINER); safe for anonymous callers.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  op: string;
  q?: string; code?: string; system?: string;
  max_depth?: number; limit?: number; min_score?: number;
  source_code?: string; source_system?: string; target_system?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return j({ error: "POST only" }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return j({ error: "invalid json" }, 400); }
  if (!body.op) return j({ error: "op required" }, 400);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const system = body.system ?? "snomed-ct";
  try {
    let data: unknown, error: unknown;
    switch (body.op) {
      case "search":
        ({ data, error } = await sb.rpc("terminology_search",
          { q: body.q ?? "", system_short_name: system, limit_n: body.limit ?? 20 }));
        break;
      case "lookup":
        ({ data, error } = await sb.rpc("terminology_lookup",
          { p_code: body.code ?? "", p_system: system }));
        break;
      case "ancestors":
        ({ data, error } = await sb.rpc("terminology_ancestors",
          { p_code: body.code ?? "", p_system: system, p_max_depth: body.max_depth ?? 20 }));
        break;
      case "descendants":
        ({ data, error } = await sb.rpc("terminology_descendants",
          { p_code: body.code ?? "", p_system: system,
            p_max_depth: body.max_depth ?? 5, p_limit: body.limit ?? 500 }));
        break;
      case "canonicalize":
        ({ data, error } = await sb.rpc("terminology_canonicalize",
          { p_q: body.q ?? "", p_system: system, p_min_score: body.min_score ?? 0.35 }));
        break;
      case "translate":
        if (!body.source_code || !body.source_system || !body.target_system) {
          return j({ error: "source_code, source_system, target_system required" }, 400);
        }
        ({ data, error } = await sb.rpc("terminology_translate",
          { p_source_code: body.source_code, p_source_system: body.source_system, p_target_system: body.target_system }));
        break;
      case "validate":
        ({ data, error } = await sb.rpc("terminology_validate",
          { p_code: body.code ?? "", p_system: system }));
        break;
      default:
        return j({ error: `unknown op: ${body.op}` }, 400);
    }
    if (error) return j({ ok: false, error: (error as { message?: string }).message ?? String(error) }, 500);
    return j({ ok: true, op: body.op, data });
  } catch (e) {
    return j({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
