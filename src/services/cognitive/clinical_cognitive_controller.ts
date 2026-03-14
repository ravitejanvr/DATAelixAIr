/**
 * Clinical Cognitive Controller
 *
 * Upgrades the Meta-Orchestrator into a true cognitive reasoning layer.
 * Provides five capabilities:
 *   1. Hypothesis Manager — selects high-value candidate diagnoses
 *   2. Evidence Strategy Planner — determines highest-information-gain next steps
 *   3. Reasoning Evaluator — checks for contradictions and weak distributions
 *   4. Uncertainty Monitor — detects diagnostic uncertainty
 *   5. Diagnostic Policy Engine — implements decision rules
 *
 * Consumed by the v4.3 pipeline orchestrator between Waves 3 and 3.6.
 */

// ── Types ──

export interface HypothesisEvaluation {
  hypothesis: string;
  probability: number;
  evidence_support: number; // 0-1 — how much evidence backs this
  contradiction_count: number;
  is_dangerous: boolean;
  action: "keep" | "prune" | "escalate";
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
}

const DEFAULT_CONFIG: CognitiveConfig = {
  min_top_probability: 45,
  min_probability_gap: 10,
  prune_threshold: 8,
  dangerous_escalation_threshold: 15,
  max_candidates_to_evaluate: 10,
  entropy_threshold: 2.5,
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
  return candidates.slice(0, config.max_candidates_to_evaluate).map(c => {
    const evidenceSupport = (c.supporting_symptoms?.length || 0) /
      Math.max(1, (c.supporting_symptoms?.length || 0) + (c.contradicting_factors?.length || 0));
    const contradictions = c.contradicting_factors?.length || 0;

    let action: HypothesisEvaluation["action"] = "keep";
    let reason = "Sufficient evidence support";

    if (c.must_not_miss) {
      action = "escalate";
      reason = "Must-not-miss diagnosis — always escalated";
    } else if (c.probability < config.prune_threshold && contradictions > 0) {
      action = "prune";
      reason = `Low probability (${c.probability}%) with ${contradictions} contradictions`;
    } else if (c.probability >= config.dangerous_escalation_threshold && c.must_not_miss) {
      action = "escalate";
      reason = `Dangerous diagnosis above threshold (${c.probability}%)`;
    }

    return {
      hypothesis: c.diagnosis_name,
      probability: c.probability,
      evidence_support: Math.round(evidenceSupport * 100) / 100,
      contradiction_count: contradictions,
      is_dangerous: c.must_not_miss || false,
      action,
      reason,
    };
  });
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

  // Determine strategy type
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

  // Generate test recommendations based on top candidates
  const tests: EvidenceStrategy["recommended_tests"] = [];
  const commonTestMap: Record<string, string[]> = {
    cardiovascular: ["ECG", "Troponin", "BNP", "Echocardiogram"],
    respiratory: ["Chest X-ray", "ABG", "Sputum Culture", "Peak Flow"],
    neurological: ["CT Head", "MRI Brain", "Lumbar Puncture"],
    gastrointestinal: ["CT Abdomen", "Lipase", "CBC", "CRP"],
    infectious: ["Blood Culture", "CBC", "CRP", "Procalcitonin"],
    endocrine: ["HbA1c", "TSH", "Fasting Glucose", "BMP"],
    renal: ["BMP", "Urinalysis", "Creatinine", "eGFR"],
  };

  // Use top candidate names to infer test needs
  for (const c of candidates.slice(0, 3)) {
    const name = c.diagnosis_name.toLowerCase();
    for (const [system, systemTests] of Object.entries(commonTestMap)) {
      if (name.includes(system) || systemTests.some(t => !existingTests.includes(t))) {
        for (const t of systemTests.slice(0, 2)) {
          if (!existingTests.includes(t) && !tests.some(tt => tt.test_name === t)) {
            tests.push({
              test_name: t,
              information_gain: Math.round((1 - c.probability / 100) * 0.8 * 100) / 100,
              differentiates: candidates.slice(0, 3).map(cc => cc.diagnosis_name),
              rationale: `Differentiates between top candidates for ${c.diagnosis_name}`,
            });
          }
        }
      }
    }
  }

  return {
    recommended_tests: tests.slice(0, 5),
    total_information_gain: tests.reduce((s, t) => s + t.information_gain, 0),
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

  // Check for contradictory evidence
  if (totalContradictions > totalSupport * 0.5) {
    issues.push({
      type: "contradictory_evidence",
      severity: "high",
      description: `${totalContradictions} contradictions vs ${totalSupport} supporting factors`,
      recommendation: "Review symptom-diagnosis alignment; consider re-extracting symptoms",
    });
  }

  // Check for weak distribution (uniform probabilities)
  if (entropy > config.entropy_threshold && candidates.length >= 3) {
    issues.push({
      type: "weak_distribution",
      severity: "medium",
      description: `High entropy (${entropy.toFixed(2)}) indicates uniform probability distribution`,
      recommendation: "Knowledge graph may lack specificity for this symptom set",
    });
  }

  // Check for overconfidence
  if (topProb > 85 && candidates.length >= 3 && totalSupport < 3) {
    issues.push({
      type: "overconfident",
      severity: "medium",
      description: `Top probability ${topProb}% with only ${totalSupport} supporting factors`,
      recommendation: "Verify diagnostic reasoning chain has sufficient evidence",
    });
  }

  // Check for underconfidence
  if (topProb < 25 && candidates.length > 0) {
    issues.push({
      type: "underconfident",
      severity: "low",
      description: `Top probability only ${topProb}%`,
      recommendation: "May need additional clinical information or knowledge graph expansion",
    });
  }

  // Ranking stability check
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

  const qualityScore = Math.round(
    Math.max(0, Math.min(100,
      50 +
      (topProb > 40 ? 15 : 0) +
      (gap > 10 ? 10 : 0) +
      (evidenceCoverage > 0.5 ? 10 : 0) +
      (issues.filter(i => i.severity === "high").length === 0 ? 15 : 0) -
      issues.filter(i => i.severity === "high").length * 10 -
      issues.filter(i => i.severity === "medium").length * 5
    ))
  );

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

  // Override: if dangerous diagnosis is in play, always escalate
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

  // Policy 1: Dangerous diagnosis escalation
  const dangerousHigh = hypotheses.filter(h => h.is_dangerous && h.probability >= 10);
  if (dangerousHigh.length > 0) {
    actions.push({
      type: "escalate_priority",
      reason: `${dangerousHigh.length} dangerous diagnoses above threshold: ${dangerousHigh.map(h => h.hypothesis).join(", ")}`,
      priority: "critical",
      metadata: { diagnoses: dangerousHigh.map(h => h.hypothesis) },
    });
  }

  // Policy 2: High uncertainty → iterate
  if (uncertainty.recommended_action === "iterate") {
    actions.push({
      type: "iterate_reasoning",
      reason: `Uncertainty ${uncertainty.uncertainty_level}: ${uncertainty.triggers.join("; ")}`,
      priority: "high",
    });
  }

  // Policy 3: Weak reasoning quality → request tests
  if (reasoning.quality_score < 50) {
    actions.push({
      type: "recommend_tests",
      reason: `Low reasoning quality (${reasoning.quality_score}/100) — additional data needed`,
      priority: "medium",
    });
  }

  // Policy 4: Safety flag for contradictions
  if (reasoning.issues.some(i => i.type === "contradictory_evidence" && i.severity === "high")) {
    actions.push({
      type: "flag_safety",
      reason: "High contradictory evidence detected — clinician review recommended",
      priority: "high",
    });
  }

  // Policy 5: Finalize if confidence sufficient
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
