/**
 * Multi-Agent System — Public API
 */
export {
  runMultiAgentPipeline,
  AGENT_REGISTRY,
  AVAILABLE_MODELS,
  getAgentsByPhase,
  getAgentStatusColor,
  getAgentStatusIcon,
  computeOrchestratorHealthScore,
} from "./client";

export type {
  AgentName,
  AgentDefinition,
  AgentResult,
  OrchestratorInput,
  OrchestratorResponse,
  IntakeResult,
  DDXResult,
  DDXDiagnosis,
  KnowledgeResult,
  KnowledgeEvidence,
  SafetyResult,
  GuidelineResult,
} from "./client";
