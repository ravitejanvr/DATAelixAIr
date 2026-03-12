/**
 * PCIE — Context Builder (Orchestrator)
 * 
 * Assembles the final Patient Context Object by running
 * all PCIE modules in sequence with parallel execution
 * where possible.
 */

import { detectLanguage, normalizeText, translateCodeMixed } from "./language_processor";
import { extractMedicalPhrases, type ExtractionResult } from "./symptom_extractor";
import { mapToClinicalConcepts, type MappedConcept } from "./concept_mapper";
import { identifyMissingInformation, type MissingField } from "./context_completion";
import { detectRiskFlags, type RiskFlag } from "./risk_flag_engine";
import { computeContextConfidence, type ConfidenceBreakdown } from "./context_confidence";

export interface PatientContextObject {
  chief_complaint: string;
  symptoms: MappedConcept[];
  associated_symptoms: MappedConcept[];
  duration: string;
  severity: string;
  medications_taken: string[];
  allergies: string[];
  risk_factors: string[];
  vitals: Record<string, unknown> | null;
  lab_results: unknown[];
  risk_flags: RiskFlag[];
  missing_information: MissingField[];
  context_confidence: number;
  confidence_breakdown: ConfidenceBreakdown;
  input_sources: string[];
  language_detected: string;
  processing_time_ms: number;
}

export interface BuildContextInput {
  /** Raw text from patient (intake form, chat, voice transcript) */
  raw_text: string;
  /** Type of input source */
  input_type: "form" | "chat" | "voice" | "frontdesk" | "report";
  /** Pre-structured data from intake form (optional) */
  structured_data?: {
    chief_complaint?: string;
    symptoms?: string[];
    duration?: string;
    severity?: string;
    allergies?: string[];
    medications?: string[];
  };
  /** Patient demographics */
  patient_age?: number | null;
  patient_sex?: string | null;
  /** Vitals data */
  vitals?: {
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    pulse?: number | null;
    temperature?: number | null;
    spo2?: number | null;
    respiratory_rate?: number | null;
    weight_kg?: number | null;
    height_cm?: number | null;
  } | null;
  /** Lab results if available */
  lab_results?: unknown[];
  /** Previous conditions from patient record */
  previous_conditions?: string[];
}

/**
 * Build a complete Patient Context Object from raw input.
 * This is the main PCIE orchestration function.
 */
export async function buildPatientContextObject(
  input: BuildContextInput
): Promise<PatientContextObject> {
  const startTime = performance.now();

  // Stage 1: Language detection & normalization
  const language = detectLanguage(input.raw_text);
  let normalizedText = normalizeText(input.raw_text);
  if (language !== "en") {
    normalizedText = translateCodeMixed(normalizedText);
  }

  // Stage 2: Medical phrase extraction
  const extraction = extractMedicalPhrases(normalizedText);

  // Merge structured data if available
  const mergedSymptoms = mergeArrays(
    extraction.symptoms,
    input.structured_data?.symptoms
  );
  const mergedAllergies = mergeArrays(
    extraction.allergies,
    input.structured_data?.allergies
  );
  const mergedMedications = mergeArrays(
    extraction.medications,
    input.structured_data?.medications
  );

  const chiefComplaint =
    input.structured_data?.chief_complaint ||
    extraction.symptoms[0] ||
    "";

  const duration =
    input.structured_data?.duration ||
    extraction.duration ||
    "";

  const severity =
    input.structured_data?.severity ||
    extraction.severity ||
    "unknown";

  // Stage 3: Clinical concept mapping (parallel-safe)
  const [symptomConcepts, associatedConcepts] = await Promise.all([
    mapToClinicalConcepts(mergedSymptoms),
    mapToClinicalConcepts(input.previous_conditions || []),
  ]);

  // Stage 4: Risk flag detection
  const riskFlags = detectRiskFlags({
    symptoms: mergedSymptoms,
    chief_complaint: chiefComplaint,
    vitals: input.vitals
      ? {
          temperature: input.vitals.temperature,
          pulse: input.vitals.pulse,
          bp_systolic: input.vitals.bp_systolic,
          bp_diastolic: input.vitals.bp_diastolic,
          spo2: input.vitals.spo2,
        }
      : null,
    age: input.patient_age,
    medications: mergedMedications,
  });

  // Stage 5: Missing information identification
  const missingInfo = identifyMissingInformation({
    chief_complaint: chiefComplaint,
    symptoms: mergedSymptoms,
    vitals: input.vitals as Record<string, unknown> | null,
    allergies: mergedAllergies,
    medications: mergedMedications,
    patient_age: input.patient_age ?? null,
    patient_sex: input.patient_sex ?? null,
  });

  // Stage 6: Confidence scoring
  const confidenceResult = computeContextConfidence({
    chief_complaint: chiefComplaint,
    symptoms: mergedSymptoms,
    duration,
    severity,
    vitals: input.vitals as Record<string, unknown> | null,
    allergies: mergedAllergies,
    medications: mergedMedications,
    patient_age: input.patient_age ?? null,
    patient_sex: input.patient_sex ?? null,
    lab_results: input.lab_results || [],
    input_sources: [input.input_type],
    risk_flags: riskFlags,
  });

  const processingTime = Math.round(performance.now() - startTime);

  return {
    chief_complaint: chiefComplaint,
    symptoms: symptomConcepts,
    associated_symptoms: associatedConcepts,
    duration,
    severity,
    medications_taken: mergedMedications,
    allergies: mergedAllergies,
    risk_factors: input.previous_conditions || [],
    vitals: input.vitals || null,
    lab_results: input.lab_results || [],
    risk_flags: riskFlags,
    missing_information: missingInfo,
    context_confidence: confidenceResult.score,
    confidence_breakdown: confidenceResult,
    input_sources: [input.input_type],
    language_detected: language,
    processing_time_ms: processingTime,
  };
}

/** Deduplicated merge of arrays */
function mergeArrays(a: string[], b?: string[]): string[] {
  const set = new Set<string>();
  a.forEach(v => set.add(v.toLowerCase().trim()));
  b?.forEach(v => set.add(v.toLowerCase().trim()));
  return Array.from(set).filter(Boolean);
}
