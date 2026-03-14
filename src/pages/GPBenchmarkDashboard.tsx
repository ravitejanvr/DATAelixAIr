import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, Loader2, CheckCircle, XCircle, AlertTriangle, Clock, Brain,
  Activity, Shield, ChevronDown, ChevronUp, BarChart3, Zap, Target,
  FlaskConical, ArrowDown, Search,
} from "lucide-react";
import { runBenchmarkV8, loadPersistedV8Results } from "@/services/benchmark_v8";
import { runPipelineValidation, type ValidationResult, type MultiValidationResult } from "@/services/pipeline_validation/runner";
import type {
  BenchmarkSuiteResultV8, CaseResultV8, BatchProgressV8,
} from "@/services/benchmark_v8/types";
import SEO from "@/components/SEO";

// ── Metric Card ──

const MetricCard = ({
  label, value, target, icon: Icon, variant = "default",
}: {
  label: string; value: string; target?: string;
  icon: React.ElementType; variant?: "default" | "success" | "warning" | "danger";
}) => {
  const colors = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${colors[variant]}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${colors[variant]}`}>{value}</p>
        {target && <p className="text-[10px] text-muted-foreground mt-0.5">Target: {target}</p>}
      </CardContent>
    </Card>
  );
};

// ── Reasoning Trace Viewer ──

function TraceViewer({ result }: { result: CaseResultV8 }) {
  const [open, setOpen] = useState(false);
  const t = result.reasoning_trace;
  if (!t) return null;

  return (
    <div className="border rounded-lg mt-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-3 text-xs font-medium hover:bg-muted/50">
        <span className="flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" />
          Reasoning Trace
          {t.physiology?.physiology_used ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">Physiology Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] text-amber-600">No Physiology</Badge>
          )}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-3 text-xs">
          <div>
            <p className="font-medium text-muted-foreground mb-1">Symptoms Detected</p>
            <div className="flex flex-wrap gap-1">
              {t.symptoms.map((s, i) => <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>)}
            </div>
          </div>
          <div>
            <p className="font-medium text-muted-foreground mb-1">↓ Physiology States Inferred</p>
            {t.physiology.physiology_states_activated.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {t.physiology.physiology_states_activated.map((s, i) => <Badge key={i} className="bg-primary/10 text-primary text-[9px]">{s}</Badge>)}
              </div>
            ) : <p className="text-muted-foreground italic">None activated</p>}
          </div>
          {t.physiology.affected_organ_systems.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">↓ Affected Organ Systems</p>
              <div className="flex flex-wrap gap-1">
                {t.physiology.affected_organ_systems.map((s, i) => <Badge key={i} variant="secondary" className="text-[9px]">{s}</Badge>)}
              </div>
            </div>
          )}
          <div>
            <p className="font-medium text-muted-foreground mb-1">↓ Candidate Diagnoses</p>
            <div className="flex flex-wrap gap-1">
              {t.candidate_diagnoses.slice(0, 8).map((d, i) => <Badge key={i} variant="outline" className="text-[9px]">{d}</Badge>)}
            </div>
          </div>
          {t.bayesian_probabilities.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">↓ Bayesian Probabilities</p>
              <div className="space-y-1">
                {t.bayesian_probabilities.slice(0, 5).map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-40 truncate">{b.diagnosis}</span>
                    <Progress value={b.probability * 100} className="flex-1 h-2" />
                    <span className="w-12 text-right font-mono">{(b.probability * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {t.hypotheses_pruned.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground mb-1">↓ Hypotheses Pruned</p>
              <div className="flex flex-wrap gap-1">
                {t.hypotheses_pruned.map((h, i) => <Badge key={i} variant="destructive" className="text-[9px]">{h}</Badge>)}
              </div>
            </div>
          )}
          <div>
            <p className="font-medium text-muted-foreground mb-1">↓ Final Diagnosis Ranking</p>
            <div className="space-y-0.5">
              {t.final_ranking.map((d, i) => (
                <div key={i} className="flex items-center gap-2 font-mono">
                  <span className="w-5 text-right text-muted-foreground">#{d.rank}</span>
                  <span>{d.diagnosis}</span>
                </div>
              ))}
            </div>
          </div>
          {t.dangerous_diagnoses_detected.length > 0 && (
            <div className="flex items-center gap-1.5 text-destructive font-medium">
              <Shield className="h-3.5 w-3.5" />
              Dangerous: {t.dangerous_diagnoses_detected.join(", ")}
            </div>
          )}
          {t.failure_type && (
            <div className="text-destructive text-[10px] italic">{t.failure_type}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pipeline Validation Panel ──

function ValidationPanel() {
  const [multiResult, setMultiResult] = useState<MultiValidationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const runValidation = useCallback(async () => {
    setRunning(true);
    setMultiResult(null);
    try {
      const r = await runPipelineValidation((stage) => setCurrentStage(stage));
      setMultiResult(r);
    } finally {
      setRunning(false);
      setCurrentStage(null);
    }
  }, []);

  const statusIcon = (s: string) => {
    if (s === "success" || s === "pass") return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
    if (s === "error" || s === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-primary" />
                Pipeline Validation — 3 Controlled Scenarios
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Gastroenteritis · Appendicitis · Pneumonia — Verifies full reasoning flow
              </p>
            </div>
            <Button size="sm" onClick={runValidation} disabled={running}>
              {running ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{currentStage || "Running..."}</> : <><Play className="h-3.5 w-3.5 mr-1" /> Run All Scenarios</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {multiResult && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Passed" value={`${multiResult.summary.passed}/${multiResult.summary.total}`} icon={CheckCircle} variant={multiResult.summary.passed === multiResult.summary.total ? "success" : "warning"} />
            <MetricCard label="Top-1 Accuracy" value={`${Math.round(multiResult.summary.top1_accuracy * 100)}%`} icon={Target} variant={multiResult.summary.top1_accuracy >= 0.66 ? "success" : "warning"} />
            <MetricCard label="Physiology Rate" value={`${Math.round(multiResult.summary.physiology_activation_rate * 100)}%`} icon={Activity} variant={multiResult.summary.physiology_activation_rate >= 0.66 ? "success" : "warning"} />
            <MetricCard label="Avg Latency" value={`${(multiResult.summary.avg_latency_ms / 1000).toFixed(1)}s`} target="<3s" icon={Clock} variant={multiResult.summary.avg_latency_ms < 3000 ? "success" : multiResult.summary.avg_latency_ms < 10000 ? "warning" : "danger"} />
            <MetricCard label="Failed" value={`${multiResult.summary.failed}`} icon={XCircle} variant={multiResult.summary.failed === 0 ? "success" : "danger"} />
          </div>

          {/* Per-Scenario Results */}
          {multiResult.scenarios.map((result) => (
            <Card key={result.scenario_id} className={result.overall_status === "pass" ? "border-emerald-300 dark:border-emerald-700" : result.overall_status === "partial" ? "border-amber-300 dark:border-amber-700" : "border-destructive/50"}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedScenario(expandedScenario === result.scenario_id ? null : result.scenario_id)}>
                <CardTitle className="text-sm flex items-center gap-2">
                  {statusIcon(result.overall_status)}
                  {result.scenario_name}
                  <Badge variant="outline" className="text-[9px] ml-auto">{(result.total_latency_ms / 1000).toFixed(2)}s</Badge>
                  <div className="flex gap-1">
                    {Object.entries(result.criteria).map(([key, val]) => (
                      <div key={key} title={key.replace(/_/g, " ")} className={val ? "text-emerald-600" : "text-destructive"}>
                        {val ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      </div>
                    ))}
                  </div>
                  {expandedScenario === result.scenario_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>

              {expandedScenario === result.scenario_id && (
                <CardContent className="space-y-3">
                  {/* Reasoning Trace */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Symptoms → Physiology</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {result.trace.input_symptoms.map((s, i) => <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>)}
                    </div>
                    {result.trace.physiology_states.length > 0 ? (
                      <div className="space-y-0.5">
                        {result.trace.physiology_states.slice(0, 6).map((ps, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Badge className="bg-primary/10 text-primary text-[9px]">{ps.state}</Badge>
                            <span className="text-muted-foreground">{ps.system}</span>
                            <span className="font-mono text-muted-foreground">{(ps.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic">No physiology activated</p>}
                  </div>

                  <div className="flex items-center gap-1 text-muted-foreground"><ArrowDown className="h-3 w-3" /><span className="text-[10px]">Final Ranking</span></div>

                  <div className="space-y-0.5">
                    {result.trace.final_ranking.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span className="w-6 text-right text-muted-foreground">#{d.rank}</span>
                        <span>{d.diagnosis}</span>
                        {d.probability > 0 && <span className="text-muted-foreground">({(d.probability * 100).toFixed(1)}%)</span>}
                      </div>
                    ))}
                  </div>

                  {result.trace.pruned_diagnoses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Pruned ({result.trace.pruned_diagnoses.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {result.trace.pruned_diagnoses.map((h, i) => <Badge key={i} variant="destructive" className="text-[9px]">{h}</Badge>)}
                      </div>
                    </div>
                  )}

                  {result.trace.dangerous_detected.length > 0 && (
                    <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                      <Shield className="h-3.5 w-3.5" /> Dangerous: {result.trace.dangerous_detected.join(", ")}
                    </div>
                  )}

                  {/* Stage latencies */}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">Stage</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs text-right">Latency</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {result.stages.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{s.stage}</TableCell>
                          <TableCell className="text-center">{statusIcon(s.status)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{s.latency_ms}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {result.knowledge_gaps.length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-amber-600">Knowledge Gaps:</p>
                      {result.knowledge_gaps.map((gap, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px]">{gap.type}</Badge>
                          <span>{gap.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </>
      )}

      {!multiResult && !running && (
        <Card>
          <CardContent className="py-10 text-center">
            <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <h3 className="text-sm font-medium">Pipeline Validation</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Run 3 controlled scenarios (Gastroenteritis, Appendicitis, Pneumonia) through the full reasoning pipeline.
            </p>
            <Button size="sm" className="mt-3" onClick={runValidation}><Play className="h-3.5 w-3.5 mr-1" /> Run All Scenarios</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Dashboard ──

export default function GPBenchmarkDashboard() {
  const [results, setResults] = useState<BenchmarkSuiteResultV8 | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgressV8 | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadPrevious = useCallback(async () => {
    setLoading(true);
    try {
      const r = await loadPersistedV8Results();
      if (r) setResults(r);
    } finally { setLoading(false); }
  }, []);

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    setResults(null);
    abortRef.current = new AbortController();
    try {
      const r = await runBenchmarkV8(
        (p) => setProgress(p),
        { batchSize: 3, delayBetweenBatchesMs: 2000, delayBetweenCasesMs: 500, persistResults: true },
        abortRef.current.signal,
      );
      setResults(r);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, []);

  const stopBenchmark = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const getVariant = (val: number, good: number, warn: number): "success" | "warning" | "danger" => {
    if (val >= good) return "success";
    if (val >= warn) return "warning";
    return "danger";
  };

  return (
    <div className="space-y-6">
      <SEO title="GP Benchmark — Phase 1" description="General Physician pipeline validation benchmark" />

      {/* Top-level tabs: Validation vs Benchmark */}
      <Tabs defaultValue="validation">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Clinical Reasoning Validation</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Pipeline validation & GP benchmark suite</p>
          </div>
          <TabsList>
            <TabsTrigger value="validation"><FlaskConical className="h-3.5 w-3.5 mr-1" /> Pipeline Validation</TabsTrigger>
            <TabsTrigger value="benchmark"><BarChart3 className="h-3.5 w-3.5 mr-1" /> GP Benchmark</TabsTrigger>
          </TabsList>
        </div>

        {/* Pipeline Validation Tab */}
        <TabsContent value="validation">
          <ValidationPanel />
        </TabsContent>

        {/* Benchmark Tab */}
        <TabsContent value="benchmark">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Benchmark V8 — Phase 1 (General Physician)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">10 Primary Care Scenarios · Physiology-Driven Reasoning</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadPrevious} disabled={running || loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Clock className="h-3.5 w-3.5 mr-1" />}
                Load Previous
              </Button>
              {running ? (
                <Button variant="destructive" size="sm" onClick={stopBenchmark}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Stop
                </Button>
              ) : (
                <Button size="sm" onClick={runBenchmark}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Run Benchmark
                </Button>
              )}
            </div>
          </div>

          {/* Progress */}
          {running && progress && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">
                    {progress.status === "running" && <><Loader2 className="h-3 w-3 inline mr-1 animate-spin" /> Running: {progress.caseName}</>}
                    {progress.status === "batch_delay" && "Batch delay..."}
                    {progress.status === "credit_error" && <span className="text-destructive">Credit limit — stopped</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {progress.caseIndex + 1} / {progress.totalCases}
                  </span>
                </div>
                <Progress value={((progress.caseIndex + 1) / progress.totalCases) * 100} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results && (
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Overview</TabsTrigger>
                <TabsTrigger value="scenarios"><Target className="h-3.5 w-3.5 mr-1" /> Scenarios</TabsTrigger>
                <TabsTrigger value="physiology"><Brain className="h-3.5 w-3.5 mr-1" /> Physiology</TabsTrigger>
                <TabsTrigger value="latency"><Zap className="h-3.5 w-3.5 mr-1" /> Latency</TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Top-1 Accuracy" value={`${(results.top1_accuracy * 100).toFixed(0)}%`}
                    target="30–40%" icon={Target}
                    variant={getVariant(results.top1_accuracy, 0.35, 0.2)} />
                  <MetricCard label="Top-3 Accuracy" value={`${(results.top3_accuracy * 100).toFixed(0)}%`}
                    target="65–75%" icon={Target}
                    variant={getVariant(results.top3_accuracy, 0.65, 0.5)} />
                  <MetricCard label="Top-5 Accuracy" value={`${(results.top5_accuracy * 100).toFixed(0)}%`}
                    target="85–95%" icon={Target}
                    variant={getVariant(results.top5_accuracy, 0.85, 0.7)} />
                  <MetricCard label="Danger Detection" value={`${(results.danger_detection_rate * 100).toFixed(0)}%`}
                    target=">90%" icon={Shield}
                    variant={getVariant(results.danger_detection_rate, 0.9, 0.7)} />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Avg Latency" value={`${(results.latency.avg_total_ms / 1000).toFixed(1)}s`}
                    target="<5s" icon={Clock}
                    variant={results.latency.avg_total_ms < 5000 ? "success" : results.latency.avg_total_ms < 10000 ? "warning" : "danger"} />
                  <MetricCard label="Prune Rate" value={`${(results.cognitive.avg_hypothesis_prune_rate * 100).toFixed(0)}%`}
                    target=">20%" icon={Brain}
                    variant={getVariant(results.cognitive.avg_hypothesis_prune_rate, 0.2, 0.1)} />
                  <MetricCard label="Evidence Match" value={`${(results.cognitive.avg_evidence_match_rate * 100).toFixed(0)}%`}
                    icon={Activity} variant="default" />
                  <MetricCard label="Pass Rate" value={`${(results.pass_rate * 100).toFixed(0)}%`}
                    icon={CheckCircle} variant={getVariant(results.pass_rate, 0.7, 0.5)} />
                </div>

                {/* Category Breakdown */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Category</TableHead>
                          <TableHead className="text-xs text-center">Cases</TableHead>
                          <TableHead className="text-xs text-center">Passed</TableHead>
                          <TableHead className="text-xs text-center">Top-1</TableHead>
                          <TableHead className="text-xs text-center">Top-3</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(["straightforward", "ambiguous", "deceptive"] as const).map(cat => {
                          const c = results.by_category[cat];
                          return (
                            <TableRow key={cat}>
                              <TableCell className="text-xs font-medium capitalize">{cat}</TableCell>
                              <TableCell className="text-xs text-center">{c.cases}</TableCell>
                              <TableCell className="text-xs text-center">{c.passed}</TableCell>
                              <TableCell className="text-xs text-center">{c.top1}</TableCell>
                              <TableCell className="text-xs text-center">{c.top3}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {results.recommendations.length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-600" /> Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {results.recommendations.map((r, i) => (
                          <li key={i} className="text-xs text-muted-foreground">{r}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Scenarios */}
              <TabsContent value="scenarios" className="mt-4 space-y-2">
                {results.cases.map((c) => (
                  <Card key={c.case_id} className={c.passed ? "" : "border-destructive/30"}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {c.passed ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                          <div>
                            <p className="text-sm font-medium">{c.case_name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge variant="outline" className="text-[9px] capitalize">{c.reasoning_category}</Badge>
                              <Badge variant="secondary" className="text-[9px]">{c.difficulty}</Badge>
                              {c.safety.expected_dangerous && (
                                c.safety.dangerous_detected
                                  ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]"><Shield className="h-2.5 w-2.5 mr-0.5" /> Danger OK</Badge>
                                  : <Badge className="bg-destructive text-white text-[9px]"><Shield className="h-2.5 w-2.5 mr-0.5" /> Missed!</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="text-right">
                            <p className="font-mono">Rank: {c.gold_standard_rank ?? "—"}</p>
                            <p className="text-muted-foreground">{(c.latency.total_ms / 1000).toFixed(1)}s</p>
                          </div>
                          <div className="flex gap-1">
                            {c.top1_match && <Badge className="bg-emerald-600 text-white text-[9px]">Top-1</Badge>}
                            {!c.top1_match && c.top3_match && <Badge className="bg-amber-500 text-white text-[9px]">Top-3</Badge>}
                            {!c.top3_match && c.top5_match && <Badge variant="outline" className="text-[9px]">Top-5</Badge>}
                            {!c.top5_match && <Badge variant="destructive" className="text-[9px]">Miss</Badge>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">AI Diagnoses: </span>
                        {c.actual_diagnoses.slice(0, 5).join(", ") || "None"}
                      </div>

                      {c.failure_reasons.length > 0 && (
                        <div className="mt-1.5 text-xs text-destructive">
                          {c.failure_reasons.map((f, i) => <p key={i}>• {f}</p>)}
                        </div>
                      )}

                      <TraceViewer result={c} />
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              {/* Physiology */}
              <TabsContent value="physiology" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Physiology Usage" value={`${(results.physiology_activation_stats.physiology_usage_rate * 100).toFixed(0)}%`}
                    target="100%" icon={Brain}
                    variant={getVariant(results.physiology_activation_stats.physiology_usage_rate, 0.8, 0.5)} />
                  <MetricCard label="Cases w/ Physiology" value={`${results.physiology_activation_stats.physiology_used_count}/${results.physiology_activation_stats.total_cases}`}
                    icon={Activity} variant="default" />
                  <MetricCard label="Avg States Activated" value={results.physiology_activation_stats.avg_states_activated.toFixed(1)}
                    icon={Zap} variant="default" />
                  <MetricCard label="Avg Physio Candidates" value={results.physiology_activation_stats.avg_candidates_from_physiology.toFixed(1)}
                    icon={Target} variant="default" />
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Per-Scenario Physiology Detail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Scenario</TableHead>
                          <TableHead className="text-xs text-center">Physiology?</TableHead>
                          <TableHead className="text-xs text-center">States</TableHead>
                          <TableHead className="text-xs text-center">Organ Systems</TableHead>
                          <TableHead className="text-xs text-center">Candidates</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.cases.map(c => (
                          <TableRow key={c.case_id}>
                            <TableCell className="text-xs">{c.case_name}</TableCell>
                            <TableCell className="text-center">
                              {c.reasoning_trace?.physiology?.physiology_used
                                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 inline" />
                                : <XCircle className="h-3.5 w-3.5 text-destructive inline" />}
                            </TableCell>
                            <TableCell className="text-xs text-center">{c.reasoning_trace?.physiology?.physiology_states_activated?.length || 0}</TableCell>
                            <TableCell className="text-xs text-center">{c.reasoning_trace?.physiology?.affected_organ_systems?.join(", ") || "—"}</TableCell>
                            <TableCell className="text-xs text-center">{c.reasoning_trace?.physiology?.candidate_diagnosis_ids?.length || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Latency */}
              <TabsContent value="latency" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Average" value={`${(results.latency.avg_total_ms / 1000).toFixed(1)}s`}
                    target="<5s" icon={Clock}
                    variant={results.latency.avg_total_ms < 5000 ? "success" : "warning"} />
                  <MetricCard label="P50" value={`${(results.latency.p50_ms / 1000).toFixed(1)}s`} icon={Clock} variant="default" />
                  <MetricCard label="P95" value={`${(results.latency.p95_ms / 1000).toFixed(1)}s`} icon={Clock} variant="default" />
                  <MetricCard label="Under 5s" value={`${(results.latency.cases_under_5s_pct * 100).toFixed(0)}%`} icon={Zap}
                    variant={getVariant(results.latency.cases_under_5s_pct, 0.8, 0.5)} />
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Per-Scenario Latency Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Scenario</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">DDX</TableHead>
                          <TableHead className="text-xs text-right">Bayesian</TableHead>
                          <TableHead className="text-xs text-right">Safety</TableHead>
                          <TableHead className="text-xs text-right">SOAP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.cases.map(c => (
                          <TableRow key={c.case_id}>
                            <TableCell className="text-xs">{c.case_name}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{(c.latency.total_ms / 1000).toFixed(1)}s</TableCell>
                            <TableCell className="text-xs text-right font-mono">{c.latency.ddx_ms}ms</TableCell>
                            <TableCell className="text-xs text-right font-mono">{c.latency.bayesian_ms}ms</TableCell>
                            <TableCell className="text-xs text-right font-mono">{c.latency.safety_ms}ms</TableCell>
                            <TableCell className="text-xs text-right font-mono">{c.latency.soap_ms}ms</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Empty state */}
          {!results && !running && (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-medium">No benchmark results</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Run the Phase 1 General Physician benchmark to validate the reasoning pipeline.
                  10 scenarios across primary care, ambiguous differentials, and emergency conditions.
                </p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={loadPrevious}>Load Previous</Button>
                  <Button size="sm" onClick={runBenchmark}><Play className="h-3.5 w-3.5 mr-1" /> Run Benchmark</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
