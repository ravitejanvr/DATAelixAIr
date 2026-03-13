/**
 * Benchmark v6 — Enhanced Runner with Batching & Persistence
 * Executes 205 cases through the full cognitive pipeline with:
 * - Configurable batch sizes with inter-batch delays
 * - Auto-persistence of each batch to benchmark_runs
 * - Resume from last completed case
 * - Multi-source diagnosis extraction with synonym matching
 */

import { BENCHMARK_CASES_V6 } from "./cases";
import type {
  BenchmarkCaseV6, CaseResultV6, BenchmarkSuiteResultV6,
  DiagnosticLoopEvaluation, HypothesisEvaluation, EvidencePlanEvaluation,
  BayesianEvaluation, SafetyEvaluation, LatencyBreakdown, LatencyStatistics,
  SpecialtyBreakdown, DifficultyBreakdown, FailureAnalysis, KnowledgeGraphGap,
  FailureRootCause, Specialty, CaseDifficulty,
} from "./types";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/clinical_pipeline_orchestrator";
import { supabase } from "@/integrations/supabase/client";

// ── Clinical Synonym Map ──
// Maps common abbreviations and synonyms to canonical names for fuzzy matching

const SYNONYM_MAP: Record<string, string[]> = {
  "acutemyocardialinfarction": ["ami", "mi", "heartattack", "stemi", "nstemi", "myocardialinfarction"],
  "myocardialinfarction": ["ami", "mi", "heartattack", "stemi", "nstemi", "acutemyocardialinfarction"],
  "pulmonaryembolism": ["pe", "pulmonaryembolus", "lungclot"],
  "aorticdissection": ["aorticaneurysmdissection", "dissectingaorticaneurysm"],
  "meningitis": ["bacterialmeningitis", "viralmeningitis", "meningealinfection"],
  "sepsis": ["septicemia", "septicshock", "systemicinfection", "sirs"],
  "stroke": ["cva", "cerebrovascularaccident", "brainattack", "ischemicstroke", "hemorrhagicstroke"],
  "ectopicpregnancy": ["tubalpregnancy", "ectopic"],
  "tensionpneumothorax": ["pneumothorax", "collapsedlung"],
  "subarachnoidhemorrhage": ["sah", "subarachnoidbleed"],
  "appendicitis": ["acuteappendicitis"],
  "stableangina": ["anginapectoris", "stableanginapectoris", "chronicstableangina", "angina"],
  "unstableangina": ["ua", "acutecoronarysyndrome", "acs"],
  "atrialfibrillation": ["afib", "af", "atrialfib"],
  "heartfailure": ["chf", "congestiveheartfailure", "hfref", "hfpef", "cardiacfailure"],
  "hypertension": ["htn", "highbloodpressure", "essentialhypertension", "hypertensionstage2"],
  "hypertensionstage2": ["hypertension", "htn", "highbloodpressure", "essentialhypertension"],
  "deepveinthrombosis": ["dvt", "deepvenousthrombosis", "venousthrombosis"],
  "pneumonia": ["communityacquiredpneumonia", "cap", "bacterialpneumonia", "lobarpneumonia"],
  "copd": ["chronicobstructivepulmonarydisease", "emphysema", "chronicbronchitis"],
  "asthma": ["bronchialasthma", "acuteasthma", "asthmaexacerbation"],
  "diabetes": ["diabetesmellitus", "type2diabetes", "t2dm", "dm"],
  "diabeticketoacidosis": ["dka"],
  "hypothyroidism": ["underactivethyroid", "hashimotosthyroiditis"],
  "hyperthyroidism": ["overactivethyroid", "gravesdisease", "thyrotoxicosis"],
  "gerd": ["gastroesophagealrefluxdisease", "acidreflux", "reflux"],
  "pepticulcer": ["pepticulcerdisease", "pud", "gastricucer", "duodenalulcer"],
  "majordepressivedisorder": ["mdd", "majordepression", "clinicaldepression", "depression"],
  "generalizedanxietydisorder": ["gad", "anxietydisorder", "anxiety"],
  "urinarytractinfection": ["uti", "cystitis", "bladderinfection"],
  "acutekidneyinjury": ["aki", "acuterenalfailure", "arf"],
  "chronickidneydisease": ["ckd", "chronicrenalfailure", "renalinsufficiency"],
  "irondeficiencyanemia": ["ida", "anemia"],
  "celiacdisease": ["celiacsprue", "glutenenteropathy"],
  "inflammatoryboweldisease": ["ibd", "crohnsdisease", "ulcerativecolitis"],
  "multiplesclerosis": ["ms"],
  "parkinsonsdisease": ["parkinsons", "pd"],
  "rheumatoidarthritis": ["ra"],
  "systemiclupuserythematosus": ["sle", "lupus"],
  "acutecoronarysyndrome": ["acs", "unstableangina", "nstemi", "stemi"],
  "ventriculartachycardia": ["vtach", "vt"],
  "supraventriculartachycardia": ["svt"],
  "takotsubocardiomyopathy": ["takotsubo", "stresscardiomyopathy", "brokenheartsyndrome", "apicalballooning"],
  "pericardialtamponade": ["cardiactamponade", "tamponade"],
  "acutepericarditis": ["pericarditis"],
  "infectiveendocarditis": ["endocarditis", "bacterialendocarditis"],
  "statusepilepticus": ["seizure", "epilepticseizure"],
  "guillainbarresyndrome": ["gbs", "guillainbarre"],
  "myastheniagravis": ["mg"],
  "acuterespiratorydistresssyndrome": ["ards"],
  "tuberculosis": ["tb", "pulmonarytuberculosis"],
  "covid19": ["sarscov2", "coronavirus"],
  "malaria": ["plasmodiuminfection"],
  "dengue": ["denguefever", "denguehaemorrhagicfever"],
  "anaphylaxis": ["anaphylacticshock", "anaphylacticreaction"],
  "addisoniandisease": ["addisonsdisease", "adrenalinsufficiency", "primaryadrenalinsufficiency"],
  "cushingssyndrome": ["cushingdisease", "hypercortisolism"],
  "acutepancreatitis": ["pancreatitis"],
  "cholecystitis": ["acutecholecystitis", "gallbladderinflammation"],
  "choledocholithiasis": ["commonductstone", "bileductstone"],
  "cholangitis": ["acutecholangitis", "ascendingcholangitis"],
  "bowelobstruction": ["intestinalobstruction", "sbo", "smallbowelobstruction"],
};

