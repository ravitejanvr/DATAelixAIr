/**
 * Multi-Agent Orchestrator Client
 *
 * Typed client for the meta-orchestrator edge function.
 * Provides agent registry, model selection, and result aggregation.
 */

import { supabase } from "@/integrations/supabase/client";

// ── Agent definitions ──

export type AgentName =
  | "intake_agent"
  | "context_agent"
  | "ddx_agent"
  | "knowledge_agent"
  | "safety_agent"
  | "guideline_agent"
  | "documentation_agent";

export interface AgentDefinition {
  name: AgentName;
  label: string;
  description: string;
  default_model: string;
  phase: number;
  dependencies: AgentName[];
  is_ai: boolean;
}

export const AGENT_REGISTRY: AgentDefinition[] = [
  {
    name: "intake_agent",
    label: "Intake Agent",
    description: "Extracts structured intake data from transcript",
    default_model: "google/gemini-3-flash-preview",
    phase: 1,
    dependencies: [],
    is_ai: true,
  },
  {
    name: "context_agent",
    label: "Context Agent",
    description: "Assembles patient context from database records",
    default_model: "none",
    phase: 1,
    dependencies: [],
    is_ai: false,
  },
  {
    name: "ddx_agent",
    label: "Differential Diagnosis Agent",
    description: "Generates ranked differential diagnoses",
    default_model: "google/gemini-3-flash-preview",
    phase: 2,
    dependencies: ["intake_agent", "context_agent"],
    is_ai: true,
  },
  {
    name: "knowledge_agent",
    label: "Knowledge Retrieval Agent",
    description: "Retrieves evidence-based treatment references",
    default_model: "google/gemini-2.5-flash",
    phase: 3,
    dependencies: ["ddx_agent"],
    is_ai: true,
  },
  {
    name: "safety_agent",
    label: "Medication Safety Agent",
    description: "Checks drug interactions, allergies, dangerous vitals",
    default_model: "none",
    phase: 3,
    dependencies: ["intake_agent", "context_agent"],
    is_ai: false,
  },
  {
    name: "guideline_agent",
    label: "Guideline Compliance Agent",
    description: "Validates recommendations against clinical guidelines",
    default_model: "google/gemini-2.5-flash",
    phase: 3,
    dependencies: ["ddx_agent"],
    is_ai: true,
  },
  {
    name: "documentation_agent",
    label: "Documentation Agent",
    description: "Generates structured SOAP clinical notes",
    default_model: "google/gemini-3-flash-preview",
    phase: 4,
    dependencies: ["intake_agent", "safety_agent"],
    is_ai: true,
  },
];

// ── Supported models for selection ──

export const AVAILABLE_MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", tier: "fast" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "balanced" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "premium" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", tier: "premium" },
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", tier: "balanced" },
  { id: "openai/gpt-5", label: "GPT-5", tier: "premium" },
] as const;

// ── Result types ──

export interface AgentResult {
  agent: AgentName;
  status: "success" | "error" | "skipped" | "timeout";
  data: any;
  latency_ms: number;
  model_used: string;
}

export interface IntakeResult {
  chief_complaint: string;
  duration?: string;
  associated_symptoms?: string[];
  vitals_mentioned?: string;
  chronic_conditions?: string[];
  current_medications?: string[];
  allergies?: string[];
  pain_score?: number;
  pregnancy_status?: string;
}

export interface DDXDiagnosis {
  diagnosis: string;
  probability: number;
  supporting_evidence: string[];
  must_not_miss: boolean;
  recommended_tests?: string[];
}

export interface DDXResult {
  differential_diagnoses: DDXDiagnosis[];
  reasoning_summary: string;
}

export interface KnowledgeEvidence {
  diagnosis: string;
  treatment_options: string[];
  recommended_tests: string[];
  guideline_sources?: string[];
  evidence_grade?: string;
}

export interface KnowledgeResult {
  evidence: KnowledgeEvidence[];
  sources_consulted: number;
}

export interface SafetyResult {
  interaction_flags: any[];
  allergy_flags: any[];
  dose_warnings: any[];
  vitals_dangers: any[];
  emergency_patterns: any[];
}

export interface GuidelineResult {
  compliance_score: number;
  citations: any[];
  conflicts: any[];
}

export interface OrchestratorResponse {
  aggregated: {
    intake: IntakeResult | null;
    context: any;
    differential_diagnosis: DDXResult | null;
    knowledge: KnowledgeResult | null;
    safety: SafetyResult | null;
    guideline_compliance: GuidelineResult | null;
    documentation: Record<string, string> | null;
  };
  agent_results: AgentResult[];
  total_ms: number;
  orchestration_version: string;
}

// ── Orchestrator input ──

export interface OrchestratorInput {
  transcript?: string;
  stabilized_transcript?: string;
  clinical_context?: any;
  intake_data?: any;
  patient_id?: string;
  visit_id?: string;
  clinic_id?: string;
  model_overrides?: Partial<Record<AgentName, string>>;
  skip_agents?: AgentName[];
}

// ── Client function ──

export async function runMultiAgentPipeline(
  input: OrchestratorInput,
): Promise<OrchestratorResponse> {
  const { data, error } = await supabase.functions.invoke("meta-orchestrator", {
    body: input,
  });

  if (error) {
    console.error("[MultiAgent] Orchestrator error:", error);
    throw new Error(error.message || "Multi-agent pipeline failed");
  }

  return data as OrchestratorResponse;
}

// ── Helpers ──

export function getAgentsByPhase(): Map<number, AgentDefinition[]> {
  const phaseMap = new Map<number, AgentDefinition[]>();
  for (const agent of AGENT_REGISTRY) {
    if (!phaseMap.has(agent.phase)) phaseMap.set(agent.phase, []);
    phaseMap.get(agent.phase)!.push(agent);
  }
  return phaseMap;
}

export function getAgentStatusColor(status: AgentResult["status"]): string {
  switch (status) {
    case "success": return "text-green-600";
    case "error": return "text-destructive";
    case "timeout": return "text-yellow-600";
    case "skipped": return "text-muted-foreground";
  }
}

export function getAgentStatusIcon(status: AgentResult["status"]): string {
  switch (status) {
    case "success": return "✓";
    case "error": return "✗";
    case "timeout": return "⏱";
    case "skipped": return "—";
  }
}

export function computeOrchestratorHealthScore(results: AgentResult[]): number {
  const total = results.filter(r => r.status !== "skipped").length;
  if (total === 0) return 0;
  const succeeded = results.filter(r => r.status === "success").length;
  return Math.round((succeeded / total) * 100);
}
