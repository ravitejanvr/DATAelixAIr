/**
 * Deterministic Validation Suite — Runner
 *
 * Executes 4 test types against clinical scenarios through the production pipeline.
 * Pure validation — no pipeline modifications.
 */

import { runUnifiedClinicalPipeline, type PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import { VALIDATION_SCENARIOS } from "./scenarios";
import type {
  ValidationScenario, DiagnosisSnapshot, RunSnapshot,
  TestResult, TestType, ValidationSuiteResult,
} from "./types";
import type { ClinicalContext } from "@/lib/clinical-context";

// ── Helpers ──

function buildClinicalContext(ctx: ValidationScenario["clinical_context"]): ClinicalContext {
  return {
    chief_complaint: ctx.chief_complaint,
    symptoms: ctx.symptoms.join(", "),
    age: ctx.age,
    sex: ctx.sex,
    vitals: ctx.vitals ?? {},
    medical_history: ctx.medical_history ?? [],
    medications: ctx.medications ?? [],
    allergies: ctx.allergies ?? [],
    duration: ctx.duration ?? "",
    transcript: "",
    follow_up: "",
    assessment: "",
    notes: "",
    doctor_name: "Validation",
  };
}

function extractSnapshot(result: PipelineResult, runIdx: number, skipCache: boolean, t0: number): RunSnapshot {
  const diagnoses: DiagnosisSnapshot[] = [];

  // Primary source: Bayesian posteriors
  if (result.bayesian?.diagnoses?.length) {
    for (let i = 0; i < Math.min(result.bayesian.diagnoses.length, 8); i++) {
      const d = result.bayesian.diagnoses[i];
      diagnoses.push({
        diagnosis: d.diagnosis_id || `unknown-${i}`,
        probability: d.posterior_probability,
        rank: i + 1,
      });
    }
  }
  // Fallback: DDX results
  else if (result.ddx?.differential_diagnoses?.length) {
    for (let i = 0; i < Math.min(result.ddx.differential_diagnoses.length, 8); i++) {
      const d = result.ddx.differential_diagnoses[i];
      diagnoses.push({
        diagnosis: d.diagnosis_name || `unknown-${i}`,
        probability: d.probability / 100,
        rank: i + 1,
      });
    }
  }

  return {
    run_index: runIdx,
    skip_cache: skipCache,
    diagnoses,
    latency_ms: Math.round(performance.now() - t0),
    timestamp: Date.now(),
  };
}

function computeScoreVariance(runs: RunSnapshot[]): number {
  if (runs.length < 2) return 0;
  const ref = runs[0];
  let maxDelta = 0;

  for (let r = 1; r < runs.length; r++) {
    for (let d = 0; d < Math.min(ref.diagnoses.length, runs[r].diagnoses.length); d++) {
      const delta = Math.abs(ref.diagnoses[d].probability - runs[r].diagnoses[d].probability);
      if (delta > maxDelta) maxDelta = delta;
    }
  }
  return maxDelta;
}

function computeRankingVariance(runs: RunSnapshot[]): number {
  if (runs.length < 2) return 0;
  const ref = runs[0].diagnoses.map(d => d.diagnosis);
  let mismatches = 0;

  for (let r = 1; r < runs.length; r++) {
    const current = runs[r].diagnoses.map(d => d.diagnosis);
    for (let i = 0; i < Math.min(ref.length, current.length); i++) {
      if (ref[i] !== current[i]) mismatches++;
    }
  }
  return mismatches;
}

// ── Pipeline execution wrapper ──

async function executePipeline(scenario: ValidationScenario, skipCache: boolean, runIdx: number): Promise<RunSnapshot> {
  const ctx = buildClinicalContext(scenario.clinical_context);
  const t0 = performance.now();

  const result = await runUnifiedClinicalPipeline({
    clinical_context: ctx,
    visit_id: `validation-${scenario.id}-${runIdx}-${Date.now()}`,
    skip_cache: skipCache,
  });

  return extractSnapshot(result, runIdx, skipCache, t0);
}

// ── Test Type 1: Determinism ──

async function runDeterminismTest(
  scenario: ValidationScenario,
  onProgress?: (msg: string) => void,
): Promise<TestResult> {
  onProgress?.(`[Determinism] ${scenario.name}: running 3 cached + 3 uncached`);
  const cachedRuns: RunSnapshot[] = [];
  const uncachedRuns: RunSnapshot[] = [];

  for (let i = 0; i < 3; i++) {
    uncachedRuns.push(await executePipeline(scenario, true, i));
  }
  for (let i = 0; i < 3; i++) {
    cachedRuns.push(await executePipeline(scenario, false, i + 3));
  }

  const allRuns = [...uncachedRuns, ...cachedRuns];
  const scoreVar = computeScoreVariance(uncachedRuns);
  const rankVar = computeRankingVariance(uncachedRuns);

  return {
    scenario: scenario.id,
    test_type: "determinism",
    passed: scoreVar === 0 && rankVar === 0,
    score_variance: scoreVar,
    ranking_variance: rankVar,
    runs: allRuns,
    details: scoreVar > 0 ? `Max score delta: ${(scoreVar * 100).toFixed(3)}%` : undefined,
  };
}

// ── Test Type 2: Sensitivity ──

async function runSensitivityTest(
  scenario: ValidationScenario,
  onProgress?: (msg: string) => void,
): Promise<TestResult> {
  if (!scenario.sensitivity_variant) {
    return {
      scenario: scenario.id,
      test_type: "sensitivity",
      passed: true,
      score_variance: 0,
      ranking_variance: 0,
      details: "No sensitivity variant defined",
    };
  }

  onProgress?.(`[Sensitivity] ${scenario.name}: baseline vs variant`);

  const baselineRun = await executePipeline(scenario, true, 0);

  const variant: ValidationScenario = {
    ...scenario,
    clinical_context: {
      ...scenario.clinical_context,
      ...scenario.sensitivity_variant.overrides,
    },
  };
  const variantRun = await executePipeline(variant, true, 1);

  const target = scenario.sensitivity_variant.target_diagnosis.toLowerCase();
  const baseProb = baselineRun.diagnoses.find(d => d.diagnosis.toLowerCase().includes(target))?.probability ?? 0;
  const varProb = variantRun.diagnoses.find(d => d.diagnosis.toLowerCase().includes(target))?.probability ?? 0;

  const delta = varProb - baseProb;
  const expectedDir = scenario.sensitivity_variant.expected_effect;
  const passed = expectedDir === "decrease" ? delta < -0.01 : delta > 0.01;

  return {
    scenario: scenario.id,
    test_type: "sensitivity",
    passed,
    score_variance: Math.abs(delta),
    ranking_variance: 0,
    runs: [baselineRun, variantRun],
    details: `${target}: ${(baseProb * 100).toFixed(1)}% → ${(varProb * 100).toFixed(1)}% (${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%)`,
  };
}

// ── Test Type 3: Isolation ──

async function runIsolationTest(
  onProgress?: (msg: string) => void,
): Promise<TestResult> {
  const sepsis = VALIDATION_SCENARIOS.find(s => s.id === "sepsis")!;
  const migraine = VALIDATION_SCENARIOS.find(s => s.id === "migraine")!;

  onProgress?.("[Isolation] Running Sepsis → Migraine → Sepsis sequence");

  const run1 = await executePipeline(sepsis, true, 0);
  await executePipeline(migraine, true, 1); // contamination attempt
  const run2 = await executePipeline(sepsis, true, 2);

  const scoreVar = computeScoreVariance([run1, run2]);
  const rankVar = computeRankingVariance([run1, run2]);

  return {
    scenario: "sepsis→migraine→sepsis",
    test_type: "isolation",
    passed: scoreVar === 0 && rankVar === 0,
    score_variance: scoreVar,
    ranking_variance: rankVar,
    runs: [run1, run2],
    details: scoreVar > 0 ? `State leak detected: max delta ${(scoreVar * 100).toFixed(3)}%` : "No state leak",
  };
}

// ── Test Type 4: Cache Consistency ──

async function runCacheConsistencyTest(
  scenario: ValidationScenario,
  onProgress?: (msg: string) => void,
): Promise<TestResult> {
  onProgress?.(`[Cache] ${scenario.name}: cached vs uncached`);

  const uncached = await executePipeline(scenario, true, 0);
  const cached = await executePipeline(scenario, false, 1);

  const scoreVar = computeScoreVariance([uncached, cached]);
  const rankVar = computeRankingVariance([uncached, cached]);

  return {
    scenario: scenario.id,
    test_type: "cache_consistency",
    passed: scoreVar < 0.001 && rankVar === 0,
    score_variance: scoreVar,
    ranking_variance: rankVar,
    runs: [uncached, cached],
    details: scoreVar > 0 ? `Cache divergence: ${(scoreVar * 100).toFixed(3)}%` : "Consistent",
  };
}

// ── Main Suite Runner ──

export interface ValidationProgress {
  phase: string;
  current: number;
  total: number;
  message: string;
}

export async function runValidationSuite(
  onProgress?: (p: ValidationProgress) => void,
): Promise<ValidationSuiteResult> {
  const started_at = new Date().toISOString();
  const tests: TestResult[] = [];
  const scenarios = VALIDATION_SCENARIOS;

  const totalSteps = scenarios.length * 3 + 1; // determinism + sensitivity + cache per scenario + 1 isolation
  let step = 0;

  const progress = (msg: string) => {
    step++;
    onProgress?.({ phase: "running", current: step, total: totalSteps, message: msg });
  };

  // Determinism tests
  for (const s of scenarios) {
    tests.push(await runDeterminismTest(s, progress));
  }

  // Sensitivity tests
  for (const s of scenarios) {
    tests.push(await runSensitivityTest(s, progress));
  }

  // Isolation test
  tests.push(await runIsolationTest(progress));

  // Cache consistency tests
  for (const s of scenarios) {
    tests.push(await runCacheConsistencyTest(s, progress));
  }

  // Summary
  const detTests = tests.filter(t => t.test_type === "determinism");
  const senTests = tests.filter(t => t.test_type === "sensitivity");
  const isoTests = tests.filter(t => t.test_type === "isolation");
  const cacheTests = tests.filter(t => t.test_type === "cache_consistency");

  const deterministic = detTests.every(t => t.passed);
  const stable = cacheTests.every(t => t.passed);
  const no_state_leak = isoTests.every(t => t.passed);
  const feature_sensitive = senTests.every(t => t.passed);

  const anyFail = !deterministic || !stable || !no_state_leak;
  let root_cause_hint: string | null = null;
  if (!deterministic) root_cause_hint = "Score/ranking variance across identical runs — likely timeout, fallback, or non-deterministic AI response";
  else if (!no_state_leak) root_cause_hint = "State leak detected between scenarios — shared mutable state in pipeline";
  else if (!stable) root_cause_hint = "Cache produces different output than fresh run — cache key mismatch or stale data";

  return {
    started_at,
    completed_at: new Date().toISOString(),
    tests,
    summary: {
      deterministic,
      stable,
      no_state_leak,
      feature_sensitive,
      system_not_deterministic: anyFail,
      root_cause_hint,
    },
  };
}
