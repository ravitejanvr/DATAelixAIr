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

// ────────────────────────────────────────────────────────────────────────────
// Evidence Retrieval Functions
// ────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

export interface EvidenceQuery {
  diagnosis?: string;
  medications?: string[];
  symptoms?: string[];
  patientAge?: number;
  patientSex?: string;
}

export interface EvidenceResponse {
  evidence: EvidenceData;
  error?: string;
}

/**
 * Fetch clinical evidence from the evidence-agents edge function.
 * Returns medication evidence, guidelines, and drug safety data.
 */
export async function fetchClinicalEvidence(
  query: EvidenceQuery
): Promise<EvidenceResponse> {
  const { data, error } = await supabase.functions.invoke("evidence-agents", {
    body: {
      diagnosis: query.diagnosis,
      medications: query.medications || [],
      symptoms: query.symptoms || [],
      patient_age: query.patientAge,
      patient_sex: query.patientSex,
    },
  });

  if (error) {
    console.error("Evidence retrieval error:", error);
    return {
      evidence: {
        medication_evidence: [],
        guidelines: [],
        drug_safety: [],
        total_citations: 0,
        retrieval_confidence: "low",
        sources_queried: [],
        timestamp: new Date().toISOString(),
      },
      error: error.message,
    };
  }

  return {
    evidence: data || {
      medication_evidence: [],
      guidelines: [],
      drug_safety: [],
      total_citations: 0,
      retrieval_confidence: "low",
      sources_queried: [],
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Format a citation for display.
 */
export function formatCitation(citation: Citation): string {
  const parts: string[] = [];
  if (citation.title) parts.push(citation.title);
  if (citation.source) parts.push(`(${citation.source})`);
  if (citation.year) parts.push(citation.year);
  if (citation.pmid) parts.push(`PMID: ${citation.pmid}`);
  return parts.join(" ");
}

/**
 * Get the URL for a citation (PubMed or DOI).
 */
export function getCitationUrl(citation: Citation): string | null {
  if (citation.url) return citation.url;
  if (citation.pmid) return `https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}/`;
  if (citation.doi) return `https://doi.org/${citation.doi}`;
  return null;
}

/**
 * Check if evidence data has any safety concerns.
 */
export function hasEvidenceSafetyAlerts(evidence: EvidenceData): boolean {
  return evidence.drug_safety.some(
    (ds) => ds.black_box_warning || ds.high_risk_flags.length > 0
  );
}

/**
 * Get a summary of evidence sources queried.
 */
export function getEvidenceSourcesSummary(evidence: EvidenceData): string {
  const sources = evidence.sources_queried;
  if (sources.length === 0) return "No sources queried";
  if (sources.length <= 3) return sources.join(", ");
  return `${sources.slice(0, 3).join(", ")} +${sources.length - 3} more`;
}
