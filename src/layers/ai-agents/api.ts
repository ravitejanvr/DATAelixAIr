/**
 * Layer 4: AI Agent Layer — Modular Agent Contract System
 * 
 * Defines specialized AI agents that operate sequentially
 * within a controlled clinical pipeline. Each agent has:
 *   - Purpose: What it does
 *   - Input Schema: What it receives
 *   - Output Schema: What it produces
 *   - Safety Rules: Constraints it must follow
 *   - Dependencies: What it needs from other agents/layers
 * 
 * Pipeline Order (strict sequential execution):
 *   1. Transcription Agent (ElevenLabs Scribe v2)
 *   2. Transcript Stabilizer Agent (stabilize-transcript)
 *   3. Patient Context Agent (client-side DB query)
 *   4. Clinical Extraction Agent (extract-patient-data)
 *   5. Prescription Safety Agent (clinical-safety)
 *   6. Documentation Agent (clinical-soap)
 *   7. Translation Agent (translate-clinical / patient-explanation)
 *
 * Consumers:
 *   - Layer 1 (UI): Clinical workspace pipeline
 *   - Layer 2 (Workflow): Visit-based data persistence
 */

// Re-export the clinical API types and functions
export { 
  runClinicalAgent, 
  searchPubMed 
} from "@/lib/clinical-api";

export type { 
  PatientData, 
  ClinicalAssessment, 
  ClinicalAgentResponse 
} from "@/lib/clinical-api";

// ── Agent 1: Transcription Agent ─────────────────────────────
// Edge Function: elevenlabs-scribe-token | Model: ElevenLabs Scribe v2
// Purpose: Convert raw audio into multilingual text (verbatim)
// Safety: No clinical interpretation. Preserve all languages as-is.

export interface TranscriptionAgentOutput {
  raw_transcript: string;
  confidence: number;
  duration_seconds: number;
}

// ── Agent 2: Transcript Stabilizer Agent ─────────────────────
// Edge Function: stabilize-transcript | Model: Gemini 3 Flash (temp 0.1)
// Purpose: Clean raw transcript via lexicon lookup + AI stabilization
// Safety: Never translate, summarize, or infer diagnoses

export interface StabilizerAgentOutput {
  stabilized_transcript: string;
  original_transcript: string;
  normalization_results: NormalizationMatch[];
  detected_languages: string[];
  match_count: number;
}

// Re-export NormalizationMatch from multilingual layer (single source of truth)
export type { NormalizationMatch } from "@/layers/multilingual/api";

// ── Agent 3: Patient Context Agent ───────────────────────────
// Runtime: Client-side Supabase query (no AI)
// Purpose: Assemble patient context for downstream agents
// Safety: No AI reasoning. Pure data assembly from DB.

export interface PatientContextAgentOutput {
  patient: {
    name: string;
    age: number | null;
    gender: string | null;
    allergies: string[];
    current_medications: string[];
    chronic_conditions: string[];
  };
  recent_vitals: Record<string, any> | null;
  visit_history_count: number;
}

// ── Agent 4: Clinical Extraction Agent ───────────────────────
// Edge Function: extract-patient-data | Model: Gemini 3 Flash (tool calling)
// Purpose: Extract structured clinical fields from confirmed transcript
// Safety: Extract ONLY explicitly stated facts. Never infer.

export interface ExtractedData {
  chief_complaint: string;
  duration: string;
  associated_symptoms: string;
  vitals: string;
  chronic_conditions: string;
  current_medications: string;
  allergies: string;
}

export const EMPTY_EXTRACTED: ExtractedData = {
  chief_complaint: "", duration: "", associated_symptoms: "",
  vitals: "", chronic_conditions: "", current_medications: "", allergies: "",
};

// ── Agent 5: Prescription Safety Agent ───────────────────────
// Edge Function: clinical-safety | Model: Rule-based + RxNorm API
// Purpose: Validate medications against safety databases
// Safety: MANDATORY step. Cannot be skipped. Results require clinician review.
// (Types defined in Layer 5: src/layers/safety/api.ts)

