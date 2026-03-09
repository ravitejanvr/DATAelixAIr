/**
 * Evidence Ingestion Pipeline
 * 
 * Manages the retrieval and caching of clinical evidence
 * from external sources (PubMed, guidelines DB, OpenFDA).
 * 
 * Wraps existing edge functions (pubmed-search, fetch-research,
 * clinical-knowledge) into a unified evidence interface.
 */

import { supabase } from "@/integrations/supabase/client";

export interface EvidenceItem {
  source: "pubmed" | "guideline_db" | "openfda" | "platform";
  title: string;
  summary: string;
  url: string | null;
  year: number | null;
  relevance_score: number; // 0-1
  evidence_strength: "strong" | "moderate" | "limited" | "unknown";
}

export interface EvidenceQueryResult {
  query: string;
  items: EvidenceItem[];
  total_found: number;
  queried_at: string;
}

/**
 * Query multiple evidence sources in parallel.
 */
export async function queryEvidence(
  query: string,
  opts: { maxResults?: number; sources?: string[] } = {}
): Promise<EvidenceQueryResult> {
  const maxResults = opts.maxResults ?? 5;
  console.log(`[KnowledgeIngestion] Querying: "${query}" (max: ${maxResults})`);

  const items: EvidenceItem[] = [];

  // Fetch from PubMed via existing edge function
  try {
    const { data } = await supabase.functions.invoke("pubmed-search", {
      body: { query, maxResults },
    });
    if (data?.results) {
      data.results.forEach((r: any) => {
        items.push({
          source: "pubmed",
          title: r.title || "",
          summary: r.abstract || "",
          url: r.url || `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}`,
          year: r.year ? parseInt(r.year) : null,
          relevance_score: 0.5,
          evidence_strength: "unknown",
        });
      });
    }
  } catch (err) {
    console.warn("[KnowledgeIngestion] PubMed query failed:", err);
  }

  // Fetch from platform evidence_sources table
  try {
    const { data: platformEvidence } = await supabase
      .from("evidence_sources")
      .select("*")
      .textSearch("summary", query.split(" ").slice(0, 3).join(" & "))
      .limit(maxResults);

    if (platformEvidence) {
      platformEvidence.forEach((e) => {
        items.push({
          source: "platform",
          title: e.title,
          summary: e.summary,
          url: e.source_link || null,
          year: e.year,
          relevance_score: 0.7,
          evidence_strength: e.evidence_strength as EvidenceItem["evidence_strength"],
        });
      });
    }
  } catch (err) {
    console.warn("[KnowledgeIngestion] Platform evidence query failed:", err);
  }

  return {
    query,
    items,
    total_found: items.length,
    queried_at: new Date().toISOString(),
  };
}
