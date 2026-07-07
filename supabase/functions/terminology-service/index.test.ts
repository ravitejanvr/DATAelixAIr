// Integration tests for the terminology service HTTP surface.
// Runs against the `snomed-test` micro-release created by
// `terminology-e2e-test`, so run that function first (from the admin UI)
// before invoking these tests.
//
// Run:  deno test -A supabase/functions/terminology-service/index.test.ts

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("VITE_SUPABASE_ANON_KEY")!;
const FN = `${SUPABASE_URL}/functions/v1/terminology-service`;
const SYS = "snomed-test";

async function call(body: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const r = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify(body),
  });
  return await r.json();
}

Deno.test("search: exact FSN returns pneumonia", async () => {
  const r = await call({ op: "search", q: "pneumonia", system: SYS, limit: 5 });
  assert(r.ok);
  const hits = r.data as Array<{ code: string }>;
  assert(hits.some(h => h.code === "233604007"), "pneumonia code missing");
});

Deno.test("autocomplete: prefix returns candidates", async () => {
  const r = await call({ op: "search", q: "pneu", system: SYS, limit: 5 });
  assert(r.ok);
  assert((r.data as unknown[]).length > 0);
});

Deno.test("fuzzy: typo still finds pneumonia", async () => {
  const r = await call({ op: "search", q: "pnuemonia", system: SYS, limit: 5 });
  assert(r.ok);
  const hits = r.data as Array<{ code: string }>;
  assert(hits.some(h => h.code === "233604007"));
});

Deno.test("synonym: cephalgia -> headache", async () => {
  const r = await call({ op: "search", q: "cephalgia", system: SYS, limit: 3 });
  assert(r.ok);
  const hits = r.data as Array<{ code: string }>;
  assert(hits.some(h => h.code === "25064002"));
});

Deno.test("canonicalize: 'lung infection' -> pneumonia code", async () => {
  const r = await call({ op: "canonicalize", q: "lung infection", system: SYS, min_score: 0.2 });
  assert(r.ok);
  const d = r.data as { matched: boolean; code?: string };
  assertEquals(d.matched, true);
  assertEquals(d.code, "233604007");
});

Deno.test("lookup: returns designations", async () => {
  const r = await call({ op: "lookup", code: "233604007", system: SYS });
  assert(r.ok);
  const d = r.data as { code: string; designations: unknown[] };
  assertEquals(d.code, "233604007");
  assert(d.designations.length >= 2);
});

Deno.test("ancestors: CAP reaches Clinical finding root", async () => {
  const r = await call({ op: "ancestors", code: "385093006", system: SYS });
  assert(r.ok);
  const codes = (r.data as Array<{ code: string }>).map(x => x.code);
  assert(codes.includes("233604007"));
  assert(codes.includes("404684003"));
});

Deno.test("descendants: Disease includes Pneumonia", async () => {
  const r = await call({ op: "descendants", code: "64572001", system: SYS, max_depth: 5 });
  assert(r.ok);
  const codes = (r.data as Array<{ code: string }>).map(x => x.code);
  assert(codes.includes("233604007"));
});

Deno.test("validate: known active vs unknown", async () => {
  const good = await call({ op: "validate", code: "233604007", system: SYS });
  const bad  = await call({ op: "validate", code: "999999999", system: SYS });
  assertEquals((good.data as { valid: boolean }).valid, true);
  assertEquals((bad.data as { valid: boolean }).valid, false);
});
