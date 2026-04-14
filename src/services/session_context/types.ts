/**
 * Session Context Types — V4 Interaction Layer
 *
 * Defines the contract for stateful clinical context accumulation
 * across multiple interaction turns.
 */

import type { CanonicalFeature } from "../canonical/types";
import type { PipelineVitals, PipelineLabResult } from "../pipeline/types";

/** Source tracking for every data point */
export type DataSource = "patient_voice" | "patient_text" | "question_answer" | "file_upload" | "clinician" | "vitals_device";

/** A tracked canonical feature with source provenance */
export interface TrackedFeature {
  feature: CanonicalFeature;
  source: DataSource;
  added_at: string;
  turn_index: number;
}

/** An uploaded file reference */
export interface UploadedFile {
  file_id: string;
  file_name: string;
  file_type: "pdf" | "image" | "lab_report" | "other";
  extracted_text?: string;
  extracted_labs?: PipelineLabResult[];
  uploaded_at: string;
}

/** Snapshot of accumulated session state */
export interface SessionSnapshot {
  features: TrackedFeature[];
  vitals: PipelineVitals | null;
  medications: string[];
  allergies: string[];
  medical_history: string[];
  family_history: string[];
  lab_results: PipelineLabResult[];
  patient_age: number | null;
  patient_sex: string | null;
  patient_name: string | null;
  files: UploadedFile[];
  answered_question_ids: Set<string>;
  turn_count: number;
  started_at: string;
  last_updated: string;
}
