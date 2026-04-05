/**
 * Authenticated Evaluation Runner — Engine-Agnostic
 * Routes through the unified Engine Registry.
 */

import { getAccessToken, getEvalIdentity } from "./auth";
import { EVAL_CASES, type EvalCase } from "./cases";
import { runInference, getActiveEngineVersion } from "@/services/engine_registry";

export interface EvalCaseResult {
  case_id: string;
  case_name: string;
  category: string;
  expected_top1: string;
  predicted_top1: string;
  predicted_top1_score: number;
  predicted_top3: string[];
  top1_match: boolean;
  top3_match: boolean;
  delta_logP: number;
  entropy: number;
  latency_ms: number;
  auth_used: true;
  execution_mode: "authenticated_production";
  engine_source: string;
  user_id: string;
  trace_id: string;
  error?: string;
}

export interface EvalSuiteResult {
  run_id: string;
  timestamp: string;
  total_cases: number;
  passed: number;
  failed: number;
  errors: number;
  avg_latency_ms: number;
  top1_accuracy: number;
  top3_recall: number;
  avg_delta_logP: number;
  avg_entropy: number;
  results: EvalCaseResult[];
  identity: { user_id: string; email: string };
}

function computeEntropy(probs: number[]): number {
  return -probs.reduce((sum, p) => {
    if (p <= 0) return sum;
    return sum + p * Math.log2(p);
  }, 0);
}

function makeErrorResult(
  testCase: EvalCase, latency: number, userId: string, traceId: string, errorMsg: string
): EvalCaseResult {
  return {
    case_id: testCase.id,
    case_name: testCase.name,
    category: testCase.category,
    expected_top1: testCase.expected_top1,
    predicted_top1: "ERROR",
    predicted_top1_score: 0,
    predicted_top3: [],
    top1_match: false,
    top3_match: false,
    delta_logP: 0,
    entropy: 0,
    latency_ms: latency,
    auth_used: true,
    execution_mode: "authenticated_production",
    engine_source: "error",
    user_id: userId,
    trace_id: traceId,
    error: errorMsg,
  };
}

async function runSingleCase(testCase: EvalCase, userId: string): Promise<EvalCaseResult> {
  const traceId = `eval-${testCase.id}-${Date.now()}`;
  const start = performance.now();

  try {
    const payload = {
      candidate_diagnosis_ids: [],
      symptoms: testCase.input.symptoms,
      vitals: testCase.input.vitals || {},
      lab_results: testCase.input.lab_results || {},
      risk_factors: testCase.input.risk_factors || [],
      medical_history: testCase.input.medical_history || [],
      patient_age: testCase.input.age,
      patient_sex: testCase.input.sex,
    };

    console.log("[EVAL_REQUEST]", { case_id: testCase.id, engine: getActiveEngineVersion(), payload });

    const inferenceResult = await runInference(payload);
    const data = inferenceResult.result;

    const latency = inferenceResult.latency_ms;

    if (!data) {
      console.error("[EVAL_EDGE_ERROR]", { case_id: testCase.id, reason: inferenceResult.fallback_reason });
      return makeErrorResult(testCase, latency, userId, traceId, inferenceResult.fallback_reason || "Engine returned null");
    }

    // Log raw response structure for debugging
    console.log("[RAW_ENGINE_RESPONSE]", {
      case_id: testCase.id,
      engine: inferenceResult.engine_version,
      diagnoses_count: data?.diagnoses?.length ?? 0,
      source: data?.source,
    });

    const diagnoses: Array<{
      diagnosis_id: string;
      diagnosis_name?: string;
      posterior_probability: number;
    }> = data?.diagnoses || [];

    if (diagnoses.length === 0) {
      console.warn("[EVAL_EMPTY_DIAGNOSES]", { case_id: testCase.id });
      return makeErrorResult(testCase, latency, userId, traceId, "Empty diagnoses array");
    }

    const top1 = diagnoses[0];
    const top2 = diagnoses[1];
    const top3Names = diagnoses.slice(0, 3).map((d) =>
      d.diagnosis_name || d.diagnosis_id || "unknown"
    );
    const probs = diagnoses.map((d) => d.posterior_probability);
    const entropy = computeEntropy(probs);
    const deltaLogP =
      top1 && top2 && top1.posterior_probability > 0 && top2.posterior_probability > 0
        ? Math.log(top1.posterior_probability) - Math.log(top2.posterior_probability)
        : 0;

    const predictedName = top1?.diagnosis_name || top1?.diagnosis_id || "none";
    const expectedNorm = testCase.expected_top1.toLowerCase();
    const top1Match = predictedName.toLowerCase().includes(expectedNorm) ||
      expectedNorm.includes(predictedName.toLowerCase());
    const top3Match = top3Names.some(
      (n) => n.toLowerCase().includes(expectedNorm) || expectedNorm.includes(n.toLowerCase())
    );

    console.log("[EVAL_CASE_RESULT]", {
      case_id: testCase.id,
      expected: testCase.expected_top1,
      predicted: predictedName,
      score: top1?.posterior_probability,
      top1_match: top1Match,
    });

    return {
      case_id: testCase.id,
      case_name: testCase.name,
      category: testCase.category,
      expected_top1: testCase.expected_top1,
      predicted_top1: predictedName,
      predicted_top1_score: top1?.posterior_probability || 0,
      predicted_top3: top3Names,
      top1_match: top1Match,
      top3_match: top3Match,
      delta_logP: Math.round(deltaLogP * 1000) / 1000,
      entropy: Math.round(entropy * 1000) / 1000,
      latency_ms: latency,
      auth_used: true,
      execution_mode: "authenticated_production",
      engine_source: inferenceResult.engine_version,
      user_id: userId,
      trace_id: traceId,
    };
  } catch (e: any) {
    return makeErrorResult(testCase, Math.round(performance.now() - start), userId, traceId, e.message);
  }
}

