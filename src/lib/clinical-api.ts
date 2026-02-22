import { supabase } from "@/integrations/supabase/client";

export interface PatientData {
  name: string;
  age: number;
  gender: string;
  conditions?: string[];
  symptoms?: string[];
  ethnicity?: string;
  medications?: string[];
  labValues?: Record<string, string>;
  familyHistory?: string[];
}

export interface ClinicalAssessment {
  summary?: string;
  soap_notes?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  risk_assessment?: {
    primary_risk: string;
    risk_percentage: string;
    risk_factors: string[];
    protective_factors: string[];
  };
  drug_recommendations?: Array<{
    drug: string;
    dosage: string;
    frequency: string;
    rationale: string;
    evidence_level: string;
    interactions: string;
  }>;
  drug_interactions?: Array<{
    drugs: string[];
    severity: string;
    description: string;
  }>;
  citations?: Array<{
    pmid: string;
    title: string;
    relevance: string;
    url: string;
  }>;
  tests_recommended?: string[];
  follow_up?: string;
  icd_codes?: Array<{ code: string; description: string }>;
  guidelines_referenced?: string[];
  disclaimer?: string;
  raw?: boolean;
}

export interface ClinicalAgentResponse {
  assessment: ClinicalAssessment;
  evidence: Array<{
    pmid: string;
    title: string;
    abstract: string;
    year: string;
    url: string;
  }>;
  drugInteractions: string | null;
  timestamp: string;
}

export async function runClinicalAgent(
  patientData: PatientData,
  query: string,
  drugs: string[] = []
): Promise<ClinicalAgentResponse> {
  const { data, error } = await supabase.functions.invoke("clinical-agent", {
    body: { patientData, query, drugs },
  });

  if (error) throw new Error(error.message || "Failed to run clinical agent");
  return data as ClinicalAgentResponse;
}

export async function searchPubMed(query: string) {
  const { data, error } = await supabase.functions.invoke("pubmed-search", {
    body: { query, maxResults: 10 },
  });

  if (error) throw new Error(error.message || "PubMed search failed");
  return data;
}
