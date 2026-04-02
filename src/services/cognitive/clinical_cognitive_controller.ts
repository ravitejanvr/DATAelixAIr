/**
 * Clinical Cognitive Controller (v2 — Optimized)
 *
 * Upgrades the Meta-Orchestrator into a true cognitive reasoning layer.
 * Provides five capabilities:
 *   1. Hypothesis Manager — evaluates candidate diagnoses without removing them
 *   2. Evidence Strategy Planner — determines highest-information-gain next steps
 *   3. Reasoning Evaluator — checks for contradictions and weak distributions
 *   4. Uncertainty Monitor — detects diagnostic uncertainty
 *   5. Diagnostic Policy Engine — implements decision rules
 *
 * v2 fixes:
 *   - Low-probability candidates are flagged, never deleted
 *   - Evidence planner uses diagnosis-specific test maps for better match rates
 *   - Quality score capped at 100
 *   - Entropy normalized to prevent >100% metrics
 */

// ── Types ──

export interface HypothesisEvaluation {
  hypothesis: string;
  probability: number;
  evidence_support: number; // 0-1 — how much evidence backs this
  contradiction_count: number;
  is_dangerous: boolean;
  action: "keep" | "keep_with_flag" | "escalate";
  reason: string;
}

export interface EvidenceStrategy {
  recommended_tests: Array<{
    test_name: string;
    information_gain: number;
    differentiates: string[];
    rationale: string;
  }>;
  total_information_gain: number;
  strategy_type: "confirmatory" | "discriminatory" | "exploratory";
  strategy_rationale: string;
}

export interface ReasoningEvaluation {
  quality_score: number; // 0-100
  issues: Array<{
    type: "contradictory_evidence" | "weak_distribution" | "unstable_ranking" | "missing_key_test" | "overconfident" | "underconfident";
    severity: "low" | "medium" | "high";
    description: string;
    recommendation: string;
  }>;
  distribution_entropy: number;
  ranking_stability: number; // 0-1
  evidence_coverage: number; // 0-1
  needs_iteration: boolean;
}

export interface UncertaintyAssessment {
  uncertainty_level: "low" | "moderate" | "high" | "critical";
  top_probability: number;
  probability_gap: number;
  candidates_within_10pct: number;
  entropy: number;
  triggers: string[];
  recommended_action: "finalize" | "iterate" | "escalate" | "request_tests";
}

export interface DiagnosticPolicy {
  actions: Array<{
    type: "escalate_priority" | "recommend_tests" | "iterate_reasoning" | "flag_safety" | "finalize";
    reason: string;
    priority: "low" | "medium" | "high" | "critical";
    metadata?: Record<string, any>;
  }>;
  should_iterate: boolean;
  should_escalate: boolean;
  confidence_sufficient: boolean;
}

export interface CognitiveControllerOutput {
  hypothesis_evaluation: HypothesisEvaluation[];
  evidence_strategy: EvidenceStrategy;
  reasoning_evaluation: ReasoningEvaluation;
  uncertainty_assessment: UncertaintyAssessment;
  diagnostic_policy: DiagnosticPolicy;
  execution_ms: number;
}

// ── Configuration ──

export interface CognitiveConfig {
  min_top_probability: number;
  min_probability_gap: number;
  prune_threshold: number;
  dangerous_escalation_threshold: number;
  max_candidates_to_evaluate: number;
  entropy_threshold: number;
  /** Rank band before low-confidence candidates are explicitly flagged */
  max_kept_hypotheses: number;
}

const DEFAULT_CONFIG: CognitiveConfig = {
  min_top_probability: 45,
  min_probability_gap: 10,
  prune_threshold: 5,  // low-confidence flag threshold (never prunes)
  dangerous_escalation_threshold: 10,
  max_candidates_to_evaluate: 10,
  entropy_threshold: 2.5,
  max_kept_hypotheses: 5,
};

