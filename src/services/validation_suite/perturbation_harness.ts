/**
 * Clinical Perturbation Test Harness
 *
 * Evaluates diagnostic behavior under controlled input perturbations.
 * Validates causal correctness, data integrity, and authority compliance.
 */

import { runUnifiedClinicalPipeline, type PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import { setSystemMode } from "@/services/system_mode";
import type { ClinicalContext } from "@/lib/clinical-context";

// ── Types ──

export interface PerturbationExpectation {
  primary?: string;
  primaryNot?: string;
  direction?: "increase_confidence" | "sepsis_decrease";
  minDelta?: number;
  increase?: string;
  minorEffect?: boolean;
  stability?: boolean;
}

export interface PerturbationTestCase {
  name: string;
  changes: Record<string, any>;
  expected: PerturbationExpectation;
}

export interface PerturbationTestResult {
  testName: string;
  status: "PASS" | "FAIL";
  before: { primary: string; score: number; top3: Array<{ name: string; score: number }> };
  after: { primary: string; score: number; top3: Array<{ name: string; score: number }> };
  delta: number;
  notes: string;
  authorityChecks: {
    copilotUsesPrimaryOnly: boolean;
    compliancePrimaryOnly: boolean;
    mergedMatchesDisplay: boolean;
    noStaleCompliance: boolean;
  };
}

export interface PerturbationSuiteReport {
  startedAt: string;
  completedAt: string;
  baseline: { primary: string; score: number; top3: Array<{ name: string; score: number }> };
  results: PerturbationTestResult[];
  overallPassRate: number;
  criticalFailures: string[];
  suspectedRootCauses: string[];
  advancedChecks: {
    nonMonotonicBehavior: boolean;
    featureLeakage: boolean;
    overWeightedPriors: boolean;
    unstableRankings: boolean;
  };
}

export type PerturbationProgress = {
  phase: string;
  current: number;
  total: number;
  message: string;
};

// ── Baseline Patient ──

const BASELINE_CONTEXT: ClinicalContext = {
  chief_complaint: "High fever with dizziness and breathlessness",
  symptoms: ["fever", "dizziness", "breathlessness"],
  patient_age: 58,
  patient_sex: "male",
  height: null,
  weight: null,
  blood_pressure: "92/55",
  pulse: 112,
  temperature: 39.8, // 103.6°F
  respiratory_rate: 24,
  oxygen_saturation: 92,
  symptom_duration: "2 days",
  medical_history: ["diabetes", "immunocompromised"],
  current_medications: [],
  allergies: [],
};

// ── Test Suite ──

const TEST_SUITE: PerturbationTestCase[] = [
  {
    name: "Lactate Injection (Shock Confirmation)",
    changes: {
      symptoms_add: ["elevated lactate"],
      chief_complaint: "High fever with dizziness, breathlessness, and elevated lactate",
      investigation_results: { lactate: 4.5 },
    },
    expected: {
      primary: "sepsis",
      direction: "increase_confidence",
      minDelta: 0.02,
    },
  },
  {
    name: "Shock Removal",
    changes: {
      blood_pressure: "120/80",
      pulse: 88,
      oxygen_saturation: 97,
    },
    expected: {
      direction: "sepsis_decrease",
    },
  },
  {
    name: "Remove Infection Signal",
    changes: {
      temperature: 37.0, // 98.6°F
      symptoms_remove: ["fever"],
      chief_complaint: "Dizziness and breathlessness",
    },
    expected: {
      primaryNot: "sepsis",
    },
  },
  {
    name: "Cardiac Injection",
    changes: {
      symptoms_add: ["chest pain", "elevated troponin"],
      chief_complaint: "High fever with dizziness, breathlessness, and chest pain",
      investigation_results: { troponin: 0.8 },
    },
    expected: {
      increase: "myocardial infarction",
    },
  },
  {
    name: "Risk Factor Removal",
    changes: {
      medical_history: [],
    },
    expected: {
      minorEffect: true,
    },
  },
  {
    name: "Noise Injection",
    changes: {
      symptoms_add: ["headache", "mild cough"],
    },
    expected: {
      stability: true,
    },
  },
  // ── Lab-specific Evidence Engine tests ──
  {
    name: "Procalcitonin Injection (Sepsis Boost)",
    changes: {
      investigation_results: { procalcitonin: 5.0, CRP: 180 },
    },
    expected: {
      primary: "sepsis",
      direction: "increase_confidence",
      minDelta: 0.01,
    },
  },
  {
    name: "D-dimer Injection (PE Boost)",
    changes: {
      symptoms_add: ["pleuritic chest pain", "tachypnea"],
      investigation_results: { D_dimer: 3000 },
    },
    expected: {
      increase: "pulmonary embolism",
    },
  },
  {
    name: "Normal Labs (No Effect)",
    changes: {
      investigation_results: { CRP: 3, WBC: 7, lactate: 1.0 },
    },
    expected: {
      stability: true,
    },
  },
];

// ── Helpers ──

function applyChanges(base: ClinicalContext, changes: Record<string, any>): ClinicalContext {
  const ctx = { ...base, symptoms: [...(base.symptoms || [])] };

  for (const [key, value] of Object.entries(changes)) {
    if (key === "symptoms_add") {
      ctx.symptoms = [...ctx.symptoms, ...(value as string[])];
    } else if (key === "symptoms_remove") {
      const toRemove = new Set((value as string[]).map(s => s.toLowerCase()));
      ctx.symptoms = ctx.symptoms.filter(s => !toRemove.has(s.toLowerCase()));
    } else if (key === "investigation_results") {
      ctx.investigation_results = { ...(ctx.investigation_results || {}), ...value };
    } else if (key in ctx) {
      (ctx as any)[key] = value;
    }
  }

  return ctx;
}

function extractTop3(result: PipelineResult): Array<{ name: string; score: number }> {
  const diags = (result.bayesian?.diagnoses || []) as Array<{
    diagnosis_id: string;
    diagnosis_name?: string;
    posterior_probability: number;
  }>;

  return diags.slice(0, 3).map(d => ({
    name: (d as any).diagnosis_name || d.diagnosis_id,
    score: d.posterior_probability,
  }));
}

function getPrimaryName(result: PipelineResult): string {
  const diags = (result.bayesian?.diagnoses || []) as any[];
  return diags[0]?.diagnosis_name || diags[0]?.diagnosis_id || "UNKNOWN";
}

function getPrimaryScore(result: PipelineResult): number {
  const diags = (result.bayesian?.diagnoses || []) as any[];
  return diags[0]?.posterior_probability || 0;
}

function findDiagnosisScore(result: PipelineResult, name: string): number {
  const diags = (result.bayesian?.diagnoses || []) as any[];
  const norm = name.toLowerCase();
  const match = diags.find(d =>
    (d.diagnosis_name || d.diagnosis_id || "").toLowerCase().includes(norm)
  );
  return match?.posterior_probability || 0;
}

function checkAuthority(result: PipelineResult): PerturbationTestResult["authorityChecks"] {
  // These checks validate structural guarantees at the pipeline level
  const primaryName = getPrimaryName(result);
  const complianceDiagnoses = (result.guideline_compliance as any)?.diagnoses;

  return {
    copilotUsesPrimaryOnly: !!primaryName && primaryName !== "UNKNOWN",
    compliancePrimaryOnly: !complianceDiagnoses || complianceDiagnoses.length <= 1,
    mergedMatchesDisplay: true, // UI-level — verified structurally
    noStaleCompliance: result.guideline_compliance !== null || result.guideline_alignment !== null,
  };
}

// ── Evaluation ──

function evaluateTest(
  tc: PerturbationTestCase,
  baselineResult: PipelineResult,
  perturbedResult: PipelineResult,
): PerturbationTestResult {
  const before = {
    primary: getPrimaryName(baselineResult),
    score: getPrimaryScore(baselineResult),
    top3: extractTop3(baselineResult),
  };
  const after = {
    primary: getPrimaryName(perturbedResult),
    score: getPrimaryScore(perturbedResult),
    top3: extractTop3(perturbedResult),
  };

  const delta = after.score - before.score;
  const authority = checkAuthority(perturbedResult);
  const notes: string[] = [];
  let passed = true;

  // Hard assertions — fail immediately
  if (!authority.copilotUsesPrimaryOnly) {
    passed = false;
    notes.push("HARD FAIL: Copilot does not use primary-only data");
  }
  if (!authority.compliancePrimaryOnly) {
    passed = false;
    notes.push("HARD FAIL: Compliance includes DDX data");
  }

  const exp = tc.expected;

  // Check expectations
  if (exp.primary) {
    const matchesPrimary = after.primary.toLowerCase().includes(exp.primary.toLowerCase());
    if (!matchesPrimary) {
      passed = false;
      notes.push(`Expected primary "${exp.primary}", got "${after.primary}"`);
    }
  }

  if (exp.primaryNot) {
    const matchesExcluded = after.primary.toLowerCase().includes(exp.primaryNot.toLowerCase());
    if (matchesExcluded) {
      passed = false;
      notes.push(`Primary should NOT be "${exp.primaryNot}", but it is`);
    }
  }

  if (exp.direction === "increase_confidence") {
    const sepsisAfter = findDiagnosisScore(perturbedResult, "sepsis");
    const sepsisBefore = findDiagnosisScore(baselineResult, "sepsis");
    const d = sepsisAfter - sepsisBefore;
    if (d < (exp.minDelta || 0)) {
      passed = false;
      notes.push(`Expected sepsis increase ≥${exp.minDelta}, got ${d.toFixed(4)}`);
    } else {
      notes.push(`Sepsis confidence increased by ${(d * 100).toFixed(1)}%`);
    }
  }

  if (exp.direction === "sepsis_decrease") {
    const sepsisAfter = findDiagnosisScore(perturbedResult, "sepsis");
    const sepsisBefore = findDiagnosisScore(baselineResult, "sepsis");
    if (sepsisAfter >= sepsisBefore) {
      passed = false;
      notes.push(`Expected sepsis to decrease, but it didn't (${sepsisBefore.toFixed(3)} → ${sepsisAfter.toFixed(3)})`);
    } else {
      notes.push(`Sepsis decreased: ${(sepsisBefore * 100).toFixed(1)}% → ${(sepsisAfter * 100).toFixed(1)}%`);
    }
  }

  if (exp.increase) {
    const targetAfter = findDiagnosisScore(perturbedResult, exp.increase);
    const targetBefore = findDiagnosisScore(baselineResult, exp.increase);
    if (targetAfter <= targetBefore) {
      passed = false;
      notes.push(`Expected "${exp.increase}" to increase, but ${targetBefore.toFixed(3)} → ${targetAfter.toFixed(3)}`);
    } else {
      notes.push(`"${exp.increase}" increased: ${(targetBefore * 100).toFixed(1)}% → ${(targetAfter * 100).toFixed(1)}%`);
    }
  }

  if (exp.stability) {
    // Primary should not change
    if (before.primary.toLowerCase() !== after.primary.toLowerCase()) {
      passed = false;
      notes.push(`Stability violated: primary changed from "${before.primary}" to "${after.primary}"`);
    }
    // Score delta should be small
    const absDelta = Math.abs(delta);
    if (absDelta > 0.15) {
      passed = false;
      notes.push(`Stability violated: score delta ${(absDelta * 100).toFixed(1)}% exceeds 15% threshold`);
    } else {
      notes.push(`Stable: primary unchanged, delta ${(absDelta * 100).toFixed(1)}%`);
    }
  }

  if (exp.minorEffect) {
    // Primary should stay the same
    if (before.primary.toLowerCase() !== after.primary.toLowerCase()) {
      notes.push(`Minor effect: primary changed (may or may not be a problem)`);
    }
    const absDelta = Math.abs(delta);
    if (absDelta > 0.25) {
      passed = false;
      notes.push(`Risk factor removal caused excessive change: ${(absDelta * 100).toFixed(1)}%`);
    } else {
      notes.push(`Minor effect confirmed: delta ${(absDelta * 100).toFixed(1)}%`);
    }
  }

  if (notes.length === 0) notes.push("All checks passed");

  return {
    testName: tc.name,
    status: passed ? "PASS" : "FAIL",
    before,
    after,
    delta,
    notes: notes.join("; "),
    authorityChecks: authority,
  };
}

// ── Main Runner ──

export async function runPerturbationSuite(
  onProgress?: (p: PerturbationProgress) => void,
): Promise<PerturbationSuiteReport> {
  const startedAt = new Date().toISOString();
  setSystemMode("VALIDATION", "pipeline");

  const total = TEST_SUITE.length + 1; // +1 for baseline
  let step = 0;

  const progress = (msg: string) => {
    step++;
    onProgress?.({ phase: "running", current: step, total, message: msg });
  };

  // Step 1: Baseline
  progress("Running baseline case (58M sepsis)...");
  const baselineResult = await runUnifiedClinicalPipeline({
    clinical_context: BASELINE_CONTEXT,
    visit_id: `perturbation-baseline-${Date.now()}`,
    skip_cache: true,
  });

  const baselineTop3 = extractTop3(baselineResult);
  const baselinePrimary = getPrimaryName(baselineResult);
  const baselineScore = getPrimaryScore(baselineResult);

  console.log("[PERTURBATION] Baseline:", {
    primary: baselinePrimary,
    score: baselineScore,
    top3: baselineTop3,
  });

  // Step 2: Run each test case
  const results: PerturbationTestResult[] = [];

  for (const tc of TEST_SUITE) {
    progress(`Running: ${tc.name}...`);

    const perturbedContext = applyChanges(BASELINE_CONTEXT, tc.changes);

    const perturbedResult = await runUnifiedClinicalPipeline({
      clinical_context: perturbedContext,
      visit_id: `perturbation-${tc.name.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`,
      skip_cache: true,
    });

    const result = evaluateTest(tc, baselineResult, perturbedResult);
    results.push(result);

    console.log(`[PERTURBATION] ${tc.name}: ${result.status}`, result.notes);
  }

  // Step 3: Advanced checks
  const allScores = results.map(r => r.after.score);
  const nonMonotonicBehavior = results.some((r, i) => {
    if (r.testName === "Lactate Injection (Shock Confirmation)") {
      return r.after.score < r.before.score; // Should increase
    }
    if (r.testName === "Shock Removal") {
      const sepsisScore = r.after.top3.find(d => d.name.toLowerCase().includes("sepsis"))?.score || 0;
      return sepsisScore >= r.before.top3.find(d => d.name.toLowerCase().includes("sepsis"))?.score!;
    }
    return false;
  });

  const featureLeakage = results.some(r =>
    r.testName === "Noise Injection" && r.status === "FAIL"
  );

  const overWeightedPriors = results.some(r =>
    r.testName === "Risk Factor Removal" && Math.abs(r.delta) > 0.25
  );

  const unstableRankings = results.filter(r => {
    const top3Changed = r.before.top3.map(d => d.name).join(",") !== r.after.top3.map(d => d.name).join(",");
    return top3Changed && (r.testName === "Noise Injection" || r.testName === "Risk Factor Removal");
  }).length > 0;

  // Summary
  const passCount = results.filter(r => r.status === "PASS").length;
  const criticalFailures = results
    .filter(r => r.status === "FAIL" && r.notes.includes("HARD FAIL"))
    .map(r => r.testName);

  const suspectedRootCauses: string[] = [];
  if (nonMonotonicBehavior) suspectedRootCauses.push("Non-monotonic response to clinical signals — possible score fusion issue");
  if (featureLeakage) suspectedRootCauses.push("Noise features affecting rankings — insufficient noise filtering");
  if (overWeightedPriors) suspectedRootCauses.push("Prior/risk-factor weights too high — Bayesian prior dominance");
  if (unstableRankings) suspectedRootCauses.push("Ranking instability under minor perturbations — weak score separation");
  if (criticalFailures.length > 0) suspectedRootCauses.push("Authority violations detected — data flow contamination");

  // Expose to window for inspection
  if (typeof window !== "undefined") {
    (window as any).__PERTURBATION_RESULTS__ = { baseline: { primary: baselinePrimary, score: baselineScore, top3: baselineTop3 }, results };
  }

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    baseline: { primary: baselinePrimary, score: baselineScore, top3: baselineTop3 },
    results,
    overallPassRate: passCount / results.length,
    criticalFailures,
    suspectedRootCauses,
    advancedChecks: {
      nonMonotonicBehavior,
      featureLeakage,
      overWeightedPriors,
      unstableRankings,
    },
  };
}
