/**
 * Layer 4: AI Agent Layer API
 * 
 * Manages clinical AI operations: structured data extraction from
 * transcripts, SOAP note generation, and RAG clinical assessment.
 * All outputs require doctor review before persistence.
 * 
 * Dependencies:
 *   - Layer 3 (Multilingual): Stabilized transcript input
 *   - Layer 5 (Safety): Safety results context for SOAP
 *   - Layer 6 (Evidence): Citation retrieval
 *   - Layer 10 (Infrastructure): Supabase Edge Functions
 * 
 * Consumers:
 *   - Layer 1 (UI): Clinical workspace pipeline
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

export interface ExtractedData {
  chief_complaint: string;
  duration: string;
  associated_symptoms: string;
  vitals: string;
  chronic_conditions: string;
  current_medications: string;
  allergies: string;
}

export interface SoapSections {
  "Visit Summary": string;
  "Findings": string;
  "Provisional Diagnosis": string;
  "Safety Warnings": string;
  "Treatment Plan": string;
  "Advice": string;
  "Follow-up": string;
}

export const EMPTY_EXTRACTED: ExtractedData = {
  chief_complaint: "", duration: "", associated_symptoms: "",
  vitals: "", chronic_conditions: "", current_medications: "", allergies: "",
};

export const EMPTY_SOAP: SoapSections = {
  "Visit Summary": "", "Findings": "", "Provisional Diagnosis": "",
  "Safety Warnings": "", "Treatment Plan": "", "Advice": "", "Follow-up": "",
};

export type PipelineStep = "record" | "review" | "extract" | "safety" | "soap" | "saved";

export const PIPELINE_STEPS: { key: PipelineStep; label: string; num: number }[] = [
  { key: "record", label: "Record", num: 1 },
  { key: "review", label: "Review", num: 2 },
  { key: "extract", label: "Extract", num: 3 },
  { key: "safety", label: "Safety", num: 4 },
  { key: "soap", label: "Summary", num: 5 },
  { key: "saved", label: "Saved", num: 6 },
];
