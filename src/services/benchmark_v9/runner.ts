/**
 * Benchmark v9 — Optimized Multi-Scenario Runner
 *
 * Runs 30 controlled scenarios through the core diagnostic pipeline:
 *   Normalization → Physiology‖DDX → Bayesian → Cognitive → Safety → Ranking
 *
 * 3 edge function calls per scenario (Physiology + DDX parallel, then Bayesian).
 * No LLM calls. No guideline/evidence retrieval. Pure diagnostic validation.
 */

import { BENCHMARK_SUITE, type BenchmarkCase } from "./scenario";
import type {
  BenchmarkResult, BenchmarkSuiteResult, NormalizationTrace,
  PhysiologyTrace, CandidateGenerationTrace, BayesianTrace,
  CognitivePruningTrace, SafetyTrace, FinalRankingTrace, StageLatency,
} from "./types";
import { normalizeWithTrace } from "@/services/context_engine/terminology_normalizer";
import { runCognitiveController } from "@/services/cognitive/clinical_cognitive_controller";
import { runDDXEngine, type DDXResult } from "@/services/ddx_engine/client";
import { generatePhysiologicalContext, type PhysiologicalContextResult } from "@/services/physiology_engine/client";
import { calculateDiagnosticProbabilities, type BayesianResult } from "@/services/bayesian_engine/client";

// ── Diagnosis matching with synonyms ──

