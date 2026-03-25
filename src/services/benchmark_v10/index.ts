/**
 * Benchmark v10 — Multi-Layer Clinical Evaluation Suite
 * Public API
 */

export type { BenchmarkCaseV10, BenchmarkLayer, CaseResult, LayerMetrics, SuiteRunResult, SuiteComparison, BenchmarkAuditReport } from "./types";
export { NOISY_CASES } from "./cases_noisy";
export { AMBIGUOUS_CASES } from "./cases_ambiguous";
export { ADVERSARIAL_CASES } from "./cases_adversarial";
export { runV10Suite, type V10PipelineMode, type V10RunProgress } from "./runner";
export { compareV10Runs } from "./comparator";

import { NOISY_CASES } from "./cases_noisy";
import { AMBIGUOUS_CASES } from "./cases_ambiguous";
import { ADVERSARIAL_CASES } from "./cases_adversarial";
import type { BenchmarkCaseV10, BenchmarkAuditReport } from "./types";

/** All new cases across layers 2-4 */
export const ALL_NEW_CASES: BenchmarkCaseV10[] = [
  ...NOISY_CASES,
  ...AMBIGUOUS_CASES,
  ...ADVERSARIAL_CASES,
];

/** Generate audit report for the current benchmark ecosystem */
export function generateAuditReport(): BenchmarkAuditReport {
  const allCases = ALL_NEW_CASES;
  const organSystems: Record<string, number> = {};
  for (const c of allCases) {
    organSystems[c.organ_system] = (organSystems[c.organ_system] || 0) + 1;
  }

  const uniqueSystems = Object.keys(organSystems).length;
  const hasSafety = allCases.filter(c => c.evaluation.safety_expected).length;
  const hasNoise = allCases.filter(c => c.input.noise && c.input.noise.length > 0).length;
  const hasMultiLabel = allCases.filter(c => c.evaluation.type === "multi-label").length;

  return {
    coverage_score: Math.min(100, Math.round((uniqueSystems / 12) * 100)),
    ambiguity_score: Math.round((hasMultiLabel / allCases.length) * 100),
    noise_score: Math.round((hasNoise / allCases.length) * 100),
    clinical_realism_score: Math.round(((hasNoise + hasMultiLabel + hasSafety) / (allCases.length * 3)) * 100),
    failure_modes_detected: [
      "Atypical presentations without classic symptoms",
      "Noise injection creating diagnostic confusion",
      "Multi-label competition between ≥3 diagnoses",
      "Safety-critical conditions with misleading benign signals",
      "Missing history/vitals requiring inference",
      "Natural language variability in chief complaints",
    ],
    organ_system_coverage: organSystems,
    layer_composition: {
      control: 30,
      noisy: NOISY_CASES.length,
      ambiguous: AMBIGUOUS_CASES.length,
      adversarial: ADVERSARIAL_CASES.length,
    },
  };
}
