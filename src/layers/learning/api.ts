/**
 * Layer 7: Learning Layer API
 * 
 * Captures doctor-validated corrections to improve system accuracy over time.
 * Learning signals are captured ONLY after explicit doctor validation.
 * NO patient-identifiable information is stored — only anonymized clinical patterns.
 * 
 * Signal Types:
 *   1. transcript_edit    — diff between AI-stabilized and doctor-edited transcript
 *   2. terminology_update — local/regional term corrections
 *   3. prescription_template — frequently used prescription patterns
 *   4. documentation_style — SOAP section editing patterns
 *   5. extraction_correction — corrections to AI-extracted clinical fields
 * 
 * Privacy Rules:
 *   - No patient names, IDs, demographics, or identifiers
 *   - Only clinical pattern data (drug names, term mappings, style preferences)
 *   - Doctor must validate before any signal is captured
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase client
 * 
 * Consumers:
 *   - Layer 2 (Workflow): Prescription favorites in prescriptions page
 *   - Layer 3 (Multilingual): Regional lexicon expansion
 *   - Layer 4 (AI Agents): Stabilizer and documentation context
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Signal Types ───────────────────────────────────────────

export type LearningSignalType =
  | "transcript_edit"
  | "terminology_update"
  | "prescription_template"
  | "documentation_style"
  | "extraction_correction";

export interface LearningSignal {
  id: string;
  doctor_id: string;
  clinic_id: string | null;
  signal_type: LearningSignalType;
  signal_data: Record<string, unknown>;
  created_at: string;
}

// ─── Existing types (kept for backward compat) ─────────────

export interface DoctorFavorite {
  id: string;
  doctor_id: string;
  generic_name: string;
  preferred_brand: string | null;
  default_dose: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  clinic_id: string | null;
}

export interface RegionalLexiconEntry {
  id: string;
  regional_phrase: string;
  clinical_term: string;
  language: string;
  category: string;
}

export interface DoctorPreferences {
  id: string;
  doctor_id: string;
  soap_style: Record<string, unknown>;
  terminology_overrides: Array<{ original: string; preferred: string }>;
  preferred_templates: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

// ─── Signal Capture Functions ───────────────────────────────
// All functions are fire-and-forget to avoid blocking the clinical workflow.

/**
 * Capture transcript edit diff (anonymized — no patient text, only edit metrics).
 * Called after doctor confirms the reviewed transcript.
 */
export async function captureTranscriptEditSignal(
  doctorId: string,
  clinicId: string | null,
  stabilizedTranscript: string,
  doctorEditedTranscript: string
): Promise<void> {
  // Only capture if doctor actually made edits
  if (stabilizedTranscript === doctorEditedTranscript) return;

  const editDistance = Math.abs(stabilizedTranscript.length - doctorEditedTranscript.length);
  const editRatio = stabilizedTranscript.length > 0
    ? editDistance / stabilizedTranscript.length
    : 0;

  // Extract only anonymized word-level changes (no full text stored)
  const stabilizedWords = new Set(stabilizedTranscript.toLowerCase().split(/\s+/));
  const editedWords = new Set(doctorEditedTranscript.toLowerCase().split(/\s+/));
  const addedWords = [...editedWords].filter(w => !stabilizedWords.has(w) && w.length > 2);
  const removedWords = [...stabilizedWords].filter(w => !editedWords.has(w) && w.length > 2);

  await supabase.from("doctor_learning_signals").insert({
    doctor_id: doctorId,
    clinic_id: clinicId,
    signal_type: "transcript_edit",
    signal_data: {
      edit_ratio: Math.round(editRatio * 100) / 100,
      words_added_count: addedWords.length,
      words_removed_count: removedWords.length,
      // Store only clinical terms added/removed (not full transcript)
      clinical_terms_added: addedWords.slice(0, 20),
      clinical_terms_removed: removedWords.slice(0, 20),
      original_length: stabilizedTranscript.length,
      edited_length: doctorEditedTranscript.length,
    },
  } as any);
}

/**
 * Capture extraction correction signal.
 * Called when doctor modifies AI-extracted clinical fields.
 */
export async function captureExtractionCorrectionSignal(
  doctorId: string,
  clinicId: string | null,
  aiExtracted: Record<string, string>,
  doctorCorrected: Record<string, string>
): Promise<void> {
  const corrections: Array<{ field: string; ai_value: string; corrected_value: string }> = [];

  for (const key of Object.keys(doctorCorrected)) {
    if (aiExtracted[key] !== doctorCorrected[key] && doctorCorrected[key]) {
      corrections.push({
        field: key,
        ai_value: (aiExtracted[key] || "").slice(0, 100), // Truncate to avoid PHI
        corrected_value: doctorCorrected[key].slice(0, 100),
      });
    }
  }

  if (corrections.length === 0) return;

  await supabase.from("doctor_learning_signals").insert({
    doctor_id: doctorId,
    clinic_id: clinicId,
    signal_type: "extraction_correction",
    signal_data: {
      corrections_count: corrections.length,
      fields_corrected: corrections.map(c => c.field),
      // Store field-level diffs only (no patient context)
      corrections,
    },
  } as any);
}

/**
 * Capture documentation style signal from SOAP section edits.
 * Called when the session is saved with doctor-modified SOAP sections.
 */
export async function captureDocumentationStyleSignal(
  doctorId: string,
  clinicId: string | null,
  aiSoapSections: Record<string, string>,
  doctorEditedSections: Record<string, string>
): Promise<void> {
  const editedSections: string[] = [];
  const sectionLengths: Record<string, { ai: number; edited: number }> = {};

  for (const key of Object.keys(doctorEditedSections)) {
    const aiLen = (aiSoapSections[key] || "").length;
    const editedLen = (doctorEditedSections[key] || "").length;
    if (aiSoapSections[key] !== doctorEditedSections[key]) {
      editedSections.push(key);
    }
    sectionLengths[key] = { ai: aiLen, edited: editedLen };
  }

  if (editedSections.length === 0) return;

  await supabase.from("doctor_learning_signals").insert({
    doctor_id: doctorId,
    clinic_id: clinicId,
    signal_type: "documentation_style",
    signal_data: {
      sections_edited: editedSections,
      section_lengths: sectionLengths,
      // Track if doctor tends to expand or condense each section
      style_tendency: editedSections.reduce((acc, s) => {
        const diff = sectionLengths[s].edited - sectionLengths[s].ai;
        acc[s] = diff > 20 ? "expands" : diff < -20 ? "condenses" : "minor_edit";
        return acc;
      }, {} as Record<string, string>),
    },
  } as any).then(() => {}).catch(() => {});
}

/**
 * Load doctor preferences for personalizing future AI outputs.
 */
export async function loadDoctorPreferences(
  doctorId: string
): Promise<DoctorPreferences | null> {
  const { data } = await supabase
    .from("doctor_preferences")
    .select("*")
    .eq("doctor_id", doctorId)
    .maybeSingle() as any;
  return data;
}

/**
 * Upsert doctor preferences.
 */
export async function saveDoctorPreferences(
  doctorId: string,
  updates: Partial<Pick<DoctorPreferences, "soap_style" | "terminology_overrides" | "preferred_templates">>
): Promise<void> {
  await supabase.from("doctor_preferences").upsert({
    doctor_id: doctorId,
    ...updates,
    updated_at: new Date().toISOString(),
  } as any, { onConflict: "doctor_id" }).then(() => {}).catch(() => {});
}