const SYNONYM_MAP: Record<string, string[]> = {
  pneumonia: ["communityacquiredpneumonia", "cap", "lobarpneumonia", "bronchopneumonia"],
  communityacquiredpneumonia: ["pneumonia", "cap"],
  gastroenteritis: ["acutegastroenteritis", "stomachflu", "viralenteritis"],
  acutegastroenteritis: ["gastroenteritis"],
  appendicitis: ["acuteappendicitis"],
  acuteappendicitis: ["appendicitis"],
  urinarytractinfection: ["uti", "cystitis", "bladderinfection"],
  uti: ["urinarytractinfection"],
  acutecoronarysyndrome: ["acs", "myocardialinfarction", "heartattack", "unstableangina"],
  myocardialinfarction: ["acutecoronarysyndrome", "heartattack"],
  diabeticketoacidosis: ["dka"],
  dka: ["diabeticketoacidosis"],
  pulmonaryembolism: ["pe", "lungclot"],
  pe: ["pulmonaryembolism"],
  asthma: ["asthmaexacerbation", "acuteasthma", "bronchialasthma"],
  asthmaexacerbation: ["asthma"],
  sepsis: ["septicemia", "systemicinfection", "bacteremia"],
  migraine: ["migraineheadache", "migrainewithauraaura"],
  copdexacerbation: ["copd", "chronicobstructivepulmonarydisease"],
  copd: ["copdexacerbation"],
  pancreatitis: ["acutepancreatitis"],
  acutepancreatitis: ["pancreatitis"],
  pepticulcerdisease: ["pepticulcer", "gastricculcer", "duodenalulcer"],
  pepticulcer: ["pepticulcerdisease"],
  pericarditis: ["acutepericarditis"],
  heartfailure: ["congestiveheartfailure", "chf"],
  congestiveheartfailure: ["heartfailure", "chf"],
  tensionheadache: ["tensionheadache", "tensiontype"],
  meningitis: ["bacterialmeningitis", "viralmeningitis"],
  stroke: ["cerebrovascularaccident", "cva", "ischemicstroke"],
  cerebrovascularaccident: ["stroke", "cva"],
  influenza: ["flu"],
  flu: ["influenza"],
  covid19: ["covid", "sarscov2", "covidlikesyndrome"],
  covid: ["covid19"],
  hypoglycemia: ["lowbloodsugar"],
  thyroidstorm: ["thyrotoxiccrisis", "thyrotoxicosis"],
  pyelonephritis: ["kidneysinfection"],
  renalcolic: ["kidneystone", "ureterolithiasis", "nephrolithiasis"],
  kidneystone: ["renalcolic", "nephrolithiasis"],
  cholecystitis: ["acutecholecystitis", "gallbladderinflammation"],
  acutecholecystitis: ["cholecystitis"],
  pneumothorax: ["collapsedlung"],
  deepveinthrombosis: ["dvt"],
  dvt: ["deepveinthrombosis"],
  anaphylaxis: ["anaphylacticshock"],
  cellulitis: ["skinsofttissueinfection"],
  gerd: ["gastroesophagealrefluxdisease", "acidreflux"],
  gastroesophagealrefluxdisease: ["gerd"],
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

// ── Run single scenario ──

export async function runSingleScenario(sc: BenchmarkCase): Promise<BenchmarkResult> {
  const stages: StageLatency[] = [];
  const failures: string[] = [];
  const recommendations: string[] = [];
  const t0 = performance.now();

  // ── STAGE 1: Input Normalization (in-memory) ──
  const s1 = performance.now();
  const allSymptoms = [...sc.context.symptoms, ...(sc.context.associated_symptoms || [])];
  const normResult = normalizeWithTrace(allSymptoms);
  const s1ms = Math.round(performance.now() - s1);
  stages.push({ stage: "Input Normalization", latency_ms: s1ms, status: "success" });

  const expectedNormMatch = sc.ground_truth.expected_symptoms_normalized.filter(exp =>
    normResult.normalized.some(n => norm(n) === norm(exp))
  ).length / Math.max(1, sc.ground_truth.expected_symptoms_normalized.length);

  const normalization: NormalizationTrace = {
    raw_tokens: allSymptoms,
    normalized_tokens: normResult.normalized,
    mappings: normResult.mappings,
    expected_match_rate: expectedNormMatch,
  };

  const symptoms = normResult.normalized;
  const vitals = sc.context.vitals;

  // ── STAGE 2+3: Physiology + DDX in PARALLEL ──
  const s2 = performance.now();

  const [physiologicalContext, ddxResultRaw] = await Promise.all([
    (async (): Promise<PhysiologicalContextResult | null> => {
      try {
        return await generatePhysiologicalContext({
          symptoms,
          vitals: vitals ? {
            temperature: vitals.temperature,
            spo2: vitals.spo2,
            pulse: vitals.pulse,
            bp_systolic: vitals.bp_systolic,
          } : undefined,
          visit_id: sc.context.visit_id,
          clinic_id: sc.context.clinic_id,
        });
      } catch (e) {
        console.warn(`[Benchmark:${sc.id}] Physiology failed:`, e);
        return null;
      }
    })(),
    (async (): Promise<DDXResult | null> => {
      try {
        return await runDDXEngine({
          symptoms,
          vitals: vitals ? {
            temperature: vitals.temperature,
            spo2: vitals.spo2,
            pulse: vitals.pulse,
            bp: vitals.bp_systolic && vitals.bp_diastolic
              ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : undefined,
          } : undefined,
          medical_history: sc.context.medical_history || [],
          current_medications: sc.context.medications || [],
          allergies: sc.context.allergies || [],
          visit_id: sc.context.visit_id,
          clinic_id: sc.context.clinic_id,
        });
      } catch (e) {
        console.warn(`[Benchmark:${sc.id}] DDX failed:`, e);
        return null;
      }
    })(),
  ]);

  const s2ms = Math.round(performance.now() - s2);

  // ── Physiology trace ──
  const physioStates: Array<{ state: string; confidence: number; system: string }> = [];
  if (physiologicalContext?.physiological_states) {
    for (const ps of physiologicalContext.physiological_states) {
      physioStates.push({
        state: ps.state || (ps as any).state_name || String(ps),
        confidence: ps.confidence || 0,
        system: ps.system || (ps as any).system_name || "unknown",
      });
    }
  }
  const affectedSystems = (physiologicalContext?.affected_systems || []).map(
    (s: any) => typeof s === "string" ? s : s.system_name || String(s)
  );

  const expectedStateMatch = sc.ground_truth.expected_physiology_states.filter(exp =>
    physioStates.some(ps =>
      ps.state.toLowerCase().includes(exp.toLowerCase()) ||
      exp.toLowerCase().includes(ps.state.toLowerCase())
    )
  ).length / Math.max(1, sc.ground_truth.expected_physiology_states.length);

  const expectedSystemMatch = sc.ground_truth.expected_organ_systems.some(exp =>
    affectedSystems.some((sys: string) => sys.toLowerCase().includes(exp.toLowerCase()))
  );

  stages.push({
    stage: "Physiology Inference",
    latency_ms: physiologicalContext?.execution_ms || 0,
    status: physioStates.length > 0 ? "success" : "error",
    error: physioStates.length === 0 ? "No physiology states activated" : undefined,
  });

  const physiology: PhysiologyTrace = {
    states_activated: physioStates,
    affected_organ_systems: affectedSystems,
    candidate_diagnosis_ids: physiologicalContext?.candidate_diagnosis_ids || [],
    expected_state_match_rate: expectedStateMatch,
    expected_system_match: expectedSystemMatch,
  };

  if (physioStates.length === 0) {
    failures.push("Physiology engine returned zero states");
    recommendations.push("Check symptom_physiology_map coverage");
  }

  // ── DDX trace ──
  const ddxResult = ddxResultRaw;
  const ddxDiagnoses = ddxResult?.differential_diagnoses || [];
  const candidates = ddxDiagnoses.map((d: any) => ({
    name: (d.diagnosis_name || d.diagnosis || "").trim(),
    diagnosis_id: d.diagnosis_id || "",
    probability: d.probability || 0,
    must_not_miss: d.must_not_miss || false,
  })).filter((d: any) => d.name.length > 1);

  const goldIdx = candidates.findIndex((c: any) =>
    diagMatch(c.name, sc.ground_truth.gold_standard_diagnosis)
  );

  stages.push({
    stage: "Candidate Generation (DDX)",
    latency_ms: ddxResult?.execution_ms || 0,
    status: candidates.length > 0 ? "success" : "error",
    error: candidates.length === 0 ? "No candidates generated" : undefined,
  });

  stages.push({ stage: "Physiology + DDX (parallel)", latency_ms: s2ms, status: "success" });

  const candidate_generation: CandidateGenerationTrace = {
    candidates,
    candidate_count: candidates.length,
    gold_in_candidates: goldIdx >= 0,
    gold_candidate_rank: goldIdx >= 0 ? goldIdx + 1 : null,
    gold_candidate_probability: goldIdx >= 0 ? candidates[goldIdx].probability : null,
  };

  if (goldIdx < 0) {
    failures.push(`"${sc.ground_truth.gold_standard_diagnosis}" not in candidate set`);
    recommendations.push("Check symptom_likelihoods edges for this condition");
  }

  // ── STAGE 4: Bayesian Ranking ──
  const s4 = performance.now();
  let bayesianResult: BayesianResult | null = null;
  const candidateIds = ddxDiagnoses.map((d: any) => d.diagnosis_id).filter(Boolean);

  if (candidateIds.length > 0) {
    try {
      bayesianResult = await calculateDiagnosticProbabilities({
        candidate_diagnosis_ids: candidateIds,
        symptoms,
        physiological_state_ids: physiologicalContext?.physiological_states.map(s => s.state_id) || [],
        risk_factors: sc.context.risk_factors || [],
        medical_history: sc.context.medical_history || [],
        region: "IN",
      });
    } catch (e) {
      console.warn(`[Benchmark:${sc.id}] Bayesian failed:`, e);
    }
  }

  const s4ms = Math.round(performance.now() - s4);
  const bayRawDiagnoses = (bayesianResult as any)?.diagnoses || [];

  // Build a diagnosis_id → posterior lookup from the Bayesian engine output
  const bayesianIdLookup = new Map<string, number>();
  for (const bd of bayRawDiagnoses) {
    if (bd.diagnosis_id) {
      bayesianIdLookup.set(bd.diagnosis_id, bd.posterior_probability || bd.probability || 0);
    }
  }

  // Resolve Bayesian output to human-readable names using DDX candidates
  const ddxNameLookup = new Map<string, string>();
  for (const d of ddxDiagnoses) {
    if (d.diagnosis_id) ddxNameLookup.set(d.diagnosis_id, (d.diagnosis_name || "").trim());
  }

  const bayDiagnoses = bayRawDiagnoses.map((d: any) => ({
    diagnosis: ddxNameLookup.get(d.diagnosis_id) || d.diagnosis_name || d.diagnosis || d.diagnosis_id || "",
    diagnosis_id: d.diagnosis_id || "",
    probability: d.posterior_probability || d.probability || 0,
  }));
  const bayGoldIdx = bayDiagnoses.findIndex((d: any) =>
    diagMatch(d.diagnosis, sc.ground_truth.gold_standard_diagnosis)
  );

  stages.push({
    stage: "Bayesian Ranking",
    latency_ms: bayesianResult?.execution_ms || s4ms,
    status: bayDiagnoses.length > 0 ? "success" : "skipped",
  });

  const bayesian: BayesianTrace = {
    ranked_diagnoses: bayDiagnoses.slice(0, 10),
    gold_rank_after_bayesian: bayGoldIdx >= 0 ? bayGoldIdx + 1 : null,
  };

  // ── STAGE 5: Cognitive Pruning (in-memory, using BAYESIAN posteriors) ──
  const s5 = performance.now();

  // Use Bayesian posteriors for pruning decisions (not stale DDX probabilities)
  const cogInput = ddxDiagnoses.map((d: any) => {
    const bayPost = bayesianIdLookup.get(d.diagnosis_id);
    const probability = bayPost != null ? bayPost * 100 : (d.probability || 0);
    return {
      diagnosis_name: d.diagnosis_name || d.diagnosis || "",
      probability,
      must_not_miss: d.must_not_miss || false,
      supporting_symptoms: d.supporting_symptoms || [],
      contradicting_factors: d.contradicting_factors || [],
    };
  });
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

  // ── STAGE 6: Safety Evaluation (DDX flags + independent symptom cluster detection) ──
  const dangerousList: string[] = [];
  for (const d of ddxDiagnoses) {
    if (d.must_not_miss) {
      dangerousList.push((d.diagnosis_name || "").trim());
    }
  }
  if (ddxResult?.dangerous_diagnoses) {
    for (const d of ddxResult.dangerous_diagnoses) {
      const name = typeof d === "string" ? d : (d.diagnosis_name || String(d));
      if (name) dangerousList.push(name.trim());
    }
  }

  // ── Independent symptom cluster detection ──
  const symptomsLower = symptoms.map(s => s.toLowerCase());
  const allInputLower = [...symptomsLower, ...(sc.context.chief_complaint ? [sc.context.chief_complaint.toLowerCase()] : [])];

  const SAFETY_CLUSTERS: Array<{ condition: string; required: number; symptoms: string[] }> = [
    {
      condition: "Sepsis",
      required: 3,
      symptoms: ["fever", "tachycardia", "hypotension", "confusion", "rapid breathing", "tachypnea", "chills", "altered mental status"],
    },
    {
      condition: "Stroke",
      required: 2,
      symptoms: ["sudden weakness", "facial droop", "speech difficulty", "slurred speech", "numbness", "hemiparesis", "vision loss"],
    },
    {
      condition: "Pulmonary Embolism",
      required: 2,
      symptoms: ["sudden dyspnea", "chest pain", "tachycardia", "hemoptysis", "pleuritic chest pain", "shortness of breath", "leg swelling"],
    },
    {
      condition: "Acute Coronary Syndrome",
      required: 2,
      symptoms: ["chest pain", "radiating arm pain", "jaw pain", "diaphoresis", "nausea", "crushing chest pressure", "shortness of breath"],
    },
    {
      condition: "Meningitis",
      required: 2,
      symptoms: ["neck stiffness", "fever", "headache", "photophobia", "confusion", "altered mental status", "rash"],
    },
    {
      condition: "Pneumothorax",
      required: 2,
      symptoms: ["sudden chest pain", "chest pain", "dyspnea", "shortness of breath", "decreased breath sounds", "pleuritic pain"],
    },
    {
      condition: "Diabetic Ketoacidosis",
      required: 2,
      symptoms: ["nausea", "vomiting", "abdominal pain", "fruity breath", "polyuria", "polydipsia", "confusion", "rapid breathing"],
    },
    {
      condition: "Anaphylaxis",
      required: 2,
      symptoms: ["urticaria", "angioedema", "dyspnea", "hypotension", "wheezing", "throat swelling", "rash"],
    },
  ];

  for (const cluster of SAFETY_CLUSTERS) {
    const matched = cluster.symptoms.filter(cs =>
      allInputLower.some(s => s.includes(cs) || cs.includes(s))
    );
    if (matched.length >= cluster.required) {
      // Check if already in candidates
      const inCandidates = candidates.some((c: any) => diagMatch(c.name, cluster.condition));
      if (inCandidates && !dangerousList.some(d => diagMatch(d, cluster.condition))) {
        dangerousList.push(cluster.condition);
      }
    }
  }

  const uniqueDangerous = [...new Set(dangerousList.filter(Boolean))];
  const dangerDetected = uniqueDangerous.length > 0 ||
    (ddxResult?.dangerous_diagnoses_injected && ddxResult.dangerous_diagnoses_injected > 0);

  const expectedDangerous = sc.ground_truth.expected_dangerous_diagnoses || [];
  const dangerousInCandidates = expectedDangerous.filter(exp =>
    candidates.some((c: any) => diagMatch(c.name, exp))
  );

  let safetyCorrect: boolean;
  let detectionDetails: string;

  if (sc.ground_truth.danger_flag) {
    if (!dangerDetected) {
      safetyCorrect = false;
      detectionDetails = "Expected danger but none detected";
    } else {
      safetyCorrect = true;
      detectionDetails = `Danger correctly detected. ${dangerousInCandidates.length}/${expectedDangerous.length} expected dangerous Dx in candidates. ${uniqueDangerous.length} total flagged.`;
    }
  } else {
    safetyCorrect = !dangerDetected;
    detectionDetails = dangerDetected ? "False positive: danger detected but not expected" : "Correctly no danger";
  }

  stages.push({ stage: "Safety Evaluation", latency_ms: 0, status: "success" });

  const safety: SafetyTrace = {
    danger_detected: !!dangerDetected,
    expected_danger: sc.ground_truth.danger_flag,
    safety_alerts: uniqueDangerous.length,
    safety_score: safetyCorrect ? 100 : 0,
    dangerous_diagnoses: uniqueDangerous,
    expected_dangerous_diagnoses: expectedDangerous,
    dangerous_diagnoses_in_candidates: dangerousInCandidates,
    correct: safetyCorrect,
    detection_details: detectionDetails,
  };

  // ── STAGE 7: Final Ranked Diagnoses (Bayesian-authoritative + safety override) ──

  // Known dangerous condition names for safety override
  const KNOWN_DANGEROUS_FOR_RANKING = new Set([
    "sepsis", "stroke", "meningitis", "pulmonary embolism",
    "acute coronary syndrome", "myocardial infarction",
    "aortic dissection", "pneumothorax", "diabetic ketoacidosis",
    "anaphylaxis", "subarachnoid hemorrhage",
  ]);

  function isDangerousForRanking(name: string): boolean {
    const lower = name.toLowerCase().trim();
    for (const dc of KNOWN_DANGEROUS_FOR_RANKING) {
      if (lower.includes(dc) || dc.includes(lower)) return true;
    }
    return false;
  }

  // Assign each DDX candidate its Bayesian posterior (or fallback 0.001)
  const rankedCandidates = candidates.slice(0, 15).map((c: any) => {
    // Primary: match by diagnosis_id (reliable, UUID-based)
    let bayProb: number | null = bayesianIdLookup.get(c.diagnosis_id) ?? null;

    // Fallback: name-based match against resolved Bayesian names
    if (bayProb === null) {
      const nName = norm(c.name);
      for (const bd of bayDiagnoses) {
        if (norm(bd.diagnosis).includes(nName) || nName.includes(norm(bd.diagnosis))) {
          bayProb = bd.probability;
          break;
        }
      }
    }

    const hasBayesian = bayProb !== null && bayProb > 0;
    return {
      diagnosis: c.name,
      diagnosis_id: c.diagnosis_id,
      probability: hasBayesian ? bayProb! : 0.001,
      ranking_source: (hasBayesian ? "bayesian" : "fallback_ddx") as "bayesian" | "fallback_ddx",
      must_not_miss: c.must_not_miss || isDangerousForRanking(c.name),
    };
  });

  // Sort by Bayesian posterior descending
  rankedCandidates.sort((a, b) => b.probability - a.probability);

  // Safety awareness: dangerous diagnoses are flagged in the safety trace (Stage 6)
  // but do NOT override Bayesian ranking — ranking must remain probability-authoritative.
  // Safety alerts are surfaced separately to the clinician.

  const finalRanking = rankedCandidates.slice(0, 10).map((c, i) => ({
    rank: i + 1,
    diagnosis: c.diagnosis,
    diagnosis_id: c.diagnosis_id,
    probability: c.probability,
    ranking_source: c.ranking_source,
  }));

  const finalGoldRank = finalRanking.findIndex(d =>
    diagMatch(d.diagnosis, sc.ground_truth.gold_standard_diagnosis)
  );

  stages.push({ stage: "Final Ranking", latency_ms: 0, status: "success" });

  const final_ranking: FinalRankingTrace = {
    ranking: finalRanking,
    gold_rank: finalGoldRank >= 0 ? finalGoldRank + 1 : null,
    top1_match: finalGoldRank === 0,
    top3_match: finalGoldRank >= 0 && finalGoldRank < 3,
    top5_match: finalGoldRank >= 0 && finalGoldRank < 5,
  };

  const totalMs = Math.round(performance.now() - t0);

  const metrics = {
    candidate_recall: goldIdx >= 0,
    top1_accuracy: finalGoldRank === 0,
    top3_accuracy: finalGoldRank >= 0 && finalGoldRank < 3,
    safety_correct: safety.correct,
    physiology_activated: physioStates.length > 0,
    normalization_applied: normResult.mappings.some(m => m.changed),
    soap_generated: false,
    total_latency_ms: totalMs,
    latency_under_5s: totalMs < 5000,
  };

  const passed = metrics.candidate_recall && metrics.top3_accuracy && metrics.safety_correct;

  if (!metrics.top1_accuracy && metrics.candidate_recall) {
    recommendations.push(`Gold diagnosis ranked #${(finalGoldRank || 0) + 1} — tune likelihood weights`);
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
    raw_output: {
      ddx_diagnoses_count: ddxDiagnoses.length,
      bayesian_diagnoses_count: bayDiagnoses.length,
      physiology_states_count: physioStates.length,
      dangerous_count: uniqueDangerous.length,
      edge_function_calls: 3,
    },
  };
}

// ── Run full suite ──

export async function runBenchmarkSuite(
  onProgress?: (scenarioName: string, index: number, total: number) => void,
): Promise<BenchmarkSuiteResult> {
  const results: BenchmarkResult[] = [];
  const suite = BENCHMARK_SUITE;

  for (let i = 0; i < suite.length; i++) {
    onProgress?.(suite[i].name, i, suite.length);
    try {
      const result = await runSingleScenario(suite[i]);
      results.push(result);
    } catch (e) {
      console.error(`[Benchmark] Scenario ${suite[i].id} crashed:`, e);
      results.push(buildErrorResult(suite[i], e));
    }
  }

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const top1Count = results.filter(r => r.metrics.top1_accuracy).length;
  const top3Count = results.filter(r => r.metrics.top3_accuracy).length;
  const top5Count = results.filter(r => r.final_ranking.top5_match).length;
  const recallCount = results.filter(r => r.metrics.candidate_recall).length;
  const safetyCount = results.filter(r => r.metrics.safety_correct).length;
  const latencies = results.map(r => r.metrics.total_latency_ms);

  return {
    timestamp: new Date().toISOString(),
    total_scenarios: total,
    passed,
    failed: total - passed,
    top1_accuracy: Math.round((top1Count / total) * 100),
    top3_accuracy: Math.round((top3Count / total) * 100),
    top5_accuracy: Math.round((top5Count / total) * 100),
    candidate_recall: Math.round((recallCount / total) * 100),
    safety_detection_rate: Math.round((safetyCount / total) * 100),
    avg_latency_ms: Math.round(latencies.reduce((a, b) => a + b, 0) / total),
    max_latency_ms: Math.max(...latencies),
    min_latency_ms: Math.min(...latencies),
    results,
    failure_summary: results
      .filter(r => !r.passed)
      .map(r => ({ scenario: r.scenario_name, reasons: r.failure_reasons })),
  };
}

// ── Backwards-compatible single-scenario runner ──
export async function runControlledBenchmark(): Promise<BenchmarkResult> {
  return runSingleScenario(BENCHMARK_SUITE[0]);
}

function buildErrorResult(sc: BenchmarkCase, error: unknown): BenchmarkResult {
  const empty = { states_activated: [], affected_organ_systems: [], candidate_diagnosis_ids: [], expected_state_match_rate: 0, expected_system_match: false };
  return {
    scenario_id: sc.id, scenario_name: sc.name, timestamp: new Date().toISOString(), passed: false,
    normalization: { raw_tokens: sc.context.symptoms, normalized_tokens: [], mappings: [], expected_match_rate: 0 },
    physiology: empty,
    candidate_generation: { candidates: [], candidate_count: 0, gold_in_candidates: false, gold_candidate_rank: null, gold_candidate_probability: null },
    bayesian: { ranked_diagnoses: [], gold_rank_after_bayesian: null },
    cognitive_pruning: { total_evaluated: 0, kept: 0, pruned: 0, escalated: 0, pruned_names: [], gold_pruned: false, quality_score: 0 },
    safety: { danger_detected: false, expected_danger: sc.ground_truth.danger_flag, safety_alerts: 0, safety_score: 0, dangerous_diagnoses: [], expected_dangerous_diagnoses: sc.ground_truth.expected_dangerous_diagnoses || [], dangerous_diagnoses_in_candidates: [], correct: false, detection_details: `Pipeline crashed: ${error}` },
    final_ranking: { ranking: [], gold_rank: null, top1_match: false, top3_match: false, top5_match: false },
    metrics: { candidate_recall: false, top1_accuracy: false, top3_accuracy: false, safety_correct: false, physiology_activated: false, normalization_applied: false, soap_generated: false, total_latency_ms: 0, latency_under_5s: true },
    stage_latencies: [],
    failure_reasons: [`Pipeline crash: ${error}`],
    recommendations: ["Fix pipeline execution errors"],
    raw_output: null,
  };
}
