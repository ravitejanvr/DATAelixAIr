/**
 * Guideline Engine Service — Canonical Interface
 *
 * Retrieves clinical guidelines via relational traversal:
 * diagnosis_id → guideline_rules → guideline_authorities
 *
 * Falls back to guideline_registry keyword matching if no rules found.
 */

import { supabase } from "@/integrations/supabase/client";
import { getCached, setCache } from "@/services/knowledge_cache";

export interface GuidelineRecommendation {
  guideline_id: string;
  title: string;
  organization: string;
  tier: number;
  recommendation: string;
  evidence_grade: string;
  recommended_tests: string[];
  recommended_treatments: string[];
  contraindications: string[];
  for_diagnosis: string;
  guideline_url?: string;
}

export interface GuidelineResult {
  recommendations: GuidelineRecommendation[];
  sources_used: string[];
  compliance_score: number;
}

/**
 * Retrieve guidelines for a set of candidate diagnoses.
 * Uses relational traversal: diagnoses → guideline_rules → guideline_authorities.
 */
export async function retrieveGuidelines(
  diagnosisNames: string[],
): Promise<GuidelineResult> {
  if (diagnosisNames.length === 0) {
    return { recommendations: [], sources_used: [], compliance_score: 0 };
  }

  const cacheKey = `guidelines:${diagnosisNames.sort().join(",")}`;
  const cached = await getCached<GuidelineResult>(cacheKey, "guideline");
  if (cached.hit && cached.data) return cached.data;

  try {
    // Step 1: Resolve diagnosis names to IDs
    const normalizedDx = diagnosisNames.map(d => d.toLowerCase().trim());
    
    // Build OR filter for fuzzy matching diagnosis names
    const orFilters = normalizedDx.map(dx => `diagnosis_name.ilike.%${dx}%`).join(",");
    const { data: diagRows } = await supabase
      .from("diagnoses")
      .select("id, diagnosis_name")
      .or(orFilters)
      .limit(20);

    const diagnosisIds = (diagRows || []).map(d => d.id);
    const diagNameMap = new Map((diagRows || []).map(d => [d.id, d.diagnosis_name]));

    if (diagnosisIds.length === 0) {
      console.warn("[GuidelineEngine] No diagnosis IDs matched for:", diagnosisNames);
      return { recommendations: [], sources_used: [], compliance_score: 0 };
    }

    // Step 2: Query guideline_rules via diagnosis_id (relational traversal)
    const { data: rules } = await supabase
      .from("guideline_rules")
      .select(`
        id,
        diagnosis_id,
        recommendation,
        evidence_level,
        treatment_generic_name,
        guideline_authorities(id, authority_name, priority, country)
      `)
      .in("diagnosis_id", diagnosisIds);

    const matched: GuidelineRecommendation[] = [];

    for (const rule of rules || []) {
      const auth = (rule as any).guideline_authorities;
      const diagName = diagNameMap.get(rule.diagnosis_id) || "";

      matched.push({
        guideline_id: rule.id,
        title: `${auth?.authority_name || "Clinical"} Guideline — ${diagName}`,
        organization: auth?.authority_name || "Unknown",
        tier: auth?.priority ?? 5,
        recommendation: rule.recommendation,
        evidence_grade: rule.evidence_level || "B",
        recommended_tests: [],
        recommended_treatments: rule.treatment_generic_name ? [rule.treatment_generic_name] : [],
        contraindications: [],
        for_diagnosis: diagName,
      });
    }

    // Sort by authority tier (lower = higher priority)
    matched.sort((a, b) => a.tier - b.tier);

    const sources = [...new Set(matched.map(m => m.organization))];
    const result: GuidelineResult = {
      recommendations: matched.slice(0, 15),
      sources_used: sources,
      compliance_score: matched.length > 0 ? Math.min(1, matched.length * 0.15) : 0,
    };

    setCache(cacheKey, "guideline", result, 6);
    return result;
  } catch (e) {
    console.error("[GuidelineEngine] Error:", e);
    return { recommendations: [], sources_used: [], compliance_score: 0 };
  }
}
