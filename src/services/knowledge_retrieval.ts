/**
 * Knowledge Retrieval Service
 *
 * Retrieves medical evidence, research references, and clinical summaries
 * using PubMed search and evidence agents.
 */

import { supabase } from "@/integrations/supabase/client";
import { getCached, setCache } from "@/services/knowledge_cache";

export interface EvidenceCitation {
  title: string;
  source: string;
  year?: number;
  url?: string;
  evidence_strength?: string;
  summary?: string;
}

export interface KnowledgeRetrievalResult {
  citations: EvidenceCitation[];
  evidence_confidence: number;
  source: string;
  cached: boolean;
}

/**
 * Retrieve medical evidence for a clinical query.
 */
export async function retrieveMedicalEvidence(
  query: string,
  opts: { maxResults?: number } = {},
): Promise<KnowledgeRetrievalResult> {
  const maxResults = opts.maxResults ?? 5;

  // Check cache first
  const cached = await getCached<KnowledgeRetrievalResult>(query, "evidence");
  if (cached.hit && cached.data) {
    return { ...cached.data, cached: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke("evidence-agents", {
      body: { query, max_results: maxResults },
    });

    if (error) {
      console.error("[KnowledgeRetrieval] Evidence agents failed:", error);
      return { citations: [], evidence_confidence: 0, source: "error", cached: false };
    }

    const result: KnowledgeRetrievalResult = {
      citations: (data?.items || data?.citations || []).map((item: any) => ({
        title: item.title || "",
        source: item.source || item.journal || "",
        year: item.year,
        url: item.url || item.source_link || "",
        evidence_strength: item.evidence_strength || "unknown",
        summary: item.summary || "",
      })),
      evidence_confidence: data?.confidence || 0.5,
      source: "evidence_agents",
      cached: false,
    };

    // Cache for 12 hours
    setCache(query, "evidence", result, 12);
    return result;
  } catch (e) {
    console.error("[KnowledgeRetrieval] Error:", e);
    return { citations: [], evidence_confidence: 0, source: "error", cached: false };
  }
}

/**
 * Retrieve PubMed research references.
 */
export async function retrieveResearchReferences(
  query: string,
  maxResults = 5,
): Promise<EvidenceCitation[]> {
  try {
    const { data, error } = await supabase.functions.invoke("pubmed-search", {
      body: { query, max_results: maxResults },
    });

    if (error || !data?.articles) return [];

    return (data.articles || []).map((a: any) => ({
      title: a.title || "",
      source: a.journal || "PubMed",
      year: a.year,
      url: a.url || "",
      evidence_strength: "peer_reviewed",
      summary: a.abstract?.substring(0, 200) || "",
    }));
  } catch {
    return [];
  }
}
