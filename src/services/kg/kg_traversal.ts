/**
 * KG Traversal Engine — Multi-hop cluster expansion
 *
 * Traverses from activated clusters to related clusters via semantic
 * adjacency, enabling discovery of non-obvious diagnoses.
 *
 * Invariants:
 *   - Weight decays per hop (configurable decay factor)
 *   - Max node cap prevents explosion
 *   - Original activations preserved (only additions)
 *   - Pure function (no side effects)
 */

import { createEmptyActivation, activateNode, mergeActivations, type KGActivation } from "./kg_activation";

const DEFAULT_DECAY = 0.5;   // Weight halves per hop
const MAX_TRAVERSAL_NODES = 8;  // Cap on new nodes from traversal

// ── Cluster adjacency graph (semantic relationships) ──

const CLUSTER_ADJACENCY: Record<string, Array<{ target: string; strength: number }>> = {
  // Cardiac → related
  atypical_cardiac: [
    { target: "vascular", strength: 0.7 },
    { target: "respiratory", strength: 0.5 },
    { target: "hemodynamic_instability", strength: 0.6 },
  ],
  // Respiratory → related
  respiratory: [
    { target: "atypical_cardiac", strength: 0.5 },
    { target: "sepsis", strength: 0.4 },
    { target: "allergic", strength: 0.3 },
  ],
  // Neurological → related
  atypical_neuro: [
    { target: "vascular", strength: 0.4 },
    { target: "sepsis", strength: 0.3 },
    { target: "toxicological", strength: 0.4 },
    { target: "endocrine", strength: 0.3 },
  ],
  // Sepsis → related
  sepsis: [
    { target: "respiratory", strength: 0.5 },
    { target: "abdominal", strength: 0.4 },
    { target: "rare_infectious", strength: 0.5 },
    { target: "endocrine", strength: 0.3 },
  ],
  // Hemodynamic → related
  hemodynamic_instability: [
    { target: "atypical_cardiac", strength: 0.6 },
    { target: "vascular", strength: 0.7 },
    { target: "obstetric", strength: 0.4 },
    { target: "abdominal", strength: 0.4 },
  ],
  // Abdominal → related
  abdominal: [
    { target: "sepsis", strength: 0.4 },
    { target: "surgical", strength: 0.5 },
    { target: "context_dependent", strength: 0.3 },
  ],
  // Vascular → related
  vascular: [
    { target: "atypical_cardiac", strength: 0.6 },
    { target: "hemodynamic_instability", strength: 0.5 },
    { target: "atypical_neuro", strength: 0.4 },
  ],
  // Endocrine → related
  endocrine: [
    { target: "atypical_neuro", strength: 0.3 },
    { target: "sepsis", strength: 0.3 },
    { target: "diabetic", strength: 0.6 },
  ],
  // Toxicological → related
  toxicological: [
    { target: "atypical_neuro", strength: 0.5 },
    { target: "atypical_cardiac", strength: 0.4 },
    { target: "endocrine", strength: 0.3 },
  ],
  // Obstetric → related
  obstetric: [
    { target: "hemodynamic_instability", strength: 0.5 },
    { target: "vascular", strength: 0.4 },
  ],
  // Spinal → related
  spinal: [
    { target: "atypical_neuro", strength: 0.5 },
    { target: "context_dependent", strength: 0.4 },
  ],
  // Allergic → related
  allergic: [
    { target: "respiratory", strength: 0.5 },
  ],
};

/**
 * Perform multi-hop traversal from existing activations.
 *
 * At each depth level:
 *   1. For each currently active node, find adjacent clusters
 *   2. Activate adjacent clusters with decayed weight
 *   3. Skip nodes already in original activation
 *   4. Cap total new nodes
 *
 * Returns merged activation (original + traversal discoveries).
 */
export function expandKGDeep(
  activation: KGActivation,
  depth: number = 2,
  decay: number = DEFAULT_DECAY,
): KGActivation {
  if (depth <= 0 || activation.nodes.size === 0) return activation;

  const traversalActivation = createEmptyActivation();
  const visited = new Set(activation.nodes);  // Don't re-traverse original nodes
  let frontier = [...activation.nodes];
  let newNodesAdded = 0;

  for (let d = 1; d <= depth; d++) {
    const nextFrontier: string[] = [];

    for (const nodeId of frontier) {
      const neighbors = CLUSTER_ADJACENCY[nodeId] || [];
      const sourceWeight = activation.weights[nodeId] ?? traversalActivation.weights[nodeId] ?? 0.5;

      for (const neighbor of neighbors) {
        if (visited.has(neighbor.target)) continue;
        if (newNodesAdded >= MAX_TRAVERSAL_NODES) break;

        const traversalWeight = sourceWeight * neighbor.strength * Math.pow(decay, d);

        // Only activate if traversal weight is meaningful (> 0.05)
        if (traversalWeight < 0.05) continue;

        activateNode(
          traversalActivation,
          neighbor.target,
          traversalWeight,
          `traversal_d${d}_from_${nodeId}`,
          "context_expander",
          false, // Traversal nodes are never MNM
        );

        visited.add(neighbor.target);
        nextFrontier.push(neighbor.target);
        newNodesAdded++;
      }

      if (newNodesAdded >= MAX_TRAVERSAL_NODES) break;
    }

    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  if (traversalActivation.nodes.size > 0) {
    console.log(
      `[KGTraversal] Expanded ${activation.nodes.size} nodes → +${traversalActivation.nodes.size} via ${depth}-hop traversal. ` +
      `New: [${[...traversalActivation.nodes].join(", ")}]`
    );
  }

  return mergeActivations(activation, traversalActivation);
}
