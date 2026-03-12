/**
 * Uncertainty Engine Service — Canonical Interface
 *
 * Computes diagnostic confidence using context completeness,
 * symptom match, guideline support, and conflicting evidence.
 */

import { runUncertaintyEngine as invokeUncertainty, type UncertaintyInput, type UncertaintyResult } from "@/services/uncertainty_engine/client";

export type { UncertaintyResult } from "@/services/uncertainty_engine/client";

export interface UncertaintyOutput {
  confidence_score: number;
  confidence_label: string;
  missing_evidence: string[];
  follow_up_questions: string[];
  raw: UncertaintyResult | null;
}

/**
 * Run uncertainty calibration on pipeline outputs.
 * If confidence < 0.3, generates follow-up questions.
 */
export async function evaluateUncertainty(params: {
  symptoms: string[];
  vitals?: Record<string, any>;
  diagnoses: Array<{ diagnosis: string; probability_score: number; supporting_symptoms?: string[] }>;
  guideline_sources?: string[];
  medical_history?: string[];
  medications?: string[];
  allergies?: string[];
  safety_score?: number;
}): Promise<UncertaintyOutput> {
  const input: UncertaintyInput = {
    symptoms: params.symptoms,
    vitals: params.vitals,
    differential_diagnoses: params.diagnoses.map(d => ({
      diagnosis_name: d.diagnosis,
      probability: d.probability_score,
      supporting_symptoms: d.supporting_symptoms,
    })),
    guideline_sources: params.guideline_sources,
    medical_history: params.medical_history,
    current_medications: params.medications,
    allergies: params.allergies,
    safety_score: params.safety_score,
  };

  const result = await invokeUncertainty(input);

  if (!result) {
    return {
      confidence_score: 0,
      confidence_label: "Very Uncertain",
      missing_evidence: [],
      follow_up_questions: [],
      raw: null,
    };
  }

  // Generate follow-up questions when confidence is low
  const followUpQuestions: string[] = [];
  if (result.confidence_score < 0.3) {
    if (result.missing_evidence.includes("vitals")) {
      followUpQuestions.push("Can you record the patient's vital signs?");
    }
    if (result.missing_evidence.includes("lab_results")) {
      followUpQuestions.push("Are there any recent lab results available?");
    }
    if (result.missing_evidence.length > 0) {
      followUpQuestions.push(`Missing information: ${result.missing_evidence.join(", ")}. Can you provide additional details?`);
    }
    if (result.diagnostic_conflict) {
      followUpQuestions.push("Conflicting diagnostic signals detected. Consider additional differential workup.");
    }
  }

  return {
    confidence_score: result.confidence_score,
    confidence_label: result.confidence_label,
    missing_evidence: result.missing_evidence,
    follow_up_questions: followUpQuestions,
    raw: result,
  };
}