// ── Agent 6: Documentation Agent ─────────────────────────────
// Edge Function: clinical-soap | Model: Gemini 3 Flash (temp 0.2)
// Purpose: Generate structured clinical documentation
// Safety: Use ONLY extraction + safety data. Conservative language. Doctor review required.

export interface SoapSections {
  soap_subjective: string;
  soap_objective: string;
  soap_assessment: string;
  soap_plan: string;
}

export const EMPTY_SOAP: SoapSections = {
  soap_subjective: "", soap_objective: "",
  soap_assessment: "", soap_plan: "",
};

// ── Agent 7: Translation Agent ───────────────────────────────
// Edge Functions: translate-clinical, patient-explanation
// Model: Gemini 2.5 Flash (temp 0.2)
// Purpose: Translate finalized clinical text
// Safety: Preserve all medical terms exactly. Never alter clinical meaning.

// ── Pipeline Orchestration ───────────────────────────────────

export type PipelineStep = "record" | "review" | "extract" | "safety" | "soap" | "saved";

export const PIPELINE_STEPS: { key: PipelineStep; label: string; agent: string }[] = [
  { key: "record",  label: "Record",             agent: "Transcription Agent" },
  { key: "review",  label: "Stabilize & Review",  agent: "Stabilizer Agent" },
  { key: "extract", label: "Extract",            agent: "Extraction Agent" },
  { key: "safety",  label: "Safety Check",       agent: "Safety Agent" },
  { key: "soap",    label: "Documentation",      agent: "Documentation Agent" },
  { key: "saved",   label: "Saved",              agent: "—" },
];

/**
 * Agent registry for runtime introspection and audit logging.
 */
export const AGENT_REGISTRY = {
  transcription: {
    name: "Transcription Agent",
    edge_function: "elevenlabs-scribe-token",
    model: "ElevenLabs Scribe v2",
    temperature: null,
    safety_rules: [
      "Verbatim capture only",
      "No clinical interpretation",
      "Preserve all languages as-is",
    ],
  },
  stabilizer: {
    name: "Transcript Stabilizer Agent",
    edge_function: "stabilize-transcript",
    model: "google/gemini-3-flash-preview",
    temperature: 0.1,
    safety_rules: [
      "Never translate between languages",
      "Never summarize or infer diagnoses",
      "Preserve negations strictly",
      "Mark uncertain words with [?]",
    ],
  },
  patient_context: {
    name: "Patient Context Agent",
    edge_function: null,
    model: null,
    temperature: null,
    safety_rules: [
      "No AI reasoning — pure data assembly",
      "Only fetch data the user has RLS access to",
    ],
  },
  extraction: {
    name: "Clinical Extraction Agent",
    edge_function: "extract-patient-data",
    model: "google/gemini-3-flash-preview",
    temperature: null,
    safety_rules: [
      "Extract ONLY explicitly stated facts",
      "Never infer or assume",
      "Leave fields blank when uncertain",
    ],
  },
  safety: {
    name: "Prescription Safety Agent",
    edge_function: "clinical-safety",
    model: null,
    temperature: null,
    safety_rules: [
      "MANDATORY — cannot be skipped",
      "Clinician must review all results",
      "Allergy conflicts always high severity",
    ],
  },
  documentation: {
    name: "Documentation Agent",
    edge_function: "clinical-soap",
    model: "google/gemini-3-flash-preview",
    temperature: 0.2,
    safety_rules: [
      "Use ONLY data from extraction + safety agents",
      "Never invent findings",
      "Use conservative, provisional language",
      "Output requires doctor review before persistence",
    ],
  },
  translation: {
    name: "Translation Agent",
    edge_function: "translate-clinical",
    model: "google/gemini-2.5-flash",
    temperature: 0.2,
    safety_rules: [
      "Preserve medical terms and drug names exactly",
      "Never alter clinical meaning",
      "Patient explanations must end with disclaimer",
    ],
  },
} as const;
