/**
 * Guideline Alignment Engine
 * 
 * Cross-references AI-generated recommendations against trusted
 * clinical guidelines (WHO, NICE, ADA, ICMR, etc.).
 * 
 * Wraps the existing guideline-compliance edge function and adds
 * structured alignment scoring for the new pipeline.
 */

import { supabase } from "@/integrations/supabase/client";

export interface GuidelineMatch {
  guideline_id: string;
  title: string;
  source_organization: string;
  evidence_grade: string;
  alignment: "aligned" | "supported" | "review_suggested" | "contradicted";
  relevant_text: string;
  year: number;
}

export interface GuidelineAlignmentResult {
  matches: GuidelineMatch[];
  overall_alignment_score: number; // 0-100
  unmatched_recommendations: string[];
  evaluated_at: string;
}

/**
 * Evaluate recommendations against stored clinical guidelines.
 * 
 * Uses the existing guideline-compliance edge function under the hood.
 */
export async function evaluateGuidelineAlignment(
  recommendations: {
    diagnosis?: string;
    drugs?: string[];
    labs?: string[];
    care_plan?: string;
  },
  context: import("@/services/clinical_context").EnrichedClinicalContext
): Promise<GuidelineAlignmentResult> {
  console.log("[GuidelineEngine] Evaluating alignment for visit:", context.visit_id);

  try {
    const { data, error } = await supabase.functions.invoke("guideline-compliance", {
      body: {
        clinical_context: context.core,
        diagnosis: recommendations.diagnosis || "",
        drugs: recommendations.drugs || [],
        labs: recommendations.labs || [],
        care_plan: recommendations.care_plan || "",
      },
    });

    if (error) throw error;

    // Map edge function response to our structured format
    const matches: GuidelineMatch[] = (data?.guidelines || []).map((g: any) => ({
      guideline_id: g.id || "",
      title: g.title || "",
      source_organization: g.source_organization || "",
      evidence_grade: g.evidence_grade || "unknown",
      alignment: g.alignment || "review_suggested",
      relevant_text: g.recommendation_text || "",
      year: g.year || 0,
    }));

    return {
      matches,
      overall_alignment_score: data?.alignment_score ?? 0,
      unmatched_recommendations: data?.unmatched || [],
      evaluated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[GuidelineEngine] Evaluation failed, returning empty result:", err);
    return {
      matches: [],
      overall_alignment_score: 0,
      unmatched_recommendations: [],
      evaluated_at: new Date().toISOString(),
    };
  }
}
