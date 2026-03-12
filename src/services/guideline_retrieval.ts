/**
 * Guideline Engine Service — Canonical Interface
 *
 * Retrieves clinical guidelines ranked by authority priority
 * for candidate diagnoses from the pipeline.
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
 * Ranks results by authority tier (1 = highest).
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
    // Query guideline_registry for matching conditions
    const { data: guidelines } = await supabase
      .from("guideline_registry")
      .select("*")
      .eq("is_active", true)
      .order("tier", { ascending: true });

    if (!guidelines || guidelines.length === 0) {
      return { recommendations: [], sources_used: [], compliance_score: 0 };
    }

    // Match guidelines to diagnoses (case-insensitive keyword overlap)
    const matched: GuidelineRecommendation[] = [];
    const normalizedDx = diagnosisNames.map(d => d.toLowerCase());

    for (const g of guidelines) {
      const conditionMatch = normalizedDx.some(dx =>
        g.condition.toLowerCase().includes(dx) || dx.includes(g.condition.toLowerCase()),
      );
      const keywordMatch = normalizedDx.some(dx =>
        g.keywords.some((k: string) => dx.includes(k.toLowerCase()) || k.toLowerCase().includes(dx)),
      );

      if (conditionMatch || keywordMatch) {
        matched.push({
          guideline_id: g.id,
          title: g.title,
          organization: g.organization,
          tier: g.tier,
          recommendation: g.recommendation_text,
          evidence_grade: (g as any).evidence_grade || "B",
          recommended_tests: g.applicable_tests || [],
          recommended_treatments: g.applicable_drugs || [],
          contraindications: [],
          for_diagnosis: g.condition,
          guideline_url: g.guideline_url || undefined,
        });
      }
    }

    const sources = [...new Set(matched.map(m => m.organization))];
    const result: GuidelineResult = {
      recommendations: matched.slice(0, 10),
      sources_used: sources,
      compliance_score: matched.length > 0 ? Math.min(1, matched.length * 0.2) : 0,
    };

    setCache(cacheKey, "guideline", result, 6);
    return result;
  } catch (e) {
    console.error("[GuidelineEngine] Error:", e);
    return { recommendations: [], sources_used: [], compliance_score: 0 };
  }
}
