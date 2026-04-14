/**
 * Transcript Normalizer — Pre-Scribe Cleaning Layer
 *
 * Cleans STT noise, normalizes multilingual input, and preserves
 * clinical meaning before passing to the scribe extraction pipeline.
 *
 * Pipeline: input → normalizeTranscript() → processTranscript() → canonicalize()
 */

import type { SupportedLanguage } from "../canonical/types";

/**
 * Normalize a raw transcript for clinical extraction.
 *
 * Responsibilities:
 * - Remove STT artifacts (repeated words, filler words)
 * - Normalize whitespace and punctuation
 * - Handle code-mixed input (Hinglish, Tenglish)
 * - Preserve clinical meaning and numbers
 */
export function normalizeTranscript(
  input: string,
  language: SupportedLanguage,
): string {
  if (!input?.trim()) return "";

  let text = input.trim();

  // 1. Normalize unicode whitespace and punctuation
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, ""); // zero-width chars
  text = text.replace(/\s+/g, " ");

  // 2. Remove common STT filler words (language-aware)
  if (language === "en" || language === "unknown") {
    text = text.replace(/\b(um|uh|hmm|like|you know|basically|actually|so like)\b/gi, "");
  }
  if (language === "hi" || language === "unknown") {
    text = text.replace(/\b(matlab|arey|haan|ji)\b/gi, (match) => {
      // Keep "ji" and "haan" as they can be meaningful responses
      if (match.toLowerCase() === "ji" || match.toLowerCase() === "haan") return match;
      return "";
    });
  }

  // 3. Remove consecutive repeated words (STT echo artifact)
  // "fever fever fever" → "fever"
  text = text.replace(/\b(\w+)(\s+\1){2,}\b/gi, "$1");

  // 4. Normalize common STT misinterpretations for clinical terms
  const STT_CORRECTIONS: Record<string, string> = {
    "body temperature": "fever",
    "throwing up": "vomiting",
    "tummy ache": "stomach pain",
    "can't breathe": "difficulty breathing",
    "hard to breathe": "difficulty breathing",
  };

  const lowerText = text.toLowerCase();
  for (const [sttPhrase, correction] of Object.entries(STT_CORRECTIONS)) {
    if (lowerText.includes(sttPhrase)) {
      text = text.replace(new RegExp(sttPhrase, "gi"), correction);
    }
  }

  // 5. Clean up double spaces and trailing punctuation artifacts
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[.,;:!?]+/, "").trim();

  return text;
}
