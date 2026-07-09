// A7.2 — KG Concept Bindings Backfill
//
// Reads every diagnosis_name from the client-side KG cluster registry
// (passed in the request body — no imports of src/ inside Deno),
// canonicalizes each via terminology.terminology_canonicalize (SNOMED CT),
// and upserts the resolved concepts into public.kg_concept_bindings.
//
// Idempotent: re-runs update in place. Reasoning pipeline is untouched.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface BackfillBody {
  names: string[];
  min_score?: number;
  system?: string;
}

interface Row {
  diagnosis_name: string;
  canonical_id: string | null;
  snomed_id: string | null;
  score: number | null;
  source: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "POST only" }, 405);
  }

  let body: BackfillBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!Array.isArray(body.names) || body.names.length === 0) {
    return json({ error: "names[] required" }, 400);
  }

  const system = body.system ?? "snomed-ct";
  const minScore = typeof body.min_score === "number" ? body.min_score : 0.5;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rows: Row[] = [];
  const unresolved: string[] = [];

  for (const raw of body.names) {
    const name = String(raw ?? "").trim();
    if (!name) continue;
    const { data, error } = await sb.rpc("terminology_canonicalize", {
      p_q: name,
      p_system: system,
      p_min_score: minScore,
    });
    if (error) {
      unresolved.push(name);
      continue;
    }
    // terminology_canonicalize returns { matched, code?, display?, score?, ... }
    const res = (data ?? {}) as { matched?: boolean; code?: string; score?: number };
    if (!res.matched || !res.code) {
      unresolved.push(name);
      continue;
    }
    rows.push({
      diagnosis_name: name.toLowerCase(),
      canonical_id: res.code,
      snomed_id: res.code,
      score: typeof res.score === "number" ? res.score : null,
      source: "terminology_canonicalize",
    });
  }

  let upserted = 0;
  if (rows.length > 0) {
    const { error } = await sb
      .from("kg_concept_bindings")
      .upsert(rows, { onConflict: "diagnosis_name" });
    if (error) {
      return json({ error: `upsert failed: ${error.message}`, unresolved }, 500);
    }
    upserted = rows.length;
  }

  return json({
    ok: true,
    submitted: body.names.length,
    upserted,
    unresolved,
    min_score: minScore,
    system,
  });
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
