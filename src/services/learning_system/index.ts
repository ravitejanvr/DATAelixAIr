/**
 * Clinical Learning System — Public API
 */
export {
  captureDiagnosisCorrection,
  captureTreatmentModification,
  captureSafetyOverride,
  recordOutcomeFeedback,
  updateOutcomeStatus,
  runBiasAudit,
  getRecentBiasMetrics,
  getDoctorAcceptanceRate,
  getOutcomeStatistics,
  computeBiasSummary,
} from "./client";

export type {
  OutcomeStatus,
  OutcomeFeedback,
  DiagnosisCorrectionSignal,
  TreatmentModificationSignal,
  SafetyOverrideSignal,
  BiasMetricType,
  BiasMetric,
  BiasAuditResult,
} from "./client";
