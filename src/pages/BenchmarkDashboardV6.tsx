import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  Clock, Target, Shield, Activity, Brain, Beaker,
  TrendingUp, BarChart3, Zap, Filter, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  runBenchmarkV6Batched, BENCHMARK_CASES_V6, getCaseDistribution, getDifficultyDistribution,
  loadPersistedV6Results, getCompletedCaseCount,
} from "@/services/benchmark_v6";
import type { BatchProgress } from "@/services/benchmark_v6";
import type {
  BenchmarkSuiteResultV6, CaseResultV6, Specialty,
} from "@/services/benchmark_v6/types";

// ── Formatters ──

function pct(v: number) { return `${Math.round(v * 100)}%`; }
function ms(v: number) { return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`; }

function metricBadge(value: number, good: number, warn: number) {
  const color = value >= good
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
    : value >= warn
    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
    : "bg-destructive/10 text-destructive";
  return <Badge className={`${color} text-[9px] font-mono`}>{pct(value)}</Badge>;
}

function latBadge(v: number) {
  const color = v < 5000
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
    : v < 10000
    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
    : "bg-destructive/10 text-destructive";
  return <Badge className={`${color} text-[9px] font-mono`}>{ms(v)}</Badge>;
}

// ── Main Component ──

export default function BenchmarkDashboardV6() {
  const [result, setResult] = useState<BenchmarkSuiteResultV6 | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "", status: "" });
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const distribution = getCaseDistribution();
  const diffDist = getDifficultyDistribution();

  const handleRun = async (filter?: string, startFrom = 0) => {
    setRunning(true);
    if (startFrom === 0) setResult(null);
    const ac = new AbortController();
    setAbortController(ac);
    try {
      const caseFilter = filter && filter !== "all"
        ? (c: any) => c.specialty === filter
        : undefined;
      const res = await runBenchmarkV6Batched(
        (p: BatchProgress) => setProgress({ current: p.caseIndex + 1, total: p.totalCases, name: p.caseName, status: p.status }),
        undefined,
        caseFilter,
        { batchSize: 5, delayBetweenBatchesMs: 3000, delayBetweenCasesMs: 500, startFromCase: startFrom, persistResults: true },
        ac.signal,
      );
      setResult(res);
    } catch (e) {
      console.error("[BenchmarkV6] Suite failed:", e);
    } finally {
      setRunning(false);
      setAbortController(null);
    }
  };

  const handleStop = () => { abortController?.abort(); };

  const handleLoadLast = async () => {
    const res = await loadPersistedV6Results();
    if (res) setResult(res);
  };

  const handleResume = async () => {
    const { count } = await getCompletedCaseCount();
    handleRun(specialtyFilter, count);
  };

  const filteredCases = result?.cases?.filter(c =>
    specialtyFilter === "all" || c.specialty === specialtyFilter
  ) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Benchmark v6 — Full Clinical Reasoning Suite
          </h2>
          <p className="text-xs text-muted-foreground">
            {BENCHMARK_CASES_V6.length} cases · 12 specialties · Diagnostic accuracy, safety, reasoning convergence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="All specialties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {Object.entries(distribution).map(([s, count]) => (
                <SelectItem key={s} value={s}>{s} ({count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => handleRun(specialtyFilter)} disabled={running} size="sm">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
            {running ? `Running ${progress.current}/${progress.total}` : "Run Suite"}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {running && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Case {progress.current} of {progress.total}</span>
              <span className="font-mono truncate ml-4">{progress.name}</span>
            </div>
            <Progress value={(progress.current / Math.max(1, progress.total)) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Pre-run: Dataset overview */}
      {!result && !running && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-foreground">{BENCHMARK_CASES_V6.length}</p>
              <p className="text-[10px] text-muted-foreground">Total Cases</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-foreground">{Object.keys(distribution).length}</p>
              <p className="text-[10px] text-muted-foreground">Specialties</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-foreground">{Object.entries(diffDist).map(([k, v]) => `${v}`).join("/")}</p>
              <p className="text-[10px] text-muted-foreground">C / M / X / R</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-primary">v6</p>
              <p className="text-[10px] text-muted-foreground">Suite Version</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {result && (
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="summary" className="text-xs"><BarChart3 className="h-3 w-3 mr-1" />Summary</TabsTrigger>
            <TabsTrigger value="accuracy" className="text-xs"><Target className="h-3 w-3 mr-1" />Accuracy</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs"><Shield className="h-3 w-3 mr-1" />Safety</TabsTrigger>
            <TabsTrigger value="latency" className="text-xs"><Clock className="h-3 w-3 mr-1" />Latency</TabsTrigger>
            <TabsTrigger value="reasoning" className="text-xs"><Brain className="h-3 w-3 mr-1" />Reasoning</TabsTrigger>
            <TabsTrigger value="failures" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Failures</TabsTrigger>
            <TabsTrigger value="cases" className="text-xs"><Beaker className="h-3 w-3 mr-1" />Cases ({filteredCases.length})</TabsTrigger>
          </TabsList>

          {/* ── Summary ── */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <MetricCard label="Pass Rate" value={pct(result.pass_rate)} icon={<CheckCircle className="h-4 w-4" />} good={result.pass_rate >= 0.7} />
              <MetricCard label="Top-1 Accuracy" value={pct(result.top1_accuracy)} icon={<Target className="h-4 w-4" />} good={result.top1_accuracy >= 0.65} target="≥65%" />
              <MetricCard label="Top-3 Accuracy" value={pct(result.top3_accuracy)} icon={<Target className="h-4 w-4" />} good={result.top3_accuracy >= 0.85} target="≥85%" />
              <MetricCard label="Top-5 Accuracy" value={pct(result.top5_accuracy)} icon={<Target className="h-4 w-4" />} good={result.top5_accuracy >= 0.92} target="≥92%" />
              <MetricCard label="Danger Detection" value={pct(result.danger_detection_rate)} icon={<Shield className="h-4 w-4" />} good={result.danger_detection_rate >= 0.95} target="≥95%" />
              <MetricCard label="Avg Latency" value={ms(result.latency.avg_total_ms)} icon={<Clock className="h-4 w-4" />} good={result.latency.avg_total_ms < 5000} target="<5s" />
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <Card className="border-amber-200 dark:border-amber-800">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Architecture Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <ul className="space-y-1">
                    {result.recommendations.map((r, i) => (
                      <li key={i} className="text-xs text-muted-foreground">{r}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Specialty breakdown */}
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-xs">Specialty Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Specialty</TableHead>
                      <TableHead className="text-[10px] text-center">Cases</TableHead>
                      <TableHead className="text-[10px] text-center">Pass</TableHead>
                      <TableHead className="text-[10px] text-center">Top-1</TableHead>
                      <TableHead className="text-[10px] text-center">Top-3</TableHead>
                      <TableHead className="text-[10px] text-center">Dx Match</TableHead>
                      <TableHead className="text-[10px] text-center">Danger</TableHead>
                      <TableHead className="text-[10px] text-center">Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.by_specialty.map(s => (
                      <TableRow key={s.specialty}>
                        <TableCell className="text-[10px] font-medium capitalize">{s.specialty.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-[10px] text-center">{s.total_cases}</TableCell>
                        <TableCell className="text-[10px] text-center">{s.passed}/{s.total_cases}</TableCell>
                        <TableCell className="text-center">{metricBadge(s.top1_accuracy, 0.65, 0.4)}</TableCell>
                        <TableCell className="text-center">{metricBadge(s.top3_accuracy, 0.85, 0.6)}</TableCell>
                        <TableCell className="text-center">{metricBadge(s.avg_diagnosis_match, 0.7, 0.4)}</TableCell>
                        <TableCell className="text-center">{metricBadge(s.danger_detection_rate, 0.95, 0.8)}</TableCell>
                        <TableCell className="text-center">{latBadge(s.avg_latency_ms)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Accuracy ── */}
          <TabsContent value="accuracy" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard label="Avg Diagnosis Match" value={pct(result.avg_diagnosis_match)} icon={<TrendingUp className="h-4 w-4" />} good={result.avg_diagnosis_match >= 0.7} />
              <MetricCard label="Avg Lab Match" value={pct(result.avg_lab_match)} icon={<Beaker className="h-4 w-4" />} good={result.avg_lab_match >= 0.5} />
              <MetricCard label="Avg Medication Match" value={pct(result.avg_medication_match)} icon={<Activity className="h-4 w-4" />} good={result.avg_medication_match >= 0.5} />
            </div>

            {/* Difficulty breakdown */}
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-xs">Accuracy by Difficulty</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Difficulty</TableHead>
                      <TableHead className="text-[10px] text-center">Cases</TableHead>
                      <TableHead className="text-[10px] text-center">Passed</TableHead>
                      <TableHead className="text-[10px] text-center">Top-1</TableHead>
                      <TableHead className="text-[10px] text-center">Top-3</TableHead>
                      <TableHead className="text-[10px] text-center">Dx Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.by_difficulty.map(d => (
                      <TableRow key={d.difficulty}>
                        <TableCell className="text-[10px] font-medium capitalize">{d.difficulty}</TableCell>
                        <TableCell className="text-[10px] text-center">{d.total_cases}</TableCell>
                        <TableCell className="text-[10px] text-center">{d.passed}/{d.total_cases}</TableCell>
                        <TableCell className="text-center">{metricBadge(d.top1_accuracy, 0.65, 0.4)}</TableCell>
                        <TableCell className="text-center">{metricBadge(d.top3_accuracy, 0.85, 0.6)}</TableCell>
                        <TableCell className="text-center">{metricBadge(d.avg_diagnosis_match, 0.7, 0.4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Safety ── */}
          <TabsContent value="safety" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Danger Detection" value={pct(result.danger_detection_rate)} icon={<Shield className="h-4 w-4" />} good={result.danger_detection_rate >= 0.95} target="≥95%" />
              <MetricCard label="False Negative Rate" value={pct(result.danger_false_negative_rate)} icon={<XCircle className="h-4 w-4" />} good={result.danger_false_negative_rate <= 0.05} />
              <MetricCard label="Safety Activation" value={pct(result.safety_activation_rate)} icon={<Zap className="h-4 w-4" />} good={result.safety_activation_rate > 0} />
              <MetricCard label="Avg Confidence" value={pct(result.avg_confidence_score)} icon={<TrendingUp className="h-4 w-4" />} good={result.avg_confidence_score >= 0.6} />
            </div>

            {/* Critical misses */}
            {result.failure_analysis.critical_misses.length > 0 && (
              <Card className="border-destructive/30">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Critical Safety Misses ({result.failure_analysis.critical_misses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Case</TableHead>
                        <TableHead className="text-[10px]">Expected</TableHead>
                        <TableHead className="text-[10px]">Actual Top-3</TableHead>
                        <TableHead className="text-[10px]">Root Cause</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.failure_analysis.critical_misses.map(m => (
                        <TableRow key={m.case_id}>
                          <TableCell className="text-[10px] font-mono">{m.case_name}</TableCell>
                          <TableCell className="text-[10px] text-destructive">{m.expected}</TableCell>
                          <TableCell className="text-[10px]">{m.actual.join(", ") || "—"}</TableCell>
                          <TableCell className="text-[10px]">
                            <Badge variant="outline" className="text-[8px]">{m.root_cause.replace(/_/g, " ")}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Latency ── */}
          <TabsContent value="latency" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Avg Total" value={ms(result.latency.avg_total_ms)} icon={<Clock className="h-4 w-4" />} good={result.latency.avg_total_ms < 5000} />
              <MetricCard label="P50" value={ms(result.latency.p50_ms)} icon={<Clock className="h-4 w-4" />} good={result.latency.p50_ms < 5000} />
              <MetricCard label="P95" value={ms(result.latency.p95_ms)} icon={<Clock className="h-4 w-4" />} good={result.latency.p95_ms < 5000} target="<5s" />
              <MetricCard label="P99" value={ms(result.latency.p99_ms)} icon={<Clock className="h-4 w-4" />} good={result.latency.p99_ms < 10000} />
            </div>
            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-xs">Avg Latency per Stage</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(result.latency.avg_per_stage).map(([stage, val]) => (
                    <div key={stage} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                      <span className="capitalize text-muted-foreground">{stage.replace(/_/g, " ")}</span>
                      {latBadge(val)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-foreground">{pct(result.latency.cases_under_5s_pct)}</p>
                <p className="text-[10px] text-muted-foreground">Cases under 5s ({result.latency.cases_under_5s}/{result.total_cases})</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reasoning ── */}
          <TabsContent value="reasoning" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Reasoning Completeness" value={pct(result.avg_reasoning_completeness)} icon={<Brain className="h-4 w-4" />} good={result.avg_reasoning_completeness >= 0.7} />
              <MetricCard label="Dx Convergence" value={pct(result.diagnostic_convergence_rate)} icon={<TrendingUp className="h-4 w-4" />} good={result.diagnostic_convergence_rate >= 0.5} />
              <MetricCard label="Hypothesis Pruning" value={pct(result.hypothesis_pruning_rate)} icon={<Activity className="h-4 w-4" />} good={result.hypothesis_pruning_rate > 0} />
              <MetricCard label="Evidence Plan Accuracy" value={pct(result.evidence_plan_accuracy)} icon={<Beaker className="h-4 w-4" />} good={result.evidence_plan_accuracy >= 0.5} />
            </div>

            {/* KG Gaps */}
            {result.knowledge_gaps.length > 0 && (
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs">Knowledge Graph Gaps</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Category</TableHead>
                        <TableHead className="text-[10px]">Gap Type</TableHead>
                        <TableHead className="text-[10px]">Description</TableHead>
                        <TableHead className="text-[10px]">Priority</TableHead>
                        <TableHead className="text-[10px] text-center">Cases</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.knowledge_gaps.map((g, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[10px] capitalize">{g.category}</TableCell>
                          <TableCell className="text-[10px]">{g.gap_type.replace(/_/g, " ")}</TableCell>
                          <TableCell className="text-[10px]">{g.description}</TableCell>
                          <TableCell>
                            <Badge variant={g.priority === "critical" ? "destructive" : "outline"} className="text-[8px]">{g.priority}</Badge>
                          </TableCell>
                          <TableCell className="text-[10px] text-center">{g.affected_cases.length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Failures ── */}
          <TabsContent value="failures" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <MetricCard label="Total Failures" value={String(result.failure_analysis.total_failures)} icon={<XCircle className="h-4 w-4" />} good={result.failure_analysis.total_failures === 0} />
              <MetricCard label="Failure Rate" value={pct(1 - result.pass_rate)} icon={<AlertTriangle className="h-4 w-4" />} good={result.pass_rate >= 0.7} />
            </div>

            <Card>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-xs">Failures by Root Cause</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(result.failure_analysis.by_root_cause)
                    .filter(([, v]) => v > 0)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cause, count]) => (
                      <div key={cause} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                        <span className="text-muted-foreground capitalize">{cause.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-[9px]">{count}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Cases ── */}
          <TabsContent value="cases" className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] w-6"></TableHead>
                  <TableHead className="text-[10px]">Case</TableHead>
                  <TableHead className="text-[10px]">Specialty</TableHead>
                  <TableHead className="text-[10px]">Difficulty</TableHead>
                  <TableHead className="text-[10px] text-center">Top-1</TableHead>
                  <TableHead className="text-[10px] text-center">Top-3</TableHead>
                  <TableHead className="text-[10px] text-center">Dx Match</TableHead>
                  <TableHead className="text-[10px] text-center">Latency</TableHead>
                  <TableHead className="text-[10px] text-center">Pass</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map(c => (
                  <>
                    <TableRow key={c.case_id} className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedCase(expandedCase === c.case_id ? null : c.case_id)}>
                      <TableCell className="text-[10px]">
                        {expandedCase === c.case_id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </TableCell>
                      <TableCell className="text-[10px] font-medium max-w-[180px] truncate">{c.case_name}</TableCell>
                      <TableCell className="text-[10px] capitalize">{c.specialty.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-[10px] capitalize">{c.difficulty}</TableCell>
                      <TableCell className="text-center">{c.top1_match ? <CheckCircle className="h-3 w-3 text-emerald-500 mx-auto" /> : <XCircle className="h-3 w-3 text-destructive mx-auto" />}</TableCell>
                      <TableCell className="text-center">{c.top3_match ? <CheckCircle className="h-3 w-3 text-emerald-500 mx-auto" /> : <XCircle className="h-3 w-3 text-destructive mx-auto" />}</TableCell>
                      <TableCell className="text-center">{metricBadge(c.diagnosis_match_rate, 0.7, 0.4)}</TableCell>
                      <TableCell className="text-center">{latBadge(c.latency.total_ms)}</TableCell>
                      <TableCell className="text-center">{c.passed ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mx-auto" /> : <XCircle className="h-3.5 w-3.5 text-destructive mx-auto" />}</TableCell>
                    </TableRow>
                    {expandedCase === c.case_id && (
                      <TableRow key={`${c.case_id}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/20 p-3">
                          <CaseDetail c={c} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ── Sub-components ──

function MetricCard({ label, value, icon, good, target }: { label: string; value: string; icon: React.ReactNode; good: boolean; target?: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className={good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{icon}</span>
          {target && <span className="text-[8px] text-muted-foreground">Target: {target}</span>}
        </div>
        <p className={`text-xl font-bold ${good ? "text-foreground" : "text-destructive"}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function CaseDetail({ c }: { c: CaseResultV6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Diagnoses</p>
        <p className="text-muted-foreground">Gold rank: {c.gold_standard_rank ?? "Not found"}</p>
        <p className="text-muted-foreground">Matched: {c.matched_diagnoses.join(", ") || "—"}</p>
        <p className="text-muted-foreground">Actual: {c.actual_diagnoses.slice(0, 5).join(", ") || "—"}</p>
        <p className="text-muted-foreground">Labs: {c.actual_labs.slice(0, 5).join(", ") || "—"}</p>
        <p className="text-muted-foreground">Meds: {c.actual_medications.slice(0, 5).join(", ") || "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Reasoning</p>
        <p className="text-muted-foreground">Dx Loop: {c.diagnostic_loop.convergence_status} ({c.diagnostic_loop.iterations_executed} iter)</p>
        <p className="text-muted-foreground">Hypotheses tested: {c.hypothesis.total_tested}, pruning: {pct(c.hypothesis.pruning_rate)}</p>
        <p className="text-muted-foreground">Evidence tests: {c.evidence_plan.tests_recommended.length}, accuracy: {pct(c.evidence_plan.test_selection_accuracy)}</p>
        <p className="text-muted-foreground">Confidence: {c.confidence_label} ({pct(c.confidence_score)})</p>
        <p className="text-muted-foreground">Trace completeness: {pct(c.reasoning_trace_completeness)}</p>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Safety & Failures</p>
        <p className="text-muted-foreground">Danger expected: {c.safety.expected_dangerous ? "Yes" : "No"} · Detected: {c.safety.dangerous_detected ? "Yes" : "No"}</p>
        <p className="text-muted-foreground">Safety score: {pct(c.safety.safety_score)}</p>
        {c.failure_reasons.length > 0 && (
          <div>
            <p className="text-destructive font-medium">Failure reasons:</p>
            {c.failure_reasons.map((f, i) => <p key={i} className="text-destructive/80">• {f}</p>)}
          </div>
        )}
        {c.failure_root_cause && <p className="text-muted-foreground">Root cause: {c.failure_root_cause.replace(/_/g, " ")}</p>}
      </div>
    </div>
  );
}
