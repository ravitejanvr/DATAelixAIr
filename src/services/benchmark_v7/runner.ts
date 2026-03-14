/**
 * Benchmark v7 — Iterative Clinical Reasoning Runner
 *
 * Executes 50 scenarios through the full cognitive pipeline,
 * capturing per-iteration reasoning snapshots for process evaluation.
 *
 * Features:
 *   - Per-iteration diagnosis/hypothesis tracking
 *   - Confidence convergence measurement
 *   - Hypothesis pruning rate calculation
 *   - Evidence planning quality scoring
 *   - Batched execution with incremental persistence
 *   - Resume capability
 */

import { BENCHMARK_CASES_V7 } from "./cases";
import type {
  BenchmarkCaseV7, CaseResultV7, BenchmarkSuiteResultV7,
  IterationSnapshot, IterativeReasoningMetrics, EvidencePlanningMetrics,
  SafetyMetrics, LatencyBreakdownV7, LatencyStatisticsV7,
  SpecialtyBreakdownV7, IterativeReasoningSummary,
  FailureRootCause, Specialty, ReasoningCategory,
} from "./types";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import { supabase } from "@/integrations/supabase/client";

// ── Synonym Map (shared with v6) ──

const SYNONYM_MAP: Record<string, string[]> = {
  "acutemyocardialinfarction": ["ami", "mi", "heartattack", "stemi", "nstemi", "myocardialinfarction"],
  "myocardialinfarction": ["ami", "mi", "heartattack", "stemi", "nstemi", "acutemyocardialinfarction"],
  "pulmonaryembolism": ["pe", "pulmonaryembolus", "lungclot"],
  "aorticdissection": ["aorticaneurysmdissection", "dissectingaorticaneurysm"],
  "meningitis": ["bacterialmeningitis", "viralmeningitis"],
  "sepsis": ["septicemia", "septicshock", "systemicinfection", "sirs"],
  "stroke": ["cva", "cerebrovascularaccident", "ischemicstroke", "hemorrhagicstroke"],
  "tensionpneumothorax": ["pneumothorax", "collapsedlung"],
  "subarachnoidhemorrhage": ["sah", "subarachnoidbleed"],
  "appendicitis": ["acuteappendicitis"],
  "stableangina": ["anginapectoris", "angina"],
  "atrialfibrillation": ["afib", "af"],
  "heartfailure": ["chf", "congestiveheartfailure", "acutedecompensatedheartfailure"],
  "acutedecompensatedheartfailure": ["heartfailure", "chf", "heartfailureexacerbation"],
  "pneumonia": ["communityacquiredpneumonia", "cap"],
  "copd": ["chronicobstructivepulmonarydisease", "copdexacerbation"],
  "asthma": ["bronchialasthma", "asthmaexacerbation"],
  "diabeticketoacidosis": ["dka"],
  "hypoglycemia": ["lowbloodsugar", "insulinshock"],
  "guillainbarresyndrome": ["gbs", "guillainbarre"],
  "acutepancreatitis": ["pancreatitis"],
  "cholangitis": ["acutecholangitis", "ascendingcholangitis"],
  "rhabdomyolysis": ["rhabdo"],
  "thromboticthrombocytopenicpurpura": ["ttp"],
  "intussusception": ["intussusceptionreduction"],
  "kawasakidisease": ["kawasaki", "mucocutaneouslymphnodesyndrome"],
  "thyroidstorm": ["thyrotoxiccrisis", "thyrotoxicosis"],
  "takotsubocardiomyopathy": ["takotsubo", "stresscardiomyopathy", "brokenheartsyndrome"],
  "acutepericarditis": ["pericarditis"],
  "supraventriculartachycardia": ["svt"],
  "urinarytractinfection": ["uti", "cystitis"],
  "gastroenteritis": ["acutegastroenteritis", "virualgastroenteritis"],
  "gerd": ["gastroesophagealrefluxdisease", "acidreflux"],
  "type2diabetesmellitus": ["diabetes", "t2dm", "type2diabetes"],
  "acuteotitismedia": ["otitismedia", "earinfection"],
  "tensionheadache": ["tensiontypeheadache"],
  "epilepticseizure": ["seizure", "epilepsy", "generalizedseizure"],
  "cardiacsyncope": ["cardiogenicsyncope", "arrhythmicsyncope"],
  "acutekidneyinjury": ["aki", "acuterenalfailure"],
  "dengue": ["denguefever"],
  "tuberculosis": ["tb", "pulmonarytuberculosis"],
  "bacterialmeningitis": ["meningitis"],
  "malignantpleuraleffusion": ["pleuraleffusion"],
  "laceration": ["wound", "cut"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function synonymMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na.includes(nb) || nb.includes(na)) return true;
  if (na === nb) return true;
  const aSyn = SYNONYM_MAP[na] || [];
  const bSyn = SYNONYM_MAP[nb] || [];
  if (aSyn.includes(nb) || bSyn.includes(na)) return true;
  for (const s of aSyn) { if (bSyn.includes(s) || nb.includes(s) || s.includes(nb)) return true; }
  for (const s of bSyn) { if (na.includes(s) || s.includes(na)) return true; }
  return false;
}

function fuzzyMatch(actual: string[], expected: string[]): string[] {
  return expected.filter(exp => actual.some(act => synonymMatch(act, exp)));
}

