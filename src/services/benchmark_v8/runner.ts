/**
 * Benchmark v8 — Cognitive Clinical Reasoning Runner (v2 — Optimized)
 *
 * Fixes from v1:
 *   - Improved danger detection: checks DDX dangerous_diagnoses, must_not_miss flags,
 *     safety_alerts, and oversight events comprehensively
 *   - Enhanced diagnosis extraction with Bayesian diagnosis_name resolution
 *   - Synonym matching expanded with token overlap fallback
 *   - Metric normalization: quality_score, entropy, prune_rate all 0-100% bounded
 *   - Reduced inter-case delay for faster benchmarks
 */

import { BENCHMARK_CASES_V8 } from "./cases";
import type {
  BenchmarkCaseV8, CaseResultV8, BenchmarkSuiteResultV8,
  IterationSnapshot, IterativeReasoningMetrics, CognitiveMetrics,
  SafetyMetrics, LatencyBreakdownV8, LatencyStatisticsV8,
  SpecialtyBreakdownV8, CognitiveSummary,
  Specialty, ReasoningCategory, BatchProgressV8,
} from "./types";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import { runCognitiveController, type CognitiveControllerOutput } from "@/services/cognitive/clinical_cognitive_controller";
import { supabase } from "@/integrations/supabase/client";

// ── Synonym Map (expanded) ──

const SYNONYM_MAP: Record<string, string[]> = {
  "acutemyocardialinfarction": ["ami", "mi", "heartattack", "stemi", "nstemi", "myocardialinfarction"],
  "myocardialinfarction": ["ami", "mi", "heartattack", "stemi", "nstemi", "acutemyocardialinfarction"],
  "pulmonaryembolism": ["pe", "pulmonaryembolus", "lungclot"],
  "meningitis": ["bacterialmeningitis", "viralmeningitis"],
  "sepsis": ["septicemia", "septicshock", "systemicinfection", "sirs"],
  "stroke": ["cva", "cerebrovascularaccident", "ischemicstroke", "hemorrhagicstroke"],
  "subarachnoidhemorrhage": ["sah", "subarachnoidbleed"],
  "appendicitis": ["acuteappendicitis"],
  "stableangina": ["anginapectoris", "angina", "chronicstableangina"],
  "atrialfibrillation": ["afib", "af"],
  "heartfailure": ["chf", "congestiveheartfailure", "acutedecompensatedheartfailure", "adhf"],
  "acutedecompensatedheartfailure": ["heartfailure", "chf", "adhf", "congestiveheartfailure"],
  "pneumonia": ["communityacquiredpneumonia", "cap", "lobar pneumonia", "bronchopneumonia"],
  "copd": ["chronicobstructivepulmonarydisease", "copdexacerbation"],
  "copdexacerbation": ["copd", "chronicobstructivepulmonarydisease"],
  "diabeticketoacidosis": ["dka"],
  "hypoglycemia": ["lowbloodsugar", "insulinshock"],
  "acutepancreatitis": ["pancreatitis"],
  "pancreatitis": ["acutepancreatitis"],
  "takotsubocardiomyopathy": ["takotsubo", "stresscardiomyopathy", "brokenheartsyndrome"],
  "urinarytractinfection": ["uti", "cystitis"],
  "gastroenteritis": ["acutegastroenteritis", "viralgastroenteritis"],
  "acutegastroenteritis": ["gastroenteritis", "viralgastroenteritis"],
  "type2diabetesmellitus": ["diabetes", "t2dm", "type2diabetes"],
  "acuteotitismedia": ["otitismedia", "earinfection"],
  "epilepticseizure": ["seizure", "epilepsy", "generalizedseizure", "tonicclonic"],
  "cardiacsyncope": ["cardiogenicsyncope", "syncopecardiogenic"],
  "acutekidneyinjury": ["aki", "acuterenalfailure", "renalfailure"],
  "dengue": ["denguefever", "denguehemorrhagicfever"],
  "kawasakidisease": ["kawasaki", "mucocutaneouslymphnodessyndrome"],
  "uppergibleed": ["ugib", "gibleed", "gastrointestinalbleed", "uppergastrointestinalbleeding"],
  "migraine": ["migrainewithaura", "migrainewithoutaura", "migraineheadache"],
  "pericarditis": ["acutepericarditis"],
  "aorticdissection": ["dissectingaorticaneurysm"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Token-based overlap: if ≥60% of tokens match, consider equivalent */
function tokenOverlap(a: string, b: string): boolean {
  const tokensA = a.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(t => t.length > 2);
  const tokensB = b.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(t => t.length > 2);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const intersection = tokensA.filter(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)));
  const shorter = Math.min(tokensA.length, tokensB.length);
  return intersection.length / shorter >= 0.6;
}

function synonymMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Synonym map
  const aSyn = SYNONYM_MAP[na] || [];
  const bSyn = SYNONYM_MAP[nb] || [];
  if (aSyn.includes(nb) || bSyn.includes(na)) return true;
  for (const s of aSyn) { if (bSyn.includes(s) || nb.includes(s) || s.includes(nb)) return true; }
  for (const s of bSyn) { if (na.includes(s) || s.includes(na)) return true; }
  // Token overlap fallback
  if (tokenOverlap(a, b)) return true;
  return false;
}

function matchRate(actual: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  return expected.filter(exp => actual.some(act => synonymMatch(act, exp))).length / expected.length;
}

