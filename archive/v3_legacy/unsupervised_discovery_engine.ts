/**
 * Unsupervised Discovery Engine — Cognitive Layer
 *
 * Detects novel symptom clusters and emerging patterns across clinic
 * consultations using frequency-based co-occurrence analysis.
 *
 * Runs asynchronously post-consultation. Does NOT modify diagnostic
 * probabilities — only surfaces patterns for clinician awareness.
 *
 * Methods:
 *   1. Symptom co-occurrence frequency analysis
 *   2. Novel cluster detection (symptom sets not mapping to known diagnoses)
 *   3. Temporal trend detection (rising symptom combinations)
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface SymptomCluster {
  cluster_id: string;
  symptom_set: string[];
  patient_count: number;
  associated_diagnoses: Array<{ diagnosis: string; count: number }>;
  is_novel: boolean;
  alert_level: "none" | "watch" | "elevated" | "outbreak";
  first_detected: string;
  last_updated: string;
}

export interface DiscoveryResult {
  clusters_found: number;
  novel_clusters: number;
  clusters: SymptomCluster[];
  execution_ms: number;
}

// ── Internals ──

function generateClusterId(symptoms: string[]): string {
  return symptoms
    .map(s => s.toLowerCase().trim())
    .sort()
    .join("|");
}

function alertLevelFromCount(count: number, daySpan: number): "none" | "watch" | "elevated" | "outbreak" {
  const rate = daySpan > 0 ? count / daySpan : count;
  if (rate >= 3) return "outbreak";
  if (rate >= 1.5) return "elevated";
  if (count >= 5) return "watch";
  return "none";
}

// ── Public API ──

/**
 * Analyze recent episodic cases to detect symptom co-occurrence clusters.
 * Target: runs async, no latency constraint.
 */
export async function discoverSymptomClusters(
  clinicId: string,
  lookbackDays = 30,
  minCooccurrence = 3,
  minClusterSize = 2,
): Promise<DiscoveryResult> {
  const start = performance.now();

  try {
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();

    // Fetch recent cases
    const { data: cases, error } = await supabase
      .from("episodic_case_memory" as any)
      .select("symptom_vector, final_diagnosis, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error || !cases || (cases as any[]).length === 0) {
      return { clusters_found: 0, novel_clusters: 0, clusters: [], execution_ms: performance.now() - start };
    }

    // Build symptom pair co-occurrence counts
    const pairCounts = new Map<string, { count: number; diagnoses: Map<string, number>; firstSeen: string; lastSeen: string }>();

    for (const c of cases as any[]) {
      const symptoms: string[] = (c.symptom_vector || []).map((s: string) => s.toLowerCase().trim());
      if (symptoms.length < minClusterSize) continue;

      // Generate all pairs (and triples for small sets)
      const combos: string[][] = [];
      for (let i = 0; i < symptoms.length; i++) {
        for (let j = i + 1; j < symptoms.length; j++) {
          combos.push([symptoms[i], symptoms[j]]);
          // Add triples for richer clustering
          if (symptoms.length <= 6) {
            for (let k = j + 1; k < symptoms.length; k++) {
              combos.push([symptoms[i], symptoms[j], symptoms[k]]);
            }
          }
        }
      }

      for (const combo of combos) {
        const key = generateClusterId(combo);
        const entry = pairCounts.get(key) || {
          count: 0,
          diagnoses: new Map<string, number>(),
          firstSeen: c.created_at,
          lastSeen: c.created_at,
        };
        entry.count++;
        if (c.final_diagnosis) {
          entry.diagnoses.set(c.final_diagnosis, (entry.diagnoses.get(c.final_diagnosis) || 0) + 1);
        }
        if (c.created_at < entry.firstSeen) entry.firstSeen = c.created_at;
        if (c.created_at > entry.lastSeen) entry.lastSeen = c.created_at;
        pairCounts.set(key, entry);
      }
    }

    // Filter to significant clusters
    const clusters: SymptomCluster[] = [];
    for (const [key, entry] of pairCounts) {
      if (entry.count < minCooccurrence) continue;

      const symptomSet = key.split("|");
      const diagArray = Array.from(entry.diagnoses.entries()).map(([d, c]) => ({ diagnosis: d, count: c }));
      diagArray.sort((a, b) => b.count - a.count);

      const daySpan = Math.max(1, (new Date(entry.lastSeen).getTime() - new Date(entry.firstSeen).getTime()) / 86400000);
      const isNovel = diagArray.length === 0 || (diagArray.length >= 3 && diagArray[0].count < entry.count * 0.4);

      clusters.push({
        cluster_id: key,
        symptom_set: symptomSet,
        patient_count: entry.count,
        associated_diagnoses: diagArray.slice(0, 5),
        is_novel: isNovel,
        alert_level: alertLevelFromCount(entry.count, daySpan),
        first_detected: entry.firstSeen,
        last_updated: entry.lastSeen,
      });
    }

    clusters.sort((a, b) => b.patient_count - a.patient_count);
    const topClusters = clusters.slice(0, 20);

    // Persist significant clusters
    for (const cluster of topClusters) {
      try {
        await supabase
          .from("clustered_symptom_patterns" as any)
          .upsert({
            clinic_id: clinicId,
            cluster_id: cluster.cluster_id,
            symptom_set: cluster.symptom_set,
            patient_count: cluster.patient_count,
            associated_diagnoses: cluster.associated_diagnoses,
            cluster_confidence: cluster.patient_count / (cases as any[]).length,
            discovery_method: "cooccurrence",
            first_detected: cluster.first_detected,
            last_updated: cluster.last_updated,
            alert_level: cluster.alert_level,
            is_novel: cluster.is_novel,
          } as any, { onConflict: "clinic_id,cluster_id" });
      } catch (e) {
        console.warn("[UnsupervisedDiscovery] Persist cluster failed:", e);
      }
    }

    return {
      clusters_found: topClusters.length,
      novel_clusters: topClusters.filter(c => c.is_novel).length,
      clusters: topClusters,
      execution_ms: performance.now() - start,
    };
  } catch (e) {
    console.error("[UnsupervisedDiscovery] Error:", e);
    return { clusters_found: 0, novel_clusters: 0, clusters: [], execution_ms: performance.now() - start };
  }
}