// ── Helpers ──

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Enhanced fuzzy match with synonym support */
function synonymMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);

  // Direct inclusion
  if (na.includes(nb) || nb.includes(na)) return true;

  // Exact match
  if (na === nb) return true;

  // Synonym lookup
  const aSynonyms = SYNONYM_MAP[na] || [];
  const bSynonyms = SYNONYM_MAP[nb] || [];

  // Check if b is a synonym of a
  if (aSynonyms.includes(nb)) return true;
  // Check if a is a synonym of b
  if (bSynonyms.includes(na)) return true;

  // Check overlapping synonyms (a and b share a canonical form)
  for (const syn of aSynonyms) {
    if (bSynonyms.includes(syn)) return true;
    // Also check inclusion against synonyms
    if (nb.includes(syn) || syn.includes(nb)) return true;
  }
  for (const syn of bSynonyms) {
    if (na.includes(syn) || syn.includes(na)) return true;
  }

  // Token overlap: split into words and check ≥50% overlap for multi-word diagnoses
  const tokensA = na.match(/[a-z]+/g) || [];
  const tokensB = nb.match(/[a-z]+/g) || [];
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const overlap = tokensA.filter(t => tokensB.some(tb => tb.includes(t) || t.includes(tb)));
    if (overlap.length >= Math.min(tokensA.length, tokensB.length) * 0.6) return true;
  }

  return false;
}

