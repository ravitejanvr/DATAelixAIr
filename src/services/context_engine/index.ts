/**
 * Patient Context Intelligence Engine (PCIE) — Public API
 * 
 * Re-exports all modules for clean external consumption.
 */

// Core orchestrator
export { buildPatientContextObject } from "./context_builder";
export type { PatientContextObject, BuildContextInput } from "./context_builder";

// Language processing
export { detectLanguage, normalizeText, translateCodeMixed } from "./language_processor";
export type { SupportedLanguage } from "./language_processor";

// Symptom extraction
export { extractMedicalPhrases } from "./symptom_extractor";
export type { ExtractionResult } from "./symptom_extractor";

// Concept mapping
export { mapToClinicalConcepts, resetConceptCache } from "./concept_mapper";
export type { MappedConcept } from "./concept_mapper";

// Context completion
export { identifyMissingInformation, getAICompletionSuggestions } from "./context_completion";
export type { MissingField } from "./context_completion";

// Risk flags
export { detectRiskFlags } from "./risk_flag_engine";
export type { RiskFlag } from "./risk_flag_engine";

// Confidence scoring
export { computeContextConfidence, getConfidenceLabel } from "./context_confidence";
export type { ConfidenceBreakdown } from "./context_confidence";
