/**
 * A7.3 — KG Terminology Shadow Verifier (read-only parity gate)
 *
 * Runs the KG expansion twice for a given activation:
 *   A) PRODUCTION — the live `expandKG()` path, keyed by diagnosis_name string
 *   B) SHADOW      — the same algorithm keyed by canonical_id (falling back to
 *                    the string key when a binding is missing)
 *
 * It then reports whether the two produce an identical candidate list
 * (same names, same order, same confidences). This is the gate that must be
 * green before `enable_kg_terminology_binding` may ever be flipped on.
 *
 * INVARIANTS:
 *   - Pure / read-only. Never mutates CLUSTER_REGISTRY or pipeline output.
 *   - Never called by the clinical pipeline. Admin/diagnostic use only.
 *   - Divergence => flag stays off. No behavioural change is permitted.
 */

import type { KGActivation } from "./kg_activation";
import { expandKG } from "./kg_expander";
import { hydrateClusterBindings, type HydratedCluster } from "./kg_hydrator";
import { getClusterDiagnoses, type ClusterDiagnosis } from "./kg_clusters";
import type { CandidateHint } from "@/services/context_candidate_expander";

const MAX_KG_CANDIDATES = 12;
const RELEVANCE_THRESHOLD = 0.25;

export interface ParityDivergence {
  index: number;
  production: string | null;
  shadow: string | null;
  reason: "name_mismatch" | "confidence_mismatch" | "length_mismatch";
}

export interface ShadowVerificationReport {
  parity: boolean;
  production_candidates: CandidateHint[];
  shadow_candidates: CandidateHint[];
  divergences: ParityDivergence[];
  /** Coverage of terminology bindings across the whole cluster registry */
  binding_coverage: {
    total_entries: number;
    bound_entries: number;
    coverage_pct: number;
    unbound_names: string[];
  };
  /** Collision: two distinct names collapsing onto one canonical_id */
  canonical_collisions: Array<{ canonical_id: string; names: string[] }>;
  safe_to_enable: boolean;
}

/** Build canonical_id lookup from a hydration report. */
function bindingIndex(clusters: HydratedCluster[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const c of clusters) {
    for (const d of c.diagnoses) {
      if (d.canonical_id) idx.set(d.diagnosis_name.trim().toLowerCase(), d.canonical_id);
    }
  }
  return idx;
}

/** Shadow expansion: identical algorithm to expandKG, but keyed by canonical_id. */
function expandShadow(
  activation: KGActivation,
  bindings: Map<string, string>,
): CandidateHint[] {
  const map = new Map<string, CandidateHint & { must_not_miss: boolean }>();

  for (const nodeId of activation.nodes) {
    const clusterDiagnoses: ClusterDiagnosis[] = getClusterDiagnoses(nodeId);
    if (clusterDiagnoses.length === 0) continue;

    const clusterWeight = activation.weights[nodeId] ?? 0.5;
    const isMNM = activation.must_not_miss_nodes.has(nodeId);
    const source = activation.source_map[nodeId] ?? "context_expander";

    for (const dx of clusterDiagnoses) {
      const effectiveScore = clusterWeight * dx.base_relevance;
      if (!(effectiveScore >= RELEVANCE_THRESHOLD || isMNM || dx.must_not_miss)) continue;

      const nameKey = dx.diagnosis_name.toLowerCase().trim();
      const key = bindings.get(nameKey) ?? nameKey;
      const existing = map.get(key);

      if (!existing || effectiveScore > existing.confidence) {
        map.set(key, {
          diagnosis_name: dx.diagnosis_name,
          source:
            source === "must_not_miss"
              ? "context_signal"
              : source === "rare_pattern"
                ? "rare_pattern"
                : source === "phenotype"
                  ? "phenotype_inference"
                  : "context_signal",
          confidence: Math.round(effectiveScore * 100) / 100,
          reasoning: `KG cluster '${nodeId}' (weight=${clusterWeight.toFixed(2)}, relevance=${dx.base_relevance})`,
          must_not_miss: dx.must_not_miss,
        });
      }
    }
  }

  return [...map.values()]
    .sort((a, b) => {
      if (a.must_not_miss && !b.must_not_miss) return -1;
      if (!a.must_not_miss && b.must_not_miss) return 1;
      return b.confidence - a.confidence;
    })
    .slice(0, MAX_KG_CANDIDATES)
    .map(({ must_not_miss: _drop, ...hint }) => hint);
}

/** Detect distinct diagnosis names sharing a canonical_id (dedup risk). */
function findCollisions(bindings: Map<string, string>) {
  const byId = new Map<string, string[]>();
  for (const [name, id] of bindings) {
    const arr = byId.get(id) ?? [];
    arr.push(name);
    byId.set(id, arr);
  }
  return [...byId.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([canonical_id, names]) => ({ canonical_id, names: names.sort() }));
}

/**
 * Run the shadow parity check for one activation.
 * Read-only; safe to call from admin tooling at any time.
 */
export async function verifyKgTerminologyParity(
  activation: KGActivation,
): Promise<ShadowVerificationReport> {
  const hydration = await hydrateClusterBindings();
  const bindings = bindingIndex(hydration.clusters);

  const production = expandKG(activation).candidates;
  const shadow = expandShadow(activation, bindings);

  const divergences: ParityDivergence[] = [];
  const len = Math.max(production.length, shadow.length);
  for (let i = 0; i < len; i++) {
    const p = production[i];
    const s = shadow[i];
    if (!p || !s) {
      divergences.push({
        index: i,
        production: p?.diagnosis_name ?? null,
        shadow: s?.diagnosis_name ?? null,
        reason: "length_mismatch",
      });
    } else if (p.diagnosis_name !== s.diagnosis_name) {
      divergences.push({
        index: i,
        production: p.diagnosis_name,
        shadow: s.diagnosis_name,
        reason: "name_mismatch",
      });
    } else if (p.confidence !== s.confidence) {
      divergences.push({
        index: i,
        production: p.diagnosis_name,
        shadow: s.diagnosis_name,
        reason: "confidence_mismatch",
      });
    }
  }

  const collisions = findCollisions(bindings);
  const coverage_pct =
    hydration.total_entries === 0
      ? 0
      : Math.round((hydration.bound_entries / hydration.total_entries) * 1000) / 10;

  return {
    parity: divergences.length === 0,
    production_candidates: production,
    shadow_candidates: shadow,
    divergences,
    binding_coverage: {
      total_entries: hydration.total_entries,
      bound_entries: hydration.bound_entries,
      coverage_pct,
      unbound_names: hydration.unbound_names,
    },
    canonical_collisions: collisions,
    safe_to_enable: divergences.length === 0 && collisions.length === 0 && coverage_pct === 100,
  };
}
