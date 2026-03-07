/**
 * DATAelixAIr — 10-Layer Clinical AI Architecture
 * 
 * Layer 1:  User Interface (UI)
 * Layer 2:  Clinical Workflow
 * Layer 3:  Multilingual Processing
 * Layer 4:  AI Agent Layer
 * Layer 5:  Safety Controller
 * Layer 6:  Evidence Retrieval (RAG)
 * Layer 7:  Learning Layer
 * Layer 8:  Continuous Monitoring
 * Layer 9:  Governance
 * Layer 10: Infrastructure & Security
 * 
 * See ARCHITECTURE.md for full documentation.
 */

// Re-export layer APIs for cross-layer consumption
// Note: NormalizationMatch is defined in multilingual and re-exported from ai-agents
// Import from specific layer modules to avoid ambiguity
export * from './workflow/api';
export * from './safety/api';
export * from './evidence/api';
export { type ExtractedData, type SoapSections, type PipelineStep, type TranscriptionAgentOutput, type StabilizerAgentOutput, type PatientContextAgentOutput, EMPTY_EXTRACTED, EMPTY_SOAP, PIPELINE_STEPS, AGENT_REGISTRY, runClinicalAgent, searchPubMed } from './ai-agents/api';
export type { PatientData, ClinicalAssessment, ClinicalAgentResponse } from './ai-agents/api';
export * from './multilingual/api';
export * from './monitoring/api';
export * from './governance/api';
export * from './learning/api';