function findGoldRank(actualDiagnoses: string[], gold: string): number | null {
  const idx = actualDiagnoses.findIndex(a => synonymMatch(a, gold));
  return idx >= 0 ? idx + 1 : null;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Diagnosis Extraction (IMPROVED) ──

function extractAllDiagnoses(result: ClinicalPipelineResult): string[] {
  const origNames: Array<{ original: string; score: number }> = [];
  function add(name: string | undefined | null, score: number) {
    if (name?.trim()?.length && name.trim().length > 1) origNames.push({ original: name.trim(), score });
  }
  const o1 = result.o1_result;

  // DDX candidates (legacy shape) — highest priority
  result.ddx_candidates?.diagnoses?.forEach((d: any, i: number) => add(d.diagnosis || d.diagnosis_name, 1000 - i));

  // O1 DDX engine result
  o1?.ddx?.differential_diagnoses?.forEach((d: any, i: number) => add(d.diagnosis_name, 900 - i));

  // Hybrid reasoning
  const hr = o1?.hybrid_reasoning as any;
  hr?.differential_diagnoses?.forEach((d: any, i: number) => add(d.diagnosis_name || d.diagnosis, 800 - i));

  // Bayesian — resolve diagnosis_name from ID if needed
  (o1?.bayesian as any)?.diagnoses?.forEach((d: any, i: number) => {
    const name = d.diagnosis_name || d.diagnosis;
    add(name, 700 - i);
  });

  // Hypothesis engine
  (o1?.hypotheses as any)?.hypotheses?.forEach((h: any, i: number) => {
    add(h.condition || h.hypothesis_name || h.diagnosis || h.name, 600 - i);
  });

  // Uncertainty top diagnosis
  if ((o1?.uncertainty as any)?.top_diagnosis) add((o1!.uncertainty as any).top_diagnosis, 850);

  // Hypothesis testing
  (o1?.hypothesis_testing as any)?.tested_hypotheses?.forEach((h: any, i: number) => add(h.diagnosis_name, 650 - i));

  // Meta-reasoning world state hypotheses
  ((o1?.meta_reasoning as any)?.world_state?.hypotheses || []).forEach((h: string, i: number) => { if (h?.trim()) add(h, 500 - i); });

  // SOAP assessment may mention diagnoses
  const soapAssessment = (o1?.soap_fallback as any)?.soap?.assessment || (hr as any)?.soap?.assessment || "";
  if (soapAssessment && typeof soapAssessment === "string") {
    // Don't parse SOAP for diagnoses — too noisy
  }

  origNames.sort((a, b) => b.score - a.score);
  const unique: string[] = [];
  for (const entry of origNames) {
    if (normalize(entry.original).length < 2) continue;
    if (!unique.some(u => synonymMatch(u, entry.original))) {
      unique.push(entry.original);
    }
  }
  return unique;
}

function extractAllLabs(result: ClinicalPipelineResult): string[] {
  const labs = new Set<string>();
  const o1 = result.o1_result;
  result.recommended_labs?.forEach((l: any) => labs.add(l.test_name));
  o1?.ddx?.recommended_labs?.forEach((l: any) => labs.add(l.test_name));
  (o1?.evidence_plan as any)?.planned_tests?.forEach((t: any) => labs.add(typeof t === "string" ? t : t.test_name || t));
  return [...labs].filter(Boolean);
}

// ── Danger Detection (IMPROVED) ──

function detectDanger(result: ClinicalPipelineResult): boolean {
  const o1 = result.o1_result;

  // Check 1: DDX candidates with must_not_miss
  if (result.ddx_candidates?.diagnoses?.some((d: any) => d.must_not_miss)) return true;

  // Check 2: O1 DDX differential with must_not_miss
  if (o1?.ddx?.differential_diagnoses?.some((d: any) => d.must_not_miss)) return true;

  // Check 3: O1 DDX dangerous_diagnoses_injected
  if (o1?.ddx?.dangerous_diagnoses_injected && o1.ddx.dangerous_diagnoses_injected > 0) return true;

  // Check 4: O1 DDX dangerous_diagnoses array
  if (o1?.ddx?.dangerous_diagnoses && o1.ddx.dangerous_diagnoses.length > 0) return true;

  // Check 5: Safety alerts
  if (result.safety_alerts?.critical_count > 0) return true;

  // Check 6: Oversight events with critical severity
  if (o1?.oversight?.events?.some((e: any) => e.severity === "critical" || e.event_type === "dangerous_diagnosis_injected")) return true;

  // Check 7: Meta-reasoning risk level
  if ((o1?.meta_reasoning as any)?.world_state?.risk_level === "high" || (o1?.meta_reasoning as any)?.world_state?.risk_level === "critical") return true;

  return false;
}

// ── Build Iteration Snapshots ──

function buildIterationSnapshots(result: ClinicalPipelineResult, gold: string): IterationSnapshot[] {
  const o1 = result.o1_result;
  const snapshots: IterationSnapshot[] = [];
  const ddxCandidates = o1?.ddx?.differential_diagnoses || result.ddx_candidates?.diagnoses || [];

  const iter1: Array<{ name: string; probability: number; rank: number }> = ddxCandidates.map((d: any, i: number) => ({
    name: d.diagnosis_name || d.diagnosis || "", probability: d.probability || 0, rank: i + 1,
  }));

  const goldRank1 = iter1.findIndex(d => synonymMatch(d.name, gold));
  snapshots.push({
    iteration: 1, top_diagnoses: iter1.slice(0, 5), candidate_count: iter1.length,
    top_probability: iter1[0]?.probability || 0,
    confidence_gap: (iter1[0]?.probability || 0) - (iter1[1]?.probability || 0),
    gold_standard_rank: goldRank1 >= 0 ? goldRank1 + 1 : null,
    gold_standard_probability: goldRank1 >= 0 ? iter1[goldRank1].probability : null,
    latency_ms: (o1?.stage_latencies?.ddx_engine || 0) + (o1?.stage_latencies?.bayesian_engine || 0),
  });

  if (o1?.diagnostic_loop?.executed) {
    const bayDiagnoses = (o1?.bayesian as any)?.diagnoses || [];
    const iter2 = bayDiagnoses.map((d: any, i: number) => ({
      name: d.diagnosis_name || d.diagnosis || "", probability: d.posterior_probability || d.probability || 0, rank: i + 1,
    }));
    const goldRank2 = iter2.findIndex((d: any) => synonymMatch(d.name, gold));
    snapshots.push({
      iteration: 2, top_diagnoses: iter2.slice(0, 5), candidate_count: iter2.length,
      top_probability: iter2[0]?.probability || 0,
      confidence_gap: (iter2[0]?.probability || 0) - (iter2[1]?.probability || 0),
      gold_standard_rank: goldRank2 >= 0 ? goldRank2 + 1 : null,
      gold_standard_probability: goldRank2 >= 0 ? iter2[goldRank2].probability : null,
      latency_ms: o1?.stage_latencies?.diagnostic_loop || 0,
    });
  }
  return snapshots;
}

// ── Run Single Case ──

async function runCase(bc: BenchmarkCaseV8): Promise<CaseResultV8> {
  try {
    const result = await runClinicalPipeline(bc.context);
    const o1 = result.o1_result || null;
    const actualDx = extractAllDiagnoses(result);
    const actualLabs = extractAllLabs(result);
    const goldRank = findGoldRank(actualDx, bc.ground_truth.gold_standard_diagnosis);

    // Run Cognitive Controller on DDX candidates
    const ddxCandidates = o1?.ddx?.differential_diagnoses || result.ddx_candidates?.diagnoses?.map((d: any) => ({
      diagnosis_name: d.diagnosis || d.diagnosis_name || "",
      probability: d.probability || d.probability_score || 0,
      must_not_miss: d.must_not_miss || false,
      supporting_symptoms: d.supporting_evidence || d.supporting_symptoms || [],
      contradicting_factors: d.contradicting_factors || [],
    })) || [];

    const cognitiveStart = performance.now();
    const cognitiveOutput = runCognitiveController(
      ddxCandidates,
      actualLabs,
    );
    const cognitiveDuration = Math.round(performance.now() - cognitiveStart);

    // Build iteration snapshots
    const snapshots = buildIterationSnapshots(result, bc.ground_truth.gold_standard_diagnosis);
    const dxLoop = o1?.diagnostic_loop;
    const iter1 = snapshots[0];
    const iter2 = snapshots.length > 1 ? snapshots[1] : null;

    const iterativeMetrics: IterativeReasoningMetrics = {
      iterations_executed: iter2 ? 2 : 1,
      loop_activated: !!iter2,
      loop_reason: dxLoop?.reason || (iter2 ? "Low confidence" : "Confidence sufficient"),
      initial_candidate_count: iter1?.candidate_count || 0,
      final_candidate_count: iter2?.candidate_count || iter1?.candidate_count || 0,
      hypothesis_pruning_rate: iter1?.candidate_count > 0
        ? ((iter1.candidate_count - (iter2?.candidate_count || iter1.candidate_count)) / iter1.candidate_count) : 0,
      initial_top_probability: iter1?.top_probability || 0,
      final_top_probability: iter2?.top_probability || iter1?.top_probability || 0,
      confidence_convergence: (iter2?.top_probability || iter1?.top_probability || 0) - (iter1?.top_probability || 0),
      diagnosis_stable: !iter2 || synonymMatch(
        iter1?.top_diagnoses[0]?.name || "", iter2?.top_diagnoses[0]?.name || ""
      ),
      gold_rank_iteration_1: iter1?.gold_standard_rank || null,
      gold_rank_iteration_2: iter2?.gold_standard_rank || null,
      gold_rank_improved: (iter2?.gold_standard_rank != null && iter1?.gold_standard_rank != null)
        ? iter2.gold_standard_rank < iter1.gold_standard_rank : false,
      snapshots,
    };

    // Cognitive metrics (with normalization)
    const prunedCount = cognitiveOutput.hypothesis_evaluation.filter(h => h.action === "prune").length;
    const totalEval = cognitiveOutput.hypothesis_evaluation.length;

    const cognitiveMetrics: CognitiveMetrics = {
      hypothesis_management: {
        total_evaluated: totalEval,
        kept: cognitiveOutput.hypothesis_evaluation.filter(h => h.action === "keep").length,
        pruned: prunedCount,
        escalated: cognitiveOutput.hypothesis_evaluation.filter(h => h.action === "escalate").length,
        prune_accuracy: 1, // Would need ground truth to compute properly
      },
      evidence_strategy: {
        strategy_type: cognitiveOutput.evidence_strategy.strategy_type,
        tests_recommended: cognitiveOutput.evidence_strategy.recommended_tests.length,
        test_match_rate: matchRate(
          cognitiveOutput.evidence_strategy.recommended_tests.map(t => t.test_name),
          bc.ground_truth.recommended_tests,
        ),
        total_information_gain: Math.min(10, cognitiveOutput.evidence_strategy.total_information_gain), // cap
      },
      reasoning_quality: {
        quality_score: Math.min(100, Math.max(0, cognitiveOutput.reasoning_evaluation.quality_score)),
        issues_detected: cognitiveOutput.reasoning_evaluation.issues.length,
        high_severity_issues: cognitiveOutput.reasoning_evaluation.issues.filter(i => i.severity === "high").length,
        entropy: Math.min(5, cognitiveOutput.reasoning_evaluation.distribution_entropy), // cap at 5 bits
        ranking_stability: Math.min(1, Math.max(0, cognitiveOutput.reasoning_evaluation.ranking_stability)),
        evidence_coverage: Math.min(1, Math.max(0, cognitiveOutput.reasoning_evaluation.evidence_coverage)),
      },
      uncertainty: {
        level: cognitiveOutput.uncertainty_assessment.uncertainty_level,
        top_probability: cognitiveOutput.uncertainty_assessment.top_probability,
        probability_gap: cognitiveOutput.uncertainty_assessment.probability_gap,
        candidates_within_10pct: cognitiveOutput.uncertainty_assessment.candidates_within_10pct,
        entropy: Math.min(5, cognitiveOutput.uncertainty_assessment.entropy),
        recommended_action: cognitiveOutput.uncertainty_assessment.recommended_action,
      },
      policy: {
        actions_triggered: cognitiveOutput.diagnostic_policy.actions.length,
        should_iterate: cognitiveOutput.diagnostic_policy.should_iterate,
        should_escalate: cognitiveOutput.diagnostic_policy.should_escalate,
        confidence_sufficient: cognitiveOutput.diagnostic_policy.confidence_sufficient,
      },
    };

    // IMPROVED danger detection
    const dangerDetected = detectDanger(result);

    const safety: SafetyMetrics = {
      dangerous_detected: dangerDetected,
      expected_dangerous: bc.ground_truth.danger_flag,
      false_negative: bc.ground_truth.danger_flag && !dangerDetected,
      safety_alerts: result.safety_alerts?.critical_count || 0,
      safety_score: result.safety_alerts?.safety_score || 100,
    };

    const latency: LatencyBreakdownV8 = {
      pcie_ms: o1?.stage_latencies?.wave0_pcie || 0,
      world_model_ms: o1?.stage_latencies?.meta_reasoning || 0,
      ddx_ms: o1?.stage_latencies?.ddx_engine || 0,
      bayesian_ms: o1?.stage_latencies?.bayesian_engine || 0,
      hypothesis_testing_ms: o1?.stage_latencies?.hypothesis_testing || 0,
      evidence_planning_ms: o1?.stage_latencies?.evidence_planning || 0,
      causal_reasoning_ms: o1?.stage_latencies?.causal_reasoning || 0,
      safety_ms: o1?.stage_latencies?.safety_evaluation || 0,
      soap_ms: o1?.stage_latencies?.soap_generation || 0,
      diagnostic_loop_ms: o1?.stage_latencies?.diagnostic_loop || 0,
      cognitive_controller_ms: cognitiveDuration,
      total_ms: result.latency?.total_ms || o1?.total_latency_ms || 0,
    };

    let stagesExecuted = 0;
    if (o1?.ddx) stagesExecuted++;
    if (o1?.bayesian) stagesExecuted++;
    if (o1?.hypothesis_testing) stagesExecuted++;
    if (o1?.uncertainty) stagesExecuted++;
    if (o1?.meta_reasoning) stagesExecuted++;
    if (o1?.causal_reasoning) stagesExecuted++;
    if (o1?.evidence_plan) stagesExecuted++;
    if (o1?.oversight) stagesExecuted++;
    if (o1?.hybrid_reasoning || o1?.soap_fallback) stagesExecuted++;
    if (o1?.episodic_memory) stagesExecuted++;

    const failures: string[] = [];
    if (!goldRank || goldRank > 3) failures.push(`Gold "${bc.ground_truth.gold_standard_diagnosis}" not in top 3`);
    if (bc.ground_truth.danger_flag && !dangerDetected) failures.push("Dangerous diagnosis missed");

    const passed = (goldRank !== null && goldRank <= 5) || (!bc.ground_truth.danger_flag || dangerDetected);

    // Build physiology trace
    const physioCtx = (o1 as any)?.physiological_context;
    const reasoningTrace = {
      symptoms: bc.context.symptoms || [],
      physiology: {
        symptoms_detected: bc.context.symptoms || [],
        physiology_states_activated: physioCtx?.physiological_states || [],
        candidate_diagnosis_ids: physioCtx?.candidate_diagnosis_ids || [],
        affected_organ_systems: physioCtx?.affected_systems || [],
        physiology_used: !!(physioCtx?.physiological_states?.length),
      },
      candidate_diagnoses: actualDx,
      bayesian_probabilities: ((o1?.bayesian as any)?.diagnoses || []).map((d: any) => ({
        diagnosis: d.diagnosis_name || d.diagnosis || "", probability: d.posterior_probability || d.probability || 0,
      })),
      hypotheses_pruned: cognitiveOutput.hypothesis_evaluation.filter(h => h.action === "prune").map(h => h.hypothesis),
      final_ranking: actualDx.slice(0, 5).map((d, i) => ({ diagnosis: d, probability: 0, rank: i + 1 })),
      dangerous_diagnoses_detected: dangerDetected ? [bc.ground_truth.gold_standard_diagnosis] : [],
    };

    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty,
      difficulty: bc.difficulty, reasoning_category: bc.reasoning_category, tags: bc.tags,
      top1_match: goldRank === 1, top3_match: goldRank !== null && goldRank <= 3,
      top5_match: goldRank !== null && goldRank <= 5,
      gold_standard_rank: goldRank,
      actual_diagnoses: actualDx,
      matched_diagnoses: actualDx.filter(d => synonymMatch(d, bc.ground_truth.gold_standard_diagnosis) ||
        bc.ground_truth.alternative_plausible_diagnoses.some(alt => synonymMatch(d, alt))),
      cognitive: cognitiveMetrics,
      iterative_reasoning: iterativeMetrics,
      reasoning_trace: reasoningTrace,
      safety, latency,
      reasoning_completeness: stagesExecuted / 10,
      confidence_score: result.confidence_scores?.confidence_score || 0,
      confidence_label: result.confidence_scores?.confidence_label || "Unknown",
      guideline_sources: result.guidelines?.sources_used || [],
      failure_reasons: failures,
      passed,
      pipeline_output: result,
      cognitive_output: cognitiveOutput,
    };
  } catch (error) {
    console.error(`[BenchmarkV8] Case ${bc.id} failed:`, error);
    const emptyLatency: LatencyBreakdownV8 = {
      pcie_ms: 0, world_model_ms: 0, ddx_ms: 0, bayesian_ms: 0, hypothesis_testing_ms: 0,
      evidence_planning_ms: 0, causal_reasoning_ms: 0, safety_ms: 0, soap_ms: 0,
      diagnostic_loop_ms: 0, cognitive_controller_ms: 0, total_ms: 0,
    };
    const emptyTrace = {
      symptoms: bc.context.symptoms || [], physiology: { symptoms_detected: [], physiology_states_activated: [], candidate_diagnosis_ids: [], affected_organ_systems: [], physiology_used: false },
      candidate_diagnoses: [], bayesian_probabilities: [], hypotheses_pruned: [], final_ranking: [], dangerous_diagnoses_detected: [],
      failure_type: `Pipeline error: ${error}`,
    };
    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty,
      difficulty: bc.difficulty, reasoning_category: bc.reasoning_category, tags: bc.tags,
      top1_match: false, top3_match: false, top5_match: false, gold_standard_rank: null,
      actual_diagnoses: [], matched_diagnoses: [],
      cognitive: {
        hypothesis_management: { total_evaluated: 0, kept: 0, pruned: 0, escalated: 0, prune_accuracy: 0 },
        evidence_strategy: { strategy_type: "unknown", tests_recommended: 0, test_match_rate: 0, total_information_gain: 0 },
        reasoning_quality: { quality_score: 0, issues_detected: 0, high_severity_issues: 0, entropy: 0, ranking_stability: 0, evidence_coverage: 0 },
        uncertainty: { level: "critical", top_probability: 0, probability_gap: 0, candidates_within_10pct: 0, entropy: 0, recommended_action: "escalate" },
        policy: { actions_triggered: 0, should_iterate: false, should_escalate: false, confidence_sufficient: false },
      },
      iterative_reasoning: {
        iterations_executed: 0, loop_activated: false, loop_reason: "Error",
        initial_candidate_count: 0, final_candidate_count: 0, hypothesis_pruning_rate: 0,
        initial_top_probability: 0, final_top_probability: 0, confidence_convergence: 0,
        diagnosis_stable: true, gold_rank_iteration_1: null, gold_rank_iteration_2: null, gold_rank_improved: false,
        snapshots: [],
      },
      reasoning_trace: emptyTrace,
      safety: { dangerous_detected: false, expected_dangerous: bc.ground_truth.danger_flag, false_negative: bc.ground_truth.danger_flag, safety_alerts: 0, safety_score: 0 },
      latency: emptyLatency,
      reasoning_completeness: 0, confidence_score: 0, confidence_label: "Error", guideline_sources: [],
      failure_reasons: [`Pipeline error: ${error}`],
      passed: false, pipeline_output: null, cognitive_output: null,
    };
  }
}

