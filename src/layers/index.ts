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
export * from './workflow/api';
export * from './safety/api';
export * from './evidence/api';
export * from './ai-agents/api';
export * from './multilingual/api';
export * from './monitoring/api';
export * from './governance/api';
export * from './learning/api';
