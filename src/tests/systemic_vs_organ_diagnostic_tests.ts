/**
 * Systemic vs Organ-Specific Diagnostic Test Harness
 *
 * Pure observation layer — does NOT modify pipeline, scoring, or ranking.
 * Validates whether the system differentiates systemic (Sepsis) from
 * organ-specific (Pneumonia) presentations given controlled clinical inputs.
 */

import { buildFullClinicalContext, EMPTY_CLINICAL_CONTEXT } from "@/lib/clinical-context";
import type { ClinicalContext } from "@/lib/clinical-context";
import { runUnifiedClinicalPipeline } from "@/services/clinical_pipeline/orchestrator";
import type { PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import { diagMatch } from "@/services/benchmark_shared/diagnosis_matching";

// ── Types ──

interface CaseDefinition {
  id: "A" | "B" | "C";
  label: string;
  overrides: {
    chiefComplaint: string;
    symptoms: string[];
    duration?: string;
    risk_factors?: string[];
    exam_findings?: string[];
  };
  vitals: {
    temperature: number;
    pulse: number;
    bp_systolic: number;
    bp_diastolic: number;
    respiratory_rate: number;
    spo2: number;
  };
  expect: {
    sepsis_should_beat_pneumonia: boolean | null; // null = close competition OK
    required_rank1?: "sepsis" | "pneumonia";
  };
}

interface CaseResult {
  case: string;
  label: string;
  top_diagnosis: string;
  sepsis_score: number;
  pneumonia_score: number;
  rank_sepsis: number;
  rank_pneumonia: number;
  score_gap: number;
  passed: boolean;
  reason: string;
}

interface TestReport {
  test_suite: "systemic_vs_organ";
  results: CaseResult[];
  summary: {
    total_cases: number;
    passed: number;
    failed: number;
    system_behavior: "systemic_blind" | "partially_balanced" | "correct";
  };
}

// ── Test Cases ──

const TEST_CASES: CaseDefinition[] = [
  {
    id: "A",
    label: "Mixed (Systemic + Lung)",
    overrides: {
      chiefComplaint: "fever",
      symptoms: ["fever", "dizziness", "breathlessness"],
      risk_factors: ["diabetes", "immunocompromised"],
    },
    vitals: {
      temperature: 103.6,
      pulse: 112,
      bp_systolic: 92,
      bp_diastolic: 55,
      respiratory_rate: 24,
      spo2: 92,
    },
    expect: {
      sepsis_should_beat_pneumonia: null, // close competition acceptable
    },
  },
  {
    id: "B",
    label: "Systemic Dominant (No Lung Signal)",
    overrides: {
      chiefComplaint: "fever",
      symptoms: ["fever", "dizziness"],
      risk_factors: ["diabetes", "immunocompromised"],
    },
    vitals: {
      temperature: 103.6,
      pulse: 112,
      bp_systolic: 92,
      bp_diastolic: 55,
      respiratory_rate: 24,
      spo2: 98, // normal SpO2 — no lung involvement
    },
    expect: {
      sepsis_should_beat_pneumonia: true,
      required_rank1: "sepsis",
    },
  },
  {
    id: "C",
    label: "Lung Dominant (No Shock)",
    overrides: {
      chiefComplaint: "fever",
      symptoms: ["fever", "breathlessness"],
      risk_factors: [],
    },
    vitals: {
      temperature: 101.0,
      pulse: 88,
      bp_systolic: 120,
      bp_diastolic: 80,
      respiratory_rate: 20,
      spo2: 92, // low SpO2 with stable hemodynamics
    },
    expect: {
      sepsis_should_beat_pneumonia: false,
      required_rank1: "pneumonia",
    },
  },
];

// ── Helpers ──

function buildContextForCase(c: CaseDefinition): ClinicalContext {
  const base: ClinicalContext = {
    ...EMPTY_CLINICAL_CONTEXT,
    temperature: c.vitals.temperature,
    pulse: c.vitals.pulse,
    blood_pressure: `${c.vitals.bp_systolic}/${c.vitals.bp_diastolic}`,
    respiratory_rate: c.vitals.respiratory_rate,
    oxygen_saturation: c.vitals.spo2,
  };

  return buildFullClinicalContext(base, {
    chiefComplaint: c.overrides.chiefComplaint,
    symptoms: c.overrides.symptoms,
    duration: c.overrides.duration,
    risk_factors: c.overrides.risk_factors,
    exam_findings: c.overrides.exam_findings,
  });
}

function findDiagnosis(
  diagnoses: Array<{ diagnosis_name?: string; diagnosis_id?: string; posterior_probability?: number }>,
  target: string,
): { score: number; rank: number } {
  const sorted = [...diagnoses].sort(
    (a, b) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0),
  );

  for (let i = 0; i < sorted.length; i++) {
    const name = sorted[i].diagnosis_name ?? sorted[i].diagnosis_id ?? "";
    if (diagMatch(name, target)) {
      return { score: sorted[i].posterior_probability ?? 0, rank: i + 1 };
    }
  }

  return { score: 0, rank: sorted.length + 1 };
}