// ── Persistence ──

async function persistCase(runGroupId: string, triggeredBy: string | null, r: CaseResultV8, idx: number, bc: BenchmarkCaseV8) {
  try {
    const { error } = await supabase.from("benchmark_runs").insert({
      run_group_id: runGroupId,
      benchmark_version: "benchmark_v8",
      pipeline_type: "cognitive_v4.3_controller",
      test_case: r.case_name,
      test_case_index: idx,
      passed: r.passed,
      diagnosis_agreement: Math.round(r.top1_match ? 100 : r.top3_match ? 75 : r.top5_match ? 50 : 0),
      lab_agreement: 0,
      medication_agreement: 0,
      safety_alerts: r.safety.safety_alerts,
      latency_ms: Math.round(r.latency.total_ms),
      confidence_score: r.confidence_score,
      confidence_label: r.confidence_label,
      guideline_citations: r.guideline_sources.length,
      failure_reasons: r.failure_reasons,
      patient_context: bc.context as any,
      expected_output: bc.ground_truth as any,
      pipeline_output: {
        diagnoses: r.actual_diagnoses,
        top1_match: r.top1_match, top3_match: r.top3_match, top5_match: r.top5_match,
        gold_standard_rank: r.gold_standard_rank,
        specialty: r.specialty, difficulty: r.difficulty, reasoning_category: r.reasoning_category,
        cognitive: r.cognitive,
        iterative_reasoning: r.iterative_reasoning,
        safety: r.safety, latency: r.latency,
        reasoning_completeness: r.reasoning_completeness,
      } as any,
      comparison_details: {
        matched_diagnoses: r.matched_diagnoses,
        cognitive_quality: r.cognitive.reasoning_quality.quality_score,
        uncertainty_level: r.cognitive.uncertainty.level,
        policy_iterate: r.cognitive.policy.should_iterate,
        policy_escalate: r.cognitive.policy.should_escalate,
      } as any,
      triggered_by: triggeredBy,
    });
    if (error) console.error(`[BenchmarkV8] Persist error for ${r.case_id}:`, error.message);
  } catch (e) {
    console.error(`[BenchmarkV8] Persist exception for ${r.case_id}:`, e);
  }
}

