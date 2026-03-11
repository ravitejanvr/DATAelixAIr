/**
 * Guideline Compliance Engine — Client Service
 * 
 * Cross-references AI-generated recommendations against trusted
 * clinical guidelines (WHO, NICE, ADA, ICMR, IDSA, AHA, ESC).
 * 
 * Authority priority:
 *   1. ICMR (India – national standard)
 *   2. WHO (global)
 *   3. NICE / CDC / Specialty societies (IDSA, AHA, ESC, ADA)
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ──

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

export interface GuidelineCitation {
  guideline_id: string;
  title: string;
  source: string;
  source_organization: string;
  year: number;
  evidence_grade: string;
  recommendation_text: string;
  guideline_url: string;
  tier?: number;
  tier_label?: string;
}

export interface ComplianceResult {
  item: string;
  item_type: "diagnosis" | "medication" | "test" | "care_plan";
  compliance_status: "guideline_aligned" | "evidence_supported" | "review_suggested";
  explanation: string;
  matching_guidelines: GuidelineCitation[];
}

export interface ConflictDetail {
  type: string;
  severity: "low" | "moderate" | "high";
  prescribed_drug: string;
  guideline_recommends: string;
  source: string;
  tier: number;
  condition: string;
  explanation: string;
}

export interface ManagementStep {
  step: string;
  source: string;
  tier: number;
  tier_label: string;
  condition: string;
  evidence_grade: string;
}

export interface GuidelineComplianceResult {
  results: ComplianceResult[];
  compliance_score: number;
  score_breakdown: {
    aligned: number;
    evidence_supported: number;
    review_suggested: number;
    total: number;
  };
  conflicts: ConflictDetail[];
  management_steps: ManagementStep[];
  guidelines_matched: number;
  guidelines_sources: string[];
  authority_tiers_used: string[];
  duration_ms: number;
  evaluated_at: string;
}

// ── Legacy re-export for backward compat ──
export type GuidelineAlignmentResult = GuidelineComplianceResult & {
  matches: GuidelineMatch[];
  overall_alignment_score: number;
  unmatched_recommendations: string[];
  guideline_sources_used: string[];
  guideline_compliance_score: number;
  conflicts_detected: ConflictDetail[];
};

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
  return 10;
}

/**
 * Run guideline compliance check against the guideline-compliance edge function.
 */
export async function checkGuidelineCompliance(params: {
  diagnoses: string[];
  medications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  tests: string[];
  care_plan?: string;
  patient_age?: number;
  patient_sex?: string;
  chief_complaint?: string;
}): Promise<GuidelineComplianceResult | null> {
  console.log("[GuidelineEngine] Running compliance check...");

  try {
    const { data, error } = await supabase.functions.invoke("guideline-compliance", {
      body: {
        diagnoses: params.diagnoses,
        medications: params.medications,
        tests: params.tests,
        care_plan: params.care_plan || "",
        patient_age: params.patient_age,
        patient_sex: params.patient_sex,
        chief_complaint: params.chief_complaint,
      },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Compliance check failed");

    return {
      results: data.results || [],
      compliance_score: data.compliance_score ?? 0,
      score_breakdown: data.score_breakdown || { aligned: 0, evidence_supported: 0, review_suggested: 0, total: 0 },
      conflicts: data.conflicts || [],
      management_steps: data.management_steps || [],
      guidelines_matched: data.guidelines_matched || 0,
      guidelines_sources: data.guidelines_sources || [],
      authority_tiers_used: data.authority_tiers_used || [],
      duration_ms: data.duration_ms || 0,
      evaluated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[GuidelineEngine] Compliance check failed:", err);
    return null;
  }
}

/**
 * Legacy wrapper — evaluateGuidelineAlignment
 * Maps to the new checkGuidelineCompliance under the hood.
 */
export async function evaluateGuidelineAlignment(
  recommendations: {
    diagnosis?: string;
    drugs?: string[];
    labs?: string[];
    care_plan?: string;
  },
  context: { visit_id?: string; core?: any }
): Promise<GuidelineAlignmentResult> {
  const result = await checkGuidelineCompliance({
    diagnoses: recommendations.diagnosis ? [recommendations.diagnosis] : [],
    medications: (recommendations.drugs || []).map(d => ({ drug_name: d, dose: "", frequency: "", duration: "" })),
    tests: recommendations.labs || [],
    care_plan: recommendations.care_plan,
    patient_age: context.core?.age,
    patient_sex: context.core?.sex,
    chief_complaint: context.core?.chief_complaint,
  });

  if (!result) {
    return {
      results: [],
      compliance_score: 0,
      score_breakdown: { aligned: 0, evidence_supported: 0, review_suggested: 0, total: 0 },
      conflicts: [],
      management_steps: [],
      guidelines_matched: 0,
      guidelines_sources: [],
      authority_tiers_used: [],
      duration_ms: 0,
      evaluated_at: new Date().toISOString(),
      matches: [],
      overall_alignment_score: 0,
      unmatched_recommendations: [],
      guideline_sources_used: [],
      guideline_compliance_score: 0,
      conflicts_detected: [],
    };
  }

  // Build legacy matches from results
  const matches: GuidelineMatch[] = result.results.flatMap(r =>
    r.matching_guidelines.map(g => ({
      guideline_id: g.guideline_id,
      title: g.title,
      source_organization: g.source_organization,
      evidence_grade: g.evidence_grade,
      alignment: r.compliance_status === "guideline_aligned" ? "aligned" as const :
                 r.compliance_status === "evidence_supported" ? "supported" as const :
                 "review_suggested" as const,
      relevant_text: g.recommendation_text,
      year: g.year,
      priority: getSourcePriority(g.source_organization),
    }))
  );

  return {
    ...result,
    matches,
    overall_alignment_score: result.compliance_score,
    unmatched_recommendations: [],
    guideline_sources_used: result.guidelines_sources,
    guideline_compliance_score: result.compliance_score,
    conflicts_detected: result.conflicts,
  };
}
