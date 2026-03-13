/**
 * Knowledge Graph Extraction Client
 *
 * Triggers the automated medical knowledge extraction pipeline
 * that retrieves literature from PubMed, extracts structured
 * relationships via AI, and inserts them into the knowledge graph.
 */

import { supabase } from "@/integrations/supabase/client";

export interface ExtractionInsertCounts {
  symptom_likelihoods: number;
  symptom_physiology_map: number;
  physiology_diagnosis_map: number;
  disease_tests: number;
  disease_treatments: number;
}

export interface DiseaseExtractionResult {
  inserted?: ExtractionInsertCounts;
  rejected?: number;
  skipped?: boolean;
  reason?: string;
  dry_run?: boolean;
  extracted?: Record<string, number>;
}

export interface ExtractionPipelineStat {
  stage: string;
  count: number;
  duration_ms: number;
}

export interface ExtractionPipelineResult {
  success: boolean;
  diseases_processed: number;
  results: Record<string, DiseaseExtractionResult>;
  pipeline_stats: ExtractionPipelineStat[];
  error?: string;
}

/**
 * Run the knowledge extraction pipeline for a set of diseases.
 * Each disease triggers PubMed retrieval → AI extraction → graph insertion.
 */
export async function runKnowledgeExtraction(
  diseases: string[],
  opts: { maxArticles?: number; dryRun?: boolean } = {}
): Promise<ExtractionPipelineResult> {
  const { data, error } = await supabase.functions.invoke("extract-knowledge-graph", {
    body: {
      diseases,
      max_articles: opts.maxArticles ?? 5,
      dry_run: opts.dryRun ?? false,
    },
  });

  if (error) {
    console.error("[KGExtraction] Error:", error);
    return {
      success: false,
      diseases_processed: 0,
      results: {},
      pipeline_stats: [],
      error: error.message,
    };
  }

  return data as ExtractionPipelineResult;
}

/**
 * Get current knowledge graph coverage statistics.
 */
export async function getGraphCoverage(): Promise<{
  symptom_likelihoods: number;
  symptom_physiology: number;
  physiology_diagnosis: number;
  disease_tests: number;
  disease_treatments: number;
  diagnoses: number;
}> {
  const [sl, sp, pd, dt, dtr, diag] = await Promise.all([
    supabase.from("symptom_likelihoods").select("id", { count: "exact", head: true }),
    supabase.from("symptom_physiology_map").select("id", { count: "exact", head: true }),
    supabase.from("physiology_diagnosis_map").select("id", { count: "exact", head: true }),
    supabase.from("disease_tests").select("id", { count: "exact", head: true }),
    supabase.from("disease_treatments").select("id", { count: "exact", head: true }),
    supabase.from("diagnoses").select("id", { count: "exact", head: true }),
  ]);

  return {
    symptom_likelihoods: sl.count ?? 0,
    symptom_physiology: sp.count ?? 0,
    physiology_diagnosis: pd.count ?? 0,
    disease_tests: dt.count ?? 0,
    disease_treatments: dtr.count ?? 0,
    diagnoses: diag.count ?? 0,
  };
}

/**
 * Get diseases that have fewer than N symptom likelihood relationships.
 * These are candidates for extraction.
 */
export async function getUnderconnectedDiseases(
  minRelationships = 5,
  limit = 50
): Promise<string[]> {
  const { data: allDiagnoses } = await supabase
    .from("diagnoses")
    .select("diagnosis_name")
    .limit(500);

  if (!allDiagnoses) return [];

  const { data: covered } = await supabase
    .from("symptom_likelihoods")
    .select("disease_name");

  const coverageMap: Record<string, number> = {};
  for (const row of covered || []) {
    coverageMap[row.disease_name] = (coverageMap[row.disease_name] || 0) + 1;
  }

  return allDiagnoses
    .filter((d) => (coverageMap[d.diagnosis_name.toLowerCase()] || 0) < minRelationships)
    .map((d) => d.diagnosis_name)
    .slice(0, limit);
}
