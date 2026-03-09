/**
 * Layer 4: Clinical Intelligence API
 * 
 * Documents and exposes the AI-assisted clinical capabilities:
 * - Symptom extraction from transcripts
 * - Diagnosis suggestions based on clinical context
 * - Prescription recommendations with safety checks
 * - Lab test recommendations
 * - SOAP note generation
 * 
 * All AI outputs are advisory and require clinician review.
 * 
 * Dependencies:
 *   - Layer 5 (Safety): Safety validation before suggestions
 *   - Layer 6 (Evidence): Citation support for recommendations
 *   - Layer 10 (Infrastructure): AI Gateway access
 */

// ── AI Pipeline Stages ────────────────────────────────────────

export type PipelineStage = 
  | "idle"
  | "stabilizing"      // Transcript cleanup & regional lexicon
  | "extracting"       // Structured symptom/context extraction
  | "safety_checking"  // Drug interactions, allergies, vitals
  | "generating_soap"  // Clinical notes generation
  | "complete"
  | "error";

export interface PipelineStatus {
  stage: PipelineStage;
  progress: number; // 0-100
  message: string;
}

export const PIPELINE_STAGE_CONFIG: Record<PipelineStage, { label: string; progress: number }> = {
  idle: { label: "Ready", progress: 0 },
  stabilizing: { label: "Processing transcript...", progress: 20 },
  extracting: { label: "Extracting clinical data...", progress: 45 },
  safety_checking: { label: "Running safety checks...", progress: 70 },
  generating_soap: { label: "Generating clinical notes...", progress: 90 },
  complete: { label: "Complete", progress: 100 },
  error: { label: "Error", progress: 0 },
};

// ── Extraction Output Types ───────────────────────────────────

export interface ExtractedClinicalData {
  chief_complaint: string;
  duration: string;
  associated_symptoms: string;
  vitals: string;
  chronic_conditions: string;
  current_medications: string;
  allergies: string;
}

export const EMPTY_EXTRACTION: ExtractedClinicalData = {
  chief_complaint: "",
  duration: "",
  associated_symptoms: "",
  vitals: "",
  chronic_conditions: "",
  current_medications: "",
  allergies: "",
};

// ── Diagnosis Suggestion Types ────────────────────────────────

export interface DiagnosisSuggestion {
  diagnosis: string;
  confidence: "high" | "moderate" | "low";
  icd_codes: string[];
  supporting_evidence: string[];
  differential: string[];
}

// ── Prescription Suggestion Types ─────────────────────────────

export interface PrescriptionSuggestion {
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  route: string;
  indication: string;
  evidence_source?: string;
  safety_status: "safe" | "warning" | "contraindicated";
  warnings: string[];
}

// ── Lab Recommendation Types ──────────────────────────────────

export interface LabRecommendation {
  test_name: string;
  category: string;
  priority: "routine" | "urgent" | "stat";
  clinical_indication: string;
  evidence_source?: string;
}

// ── SOAP Note Sections ────────────────────────────────────────

export interface SoapSections {
  "Visit Summary": string;
  "Findings": string;
  "Provisional Diagnosis": string;
  "Safety Warnings": string;
  "Treatment Plan": string;
  "Advice": string;
  "Follow-up": string;
}

export const EMPTY_SOAP_SECTIONS: SoapSections = {
  "Visit Summary": "",
  "Findings": "",
  "Provisional Diagnosis": "",
  "Safety Warnings": "No safety concerns identified.",
  "Treatment Plan": "",
  "Advice": "",
  "Follow-up": "",
};

// ── Full Pipeline Response ────────────────────────────────────

export interface ClinicalIntelligenceResponse {
  // Stage 1: Transcript Stabilization
  stabilized_transcript: string;
  normalization_results: Array<{
    regional_phrase: string;
    clinical_term: string;
    category: string;
    language: string;
  }>;
  detected_languages: string[];
  
  // Stage 2: Structured Extraction
  extracted_data: ExtractedClinicalData;
  
  // Stage 3: Safety Results
  safety_results: {
    interaction_flags: any[];
    allergy_flags: any[];
    dose_warnings: any[];
    vitals_dangers: any[];
    emergency_patterns: any[];
    confidence_level: "high" | "moderate" | "low";
    requires_manual_review: boolean;
    ai_suggestions_blocked: boolean;
  };
  
  // Stage 4: SOAP Generation
  soap_sections: SoapSections;
  
  // Metadata
  stage_timings: Record<string, number>;
  pipeline_complete: boolean;
  model_version: string;
}

// ── Intelligence Capability Flags ─────────────────────────────

export interface IntelligenceCapabilities {
  symptom_extraction: boolean;
  diagnosis_suggestions: boolean;
  prescription_suggestions: boolean;
  lab_recommendations: boolean;
  soap_generation: boolean;
  evidence_retrieval: boolean;
  multilingual_support: boolean;
  safety_checks: boolean;
}

export const AVAILABLE_CAPABILITIES: IntelligenceCapabilities = {
  symptom_extraction: true,
  diagnosis_suggestions: true,
  prescription_suggestions: true,
  lab_recommendations: true,
  soap_generation: true,
  evidence_retrieval: true,
  multilingual_support: true,  // Telugu, Hindi, Urdu, English
  safety_checks: true,
};

// ── AI Disclosure Constants ───────────────────────────────────

export const AI_DISCLOSURE = {
  badge_label: "AI-Assisted Draft",
  review_required_label: "Clinician Review Required",
  full_disclosure: "This content was generated by AI based on the consultation transcript. Your doctor reviews and approves all clinical decisions.",
  conservative_language_note: "AI outputs use conservative language (e.g., 'Consider', 'Likely', 'Provisional') to maintain clinician authority.",
} as const;

// ── Supported AI Models ───────────────────────────────────────

export const AI_MODELS = {
  primary: "google/gemini-3-flash-preview",
  fallback: "google/gemini-2.5-flash",
  extraction: "google/gemini-3-flash-preview",
  soap: "google/gemini-3-flash-preview",
  evidence: "google/gemini-2.5-flash",
} as const;
