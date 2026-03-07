/**
 * Layer 6: Evidence Retrieval (RAG) API
 * 
 * Provides controlled access to medical evidence sources including
 * PubMed, EuropePMC, OpenFDA, DailyMed, and AI-generated guideline summaries.
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
 *   - DailyMed (NLM)
 * 
 * Safety Rules:
 *   - Never fabricate citations — every PMID/DOI must come from a real API call
 *   - Evidence assists documentation only — no direct medical advice
 *   - AI summaries must be clearly labeled as AI-generated
 *   - Max 6 citations per consultation to avoid information overload
 *   - Confidence indicators must reflect source quality and recency
 */

export interface Citation {
  source: string;
  pmid?: string;
  doi?: string;
  title?: string;
  year?: string;
  url?: string;
  confidence?: "high" | "moderate" | "low";
}

export interface MedicationEvidence {
  drug: string;
  summary: string;
  ai_generated: boolean;
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
  dailymed_warnings: string[];
  citations: Citation[];
}

export interface EvidenceData {
  medication_evidence: MedicationEvidence[];
  guidelines: GuidelineRef[];
  drug_safety: DrugSafetyNote[];
  total_citations: number;
  retrieval_confidence: "high" | "moderate" | "low";
  sources_queried: string[];
  timestamp: string;
}

export const MAX_CITATIONS_PER_CONSULTATION = 6;
export const APPROVED_SOURCES = ["PubMed", "EuropePMC", "WHO", "NICE", "ICD-11", "RxNorm", "OpenFDA", "DailyMed"] as const;

/** Confidence badge color utility */
export function evidenceConfidenceColor(confidence: string): string {
  if (confidence === "high") return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800";
  if (confidence === "moderate") return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800";
  return "text-muted-foreground bg-muted/50 border-border";
}
