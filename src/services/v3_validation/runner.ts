/**
 * V3 Production Validation Runner
 * Runs cases directly through V3 engine and computes structured metrics.
 */

import { runInference } from "@/services/engine_registry";
import { V3_VALIDATION_CASES } from "./cases";
import type { V3CaseResult, V3ValidationSuiteResult } from "./types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(predicted: string, expected: string): boolean {
  const pn = normalize(predicted);
  const en = normalize(expected);
  return pn.includes(en) || en.includes(pn);
}

export interface V3ValidationProgress {
  current: number;
  total: number;
  case_name: string;
}

export async function runV3ValidationSuite(
  onProgress?: (p: V3ValidationProgress) => void,
): Promise<V3ValidationSuiteResult> {
  const cases = V3_VALIDATION_CASES;
  const results: V3CaseResult[] = [];

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
        results.push(makeErrorResult(c, latency, "Empty diagnoses"));
        continue;
      }

      const dx = data.diagnoses;
      const dxAny = dx as any[];
      const top3 = dxAny.slice(0, 3).map((d: any) => ({
        diagnosis: d.diagnosis_name || d.diagnosis_id,
        probability: d.posterior_probability,
      }));

      const top1Name = top3[0]?.diagnosis || "unknown";
      const top1Match = fuzzyMatch(top1Name, c.expected_top1);
      const top3Match = top3.some((d) => fuzzyMatch(d.diagnosis, c.expected_top1));

      // Find ground truth rank
      let groundTruthRank: number | null = null;
      for (let r = 0; r < dxAny.length; r++) {
        const name = dxAny[r].diagnosis_name || dxAny[r].diagnosis_id;
        if (fuzzyMatch(name, c.expected_top1)) {
          groundTruthRank = r + 1;
          break;
        }
      }

      const top1Dx = dxAny[0];
      const v3State = top1Dx?.v3_state_score ?? 0;
      const v1Symptom = top1Dx?.symptom_score ?? 0;

      // Systemic severity from vitals
      const systemicSignals = [
        (c.input.vitals.blood_pressure_systolic ?? 999) < 100 ? 1 : 0,
        (c.input.vitals.heartRate ?? 0) > 100 ? 1 : 0,
        (c.input.vitals.respiratoryRate ?? 0) > 22 ? 1 : 0,
        (c.input.vitals.temperature ?? 0) > 38.0 ? 1 : 0,
        (c.input.vitals.spo2 ?? 100) < 94 ? 1 : 0,
      ];
      const systemicSeverity = Math.min(systemicSignals.reduce((a, b) => a + b, 0) / 3, 1.0);

      let explanation = `Top-1: ${top1Name} (${(top3[0].probability * 100).toFixed(1)}%).`;
      if (top1Match) {
        explanation += " Correct.";
      } else {
        explanation += ` Expected: ${c.expected_top1}.`;
        if (groundTruthRank) {
          explanation += ` Found at rank #${groundTruthRank}.`;
        } else {
          explanation += " Not found in results.";
        }
      }
      if (systemicSeverity > 0.5) {
        explanation += ` Systemic severity: ${systemicSeverity.toFixed(2)}.`;
      }

      results.push({
        case_id: c.id,
        case_name: c.name,
        category: c.category,
        expected_top1: c.expected_top1,
        top3,
        ground_truth_rank: groundTruthRank,
        top1_match: top1Match,
        top3_match: top3Match,
        systemic_severity: parseFloat(systemicSeverity.toFixed(2)),
        v3_state_contribution_top1: parseFloat(v3State.toFixed(4)),
        v1_symptom_contribution_top1: parseFloat(v1Symptom.toFixed(4)),
        explanation,
        latency_ms: latency,
      });
    } catch (err: any) {
      results.push(makeErrorResult(c, Math.round(performance.now() - t0), err.message));
    }

    // Small delay between calls
    if (i < cases.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Compute metrics
  const systemic = results.filter((r) => r.category === "strong_systemic");
  const local = results.filter((r) => r.category === "pure_local");
  const ambiguous = results.filter((r) => r.category === "ambiguous_overlap");

  const top1Matches = results.filter((r) => r.top1_match).length;
  const top3Matches = results.filter((r) => r.top3_match).length;

  const sysTop1 = systemic.filter((r) => r.top1_match).length;
  const locTop1 = local.filter((r) => r.top1_match).length;
  const ambTop3 = ambiguous.filter((r) => r.top3_match).length;

  // Critical diagnostics
  let v1OverpowerCount = 0;
  let systemicFlipLocalCount = 0;
  const fragile: string[] = [];

  for (const r of results) {
    // V1 overpowering V3 in systemic cases
    if (r.category === "strong_systemic" && !r.top1_match) {
      if (Math.abs(r.v1_symptom_contribution_top1) > Math.abs(r.v3_state_contribution_top1)) {
        v1OverpowerCount++;
      }
    }
    // Systemic weighting flipping local cases
    if (r.category === "pure_local" && !r.top1_match && r.systemic_severity > 0.3) {
      systemicFlipLocalCount++;
    }
    // Fragile: ground truth just barely in top-3 (rank 3)
    if (r.ground_truth_rank === 3) {
      fragile.push(r.case_id);
    }
  }

  return {
    timestamp: new Date().toISOString(),
    total_cases: cases.length,
    metrics: {
      top1_accuracy: parseFloat((top1Matches / cases.length).toFixed(3)),
      top3_recall: parseFloat((top3Matches / cases.length).toFixed(3)),
      systemic_top1_accuracy: systemic.length > 0 ? parseFloat((sysTop1 / systemic.length).toFixed(3)) : 0,
      local_top1_accuracy: local.length > 0 ? parseFloat((locTop1 / local.length).toFixed(3)) : 0,
      ambiguous_top3_rate: ambiguous.length > 0 ? parseFloat((ambTop3 / ambiguous.length).toFixed(3)) : 0,
    },
    v1_overpower_count: v1OverpowerCount,
    systemic_flip_local_count: systemicFlipLocalCount,
    fragile_cases: fragile,
    results,
  };
}

function makeErrorResult(c: any, latency: number, error: string): V3CaseResult {
  return {
    case_id: c.id,
    case_name: c.name,
    category: c.category,
    expected_top1: c.expected_top1,
    top3: [],
    ground_truth_rank: null,
    top1_match: false,
    top3_match: false,
    systemic_severity: 0,
    v3_state_contribution_top1: 0,
    v1_symptom_contribution_top1: 0,
    explanation: `Error: ${error}`,
    latency_ms: latency,
    error,
  };
}
