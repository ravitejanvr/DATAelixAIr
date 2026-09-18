/**
 * SSAL Name Resolution — shared by every pipeline that produces a
 * fused/Bayesian ranked list.
 *
 * `BayesianDiagnosis` (src/services/bayesian_engine/client.ts) only carries
 * `diagnosis_id`, never a human-readable name. Every consumer that renders
 * or scores that ranking needs `diagnosis_name` resolved first, against DDX
 * results (primary source), DDX reasoning traces, and hypothesis names.
 *
 * This used to live inline in orchestrator.ts (O1) only. benchmark_mode.ts
 * (O2) returned the raw, unresolved BayesianResult, so every consumer that
 * read `.diagnosis_name` there silently fell back to the raw UUID
 * `diagnosis_id`. Extracting it here means O1 and O2 call the exact same
 * function and cannot drift apart again — see ssal_name_resolution.test.ts.
 */

import type { BayesianResult } from "@/services/bayesian_engine";
import type { DDXResult } from "@/services/ddx_engine/client";

/** Loose shape covering both HypothesisResult variants in this codebase. */
export interface SsalHypothesisSource {
  hypotheses?: Array<{ diagnosis_id?: string; diagnosis?: string }>;
}

/** Build a diagnosis_id → diagnosis_name map from every available source. */
export function buildSsalNameMap(
  ddxResult?: DDXResult | null,
  hypotheses?: SsalHypothesisSource | null,
): Map<string, string> {
  const ssalNameMap = new Map<string, string>();

  if (ddxResult?.differential_diagnoses) {
    for (const d of ddxResult.differential_diagnoses) {
      if (d.diagnosis_id && d.diagnosis_name) {
        ssalNameMap.set(d.diagnosis_id, d.diagnosis_name);
      }
    }
  }

  if ((ddxResult as any)?.reasoning_traces) {
    for (const t of (ddxResult as any).reasoning_traces) {
      if (t.diagnosis_id && t.diagnosis && !ssalNameMap.has(t.diagnosis_id)) {
        ssalNameMap.set(t.diagnosis_id, t.diagnosis);
      }
    }
  }

  if (hypotheses?.hypotheses) {
    for (const h of hypotheses.hypotheses) {
      if (h.diagnosis_id && h.diagnosis && !ssalNameMap.has(h.diagnosis_id)) {
        ssalNameMap.set(h.diagnosis_id, h.diagnosis);
      }
    }
  }

  return ssalNameMap;
}

export interface EnrichBayesianOptions {
  ddxResult?: DDXResult | null;
  hypotheses?: SsalHypothesisSource | null;
  /** When true, preserve the existing diagnoses order instead of re-sorting by posterior. */
  cprApplied?: boolean;
  /** Default true — set false in tests to skip Object.freeze. */
  freeze?: boolean;
}

/**
 * Resolve `diagnosis_name`/`canonical_name`/`rank` onto every diagnosis in a
 * BayesianResult, so ALL downstream consumers get self-describing objects.
 * Returns a NEW object; does not mutate the input.
 */
export function enrichBayesianWithNames(
  bayesian: BayesianResult | null,
  options: EnrichBayesianOptions = {},
): BayesianResult | null {
  if (!bayesian || bayesian.diagnoses.length === 0) return bayesian;

  const ssalNameMap = buildSsalNameMap(options.ddxResult, options.hypotheses);

  const orderedDiagnoses = options.cprApplied
    ? [...bayesian.diagnoses]
    : [...bayesian.diagnoses].sort((a, b) => b.posterior_probability - a.posterior_probability);

  const enrichedDiagnoses = orderedDiagnoses.map((d, idx) => {
    const resolvedName =
      ssalNameMap.get(d.diagnosis_id) ||
      (d as any).diagnosis_name ||
      d.supporting_evidence?.find((e: string) => !/^[0-9a-f]{8}-/.test(e)) ||
      d.diagnosis_id;
    const canonical = resolvedName.toLowerCase().replace(/[^a-z0-9\s\-]/g, "").trim();
    return {
      ...d,
      diagnosis_name: resolvedName,
      canonical_name: canonical,
      rank: idx + 1,
      source: ((bayesian.source || "").includes("fused") ? "fused" : "bayesian") as "bayesian" | "fused" | "override",
    };
  });

  for (const d of enrichedDiagnoses) {
    if (!d.diagnosis_name) console.error("[SSAL_ERROR] Missing diagnosis_name for", d.diagnosis_id);
    if (!d.canonical_name) console.error("[SSAL_ERROR] Missing canonical_name for", d.diagnosis_id);
  }

  const result: BayesianResult = { ...bayesian, diagnoses: enrichedDiagnoses as any };

  if (options.freeze !== false) {
    try {
      Object.freeze(result);
      Object.freeze(result.diagnoses);
    } catch (e) {
      console.warn("[SSAL] Object.freeze failed:", e);
    }
  }

  return result;
}
