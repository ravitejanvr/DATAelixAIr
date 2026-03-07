/**
 * Layer 6: Evidence Retrieval (RAG) API
 * 
 * Provides controlled access to medical evidence sources including
 * PubMed, EuropePMC, OpenFDA, and AI-generated guideline summaries.
 * Max 6 citations per consultation. No hallucinated citations.
 * 
 * Dependencies:
 *   - Layer 10 (Infrastructure): Supabase Edge Functions
 * 
 * Consumers:
 *   - Layer 1 (UI): EvidencePanel component
 *   - Layer 4 (AI Agents): Clinical agent context
 * 
 * Approved Sources:
 *   - PubMed / Europe PMC
 *   - WHO ICD-11
 *   - NICE Guidelines
 *   - RxNorm / RxNav
 *   - OpenFDA
 */

export interface Citation {
  source: string;
  pmid?: string;
  doi?: string;
  title?: string;
  year?: string;
  url?: string;
}

export interface MedicationEvidence {
  drug: string;
  summary: string;
  citations: Citation[];
}

export interface GuidelineRef {
  guidance: string;
  source: string;
  summary_points: string[];
}

export interface DrugSafetyNote {
  drug: string;
  black_box_warning: string | null;
  high_risk_flags: string[];
  citations: Citation[];
}

export interface EvidenceData {
  medication_evidence: MedicationEvidence[];
  guidelines: GuidelineRef[];
  drug_safety: DrugSafetyNote[];
  total_citations: number;
}

export const MAX_CITATIONS_PER_CONSULTATION = 6;
export const APPROVED_SOURCES = ["PubMed", "EuropePMC", "WHO", "NICE", "ICD-11", "RxNorm", "OpenFDA"] as const;