// ── Entropy Calculation ──

function calculateEntropy(probabilities: number[]): number {
  const total = probabilities.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const normalized = probabilities.map(p => p / total);
  return -normalized.reduce((sum, p) => {
    if (p <= 0) return sum;
    return sum + p * Math.log2(p);
  }, 0);
}

// ── Diagnosis → Test Map (for evidence planning) ──

const DIAGNOSIS_TEST_MAP: Record<string, string[]> = {
  // Cardiovascular
  "myocardial infarction": ["ECG", "Troponin", "Chest X-ray", "BNP"],
  "acute myocardial infarction": ["ECG", "Troponin", "Chest X-ray", "BNP"],
  "pulmonary embolism": ["D-dimer", "CT Pulmonary Angiography", "ECG", "ABG"],
  "heart failure": ["BNP", "Echocardiogram", "Chest X-ray", "CBC"],
  "acute decompensated heart failure": ["BNP", "Echocardiogram", "Chest X-ray", "CBC"],
  "atrial fibrillation": ["ECG", "TSH", "Echocardiogram", "BMP"],
  "stable angina": ["ECG", "Stress Test", "Troponin", "Lipid Panel"],
  "pericarditis": ["ECG", "Troponin", "Echocardiogram", "CRP"],
  "aortic dissection": ["CT Aortography", "Chest X-ray", "D-dimer", "ECG"],
  "takotsubo cardiomyopathy": ["ECG", "Troponin", "Echocardiogram", "Coronary Angiography"],
  "cardiac syncope": ["ECG", "Echocardiogram", "Holter Monitor", "Blood Glucose"],
  // Respiratory
  "pneumonia": ["Chest X-ray", "CBC", "Blood Culture", "Sputum Culture"],
  "copd exacerbation": ["Chest X-ray", "ABG", "BNP", "Sputum Culture"],
  "copd": ["Chest X-ray", "ABG", "BNP", "Sputum Culture"],
  // Neurological
  "stroke": ["CT Head", "MRI Brain", "CBC", "Blood Glucose"],
  "subarachnoid hemorrhage": ["CT Head", "Lumbar Puncture", "CT Angiography"],
  "meningitis": ["Lumbar Puncture", "Blood Culture", "CBC", "CT Head"],
  "migraine": ["Neurological Exam"],
  "epileptic seizure": ["EEG", "CT Head", "Blood Glucose", "Prolactin", "BMP"],
  // Gastrointestinal
  "appendicitis": ["CBC", "CRP", "CT Abdomen", "Urinalysis"],
  "acute pancreatitis": ["Lipase", "Amylase", "Abdominal Ultrasound", "CT Abdomen", "LFT"],
  "pancreatitis": ["Lipase", "Amylase", "Abdominal Ultrasound", "CT Abdomen"],
  "gastroenteritis": ["Stool Culture", "BMP", "CBC"],
  "upper gi bleed": ["CBC", "BMP", "Coagulation Panel", "Upper Endoscopy"],
  // Endocrine
  "diabetic ketoacidosis": ["Blood Glucose", "ABG", "BMP", "Urinalysis", "HbA1c"],
  "hypoglycemia": ["Blood Glucose", "CT Head", "CBC", "BMP"],
  "type 2 diabetes mellitus": ["HbA1c", "Fasting Glucose", "BMP", "Lipid Panel"],
  // Infectious
  "sepsis": ["Blood Culture", "Lactate", "CBC", "Procalcitonin", "Urinalysis"],
  "dengue": ["CBC", "Dengue NS1", "Dengue IgM", "LFT"],
  "urinary tract infection": ["Urinalysis", "Urine Culture", "CBC"],
  // Pediatrics
  "kawasaki disease": ["CBC", "CRP", "ESR", "Echocardiogram", "LFT"],
  "acute otitis media": ["Otoscopy", "Tympanometry"],
  // Nephrology
  "acute kidney injury": ["BMP", "Creatinine", "Urinalysis", "Renal Ultrasound", "CBC"],
};

