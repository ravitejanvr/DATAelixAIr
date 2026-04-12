/**
 * Clinical Learning System — Public API
 * V4 CLEANUP: calibration_client removed (DDX mods overwritten by V3).
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
