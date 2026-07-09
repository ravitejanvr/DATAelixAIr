/**
 * A7.2 — KG Cluster Binding Hydrator (opt-in, non-mutating)
 *
 * Reads `public.kg_concept_bindings` and returns cluster diagnoses annotated
 * with `canonical_id` / `snomed_id` where available. Pure: does NOT mutate
 * the internal CLUSTER_REGISTRY, so all existing consumers remain unchanged.
 *
 * Usage is gated by `enable_kg_terminology_binding`; today no production
 * caller invokes this — it is used by the A7.3 shadow verifier and by the
 * `kg-bindings-backfill` edge function health check.
 */

import { supabase } from "@/integrations/supabase/client";
import { getAllClusterIds, getClusterDiagnoses, type ClusterDiagnosis } from "./kg_clusters";

export interface HydratedCluster {
  cluster_id: string;
  diagnoses: ClusterDiagnosis[];
}

export interface HydrationReport {
  clusters: HydratedCluster[];
  total_entries: number;
  bound_entries: number;
  unbound_names: string[];
}

export async function hydrateClusterBindings(): Promise<HydrationReport> {
  const clusterIds = getAllClusterIds();
  const allNames = new Set<string>();
  for (const cid of clusterIds) {
    for (const d of getClusterDiagnoses(cid)) allNames.add(d.diagnosis_name.trim().toLowerCase());
  }

  // Bulk fetch bindings — single round-trip.
  const { data } = await supabase
    .from("kg_concept_bindings")
    .select("diagnosis_name, canonical_id, snomed_id")
    .in("diagnosis_name", Array.from(allNames));

  const bindingMap = new Map<string, { canonical_id: string | null; snomed_id: string | null }>();
  for (const row of data ?? []) {
    bindingMap.set(row.diagnosis_name, {
      canonical_id: row.canonical_id ?? null,
      snomed_id: row.snomed_id ?? null,
    });
  }

  const clusters: HydratedCluster[] = [];
  const unboundNames = new Set<string>();
  let total = 0;
  let bound = 0;

  for (const cid of clusterIds) {
    const annotated = getClusterDiagnoses(cid).map((d) => {
      total += 1;
      const key = d.diagnosis_name.trim().toLowerCase();
      const b = bindingMap.get(key);
      if (b?.canonical_id) {
        bound += 1;
        return { ...d, canonical_id: b.canonical_id, snomed_id: b.snomed_id ?? undefined };
      }
      unboundNames.add(d.diagnosis_name);
      return { ...d };
    });
    clusters.push({ cluster_id: cid, diagnoses: annotated });
  }

  return {
    clusters,
    total_entries: total,
    bound_entries: bound,
    unbound_names: Array.from(unboundNames).sort(),
  };
}