function getTestsForDiagnosis(diagnosisName: string): string[] {
  const lower = diagnosisName.toLowerCase();
  for (const [key, tests] of Object.entries(DIAGNOSIS_TEST_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return tests;
  }
  return [];
}

// ── Known dangerous conditions that must NEVER be pruned ──

const KNOWN_DANGEROUS_CONDITIONS = new Set([
  "sepsis", "septicemia", "bacteremia",
  "stroke", "cerebrovascular accident", "cva", "ischemic stroke",
  "meningitis", "bacterial meningitis",
  "pulmonary embolism", "pe",
  "acute coronary syndrome", "acs", "myocardial infarction", "heart attack",
  "aortic dissection",
  "pneumothorax", "tension pneumothorax",
  "diabetic ketoacidosis", "dka",
  "anaphylaxis", "anaphylactic shock",
  "subarachnoid hemorrhage",
  "status epilepticus",
  "acute kidney injury",
  "upper gi bleed",
  "ectopic pregnancy",
  "cardiac tamponade",
  "necrotizing fasciitis",
]);

function isDangerousCondition(name: string): boolean {
  const lower = name.toLowerCase().trim();
  for (const dc of KNOWN_DANGEROUS_CONDITIONS) {
    if (lower.includes(dc) || dc.includes(lower)) return true;
  }
  return false;
}

// ── 1. Hypothesis Manager ──

function evaluateHypotheses(
  candidates: Array<{
    diagnosis_name: string;
    probability: number;
    must_not_miss?: boolean;
    supporting_symptoms?: string[];
    contradicting_factors?: string[];
  }>,
  config: CognitiveConfig,
): HypothesisEvaluation[] {
  const evals = candidates.slice(0, config.max_candidates_to_evaluate).map((c, index) => {
    const evidenceSupport = (c.supporting_symptoms?.length || 0) /
      Math.max(1, (c.supporting_symptoms?.length || 0) + (c.contradicting_factors?.length || 0));
    const contradictions = c.contradicting_factors?.length || 0;

    // Check if this is a dangerous condition (from flag OR name match)
    const isDangerous = c.must_not_miss || isDangerousCondition(c.diagnosis_name);

    let action: HypothesisEvaluation["action"] = "keep";
    let reason = "Sufficient evidence support";

    if (isDangerous) {
      // CRITICAL: Dangerous conditions ALWAYS escalate, never pruned
      action = "escalate";
      reason = c.must_not_miss
        ? "Must-not-miss diagnosis — always escalated"
        : "Known dangerous condition — bypasses low-confidence flagging";
    } else if (c.probability < config.prune_threshold && (c.supporting_symptoms?.length || 0) === 0) {
      // HIGH-RECALL: Flag low-confidence candidates but NEVER remove them
      action = "keep_with_flag";
      reason = `Low probability (${c.probability}%) with no supporting symptoms — flagged low_confidence`;
    } else if (c.probability < config.prune_threshold * 0.5) {
      // HIGH-RECALL: Flag very low probability but preserve for ranking
      action = "keep_with_flag";
      reason = `Very low probability (${c.probability}%) — flagged low_confidence`;
    } else if (index >= config.max_kept_hypotheses + 2 && c.probability < config.prune_threshold) {
      // HIGH-RECALL: Flag beyond limit but preserve
      action = "keep_with_flag";
      reason = `Beyond extended hypothesis limit (rank #${index + 1}) — flagged low_confidence`;
    } else if (contradictions > 3 && c.probability < 10 && evidenceSupport < 0.2) {
      action = "keep_with_flag";
      reason = `Low probability (${c.probability}%) with ${contradictions} contradictions — flagged low_confidence`;
    }

    return {
      hypothesis: c.diagnosis_name,
      probability: c.probability,
      evidence_support: Math.round(evidenceSupport * 100) / 100,
      contradiction_count: contradictions,
      is_dangerous: isDangerous,
      action,
      reason,
    };
  });

  return evals;
}

// ── 2. Evidence Strategy Planner ──

function planEvidenceStrategy(
  candidates: Array<{ diagnosis_name: string; probability: number }>,
  existingTests: string[],
): EvidenceStrategy {
  if (candidates.length < 2) {
    return {
      recommended_tests: [],
      total_information_gain: 0,
      strategy_type: "confirmatory",
      strategy_rationale: "Single candidate — confirmatory testing only",
    };
  }

  const top2 = candidates.slice(0, 2);
  const probGap = top2[0].probability - top2[1].probability;

  let strategyType: EvidenceStrategy["strategy_type"] = "discriminatory";
  let rationale = "";

  if (probGap > 30) {
    strategyType = "confirmatory";
    rationale = `High confidence gap (${probGap}%) — confirm leading diagnosis`;
  } else if (probGap < 10) {
    strategyType = "discriminatory";
    rationale = `Narrow gap (${probGap}%) — discriminate between ${top2[0].diagnosis_name} and ${top2[1].diagnosis_name}`;
  } else {
    strategyType = "exploratory";
    rationale = `Moderate gap (${probGap}%) — explore differential with targeted tests`;
  }

  // IMPROVED: Use diagnosis-specific test maps for better matching
  const tests: EvidenceStrategy["recommended_tests"] = [];
  const seenTests = new Set(existingTests.map(t => t.toLowerCase()));

  for (const c of candidates.slice(0, 3)) {
    const diagTests = getTestsForDiagnosis(c.diagnosis_name);
    for (const testName of diagTests) {
      if (seenTests.has(testName.toLowerCase())) continue;
      if (tests.some(t => t.test_name.toLowerCase() === testName.toLowerCase())) continue;

      // Calculate information gain based on how many diagnoses this test discriminates
      const discriminates = candidates.slice(0, 5)
        .filter(cc => getTestsForDiagnosis(cc.diagnosis_name).some(t => t.toLowerCase() === testName.toLowerCase()))
        .map(cc => cc.diagnosis_name);

      const infoGain = Math.round(
        (discriminates.length / Math.max(1, candidates.slice(0, 5).length)) * (1 - c.probability / 100) * 100
      ) / 100;

      tests.push({
        test_name: testName,
        information_gain: Math.max(0.1, infoGain),
        differentiates: discriminates,
        rationale: `Key test for ${c.diagnosis_name}${discriminates.length > 1 ? ` (also relevant to ${discriminates.length - 1} others)` : ""}`,
      });
    }
  }

  // Sort by information gain descending
  tests.sort((a, b) => b.information_gain - a.information_gain);

  return {
    recommended_tests: tests.slice(0, 6),
    total_information_gain: tests.slice(0, 6).reduce((s, t) => s + t.information_gain, 0),
    strategy_type: strategyType,
    strategy_rationale: rationale,
  };
}

// ── 3. Reasoning Evaluator ──

function evaluateReasoning(
  candidates: Array<{
    diagnosis_name: string;
    probability: number;
    supporting_symptoms?: string[];
    contradicting_factors?: string[];
  }>,
  config: CognitiveConfig,
): ReasoningEvaluation {
  const issues: ReasoningEvaluation["issues"] = [];
  const probs = candidates.map(c => c.probability);
  const entropy = calculateEntropy(probs);
  const topProb = probs[0] || 0;
  const totalSupport = candidates.reduce((s, c) => s + (c.supporting_symptoms?.length || 0), 0);
  const totalContradictions = candidates.reduce((s, c) => s + (c.contradicting_factors?.length || 0), 0);

  if (totalContradictions > totalSupport * 0.5 && totalSupport > 0) {
    issues.push({
      type: "contradictory_evidence",
      severity: "high",
      description: `${totalContradictions} contradictions vs ${totalSupport} supporting factors`,
      recommendation: "Review symptom-diagnosis alignment; consider re-extracting symptoms",
    });
  }

  if (entropy > config.entropy_threshold && candidates.length >= 3) {
    issues.push({
      type: "weak_distribution",
      severity: "medium",
      description: `High entropy (${entropy.toFixed(2)}) indicates uniform probability distribution`,
      recommendation: "Knowledge graph may lack specificity for this symptom set",
    });
  }

  if (topProb > 85 && candidates.length >= 3 && totalSupport < 3) {
    issues.push({
      type: "overconfident",
      severity: "medium",
      description: `Top probability ${topProb}% with only ${totalSupport} supporting factors`,
      recommendation: "Verify diagnostic reasoning chain has sufficient evidence",
    });
  }

  if (topProb < 25 && candidates.length > 0) {
    issues.push({
      type: "underconfident",
      severity: "low",
      description: `Top probability only ${topProb}%`,
      recommendation: "May need additional clinical information or knowledge graph expansion",
    });
  }

  const gap = (probs[0] || 0) - (probs[1] || 0);
  const rankingStability = Math.min(1, gap / 20);
  if (gap < 5 && candidates.length >= 2) {
    issues.push({
      type: "unstable_ranking",
      severity: "medium",
      description: `Only ${gap}% gap between #1 and #2 — ranking is fragile`,
      recommendation: "Iterative refinement recommended to stabilize ranking",
    });
  }

  const evidenceCoverage = candidates.length > 0
    ? candidates.filter(c => (c.supporting_symptoms?.length || 0) > 0).length / candidates.length
    : 0;

  // FIXED: clamp quality score to 0-100
  const rawScore =
    50 +
    (topProb > 40 ? 15 : 0) +
    (gap > 10 ? 10 : 0) +
    (evidenceCoverage > 0.5 ? 10 : 0) +
    (issues.filter(i => i.severity === "high").length === 0 ? 15 : 0) -
    issues.filter(i => i.severity === "high").length * 10 -
    issues.filter(i => i.severity === "medium").length * 5;

  const qualityScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    quality_score: qualityScore,
    issues,
    distribution_entropy: Math.round(entropy * 100) / 100,
    ranking_stability: Math.round(rankingStability * 100) / 100,
    evidence_coverage: Math.round(evidenceCoverage * 100) / 100,
    needs_iteration: qualityScore < 60 || gap < config.min_probability_gap,
  };
}

