/**
 * Bayesian Engine — Public API
 * V4 CLEANUP: V2 shadow engine removed. Only V1 (fallback) and V3 remain.
 */
export {
  calculateDiagnosticProbabilities,
  type BayesianResult,
  type BayesianDiagnosis,
  type BayesianInput,
} from "./client";

export {
  calculateDiagnosticProbabilitiesV3,
  type V3Result,
  type V3StateActivation,
} from "./client_v3";