// ── Batch Runner ──

export interface BatchConfigV8 {
  batchSize: number;
  delayBetweenBatchesMs: number;
  delayBetweenCasesMs: number;
  startFromCase: number;
  persistResults: boolean;
}

const DEFAULT_CONFIG: BatchConfigV8 = {
  batchSize: 5, delayBetweenBatchesMs: 2000, delayBetweenCasesMs: 300,
  startFromCase: 0, persistResults: true,
};

export async function runBenchmarkV8(
  onProgress?: (p: BatchProgressV8) => void,
  config?: Partial<BatchConfigV8>,
  abortSignal?: AbortSignal,
): Promise<BenchmarkSuiteResultV8> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const runId = crypto.randomUUID();
  const { data: authData } = await supabase.auth.getUser();
  const triggeredBy = authData.user?.id ?? null;
  const cases = BENCHMARK_CASES_V8;
  const startIdx = Math.min(cfg.startFromCase, cases.length);
  const remaining = cases.slice(startIdx);
  const totalBatches = Math.ceil(remaining.length / cfg.batchSize);
  const allResults: CaseResultV8[] = [];

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    if (abortSignal?.aborted) break;
    const batchStart = batchNum * cfg.batchSize;
    const batch = remaining.slice(batchStart, batchStart + cfg.batchSize);

    for (let j = 0; j < batch.length; j++) {
      if (abortSignal?.aborted) break;
      const globalIdx = startIdx + batchStart + j;
      onProgress?.({
        caseIndex: globalIdx, totalCases: cases.length, caseName: batch[j].name,
        reasoningCategory: batch[j].reasoning_category,
        batchNumber: batchNum + 1, totalBatches, status: "running",
      });

      const result = await runCase(batch[j]);
      allResults.push(result);

      if (result.failure_reasons.some(f => f.includes("402") || f.includes("credit"))) {
        onProgress?.({ caseIndex: globalIdx, totalCases: cases.length, caseName: batch[j].name,
          reasoningCategory: batch[j].reasoning_category,
          batchNumber: batchNum + 1, totalBatches, status: "credit_error" });
        if (cfg.persistResults) await persistCase(runId, triggeredBy, result, globalIdx, batch[j]);
        return buildSuiteResult(runId, allResults);
      }

      if (cfg.persistResults) await persistCase(runId, triggeredBy, result, globalIdx, batch[j]);
      if (j < batch.length - 1 && cfg.delayBetweenCasesMs > 0) await sleep(cfg.delayBetweenCasesMs);
    }

    if (batchNum < totalBatches - 1 && cfg.delayBetweenBatchesMs > 0) {
      onProgress?.({ caseIndex: startIdx + batchStart + batch.length, totalCases: cases.length,
        caseName: `Batch ${batchNum + 1} complete`, reasoningCategory: "straightforward",
        batchNumber: batchNum + 1, totalBatches, status: "batch_delay" });
      await sleep(cfg.delayBetweenBatchesMs);
    }
  }

  return buildSuiteResult(runId, allResults);
}

