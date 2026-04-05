/**
 * V2 Engine Evaluation Dashboard — Publication-Grade
 * Runs 100-case authenticated evaluation suite with full metrics report.
 */
import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/SEO";
import { runEvaluationSuite, assertAuthenticatedProduction, type EvalSuiteResult, type EvalCaseResult } from "@/services/evaluation/runner";
import { EVAL_CASES } from "@/services/evaluation/cases";
import { computeFullMetrics, getSystemVerdict, type FullMetrics } from "@/services/evaluation/metrics";
import {
  FlaskConical, CheckCircle, XCircle, AlertTriangle, Loader2, Shield, Activity,
  BarChart3, Target, TrendingUp, AlertOctagon, Download,
} from "lucide-react";

export default function V2Evaluation() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCases, setTotalCases] = useState(0);
  const [lastResult, setLastResult] = useState<EvalCaseResult | null>(null);
  const [suiteResult, setSuiteResult] = useState<EvalSuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metrics = useMemo<FullMetrics | null>(
    () => suiteResult ? computeFullMetrics(suiteResult) : null,
    [suiteResult]
  );
  const verdict = useMemo(
    () => metrics ? getSystemVerdict(metrics) : null,
    [metrics]
  );

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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, []);

  const handleRunCategory = useCallback(async (category: string) => {
    setRunning(true);
    setError(null);
    const caseIds = EVAL_CASES.filter(c => c.category === category).map(c => c.id);
    try {
      const result = await runEvaluationSuite((completed, total, last) => {
        setProgress(completed);
        setTotalCases(total);
        setLastResult(last);
      }, caseIds);
      setSuiteResult(result);
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
        (completed, total, last) => { setProgress(completed); setTotalCases(total); setLastResult(last); },
        [caseId]
      );
      setSuiteResult(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    EVAL_CASES.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
    return counts;
  }, []);

  return (
    <>
      <SEO title="V2 Engine Evaluation — DATAelixAIr" description="Publication-grade evaluation suite for V2 probabilistic engine." />
      <div className="min-h-screen bg-background p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-6 w-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-foreground">V2 Engine Evaluation</h1>
            <Badge variant="outline" className="text-[10px]">{EVAL_CASES.length} cases</Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {user?.email || "Not signed in"}
            </Badge>
            <Button onClick={handleRunSuite} disabled={running || !user} size="sm">
              {running ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {progress}/{totalCases}</> : "Run Full Suite"}
            </Button>
            {suiteResult && metrics && verdict && (
              <Button size="sm" variant="outline" onClick={() => downloadReport(suiteResult, metrics, verdict)}>
                <Download className="h-3 w-3 mr-1" /> Report
              </Button>
            )}
          </div>
        </div>

        {!user && <AlertBanner icon={<AlertTriangle className="h-4 w-4" />} text="Sign in required to run evaluations." />}
        {error && <AlertBanner icon={<XCircle className="h-4 w-4" />} text={error} />}

        {/* Progress */}
        {running && (
          <ClinicalCard className="p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Running: {progress}/{totalCases}</span>
              {lastResult && (
                <span>{lastResult.case_id} → {lastResult.top1_match ? "✓" : "✗"} {lastResult.predicted_top1} ({lastResult.latency_ms}ms)</span>
              )}
            </div>
            <Progress value={(progress / totalCases) * 100} />
          </ClinicalCard>
        )}

        {/* Results */}
        {suiteResult && metrics && verdict && (
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="summary" className="gap-1"><Target className="h-3 w-3" />Summary</TabsTrigger>
              <TabsTrigger value="calibration" className="gap-1"><BarChart3 className="h-3 w-3" />Calibration</TabsTrigger>
              <TabsTrigger value="sensitivity" className="gap-1"><TrendingUp className="h-3 w-3" />Sensitivity</TabsTrigger>
              <TabsTrigger value="bias" className="gap-1"><AlertOctagon className="h-3 w-3" />Bias</TabsTrigger>
              <TabsTrigger value="cases" className="gap-1"><Activity className="h-3 w-3" />Cases</TabsTrigger>
            </TabsList>

            {/* ═══ SUMMARY TAB ═══ */}
            <TabsContent value="summary" className="space-y-4">
              {/* Verdict */}
              <ClinicalCard className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`text-lg font-bold ${verdict.color}`}>{verdict.label}</div>
                </div>
                <div className="space-y-1">
                  {verdict.details.map((d, i) => (
                    <div key={i} className="text-xs text-muted-foreground">• {d}</div>
                  ))}
                </div>
              </ClinicalCard>

              {/* Core Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <MetricCard label="Top-1 Accuracy" value={`${(metrics.top1_accuracy * 100).toFixed(0)}%`} target="≥70%" pass={metrics.top1_accuracy >= 0.7} />
                <MetricCard label="Top-3 Recall" value={`${(metrics.top3_recall * 100).toFixed(0)}%`} target="≥90%" pass={metrics.top3_recall >= 0.9} />
                <MetricCard label="Brier Score" value={metrics.brier_score.toFixed(3)} target="≤0.20" pass={metrics.brier_score <= 0.2} />
                <MetricCard label="ECE" value={metrics.ece.toFixed(3)} target="≤0.08" pass={metrics.ece <= 0.08} />
                <MetricCard label="Avg ΔlogP" value={metrics.avg_delta_logP.toFixed(2)} target="≥0.5" pass={metrics.avg_delta_logP >= 0.5} />
                <MetricCard label="Avg Entropy" value={metrics.avg_entropy.toFixed(2)} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Cases" value={metrics.total_cases} />
                <MetricCard label="Valid" value={metrics.valid_cases} color="text-primary" />
                <MetricCard label="Errors" value={metrics.error_cases} color="text-destructive" />
                <MetricCard label="Overconfident" value={metrics.overconfident_count} color={metrics.overconfident_count > 0 ? "text-destructive" : undefined} />
              </div>

              {/* Auth */}
              <ClinicalCard className="p-2">
                <div className="flex items-center gap-2 text-xs text-primary">
                  <CheckCircle className="h-3 w-3" />
                  authenticated_production | {suiteResult.identity.email} | {suiteResult.total_cases} cases
                </div>
              </ClinicalCard>

              {/* Per-Category Table */}
              <ClinicalCard className="p-0 overflow-hidden">
                <div className="p-3 border-b bg-muted/30 text-xs font-semibold">Per-Category Performance</div>
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted/20">
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-right">Cases</th>
                    <th className="p-2 text-right">Top-1</th>
                    <th className="p-2 text-right">Top-3</th>
                    <th className="p-2 text-right">Avg Score</th>
                    <th className="p-2 text-right">Avg ΔlogP</th>
                    <th className="p-2 text-right">Avg Latency</th>
                    <th className="p-2 text-center">Run</th>
                  </tr></thead>
                  <tbody>
                    {metrics.category_metrics.map(cm => (
                      <tr key={cm.category} className="border-b hover:bg-muted/20">
                        <td className="p-2 font-medium">{cm.category}</td>
                        <td className="p-2 text-right">{cm.total}</td>
                        <td className="p-2 text-right">{(cm.top1_accuracy * 100).toFixed(0)}%</td>
                        <td className="p-2 text-right">{(cm.top3_recall * 100).toFixed(0)}%</td>
                        <td className="p-2 text-right">{(cm.avg_score * 100).toFixed(1)}%</td>
                        <td className="p-2 text-right">{cm.avg_delta_logP.toFixed(2)}</td>
                        <td className="p-2 text-right">{cm.avg_latency_ms}ms</td>
                        <td className="p-2 text-center">
                          <Button size="sm" variant="ghost" className="h-5 px-2 text-[10px]" onClick={() => handleRunCategory(cm.category)} disabled={running}>▶</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ClinicalCard>
            </TabsContent>

            {/* ═══ CALIBRATION TAB ═══ */}
            <TabsContent value="calibration" className="space-y-4">
              <ClinicalCard className="p-0 overflow-hidden">
                <div className="p-3 border-b bg-muted/30 text-xs font-semibold">Calibration Curve (Reliability Diagram)</div>
                <div className="p-4">
                  <div className="flex gap-4 items-end h-48">
                    {metrics.calibration_buckets.map((b, i) => {
                      const predictedH = Math.round(b.avg_predicted * 180);
                      const correctH = Math.round(b.avg_correct * 180);
                      return (
                        <div key={i} className="flex flex-col items-center gap-1 flex-1">
                          <div className="flex gap-0.5 items-end h-[180px]">
                            <div className="w-3 bg-primary/40 rounded-t" style={{ height: `${predictedH}px` }} title={`Predicted: ${(b.avg_predicted * 100).toFixed(0)}%`} />
                            <div className="w-3 bg-primary rounded-t" style={{ height: `${correctH}px` }} title={`Actual: ${(b.avg_correct * 100).toFixed(0)}%`} />
                          </div>
                          <div className="text-[9px] text-muted-foreground">{b.range}</div>
                          <div className="text-[9px] text-muted-foreground">n={b.count}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary/40 rounded" /> Predicted</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-primary rounded" /> Actual</span>
                  </div>
                </div>
              </ClinicalCard>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="ECE" value={metrics.ece.toFixed(4)} target="≤0.08" pass={metrics.ece <= 0.08} />
                <MetricCard label="Brier Score" value={metrics.brier_score.toFixed(4)} target="≤0.20" pass={metrics.brier_score <= 0.2} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="% Ambiguous (ΔlogP<0.3)" value={`${metrics.pct_ambiguous.toFixed(0)}%`} />
                <MetricCard label="% Strong Sep (ΔlogP>1.0)" value={`${metrics.pct_strong_separation.toFixed(0)}%`} />
                <MetricCard label="Underconfident" value={metrics.underconfident_count} />
              </div>
            </TabsContent>

            {/* ═══ SENSITIVITY TAB ═══ */}
            <TabsContent value="sensitivity" className="space-y-4">
              <SweepChart title="Lactate Sweep (1→10)" data={metrics.lactate_sweep} xlabel="Lactate (mmol/L)" />
              <SweepChart title="SpO₂ Sweep (100→85)" data={metrics.spo2_sweep} xlabel="SpO₂ (%)" />
              {metrics.sbp_sweep.length > 0 && (
                <SweepChart title="SBP Sweep (140→80)" data={metrics.sbp_sweep} xlabel="SBP (mmHg)" />
              )}
            </TabsContent>

            {/* ═══ BIAS TAB ═══ */}
            <TabsContent value="bias" className="space-y-4">
              {metrics.dominant_diagnosis && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive">
                  <AlertOctagon className="h-4 w-4 inline mr-2" />
                  Dominant bias detected: <strong>{metrics.dominant_diagnosis}</strong> predicted {metrics.diagnosis_frequency[0]?.pct}% of cases
                </div>
              )}

              <ClinicalCard className="p-0 overflow-hidden">
                <div className="p-3 border-b bg-muted/30 text-xs font-semibold">Diagnosis Frequency as Top-1 Prediction</div>
                <table className="w-full text-xs">
                  <thead><tr className="border-b bg-muted/20">
                    <th className="p-2 text-left">Diagnosis</th>
                    <th className="p-2 text-right">Count</th>
                    <th className="p-2 text-right">% of Total</th>
                    <th className="p-2 text-right">Precision</th>
                    <th className="p-2 text-left">Distribution</th>
                  </tr></thead>
                  <tbody>
                    {metrics.diagnosis_frequency.map(df => (
                      <tr key={df.diagnosis} className="border-b hover:bg-muted/20">
                        <td className="p-2">{df.diagnosis}</td>
                        <td className="p-2 text-right">{df.count}</td>
                        <td className="p-2 text-right">{df.pct}%</td>
                        <td className="p-2 text-right">{df.correct_when_predicted}%</td>
                        <td className="p-2">
                          <div className="w-full bg-muted rounded h-2">
                            <div className="bg-primary rounded h-2" style={{ width: `${Math.min(df.pct, 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ClinicalCard>
            </TabsContent>

            {/* ═══ CASES TAB ═══ */}
            <TabsContent value="cases" className="space-y-4">
              <ClinicalCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Case</th>
                      <th className="p-2 text-left">Cat</th>
                      <th className="p-2 text-left">Expected</th>
                      <th className="p-2 text-left">Predicted</th>
                      <th className="p-2 text-right">Score</th>
                      <th className="p-2 text-right">ΔlogP</th>
                      <th className="p-2 text-right">Entropy</th>
                      <th className="p-2 text-right">ms</th>
                      <th className="p-2 text-center">T1</th>
                      <th className="p-2 text-center">T3</th>
                      <th className="p-2 text-left">Error</th>
                      <th className="p-2">Run</th>
                    </tr></thead>
                    <tbody>
                      {suiteResult.results.map(r => (
                        <tr key={r.case_id} className={`border-b hover:bg-muted/20 ${r.error ? "bg-destructive/5" : ""}`}>
                          <td className="p-2 font-mono text-[10px]">{r.case_id}</td>
                          <td className="p-2"><Badge variant="outline" className="text-[9px]">{r.category}</Badge></td>
                          <td className="p-2 max-w-[120px] truncate" title={r.expected_top1}>{r.expected_top1}</td>
                          <td className="p-2 max-w-[120px] truncate" title={r.predicted_top1}>{r.predicted_top1}</td>
                          <td className="p-2 text-right">{(r.predicted_top1_score * 100).toFixed(1)}%</td>
                          <td className="p-2 text-right">{r.delta_logP.toFixed(2)}</td>
                          <td className="p-2 text-right">{r.entropy.toFixed(2)}</td>
                          <td className="p-2 text-right">{r.latency_ms}</td>
                          <td className="p-2 text-center">
                            {r.error ? "—" : r.top1_match ? <CheckCircle className="h-3 w-3 text-primary mx-auto" /> : <XCircle className="h-3 w-3 text-destructive mx-auto" />}
                          </td>
                          <td className="p-2 text-center">
                            {r.error ? "—" : r.top3_match ? <CheckCircle className="h-3 w-3 text-primary mx-auto" /> : <XCircle className="h-3 w-3 text-muted-foreground mx-auto" />}
                          </td>
                          <td className="p-2 text-[10px] text-destructive max-w-[150px] truncate" title={r.error || ""}>{r.error || "—"}</td>
                          <td className="p-2">
                            <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]" onClick={() => handleRunSingle(r.case_id)} disabled={running}>
                              <Activity className="h-3 w-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ClinicalCard>
            </TabsContent>
          </Tabs>
        )}

        {/* Pre-run case list */}
        {!suiteResult && !running && (
          <ClinicalCard className="p-4">
            <h3 className="text-sm font-semibold mb-3">Test Cases ({EVAL_CASES.length})</h3>
            <div className="flex gap-2 mb-3 flex-wrap">
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <Button key={cat} size="sm" variant="outline" className="text-xs" onClick={() => handleRunCategory(cat)} disabled={!user}>
                  {cat} ({count})
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {EVAL_CASES.map(c => (
                <div key={c.id} className="flex items-center justify-between p-1.5 rounded border text-[10px]">
                  <div className="truncate">
                    <span className="font-mono mr-1.5">{c.id}</span>
                    <span className="text-muted-foreground">{c.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px] shrink-0" onClick={() => handleRunSingle(c.id)} disabled={!user}>▶</Button>
                </div>
              ))}
            </div>
          </ClinicalCard>
        )}
      </div>
    </>
  );
}

// ═══════════════ SUB-COMPONENTS ═══════════════

function AlertBanner({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-xs text-destructive flex items-center gap-2">
      {icon}{text}
    </div>
  );
}

function MetricCard({ label, value, target, pass, color }: {
  label: string; value: string | number; target?: string; pass?: boolean; color?: string;
}) {
  return (
    <ClinicalCard className="p-3 text-center">
      <div className={`text-lg font-bold ${color || (pass !== undefined ? (pass ? "text-primary" : "text-destructive") : "text-foreground")}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
      {target && (
        <div className={`text-[9px] mt-0.5 ${pass ? "text-primary" : "text-destructive"}`}>
          {pass ? "✓" : "✗"} {target}
        </div>
      )}
    </ClinicalCard>
  );
}

function SweepChart({ title, data, xlabel }: {
  title: string; data: Array<{ case_id: string; sweep_value: number; predicted: string; score: number }>; xlabel: string;
}) {
  if (data.length === 0) return null;
  const maxScore = Math.max(...data.map(d => d.score), 0.01);

  return (
    <ClinicalCard className="p-0 overflow-hidden">
      <div className="p-3 border-b bg-muted/30 text-xs font-semibold">{title}</div>
      <div className="p-4">
        <div className="flex items-end gap-2 h-40">
          {data.map((d, i) => {
            const h = Math.round((d.score / maxScore) * 140);
            return (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <div className="text-[9px] text-muted-foreground">{(d.score * 100).toFixed(0)}%</div>
                <div className="w-full max-w-8 bg-primary rounded-t" style={{ height: `${h}px` }} />
                <div className="text-[9px] font-mono">{d.sweep_value}</div>
                <div className="text-[8px] text-muted-foreground truncate max-w-16" title={d.predicted}>{d.predicted.slice(0, 8)}</div>
              </div>
            );
          })}
        </div>
        <div className="text-center text-[10px] text-muted-foreground mt-2">{xlabel}</div>
      </div>
    </ClinicalCard>
  );
}
