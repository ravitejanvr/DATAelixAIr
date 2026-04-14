/**
 * Scribe Adapter — V4 Pipeline Integration
 *
 * Bridges ElevenLabs Scribe transcript → V4 Canonical Pipeline.
 *
 * Flow:
 *   Scribe (raw text) → Adapter (extract entities) → canonicalize() → Pipeline
 *
 * 🚫 RAW STRING USAGE FORBIDDEN BEYOND THIS MODULE
 */

export type { ExtractedSymptom, ScribeAdapterOutput, ScribeChunk } from "./types";
export { extractFromTranscript, buildAdapterOutput } from "./extractor";

import { buildAdapterOutput } from "./extractor";
import { canonicalize } from "../canonical/normalizer";
import type { ScribeAdapterOutput, ScribeChunk } from "./types";
import type { CanonicalFeature } from "../canonical/types";

/**
 * Full pipeline entry: transcript → extracted symptoms → canonical features.
 *
 * This is the SINGLE entry point for converting scribe output
 * into V4 pipeline-ready data. After this function, only
 * canonical IDs exist — no raw strings.
 */
export function processTranscript(
  transcript: string,
  chunkIndex = 0
): ScribeAdapterOutput {
  const output = buildAdapterOutput(transcript, chunkIndex);

  // Map extracted symptom phrases through the canonical layer
  const rawInputs = output.extracted_symptoms
    .filter((s) => !s.negated)
    .map((s) => s.raw_text);

  const canonResult = canonicalize(rawInputs, output.language_hint);

  // Enrich canonical features with adapter-extracted modifiers
  const enrichedFeatures: CanonicalFeature[] = canonResult.features.map((feature) => {
    // Find matching extracted symptom to pull duration/severity
    const matchingExtraction = output.extracted_symptoms.find((es) => {
      const normalized = es.raw_text.toLowerCase().trim();
      return feature.feature_id === resolveFeatureIdFromRaw(normalized, canonResult);
    });

    if (matchingExtraction) {
      return {
        ...feature,
        intensity: mapSeverity(matchingExtraction.severity),
        duration: matchingExtraction.duration || feature.duration,
      };
    }
    return feature;
  });

  output.canonicalization = {
    ...canonResult,
    features: enrichedFeatures,
  };

  return output;
}

/**
 * Process a streaming chunk from realtime scribe.
 * Only processes final (committed) chunks to avoid duplicate work.
 */
export function processChunk(chunk: ScribeChunk, chunkIndex: number): ScribeAdapterOutput | null {
  if (!chunk.is_final) return null;
  return processTranscript(chunk.text, chunkIndex);
}

// ── Internal helpers ──

function mapSeverity(severity: string): CanonicalFeature["intensity"] {
  switch (severity) {
    case "mild": return "mild";
    case "moderate": return "moderate";
    case "severe": return "severe";
    default: return "unknown";
  }
}

function resolveFeatureIdFromRaw(
  rawText: string,
  canonResult: { features: CanonicalFeature[]; unmapped: string[] }
): string | null {
  // Check if this raw text produced any canonical feature
  for (const f of canonResult.features) {
    if (f.feature_id) return f.feature_id;
  }
  return null;
}
