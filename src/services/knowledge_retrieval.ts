/**
 * @deprecated DO NOT USE — replaced by knowledge_ingestion/client.ts (queryEvidence)
 * This file is a legacy knowledge retrieval module. Use `queryEvidence` from `@/services/knowledge_ingestion` directly.
 * Scheduled for removal in next cleanup phase.
 *
 * Knowledge Retrieval Service — LEGACY
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
    // Use pubmed-search for general evidence retrieval (evidence-agents requires medications array)
    const { data, error } = await supabase.functions.invoke("pubmed-search", {
      body: { query, max_results: maxResults },
    });

    if (error) {
      console.error("[KnowledgeRetrieval] PubMed search failed:", error);
      return { citations: [], evidence_confidence: 0, source: "error", cached: false };
    }

    const result: KnowledgeRetrievalResult = {
      citations: (data?.articles || data?.items || []).map((item: any) => ({
        title: item.title || "",
        source: item.journal || item.source || "PubMed",
        year: item.year,
        url: item.url || item.source_link || "",
        evidence_strength: item.evidence_strength || "peer_reviewed",
        summary: item.abstract?.substring(0, 200) || item.summary || "",
      })),
      evidence_confidence: data?.confidence || 0.5,
      source: "pubmed",
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
