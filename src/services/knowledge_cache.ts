/**
 * Knowledge Cache Layer
 * 
 * Caches evidence queries, guideline lookups, and symptom clusters
 * to reduce pipeline latency. Uses the knowledge_cache table with TTL.
 */

import { supabase } from "@/integrations/supabase/client";

function generateCacheKey(query: string, type: string): string {
  const normalized = query.toLowerCase().trim().split(/\s+/).sort().join("_");
  return `${type}:${normalized}`;
}

export interface CachedResult<T = any> {
  hit: boolean;
  data: T | null;
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
    const { data, error } = await supabase.rpc("get_knowledge_cache" as any, {
      p_cache_key: key,
      p_cache_type: cacheType,
    });

    // Fallback: direct query with type cast
    if (error || !data) {
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

        return { hit: true, data: rows.result_data as T };
      }
    }

    if (data) {
      return { hit: true, data: data as T };
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