function matchRate(actual: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  return fuzzyMatch(actual, expected).length / expected.length;
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Multi-Source Diagnosis Extraction ──

function extractAllDiagnoses(result: ClinicalPipelineResult): string[] {
  const origNames: Array<{ original: string; score: number }> = [];

  function add(name: string, score: number) {
    if (name?.trim()?.length > 1) origNames.push({ original: name.trim(), score });
  }

  const o1 = result.o1_result;
  result.ddx_candidates?.diagnoses?.forEach((d: any, i: number) => add(d.diagnosis || d.diagnosis_name || "", 1000 - i));
  o1?.ddx?.differential_diagnoses?.forEach((d: any, i: number) => add(d.diagnosis_name, 900 - i));

  const hr = o1?.hybrid_reasoning as any;
  hr?.differential_diagnoses?.forEach((d: any, i: number) => add(d.diagnosis_name, 800 - i));
  hr?.top_diagnoses?.forEach((d: any, i: number) => add(typeof d === "string" ? d : d.diagnosis_name || d.name, 750 - i));

  (o1?.bayesian as any)?.diagnoses?.forEach((d: any, i: number) => add(d.diagnosis_name || d.diagnosis, 700 - i));
  (o1?.hypotheses as any)?.hypotheses?.forEach((h: any, i: number) => add(h.hypothesis_name || h.diagnosis || h.name, 600 - i));

  if ((o1?.uncertainty as any)?.top_diagnosis) add((o1.uncertainty as any).top_diagnosis, 850);
  (o1?.uncertainty as any)?.alternative_diagnoses?.forEach((d: any, i: number) => add(d.name || d.diagnosis_name || (typeof d === "string" ? d : ""), 840 - i));

  (o1?.hypothesis_testing as any)?.tested_hypotheses?.forEach((h: any, i: number) => add(h.diagnosis_name, 650 - i + (h.support_score || 0) * 100));

  ((o1?.meta_reasoning as any)?.world_state?.hypotheses || []).forEach((h: string, i: number) => { if (h?.trim()) add(h, 500 - i); });

  // Sort, deduplicate
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
  const hr = o1?.hybrid_reasoning as any;
  hr?.recommended_tests?.forEach((t: any) => labs.add(typeof t === "string" ? t : t.test_name || t.name));
  (o1?.evidence_plan as any)?.planned_tests?.forEach((t: any) => labs.add(typeof t === "string" ? t : t.test_name || t.name || t));
  return [...labs].filter(Boolean);
}

function extractAllMeds(result: ClinicalPipelineResult): string[] {
  const meds = new Set<string>();
  const o1 = result.o1_result;
  result.recommended_medications?.suggestions?.forEach((s: any) => meds.add(s.generic_name));
  o1?.ddx?.suggested_medications?.forEach((m: any) => meds.add(m.generic_name));
  const hr = o1?.hybrid_reasoning as any;
  hr?.treatment_options?.forEach((t: any) => meds.add(typeof t === "string" ? t : t.generic_name || t.name));
  return [...meds].filter(Boolean);
}

// ── Build Iteration Snapshots from Pipeline Output ──

function buildIterationSnapshots(result: ClinicalPipelineResult, gold: string): IterationSnapshot[] {
  const o1 = result.o1_result;
  const snapshots: IterationSnapshot[] = [];

  // === Iteration 1 snapshot ===
  const iter1Diagnoses: Array<{ name: string; probability: number; rank: number }> = [];
  const ddxCandidates = o1?.ddx?.differential_diagnoses || result.ddx_candidates?.diagnoses || [];
  ddxCandidates.forEach((d: any, i: number) => {
    iter1Diagnoses.push({
      name: d.diagnosis_name || d.diagnosis || "",
      probability: d.probability || d.score || 0,
      rank: i + 1,
    });
  });

  const ht1 = o1?.hypothesis_testing;
  const ep1 = o1?.evidence_plan;

  const goldRank1 = iter1Diagnoses.findIndex(d => synonymMatch(d.name, gold));
  const topProb1 = iter1Diagnoses[0]?.probability || 0;
  const secondProb1 = iter1Diagnoses[1]?.probability || 0;

  snapshots.push({
    iteration: 1,
    top_diagnoses: iter1Diagnoses.slice(0, 5),
    candidate_count: iter1Diagnoses.length,
    top_probability: topProb1,
    confidence_gap: topProb1 - secondProb1,
    gold_standard_rank: goldRank1 >= 0 ? goldRank1 + 1 : null,
    gold_standard_probability: goldRank1 >= 0 ? iter1Diagnoses[goldRank1].probability : null,
    hypothesis_testing: {
      tested: ht1?.summary?.total_tested || 0,
      supported: ht1?.summary?.supported || 0,
      pruned: ht1?.summary?.weakly_supported || 0,
    },
    evidence_plan: {
      tests_recommended: ep1?.planned_tests?.map((t: any) => t.test_name || t) || [],
      information_gain: ep1?.summary?.max_information_gain || 0,
    },
    latency_ms: (o1?.stage_latencies?.ddx_engine || 0) +
      (o1?.stage_latencies?.hypothesis_testing || 0) +
      (o1?.stage_latencies?.bayesian_engine || 0),
  });

  // === Iteration 2 snapshot (if diagnostic loop executed) ===
  const dxLoop = o1?.diagnostic_loop;
  if (dxLoop?.executed) {
    // After loop, use bayesian/final diagnoses
    const bayDiagnoses = (o1?.bayesian as any)?.diagnoses || [];
    const iter2Diagnoses: Array<{ name: string; probability: number; rank: number }> = [];
    bayDiagnoses.forEach((d: any, i: number) => {
      iter2Diagnoses.push({
        name: d.diagnosis_name || d.diagnosis || "",
        probability: d.posterior_probability || d.probability || 0,
        rank: i + 1,
      });
    });

    const goldRank2 = iter2Diagnoses.findIndex(d => synonymMatch(d.name, gold));
    const topProb2 = iter2Diagnoses[0]?.probability || 0;
    const secondProb2 = iter2Diagnoses[1]?.probability || 0;

    snapshots.push({
      iteration: 2,
      top_diagnoses: iter2Diagnoses.slice(0, 5),
      candidate_count: iter2Diagnoses.length,
      top_probability: topProb2,
      confidence_gap: topProb2 - secondProb2,
      gold_standard_rank: goldRank2 >= 0 ? goldRank2 + 1 : null,
      gold_standard_probability: goldRank2 >= 0 ? iter2Diagnoses[goldRank2].probability : null,
      hypothesis_testing: {
        tested: dxLoop.candidates_remaining || 0,
        supported: dxLoop.candidates_remaining || 0,
        pruned: dxLoop.candidates_pruned || 0,
      },
      evidence_plan: {
        tests_recommended: snapshots[0].evidence_plan.tests_recommended,
        information_gain: snapshots[0].evidence_plan.information_gain,
      },
      latency_ms: o1?.stage_latencies?.diagnostic_loop || 0,
    });
  }

  return snapshots;
}

// ── Build Iterative Reasoning Metrics ──

function buildIterativeMetrics(snapshots: IterationSnapshot[], dxLoop: any): IterativeReasoningMetrics {
  const iter1 = snapshots[0];
  const iter2 = snapshots.length > 1 ? snapshots[1] : null;
  const loopActivated = !!iter2;

  const initialTop = iter1?.top_diagnoses[0]?.name || "";
  const finalTop = iter2?.top_diagnoses[0]?.name || initialTop;

  // Count ranking shifts
  let shifts = 0;
  if (iter2 && iter1) {
    for (const d of iter1.top_diagnoses) {
      const newEntry = iter2.top_diagnoses.find(d2 => synonymMatch(d.name, d2.name));
      if (newEntry && newEntry.rank !== d.rank) shifts++;
    }
  }

  return {
    iterations_executed: loopActivated ? 2 : 1,
    loop_activated: loopActivated,
    loop_reason: dxLoop?.reason || (loopActivated ? "Low confidence" : "Confidence sufficient"),
    initial_candidate_count: iter1?.candidate_count || 0,
    final_candidate_count: iter2?.candidate_count || iter1?.candidate_count || 0,
    hypothesis_pruning_rate: iter1?.candidate_count > 0
      ? ((iter1.candidate_count - (iter2?.candidate_count || iter1.candidate_count)) / iter1.candidate_count)
      : 0,
    initial_top_probability: iter1?.top_probability || 0,
    final_top_probability: iter2?.top_probability || iter1?.top_probability || 0,
    confidence_convergence: (iter2?.top_probability || iter1?.top_probability || 0) - (iter1?.top_probability || 0),
    diagnosis_stable: !loopActivated || synonymMatch(initialTop, finalTop),
    top_diagnosis_changed: loopActivated && !synonymMatch(initialTop, finalTop),
    ranking_shifts: shifts,
    gold_rank_iteration_1: iter1?.gold_standard_rank || null,
    gold_rank_iteration_2: iter2?.gold_standard_rank || null,
    gold_rank_improved: (iter2?.gold_standard_rank != null && iter1?.gold_standard_rank != null)
      ? iter2.gold_standard_rank < iter1.gold_standard_rank
      : false,
    snapshots,
  };
}

// ── Run Single Case ──

async function runCase(bc: BenchmarkCaseV7): Promise<CaseResultV7> {
  try {
    const result = await runClinicalPipeline(bc.context);
    const o1 = result.o1_result || null;

    const actualDx = extractAllDiagnoses(result);
    const actualLabs = extractAllLabs(result);
    const actualMeds = extractAllMeds(result);

    const goldRank = findGoldRank(actualDx, bc.ground_truth.gold_standard_diagnosis);
    const diagMatch = matchRate(actualDx, [bc.ground_truth.gold_standard_diagnosis, ...bc.ground_truth.alternative_plausible_diagnoses]);
    const labMatch = matchRate(actualLabs, bc.ground_truth.recommended_tests);
    const medMatch = bc.ground_truth.recommended_medications.length === 0 ? 1 : matchRate(actualMeds, bc.ground_truth.recommended_medications);

    // Build iteration snapshots
    const snapshots = buildIterationSnapshots(result, bc.ground_truth.gold_standard_diagnosis);
    const iterativeMetrics = buildIterativeMetrics(snapshots, o1?.diagnostic_loop);

    // Danger detection
    const dangerDetected =
      result.ddx_candidates?.diagnoses?.some((d: any) => d.must_not_miss) ||
      result.safety_alerts?.critical_count > 0 ||
      o1?.ddx?.differential_diagnoses?.some((d: any) => d.must_not_miss) ||
      o1?.ddx?.dangerous_diagnoses_injected > 0 ||
      (o1?.hybrid_reasoning as any)?.dangerous_diagnoses?.length > 0 ||
      (o1?.oversight?.events || []).some((e: any) => e.severity === "critical") ||
      false;

    // Evidence planning
    const evPlan = o1?.evidence_plan;
    const evTests = evPlan?.planned_tests?.map((t: any) => t.test_name || t) || [];
    const discriminativeTests = evPlan?.planned_tests?.filter((t: any) => (t.discrimination_score || 0) > 0.5)
      ?.map((t: any) => t.test_name || t) || [];

    const evidencePlanning: EvidencePlanningMetrics = {
      tests_recommended: evTests,
      test_match_rate: matchRate(evTests, bc.ground_truth.recommended_tests),
      clinical_usefulness_score: evPlan ? Math.min(1, (evTests.length > 0 ? 0.5 : 0) + (discriminativeTests.length > 0 ? 0.5 : 0)) : 0,
      information_gain_score: evPlan?.summary?.max_information_gain || 0,
      discriminative_tests: discriminativeTests,
    };

    const safety: SafetyMetrics = {
      dangerous_detected: dangerDetected,
      expected_dangerous: bc.ground_truth.danger_flag,
      false_negative: bc.ground_truth.danger_flag && !dangerDetected,
      safety_alerts: result.safety_alerts?.critical_count || 0,
      safety_engine_activated: (result.safety_alerts?.alerts?.length || 0) > 0,
      safety_score: result.safety_alerts?.safety_score || 100,
    };

    const latency: LatencyBreakdownV7 = {
      pcie_ms: o1?.stage_latencies?.wave0_pcie || 0,
      world_model_ms: o1?.stage_latencies?.meta_reasoning || 0,
      episodic_memory_ms: o1?.stage_latencies?.episodic_memory || 0,
      ddx_ms: o1?.stage_latencies?.ddx_engine || 0,
      hypothesis_testing_ms: o1?.stage_latencies?.hypothesis_testing || 0,
      bayesian_ms: o1?.stage_latencies?.bayesian_engine || 0,
      evidence_planning_ms: o1?.stage_latencies?.evidence_planning || 0,
      causal_reasoning_ms: o1?.stage_latencies?.causal_reasoning || 0,
      conflict_resolution_ms: o1?.stage_latencies?.conflict_resolution || 0,
      safety_ms: o1?.stage_latencies?.safety_evaluation || 0,
      soap_ms: o1?.stage_latencies?.soap_generation || 0,
      diagnostic_loop_ms: o1?.stage_latencies?.diagnostic_loop || 0,
      iteration_1_ms: snapshots[0]?.latency_ms || 0,
      iteration_2_ms: snapshots[1]?.latency_ms || 0,
      total_ms: result.latency?.total_ms || o1?.total_latency_ms || 0,
    };

    // Reasoning completeness
    const stagesExpected = 10;
    let stagesExecuted = 0;
    if (o1?.ddx) stagesExecuted++;
    if (o1?.bayesian) stagesExecuted++;
    if (o1?.evidence) stagesExecuted++;
    if (o1?.hypothesis_testing) stagesExecuted++;
    if (o1?.uncertainty) stagesExecuted++;
    if (o1?.oversight) stagesExecuted++;
    if (o1?.hybrid_reasoning || o1?.soap_fallback) stagesExecuted++;
    if (o1?.meta_reasoning) stagesExecuted++;
    if (o1?.causal_reasoning) stagesExecuted++;
    if (o1?.episodic_memory) stagesExecuted++;

    // Failure analysis
    const failures: string[] = [];
    let rootCause: FailureRootCause | null = null;
    if (!goldRank || goldRank > 3) {
      failures.push(`Gold "${bc.ground_truth.gold_standard_diagnosis}" not in top 3`);
      rootCause = actualDx.length === 0 ? "knowledge_graph_gap" : "bayesian_probability_error";
    }
    if (bc.ground_truth.danger_flag && !dangerDetected) {
      failures.push("Dangerous diagnosis missed");
      rootCause = rootCause || "safety_engine_failure";
    }

    const passed = (goldRank !== null && goldRank <= 5) || (diagMatch >= 0.5 && (!bc.ground_truth.danger_flag || dangerDetected));

    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty,
      difficulty: bc.difficulty, reasoning_category: bc.reasoning_category, tags: bc.tags,
      top1_match: goldRank === 1, top3_match: goldRank !== null && goldRank <= 3,
      top5_match: goldRank !== null && goldRank <= 5,
      diagnosis_match_rate: diagMatch, lab_match_rate: labMatch, medication_match_rate: medMatch,
      gold_standard_rank: goldRank,
      matched_diagnoses: fuzzyMatch(actualDx, [bc.ground_truth.gold_standard_diagnosis, ...bc.ground_truth.alternative_plausible_diagnoses]),
      actual_diagnoses: actualDx, actual_labs: actualLabs, actual_medications: actualMeds,
      iterative_reasoning: iterativeMetrics,
      evidence_planning: evidencePlanning,
      safety, latency,
      reasoning_completeness: stagesExecuted / stagesExpected,
      confidence_score: result.confidence_scores?.confidence_score || (o1?.uncertainty as any)?.confidence_score || 0,
      confidence_label: result.confidence_scores?.confidence_label || (o1?.uncertainty as any)?.confidence_label || "Unknown",
      guideline_sources: result.guidelines?.sources_used || o1?.guideline_summary?.guideline_sources_used || [],
      failure_reasons: failures, failure_root_cause: rootCause,
      pipeline_output: result, o1_result: o1, passed,
    };
  } catch (error) {
    console.error(`[BenchmarkV7] Case ${bc.id} failed:`, error);
    const emptyLatency: LatencyBreakdownV7 = { pcie_ms: 0, world_model_ms: 0, episodic_memory_ms: 0, ddx_ms: 0, hypothesis_testing_ms: 0, bayesian_ms: 0, evidence_planning_ms: 0, causal_reasoning_ms: 0, conflict_resolution_ms: 0, safety_ms: 0, soap_ms: 0, diagnostic_loop_ms: 0, iteration_1_ms: 0, iteration_2_ms: 0, total_ms: 0 };
    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty,
      difficulty: bc.difficulty, reasoning_category: bc.reasoning_category, tags: bc.tags,
      top1_match: false, top3_match: false, top5_match: false,
      diagnosis_match_rate: 0, lab_match_rate: 0, medication_match_rate: 0, gold_standard_rank: null,
      matched_diagnoses: [], actual_diagnoses: [], actual_labs: [], actual_medications: [],
      iterative_reasoning: {
        iterations_executed: 0, loop_activated: false, loop_reason: "Error",
        initial_candidate_count: 0, final_candidate_count: 0, hypothesis_pruning_rate: 0,
        initial_top_probability: 0, final_top_probability: 0, confidence_convergence: 0,
        diagnosis_stable: true, top_diagnosis_changed: false, ranking_shifts: 0,
        gold_rank_iteration_1: null, gold_rank_iteration_2: null, gold_rank_improved: false,
        snapshots: [],
      },
      evidence_planning: { tests_recommended: [], test_match_rate: 0, clinical_usefulness_score: 0, information_gain_score: 0, discriminative_tests: [] },
      safety: { dangerous_detected: false, expected_dangerous: bc.ground_truth.danger_flag, false_negative: bc.ground_truth.danger_flag, safety_alerts: 0, safety_engine_activated: false, safety_score: 0 },
      latency: emptyLatency,
      reasoning_completeness: 0, confidence_score: 0, confidence_label: "Error", guideline_sources: [],
      failure_reasons: [`Pipeline error: ${error}`], failure_root_cause: "timeout_error",
      pipeline_output: null, o1_result: null, passed: false,
    };
  }
}

