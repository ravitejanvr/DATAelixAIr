import { describe, it, expect } from "vitest";
import { o1ResultToV4Reasoning } from "./orchestrator_bridge";
import type { PipelineResult as O1PipelineResult } from "@/services/clinical_pipeline/orchestrator";

/**
 * Regression coverage for the cockpit/conversational rank-divergence bug found
 * in the 2026-09-20 architecture inventory (ROADMAP item 24): the bridge used
 * to source v3Diagnoses from `result.ddx.differential_diagnoses` (the raw,
 * pre-fusion DDX candidate list) instead of `result.bayesian.diagnoses`
 * (fusedBayesian — O1's actual final, priority/evidence-adjusted ranking,
 * which Clinical.tsx's cockpit already uses directly). That let the
 * conversational UI (ClinicalInteraction.tsx / V4) silently re-derive a
 * *different* diagnosis order than the cockpit for the same case, because it
 * was reasoning from an earlier, unprocessed stage of O1's own pipeline.
 */
function o1ResultOf(overrides: Partial<O1PipelineResult>): O1PipelineResult {
  return {
    enabled: true,
    enriched_context: null,
    physiological_context: null,
    bayesian: null,
    ddx: null,
    uncertainty: null,
    hypotheses: null,
    guideline_alignment: null,
    guideline_compliance: null,
    evidence: null,
    oversight: null,
    hybrid_reasoning: null,
    soap_fallback: null,
    multi_agent: null,
    meta_reasoning: null,
    hypothesis_testing: null,
    evidence_plan: null,
    conflict_resolution: null,
    diagnostic_loop: null,
    causal_reasoning: null,
    calibration: null,
    episodic_memory: null,
    guideline_summary: null,
    logs: [] as any,
    stage_latencies: {},
    wave_latencies: {},
    total_latency_ms: 0,
    cache_stats: { reasoning_hit: false, preindexed_hit: false, evidence_hit: false, guideline_hit: false },
    lineage: null,
    context_graph: null,
    cognitive_layer: null,
    evidence_engine: null,
    engine_audit: null,
    ...overrides,
  } as O1PipelineResult;
}

describe("o1ResultToV4Reasoning — regression: must use fusedBayesian, not raw DDX", () => {
  it("null result produces empty candidates without throwing", () => {
    const bridged = o1ResultToV4Reasoning(null);
    expect(bridged.ddxCandidates).toEqual([]);
    expect(bridged.v3Diagnoses).toEqual([]);
  });

  it("sources v3Diagnoses from bayesian.diagnoses (fusedBayesian), not ddx.differential_diagnoses, when both are present and disagree", () => {
    // Simulates exactly the case clinical_priority_resolution.ts exists for: DDX's raw
    // order ranks "Viral URI" first, but O1's own fusion/priority-resolution promoted
    // the must-not-miss "Bacterial Meningitis" to rank 1 in fusedBayesian — the same
    // adjustment Clinical.tsx (cockpit) already reflects via `bayesian`.
    const result = o1ResultOf({
      ddx: {
        differential_diagnoses: [
          { diagnosis_id: "uri-1", diagnosis_name: "Viral URI", probability: 0.6, must_not_miss: false, category: "respiratory", supporting_features: [], contradicting_features: [] },
          { diagnosis_id: "men-1", diagnosis_name: "Bacterial Meningitis", probability: 0.3, must_not_miss: true, category: "infectious", supporting_features: [], contradicting_features: [] },
        ],
      } as any,
      bayesian: {
        diagnoses: [
          { diagnosis_id: "men-1", diagnosis_name: "Bacterial Meningitis", posterior_probability: 0.3, rank: 1, must_not_miss: true, prior: 0.01, symptom_likelihood: 0.3, physiology_likelihood: 1, risk_modifier: 1, supporting_evidence: [] },
          { diagnosis_id: "uri-1", diagnosis_name: "Viral URI", posterior_probability: 0.6, rank: 2, must_not_miss: false, prior: 0.4, symptom_likelihood: 0.6, physiology_likelihood: 1, risk_modifier: 1, supporting_evidence: [] },
        ],
        total_candidates: 2,
        symptoms_resolved: 2,
        physiology_states_used: 0,
        risk_factors_applied: 0,
        execution_ms: 0,
        source: "fused",
      } as any,
    });

    const bridged = o1ResultToV4Reasoning(result);

    // The regression: this must read the fusedBayesian order (meningitis first),
    // not the raw DDX order (URI first) — even though URI has the higher raw
    // probability, because it was demoted by O1's own safety-promotion logic.
    expect(bridged.v3Diagnoses[0].diagnosis_id).toBe("men-1");
    expect(bridged.v3Diagnoses[0].rank).toBe(1);
    expect(bridged.v3Diagnoses[0].source).toBe("o1_fused_bayesian");
    expect(bridged.v3Diagnoses[1].diagnosis_id).toBe("uri-1");

    // ddxCandidates is a separate contract (feeds cognitive/completeness) and
    // correctly keeps the DDX shape/order — this must NOT change.
    expect(bridged.ddxCandidates[0].diagnosis_id).toBe("uri-1");
    expect(bridged.ddxCandidates).toHaveLength(2);
  });

  it("falls back to the DDX list only when bayesian is unavailable, mirroring O1's own SOAP fallback", () => {
    const result = o1ResultOf({
      ddx: {
        differential_diagnoses: [
          { diagnosis_id: "flu-1", diagnosis_name: "Influenza", probability: 0.5, must_not_miss: false, category: "infectious", supporting_features: [], contradicting_features: [] },
        ],
      } as any,
      bayesian: null,
    });

    const bridged = o1ResultToV4Reasoning(result);
    expect(bridged.v3Diagnoses).toHaveLength(1);
    expect(bridged.v3Diagnoses[0].diagnosis_id).toBe("flu-1");
    expect(bridged.v3Diagnoses[0].source).toBe("o1_unified_pipeline_ddx_fallback");
  });

  it("falls back to the DDX list when bayesian.diagnoses is an empty array", () => {
    const result = o1ResultOf({
      ddx: {
        differential_diagnoses: [
          { diagnosis_id: "flu-1", diagnosis_name: "Influenza", probability: 0.5, must_not_miss: false, category: "infectious", supporting_features: [], contradicting_features: [] },
        ],
      } as any,
      bayesian: { diagnoses: [], total_candidates: 0, symptoms_resolved: 0, physiology_states_used: 0, risk_factors_applied: 0, execution_ms: 0, source: "fused" } as any,
    });

    const bridged = o1ResultToV4Reasoning(result);
    expect(bridged.v3Diagnoses).toHaveLength(1);
    expect(bridged.v3Diagnoses[0].source).toBe("o1_unified_pipeline_ddx_fallback");
  });
});