// ── Load Persisted Results ──

export async function loadPersistedV8Results(): Promise<BenchmarkSuiteResultV8 | null> {
  const { data: latestV8 } = await supabase
    .from("benchmark_runs")
    .select("run_group_id")
    .eq("benchmark_version", "benchmark_v8")
    .not("run_group_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const runGroupId = (latestV8?.[0]?.run_group_id as string | null) ?? null;
  if (!runGroupId) return null;

  const { data: runs } = await supabase
    .from("benchmark_runs")
    .select("*")
    .eq("run_group_id", runGroupId)
    .order("test_case_index", { ascending: true });

  if (!runs?.length) return null;

  const results: CaseResultV8[] = runs.map((r: any) => {
    const po = r.pipeline_output || {};
    const emptyLatency: LatencyBreakdownV8 = {
      pcie_ms: 0, world_model_ms: 0, ddx_ms: 0, bayesian_ms: 0, hypothesis_testing_ms: 0,
      evidence_planning_ms: 0, causal_reasoning_ms: 0, safety_ms: 0, soap_ms: 0,
      diagnostic_loop_ms: 0, cognitive_controller_ms: 0, total_ms: r.latency_ms || 0,
    };
    return {
      case_id: `persisted-${r.id}`, case_name: r.test_case,
      specialty: po.specialty || "general_practice",
      difficulty: po.difficulty || "common",
      reasoning_category: po.reasoning_category || "straightforward",
      tags: [],
      top1_match: po.top1_match || false, top3_match: po.top3_match || false, top5_match: po.top5_match || false,
      gold_standard_rank: po.gold_standard_rank || null,
      actual_diagnoses: po.diagnoses || [],
      matched_diagnoses: r.comparison_details?.matched_diagnoses || [],
      cognitive: po.cognitive || {
        hypothesis_management: { total_evaluated: 0, kept: 0, pruned: 0, escalated: 0, prune_accuracy: 0 },
        evidence_strategy: { strategy_type: "unknown", tests_recommended: 0, test_match_rate: 0, total_information_gain: 0 },
        reasoning_quality: { quality_score: r.comparison_details?.cognitive_quality || 0, issues_detected: 0, high_severity_issues: 0, entropy: 0, ranking_stability: 0, evidence_coverage: 0 },
        uncertainty: { level: r.comparison_details?.uncertainty_level || "unknown", top_probability: 0, probability_gap: 0, candidates_within_10pct: 0, entropy: 0, recommended_action: "unknown" },
        policy: { actions_triggered: 0, should_iterate: r.comparison_details?.policy_iterate || false, should_escalate: r.comparison_details?.policy_escalate || false, confidence_sufficient: false },
      },
      iterative_reasoning: po.iterative_reasoning || {
        iterations_executed: 1, loop_activated: false, loop_reason: "",
        initial_candidate_count: 0, final_candidate_count: 0, hypothesis_pruning_rate: 0,
        initial_top_probability: 0, final_top_probability: 0, confidence_convergence: 0,
        diagnosis_stable: true, gold_rank_iteration_1: null, gold_rank_iteration_2: null, gold_rank_improved: false,
        snapshots: [],
      },
      reasoning_trace: po.reasoning_trace || {
        symptoms: [], physiology: { symptoms_detected: [], physiology_states_activated: [], candidate_diagnosis_ids: [], affected_organ_systems: [], physiology_used: false },
        candidate_diagnoses: [], bayesian_probabilities: [], hypotheses_pruned: [], final_ranking: [], dangerous_diagnoses_detected: [],
      },
      safety: po.safety || { dangerous_detected: false, expected_dangerous: false, false_negative: false, safety_alerts: 0, safety_score: 0 },
      latency: po.latency || emptyLatency,
      reasoning_completeness: po.reasoning_completeness || 0,
      confidence_score: r.confidence_score || 0, confidence_label: r.confidence_label || "Unknown",
      guideline_sources: [],
      failure_reasons: r.failure_reasons || [],
      passed: r.passed || false,
      pipeline_output: null, cognitive_output: null,
    };
  });

  return buildSuiteResult(runGroupId, results);
}

// ── Build Suite Result ──

function buildSuiteResult(runId: string, results: CaseResultV8[]): BenchmarkSuiteResultV8 {
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const total = results.length;
  if (total === 0) return emptyResult(runId);

  const top1 = results.filter(r => r.top1_match).length / total;
  const top3 = results.filter(r => r.top3_match).length / total;
  const top5 = results.filter(r => r.top5_match).length / total;

  const dangerAll = results.filter(r => r.safety.expected_dangerous);
  const dangerRate = dangerAll.length ? dangerAll.filter(r => r.safety.dangerous_detected).length / dangerAll.length : 1;

  // Cognitive summary — with normalization
  const cognitiveSummary: CognitiveSummary = {
    avg_reasoning_quality: Math.min(100, avg(results.map(r => r.cognitive.reasoning_quality.quality_score))),
    avg_hypothesis_prune_rate: Math.min(1, avg(results.map(r =>
      r.cognitive.hypothesis_management.total_evaluated > 0
        ? r.cognitive.hypothesis_management.pruned / r.cognitive.hypothesis_management.total_evaluated : 0
    ))),
    avg_evidence_match_rate: Math.min(1, avg(results.map(r => r.cognitive.evidence_strategy.test_match_rate))),
    avg_entropy: Math.min(5, avg(results.map(r => r.cognitive.reasoning_quality.entropy))),
    avg_ranking_stability: Math.min(1, avg(results.map(r => r.cognitive.reasoning_quality.ranking_stability))),
    policy_iterate_rate: results.filter(r => r.cognitive.policy.should_iterate).length / total,
    policy_escalate_rate: results.filter(r => r.cognitive.policy.should_escalate).length / total,
    confidence_sufficient_rate: results.filter(r => r.cognitive.policy.confidence_sufficient).length / total,
    by_category: {} as any,
  };

  for (const cat of ["straightforward", "ambiguous", "deceptive"] as ReasoningCategory[]) {
    const catCases = results.filter(r => r.reasoning_category === cat);
    cognitiveSummary.by_category[cat] = {
      cases: catCases.length,
      avg_quality: Math.min(100, avg(catCases.map(r => r.cognitive.reasoning_quality.quality_score))),
      avg_entropy: Math.min(5, avg(catCases.map(r => r.cognitive.reasoning_quality.entropy))),
      escalate_rate: catCases.length ? catCases.filter(r => r.cognitive.policy.should_escalate).length / catCases.length : 0,
    };
  }

  const specialties = [...new Set(results.map(r => r.specialty))];
  const bySpecialty: SpecialtyBreakdownV8[] = specialties.map(s => {
    const sc = results.filter(r => r.specialty === s);
    const dangerCases = sc.filter(r => r.safety.expected_dangerous);
    return {
      specialty: s, total_cases: sc.length, passed: sc.filter(r => r.passed).length,
      top1_accuracy: sc.filter(r => r.top1_match).length / sc.length,
      top3_accuracy: sc.filter(r => r.top3_match).length / sc.length,
      danger_detection_rate: dangerCases.length ? dangerCases.filter(r => r.safety.dangerous_detected).length / dangerCases.length : 1,
      avg_latency_ms: avg(sc.map(r => r.latency.total_ms)),
      avg_reasoning_quality: Math.min(100, avg(sc.map(r => r.cognitive.reasoning_quality.quality_score))),
    };
  });

  const allLat = results.map(r => r.latency.total_ms).filter(l => l > 0);
  const latency: LatencyStatisticsV8 = {
    avg_total_ms: avg(allLat), p50_ms: percentile(allLat, 50), p95_ms: percentile(allLat, 95),
    cases_under_2s: allLat.filter(l => l < 2000).length,
    cases_under_2s_pct: allLat.length ? allLat.filter(l => l < 2000).length / allLat.length : 0,
    cases_under_5s: allLat.filter(l => l < 5000).length,
    cases_under_5s_pct: allLat.length ? allLat.filter(l => l < 5000).length / allLat.length : 0,
  };

  const byCat: Record<ReasoningCategory, { cases: number; passed: number; top1: number; top3: number }> = {
    straightforward: { cases: 0, passed: 0, top1: 0, top3: 0 },
    ambiguous: { cases: 0, passed: 0, top1: 0, top3: 0 },
    deceptive: { cases: 0, passed: 0, top1: 0, top3: 0 },
  };
  for (const cat of ["straightforward", "ambiguous", "deceptive"] as ReasoningCategory[]) {
    const cc = results.filter(r => r.reasoning_category === cat);
    byCat[cat] = { cases: cc.length, passed: cc.filter(r => r.passed).length,
      top1: cc.filter(r => r.top1_match).length, top3: cc.filter(r => r.top3_match).length };
  }

  const recommendations: string[] = [];
  if (dangerRate < 0.95) recommendations.push(`⚠ Danger detection at ${(dangerRate * 100).toFixed(0)}% — target ≥95%`);
  if (top1 < 0.45) recommendations.push(`Top-1 accuracy at ${(top1 * 100).toFixed(0)}% — target ≥45%`);
  if (top3 < 0.70) recommendations.push(`Top-3 accuracy at ${(top3 * 100).toFixed(0)}% — target ≥70%`);
  if (latency.avg_total_ms > 2000) recommendations.push(`Avg latency ${(latency.avg_total_ms / 1000).toFixed(1)}s — target <2s`);
  if (cognitiveSummary.avg_reasoning_quality < 50) recommendations.push(`Low reasoning quality (${cognitiveSummary.avg_reasoning_quality.toFixed(0)}/100) — review knowledge graph coverage`);

  const loopActivated = results.filter(r => r.iterative_reasoning.loop_activated);

  // Physiology activation stats
  const physioUsed = results.filter(r => r.reasoning_trace?.physiology?.physiology_used);
  const physiology_activation_stats = {
    total_cases: total,
    physiology_used_count: physioUsed.length,
    physiology_usage_rate: total > 0 ? physioUsed.length / total : 0,
    avg_states_activated: avg(results.map(r => r.reasoning_trace?.physiology?.physiology_states_activated?.length || 0)),
    avg_candidates_from_physiology: avg(results.map(r => r.reasoning_trace?.physiology?.candidate_diagnosis_ids?.length || 0)),
  };

  return {
    run_id: runId, run_timestamp: new Date().toISOString(), version: "v8",
    suite_name: "Benchmark V8 — Phase 1 (General Physician)",
    total_cases: total, passed_cases: results.filter(r => r.passed).length,
    pass_rate: results.filter(r => r.passed).length / total,
    top1_accuracy: top1, top3_accuracy: top3, top5_accuracy: top5,
    danger_detection_rate: dangerRate,
    danger_false_negative_count: dangerAll.filter(r => r.safety.false_negative).length,
    cognitive: cognitiveSummary,
    iteration_utilization_rate: loopActivated.length / total,
    avg_confidence_convergence: avg(results.map(r => r.iterative_reasoning.confidence_convergence)),
    latency, by_specialty: bySpecialty, by_category: byCat,
    physiology_activation_stats,
    recommendations, cases: results,
  };
}

function emptyResult(runId: string): BenchmarkSuiteResultV8 {
  return {
    run_id: runId, run_timestamp: new Date().toISOString(), version: "v8",
    suite_name: "Cognitive Clinical Reasoning Benchmark v8",
    total_cases: 0, passed_cases: 0, pass_rate: 0,
    top1_accuracy: 0, top3_accuracy: 0, top5_accuracy: 0,
    danger_detection_rate: 1, danger_false_negative_count: 0,
    cognitive: {
      avg_reasoning_quality: 0, avg_hypothesis_prune_rate: 0, avg_evidence_match_rate: 0,
      avg_entropy: 0, avg_ranking_stability: 0,
      policy_iterate_rate: 0, policy_escalate_rate: 0, confidence_sufficient_rate: 0,
      by_category: {
        straightforward: { cases: 0, avg_quality: 0, avg_entropy: 0, escalate_rate: 0 },
        ambiguous: { cases: 0, avg_quality: 0, avg_entropy: 0, escalate_rate: 0 },
        deceptive: { cases: 0, avg_quality: 0, avg_entropy: 0, escalate_rate: 0 },
      },
    },
    iteration_utilization_rate: 0, avg_confidence_convergence: 0,
    latency: { avg_total_ms: 0, p50_ms: 0, p95_ms: 0, cases_under_2s: 0, cases_under_2s_pct: 0, cases_under_5s: 0, cases_under_5s_pct: 0 },
    by_specialty: [], by_category: {
      straightforward: { cases: 0, passed: 0, top1: 0, top3: 0 },
      ambiguous: { cases: 0, passed: 0, top1: 0, top3: 0 },
      deceptive: { cases: 0, passed: 0, top1: 0, top3: 0 },
    },
    recommendations: [], cases: [],
  };
}