// ── Persistence ──

async function persistCase(runGroupId: string, triggeredBy: string | null, r: CaseResultV7, idx: number, bc: BenchmarkCaseV7) {
  try {
    const { error } = await supabase.from("benchmark_runs").insert({
      run_group_id: runGroupId,
      benchmark_version: "benchmark_v7",
      pipeline_type: "cognitive_v4.3_iterative",
      test_case: r.case_name,
      test_case_index: idx,
      passed: r.passed,
      diagnosis_agreement: Math.round(r.diagnosis_match_rate * 100),
      lab_agreement: Math.round(r.lab_match_rate * 100),
      medication_agreement: Math.round(r.medication_match_rate * 100),
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
        top1_match: r.top1_match,
        top3_match: r.top3_match,
        top5_match: r.top5_match,
        gold_standard_rank: r.gold_standard_rank,
        specialty: r.specialty,
        difficulty: r.difficulty,
        reasoning_category: r.reasoning_category,
        iterative_reasoning: r.iterative_reasoning,
        evidence_planning: r.evidence_planning,
        safety: r.safety,
        latency: r.latency,
        reasoning_completeness: r.reasoning_completeness,
        failure_root_cause: r.failure_root_cause,
      } as any,
      comparison_details: {
        matched_diagnoses: r.matched_diagnoses,
        iteration_count: r.iterative_reasoning.iterations_executed,
        loop_activated: r.iterative_reasoning.loop_activated,
        confidence_convergence: r.iterative_reasoning.confidence_convergence,
        pruning_rate: r.iterative_reasoning.hypothesis_pruning_rate,
      } as any,
      triggered_by: triggeredBy,
    });
    if (error) {
      console.error(`[BenchmarkV7] Persist error for ${r.case_id}:`, error.message, error.details);
    }
  } catch (e) {
    console.error(`[BenchmarkV7] Persist exception for ${r.case_id}:`, e);
  }
}

