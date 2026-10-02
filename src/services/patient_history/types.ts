/**
 * Patient History — cross-visit context shared by both reasoning entry points.
 *
 * Plain structured data, not routed through canonicalize() — matches the existing
 * precedent that medical_history/current_medications/allergies already ride through
 * the pipeline as plain strings end-to-end (see src/services/pipeline/types.ts).
 */

export interface RecentConsultationSummary {
  date: string;
  chief_complaint: string | null;
  summary: string | null;
}

export interface PatientHistorySummary {
  allergies: string[];
  current_medications: string[];
  medical_history: string[];
  recent_consultations: RecentConsultationSummary[];
}
