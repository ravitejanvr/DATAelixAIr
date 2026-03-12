/**
 * Clinical Pipeline Orchestrator — O2 Delegation Adapter
 *
 * This file previously contained the 3-wave canonical pipeline.
 * It now delegates to the v4 Wave Orchestrator (O1) while
 * preserving the existing API surface for benchmark_v5.ts
 * and any other consumers.
 *
 * Legacy types (MergedContextObject → ClinicalPipelineResult) are
 * preserved and adapted from O1's PipelineResult.
 */

import type { MergedContextObject } from "@/services/context_service";
import { logPipelineExecution, validateContextObject } from "@/services/context_service";
import { runUnifiedClinicalPipeline as runO1Pipeline, type PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import { toClinicalContext, fromMergedContext } from "@/types/clinical-context";
import { setFeatureFlag } from "@/services/feature_flags";

// ── Legacy Types (preserved for backward compatibility) ──

export interface ClinicalPipelineResult {
  ddx_candidates: any;
  knowledge: any;
  recommended_labs: Array<{ test_name: string; priority: string; differentiates: string[] }>;
  recommended_medications: any;
  guidelines: any;
  safety_alerts: any;
  confidence_scores: any;
  soap_draft: any;
  latency: {
    wave1_ms: number;
    wave2_ms: number;
    wave3_ms: number;
    total_ms: number;
  };
  validation_errors: string[];
  // O1 enrichment fields (available when delegated)
  o1_result?: PipelineResult;
}

// ── Main Orchestrator (delegates to O1) ──

/**
 * Run the clinical pipeline. This adapter converts the MergedContextObject
 * into O1's PipelineInput format, runs the v4 wave pipeline, and maps
 * the result back to the legacy ClinicalPipelineResult shape.
 */
export async function runClinicalPipeline(
  contextObject: MergedContextObject,
): Promise<ClinicalPipelineResult> {
  const pipelineStart = performance.now();
  const visitId = contextObject.visit_id;

  console.log("[Pipeline-O2] Delegating to v4 Wave Orchestrator (O1)...");

  // Validate context
  const validation = validateContextObject(contextObject);
  if (!validation.valid) {
    console.warn("[Pipeline-O2] Context validation warnings:", validation.errors);
  }

  // Ensure O1 feature flag is on for this invocation
  setFeatureFlag("enable_new_clinical_pipeline", true);

  // Convert MergedContextObject → ClinicalContext for O1
  const unified = fromMergedContext(contextObject);
  const clinicalContext = toClinicalContext(unified);

  try {
    const o1Result = await runO1Pipeline({
      clinical_context: clinicalContext,
      visit_id: contextObject.visit_id,
      clinic_id: contextObject.clinic_id,
      skip_cache: true, // Benchmarks must always run full pipeline
    });

    const totalMs = Math.round(performance.now() - pipelineStart);

    // Map O1 result back to legacy shape
    return {
      ddx_candidates: o1Result.ddx ? {
        diagnoses: o1Result.ddx.differential_diagnoses.map((d: any) => ({
          diagnosis: d.diagnosis_name || d.diagnosis || "",
          probability: d.probability,
          supporting_evidence: d.supporting_symptoms || [],
        })),
        recommended_labs: o1Result.ddx.recommended_labs || [],
        reasoning_traces: o1Result.ddx.reasoning_traces || [],
        organ_systems_active: [],
        raw: o1Result.ddx,
      } : { diagnoses: [], recommended_labs: [], reasoning_traces: [], organ_systems_active: [], raw: null },

      knowledge: o1Result.evidence ? {
        citations: o1Result.evidence.items?.map((i: any) => ({
          title: i.title,
          source: i.source,
          relevance: i.relevance_score,
        })) || [],
        evidence_confidence: 0,
        source: "o1_evidence",
        cached: o1Result.cache_stats.evidence_hit,
      } : { citations: [], evidence_confidence: 0, source: "fallback", cached: false },

      recommended_labs: o1Result.ddx?.recommended_labs?.map((l: any) => ({
        test_name: l.test_name || l,
        priority: l.priority || "recommended",
        differentiates: l.differentiates || [],
      })) || [],

      recommended_medications: {
        suggestions: [],
        safety_score: 100,
        critical_warnings: 0,
        validation: null,
      },

      guidelines: o1Result.guideline_summary ? {
        recommendations: [],
        sources_used: o1Result.guideline_summary.guideline_sources_used,
        compliance_score: o1Result.guideline_summary.guideline_compliance_score,
      } : { recommendations: [], sources_used: [], compliance_score: 0 },

      safety_alerts: {
        alerts: o1Result.oversight?.events || [],
        safety_score: o1Result.oversight?.safety_score || 100,
        critical_count: o1Result.oversight?.events?.filter((e: any) => e.severity === "critical").length || 0,
        high_count: 0,
        passed: (o1Result.oversight?.safety_score || 100) >= 70,
      },

      confidence_scores: o1Result.uncertainty ? {
        confidence_score: o1Result.uncertainty.confidence_score,
        confidence_label: o1Result.uncertainty.confidence_label,
        missing_evidence: o1Result.uncertainty.missing_evidence || [],
        follow_up_questions: [],
        raw: o1Result.uncertainty,
      } : { confidence_score: 0, confidence_label: "Very Uncertain", missing_evidence: [], follow_up_questions: [], raw: null },

      soap_draft: o1Result.hybrid_reasoning ? {
        subjective: (o1Result.hybrid_reasoning as any).soap?.subjective || "",
        objective: (o1Result.hybrid_reasoning as any).soap?.objective || "",
        assessment: (o1Result.hybrid_reasoning as any).soap?.assessment || "",
        plan: (o1Result.hybrid_reasoning as any).soap?.plan || "",
      } : o1Result.soap_fallback ? {
        subjective: o1Result.soap_fallback.soap.subjective,
        objective: o1Result.soap_fallback.soap.objective,
        assessment: o1Result.soap_fallback.soap.assessment,
        plan: o1Result.soap_fallback.soap.plan,
      } : { subjective: "", objective: "", assessment: "", plan: "" },

      latency: {
        wave1_ms: o1Result.wave_latencies.wave1_context || 0,
        wave2_ms: o1Result.wave_latencies.wave2_analysis || 0,
        wave3_ms: o1Result.wave_latencies.wave3_reasoning || 0,
        total_ms: totalMs,
      },

      validation_errors: validation.errors,
      o1_result: o1Result,
    };
  } catch (error) {
    const totalMs = Math.round(performance.now() - pipelineStart);
    console.error("[Pipeline-O2] O1 delegation failed:", error);
    await logPipelineExecution(visitId, "o2_delegation", "failed", totalMs, String(error));

    // Return safe empty result
    return {
      ddx_candidates: { diagnoses: [], recommended_labs: [], reasoning_traces: [], organ_systems_active: [], raw: null },
      knowledge: { citations: [], evidence_confidence: 0, source: "fallback", cached: false },
      recommended_labs: [],
      recommended_medications: { suggestions: [], safety_score: 100, critical_warnings: 0, validation: null },
      guidelines: { recommendations: [], sources_used: [], compliance_score: 0 },
      safety_alerts: { alerts: [], safety_score: 100, critical_count: 0, high_count: 0, passed: true },
      confidence_scores: { confidence_score: 0, confidence_label: "Very Uncertain", missing_evidence: [], follow_up_questions: [], raw: null },
      soap_draft: { subjective: "", objective: "", assessment: "", plan: "" },
      latency: { wave1_ms: 0, wave2_ms: 0, wave3_ms: 0, total_ms: totalMs },
      validation_errors: [...validation.errors, `O1 delegation failed: ${error}`],
    };
  }
}
