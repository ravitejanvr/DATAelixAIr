/**
 * V2 Engine Evaluation Dashboard
 * Runs authenticated evaluation suite against real production V2 engine.
 */
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Progress } from "@/components/ui/progress";
import SEO from "@/components/SEO";
import { runEvaluationSuite, assertAuthenticatedProduction, type EvalSuiteResult, type EvalCaseResult } from "@/services/evaluation/runner";
import { EVAL_CASES } from "@/services/evaluation/cases";
import { FlaskConical, CheckCircle, XCircle, AlertTriangle, Loader2, Shield, Activity } from "lucide-react";

export default function V2Evaluation() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [lastResult, setLastResult] = useState<EvalCaseResult | null>(null);
  const [suiteResult, setSuiteResult] = useState<EvalSuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSuite = useCallback(async () => {
    setRunning(true);
    setError(null);
    setSuiteResult(null);
    setProgress(0);
    setTotalCases(EVAL_CASES.length);

    try {
      const result = await runEvaluationSuite((completed, total, last) => {
        setProgress(completed);
        setTotalCases(total);
        setLastResult(last);
      });

      assertAuthenticatedProduction(result);
      setSuiteResult(result);

      console.log("[EVAL_SUITE_COMPLETE]", {
        run_id: result.run_id,
        top1_accuracy: result.top1_accuracy,
        top3_recall: result.top3_recall,
        avg_latency_ms: result.avg_latency_ms,
        errors: result.errors,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, []);

  const handleRunSingle = useCallback(async (caseId: string) => {
    setRunning(true);
    setError(null);
    try {
      const result = await runEvaluationSuite(
        (completed, total, last) => {
          setProgress(completed);
          setTotalCases(total);
          setLastResult(last);
        },
        [caseId]
      );
      setSuiteResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <>
      <SEO title="V2 Engine Evaluation — DATAelixAIr" description="Authenticated evaluation suite for V2 probabilistic engine." />
      <div className="min-h-screen bg-background p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">V2 Engine Evaluation</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {user?.email || "Not signed in"}
            </Badge>
            <Button onClick={handleRunSuite} disabled={running || !user} size="sm">
              {running ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running...</> : <>Run Full Suite ({EVAL_CASES.length} cases)</>}
            </Button>
          </div>
        </div>

        {!user && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            You must be signed in to run evaluations. No anonymous or mock execution allowed.
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
            <XCircle className="h-4 w-4 inline mr-2" />
            {error}
          </div>
        )}

        {running && (
          <ClinicalCard variant="default" className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress: {progress}/{totalCases}</span>
              {lastResult && (
                <span className="text-xs">
                  Last: {lastResult.case_id} → {lastResult.top1_match ? "✓" : "✗"} {lastResult.predicted_top1} ({lastResult.latency_ms}ms)
                </span>
              )}
            </div>
            <Progress value={(progress / totalCases) * 100} />
          </ClinicalCard>
        )}

        {suiteResult && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Top-1 Accuracy" value={`${(suiteResult.top1_accuracy * 100).toFixed(0)}%`} />
              <MetricCard label="Top-3 Recall" value={`${(suiteResult.top3_recall * 100).toFixed(0)}%`} />
              <MetricCard label="Avg Latency" value={`${suiteResult.avg_latency_ms}ms`} />
              <MetricCard label="Avg ΔlogP" value={suiteResult.avg_delta_logP.toFixed(2)} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <MetricCard label="Passed" value={suiteResult.passed} color="text-green-600" />
              <MetricCard label="Failed" value={suiteResult.failed} color="text-orange-500" />
              <MetricCard label="Errors" value={suiteResult.errors} color="text-destructive" />
            </div>

            {/* Auth Validation */}
            <ClinicalCard variant="safe" className="p-3">
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="h-4 w-4" />
                <span>Execution Mode: authenticated_production | User: {suiteResult.identity.email} | All {suiteResult.total_cases} cases used real JWT</span>
              </div>
            </ClinicalCard>

            {/* Case Results Table */}
            <ClinicalCard variant="default" className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Case</th>
                      <th className="p-2 text-left">Category</th>
                      <th className="p-2 text-left">Expected</th>
                      <th className="p-2 text-left">Predicted</th>
                      <th className="p-2 text-right">Score</th>
                      <th className="p-2 text-right">ΔlogP</th>
                      <th className="p-2 text-right">Latency</th>
                      <th className="p-2 text-center">Result</th>
                      <th className="p-2 text-center">Run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suiteResult.results.map((r) => (
                      <tr key={r.case_id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-mono">{r.case_id}</td>
                        <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.category}</Badge></td>
                        <td className="p-2">{r.expected_top1}</td>
                        <td className="p-2">{r.predicted_top1}</td>
                        <td className="p-2 text-right">{(r.predicted_top1_score * 100).toFixed(1)}%</td>
                        <td className="p-2 text-right">{r.delta_logP.toFixed(2)}</td>
                        <td className="p-2 text-right">{r.latency_ms}ms</td>
                        <td className="p-2 text-center">
                          {r.error ? (
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                          ) : r.top1_match ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : r.top3_match ? (
                            <AlertTriangle className="h-4 w-4 text-orange-500 mx-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive mx-auto" />
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => handleRunSingle(r.case_id)} disabled={running}>
                            <Activity className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClinicalCard>
          </>
        )}

        {/* Available Cases (pre-run) */}
        {!suiteResult && !running && (
          <ClinicalCard variant="default" className="p-4">
            <h3 className="text-sm font-semibold mb-3">Available Test Cases ({EVAL_CASES.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {EVAL_CASES.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded border text-xs">
                  <div>
                    <span className="font-mono mr-2">{c.id}</span>
                    <span>{c.name}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">{c.category}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => handleRunSingle(c.id)} disabled={running || !user}>
                    Run
                  </Button>
                </div>
              ))}
            </div>
          </ClinicalCard>
        )}
      </div>
    </>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <ClinicalCard variant="default" className="p-3 text-center">
      <div className={`text-2xl font-bold ${color || "text-foreground"}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </ClinicalCard>
  );
}
