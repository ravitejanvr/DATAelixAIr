/**
 * Terminology Bridge — A7.1 (dormant)
 *
 * Purpose: single, additive helper that resolves a free-text diagnosis name
 * to a canonical terminology identifier via the terminology-service edge
 * function (which proxies `terminology_canonicalize`).
 *
 * Runtime status: DORMANT. Gated by feature flag
 * `enable_kg_terminology_binding`. No reasoning path calls this yet — it is
 * used by the offline binding backfill script and by the A7.3 shadow
 * verifier only.
 *
 * Behaviour guarantee: this module NEVER mutates pipeline output. It reads
 * `public.kg_concept_bindings` for cached bindings and, on cache miss,
 * asks the terminology service. The clinical pipeline continues to key off
 * `diagnosis_name` strings during A7.1–A7.2.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ConceptBinding {
  diagnosis_name: string;
  canonical_id: string | null;
  snomed_id: string | null;
  score: number | null;
  source: string;
}

const MIN_SCORE = 0.5;

/** In-memory cache to avoid re-hitting the edge function within a session. */
const memo = new Map<string, ConceptBinding | null>();

function key(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Resolve a diagnosis name to a canonical concept.
 * Order: memo → `kg_concept_bindings` table → terminology-service edge fn.
 * Returns null on any failure — callers MUST fall back to the string key.
 */
export async function resolveConceptId(
  diagnosisName: string,
): Promise<ConceptBinding | null> {
  const k = key(diagnosisName);
  if (!k) return null;
  if (memo.has(k)) return memo.get(k) ?? null;

  // 1. Cache table lookup
  try {
    const { data } = await supabase
      .from("kg_concept_bindings")
      .select("diagnosis_name, canonical_id, snomed_id, score, source")
      .eq("diagnosis_name", k)
      .maybeSingle();
    if (data) {
      memo.set(k, data as ConceptBinding);
      return data as ConceptBinding;
    }
  } catch {
    // fall through to live lookup
  }

  // 2. Live terminology-service call (canonicalize)
  try {
    const { data, error } = await supabase.functions.invoke("terminology-service", {
      body: { op: "canonicalize", q: diagnosisName, system: "snomed-ct", min_score: MIN_SCORE },
    });
    if (error || !data?.matched) {
      memo.set(k, null);
      return null;
    }
    const binding: ConceptBinding = {
      diagnosis_name: k,
      canonical_id: data.code ?? null,
      snomed_id: data.code ?? null,
      score: typeof data.score === "number" ? data.score : null,
      source: "terminology_canonicalize",
    };
    memo.set(k, binding);
    return binding;
  } catch {
    memo.set(k, null);
    return null;
  }
}

/**
 * Bulk-resolve for the offline backfill script. Serial to avoid rate limits.
 */
export async function resolveMany(names: string[]): Promise<Map<string, ConceptBinding | null>> {
  const out = new Map<string, ConceptBinding | null>();
  for (const n of names) {
    out.set(n, await resolveConceptId(n));
  }
  return out;
}

/** Test-only: clear the in-memory cache. */
export function __clearBridgeCache(): void {
  memo.clear();
}
