/**
 * V3 Benchmark Runner — Advanced metrics computation
 */
import { runInference } from "@/services/engine_registry";
import { V3_BENCH_CASES } from "./cases";
import type {
  V3BenchCase, V3BenchCaseResult, V3BenchMetrics,
  V3BenchFailureBreakdown, V3BenchSuiteResult,
} from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(predicted: string, expected: string): boolean {
  const pn = normalize(predicted);
  const en = normalize(expected);
  return pn.includes(en) || en.includes(pn);
}

const GENERIC_DIAGNOSES = ["upper respiratory infection", "viral infection", "common cold", "uri", "viral"];

export interface V3BenchProgress {
  current: number;
  total: number;
  case_name: string;
}

export async function runV3BenchmarkSuite(
  onProgress?: (p: V3BenchProgress) => void,
): Promise<V3BenchSuiteResult> {
  const cases = V3_BENCH_CASES;
  const results: V3BenchCaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    onProgress?.({ current: i + 1, total: cases.length, case_name: c.name });

    const t0 = performance.now();
    try {
      const inference = await runInference({
        candidate_diagnosis_ids: [],
        symptoms: c.input.symptoms,
        vitals: c.input.vitals,
        risk_factors: c.input.risk_factors || [],
        medical_history: c.input.medical_history || [],
        patient_age: c.input.age,
        patient_sex: c.input.sex,
      });

      const latency = Math.round(performance.now() - t0);
      const data = inference.result;

      if (!data?.diagnoses?.length) {
        results.push(makeError(c, latency, "Empty diagnoses"));
        continue;
      }

      const dxAny = data.diagnoses as any[];
      const top3 = dxAny.slice(0, 3).map((d: any) => ({
        diagnosis: d.diagnosis_name || d.diagnosis_id,
        probability: d.posterior_probability,
      }));

      const top1Name = top3[0]?.diagnosis || "unknown";
      const top1Match = fuzzyMatch(top1Name, c.expected_top1);
      const top3Match = top3.some((d) => fuzzyMatch(d.diagnosis, c.expected_top1));

      let groundTruthRank: number | null = null;
      for (let r = 0; r < dxAny.length; r++) {
        const name = dxAny[r].diagnosis_name || dxAny[r].diagnosis_id;
        if (fuzzyMatch(name, c.expected_top1)) { groundTruthRank = r + 1; break; }
      }

      const confGap = top3.length >= 2 ? top3[0].probability - top3[1].probability : top3[0]?.probability || 0;

      let failureReason: string | undefined;
      if (!top1Match && !(c.top3_sufficient && top3Match)) {
        if (GENERIC_DIAGNOSES.some((g) => fuzzyMatch(top1Name, g))) {
          failureReason = "generic_leakage";
        } else if (groundTruthRank === null) {
          failureReason = "missing_state";
        } else if (groundTruthRank <= 5 && confGap < 0.05) {
          failureReason = "weak_discrimination";
        } else {
          failureReason = "scoring_interference";
        }
      }

      results.push({
        case_id: c.id, case_name: c.name, category: c.category,
        expected_top1: c.expected_top1, top3, ground_truth_rank: groundTruthRank,
        top1_match: top1Match, top3_match: top3Match,
        confidence_gap: parseFloat(confGap.toFixed(4)),
        latency_ms: latency, failure_reason: failureReason,
      });
    } catch (err: any) {
      results.push(makeError(c, Math.round(performance.now() - t0), err.message));
    }

    if (i < cases.length - 1) await new Promise((r) => setTimeout(r, 150));
  }

  const metrics = computeMetrics(results, cases);
  const failBreak = computeFailureBreakdown(results);
  const passRate = metrics.top1_accuracy;

  return {
    timestamp: new Date().toISOString(),
    total_cases: cases.length,
    metrics,
    failure_breakdown: failBreak,
    results,
    verdict: passRate >= 0.8 && metrics.top3_recall >= 0.9 ? "production_ready" : "needs_stabilization",
  };
}