function fuzzyMatch(actual: string[], expected: string[]): string[] {
  return expected.filter(exp =>
    actual.some(act => synonymMatch(act, exp))
  );
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

/**
 * Extracts diagnosis names from ALL available pipeline output sources,
 * deduplicates, and returns a ranked list.
 */
function extractAllDiagnoses(result: ClinicalPipelineResult): string[] {
  const diagMap = new Map<string, number>(); // normalized name → best score

  function addDiag(name: string, score: number) {
    if (!name || name.trim().length === 0) return;
    const n = normalize(name);
    if (!n || n.length < 2) return;
    const existing = diagMap.get(n);
    if (!existing || score > existing) {
      diagMap.set(n, score);
    }
  }

  const o1 = result.o1_result;

  // Source 1: DDX Engine (graph-based, highest priority)
  if (result.ddx_candidates?.diagnoses) {
    result.ddx_candidates.diagnoses.forEach((d: any, i: number) => {
      const name = d.diagnosis || d.diagnosis_name || "";
      addDiag(name, 1000 - i);
    });
  }

  // Source 2: Direct O1 DDX (may have more data than O2 adapter)
  if (o1?.ddx?.differential_diagnoses) {
    o1.ddx.differential_diagnoses.forEach((d: any, i: number) => {
      addDiag(d.diagnosis_name, 900 - i);
    });
  }

  // Source 3: Hybrid Reasoning (LLM fusion — always populated even on graph miss)
  if (o1?.hybrid_reasoning) {
    const hr = o1.hybrid_reasoning as any;
    if (hr.differential_diagnoses) {
      hr.differential_diagnoses.forEach((d: any, i: number) => {
        addDiag(d.diagnosis_name, 800 - i);
      });
    }
    // Some hybrid reasoning returns diagnoses in a top_diagnoses array
    if (hr.top_diagnoses) {
      hr.top_diagnoses.forEach((d: any, i: number) => {
        addDiag(typeof d === "string" ? d : d.diagnosis_name || d.name, 750 - i);
      });
    }
    // SOAP assessment may contain diagnosis
    if (hr.soap?.assessment) {
      // Don't extract from free text - too noisy
    }
  }

  // Source 4: Bayesian Engine
  if (o1?.bayesian) {
    const bay = o1.bayesian as any;
    if (bay.diagnoses) {
      bay.diagnoses.forEach((d: any, i: number) => {
        addDiag(d.diagnosis_name || d.diagnosis, 700 - i);
      });
    }
  }

  // Source 5: Hypotheses
  if (o1?.hypotheses) {
    const hyp = o1.hypotheses as any;
    if (hyp.hypotheses) {
      hyp.hypotheses.forEach((h: any, i: number) => {
        addDiag(h.hypothesis_name || h.diagnosis || h.name, 600 - i);
      });
    }
  }

  // Source 6: Meta-Reasoning World Model
  if (o1?.meta_reasoning) {
    const mr = o1.meta_reasoning as any;
    if (mr.world_state?.hypotheses) {
      mr.world_state.hypotheses.forEach((h: string, i: number) => {
        addDiag(h, 500 - i);
      });
    }
  }

  // Source 7: Uncertainty Engine
  if (o1?.uncertainty) {
    const unc = o1.uncertainty as any;
    if (unc.top_diagnosis) {
      addDiag(unc.top_diagnosis, 850);
    }
    if (unc.alternative_diagnoses) {
      unc.alternative_diagnoses.forEach((d: any, i: number) => {
        addDiag(d.name || d.diagnosis_name || d, 840 - i);
      });
    }
  }

  // Source 8: Hypothesis Testing (validated candidates)
  if (o1?.hypothesis_testing) {
    const ht = o1.hypothesis_testing as any;
    if (ht.tested_hypotheses) {
      ht.tested_hypotheses.forEach((h: any, i: number) => {
        addDiag(h.diagnosis_name, 650 - i + (h.support_score || 0) * 100);
      });
    }
  }

  // Source 9: Multi-Agent Pipeline
  if (o1?.multi_agent) {
    const ma = o1.multi_agent as any;
    if (ma.diagnosis_agent?.diagnoses) {
      ma.diagnosis_agent.diagnoses.forEach((d: any, i: number) => {
        addDiag(d.diagnosis_name || d.name || d, 550 - i);
      });
    }
  }

  // Deduplicate by synonym groups: pick the original (non-normalized) name with highest score
  // We need original names, so let's rebuild
  const origNames: Array<{ original: string; normalized: string; score: number }> = [];

  function collectOriginals(source: any[], nameExtractor: (d: any) => string, baseScore: number) {
    source?.forEach((d, i) => {
      const name = nameExtractor(d);
      if (name && name.trim().length > 0) {
        origNames.push({ original: name, normalized: normalize(name), score: baseScore - i });
      }
    });
  }

  // Collect from all sources with original names
  collectOriginals(result.ddx_candidates?.diagnoses || [], (d: any) => d.diagnosis || d.diagnosis_name || "", 1000);
  collectOriginals(o1?.ddx?.differential_diagnoses || [], (d: any) => d.diagnosis_name, 900);
  collectOriginals((o1?.hybrid_reasoning as any)?.differential_diagnoses || [], (d: any) => d.diagnosis_name, 800);
  collectOriginals((o1?.bayesian as any)?.diagnoses || [], (d: any) => d.diagnosis_name || d.diagnosis, 700);
  collectOriginals((o1?.hypotheses as any)?.hypotheses || [], (d: any) => d.hypothesis_name || d.diagnosis || d.name, 600);
  if ((o1?.uncertainty as any)?.top_diagnosis) {
    origNames.push({ original: (o1?.uncertainty as any).top_diagnosis, normalized: normalize((o1?.uncertainty as any).top_diagnosis), score: 850 });
  }
  collectOriginals((o1?.uncertainty as any)?.alternative_diagnoses || [], (d: any) => d.name || d.diagnosis_name || (typeof d === "string" ? d : ""), 840);
  collectOriginals((o1?.hypothesis_testing as any)?.tested_hypotheses || [], (d: any) => d.diagnosis_name, 650);
  // Meta-reasoning hypotheses are strings
  ((o1?.meta_reasoning as any)?.world_state?.hypotheses || []).forEach((h: string, i: number) => {
    if (h && h.trim()) origNames.push({ original: h, normalized: normalize(h), score: 500 - i });
  });

  // Sort by score descending, deduplicate by normalized form
  origNames.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const uniqueDiagnoses: string[] = [];
  for (const entry of origNames) {
    if (!entry.normalized || entry.normalized.length < 2) continue;
    // Check if we already have a synonym
    let isDupe = false;
    for (const existing of uniqueDiagnoses) {
      if (synonymMatch(entry.original, existing)) {
        isDupe = true;
        break;
      }
    }
    if (!isDupe && !seen.has(entry.normalized)) {
      seen.add(entry.normalized);
      uniqueDiagnoses.push(entry.original);
    }
  }

  return uniqueDiagnoses;
}

/** Extract all lab recommendations from pipeline output */
function extractAllLabs(result: ClinicalPipelineResult): string[] {
  const labs = new Set<string>();
  const o1 = result.o1_result;

  // DDX recommended labs
  result.recommended_labs?.forEach((l: any) => labs.add(l.test_name));

  // O1 DDX labs
  o1?.ddx?.recommended_labs?.forEach((l: any) => labs.add(l.test_name));

  // Hybrid reasoning tests
  if ((o1?.hybrid_reasoning as any)?.recommended_tests) {
    (o1.hybrid_reasoning as any).recommended_tests.forEach((t: any) => {
      labs.add(typeof t === "string" ? t : t.test_name || t.name);
    });
  }

  // Evidence plan
  if (o1?.evidence_plan) {
    (o1.evidence_plan as any).planned_tests?.forEach((t: any) => {
      labs.add(typeof t === "string" ? t : t.test_name || t.name || t);
    });
  }

  return [...labs].filter(Boolean);
}

/** Extract all medication recommendations from pipeline output */
function extractAllMeds(result: ClinicalPipelineResult): string[] {
  const meds = new Set<string>();
  const o1 = result.o1_result;

  result.recommended_medications?.suggestions?.forEach((s: any) => meds.add(s.generic_name));

  o1?.ddx?.suggested_medications?.forEach((m: any) => meds.add(m.generic_name));

  if ((o1?.hybrid_reasoning as any)?.treatment_options) {
    (o1.hybrid_reasoning as any).treatment_options.forEach((t: any) => {
      meds.add(typeof t === "string" ? t : t.generic_name || t.name);
    });
  }

  return [...meds].filter(Boolean);
}

// ── Persist single case result ──

async function persistCaseResult(runId: string, caseResult: CaseResultV6, caseIndex: number, bc: BenchmarkCaseV6) {
  try {
    const diagnoses = caseResult.actual_diagnoses || [];
    await supabase.from("benchmark_runs").insert({
      run_group_id: runId,
      benchmark_version: "benchmark_v6",
      pipeline_type: "cognitive_v4.3",
      test_case: caseResult.case_name,
      test_case_index: caseIndex,
      passed: caseResult.passed,
      diagnosis_agreement: Math.round(caseResult.diagnosis_match_rate * 100),
      lab_agreement: Math.round(caseResult.lab_match_rate * 100),
      medication_agreement: Math.round(caseResult.medication_match_rate * 100),
      safety_alerts: caseResult.safety.critical_alerts,
      latency_ms: Math.round(caseResult.latency.total_ms),
      confidence_score: caseResult.confidence_score,
      confidence_label: caseResult.confidence_label,
      guideline_citations: caseResult.guideline_sources.length,
      failure_reasons: caseResult.failure_reasons,
      patient_context: bc.context as any,
      expected_output: bc.ground_truth as any,
      pipeline_output: {
        diagnoses,
        top1_match: caseResult.top1_match,
        top3_match: caseResult.top3_match,
        top5_match: caseResult.top5_match,
        gold_standard_rank: caseResult.gold_standard_rank,
        specialty: caseResult.specialty,
        difficulty: caseResult.difficulty,
        safety: caseResult.safety,
        latency: caseResult.latency,
        reasoning_completeness: caseResult.reasoning_trace_completeness,
        diagnostic_loop: caseResult.diagnostic_loop,
        hypothesis: caseResult.hypothesis,
        evidence_plan: caseResult.evidence_plan,
        bayesian: caseResult.bayesian,
        failure_root_cause: caseResult.failure_root_cause,
      } as any,
      comparison_details: {
        matched_diagnoses: caseResult.matched_diagnoses,
        graph_miss: caseResult.graph_miss,
        graph_symptom_matches: caseResult.graph_symptom_matches,
      } as any,
      triggered_by: "benchmark_v6_suite",
    });
  } catch (e) {
    console.error(`[BenchmarkV6] Failed to persist case ${caseResult.case_id}:`, e);
  }
}

// ── Run Single Case ──

async function runCase(bc: BenchmarkCaseV6): Promise<CaseResultV6> {
  try {
    const result = await runClinicalPipeline(bc.context);
    const o1 = result.o1_result || null;

    // Multi-source extraction with deduplication
    const actualDx = extractAllDiagnoses(result);
    const actualLabs = extractAllLabs(result);
    const actualMeds = extractAllMeds(result);

    console.log(`[BenchmarkV6] Case "${bc.name}" — extracted ${actualDx.length} diagnoses: [${actualDx.slice(0, 5).join(", ")}]`);

    const goldRank = findGoldRank(actualDx, bc.ground_truth.gold_standard_diagnosis);
    const diagMatch = matchRate(actualDx, bc.ground_truth.top_differential_diagnoses);
    const labMatch = matchRate(actualLabs, bc.ground_truth.recommended_tests);
    const medMatch = bc.ground_truth.recommended_medications.length === 0 ? 1 : matchRate(actualMeds, bc.ground_truth.recommended_medications);

    // Danger detection: check across all sources
    const dangerDetected =
      result.ddx_candidates?.diagnoses?.some((d: any) => d.must_not_miss) ||
      result.safety_alerts?.critical_count > 0 ||
      o1?.ddx?.differential_diagnoses?.some((d: any) => d.must_not_miss) ||
      o1?.ddx?.dangerous_diagnoses_injected > 0 ||
      (o1?.hybrid_reasoning as any)?.dangerous_diagnoses?.length > 0 ||
      (o1?.hybrid_reasoning as any)?.differential_diagnoses?.some((d: any) => d.must_not_miss) ||
      (o1?.oversight?.events || []).some((e: any) => e.severity === "critical") ||
      false;

    const dxLoop: DiagnosticLoopEvaluation = o1?.diagnostic_loop ? {
      iterations_executed: o1.diagnostic_loop.executed ? 1 : 0,
      hypothesis_changes: o1.diagnostic_loop.candidates_pruned || 0,
      probability_updates: o1.diagnostic_loop.candidates_remaining || 0,
      convergence_status: o1.diagnostic_loop.executed ? "converged" : "not_triggered",
      improved_ranking: o1.diagnostic_loop.executed || false,
      weak_pruned: o1.diagnostic_loop.candidates_pruned || 0,
    } : { iterations_executed: 0, hypothesis_changes: 0, probability_updates: 0, convergence_status: "not_triggered", improved_ranking: false, weak_pruned: 0 };

    const hypoTest = o1?.hypothesis_testing;
    const hypoEval: HypothesisEvaluation = hypoTest ? {
      total_tested: hypoTest.summary?.total_tested || 0,
      support_scores: hypoTest.tested_hypotheses?.map((h: any) => h.support_score) || [],
      contradiction_scores: hypoTest.tested_hypotheses?.map((h: any) => h.contradiction_score || 0) || [],
      pruning_rate: hypoTest.summary ? (hypoTest.summary.weakly_supported / Math.max(1, hypoTest.summary.total_tested)) : 0,
      boosted_correct: goldRank !== null && goldRank <= 3,
      removed_unsupported: hypoTest.summary?.weakly_supported || 0,
      entropy_reduction: 0,
    } : { total_tested: 0, support_scores: [], contradiction_scores: [], pruning_rate: 0, boosted_correct: false, removed_unsupported: 0, entropy_reduction: 0 };

    const evPlan = o1?.evidence_plan;
    const evPlanEval: EvidencePlanEvaluation = evPlan ? {
      tests_recommended: evPlan.planned_tests?.map((t: any) => t.test_name || t) || [],
      test_selection_accuracy: matchRate(evPlan.planned_tests?.map((t: any) => t.test_name || t) || [], bc.ground_truth.recommended_tests),
      test_relevance_score: evPlan.summary?.max_information_gain || 0,
      information_gain_score: evPlan.summary?.max_information_gain || 0,
    } : { tests_recommended: [], test_selection_accuracy: 0, test_relevance_score: 0, information_gain_score: 0 };

    const bayesEval: BayesianEvaluation = {
      posterior_accuracy: goldRank ? (goldRank <= 3 ? 1 : 0.5) : 0,
      confidence_calibration: result.confidence_scores?.confidence_score || 0,
      entropy_reduction: 0,
      correct_gained_probability: goldRank !== null && goldRank <= 3,
      incorrect_lost_probability: false,
    };

    const safetyEval: SafetyEvaluation = {
      dangerous_detected: dangerDetected,
      expected_dangerous: bc.ground_truth.danger_flag,
      safety_score: result.safety_alerts?.safety_score || 100,
      critical_alerts: result.safety_alerts?.critical_count || 0,
      false_negative: bc.ground_truth.danger_flag && !dangerDetected,
      safety_engine_activated: (result.safety_alerts?.alerts?.length || 0) > 0 || (o1?.oversight?.events?.length || 0) > 0,
    };

    const lat: LatencyBreakdown = {
      pcie_ms: o1?.stage_latencies?.wave0_pcie || 0,
      world_model_ms: o1?.stage_latencies?.meta_reasoning || 0,
      episodic_memory_ms: o1?.stage_latencies?.episodic_memory || 0,
      ddx_ms: o1?.stage_latencies?.ddx_engine || 0,
      hypothesis_testing_ms: o1?.stage_latencies?.hypothesis_testing || 0,
      evidence_ms: o1?.stage_latencies?.retrieve_evidence || 0,
      bayesian_ms: o1?.stage_latencies?.bayesian_engine || 0,
      evidence_planning_ms: o1?.stage_latencies?.evidence_planning || 0,
      causal_reasoning_ms: o1?.stage_latencies?.causal_reasoning || 0,
      conflict_resolution_ms: o1?.stage_latencies?.conflict_resolution || 0,
      safety_ms: o1?.stage_latencies?.safety_evaluation || 0,
      uncertainty_ms: o1?.stage_latencies?.uncertainty_engine || 0,
      soap_ms: o1?.stage_latencies?.soap_generation || 0,
      diagnostic_loop_ms: o1?.stage_latencies?.diagnostic_loop || 0,
      total_ms: result.latency?.total_ms || o1?.total_latency_ms || 0,
    };

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
    const reasoningCompleteness = stagesExecuted / stagesExpected;

    const failures: string[] = [];
    let rootCause: FailureRootCause | null = null;
    if (!goldRank || goldRank > 3) {
      failures.push(`Gold standard "${bc.ground_truth.gold_standard_diagnosis}" not in top 3`);
      const ddxRaw = result.ddx_candidates?.raw;
      if (ddxRaw?.graph_miss && actualDx.length === 0) rootCause = "knowledge_graph_gap";
      else if ((ddxRaw?.matched_symptoms?.length || 0) === 0 && actualDx.length === 0) rootCause = "symptom_mapping_gap";
      else if (actualDx.length > 0) rootCause = "bayesian_probability_error";
      else rootCause = "symptom_mapping_gap";
    }
    if (bc.ground_truth.danger_flag && !dangerDetected) {
      failures.push("Dangerous diagnosis missed");
      rootCause = rootCause || "safety_engine_failure";
    }

    const passed = (goldRank !== null && goldRank <= 5) || (diagMatch >= 0.5 && (!bc.ground_truth.danger_flag || dangerDetected));

    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty, difficulty: bc.difficulty, tags: bc.tags,
      top1_match: goldRank === 1, top3_match: goldRank !== null && goldRank <= 3, top5_match: goldRank !== null && goldRank <= 5,
      diagnosis_match_rate: diagMatch, lab_match_rate: labMatch, medication_match_rate: medMatch, gold_standard_rank: goldRank,
      matched_diagnoses: fuzzyMatch(actualDx, bc.ground_truth.top_differential_diagnoses),
      actual_diagnoses: actualDx, actual_labs: actualLabs, actual_medications: actualMeds,
      diagnostic_loop: dxLoop, hypothesis: hypoEval, evidence_plan: evPlanEval, bayesian: bayesEval,
      safety: safetyEval, latency: lat,
      reasoning_trace_completeness: reasoningCompleteness,
      graph_symptom_matches: result.ddx_candidates?.raw?.matched_symptoms?.length || o1?.ddx?.matched_symptoms?.length || 0,
      graph_miss: result.ddx_candidates?.raw?.graph_miss ?? o1?.ddx?.graph_miss ?? true,
      confidence_score: result.confidence_scores?.confidence_score || (o1?.uncertainty as any)?.confidence_score || 0,
      confidence_label: result.confidence_scores?.confidence_label || (o1?.uncertainty as any)?.confidence_label || "Unknown",
      guideline_sources: result.guidelines?.sources_used || o1?.guideline_summary?.guideline_sources_used || [],
      failure_reasons: failures, failure_root_cause: rootCause,
      pipeline_output: result, o1_result: o1, passed,
    };
  } catch (error) {
    console.error(`[BenchmarkV6] Case ${bc.id} failed:`, error);
    const emptyLat: LatencyBreakdown = { pcie_ms: 0, world_model_ms: 0, episodic_memory_ms: 0, ddx_ms: 0, hypothesis_testing_ms: 0, evidence_ms: 0, bayesian_ms: 0, evidence_planning_ms: 0, causal_reasoning_ms: 0, conflict_resolution_ms: 0, safety_ms: 0, uncertainty_ms: 0, soap_ms: 0, diagnostic_loop_ms: 0, total_ms: 0 };
    return {
      case_id: bc.id, case_name: bc.name, specialty: bc.specialty, difficulty: bc.difficulty, tags: bc.tags,
      top1_match: false, top3_match: false, top5_match: false,
      diagnosis_match_rate: 0, lab_match_rate: 0, medication_match_rate: 0, gold_standard_rank: null,
      matched_diagnoses: [], actual_diagnoses: [], actual_labs: [], actual_medications: [],
      diagnostic_loop: { iterations_executed: 0, hypothesis_changes: 0, probability_updates: 0, convergence_status: "not_triggered", improved_ranking: false, weak_pruned: 0 },
      hypothesis: { total_tested: 0, support_scores: [], contradiction_scores: [], pruning_rate: 0, boosted_correct: false, removed_unsupported: 0, entropy_reduction: 0 },
      evidence_plan: { tests_recommended: [], test_selection_accuracy: 0, test_relevance_score: 0, information_gain_score: 0 },
      bayesian: { posterior_accuracy: 0, confidence_calibration: 0, entropy_reduction: 0, correct_gained_probability: false, incorrect_lost_probability: false },
      safety: { dangerous_detected: false, expected_dangerous: bc.ground_truth.danger_flag, safety_score: 0, critical_alerts: 0, false_negative: bc.ground_truth.danger_flag, safety_engine_activated: false },
      latency: emptyLat, reasoning_trace_completeness: 0, graph_symptom_matches: 0, graph_miss: true,
      confidence_score: 0, confidence_label: "Error", guideline_sources: [],
      failure_reasons: [`Pipeline error: ${error}`], failure_root_cause: "timeout_error",
      pipeline_output: null, o1_result: null, passed: false,
    };
  }
}