// ── 4. Uncertainty Monitor ──

function assessUncertainty(
  candidates: Array<{ diagnosis_name: string; probability: number; must_not_miss?: boolean }>,
  config: CognitiveConfig,
): UncertaintyAssessment {
  const probs = candidates.map(c => c.probability);
  const topProb = probs[0] || 0;
  const secondProb = probs[1] || 0;
  const gap = topProb - secondProb;
  const entropy = calculateEntropy(probs);
  const within10 = probs.filter(p => topProb - p <= 10).length;

  const triggers: string[] = [];
  if (topProb < config.min_top_probability) triggers.push(`Low top probability (${topProb}%)`);
  if (gap < config.min_probability_gap) triggers.push(`Narrow gap (${gap}%)`);
  if (within10 > 3) triggers.push(`${within10} candidates within 10% of top`);
  if (entropy > config.entropy_threshold) triggers.push(`High entropy (${entropy.toFixed(2)})`);

  let level: UncertaintyAssessment["uncertainty_level"] = "low";
  if (triggers.length >= 3) level = "critical";
  else if (triggers.length === 2) level = "high";
  else if (triggers.length === 1) level = "moderate";

  let action: UncertaintyAssessment["recommended_action"] = "finalize";
  if (level === "critical") action = "escalate";
  else if (level === "high") action = "iterate";
  else if (level === "moderate") action = "request_tests";

  if (candidates.some(c => c.must_not_miss && c.probability >= config.dangerous_escalation_threshold)) {
    action = "escalate";
    triggers.push("Dangerous diagnosis above threshold");
  }

  return {
    uncertainty_level: level,
    top_probability: topProb,
    probability_gap: gap,
    candidates_within_10pct: within10,
    entropy: Math.round(entropy * 100) / 100,
    triggers,
    recommended_action: action,
  };
}

