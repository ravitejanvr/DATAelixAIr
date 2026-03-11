/**
 * Knowledge Cache Layer (v2 — Performance Optimized)
 * 
 * Caches evidence queries, guideline lookups, symptom clusters,
 * and pre-indexed knowledge for sub-10s pipeline latency.
 */

import { supabase } from "@/integrations/supabase/client";

function generateCacheKey(query: string, type: string): string {
  const normalized = query.toLowerCase().trim().split(/\s+/).sort().join("_");
  return `${type}:${normalized}`;
}

/**
 * Generate a stable key from a set of symptoms for cluster caching.
 */
export function generateClusterKey(symptoms: string[]): string {
  return symptoms
    .map(s => s.toLowerCase().trim())
    .sort()
    .join("|");
}

export interface CachedResult<T = any> {
  hit: boolean;
  data: T | null;
  source?: "knowledge_cache" | "reasoning_cache" | "preindexed";
}

/**
 * Try to get a cached result. Returns { hit: true, data } or { hit: false, data: null }.
 */
export async function getCached<T = any>(
  query: string,
  cacheType: string
): Promise<CachedResult<T>> {
  const key = generateCacheKey(query, cacheType);

  try {
    const { data: rows } = await (supabase as any)
      .from("knowledge_cache")
      .select("result_data, id, hit_count")
      .eq("cache_key", key)
      .eq("cache_type", cacheType)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (rows) {
      // Increment hit count (non-blocking)
      (supabase as any)
        .from("knowledge_cache")
        .update({ hit_count: (rows.hit_count || 0) + 1 })
        .eq("id", rows.id)
        .then(() => {});

      return { hit: true, data: rows.result_data as T, source: "knowledge_cache" };
    }
  } catch {
    // Cache miss on error
  }

  return { hit: false, data: null };
}

/**
 * Store a result in the cache with a TTL (default 24 hours).
 */
export async function setCache(
  query: string,
  cacheType: string,
  resultData: any,
  ttlHours: number = 24
): Promise<void> {
  const key = generateCacheKey(query, cacheType);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  try {
    await (supabase as any).from("knowledge_cache").upsert(
      {
        cache_key: key,
        cache_type: cacheType,
        query_text: query,
        result_data: resultData,
        hit_count: 0,
        expires_at: expiresAt,
      },
      { onConflict: "cache_key,cache_type" }
    );
  } catch {
    // Non-blocking
  }
}

// ── Reasoning Cache (symptom cluster memoization) ──

/**
 * Check reasoning cache for a symptom cluster.
 */
export async function getReasoningCache<T = any>(
  symptoms: string[]
): Promise<CachedResult<T>> {
  if (symptoms.length === 0) return { hit: false, data: null };

  const clusterKey = generateClusterKey(symptoms);

  try {
    const { data } = await (supabase as any)
      .from("reasoning_cache")
      .select("reasoning_output, id, hit_count")
      .eq("cluster_key", clusterKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (data) {
      // Non-blocking hit count increment
      (supabase as any)
        .from("reasoning_cache")
        .update({ hit_count: (data.hit_count || 0) + 1 })
        .eq("id", data.id)
        .then(() => {});

      return { hit: true, data: data.reasoning_output as T, source: "reasoning_cache" };
    }
  } catch {
    // Cache miss
  }

  return { hit: false, data: null };
}

/**
 * Store reasoning result for a symptom cluster.
 */
export async function setReasoningCache(
  symptoms: string[],
  output: any,
  confidenceScore: number = 0,
  ttlHours: number = 24
): Promise<void> {
  if (symptoms.length === 0) return;

  const clusterKey = generateClusterKey(symptoms);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  try {
    await (supabase as any).from("reasoning_cache").upsert(
      {
        cluster_key: clusterKey,
        cluster_symptoms: symptoms.map(s => s.toLowerCase().trim()),
        reasoning_output: output,
        confidence_score: confidenceScore,
        hit_count: 0,
        ttl_hours: ttlHours,
        expires_at: expiresAt,
      },
      { onConflict: "cluster_key" }
    );
  } catch {
    // Non-blocking
  }
}

// ── Pre-indexed Knowledge Lookup ──

export interface PreindexedKnowledge {
  condition_key: string;
  condition_name: string;
  treatment_options: any[];
  recommended_tests: any[];
  guideline_citations: any[];
  safety_considerations: any[];
  evidence_grade: string;
  source_authorities: string[];
  symptom_clusters: string[];
}

/**
 * Fast lookup for pre-indexed common conditions.
 * Returns null if condition not pre-indexed (fallback to real-time retrieval).
 */
export async function getPreindexedKnowledge(
  conditionKey: string
): Promise<CachedResult<PreindexedKnowledge>> {
  const normalized = conditionKey.toLowerCase().trim().replace(/\s+/g, "_");

  try {
    const { data } = await (supabase as any)
      .from("preindexed_knowledge")
      .select("*")
      .eq("condition_key", normalized)
      .maybeSingle();

    if (data) {
      return { hit: true, data: data as PreindexedKnowledge, source: "preindexed" };
    }
  } catch {
    // Miss
  }

  return { hit: false, data: null };
}

/**
 * Search pre-indexed knowledge by symptom overlap.
 * Returns conditions whose symptom_clusters intersect with the given symptoms.
 */
export async function searchPreindexedBySymptoms(
  symptoms: string[],
  limit: number = 5
): Promise<PreindexedKnowledge[]> {
  if (symptoms.length === 0) return [];

  const normalized = symptoms.map(s => s.toLowerCase().trim());

  try {
    const { data } = await (supabase as any)
      .from("preindexed_knowledge")
      .select("*")
      .overlaps("symptom_clusters", normalized)
      .order("prevalence_tier", { ascending: true }) // very_common first
      .limit(limit);

    return (data || []) as PreindexedKnowledge[];
  } catch {
    return [];
  }
}