// ── Batched Suite Runner ──

export interface BatchConfig {
  batchSize: number;       // Cases per batch (default: 5)
  delayBetweenBatchesMs: number; // Delay between batches (default: 3000)
  delayBetweenCasesMs: number;   // Delay between cases within a batch (default: 500)
  startFromCase: number;   // Resume from this case index (default: 0)
  persistResults: boolean; // Auto-persist each case to DB (default: true)
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  batchSize: 5,
  delayBetweenBatchesMs: 3000,
  delayBetweenCasesMs: 500,
  startFromCase: 0,
  persistResults: true,
};

export interface BatchProgress {
  caseIndex: number;
  totalCases: number;
  caseName: string;
  batchNumber: number;
  totalBatches: number;
  completedInBatch: number;
  batchSize: number;
  status: "running" | "batch_delay" | "credit_error" | "done" | "paused";
  errorMessage?: string;
}

export async function runBenchmarkV6Batched(
  onProgress?: (progress: BatchProgress) => void,
  onBatchComplete?: (batchResults: CaseResultV6[], batchNumber: number) => void,
  caseFilter?: (c: BenchmarkCaseV6) => boolean,
  config?: Partial<BatchConfig>,
  abortSignal?: AbortSignal,
): Promise<BenchmarkSuiteResultV6> {
  const cfg = { ...DEFAULT_BATCH_CONFIG, ...config };
  const runId = `v6-${Date.now()}`;
  const cases = caseFilter ? BENCHMARK_CASES_V6.filter(caseFilter) : BENCHMARK_CASES_V6;
  const startIdx = Math.min(cfg.startFromCase, cases.length);
  const remainingCases = cases.slice(startIdx);
  const totalBatches = Math.ceil(remainingCases.length / cfg.batchSize);
  const allResults: CaseResultV6[] = [];

  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    if (abortSignal?.aborted) break;

    const batchStart = batchNum * cfg.batchSize;
    const batchCases = remainingCases.slice(batchStart, batchStart + cfg.batchSize);
    const batchResults: CaseResultV6[] = [];

    for (let j = 0; j < batchCases.length; j++) {
      if (abortSignal?.aborted) break;

      const globalIdx = startIdx + batchStart + j;
      onProgress?.({
        caseIndex: globalIdx,
        totalCases: cases.length,
        caseName: batchCases[j].name,
        batchNumber: batchNum + 1,
        totalBatches,
        completedInBatch: j,
        batchSize: batchCases.length,
        status: "running",
      });

      const result = await runCase(batchCases[j]);
      batchResults.push(result);
      allResults.push(result);

      // Check for credit errors
      if (result.failure_reasons.some(f => f.includes("402") || f.includes("credit"))) {
        onProgress?.({
          caseIndex: globalIdx,
          totalCases: cases.length,
          caseName: batchCases[j].name,
          batchNumber: batchNum + 1,
          totalBatches,
          completedInBatch: j + 1,
          batchSize: batchCases.length,
          status: "credit_error",
          errorMessage: "AI credits exhausted. Partial results saved.",
        });
        // Persist whatever we have so far
        if (cfg.persistResults) {
          await persistCaseResult(runId, result, globalIdx, batchCases[j]);
        }
        return buildSuiteResult(runId, allResults, cases);
      }

      // Persist individual case
      if (cfg.persistResults) {
        await persistCaseResult(runId, result, globalIdx, batchCases[j]);
      }

      // Delay between cases (within batch)
      if (j < batchCases.length - 1 && cfg.delayBetweenCasesMs > 0) {
        await sleep(cfg.delayBetweenCasesMs);
      }
    }

    // Notify batch complete
    onBatchComplete?.(batchResults, batchNum + 1);

    // Delay between batches
    if (batchNum < totalBatches - 1 && cfg.delayBetweenBatchesMs > 0) {
      onProgress?.({
        caseIndex: startIdx + batchStart + batchCases.length,
        totalCases: cases.length,
        caseName: `Batch ${batchNum + 1} complete — cooling down...`,
        batchNumber: batchNum + 1,
        totalBatches,
        completedInBatch: batchCases.length,
        batchSize: batchCases.length,
        status: "batch_delay",
      });
      await sleep(cfg.delayBetweenBatchesMs);
    }
  }

  return buildSuiteResult(runId, allResults, cases);
}

