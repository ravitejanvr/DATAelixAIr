/**
 * KG Activation Layer
 *
 * Intermediate abstraction between pattern-detection rules and candidate generation.
 * Rules activate cluster NODES (not diagnoses directly). The KG expander then
 * resolves nodes → diagnoses via the cluster mapping.
 *
 * This decouples "what patterns are detected" from "what diagnoses those patterns imply",
 * enabling the KG to be the single source of truth for diagnosis expansion.
 */

// ── Types ──

export interface KGActivation {
  /** Activated cluster node IDs */
  nodes: Set<string>;
  /** Confidence weight per node (0–1) */
  weights: Record<string, number>;
  /** Rule IDs that triggered each activation */
  triggers: string[];
  /** Must-not-miss node activations (bypass ranking threshold) */
  must_not_miss_nodes: Set<string>;
  /** Source tracing: which system produced each activation */
  source_map: Record<string, "failure_derived" | "context_expander" | "must_not_miss" | "phenotype" | "rare_pattern">;
}

/**
 * Create an empty KG activation object.
 */
export function createEmptyActivation(): KGActivation {
  return {
    nodes: new Set(),
    weights: {},
    triggers: [],
    must_not_miss_nodes: new Set(),
    source_map: {},
  };
}

/**
 * Activate a cluster node with a given weight.
 * If the node is already active, takes the HIGHER weight.
 */
export function activateNode(
  activation: KGActivation,
  nodeId: string,
  weight: number,
  triggerId: string,
  source: KGActivation["source_map"][string],
  mustNotMiss = false,
): void {
  activation.nodes.add(nodeId);
  activation.weights[nodeId] = Math.max(activation.weights[nodeId] ?? 0, weight);
  activation.triggers.push(triggerId);
  activation.source_map[nodeId] = source;
  if (mustNotMiss) {
    activation.must_not_miss_nodes.add(nodeId);
  }
}

/**
 * Merge two activations (e.g., from failure rules + context expander).
 * Takes higher weight for overlapping nodes.
 */
export function mergeActivations(a: KGActivation, b: KGActivation): KGActivation {
  const merged = createEmptyActivation();

  for (const node of a.nodes) {
    activateNode(merged, node, a.weights[node] ?? 0, "", a.source_map[node] ?? "failure_derived");
  }
  for (const node of b.nodes) {
    activateNode(merged, node, b.weights[node] ?? 0, "", b.source_map[node] ?? "context_expander");
  }

  merged.triggers = [...a.triggers, ...b.triggers];
  for (const n of a.must_not_miss_nodes) merged.must_not_miss_nodes.add(n);
  for (const n of b.must_not_miss_nodes) merged.must_not_miss_nodes.add(n);

  return merged;
}