// ── Batch Runner ──

export interface BatchConfigV7 {
  batchSize: number;
  delayBetweenBatchesMs: number;
  delayBetweenCasesMs: number;
  startFromCase: number;
  persistResults: boolean;
}

export interface BatchProgressV7 {
  caseIndex: number;
  totalCases: number;
  caseName: string;
  reasoningCategory: ReasoningCategory;
  batchNumber: number;
  totalBatches: number;
  completedInBatch: number;
  status: "running" | "batch_delay" | "credit_error" | "done";
  errorMessage?: string;
}

const DEFAULT_CONFIG: BatchConfigV7 = {
  batchSize: 5,
  delayBetweenBatchesMs: 3000,
  delayBetweenCasesMs: 500,
  startFromCase: 0,
  persistResults: true,
};

export async function runBenchmarkV7(
  onProgress?: (p: BatchProgressV7) => void,
  onBatchComplete?: (results: CaseResultV7[], batchNum: number) => void,
  caseFilter?: (c: BenchmarkCaseV7) => boolean,
  config?: Partial<BatchConfigV7>,
  abortSignal?: AbortSignal,
): Promise<BenchmarkSuiteResultV7> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const runId = crypto.randomUUID();
  const { data: authData } = await supabase.auth.getUser();
  const triggeredBy = authData.user?.id ?? null;
  const cases = caseFilter ? BENCHMARK_CASES_V7.filter(caseFilter) : BENCHMARK_CASES_V7;
  const startIdx = Math.min(cfg.startFromCase, cases.length);
  const remaining = cases.slice(startIdx);
  const totalBatches = Math.ceil(remaining.length / cfg.batchSize);
  const allResults: CaseResultV7[] = [];

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    if (abortSignal?.aborted) break;
    const batchStart = batchNum * cfg.batchSize;
    const batch = remaining.slice(batchStart, batchStart + cfg.batchSize);
    const batchResults: CaseResultV7[] = [];

    for (let j = 0; j < batch.length; j++) {
      if (abortSignal?.aborted) break;
      const globalIdx = startIdx + batchStart + j;
      onProgress?.({
        caseIndex: globalIdx, totalCases: cases.length, caseName: batch[j].name,
        reasoningCategory: batch[j].reasoning_category,
        batchNumber: batchNum + 1, totalBatches, completedInBatch: j, status: "running",
      });

      const result = await runCase(batch[j]);
      batchResults.push(result);
      allResults.push(result);

      if (result.failure_reasons.some(f => f.includes("402") || f.includes("credit"))) {
        onProgress?.({
          caseIndex: globalIdx, totalCases: cases.length, caseName: batch[j].name,
          reasoningCategory: batch[j].reasoning_category,
          batchNumber: batchNum + 1, totalBatches, completedInBatch: j + 1,
          status: "credit_error", errorMessage: "AI credits exhausted",
        });
        if (cfg.persistResults) await persistCase(runId, triggeredBy, result, globalIdx, batch[j]);
        return buildSuiteResult(runId, allResults);
      }

      if (cfg.persistResults) await persistCase(runId, triggeredBy, result, globalIdx, batch[j]);
      if (j < batch.length - 1 && cfg.delayBetweenCasesMs > 0) await sleep(cfg.delayBetweenCasesMs);
    }

    onBatchComplete?.(batchResults, batchNum + 1);
    if (batchNum < totalBatches - 1 && cfg.delayBetweenBatchesMs > 0) {
      onProgress?.({
        caseIndex: startIdx + batchStart + batch.length, totalCases: cases.length,
        caseName: `Batch ${batchNum + 1} complete`, reasoningCategory: "straightforward",
        batchNumber: batchNum + 1, totalBatches, completedInBatch: batch.length, status: "batch_delay",
      });
      await sleep(cfg.delayBetweenBatchesMs);
    }
  }

  return buildSuiteResult(runId, allResults);
}

