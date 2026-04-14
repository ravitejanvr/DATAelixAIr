/**
 * Scribe Adapter Types
 *
 * Defines the contract between raw scribe transcript output
 * and the V4 canonical pipeline input.
 */

import type { CanonicalizationResult, SupportedLanguage } from "../canonical/types";

/** A single clinical entity extracted from transcript text */
export interface ExtractedEntity {
  raw_text: string;
  entity_type: "symptom" | "duration" | "severity" | "lab_result" | "body_part" | "negation";
  span: { start: number; end: number };
  confidence: number;
}

/** Structured symptom with optional modifiers */
export interface ExtractedSymptom {
  raw_text: string;
  negated: boolean;
  duration: string | null;       // e.g. "3 days", "1 week"
  severity: "mild" | "moderate" | "severe" | "unknown";
  body_part: string | null;      // e.g. "left arm", "chest"
}

/** Output of the scribe adapter — ready for canonicalize() */
export interface ScribeAdapterOutput {
  extracted_symptoms: ExtractedSymptom[];
  raw_transcript: string;
  language_hint: SupportedLanguage;
  extraction_timestamp: string;
  chunk_index: number;
  /** Canonical pipeline result (populated after canonicalization) */
  canonicalization?: CanonicalizationResult;
}

/** Streaming chunk from realtime scribe */
export interface ScribeChunk {
  text: string;
  is_final: boolean;
  timestamp: string;
}
