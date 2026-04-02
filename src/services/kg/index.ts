/**
 * KG Module — Public API
 *
 * Central exports for the Knowledge Graph activation + expansion system.
 */

export { createEmptyActivation, activateNode, mergeActivations, type KGActivation } from "./kg_activation";
export { getClusterDiagnoses, getAllClusterIds, getClusterStats, type ClusterDiagnosis } from "./kg_clusters";
export { expandKG, type KGExpansionResult } from "./kg_expander";
