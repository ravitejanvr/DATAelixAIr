/**
 * Guideline Alignment Engine
 * 
 * Cross-references AI-generated recommendations against trusted
 * clinical guidelines (WHO, NICE, ADA, ICMR, etc.).
 * 
 * Priority order:
 *   1. ICMR (India – national standard)
 *   2. WHO (global)
 *   3. NICE (UK)
 *   4. CDC (USA)
 *   5. Specialty societies: IDSA, AHA, ESC, ADA
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
  priority: number;
}

export interface GuidelineAlignmentResult {
  matches: GuidelineMatch[];
  overall_alignment_score: number; // 0-100
  unmatched_recommendations: string[];
  guideline_sources_used: string[];
  guideline_compliance_score: number; // 0-100
  conflicts_detected: ConflictDetail[];
  evaluated_at: string;
}

export interface ConflictDetail {
  recommendation: string;
  conflicting_guideline: string;
  organization: string;
  severity: "low" | "moderate" | "high";
  explanation: string;
}

/** Priority map: lower = higher priority */
const SOURCE_PRIORITY: Record<string, number> = {
  ICMR: 1,
  WHO: 2,
  NICE: 3,
  CDC: 4,
  IDSA: 5,
  AHA: 5,
  ESC: 5,
  ADA: 5,
};

function getSourcePriority(org: string): number {
  const upper = org.toUpperCase();
  for (const [key, val] of Object.entries(SOURCE_PRIORITY)) {
    if (upper.includes(key)) return val;
  }
  return 10; // unknown sources get lowest priority
}

/**
 * Evaluate recommendations against stored clinical guidelines.
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
    const rawMatches: GuidelineMatch[] = (data?.guidelines || []).map((g: any) => ({
      guideline_id: g.id || "",
      title: g.title || "",
      source_organization: g.source_organization || "",
      evidence_grade: g.evidence_grade || "unknown",
      alignment: g.alignment || "review_suggested",
      relevant_text: g.recommendation_text || "",
      year: g.year || 0,
      priority: getSourcePriority(g.source_organization || ""),
    }));

    // Sort by priority (ICMR first, then WHO, etc.)
    const matches = rawMatches.sort((a, b) => a.priority - b.priority);

    // Collect unique sources used
    const guideline_sources_used = [...new Set(matches.map(m => m.source_organization))];

    // Detect conflicts (items marked contradicted or review_suggested)
    const conflicts_detected: ConflictDetail[] = matches
      .filter(m => m.alignment === "contradicted" || m.alignment === "review_suggested")
      .map(m => ({
        recommendation: recommendations.diagnosis || recommendations.drugs?.join(", ") || "",
        conflicting_guideline: m.title,
        organization: m.source_organization,
        severity: m.alignment === "contradicted" ? "high" as const : "moderate" as const,
        explanation: m.relevant_text.substring(0, 200),
      }));

    // Compute compliance score
    const totalItems = matches.length || 1;
    const alignedCount = matches.filter(m => m.alignment === "aligned" || m.alignment === "supported").length;
    const guideline_compliance_score = Math.round((alignedCount / totalItems) * 100);

    return {
      matches,
      overall_alignment_score: data?.alignment_score ?? guideline_compliance_score,
      unmatched_recommendations: data?.unmatched || [],
      guideline_sources_used,
      guideline_compliance_score,
      conflicts_detected,
      evaluated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[GuidelineEngine] Evaluation failed, returning empty result:", err);
    return {
      matches: [],
      overall_alignment_score: 0,
      unmatched_recommendations: [],
      guideline_sources_used: [],
      guideline_compliance_score: 0,
      conflicts_detected: [],
      evaluated_at: new Date().toISOString(),
    };
  }
}