// ── Load Persisted Results ──

export async function loadPersistedV7Results(): Promise<BenchmarkSuiteResultV7 | null> {
  // Prefer true v7 runs first
  const { data: latestV7 } = await supabase
    .from("benchmark_runs")
    .select("run_group_id, benchmark_version")
    .eq("benchmark_version", "benchmark_v7")
    .not("run_group_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  let runGroupId: string | null = (latestV7?.[0]?.run_group_id as string | null) ?? null;
  let sourceVersion: string = latestV7?.[0]?.benchmark_version ?? "benchmark_v7";

  // Fallback: load latest legacy benchmark group so old results are still visible
  if (!runGroupId) {
    const { data: latestAny } = await supabase
      .from("benchmark_runs")
      .select("run_group_id, benchmark_version")
      .not("run_group_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    runGroupId = (latestAny?.[0]?.run_group_id as string | null) ?? null;
    sourceVersion = latestAny?.[0]?.benchmark_version ?? sourceVersion;
  }

  if (!runGroupId) return null;

  const { data: runs } = await supabase
    .from("benchmark_runs")
    .select("*")
    .eq("run_group_id", runGroupId)
    .order("test_case_index", { ascending: true });

  if (!runs?.length) return null;

  const results: CaseResultV7[] = runs.map((r: any) => {
    const po = r.pipeline_output || {};
    const emptyLatency: LatencyBreakdownV7 = { pcie_ms: 0, world_model_ms: 0, episodic_memory_ms: 0, ddx_ms: 0, hypothesis_testing_ms: 0, bayesian_ms: 0, evidence_planning_ms: 0, causal_reasoning_ms: 0, conflict_resolution_ms: 0, safety_ms: 0, soap_ms: 0, diagnostic_loop_ms: 0, iteration_1_ms: 0, iteration_2_ms: 0, total_ms: r.latency_ms || 0 };
    return {
      case_id: `persisted-${r.id}`,
      case_name: r.test_case,
      specialty: po.specialty || "emergency_medicine",
      difficulty: po.difficulty || "common",
      reasoning_category: po.reasoning_category || "straightforward",
      tags: [],
      top1_match: po.top1_match || false,
      top3_match: po.top3_match || false,
      top5_match: po.top5_match || false,
      diagnosis_match_rate: (r.diagnosis_agreement || 0) / 100,
      lab_match_rate: (r.lab_agreement || 0) / 100,
      medication_match_rate: (r.medication_agreement || 0) / 100,
      gold_standard_rank: po.gold_standard_rank || null,
      matched_diagnoses: r.comparison_details?.matched_diagnoses || [],
      actual_diagnoses: po.diagnoses || [],
      actual_labs: [],
      actual_medications: [],
      iterative_reasoning: po.iterative_reasoning || {
        iterations_executed: r.comparison_details?.iteration_count || 1,
        loop_activated: r.comparison_details?.loop_activated || false,
        loop_reason: "",
        initial_candidate_count: 0,
        final_candidate_count: 0,
        hypothesis_pruning_rate: r.comparison_details?.pruning_rate || 0,
        initial_top_probability: 0,
        final_top_probability: 0,
        confidence_convergence: r.comparison_details?.confidence_convergence || 0,
        diagnosis_stable: true,
        top_diagnosis_changed: false,
        ranking_shifts: 0,
        gold_rank_iteration_1: null,
        gold_rank_iteration_2: null,
        gold_rank_improved: false,
        snapshots: [],
      },
      evidence_planning: po.evidence_planning || { tests_recommended: [], test_match_rate: 0, clinical_usefulness_score: 0, information_gain_score: 0, discriminative_tests: [] },
      safety: po.safety || { dangerous_detected: false, expected_dangerous: false, false_negative: false, safety_alerts: r.safety_alerts || 0, safety_engine_activated: false, safety_score: 0 },
      latency: po.latency || emptyLatency,
      reasoning_completeness: po.reasoning_completeness || 0,
      confidence_score: r.confidence_score || 0,
      confidence_label: r.confidence_label || "Unknown",
      guideline_sources: [],
      failure_reasons: r.failure_reasons || [],
      failure_root_cause: po.failure_root_cause || null,
      pipeline_output: null,
      o1_result: null,
      passed: r.passed || false,
    };
  });

  const suite = buildSuiteResult(runGroupId, results);
  return sourceVersion === "benchmark_v7"
    ? suite
    : { ...suite, suite_name: `Benchmark history (${sourceVersion})` };
}

export async function getCompletedV7Count(): Promise<{ runGroupId: string | null; count: number }> {
  const { data } = await supabase
    .from("benchmark_runs").select("run_group_id")
    .eq("benchmark_version", "benchmark_v7")
    .order("created_at", { ascending: false }).limit(1);
  if (!data?.length) return { runGroupId: null, count: 0 };
  const { count } = await supabase
    .from("benchmark_runs").select("*", { count: "exact", head: true })
    .eq("run_group_id", data[0].run_group_id);
  return { runGroupId: data[0].run_group_id, count: count || 0 };
}

// ── Build Suite Result ──

function buildSuiteResult(runId: string, results: CaseResultV7[]): BenchmarkSuiteResultV7 {
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const total = results.length;

  const top1 = total ? results.filter(r => r.top1_match).length / total : 0;
  const top3 = total ? results.filter(r => r.top3_match).length / total : 0;
  const top5 = total ? results.filter(r => r.top5_match).length / total : 0;

  const dangerAll = results.filter(r => r.safety.expected_dangerous);
  const dangerRate = dangerAll.length ? dangerAll.filter(r => r.safety.dangerous_detected).length / dangerAll.length : 1;

  // Iterative reasoning summary
  const loopActivated = results.filter(r => r.iterative_reasoning.loop_activated);
  const categoryBreakdown: Record<ReasoningCategory, { cases: number; loop_rate: number; avg_convergence: number; top3_accuracy: number }> = {
    straightforward: { cases: 0, loop_rate: 0, avg_convergence: 0, top3_accuracy: 0 },
    ambiguous: { cases: 0, loop_rate: 0, avg_convergence: 0, top3_accuracy: 0 },
    deceptive: { cases: 0, loop_rate: 0, avg_convergence: 0, top3_accuracy: 0 },
  };
  for (const cat of ["straightforward", "ambiguous", "deceptive"] as ReasoningCategory[]) {
    const catCases = results.filter(r => r.reasoning_category === cat);
    if (catCases.length > 0) {
      categoryBreakdown[cat] = {
        cases: catCases.length,
        loop_rate: catCases.filter(r => r.iterative_reasoning.loop_activated).length / catCases.length,
        avg_convergence: avg(catCases.map(r => r.iterative_reasoning.confidence_convergence)),
        top3_accuracy: catCases.filter(r => r.top3_match).length / catCases.length,
      };
    }
  }

  const iterativeSummary: IterativeReasoningSummary = {
    iteration_utilization_rate: total ? loopActivated.length / total : 0,
    avg_pruning_rate: avg(results.map(r => r.iterative_reasoning.hypothesis_pruning_rate)),
    avg_confidence_convergence: avg(results.map(r => r.iterative_reasoning.confidence_convergence)),
    diagnostic_stability_rate: total ? results.filter(r => r.iterative_reasoning.diagnosis_stable).length / total : 0,
    gold_rank_improvement_rate: loopActivated.length ? loopActivated.filter(r => r.iterative_reasoning.gold_rank_improved).length / loopActivated.length : 0,
    by_category: categoryBreakdown,
  };

  // Specialty breakdown
  const specialties = [...new Set(results.map(r => r.specialty))];
  const bySpecialty: SpecialtyBreakdownV7[] = specialties.map(s => {
    const sc = results.filter(r => r.specialty === s);
    const dangerCases = sc.filter(r => r.safety.expected_dangerous);
    return {
      specialty: s,
      total_cases: sc.length,
      passed: sc.filter(r => r.passed).length,
      top1_accuracy: sc.length ? sc.filter(r => r.top1_match).length / sc.length : 0,
      top3_accuracy: sc.length ? sc.filter(r => r.top3_match).length / sc.length : 0,
      top5_accuracy: sc.length ? sc.filter(r => r.top5_match).length / sc.length : 0,
      avg_latency_ms: avg(sc.map(r => r.latency.total_ms)),
      danger_detection_rate: dangerCases.length ? dangerCases.filter(r => r.safety.dangerous_detected).length / dangerCases.length : 1,
      avg_pruning_rate: avg(sc.map(r => r.iterative_reasoning.hypothesis_pruning_rate)),
      avg_convergence: avg(sc.map(r => r.iterative_reasoning.confidence_convergence)),
    };
  });

  // Latency
  const allLat = results.map(r => r.latency.total_ms).filter(l => l > 0);
  const latency: LatencyStatisticsV7 = {
    avg_total_ms: avg(allLat),
    p50_ms: percentile(allLat, 50),
    p95_ms: percentile(allLat, 95),
    avg_per_stage: {
      pcie: avg(results.map(r => r.latency.pcie_ms)),
      world_model: avg(results.map(r => r.latency.world_model_ms)),
      ddx: avg(results.map(r => r.latency.ddx_ms)),
      hypothesis_testing: avg(results.map(r => r.latency.hypothesis_testing_ms)),
      bayesian: avg(results.map(r => r.latency.bayesian_ms)),
      evidence_planning: avg(results.map(r => r.latency.evidence_planning_ms)),
      safety: avg(results.map(r => r.latency.safety_ms)),
      diagnostic_loop: avg(results.map(r => r.latency.diagnostic_loop_ms)),
      soap: avg(results.map(r => r.latency.soap_ms)),
    },
    cases_under_2s: allLat.filter(l => l < 2000).length,
    cases_under_2s_pct: allLat.length ? allLat.filter(l => l < 2000).length / allLat.length : 0,
    cases_under_5s: allLat.filter(l => l < 5000).length,
    cases_under_5s_pct: allLat.length ? allLat.filter(l => l < 5000).length / allLat.length : 0,
  };

  // By category
  const byCat: Record<ReasoningCategory, { cases: number; passed: number; top1: number; top3: number }> = {
    straightforward: { cases: 0, passed: 0, top1: 0, top3: 0 },
    ambiguous: { cases: 0, passed: 0, top1: 0, top3: 0 },
    deceptive: { cases: 0, passed: 0, top1: 0, top3: 0 },
  };
  for (const cat of ["straightforward", "ambiguous", "deceptive"] as ReasoningCategory[]) {
    const cc = results.filter(r => r.reasoning_category === cat);
    byCat[cat] = {
      cases: cc.length,
      passed: cc.filter(r => r.passed).length,
      top1: cc.filter(r => r.top1_match).length,
      top3: cc.filter(r => r.top3_match).length,
    };
  }

  // Recommendations
  const recommendations: string[] = [];
  if (dangerRate < 0.95) recommendations.push(`⚠ Danger detection at ${(dangerRate * 100).toFixed(0)}% — target ≥95%`);
  if (top1 < 0.50) recommendations.push(`Top-1 accuracy at ${(top1 * 100).toFixed(0)}% — target ≥50%`);
  if (top3 < 0.75) recommendations.push(`Top-3 accuracy at ${(top3 * 100).toFixed(0)}% — target ≥75%`);
  if (latency.avg_total_ms > 2000) recommendations.push(`Avg latency ${(latency.avg_total_ms / 1000).toFixed(1)}s — target <2s`);
  if (iterativeSummary.iteration_utilization_rate < 0.10) recommendations.push("Diagnostic loop rarely activating — review confidence thresholds");
  if (iterativeSummary.iteration_utilization_rate > 0.30) recommendations.push("Diagnostic loop over-activating — increase min_top_probability threshold");
  if (iterativeSummary.gold_rank_improvement_rate < 0.5 && loopActivated.length > 0) recommendations.push("Loop iterations not improving gold rank — review hypothesis pruning logic");

  const knowledgeGaps: string[] = [];
  for (const s of specialties) {
    const specCases = results.filter(r => r.specialty === s);
    const graphMisses = specCases.filter(r => r.actual_diagnoses.length === 0);
    if (graphMisses.length >= 2) knowledgeGaps.push(`${s}: ${graphMisses.length}/${specCases.length} graph misses`);
  }

  return {
    run_id: runId, run_timestamp: new Date().toISOString(), version: "v7",
    suite_name: "Iterative Clinical Reasoning Benchmark v7",
    total_cases: total, passed_cases: results.filter(r => r.passed).length,
    pass_rate: total ? results.filter(r => r.passed).length / total : 0,
    top1_accuracy: top1, top3_accuracy: top3, top5_accuracy: top5,
    avg_diagnosis_match: avg(results.map(r => r.diagnosis_match_rate)),
    danger_detection_rate: dangerRate,
    danger_false_negative_count: dangerAll.filter(r => r.safety.false_negative).length,
    iterative_reasoning: iterativeSummary,
    avg_evidence_plan_accuracy: avg(results.map(r => r.evidence_planning.test_match_rate)),
    latency,
    by_specialty: bySpecialty,
    by_category: byCat,
    recommendations, knowledge_gaps: knowledgeGaps,
    cases: results,
  };
}
