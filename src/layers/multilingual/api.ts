/**
 * Layer 3: Multilingual Processing API
 * 
 * Handles transcript stabilization, medical text translation (Hindi/Telugu),
 * regional phrase mapping, and patient-friendly summary generation.
 * Uses controlled Telugu lexicon from database (not hardcoded).
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase Edge Functions, regional_lexicon table
 * 
 * Consumers:
 *   - Layer 1 (UI): Voice recorder, translation buttons
 *   - Layer 4 (AI Agents): Stabilized transcript input
 * 
 * Rules:
 *   - If word unclear: mark with "?"
 *   - Never guess silently
 *   - Telugu logic separated from RAG logic
 */

export type TranslationLanguage = "english" | "hindi" | "telugu";
export type ExplanationLanguage = "english" | "telugu";

export const SUPPORTED_TRANSLATION_LANGUAGES: TranslationLanguage[] = ["english", "hindi", "telugu"];
export const SUPPORTED_EXPLANATION_LANGUAGES: ExplanationLanguage[] = ["english", "telugu"];
