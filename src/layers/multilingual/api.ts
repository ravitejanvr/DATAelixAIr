/**
 * Layer 3: Multilingual Processing API
 * 
 * Handles the full multilingual clinical transcript pipeline:
 *   1. Speech Recognition (ElevenLabs Scribe v2)
 *   2. Language Detection (lexicon-based + AI confirmation)
 *   3. Clinical Vocabulary Normalization (regional_lexicon table)
 *   4. Transcript Stabilization (Gemini, temp 0.1)
 *   5. Translation (clinical text to Hindi/Telugu)
 *   6. Patient-friendly explanations
 * 
 * Pipeline Flow:
 *   Raw Audio
 *     → ElevenLabs Scribe v2 (Speech-to-Text)
 *     → normalize-transcript (lexicon lookup, language detection)
 *     → stabilize-transcript (AI stabilization with lexicon context)
 *     → Doctor review & edit
 *     → [optional] translate-clinical
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase Edge Functions, regional_lexicon table
 *   - ElevenLabs Scribe v2: Speech recognition
 *   - Lovable AI (Gemini): Stabilization, translation
 * 
 * Consumers:
 *   - Layer 1 (UI): Voice recorder, translation buttons
 *   - Layer 4 (AI Agents): Stabilized transcript as input
 * 
 * Rules:
 *   - If word unclear: mark with [?]
 *   - Never guess silently
 *   - Never translate during stabilization
 *   - Telugu/Hindi/Urdu logic separated from RAG logic
 *   - Lexicon is doctor-updateable via platform admin
 */

export type TranslationLanguage = "english" | "hindi" | "telugu" | "urdu";
export type ExplanationLanguage = "english" | "telugu";

export const SUPPORTED_LANGUAGES: TranslationLanguage[] = ["english", "hindi", "telugu", "urdu"];
export const SUPPORTED_TRANSLATION_LANGUAGES: TranslationLanguage[] = ["english", "hindi", "telugu"];
export const SUPPORTED_EXPLANATION_LANGUAGES: ExplanationLanguage[] = ["english", "telugu"];

/** Categories for lexicon entries */
export const LEXICON_CATEGORIES = ["symptom", "diagnosis", "medication", "procedure", "anatomy", "general"] as const;
export type LexiconCategory = typeof LEXICON_CATEGORIES[number];

/** Shape of a normalization result from the pipeline */
export interface NormalizationMatch {
  original: string;
  clinical: string;
  category: string;
  language: string;
}

/** Full result from the stabilize-transcript edge function */
export interface StabilizationResult {
  stabilized_transcript: string;
  original_transcript: string;
  normalization_results: NormalizationMatch[];
  detected_languages: string[];
  match_count: number;
}

/**
 * Pipeline architecture diagram:
 * 
 *  ┌────────────────────────┐
 *  │ Raw Audio (mic/file)   │
 *  └──────────┬─────────────┘
 *             │
 *  ┌──────────▼─────────────┐
 *  │ ElevenLabs Scribe v2   │  Speech → Text (multilingual)
 *  │ (Edge: scribe-token)   │
 *  └──────────┬─────────────┘
 *             │ raw_transcript
 *  ┌──────────▼─────────────┐
 *  │ stabilize-transcript   │  Lexicon lookup + AI stabilization
 *  │ (Edge Function)        │
 *  │  ├─ regional_lexicon   │  DB: phrase → clinical_term
 *  │  ├─ Language detection  │  From matched lexicon entries
 *  │  └─ Gemini (temp 0.1)  │  Conservative cleanup
 *  └──────────┬─────────────┘
 *             │ stabilized_transcript + normalization_results
 *  ┌──────────▼─────────────┐
 *  │ Doctor Review & Edit   │  Human-in-the-loop (mandatory)
 *  └──────────┬─────────────┘
 *             │ confirmed_transcript
 *             ├─────────────────────────────────┐
 *  ┌──────────▼─────────────┐      ┌───────────▼──────────┐
 *  │ AI Agents (Layer 4)    │      │ translate-clinical   │
 *  │ Extract → Safety       │      │ (optional)           │
 *  │ → SOAP generation      │      │                      │
 *  └────────────────────────┘      └──────────────────────┘
 */
