/**
 * KG Expander — Resolves cluster activations → candidate diagnoses
 *
 * This is the ONLY module that converts cluster node activations into
 * concrete diagnosis candidates. All other modules (rules, expander,
 * fallback) activate clusters; this module resolves them.
 *
 * Invariants:
 *   - Pure function (no side effects)
 *   - Deduplicates by diagnosis name (takes highest score)
 *   - Respects max candidate cap
 *   - Must-not-miss nodes bypass relevance threshold
 */

import type { KGActivation } from "./kg_activation";
import { getClusterDiagnoses, type ClusterDiagnosis } from "./kg_clusters";
import type { CandidateHint } from "@/services/context_candidate_expander";

const MAX_KG_CANDIDATES = 18;
const RELEVANCE_THRESHOLD = 0.15; // Lowered from 0.25 to prevent filtering valid candidates

export interface KGExpansionResult {
  /** Resolved candidate hints for injection into DDX/fallback */
  candidates: CandidateHint[];
  /** Which clusters contributed candidates */
  clusters_resolved: string[];
  /** Total candidates before dedup/cap */
  raw_count: number;
  /** Debug: cluster → diagnosis count mapping */
  expansion_detail: Record<string, number>;
}

/**
 * Expand activated KG cluster nodes into concrete diagnosis candidates.
 *
 * For each activated node:
 *   effective_score = cluster_weight * diagnosis_base_relevance
 *   → if effective_score >= threshold → include as candidate
 *   → must-not-miss nodes bypass threshold
 */
export function expandKG(activation: KGActivation): KGExpansionResult {
  const candidateMap = new Map<string, CandidateHint & { must_not_miss: boolean }>();
  const clustersResolved: string[] = [];
  const expansionDetail: Record<string, number> = {};
  let rawCount = 0;

  for (const nodeId of activation.nodes) {
    const clusterDiagnoses = getClusterDiagnoses(nodeId);
    if (clusterDiagnoses.length === 0) {
      console.warn(`[KGExpander] Unknown cluster node: ${nodeId}`);
      continue;
    }

    const clusterWeight = activation.weights[nodeId] ?? 0.5;
    const isMNM = activation.must_not_miss_nodes.has(nodeId);
    const source = activation.source_map[nodeId] ?? "context_expander";
    let addedFromCluster = 0;

    for (const dx of clusterDiagnoses) {
      const effectiveScore = clusterWeight * dx.base_relevance;
      // Phase 6.6 fix: cluster activation determines inclusion, scoring determines ranking only
      // Do NOT filter by threshold — all diagnoses from active clusters are included

      rawCount++;
      const key = dx.diagnosis_name.toLowerCase().trim();
      const existing = candidateMap.get(key);

      if (!existing || effectiveScore > existing.confidence) {
        candidateMap.set(key, {
          diagnosis_name: dx.diagnosis_name,
          source: source === "must_not_miss" ? "context_signal" : (source === "rare_pattern" ? "rare_pattern" : (source === "phenotype" ? "phenotype_inference" : "context_signal")),
          confidence: Math.round(effectiveScore * 100) / 100,
          reasoning: `KG cluster '${nodeId}' (weight=${clusterWeight.toFixed(2)}, relevance=${dx.base_relevance})`,
          must_not_miss: dx.must_not_miss,
        });
        addedFromCluster++;
      }
    }

    if (addedFromCluster > 0) {
      clustersResolved.push(nodeId);
      expansionDetail[nodeId] = addedFromCluster;
    }
  }

  // Sort by confidence desc, then cap
  const sorted = [...candidateMap.values()]
    .sort((a, b) => {
      // Must-not-miss always first
      if (a.must_not_miss && !b.must_not_miss) return -1;
      if (!a.must_not_miss && b.must_not_miss) return 1;
      return b.confidence - a.confidence;
    })
    .slice(0, MAX_KG_CANDIDATES);

  // Strip must_not_miss from CandidateHint (not part of that interface)
  const candidates: CandidateHint[] = sorted.map(({ must_not_miss: _, ...hint }) => hint);

  if (clustersResolved.length > 0) {
    console.log(
      `[KGExpander] Resolved ${clustersResolved.length} clusters → ${candidates.length} candidates ` +
      `(${rawCount} raw, ${MAX_KG_CANDIDATES} cap). Clusters: [${clustersResolved.join(", ")}]`
    );
  }

  return {
    candidates,
    clusters_resolved: clustersResolved,
    raw_count: rawCount,
    expansion_detail: expansionDetail,
  };
}