// ── 5. Diagnostic Policy Engine ──

function applyDiagnosticPolicies(
  hypotheses: HypothesisEvaluation[],
  uncertainty: UncertaintyAssessment,
  reasoning: ReasoningEvaluation,
): DiagnosticPolicy {
  const actions: DiagnosticPolicy["actions"] = [];

  const dangerousHigh = hypotheses.filter(h => h.is_dangerous && h.probability >= 10);
  if (dangerousHigh.length > 0) {
    actions.push({
      type: "escalate_priority",
      reason: `${dangerousHigh.length} dangerous diagnoses above threshold: ${dangerousHigh.map(h => h.hypothesis).join(", ")}`,
      priority: "critical",
      metadata: { diagnoses: dangerousHigh.map(h => h.hypothesis) },
    });
  }

  if (uncertainty.recommended_action === "iterate") {
    actions.push({
      type: "iterate_reasoning",
      reason: `Uncertainty ${uncertainty.uncertainty_level}: ${uncertainty.triggers.join("; ")}`,
      priority: "high",
    });
  }

  if (reasoning.quality_score < 50) {
    actions.push({
      type: "recommend_tests",
      reason: `Low reasoning quality (${reasoning.quality_score}/100) — additional data needed`,
      priority: "medium",
    });
  }

  if (reasoning.issues.some(i => i.type === "contradictory_evidence" && i.severity === "high")) {
    actions.push({
      type: "flag_safety",
      reason: "High contradictory evidence detected — clinician review recommended",
      priority: "high",
    });
  }

  if (uncertainty.uncertainty_level === "low" && reasoning.quality_score >= 70) {
    actions.push({
      type: "finalize",
      reason: "Diagnostic confidence sufficient for clinical decision",
      priority: "low",
    });
  }

  const shouldIterate = actions.some(a => a.type === "iterate_reasoning");
  const shouldEscalate = actions.some(a => a.type === "escalate_priority");
  const confidenceSufficient = actions.some(a => a.type === "finalize");

  return { actions, should_iterate: shouldIterate, should_escalate: shouldEscalate, confidence_sufficient: confidenceSufficient };
}

// ── Public API ──

/**
 * Run the full Clinical Cognitive Controller evaluation.
 * Called after DDX + Bayesian results are available (between Wave 3 and 3.6).
 */
export function runCognitiveController(
  candidates: Array<{
    diagnosis_name: string;
    probability: number;
    must_not_miss?: boolean;
    supporting_symptoms?: string[];
    contradicting_factors?: string[];
  }>,
  existingTests: string[] = [],
  config: Partial<CognitiveConfig> = {},
): CognitiveControllerOutput {
  const start = performance.now();
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const hypothesisEval = evaluateHypotheses(candidates, cfg);
  const evidenceStrat = planEvidenceStrategy(candidates, existingTests);
  const reasoningEval = evaluateReasoning(candidates, cfg);
  const uncertaintyAssess = assessUncertainty(candidates, cfg);
  const diagnosticPol = applyDiagnosticPolicies(hypothesisEval, uncertaintyAssess, reasoningEval);

  return {
    hypothesis_evaluation: hypothesisEval,
    evidence_strategy: evidenceStrat,
    reasoning_evaluation: reasoningEval,
    uncertainty_assessment: uncertaintyAssess,
    diagnostic_policy: diagnosticPol,
    execution_ms: Math.round(performance.now() - start),
  };
}
