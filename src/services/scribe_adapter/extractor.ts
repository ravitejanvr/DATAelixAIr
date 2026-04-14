/**
 * Clinical Entity Extractor
 *
 * Deterministic, rule-based extraction of symptoms, durations,
 * severities, and negations from transcript text.
 *
 * This is NOT an LLM. It's a structured parser that bridges
 * free-text transcripts to the canonical layer.
 *
 * Design: extract candidate symptom phrases → pass to canonicalize()
 * Only canonicalize() decides if a phrase is a valid clinical feature.
 */

import type { ExtractedSymptom, ScribeAdapterOutput, ScribeChunk } from "./types";
import type { SupportedLanguage } from "../canonical/types";
import { detectLanguage } from "../canonical/normalizer";

// ── Duration patterns ──

const DURATION_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => string }> = [
  { regex: /(?:for|since|past|last)\s+(\d+)\s+(days?|weeks?|months?|hours?|years?)/i, extract: (m) => `${m[1]} ${m[2]}` },
  { regex: /(\d+)\s+(days?|weeks?|months?|hours?|years?)\s+(?:ago|back)/i, extract: (m) => `${m[1]} ${m[2]}` },
  { regex: /(\d+)\s*-\s*(\d+)\s+(days?|weeks?|months?)/i, extract: (m) => `${m[1]}-${m[2]} ${m[3]}` },
  { regex: /(?:from|started)\s+(?:yesterday|today|this morning|last night)/i, extract: (m) => m[0].replace(/(?:from|started)\s+/i, "") },
  // Hindi/Hinglish
  { regex: /(\d+)\s*(din|hafte|mahine|ghante)\s*(?:se|pehle)?/i, extract: (m) => `${m[1]} ${m[2]}` },
];

// ── Severity markers ──

const SEVERITY_MAP: Array<{ keywords: string[]; level: ExtractedSymptom["severity"] }> = [
  { keywords: ["severe", "very bad", "extreme", "worst", "excruciating", "unbearable", "intense", "bahut zyada", "bahut", "bhayanak"], level: "severe" },
  { keywords: ["moderate", "significant", "considerable", "thoda zyada"], level: "moderate" },
  { keywords: ["mild", "slight", "little", "minor", "thoda", "halka"], level: "mild" },
];

// ── Negation patterns ──

const NEGATION_PATTERNS = [
  /\bno\s+/i,
  /\bnot\s+/i,
  /\bwithout\s+/i,
  /\bdenies\s+/i,
  /\bdenied\s+/i,
  /\babsent\s+/i,
  /\bnegative\s+for\s+/i,
  /\bnahi\s+/i,
  /\bnahi\b/i,
];

// ── Body part markers ──

const BODY_PARTS = [
  "left", "right", "bilateral", "upper", "lower",
  "arm", "leg", "chest", "back", "abdomen", "head", "neck",
  "knee", "hip", "shoulder", "ankle", "wrist", "hand", "foot",
];

/**
 * Segment transcript into candidate clinical phrases.
 * Splits on sentence boundaries and conjunctions.
 */
function segmentTranscript(text: string): string[] {
  // Split on sentence-ending punctuation, "and", commas, semicolons
  const raw = text.split(/[.!?;]+|\band\b|,/i);
  return raw
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/**
 * Check if a segment contains a negation for the symptom.
 */
function isNegated(segment: string): boolean {
  return NEGATION_PATTERNS.some((p) => p.test(segment));
}

/**
 * Extract duration from a segment.
 */
function extractDuration(segment: string): string | null {
  for (const { regex, extract } of DURATION_PATTERNS) {
    const match = segment.match(regex);
    if (match) return extract(match);
  }
  return null;
}

/**
 * Extract severity from a segment.
 */
function extractSeverity(segment: string): ExtractedSymptom["severity"] {
  const lower = segment.toLowerCase();
  for (const { keywords, level } of SEVERITY_MAP) {
    if (keywords.some((k) => lower.includes(k))) return level;
  }
  return "unknown";
}

/**
 * Extract body part modifier from a segment.
 */
function extractBodyPart(segment: string): string | null {
  const lower = segment.toLowerCase();
  const found = BODY_PARTS.filter((bp) => lower.includes(bp));
  return found.length > 0 ? found.join(" ") : null;
}

/**
 * Strip modifiers (duration, severity, negation) from segment
 * to isolate the core symptom phrase for canonical lookup.
 */
function stripModifiers(segment: string): string {
  let cleaned = segment;
  // Remove duration phrases
  for (const { regex } of DURATION_PATTERNS) {
    cleaned = cleaned.replace(regex, "");
  }
  // Remove severity keywords
  for (const { keywords } of SEVERITY_MAP) {
    for (const k of keywords) {
      cleaned = cleaned.replace(new RegExp(`\\b${k}\\b`, "gi"), "");
    }
  }
  // Remove negation words
  for (const pattern of NEGATION_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  // Remove filler
  cleaned = cleaned.replace(/\b(i have|i had|i am having|having|got|getting|feeling|patient has|patient reports|complains of|c\/o|experiencing)\b/gi, "");
  return cleaned.trim().replace(/\s+/g, " ");
}

/**
 * Extract structured symptoms from raw transcript text.
 *
 * This function produces candidate symptom phrases with modifiers.
 * The actual clinical validation happens downstream in canonicalize().
 * If canonicalize() can't map a phrase, it goes to unmapped[].
 */
export function extractFromTranscript(text: string): ExtractedSymptom[] {
  if (!text || text.trim().length === 0) return [];

  const segments = segmentTranscript(text);
  const symptoms: ExtractedSymptom[] = [];

  for (const segment of segments) {
    const corePhrase = stripModifiers(segment);
    if (corePhrase.length < 2) continue;

    // Skip segments that are purely lab results (handled by clinicalCommandParser)
    if (/^\s*[a-z-]+\s*[:=]?\s*[\d.]+\s*$/i.test(segment.trim())) continue;

    symptoms.push({
      raw_text: corePhrase,
      negated: isNegated(segment),
      duration: extractDuration(segment),
      severity: extractSeverity(segment),
      body_part: extractBodyPart(segment),
    });
  }

  return symptoms;
}

/**
 * Build a ScribeAdapterOutput from a transcript string or streaming chunk.
 */
export function buildAdapterOutput(
  input: string | ScribeChunk,
  chunkIndex = 0
): ScribeAdapterOutput {
  const text = typeof input === "string" ? input : input.text;
  const langHint = detectLanguage(text);

  return {
    extracted_symptoms: extractFromTranscript(text),
    raw_transcript: text,
    language_hint: langHint,
    extraction_timestamp: new Date().toISOString(),
    chunk_index: chunkIndex,
  };
}
