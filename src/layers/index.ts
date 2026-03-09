/**
 * DATAelixAIr — 10-Layer Clinical AI Architecture
 * 
 * Layer 1:  User Interface (UI)
 * Layer 2:  Clinical Workflow
 * Layer 3:  Multilingual Processing
 * Layer 4:  Clinical Intelligence (AI Agents)
 * Layer 5:  Safety Controller
 * Layer 6:  Evidence Retrieval (RAG)
 * Layer 7:  Learning Layer
 * Layer 8:  Continuous Monitoring
 * Layer 9:  Governance
 * Layer 10: Infrastructure & Security
 * 
 * See ARCHITECTURE.md for full documentation.
 */

// Layer 2: Clinical Workflow
export * from './workflow/api';

// Layer 3: Multilingual Processing
export * from './multilingual/api';

// Layer 4: Clinical Intelligence (AI Agents)
export * from './intelligence/api';
export { 
  type ExtractedData, 
  type SoapSections, 
  type PipelineStep, 
  type TranscriptionAgentOutput, 
  type StabilizerAgentOutput, 
  type PatientContextAgentOutput, 
  EMPTY_EXTRACTED, 
  EMPTY_SOAP, 
  PIPELINE_STEPS, 
  AGENT_REGISTRY, 
  runClinicalAgent, 
  searchPubMed 
} from './ai-agents/api';
export type { PatientData, ClinicalAssessment, ClinicalAgentResponse } from './ai-agents/api';

// Layer 5: Clinical Safety
export * from './safety/api';

// Layer 6: Evidence/RAG
export * from './evidence/api';

// Layer 7: Learning
export { 
  type DoctorFavorite, 
  type RegionalLexiconEntry, 
  type DoctorPreferences, 
  type LearningSignal, 
  type LearningSignalType, 
  type LearningMetrics,
  captureTranscriptEditSignal, 
  captureExtractionCorrectionSignal, 
  captureDocumentationStyleSignal, 
  loadDoctorPreferences, 
  saveDoctorPreferences 
} from './learning/api';

// Layer 8: Monitoring
export * from './monitoring/api';

// Layer 9: Governance (use named exports to avoid conflict with monitoring's logAuditEvent)
export {
  type AppRole,
  CLINICAL_ROLES,
  ROLE_LABELS,
  getDefaultRouteForRole,
  PILOT_STATUSES,
  type PilotStatus,
  type ModelVersion,
  MODEL_REGISTRY,
  GOVERNANCE_EVENT_TYPES,
  type GovernanceEventType,
  type AuditLogEntry,
  logGovernanceEvent,
  logSafetyOverride,
  logAIPipelineInvocation,
  logAIOutputEdit,
  type ComplianceCheck,
  runComplianceChecks,
  DATA_ACCESS_MATRIX,
  TENANT_ISOLATED_TABLES,
} from './governance/api';

// Communication Layer
export {
  NOTIFICATION_EVENTS,
  DEFAULT_TEMPLATES,
  DEFAULT_CHANNEL_PRIORITY,
  STATUS_TO_NOTIFICATION,
  sendPatientNotification,
  getNotificationLogs,
  getNotificationForStatus,
  type NotificationEvent,
  type NotificationChannel,
  type ChannelConfig,
  type NotificationTemplate,
  type SendNotificationParams,
  type NotificationResult,
} from './communication/api';

// Integration Layer
export {
  INTEGRATION_CATEGORIES,
  INTEGRATION_PROVIDERS,
  type IntegrationCategory,
  type IntegrationProvider,
  type IntegrationStatus,
  type ClinicIntegration,
  type ExternalLabOrder,
  type ExternalLabResult,
  type ExternalPrescription,
  type WearableHealthData,
  getProvidersForCategory,
  isProviderAvailable,
  getCategoryLabel,
  validateIntegrationConfig,
} from './integration/api';