function computeMetrics(results: V3BenchCaseResult[], cases: V3BenchCase[]): V3BenchMetrics {
  const sys = results.filter((r) => r.category === "strong_systemic");
  const loc = results.filter((r) => r.category === "pure_local");
  const amb = results.filter((r) => r.category === "ambiguous_overlap");

  const top1 = results.filter((r) => r.top1_match).length;
  const top3 = results.filter((r) => r.top3_match).length;
  const sysT1 = sys.filter((r) => r.top1_match).length;
  const locT1 = loc.filter((r) => r.top1_match).length;
  const ambCases = cases.filter((c) => c.category === "ambiguous_overlap");
  const ambT3 = amb.filter((r, i) => {
    const c = ambCases.find((ac) => ac.id === r.case_id);
    return c?.top3_sufficient ? r.top3_match : r.top1_match;
  }).length;

  const correctResults = results.filter((r) => r.top1_match && r.top3.length > 0);
  const avgConfCorrect = correctResults.length > 0
    ? correctResults.reduce((s, r) => s + r.top3[0].probability, 0) / correctResults.length : 0;
  const avgConfGap = results.length > 0
    ? results.reduce((s, r) => s + r.confidence_gap, 0) / results.length : 0;

  const fragile = results.filter((r) => r.ground_truth_rank === 3).length;
  const sysFlip = loc.filter((r) => !r.top1_match && r.top3.some(
    (d) => fuzzyMatch(d.diagnosis, "sepsis")
  )).length;
  const genericWins = results.filter((r) => !r.top1_match && r.failure_reason === "generic_leakage").length;

  const n = results.length;
  return {
    top1_accuracy: round(top1 / n),
    top3_recall: round(top3 / n),
    systemic_top1: sys.length > 0 ? round(sysT1 / sys.length) : 0,
    local_top1: loc.length > 0 ? round(locT1 / loc.length) : 0,
    ambiguous_top3: amb.length > 0 ? round(ambT3 / amb.length) : 0,
    systemic_sensitivity: sys.length > 0 ? round(sysT1 / sys.length) : 0,
    local_sensitivity: loc.length > 0 ? round(locT1 / loc.length) : 0,
    ambiguous_sensitivity: amb.length > 0 ? round(ambT3 / amb.length) : 0,
    avg_confidence_correct: round(avgConfCorrect),
    avg_confidence_gap: round(avgConfGap),
    fragile_count: fragile,
    systemic_flip_count: sysFlip,
    generic_overuse_rate: round(genericWins / Math.max(1, results.filter((r) => !r.top1_match).length)),
    precision: round(top1 / n),
  };
}

function computeFailureBreakdown(results: V3BenchCaseResult[]): V3BenchFailureBreakdown {
  const fails = results.filter((r) => r.failure_reason);
  return {
    missing_state: fails.filter((r) => r.failure_reason === "missing_state").length,
    weak_discrimination: fails.filter((r) => r.failure_reason === "weak_discrimination").length,
    feature_mismatch: fails.filter((r) => r.failure_reason === "feature_mismatch").length,
    generic_leakage: fails.filter((r) => r.failure_reason === "generic_leakage").length,
    scoring_interference: fails.filter((r) => r.failure_reason === "scoring_interference").length,
  };
}

function round(v: number): number { return parseFloat(v.toFixed(3)); }
function fuzzyMatchLocal(predicted: string, expected: string): boolean {
  return normalize(predicted).includes(normalize(expected)) || normalize(expected).includes(normalize(predicted));
}

function makeError(c: V3BenchCase, latency: number, error: string): V3BenchCaseResult {
  return {
    case_id: c.id, case_name: c.name, category: c.category,
    expected_top1: c.expected_top1, top3: [], ground_truth_rank: null,
    top1_match: false, top3_match: false, confidence_gap: 0,
    latency_ms: latency, error,
  };
}