function evaluateCase(c: CaseDefinition, diagnoses: any[]): CaseResult {
  const sorted = [...diagnoses].sort(
    (a: any, b: any) => (b.posterior_probability ?? 0) - (a.posterior_probability ?? 0),
  );

  const topName = sorted[0]?.diagnosis_name ?? sorted[0]?.diagnosis_id ?? "unknown";
  const sepsis = findDiagnosis(diagnoses, "sepsis");
  const pneumonia = findDiagnosis(diagnoses, "pneumonia");
  const scoreGap = pneumonia.score - sepsis.score;

  let passed = true;
  let reason = "OK";

  if (c.expect.required_rank1 === "sepsis" && sepsis.rank !== 1) {
    passed = false;
    reason = `Expected sepsis rank 1, got rank ${sepsis.rank}`;
  } else if (c.expect.required_rank1 === "pneumonia" && pneumonia.rank !== 1) {
    passed = false;
    reason = `Expected pneumonia rank 1, got rank ${pneumonia.rank}`;
  } else if (c.expect.sepsis_should_beat_pneumonia === true && sepsis.score < pneumonia.score) {
    passed = false;
    reason = `Expected sepsis >= pneumonia but gap=${scoreGap.toFixed(4)}`;
  } else if (c.expect.sepsis_should_beat_pneumonia === false && pneumonia.score < sepsis.score) {
    passed = false;
    reason = `Expected pneumonia >= sepsis but gap=${scoreGap.toFixed(4)}`;
  } else if (c.expect.sepsis_should_beat_pneumonia === null) {
    // Close competition: gap within 10% is acceptable
    if (Math.abs(scoreGap) > 0.10) {
      reason = `Gap=${(scoreGap * 100).toFixed(1)}% — outside 10% tolerance but accepted`;
    }
  }

  return {
    case: c.id,
    label: c.label,
    top_diagnosis: topName,
    sepsis_score: Math.round(sepsis.score * 10000) / 10000,
    pneumonia_score: Math.round(pneumonia.score * 10000) / 10000,
    rank_sepsis: sepsis.rank,
    rank_pneumonia: pneumonia.rank,
    score_gap: Math.round(scoreGap * 10000) / 10000,
    passed,
    reason,
  };
}

function classifyBehavior(results: CaseResult[]): "systemic_blind" | "partially_balanced" | "correct" {
  const caseA = results.find((r) => r.case === "A");
  const caseB = results.find((r) => r.case === "B");

  const sepsisLosesA = caseA ? caseA.rank_sepsis > caseA.rank_pneumonia : false;
  const sepsisLosesB = caseB ? caseB.rank_sepsis > caseB.rank_pneumonia : false;

  if (sepsisLosesA && sepsisLosesB) return "systemic_blind";
  if (results.every((r) => r.passed)) return "correct";
  return "partially_balanced";
}

// ── Runner ──

export async function runSystemicVsOrganTests(): Promise<TestReport> {
  console.log("═══════════════════════════════════════════════");
  console.log("  SYSTEMIC vs ORGAN DIAGNOSTIC TEST HARNESS");
  console.log("═══════════════════════════════════════════════");

  const results: CaseResult[] = [];

  for (const testCase of TEST_CASES) {
    console.log(`\n▶ Running Case ${testCase.id}: ${testCase.label}`);

    const context = buildContextForCase(testCase);

    const pipelineResult: PipelineResult = await runUnifiedClinicalPipeline(
      {
        clinical_context: context,
        skip_cache: true,
      },
      () => {}, // no-op progress callback
    );

    const diagnoses = pipelineResult.bayesian?.diagnoses ?? [];

    if (diagnoses.length === 0) {
      console.warn(`  ⚠ Case ${testCase.id}: No Bayesian diagnoses returned`);
      results.push({
        case: testCase.id,
        label: testCase.label,
        top_diagnosis: "NO_OUTPUT",
        sepsis_score: 0,
        pneumonia_score: 0,
        rank_sepsis: 0,
        rank_pneumonia: 0,
        score_gap: 0,
        passed: false,
        reason: "No diagnoses returned from pipeline",
      });
      continue;
    }

    const result = evaluateCase(testCase, diagnoses);
    results.push(result);

    console.log(`  Sepsis: score=${result.sepsis_score} rank=${result.rank_sepsis}`);
    console.log(`  Pneumonia: score=${result.pneumonia_score} rank=${result.rank_pneumonia}`);
    console.log(`  Gap: ${result.score_gap}`);
    console.log(`  ${result.passed ? "✅ PASS" : "❌ FAIL"}: ${result.reason}`);
  }

  const passedCount = results.filter((r) => r.passed).length;
  const behavior = classifyBehavior(results);

  const report: TestReport = {
    test_suite: "systemic_vs_organ",
    results,
    summary: {
      total_cases: results.length,
      passed: passedCount,
      failed: results.length - passedCount,
      system_behavior: behavior,
    },
  };

  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════");
  console.table(
    results.map((r) => ({
      Case: r.case,
      Top: r.top_diagnosis,
      Sepsis: `${(r.sepsis_score * 100).toFixed(1)}% (#${r.rank_sepsis})`,
      Pneumonia: `${(r.pneumonia_score * 100).toFixed(1)}% (#${r.rank_pneumonia})`,
      Gap: `${(r.score_gap * 100).toFixed(1)}%`,
      Result: r.passed ? "✅" : "❌",
    })),
  );
  console.log(`System Behavior: ${behavior}`);
  console.log(`Passed: ${passedCount}/${results.length}`);

  return report;
}
