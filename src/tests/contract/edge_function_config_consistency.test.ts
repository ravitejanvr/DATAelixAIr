/**
 * Contract Test — supabase/config.toml only declares edge functions that exist
 *
 * WHY THIS EXISTS
 * ----------------
 * ROADMAP item 26 deleted dead edge functions (save-prescription, order-lab-tests,
 * patient-explanation) but left their `[functions.<name>]` stanzas in config.toml,
 * and `finalize-visit` had already been orphaned the same way earlier. A stanza with
 * no function directory is config describing something that isn't there: it can break
 * a `supabase functions deploy`, and it makes config.toml a misleading inventory of
 * what is deployable. Deleting code from git also does NOT undeploy it from the live
 * project — that has to be done separately — so the config must at least not keep
 * pretending those functions are part of the codebase.
 *
 * Every `[functions.X]` in config.toml
 * must have supabase/functions/X/index.ts.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

describe("Contract: config.toml edge function entries match supabase/functions/", () => {
  it("every [functions.X] stanza has a supabase/functions/X/index.ts", () => {
    const toml = readFileSync(join(ROOT, "supabase/config.toml"), "utf8");
    const declared = [...toml.matchAll(/^\s*\[functions\.([^\]]+)\]/gm)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(0);

    const missing = declared.filter((name) => !existsSync(join(ROOT, "supabase/functions", name, "index.ts")));
    expect(missing, `config.toml declares edge functions with no source: ${missing.join(", ")}`).toEqual([]);
  });
});
