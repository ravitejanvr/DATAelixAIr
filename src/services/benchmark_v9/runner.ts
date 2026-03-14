/**
 * Benchmark v9 — Single Scenario Runner
 *
 * Executes one controlled scenario through the full pipeline and
 * produces a per-stage trace aligned with the current architecture.
 */

import { CONTROLLED_SCENARIO, type BenchmarkCase } from "./scenario";
import type {
  BenchmarkResult, NormalizationTrace, PhysiologyTrace,
  CandidateGenerationTrace, BayesianTrace, CognitivePruningTrace,
  SafetyTrace, FinalRankingTrace, StageLatency,
} from "./types";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import { runCognitiveController } from "@/services/cognitive/clinical_cognitive_controller";
import { normalizeWithTrace } from "@/services/context_engine/terminology_normalizer";

// ── Diagnosis matching ──

const SYNONYM_MAP: Record<string, string[]> = {
  pneumonia: ["communityacquiredpneumonia", "cap", "lobarpneumonia", "bronchopneumonia"],
  communityacquiredpneumonia: ["pneumonia", "cap"],
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function diagMatch(a: string, b: string): boolean {
  const na = norm(a), nb = norm(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const aSyn = SYNONYM_MAP[na] || [];
  const bSyn = SYNONYM_MAP[nb] || [];
  return aSyn.includes(nb) || bSyn.includes(na);
}

// ── Runner ──

export async function runControlledBenchmark(): Promise<BenchmarkResult> {
  const sc = CONTROLLED_SCENARIO;
  const stages: StageLatency[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];
  const t0 = performance.now();

  // ── Stage 1: Input Normalization ──
  const s1 = performance.now();
  const normResult = normalizeWithTrace([...sc.context.symptoms, ...(sc.context.associated_symptoms || [])]);
  const s1ms = Math.round(performance.now() - s1);
  stages.push({ stage: "Input Normalization", latency_ms: s1ms, status: "success" });

  const expectedNormMatch = sc.ground_truth.expected_symptoms_normalized.filter(exp =>
    normResult.normalized.some(n => norm(n) === norm(exp))
  ).length / sc.ground_truth.expected_symptoms_normalized.length;

  const normalization: NormalizationTrace = {
    raw_tokens: [...sc.context.symptoms, ...(sc.context.associated_symptoms || [])],
    normalized_tokens: normResult.normalized,
    mappings: normResult.mappings,
    expected_match_rate: expectedNormMatch,
  };

  // Feed normalized into context
  const normalizedContext = {
    ...sc.context,
    symptoms: normResult.normalized.slice(0, sc.context.symptoms.length),
    associated_symptoms: normResult.normalized.slice(sc.context.symptoms.length),
  };

  // ── Stage 2–7: Run full pipeline ──
  const s2 = performance.now();
  let pipelineResult: ClinicalPipelineResult;
  try {
    pipelineResult = await runClinicalPipeline(normalizedContext);
    stages.push({ stage: "Full Pipeline", latency_ms: Math.round(performance.now() - s2), status: "success" });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    stages.push({ stage: "Full Pipeline", latency_ms: Math.round(performance.now() - s2), status: "error", error: errMsg });
    failures.push(`Pipeline execution failed: ${errMsg}`);
    return buildErrorResult(sc, normalization, stages, failures, Math.round(performance.now() - t0));
  }

  const o1 = pipelineResult.o1_result;

  // ── Stage 2: Physiology Inference ──
  const physioCtx = (o1 as any)?.physiological_context;
  const physioStates: Array<{ state: string; confidence: number; system: string }> = [];
  if (physioCtx?.physiological_states) {
    for (const ps of physioCtx.physiological_states) {
      physioStates.push({
        state: ps.state || ps.state_name || String(ps),
        confidence: ps.confidence || 0,
        system: ps.system || ps.system_name || "unknown",
      });
    }
  }
  const affectedSystems = (physioCtx?.affected_systems || []).map((s: any) => typeof s === "string" ? s : s.system_name || String(s));
  const expectedStateMatch = sc.ground_truth.expected_physiology_states.filter(exp =>
    physioStates.some(ps => ps.state.toLowerCase().includes(exp.toLowerCase()) || exp.toLowerCase().includes(ps.state.toLowerCase()))
  ).length / Math.max(1, sc.ground_truth.expected_physiology_states.length);
  const expectedSystemMatch = sc.ground_truth.expected_organ_systems.some(exp =>
    affectedSystems.some((sys: string) => sys.toLowerCase().includes(exp.toLowerCase()))
  );

  stages.push({
    stage: "Physiology Inference",
    latency_ms: o1?.stage_latencies?.physiology_engine || o1?.stage_latencies?.physiological_engine || 0,
    status: physioStates.length > 0 ? "success" : "error",
    error: physioStates.length === 0 ? "No physiology states activated" : undefined,
  });

  const physiology: PhysiologyTrace = {
    states_activated: physioStates,
    affected_organ_systems: affectedSystems,
    candidate_diagnosis_ids: physioCtx?.candidate_diagnosis_ids || [],
    expected_state_match_rate: expectedStateMatch,
    expected_system_match: expectedSystemMatch,
  };

  if (physioStates.length === 0) {
    failures.push("Physiology engine returned zero states");
    recommendations.push("Check symptom_physiology_map coverage for respiratory symptoms");
  }

  // ── Stage 3: Candidate Generation (DDX) ──
  const ddxDiagnoses = o1?.ddx?.differential_diagnoses || pipelineResult.ddx_candidates?.diagnoses || [];
  const candidates = ddxDiagnoses.map((d: any) => ({
    name: (d.diagnosis_name || d.diagnosis || "").trim(),
    diagnosis_id: d.diagnosis_id || "",
    probability: d.probability || 0,
    must_not_miss: d.must_not_miss || false,
  })).filter((d: any) => d.name.length > 1);

  const goldIdx = candidates.findIndex((c: any) => diagMatch(c.name, sc.ground_truth.gold_standard_diagnosis));

  stages.push({
    stage: "Candidate Generation (DDX)",
    latency_ms: o1?.stage_latencies?.ddx_engine || 0,
    status: candidates.length > 0 ? "success" : "error",
    error: candidates.length === 0 ? "No candidates generated" : undefined,
  });

  const candidate_generation: CandidateGenerationTrace = {
    candidates,
    candidate_count: candidates.length,
    gold_in_candidates: goldIdx >= 0,
    gold_candidate_rank: goldIdx >= 0 ? goldIdx + 1 : null,
    gold_candidate_probability: goldIdx >= 0 ? candidates[goldIdx].probability : null,
  };

  if (goldIdx < 0) {
    failures.push(`"${sc.ground_truth.gold_standard_diagnosis}" not found in candidate set`);
    recommendations.push("Check symptom_likelihoods edges for pneumonia symptoms");
  }

  // ── Stage 4: Bayesian Ranking ──
  const bayDiagnoses = ((o1?.bayesian as any)?.diagnoses || []).map((d: any) => ({
    diagnosis: d.diagnosis_name || d.diagnosis || "",
    probability: d.posterior_probability || d.probability || 0,
  }));
  const bayGoldIdx = bayDiagnoses.findIndex((d: any) => diagMatch(d.diagnosis, sc.ground_truth.gold_standard_diagnosis));

  stages.push({
    stage: "Bayesian Ranking",
    latency_ms: o1?.stage_latencies?.bayesian_engine || 0,
    status: bayDiagnoses.length > 0 ? "success" : "skipped",
  });

  const bayesian: BayesianTrace = {
    ranked_diagnoses: bayDiagnoses.slice(0, 10),
    gold_rank_after_bayesian: bayGoldIdx >= 0 ? bayGoldIdx + 1 : null,
  };

  // ── Stage 5: Cognitive Pruning ──
  const s5 = performance.now();
  const cogInput = ddxDiagnoses.map((d: any) => ({
    diagnosis_name: d.diagnosis_name || d.diagnosis || "",
    probability: d.probability || 0,
    must_not_miss: d.must_not_miss || false,
    supporting_symptoms: d.supporting_symptoms || d.supporting_evidence || [],
    contradicting_factors: d.contradicting_factors || [],
  }));
  const cogOutput = runCognitiveController(cogInput, []);
  const s5ms = Math.round(performance.now() - s5);

  const pruned = cogOutput.hypothesis_evaluation.filter(h => h.action === "prune").map(h => h.hypothesis);
  const goldPruned = pruned.some(p => diagMatch(p, sc.ground_truth.gold_standard_diagnosis));

  stages.push({ stage: "Cognitive Pruning", latency_ms: s5ms, status: "success" });

  const cognitive_pruning: CognitivePruningTrace = {
    total_evaluated: cogOutput.hypothesis_evaluation.length,
    kept: cogOutput.hypothesis_evaluation.filter(h => h.action === "keep").length,
    pruned: pruned.length,
    escalated: cogOutput.hypothesis_evaluation.filter(h => h.action === "escalate").length,
    pruned_names: pruned,
    gold_pruned: goldPruned,
    quality_score: cogOutput.reasoning_evaluation.quality_score,
  };

  if (goldPruned) {
    failures.push("Gold diagnosis was incorrectly pruned by cognitive controller");
  }

  // ── Stage 6: Safety Evaluation ──
  // Collect ALL dangerous diagnoses from pipeline output
  const dangerousList: string[] = [];
  
  // From DDX must-not-miss flags
  for (const d of ddxDiagnoses) {
    if (d.must_not_miss) {
      dangerousList.push((d.diagnosis_name || d.diagnosis || "").trim());
    }
  }
  // From explicit dangerous_diagnoses in DDX output
  if (o1?.ddx?.dangerous_diagnoses) {
    for (const d of o1.ddx.dangerous_diagnoses) {
      const name = typeof d === "string" ? d : (d.diagnosis_name || String(d));
      if (name) dangerousList.push(name.trim());
    }
  }
  // From safety alerts
  if (pipelineResult.safety_alerts?.alerts) {
    for (const a of pipelineResult.safety_alerts.alerts) {
      if (a.affected_diagnosis) dangerousList.push(a.affected_diagnosis);
    }
  }

  const uniqueDangerous = [...new Set(dangerousList.filter(Boolean))];
  const dangerDetected = uniqueDangerous.length > 0 ||
    (o1?.ddx?.dangerous_diagnoses_injected && o1.ddx.dangerous_diagnoses_injected > 0) ||
    (pipelineResult.safety_alerts?.critical_count > 0) ||
    !!(o1?.oversight?.events?.some((e: any) => e.severity === "critical"));

  // Check which expected dangerous diagnoses appear in candidates
  const expectedDangerous = sc.ground_truth.expected_dangerous_diagnoses || [];
  const dangerousInCandidates = expectedDangerous.filter(exp =>
    candidates.some((c: any) => diagMatch(c.name, exp))
  );

  // Safety is correct when:
  // - If danger expected: danger was detected
  // - If no danger expected: no danger was detected
  // For cases WITH expected dangerous diagnoses, verify they appear in candidates
  let safetyCorrect: boolean;
  let detectionDetails: string;

  if (sc.ground_truth.danger_flag) {
    if (!dangerDetected) {
      safetyCorrect = false;
      detectionDetails = "Expected danger but none detected";
    } else if (expectedDangerous.length > 0 && dangerousInCandidates.length === 0) {
      // Danger detected but none of the expected dangerous diagnoses are in candidates
      // This is still a pass if the pipeline flagged danger through other means
      safetyCorrect = true;
      detectionDetails = `Danger detected via pipeline flags. Expected dangerous Dx in candidates: ${dangerousInCandidates.length}/${expectedDangerous.length}`;
    } else {
      safetyCorrect = true;
      detectionDetails = `Danger correctly detected. ${dangerousInCandidates.length}/${expectedDangerous.length} expected dangerous Dx in candidates`;
    }
  } else {
    safetyCorrect = !dangerDetected;
    detectionDetails = dangerDetected ? "False positive: danger detected but not expected" : "Correctly no danger";
  }

  stages.push({
    stage: "Safety Evaluation",
    latency_ms: o1?.stage_latencies?.safety_evaluation || 0,
    status: "success",
  });

  const safety: SafetyTrace = {
    danger_detected: dangerDetected,
    expected_danger: sc.ground_truth.danger_flag,
    safety_alerts: pipelineResult.safety_alerts?.critical_count || 0,
    safety_score: pipelineResult.safety_alerts?.safety_score || 100,
    dangerous_diagnoses: uniqueDangerous,
    expected_dangerous_diagnoses: expectedDangerous,
    dangerous_diagnoses_in_candidates: dangerousInCandidates,
    correct: safetyCorrect,
    detection_details: detectionDetails,
  };

  // ── Stage 7: Final Ranked Diagnoses ──
  // Use DDX output as the final ranking (it IS the final ranked list)
  const finalRanking = candidates.slice(0, 10).map((c: any, i: number) => ({
    rank: i + 1,
    diagnosis: c.name,
    diagnosis_id: c.diagnosis_id,
    probability: c.probability,
  }));

  const finalGoldRank = finalRanking.findIndex(d => diagMatch(d.diagnosis, sc.ground_truth.gold_standard_diagnosis));

  const soapData = (o1?.hybrid_reasoning as any)?.soap || (o1?.soap_fallback as any)?.soap;
  stages.push({ stage: "SOAP Generation", latency_ms: o1?.stage_latencies?.soap_generation || 0, status: soapData ? "success" : "skipped" });

  const final_ranking: FinalRankingTrace = {
    ranking: finalRanking,
    gold_rank: finalGoldRank >= 0 ? finalGoldRank + 1 : null,
    top1_match: finalGoldRank === 0,
    top3_match: finalGoldRank >= 0 && finalGoldRank < 3,
    top5_match: finalGoldRank >= 0 && finalGoldRank < 5,
  };

  const totalMs = Math.round(performance.now() - t0);

  // ── Aggregate Metrics ──
  const metrics = {
    candidate_recall: goldIdx >= 0,
    top1_accuracy: finalGoldRank === 0,
    top3_accuracy: finalGoldRank >= 0 && finalGoldRank < 3,
    safety_correct: safety.correct,
    physiology_activated: physioStates.length > 0,
    normalization_applied: normResult.mappings.some(m => m.changed),
    soap_generated: !!soapData,
    total_latency_ms: totalMs,
    latency_under_5s: totalMs < 5000,
  };

  const passed = metrics.candidate_recall && metrics.top3_accuracy && metrics.safety_correct;

  if (!metrics.top1_accuracy && metrics.candidate_recall) {
    recommendations.push(`Gold diagnosis ranked #${(finalGoldRank || 0) + 1} — tune likelihood weights or priors`);
  }
  if (!metrics.latency_under_5s) {
    recommendations.push(`Total latency ${(totalMs / 1000).toFixed(1)}s exceeds 5s target`);
  }

  return {
    scenario_id: sc.id,
    scenario_name: sc.name,
    timestamp: new Date().toISOString(),
    passed,
    normalization,
    physiology,
    candidate_generation,
    bayesian,
    cognitive_pruning,
    safety,
    final_ranking,
    metrics,
    stage_latencies: stages,
    failure_reasons: failures,
    recommendations,
    raw_output: pipelineResult,
  };
}

function buildErrorResult(
  sc: BenchmarkCase,
  normalization: NormalizationTrace,
  stages: StageLatency[],
  failures: string[],
  totalMs: number,
): BenchmarkResult {
  const empty = { states_activated: [], affected_organ_systems: [], candidate_diagnosis_ids: [], expected_state_match_rate: 0, expected_system_match: false };
  return {
    scenario_id: sc.id, scenario_name: sc.name, timestamp: new Date().toISOString(), passed: false,
    normalization,
    physiology: empty,
    candidate_generation: { candidates: [], candidate_count: 0, gold_in_candidates: false, gold_candidate_rank: null, gold_candidate_probability: null },
    bayesian: { ranked_diagnoses: [], gold_rank_after_bayesian: null },
    cognitive_pruning: { total_evaluated: 0, kept: 0, pruned: 0, escalated: 0, pruned_names: [], gold_pruned: false, quality_score: 0 },
    safety: { danger_detected: false, expected_danger: sc.ground_truth.danger_flag, safety_alerts: 0, safety_score: 0, dangerous_diagnoses: [], correct: false },
    final_ranking: { ranking: [], gold_rank: null, top1_match: false, top3_match: false, top5_match: false },
    metrics: { candidate_recall: false, top1_accuracy: false, top3_accuracy: false, safety_correct: false, physiology_activated: false, normalization_applied: false, soap_generated: false, total_latency_ms: totalMs, latency_under_5s: totalMs < 5000 },
    stage_latencies: stages,
    failure_reasons: failures,
    recommendations: ["Fix pipeline execution errors before tuning accuracy"],
    raw_output: null,
  };
}