export async function runEvaluationSuite(
  onProgress?: (completed: number, total: number, lastResult: EvalCaseResult) => void,
  caseFilter?: string[],
): Promise<EvalSuiteResult> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("[EVAL_BLOCKED] No JWT — cannot run evaluation. Please sign in first.");
  }

  const identity = await getEvalIdentity();
  if (!identity) {
    throw new Error("[EVAL_BLOCKED] Cannot resolve user identity.");
  }

  if (identity.user_id === "anonymous" || !identity.user_id) {
    throw new Error("[EVAL_BLOCKED] Anonymous users cannot run evaluations.");
  }

  console.log("[EVAL_AUTH_CONTEXT]", {
    user_id: identity.user_id,
    email: identity.email,
    is_authenticated: identity.is_authenticated,
  });

  const cases = caseFilter
    ? EVAL_CASES.filter((c) => caseFilter.includes(c.id))
    : EVAL_CASES;

  const runId = `eval-${Date.now()}`;
  const results: EvalCaseResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const result = await runSingleCase(cases[i], identity.user_id);
    results.push(result);
    onProgress?.(i + 1, cases.length, result);

    if (i < cases.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const validResults = results.filter((r) => !r.error);
  const passed = validResults.filter((r) => r.top1_match).length;
  const top3Matches = validResults.filter((r) => r.top3_match).length;
  const errors = results.filter((r) => !!r.error).length;

  return {
    run_id: runId,
    timestamp: new Date().toISOString(),
    total_cases: cases.length,
    passed,
    failed: validResults.length - passed,
    errors,
    avg_latency_ms: Math.round(
      results.reduce((s, r) => s + r.latency_ms, 0) / results.length
    ),
    top1_accuracy: validResults.length > 0 ? Math.round((passed / validResults.length) * 100) / 100 : 0,
    top3_recall: validResults.length > 0 ? Math.round((top3Matches / validResults.length) * 100) / 100 : 0,
    avg_delta_logP: validResults.length > 0
      ? Math.round((validResults.reduce((s, r) => s + r.delta_logP, 0) / validResults.length) * 1000) / 1000
      : 0,
    avg_entropy: validResults.length > 0
      ? Math.round((validResults.reduce((s, r) => s + r.entropy, 0) / validResults.length) * 1000) / 1000
      : 0,
    results,
    identity: { user_id: identity.user_id, email: identity.email },
  };
}

export function assertAuthenticatedProduction(result: EvalSuiteResult): void {
  for (const r of result.results) {
    if (r.execution_mode !== "authenticated_production") {
      throw new Error(`INVALID EVALUATION — case ${r.case_id} not using real auth`);
    }
    if (!r.auth_used) {
      throw new Error(`INVALID EVALUATION — case ${r.case_id} auth_used=false`);
    }
  }
}