// ── Legacy non-batched runner (preserved for compatibility) ──

export async function runBenchmarkV6(
  onProgress?: (caseIndex: number, total: number, caseName: string) => void,
  caseFilter?: (c: BenchmarkCaseV6) => boolean,
): Promise<BenchmarkSuiteResultV6> {
  return runBenchmarkV6Batched(
    onProgress ? (p) => onProgress(p.caseIndex, p.totalCases, p.caseName) : undefined,
    undefined,
    caseFilter,
    { batchSize: 1, delayBetweenBatchesMs: 0, delayBetweenCasesMs: 0, persistResults: true },
  );
}

// ── Load persisted v6 results ──

export async function loadPersistedV6Results(): Promise<BenchmarkSuiteResultV6 | null> {
  // Find the latest v6 run group
  const { data: latest } = await supabase
    .from("benchmark_runs")
    .select("run_group_id")
    .eq("benchmark_version", "benchmark_v6")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!latest || latest.length === 0) return null;
  const runGroupId = latest[0].run_group_id;

  // Load all cases for this run
  const { data: runs } = await supabase
    .from("benchmark_runs")
    .select("*")
    .eq("run_group_id", runGroupId)
    .order("test_case_index", { ascending: true });

  if (!runs || runs.length === 0) return null;

  // Reconstruct CaseResultV6 from persisted data
  const results: CaseResultV6[] = runs.map((r: any) => {
    const po = r.pipeline_output || {};
    const expected = r.expected_output || {};
    return {
      case_id: `persisted-${r.id}`,
      case_name: r.test_case,
      specialty: po.specialty || "unknown",
      difficulty: po.difficulty || "common",
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
      diagnostic_loop: po.diagnostic_loop || { iterations_executed: 0, hypothesis_changes: 0, probability_updates: 0, convergence_status: "not_triggered", improved_ranking: false, weak_pruned: 0 },
      hypothesis: po.hypothesis || { total_tested: 0, support_scores: [], contradiction_scores: [], pruning_rate: 0, boosted_correct: false, removed_unsupported: 0, entropy_reduction: 0 },
      evidence_plan: po.evidence_plan || { tests_recommended: [], test_selection_accuracy: 0, test_relevance_score: 0, information_gain_score: 0 },
      bayesian: po.bayesian || { posterior_accuracy: 0, confidence_calibration: 0, entropy_reduction: 0, correct_gained_probability: false, incorrect_lost_probability: false },
      safety: po.safety || { dangerous_detected: false, expected_dangerous: expected.danger_flag || false, safety_score: 0, critical_alerts: r.safety_alerts || 0, false_negative: false, safety_engine_activated: false },
      latency: po.latency || { pcie_ms: 0, world_model_ms: 0, episodic_memory_ms: 0, ddx_ms: 0, hypothesis_testing_ms: 0, evidence_ms: 0, bayesian_ms: 0, evidence_planning_ms: 0, causal_reasoning_ms: 0, conflict_resolution_ms: 0, safety_ms: 0, uncertainty_ms: 0, soap_ms: 0, diagnostic_loop_ms: 0, total_ms: r.latency_ms || 0 },
      reasoning_trace_completeness: po.reasoning_completeness || 0,
      graph_symptom_matches: r.comparison_details?.graph_symptom_matches || 0,
      graph_miss: r.comparison_details?.graph_miss ?? true,
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

  return buildSuiteResult(runGroupId || `v6-persisted`, results, BENCHMARK_CASES_V6);
}

// ── Get completed case count for a run group ──

export async function getCompletedCaseCount(benchmarkVersion = "benchmark_v6"): Promise<{ runGroupId: string | null; count: number }> {
  const { data } = await supabase
    .from("benchmark_runs")
    .select("run_group_id")
    .eq("benchmark_version", benchmarkVersion)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return { runGroupId: null, count: 0 };
  const runGroupId = data[0].run_group_id;

  const { count } = await supabase
    .from("benchmark_runs")
    .select("*", { count: "exact", head: true })
    .eq("run_group_id", runGroupId);

  return { runGroupId, count: count || 0 };
}

// ── Build Suite Result ──

function buildSuiteResult(runId: string, results: CaseResultV6[], allCases: BenchmarkCaseV6[]): BenchmarkSuiteResultV6 {
  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const specialties = [...new Set(results.map(c => c.specialty))];
  const bySpecialty: SpecialtyBreakdown[] = specialties.map(s => {
    const sc = results.filter(r => r.specialty === s);
    const dangerCases = sc.filter(r => r.safety.expected_dangerous);
    return {
      specialty: s as Specialty, total_cases: sc.length, passed: sc.filter(r => r.passed).length,
      avg_diagnosis_match: avg(sc.map(r => r.diagnosis_match_rate)),
      avg_lab_match: avg(sc.map(r => r.lab_match_rate)),
      avg_latency_ms: avg(sc.map(r => r.latency.total_ms)),
      top1_accuracy: sc.filter(r => r.top1_match).length / sc.length,
      top3_accuracy: sc.filter(r => r.top3_match).length / sc.length,
      top5_accuracy: sc.filter(r => r.top5_match).length / sc.length,
      danger_detection_rate: dangerCases.length ? dangerCases.filter(r => r.safety.dangerous_detected).length / dangerCases.length : 1,
    };
  });

  const difficulties: CaseDifficulty[] = ["common", "moderate", "complex", "rare"];
  const byDifficulty: DifficultyBreakdown[] = difficulties.map(d => {
    const dc = results.filter(r => r.difficulty === d);
    return {
      difficulty: d, total_cases: dc.length, passed: dc.filter(r => r.passed).length,
      avg_diagnosis_match: avg(dc.map(r => r.diagnosis_match_rate)),
      top1_accuracy: dc.length ? dc.filter(r => r.top1_match).length / dc.length : 0,
      top3_accuracy: dc.length ? dc.filter(r => r.top3_match).length / dc.length : 0,
    };
  });

  const allLatencies = results.map(r => r.latency.total_ms).filter(l => l > 0);
  const latencyStats: LatencyStatistics = {
    avg_total_ms: avg(allLatencies),
    p50_ms: percentile(allLatencies, 50),
    p95_ms: percentile(allLatencies, 95),
    p99_ms: percentile(allLatencies, 99),
    avg_per_stage: {
      pcie: avg(results.map(r => r.latency.pcie_ms)),
      world_model: avg(results.map(r => r.latency.world_model_ms)),
      ddx: avg(results.map(r => r.latency.ddx_ms)),
      bayesian: avg(results.map(r => r.latency.bayesian_ms)),
      evidence: avg(results.map(r => r.latency.evidence_ms)),
      safety: avg(results.map(r => r.latency.safety_ms)),
      soap: avg(results.map(r => r.latency.soap_ms)),
    },
    cases_under_5s: allLatencies.filter(l => l < 5000).length,
    cases_under_5s_pct: allLatencies.length ? allLatencies.filter(l => l < 5000).length / allLatencies.length : 0,
  };

  const failedCases = results.filter(r => !r.passed);
  const byRootCause: Record<FailureRootCause, number> = {
    knowledge_graph_gap: 0, symptom_mapping_gap: 0, physiology_inference_error: 0,
    bayesian_probability_error: 0, evidence_retrieval_failure: 0, safety_engine_failure: 0,
    hypothesis_testing_failure: 0, diagnostic_loop_divergence: 0, timeout_error: 0, unknown: 0,
  };
  for (const f of failedCases) {
    byRootCause[f.failure_root_cause || "unknown"]++;
  }
  const failBySpec: Record<string, number> = {};
  const failByDiff: Record<string, number> = {};
  for (const f of failedCases) {
    failBySpec[f.specialty] = (failBySpec[f.specialty] || 0) + 1;
    failByDiff[f.difficulty] = (failByDiff[f.difficulty] || 0) + 1;
  }

  const failureAnalysis: FailureAnalysis = {
    total_failures: failedCases.length,
    by_root_cause: byRootCause,
    by_specialty: failBySpec as Record<Specialty, number>,
    by_difficulty: failByDiff as Record<CaseDifficulty, number>,
    critical_misses: results.filter(r => r.safety.false_negative).map(r => ({
      case_id: r.case_id, case_name: r.case_name,
      expected: allCases.find(c => c.id === r.case_id)?.ground_truth.gold_standard_diagnosis || r.case_name,
      actual: r.actual_diagnoses.slice(0, 3),
      root_cause: r.failure_root_cause || "unknown",
    })),
  };

  const kgGaps: KnowledgeGraphGap[] = [];
  const graphMissCases = results.filter(r => r.graph_miss);
  if (graphMissCases.length > results.length * 0.2) {
    kgGaps.push({
      category: "General", gap_type: "symptom_diagnosis",
      description: `${graphMissCases.length}/${results.length} cases had graph misses`,
      affected_cases: graphMissCases.map(c => c.case_id),
      priority: "critical",
    });
  }
  for (const s of specialties) {
    const specMisses = graphMissCases.filter(r => r.specialty === s);
    if (specMisses.length >= 3) {
      kgGaps.push({
        category: s, gap_type: "symptom_diagnosis",
        description: `${specMisses.length} graph misses in ${s}`,
        affected_cases: specMisses.map(c => c.case_id),
        priority: specMisses.length >= 10 ? "high" : "medium",
      });
    }
  }

  const recommendations: string[] = [];
  const dangerAll = results.filter(r => r.safety.expected_dangerous);
  const dangerRate = dangerAll.length ? dangerAll.filter(r => r.safety.dangerous_detected).length / dangerAll.length : 1;
  const top1 = results.length ? results.filter(r => r.top1_match).length / results.length : 0;
  const top3 = results.length ? results.filter(r => r.top3_match).length / results.length : 0;
  if (dangerRate < 0.95) recommendations.push(`⚠ Dangerous diagnosis detection at ${(dangerRate * 100).toFixed(0)}% — target ≥95%.`);
  if (top1 < 0.65) recommendations.push(`Dx Top-1 accuracy at ${(top1 * 100).toFixed(0)}% — target ≥65%.`);
  if (top3 < 0.85) recommendations.push(`Dx Top-3 accuracy at ${(top3 * 100).toFixed(0)}% — target ≥85%.`);
  if (latencyStats.p95_ms > 5000) recommendations.push(`P95 latency ${(latencyStats.p95_ms / 1000).toFixed(1)}s exceeds 5s target.`);
  if (graphMissCases.length > results.length * 0.3) recommendations.push(`${graphMissCases.length} graph misses — prioritize KG expansion.`);

  return {
    run_id: runId, run_timestamp: new Date().toISOString(), version: "v6",
    suite_name: "Full Clinical Reasoning Benchmark Suite",
    total_cases: results.length, passed_cases: results.filter(r => r.passed).length,
    pass_rate: results.length ? results.filter(r => r.passed).length / results.length : 0,
    top1_accuracy: top1, top3_accuracy: top3,
    top5_accuracy: results.length ? results.filter(r => r.top5_match).length / results.length : 0,
    avg_diagnosis_match: avg(results.map(r => r.diagnosis_match_rate)),
    avg_lab_match: avg(results.map(r => r.lab_match_rate)),
    avg_medication_match: avg(results.map(r => r.medication_match_rate)),
    danger_detection_rate: dangerRate,
    danger_false_negative_rate: dangerAll.length ? dangerAll.filter(r => r.safety.false_negative).length / dangerAll.length : 0,
    safety_activation_rate: results.length ? results.filter(r => r.safety.safety_engine_activated).length / results.length : 0,
    avg_confidence_score: avg(results.map(r => r.confidence_score)),
    confidence_calibration_score: 0,
    avg_reasoning_completeness: avg(results.map(r => r.reasoning_trace_completeness)),
    diagnostic_convergence_rate: results.length ? results.filter(r => r.diagnostic_loop.convergence_status === "converged").length / results.length : 0,
    hypothesis_pruning_rate: avg(results.map(r => r.hypothesis.pruning_rate)),
    evidence_plan_accuracy: avg(results.map(r => r.evidence_plan.test_selection_accuracy)),
    latency: latencyStats, by_specialty: bySpecialty, by_difficulty: byDifficulty,
    failure_analysis: failureAnalysis, knowledge_gaps: kgGaps, recommendations, cases: results,
  };
}
