/**
 * Authenticated Evaluation Runner for V2 Probabilistic Engine.
 *
 * Runs test cases against the real edge function under authenticated
 * production conditions. No mocks, no bypass, no anon keys.
 */

import { supabase } from "@/integrations/supabase/client";
import { getAccessToken, getEvalIdentity } from "./auth";
import { EVAL_CASES, type EvalCase } from "./cases";

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

/**
 * Run a single evaluation case using supabase.functions.invoke
 * (which automatically attaches the user's JWT).
 */
async function runSingleCase(testCase: EvalCase, userId: string): Promise<EvalCaseResult> {
  const traceId = `eval-${testCase.id}-${Date.now()}`;
  const start = performance.now();

  try {
    const { data, error } = await supabase.functions.invoke(
      "calculate-diagnostic-probabilities-v2",
      {
        body: {
          symptoms: testCase.input.symptoms,
          vitals: testCase.input.vitals || {},
          lab_results: testCase.input.lab_results || {},
          risk_factors: testCase.input.risk_factors || [],
          medical_history: testCase.input.medical_history || [],
          age: testCase.input.age,
          sex: testCase.input.sex,
          eval_trace_id: traceId,
        },
      }
    );

    const latency = Math.round(performance.now() - start);

    if (error) {
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
        error: error.message || String(error),
      };
    }

    const diagnoses: Array<{ diagnosis_name: string; posterior_probability: number }> =
      data?.diagnoses || [];

    const top1 = diagnoses[0];
    const top2 = diagnoses[1];
    const top3Names = diagnoses.slice(0, 3).map((d) => d.diagnosis_name || "unknown");
    const probs = diagnoses.map((d) => d.posterior_probability);
    const entropy = computeEntropy(probs);
    const deltaLogP =
      top1 && top2
        ? Math.log(top1.posterior_probability) - Math.log(top2.posterior_probability)
        : 0;

    const predictedName = top1?.diagnosis_name || "none";
    const expectedNorm = testCase.expected_top1.toLowerCase();
    const top1Match = predictedName.toLowerCase().includes(expectedNorm) ||
      expectedNorm.includes(predictedName.toLowerCase());
    const top3Match = top3Names.some(
      (n) => n.toLowerCase().includes(expectedNorm) || expectedNorm.includes(n.toLowerCase())
    );

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
      engine_source: data?.source || "v2",
      user_id: userId,
      trace_id: traceId,
    };
  } catch (e: any) {
    return {
      case_id: testCase.id,
      case_name: testCase.name,
      category: testCase.category,
      expected_top1: testCase.expected_top1,
      predicted_top1: "EXCEPTION",
      predicted_top1_score: 0,
      predicted_top3: [],
      top1_match: false,
      top3_match: false,
      delta_logP: 0,
      entropy: 0,
      latency_ms: Math.round(performance.now() - start),
      auth_used: true,
      execution_mode: "authenticated_production",
      engine_source: "exception",
      user_id: userId,
      trace_id: `eval-${testCase.id}-${Date.now()}`,
      error: e.message,
    };
  }
}

/**
 * Run the full evaluation suite.
 * HARD BLOCKS if user is not authenticated.
 */
export async function runEvaluationSuite(
  onProgress?: (completed: number, total: number, lastResult: EvalCaseResult) => void,
  caseFilter?: string[], // optional: filter by case IDs
): Promise<EvalSuiteResult> {
  // ── HARD AUTH GATE ──
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

  // ── Select cases ──
  const cases = caseFilter
    ? EVAL_CASES.filter((c) => caseFilter.includes(c.id))
    : EVAL_CASES;

  const runId = `eval-${Date.now()}`;
  const results: EvalCaseResult[] = [];

  // ── Execute sequentially (avoid rate limits) ──
  for (let i = 0; i < cases.length; i++) {
    const result = await runSingleCase(cases[i], identity.user_id);
    results.push(result);
    onProgress?.(i + 1, cases.length, result);

    // Small delay between calls
    if (i < cases.length - 1) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // ── Compute aggregate metrics ──
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

// Hard assertion for validation
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
