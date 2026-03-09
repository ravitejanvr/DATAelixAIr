/**
 * Evidence Ingestion Pipeline Client
 * 
 * Wraps the fetch-medical-updates edge function for
 * triggering and querying ingested medical evidence.
 */

import { supabase } from "@/integrations/supabase/client";

export type IngestionPipeline = "drug_alerts" | "guidelines" | "literature" | "all";

export interface IngestionResult {
  success: boolean;
  pipeline: string;
  results: Record<string, any>;
  errors: string[];
}

/**
 * Trigger the evidence ingestion pipeline.
 */
export async function triggerIngestion(
  pipeline: IngestionPipeline = "all",
  maxResults = 10
): Promise<IngestionResult> {
  const { data, error } = await supabase.functions.invoke("fetch-medical-updates", {
    body: { pipeline, max_results: maxResults },
  });

  if (error) {
    console.error("[IngestionClient] Error:", error);
    return { success: false, pipeline, results: {}, errors: [error.message] };
  }

  return data as IngestionResult;
}

/**
 * Query ingested medical evidence by keywords.
 */
export async function queryMedicalEvidence(
  query: string,
  opts: { limit?: number; source?: string; category?: string } = {}
) {
  let q = supabase
    .from("medical_evidence")
    .select("*")
    .order("ingested_at", { ascending: false })
    .limit(opts.limit ?? 20);

  if (opts.source) q = q.eq("source", opts.source);
  if (opts.category) q = q.eq("relevance_category", opts.category);

  // Simple keyword search in title
  if (query) {
    q = q.ilike("title", `%${query}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[IngestionClient] Query failed:", error);
    return [];
  }
  return data || [];
}

/**
 * Get active drug safety alerts.
 */
export async function getActiveDrugAlerts(drugName?: string) {
  let q = supabase
    .from("drug_safety_updates")
    .select("*")
    .eq("is_active", true)
    .order("ingested_at", { ascending: false })
    .limit(50);

  if (drugName) {
    q = q.or(`drug_name.ilike.%${drugName}%,generic_name.ilike.%${drugName}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[IngestionClient] Drug alerts query failed:", error);
    return [];
  }
  return data || [];
}

/**
 * Get latest guideline updates.
 */
export async function getGuidelineUpdates(
  opts: { organization?: string; country?: string; specialty?: string } = {}
) {
  let q = supabase
    .from("guideline_updates")
    .select("*")
    .eq("is_active", true)
    .order("ingested_at", { ascending: false })
    .limit(30);

  if (opts.organization) q = q.eq("source_organization", opts.organization);
  if (opts.country) q = q.eq("country", opts.country);
  if (opts.specialty) q = q.eq("specialty", opts.specialty);

  const { data, error } = await q;
  if (error) {
    console.warn("[IngestionClient] Guidelines query failed:", error);
    return [];
  }
  return data || [];
}
