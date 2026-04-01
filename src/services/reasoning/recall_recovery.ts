/**
 * Recall Recovery Engine
 *
 * Triggered when the pipeline produces zero or very low-confidence candidates.
 * Recovers by:
 *   1. Expanding KG deeper (3-hop traversal)
 *   2. Relaxing contradiction penalties
 *   3. Injecting MNM exploration clusters
 *   4. Re-running Intelligence Core with relaxed thresholds
 *
 * Pure function — returns new candidates, does not mutate input.
 */

import { createEmptyActivation, activateNode, mergeActivations, type KGActivation } from "@/services/kg/kg_activation";
import { expandKGDeep } from "@/services/kg/kg_traversal";
import { expandKG, type KGExpansionResult } from "@/services/kg/kg_expander";
import type { CandidateHint } from "@/services/context_candidate_expander";

export interface RecoveryInput {
  activation: KGActivation;
  symptoms: string[];
  current_candidate_count: number;
  top_score: number;
}

export interface RecoveryResult {
  mode: "RECOVERY";
  confidence: "LOW";
  additional_candidates: CandidateHint[];
  clusters_explored: string[];
  depth_used: number;
  trigger_reason: string;
}

const RECOVERY_SCORE_THRESHOLD = 20;  // Top score below this triggers recovery
const RECOVERY_CANDIDATE_THRESHOLD = 2;  // Fewer candidates than this triggers recovery

// MNM clusters to explore during recovery
const MNM_EXPLORATION_CLUSTERS = [
  "atypical_cardiac",
  "hemodynamic_instability",
  "sepsis",
  "vascular",
  "atypical_neuro",
];

/**
 * Determine if recovery mode should be triggered.
 */
export function shouldTriggerRecovery(candidateCount: number, topScore: number): boolean {
  return candidateCount < RECOVERY_CANDIDATE_THRESHOLD || topScore < RECOVERY_SCORE_THRESHOLD;
}

/**
 * Run recall recovery to discover additional candidates.
 */
export function runRecallRecovery(input: RecoveryInput): RecoveryResult {
  const triggerReason = input.current_candidate_count < RECOVERY_CANDIDATE_THRESHOLD
    ? `Only ${input.current_candidate_count} candidates (threshold: ${RECOVERY_CANDIDATE_THRESHOLD})`
    : `Top score ${input.top_score} below threshold ${RECOVERY_SCORE_THRESHOLD}`;

  console.log(`[RecallRecovery] Triggered: ${triggerReason}`);

  // Step 1: Deep traversal (3 hops, relaxed decay)
  const deepActivation = expandKGDeep(input.activation, 3, 0.4);

  // Step 2: MNM exploration — activate high-risk clusters with low thresholds
  const mnmActivation = createEmptyActivation();
  for (const clusterId of MNM_EXPLORATION_CLUSTERS) {
    if (!deepActivation.nodes.has(clusterId)) {
      // Only add if not already activated — use low weight
      activateNode(mnmActivation, clusterId, 0.2, "recovery_mnm_exploration", "must_not_miss", true);
    }
  }

  // Step 3: Merge all activations
  const recoveryActivation = mergeActivations(deepActivation, mnmActivation);

  // Step 4: Expand via KG with the recovery activation
  const expansion = expandKG(recoveryActivation);

  console.log(
    `[RecallRecovery] Recovered ${expansion.candidates.length} candidates from ` +
    `${expansion.clusters_resolved.length} clusters (depth=3)`
  );

  return {
    mode: "RECOVERY",
    confidence: "LOW",
    additional_candidates: expansion.candidates,
    clusters_explored: expansion.clusters_resolved,
    depth_used: 3,
    trigger_reason: triggerReason,
  };
}
