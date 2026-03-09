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
  captureTranscriptEditSignal, 
  captureExtractionCorrectionSignal, 
  captureDocumentationStyleSignal, 
  loadDoctorPreferences, 
  saveDoctorPreferences 
} from './learning/api';

// Layer 8: Monitoring
export * from './monitoring/api';

// Layer 9: Governance
export * from './governance/api';
