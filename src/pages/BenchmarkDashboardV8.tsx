import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  Clock, Target, Shield, Activity, Brain, Beaker,
  TrendingUp, BarChart3, Zap, History, ChevronDown, ChevronUp,
  GitBranch, Repeat, Scissors, ArrowUpRight, Layers, Gauge, Eye,
} from "lucide-react";
import {
  runBenchmarkV8, loadPersistedV8Results, getCaseDistributionV8, BENCHMARK_CASES_V8,
} from "@/services/benchmark_v8";
import type {
  BenchmarkSuiteResultV8, CaseResultV8, BatchProgressV8, ReasoningCategory,
} from "@/services/benchmark_v8";

// ── Helpers ──

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function pctRaw(v: number) { return `${Math.round(v)}%`; }
function ms(v: number) { return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`; }

function statusIcon(ok: boolean) {
  return ok
    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
    : <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function metricBadge(value: number, good: number, warn: number) {
  return value >= good
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
    : value >= warn
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
      : "bg-destructive/10 text-destructive";
}

function latencyColor(v: number) {
  if (v < 2000) return "text-emerald-600 dark:text-emerald-400";
  if (v < 5000) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

const CATEGORY_LABELS: Record<ReasoningCategory, { label: string; icon: React.ReactNode; color: string }> = {
  straightforward: { label: "Straightforward", icon: <CheckCircle className="h-3 w-3" />, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" },
  ambiguous: { label: "Ambiguous", icon: <GitBranch className="h-3 w-3" />, color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" },
  deceptive: { label: "Deceptive", icon: <AlertTriangle className="h-3 w-3" />, color: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" },
};

// ── Metric Card ──

function MetricCard({ label, value, icon, good, target, subtitle }: {
  label: string; value: string; icon: React.ReactNode; good: boolean; target?: string; subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className={good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{icon}</span>
          {target && <span className="text-[8px] text-muted-foreground font-mono">Target: {target}</span>}
        </div>
        <p className={`text-xl font-bold ${good ? "text-foreground" : "text-destructive"}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {subtitle && <p className="text-[9px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ── Main Component ──

export default function BenchmarkDashboardV8() {
  const [suiteResult, setSuiteResult] = useState<BenchmarkSuiteResultV8 | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgressV8 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const distribution = useMemo(() => getCaseDistributionV8(), []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setSuiteResult(null);
    const ac = new AbortController();
    setAbortController(ac);
    try {
      const result = await runBenchmarkV8(
        (p) => setProgress(p),
        undefined,
        undefined,
        { batchSize: 5, delayBetweenBatchesMs: 3000, delayBetweenCasesMs: 500 },
        ac.signal,
      );
      setSuiteResult(result);
      setActiveTab("overview");
    } catch (e: any) {
      setError(e.message || "Benchmark run failed");
    } finally {
      setRunning(false);
      setProgress(null);
      setAbortController(null);
    }
  }, []);

  const handleStop = useCallback(() => { abortController?.abort(); }, [abortController]);

  const handleLoadHistory = useCallback(async () => {
    setError(null);
    try {
      const result = await loadPersistedV8Results();
      if (!result) { setError("No persisted v8 benchmark results found."); return; }
      setSuiteResult(result);
      setActiveTab("overview");
    } catch (e: any) {
      setError(e.message || "Failed to load history");
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Benchmark v8 — Cognitive Clinical Reasoning
          </h2>
          <p className="text-xs text-muted-foreground">
            {distribution.total} scenarios · 3 reasoning categories · {Object.keys(distribution.bySpecialty).length} specialties · Cognitive controller evaluation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleLoadHistory} size="sm" variant="outline" disabled={running}>
            <History className="h-3.5 w-3.5 mr-1" />Load History
          </Button>
          {running ? (
            <Button onClick={handleStop} size="sm" variant="destructive">
              <XCircle className="h-3.5 w-3.5 mr-1" />Stop
            </Button>
          ) : (
            <Button onClick={handleRun} size="sm">
              <Play className="h-3.5 w-3.5 mr-1" />Run Benchmark
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {running && progress && (
        <Card className="border-primary/30">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-medium">{progress.caseName}</span>
              </div>
              <Badge className={CATEGORY_LABELS[progress.reasoningCategory].color}>
                {CATEGORY_LABELS[progress.reasoningCategory].label}
              </Badge>
            </div>
            <Progress value={(progress.caseIndex / progress.totalCases) * 100} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              Case {progress.caseIndex + 1}/{progress.totalCases} · Batch {progress.batchNumber}/{progress.totalBatches}
              {progress.status === "batch_delay" && " · Cooling down…"}
              {progress.status === "credit_error" && " · ⚠ Credits exhausted"}
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />{error}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!suiteResult && !running && !error && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Run the cognitive reasoning benchmark or load historical results.
            </p>
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <span>🟢 Straightforward: {distribution.byCategory.straightforward || 0}</span>
              <span>🟡 Ambiguous: {distribution.byCategory.ambiguous || 0}</span>
              <span>🔴 Deceptive: {distribution.byCategory.deceptive || 0}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {suiteResult && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs"><BarChart3 className="h-3 w-3 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="cognitive" className="text-xs"><Brain className="h-3 w-3 mr-1" />Cognitive</TabsTrigger>
            <TabsTrigger value="reasoning" className="text-xs"><GitBranch className="h-3 w-3 mr-1" />Iterative</TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs"><Beaker className="h-3 w-3 mr-1" />Scenarios ({suiteResult.total_cases})</TabsTrigger>
            <TabsTrigger value="latency" className="text-xs"><Clock className="h-3 w-3 mr-1" />Latency</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="Top-1 Accuracy" value={pct(suiteResult.top1_accuracy)} icon={<Target className="h-4 w-4" />} good={suiteResult.top1_accuracy >= 0.45} target="≥45%" subtitle={`${suiteResult.cases.filter(c => c.top1_match).length}/${suiteResult.total_cases}`} />
              <MetricCard label="Top-3 Accuracy" value={pct(suiteResult.top3_accuracy)} icon={<TrendingUp className="h-4 w-4" />} good={suiteResult.top3_accuracy >= 0.70} target="≥70%" subtitle={`${suiteResult.cases.filter(c => c.top3_match).length}/${suiteResult.total_cases}`} />
              <MetricCard label="Top-5 Accuracy" value={pct(suiteResult.top5_accuracy)} icon={<Layers className="h-4 w-4" />} good={suiteResult.top5_accuracy >= 0.85} target="≥85%" />
              <MetricCard label="Danger Detection" value={pct(suiteResult.danger_detection_rate)} icon={<Shield className="h-4 w-4" />} good={suiteResult.danger_detection_rate >= 0.95} target="≥95%" subtitle={`${suiteResult.danger_false_negative_count} missed`} />
              <MetricCard label="Avg Latency" value={ms(suiteResult.latency.avg_total_ms)} icon={<Clock className="h-4 w-4" />} good={suiteResult.latency.avg_total_ms < 2000} target="<2s" />
              <MetricCard label="Pass Rate" value={pct(suiteResult.pass_rate)} icon={<CheckCircle className="h-4 w-4" />} good={suiteResult.pass_rate >= 0.70} subtitle={`${suiteResult.passed_cases}/${suiteResult.total_cases}`} />
            </div>

            {/* Category breakdown */}
            <Card>
              <CardHeader className="py-2 px-4"><CardTitle className="text-xs">Results by Reasoning Category</CardTitle></CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(["straightforward", "ambiguous", "deceptive"] as ReasoningCategory[]).map(cat => {
                    const data = suiteResult.by_category[cat];
                    const catInfo = CATEGORY_LABELS[cat];
                    return (
                      <Card key={cat} className="border-muted">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={catInfo.color}>{catInfo.icon}{catInfo.label}</Badge>
                            <span className="text-[10px] text-muted-foreground">{data.cases} cases</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-lg font-bold">{data.cases > 0 ? pctRaw((data.top1 / data.cases) * 100) : "—"}</p>
                              <p className="text-[9px] text-muted-foreground">Top-1</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{data.cases > 0 ? pctRaw((data.top3 / data.cases) * 100) : "—"}</p>
                              <p className="text-[9px] text-muted-foreground">Top-3</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">{data.passed}/{data.cases}</p>
                              <p className="text-[9px] text-muted-foreground">Passed</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Specialty breakdown */}
            <Card>
              <CardHeader className="py-2 px-4"><CardTitle className="text-xs">Results by Specialty</CardTitle></CardHeader>
              <CardContent className="px-2 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Specialty</TableHead>
                      <TableHead className="text-[10px] text-center">Cases</TableHead>
                      <TableHead className="text-[10px] text-center">Passed</TableHead>
                      <TableHead className="text-[10px] text-center">Top-1</TableHead>
                      <TableHead className="text-[10px] text-center">Top-3</TableHead>
                      <TableHead className="text-[10px] text-center">Danger</TableHead>
                      <TableHead className="text-[10px] text-center">Reasoning Q</TableHead>
                      <TableHead className="text-[10px] text-center">Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suiteResult.by_specialty.sort((a, b) => b.total_cases - a.total_cases).map(s => (
                      <TableRow key={s.specialty}>
                        <TableCell className="text-[10px] font-medium capitalize">{s.specialty.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-[10px] text-center">{s.total_cases}</TableCell>
                        <TableCell className="text-[10px] text-center">{s.passed}/{s.total_cases}</TableCell>
                        <TableCell className="text-center"><Badge className={`${metricBadge(s.top1_accuracy * 100, 45, 25)} text-[9px]`}>{pct(s.top1_accuracy)}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={`${metricBadge(s.top3_accuracy * 100, 70, 50)} text-[9px]`}>{pct(s.top3_accuracy)}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={`${metricBadge(s.danger_detection_rate * 100, 95, 80)} text-[9px]`}>{pct(s.danger_detection_rate)}</Badge></TableCell>
                        <TableCell className="text-center"><Badge className={`${metricBadge(s.avg_reasoning_quality * 100, 70, 50)} text-[9px]`}>{pct(s.avg_reasoning_quality)}</Badge></TableCell>
                        <TableCell className="text-center"><span className={`text-[10px] font-mono ${latencyColor(s.avg_latency_ms)}`}>{ms(s.avg_latency_ms)}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {suiteResult.recommendations.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <ul className="space-y-1">
                    {suiteResult.recommendations.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>{r}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Cognitive Controller ── */}
          <TabsContent value="cognitive" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Avg Reasoning Quality"
                value={pct(suiteResult.cognitive.avg_reasoning_quality)}
                icon={<Brain className="h-4 w-4" />}
                good={suiteResult.cognitive.avg_reasoning_quality >= 0.60}
                target="≥60%"
              />
              <MetricCard
                label="Hypothesis Prune Rate"
                value={pct(suiteResult.cognitive.avg_hypothesis_prune_rate)}
                icon={<Scissors className="h-4 w-4" />}
                good={suiteResult.cognitive.avg_hypothesis_prune_rate > 0}
              />
              <MetricCard
                label="Evidence Match Rate"
                value={pct(suiteResult.cognitive.avg_evidence_match_rate)}
                icon={<Target className="h-4 w-4" />}
                good={suiteResult.cognitive.avg_evidence_match_rate >= 0.40}
                target="≥40%"
              />
              <MetricCard
                label="Avg Entropy"
                value={suiteResult.cognitive.avg_entropy.toFixed(2)}
                icon={<Activity className="h-4 w-4" />}
                good={suiteResult.cognitive.avg_entropy < 2.5}
                subtitle="Lower = more decisive"
              />
              <MetricCard
                label="Confidence Sufficient"
                value={pct(suiteResult.cognitive.confidence_sufficient_rate)}
                icon={<Gauge className="h-4 w-4" />}
                good={suiteResult.cognitive.confidence_sufficient_rate >= 0.60}
              />
            </div>

            {/* Policy metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard
                label="Ranking Stability"
                value={pct(suiteResult.cognitive.avg_ranking_stability)}
                icon={<Layers className="h-4 w-4" />}
                good={suiteResult.cognitive.avg_ranking_stability >= 0.70}
              />
              <MetricCard
                label="Policy Iterate Rate"
                value={pct(suiteResult.cognitive.policy_iterate_rate)}
                icon={<Repeat className="h-4 w-4" />}
                good={suiteResult.cognitive.policy_iterate_rate <= 0.40}
                subtitle="Should be moderate"
              />
              <MetricCard
                label="Policy Escalate Rate"
                value={pct(suiteResult.cognitive.policy_escalate_rate)}
                icon={<ArrowUpRight className="h-4 w-4" />}
                good={suiteResult.cognitive.policy_escalate_rate <= 0.30}
              />
            </div>

            {/* Cognitive by category */}
            <Card>
              <CardHeader className="py-2 px-4"><CardTitle className="text-xs">Cognitive Performance by Reasoning Category</CardTitle></CardHeader>
              <CardContent className="px-4 pb-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Category</TableHead>
                      <TableHead className="text-[10px] text-center">Cases</TableHead>
                      <TableHead className="text-[10px] text-center">Avg Quality</TableHead>
                      <TableHead className="text-[10px] text-center">Avg Entropy</TableHead>
                      <TableHead className="text-[10px] text-center">Escalate Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(["straightforward", "ambiguous", "deceptive"] as ReasoningCategory[]).map(cat => {
                      const data = suiteResult.cognitive.by_category[cat];
                      const catInfo = CATEGORY_LABELS[cat];
                      return (
                        <TableRow key={cat}>
                          <TableCell><Badge className={`${catInfo.color} text-[9px]`}>{catInfo.label}</Badge></TableCell>
                          <TableCell className="text-[10px] text-center">{data.cases}</TableCell>
                          <TableCell className="text-center"><Badge className={`${metricBadge(data.avg_quality * 100, 60, 40)} text-[9px]`}>{pct(data.avg_quality)}</Badge></TableCell>
                          <TableCell className="text-[10px] text-center font-mono">{data.avg_entropy.toFixed(2)}</TableCell>
                          <TableCell className="text-center"><Badge className={`${metricBadge(100 - data.escalate_rate * 100, 70, 50)} text-[9px]`}>{pct(data.escalate_rate)}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Per-case cognitive detail */}
            <Card>
              <CardHeader className="py-2 px-4"><CardTitle className="text-xs">Per-Case Cognitive Metrics</CardTitle></CardHeader>
              <CardContent className="px-2 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Case</TableHead>
                      <TableHead className="text-[10px] text-center">Quality</TableHead>
                      <TableHead className="text-[10px] text-center">Entropy</TableHead>
                      <TableHead className="text-[10px] text-center">Hypotheses</TableHead>
                      <TableHead className="text-[10px] text-center">Uncertainty</TableHead>
                      <TableHead className="text-[10px] text-center">Strategy</TableHead>
                      <TableHead className="text-[10px] text-center">Iterate?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suiteResult.cases.map(c => (
                      <TableRow key={c.case_id}>
                        <TableCell className="text-[10px] font-medium max-w-[160px] truncate">{c.case_name}</TableCell>
                        <TableCell className="text-center"><Badge className={`${metricBadge(c.cognitive.reasoning_quality.quality_score * 100, 60, 40)} text-[9px]`}>{pct(c.cognitive.reasoning_quality.quality_score)}</Badge></TableCell>
                        <TableCell className="text-[10px] text-center font-mono">{c.cognitive.reasoning_quality.entropy.toFixed(2)}</TableCell>
                        <TableCell className="text-[10px] text-center font-mono">{c.cognitive.hypothesis_management.kept}/{c.cognitive.hypothesis_management.total_evaluated}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[8px]">{c.cognitive.uncertainty.level}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="text-[8px]">{c.cognitive.evidence_strategy.strategy_type}</Badge></TableCell>
                        <TableCell className="text-center">{statusIcon(!c.cognitive.policy.should_iterate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Iterative Reasoning ── */}
          <TabsContent value="reasoning" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <MetricCard
                label="Iteration Utilization"
                value={pct(suiteResult.iteration_utilization_rate)}
                icon={<Repeat className="h-4 w-4" />}
                good={suiteResult.iteration_utilization_rate >= 0.10 && suiteResult.iteration_utilization_rate <= 0.40}
                target="10-40%"
                subtitle={`${suiteResult.cases.filter(c => c.iterative_reasoning.loop_activated).length}/${suiteResult.total_cases} activated`}
              />
              <MetricCard
                label="Confidence Convergence"
                value={`+${suiteResult.avg_confidence_convergence.toFixed(1)}%`}
                icon={<ArrowUpRight className="h-4 w-4" />}
                good={suiteResult.avg_confidence_convergence > 0}
                subtitle="Avg prob. gain"
              />
            </div>

            {/* Cases with iteration 2 */}
            <Card>
              <CardHeader className="py-2 px-4"><CardTitle className="text-xs">Cases with Iteration 2 Activated</CardTitle></CardHeader>
              <CardContent className="px-2 pb-2">
                {suiteResult.cases.filter(c => c.iterative_reasoning.loop_activated).length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No cases triggered iteration 2</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Case</TableHead>
                        <TableHead className="text-[10px] text-center">Category</TableHead>
                        <TableHead className="text-[10px] text-center">Candidates</TableHead>
                        <TableHead className="text-[10px] text-center">Prob. Gain</TableHead>
                        <TableHead className="text-[10px] text-center">Gold Improved</TableHead>
                        <TableHead className="text-[10px] text-center">Dx Stable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suiteResult.cases.filter(c => c.iterative_reasoning.loop_activated).map(c => (
                        <TableRow key={c.case_id}>
                          <TableCell className="text-[10px] font-medium max-w-[180px] truncate">{c.case_name}</TableCell>
                          <TableCell className="text-center"><Badge className={`${CATEGORY_LABELS[c.reasoning_category].color} text-[8px]`}>{c.reasoning_category}</Badge></TableCell>
                          <TableCell className="text-[10px] text-center font-mono">{c.iterative_reasoning.initial_candidate_count}→{c.iterative_reasoning.final_candidate_count}</TableCell>
                          <TableCell className="text-[10px] text-center font-mono">+{c.iterative_reasoning.confidence_convergence.toFixed(1)}%</TableCell>
                          <TableCell className="text-center">{statusIcon(c.iterative_reasoning.gold_rank_improved)}</TableCell>
                          <TableCell className="text-center">{statusIcon(c.iterative_reasoning.diagnosis_stable)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Scenarios ── */}
          <TabsContent value="scenarios" className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] w-6"></TableHead>
                  <TableHead className="text-[10px]">Scenario</TableHead>
                  <TableHead className="text-[10px]">Category</TableHead>
                  <TableHead className="text-[10px] text-center">Pass</TableHead>
                  <TableHead className="text-[10px] text-center">Gold Rank</TableHead>
                  <TableHead className="text-[10px] text-center">Iters</TableHead>
                  <TableHead className="text-[10px] text-center">Quality</TableHead>
                  <TableHead className="text-[10px] text-center">Safety</TableHead>
                  <TableHead className="text-[10px] text-center">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suiteResult.cases.map(c => (
                  <TableRow key={c.case_id} className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedCase(expandedCase === c.case_id ? null : c.case_id)}>
                    <TableCell>{expandedCase === c.case_id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</TableCell>
                    <TableCell className="text-[10px] font-medium max-w-[200px] truncate">{c.case_name}</TableCell>
                    <TableCell><Badge className={`${CATEGORY_LABELS[c.reasoning_category].color} text-[8px]`}>{c.reasoning_category}</Badge></TableCell>
                    <TableCell className="text-center">{statusIcon(c.passed)}</TableCell>
                    <TableCell className="text-center text-[10px] font-mono">{c.gold_standard_rank || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[9px]"><Repeat className="h-2.5 w-2.5 mr-0.5" />{c.iterative_reasoning.iterations_executed}</Badge>
                    </TableCell>
                    <TableCell className="text-center"><Badge className={`${metricBadge(c.cognitive.reasoning_quality.quality_score * 100, 60, 40)} text-[9px]`}>{pct(c.cognitive.reasoning_quality.quality_score)}</Badge></TableCell>
                    <TableCell className="text-center">
                      {c.safety.safety_alerts > 0
                        ? <Badge variant="outline" className="text-[9px]"><Shield className="h-2.5 w-2.5 mr-0.5" />{c.safety.safety_alerts}</Badge>
                        : <span className="text-[10px] text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-center"><span className={`text-[10px] font-mono ${latencyColor(c.latency.total_ms)}`}>{ms(c.latency.total_ms)}</span></TableCell>
                  </TableRow>
                ))}
                {suiteResult.cases.map(c => expandedCase === c.case_id && (
                  <TableRow key={`${c.case_id}-detail`}>
                    <TableCell colSpan={9} className="bg-muted/20 p-3">
                      <CaseDetailV8 c={c} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── Latency ── */}
          <TabsContent value="latency" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Avg Total" value={ms(suiteResult.latency.avg_total_ms)} icon={<Clock className="h-4 w-4" />} good={suiteResult.latency.avg_total_ms < 2000} target="<2s" />
              <MetricCard label="P50" value={ms(suiteResult.latency.p50_ms)} icon={<Activity className="h-4 w-4" />} good={suiteResult.latency.p50_ms < 2000} />
              <MetricCard label="P95" value={ms(suiteResult.latency.p95_ms)} icon={<Zap className="h-4 w-4" />} good={suiteResult.latency.p95_ms < 5000} target="<5s" />
              <MetricCard label="Under 2s" value={pct(suiteResult.latency.cases_under_2s_pct)} icon={<CheckCircle className="h-4 w-4" />} good={suiteResult.latency.cases_under_2s_pct >= 0.80} subtitle={`${suiteResult.latency.cases_under_2s}/${suiteResult.total_cases}`} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Case Detail V8 ──

function CaseDetailV8({ c }: { c: CaseResultV8 }) {
  const ir = c.iterative_reasoning;
  const cog = c.cognitive;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
      {/* Diagnoses */}
      <div className="space-y-2">
        <p className="font-semibold text-foreground">Diagnoses</p>
        <p className="text-muted-foreground">Gold Rank: <span className="font-mono font-bold">{c.gold_standard_rank || "Not found"}</span></p>
        <p className="text-muted-foreground">Matched: {c.matched_diagnoses.join(", ") || "—"}</p>
        <p className="text-muted-foreground">Actual Top-5: {c.actual_diagnoses.slice(0, 5).join(", ") || "—"}</p>
        {c.failure_reasons.length > 0 && (
          <div className="mt-2">
            <p className="text-destructive font-medium">Failures:</p>
            {c.failure_reasons.map((f, i) => <p key={i} className="text-destructive/80">• {f}</p>)}
          </div>
        )}
      </div>

      {/* Cognitive Controller */}
      <div className="space-y-2">
        <p className="font-semibold text-foreground flex items-center gap-1"><Brain className="h-3 w-3" /> Cognitive Controller</p>
        <p className="text-muted-foreground">Quality: <span className="font-mono">{pct(cog.reasoning_quality.quality_score)}</span> · Entropy: <span className="font-mono">{cog.reasoning_quality.entropy.toFixed(2)}</span></p>
        <p className="text-muted-foreground">Hypotheses: <span className="font-mono">{cog.hypothesis_management.total_evaluated}</span> evaluated, <span className="font-mono">{cog.hypothesis_management.kept}</span> kept, <span className="font-mono">{cog.hypothesis_management.pruned}</span> pruned</p>
        <p className="text-muted-foreground">Evidence: <span className="font-mono">{cog.evidence_strategy.strategy_type}</span> · Match: <span className="font-mono">{pct(cog.evidence_strategy.test_match_rate)}</span></p>
        <p className="text-muted-foreground">Uncertainty: <span className="font-mono">{cog.uncertainty.level}</span> · Top prob: <span className="font-mono">{cog.uncertainty.top_probability.toFixed(1)}%</span></p>
        <p className="text-muted-foreground">Policy: iterate={cog.policy.should_iterate ? "✅" : "❌"} escalate={cog.policy.should_escalate ? "🔴" : "❌"}</p>
        <p className="text-muted-foreground">Issues: <span className="font-mono">{cog.reasoning_quality.issues_detected}</span> ({cog.reasoning_quality.high_severity_issues} high)</p>
      </div>

      {/* Iteration & Safety */}
      <div className="space-y-2">
        <p className="font-semibold text-foreground flex items-center gap-1"><Repeat className="h-3 w-3" /> Iteration</p>
        <p className="text-muted-foreground">Iterations: <span className="font-mono">{ir.iterations_executed}</span></p>
        <p className="text-muted-foreground">Loop: {ir.loop_activated ? "✅ Activated" : "⏭ Skipped"} — {ir.loop_reason}</p>
        <p className="text-muted-foreground">Candidates: <span className="font-mono">{ir.initial_candidate_count}→{ir.final_candidate_count}</span></p>
        <p className="text-muted-foreground">Top Prob: <span className="font-mono">{ir.initial_top_probability.toFixed(1)}%→{ir.final_top_probability.toFixed(1)}%</span></p>
        {ir.snapshots.map((snap, i) => (
          <div key={i} className="bg-muted/40 rounded p-2 mt-1">
            <p className="font-medium text-[10px]">Iteration {snap.iteration}</p>
            <p className="text-muted-foreground text-[10px]">Top: {snap.top_diagnoses[0]?.name || "—"} ({snap.top_diagnoses[0]?.probability?.toFixed(1) || 0}%)</p>
            <p className="text-muted-foreground text-[10px]">Gold rank: {snap.gold_standard_rank || "—"} · Candidates: {snap.candidate_count}</p>
          </div>
        ))}

        <p className="font-semibold text-foreground mt-3">Safety</p>
        <p className="text-muted-foreground">
          Danger expected: {c.safety.expected_dangerous ? "🔴 Yes" : "No"} ·
          Detected: {c.safety.dangerous_detected ? "✅" : c.safety.expected_dangerous ? "❌ MISSED" : "—"}
        </p>
        <p className="text-muted-foreground">Alerts: {c.safety.safety_alerts}</p>
        <p className="font-semibold text-foreground mt-3">Latency</p>
        <p className="text-muted-foreground font-mono">{ms(c.latency.total_ms)} total</p>
      </div>
    </div>
  );
}
