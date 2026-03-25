import { useState, useCallback } from "react";
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
  Activity, Shield, ChevronDown, ChevronUp, Zap, Target, ArrowRight,
  GitCompare, Lock, BarChart3, Layers,
} from "lucide-react";
import { runBenchmarkSuite, BENCHMARK_SUITE, comparePhases } from "@/services/benchmark_v9";
import type { BenchmarkResult, BenchmarkSuiteResult, PhaseComparisonReport } from "@/services/benchmark_v9/types";
import type { PipelineMode } from "@/services/benchmark_v9/runner";
import BenchmarkV10Panel from "@/components/BenchmarkV10Panel";
import SEO from "@/components/SEO";

// ── Helpers ──

const pct = (v: number) => `${v}%`;

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
    : <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

const MetricCard = ({
  label, value, icon: Icon, variant = "default", detail,
}: {
  label: string; value: string;
  icon: React.ElementType; variant?: "default" | "success" | "warning" | "danger";
  detail?: string;
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
        {detail && <p className="text-[10px] text-muted-foreground mt-0.5">{detail}</p>}
      </CardContent>
    </Card>
  );
};

function probDisplay(p: number): string {
  return p > 1 ? p.toFixed(1) : (p * 100).toFixed(1);
}

// ── Collapsible Stage Row ──

function StageRow({
  name, ok, latency, expanded, onToggle, children,
}: {
  name: string; ok: boolean; latency: number;
  expanded: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b last:border-b-0">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-xs font-medium hover:bg-muted/50">
        <span className="flex items-center gap-2">
          <StatusIcon ok={ok} />
          {name}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="font-mono">{latency}ms</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// ── Per-Scenario Expanded Trace ──

function ScenarioTrace({ result }: { result: BenchmarkResult }) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const toggle = (s: string) => setExpandedStage(expandedStage === s ? null : s);

  return (
    <div className="space-y-2 mt-2">
      <StageRow name="1. Normalization" ok={result.normalization.normalized_tokens.length > 0} latency={result.stage_latencies.find(s => s.stage === "Input Normalization")?.latency_ms || 0} expanded={expandedStage === "norm"} onToggle={() => toggle("norm")}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {result.normalization.mappings.map((m, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px]">
                <Badge variant="outline" className="text-[9px]">{m.original}</Badge>
                {m.changed && <><ArrowRight className="h-2.5 w-2.5 text-primary" /><Badge className="bg-primary/10 text-primary text-[9px]">{m.canonical}</Badge></>}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Match rate: {(result.normalization.expected_match_rate * 100).toFixed(0)}%</p>
        </div>
      </StageRow>

      <StageRow name="2. Physiology" ok={result.physiology.states_activated.length > 0} latency={result.stage_latencies.find(s => s.stage === "Physiology Inference")?.latency_ms || 0} expanded={expandedStage === "physio"} onToggle={() => toggle("physio")}>
        <div className="space-y-1">
          {result.physiology.states_activated.length > 0
            ? result.physiology.states_activated.slice(0, 6).map((ps, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge className="bg-primary/10 text-primary text-[9px]">{ps.state}</Badge>
                <span className="text-muted-foreground">{ps.system}</span>
                <span className="font-mono text-muted-foreground">{(ps.confidence * 100).toFixed(0)}%</span>
              </div>
            ))
            : <p className="text-xs text-muted-foreground italic">No physiology activated</p>
          }
          <p className="text-[10px] text-muted-foreground">Organ systems: {result.physiology.affected_organ_systems.join(", ") || "—"}</p>
        </div>
      </StageRow>

      <StageRow name="3. DDX Candidates" ok={result.candidate_generation.gold_in_candidates} latency={result.stage_latencies.find(s => s.stage === "Candidate Generation (DDX)")?.latency_ms || 0} expanded={expandedStage === "ddx"} onToggle={() => toggle("ddx")}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1">
            {result.candidate_generation.candidates.slice(0, 10).map((c, i) => (
              <Badge key={i} variant={i === 0 ? "default" : "outline"} className="text-[9px]">
                {c.name} ({probDisplay(c.probability)}%)
                {c.must_not_miss && " ⚠"}
              </Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {result.candidate_generation.candidate_count} candidates ·
            Gold {result.candidate_generation.gold_in_candidates
              ? `at #${result.candidate_generation.gold_candidate_rank}`
              : "NOT FOUND ✗"}
          </p>
        </div>
      </StageRow>

      <StageRow name="4. Bayesian" ok={result.bayesian.ranked_diagnoses.length > 0} latency={result.stage_latencies.find(s => s.stage === "Bayesian Ranking")?.latency_ms || 0} expanded={expandedStage === "bayes"} onToggle={() => toggle("bayes")}>
        <div className="space-y-1">
          {result.bayesian.ranked_diagnoses.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-right font-mono text-muted-foreground">#{i + 1}</span>
              <span className="w-44 truncate">{d.diagnosis}</span>
              <Progress value={d.probability > 1 ? d.probability : d.probability * 100} className="flex-1 h-2" />
              <span className="w-14 text-right font-mono text-muted-foreground">{probDisplay(d.probability)}%</span>
            </div>
          ))}
        </div>
      </StageRow>

      <StageRow name="5. Cognitive Pruning" ok={!result.cognitive_pruning.gold_pruned} latency={result.stage_latencies.find(s => s.stage === "Cognitive Pruning")?.latency_ms || 0} expanded={expandedStage === "cog"} onToggle={() => toggle("cog")}>
        <div className="flex gap-4 text-xs">
          <span>Kept: <span className="font-bold text-emerald-600">{result.cognitive_pruning.kept}</span></span>
          <span>Pruned: <span className="font-bold text-destructive">{result.cognitive_pruning.pruned}</span></span>
          <span>Escalated: <span className="font-bold text-amber-600">{result.cognitive_pruning.escalated}</span></span>
        </div>
      </StageRow>

      <StageRow name="6. Safety" ok={result.safety.correct} latency={0} expanded={expandedStage === "safety"} onToggle={() => toggle("safety")}>
        <div className="space-y-1 text-xs">
          <div className="flex gap-4">
            <span>Expected: {result.safety.expected_danger ? "Yes" : "No"}</span>
            <span>Detected: {result.safety.danger_detected ? "Yes" : "No"}</span>
          </div>
          {result.safety.alert_entries && result.safety.alert_entries.length > 0 && (
            <div className="mt-1 space-y-0.5">
              <p className="font-medium text-primary">Alert Channel:</p>
              {result.safety.alert_entries.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <Badge variant="destructive" className="text-[8px]">{a.severity}</Badge>
                  <span>{a.condition}</span>
                  <Badge variant="outline" className="text-[8px]">{a.source}</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="text-muted-foreground">{result.safety.detection_details}</div>
          {result.safety.dangerous_diagnoses.length > 0 && <div>Flagged: {result.safety.dangerous_diagnoses.join(", ")}</div>}
        </div>
      </StageRow>

      <StageRow name="7. Final Ranking" ok={result.final_ranking.top3_match} latency={0} expanded={expandedStage === "final"} onToggle={() => toggle("final")}>
        <div className="space-y-1">
          {result.final_ranking.ranking.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-6 text-right text-muted-foreground">#{d.rank}</span>
              <span className={d.rank === result.final_ranking.gold_rank ? "font-bold text-emerald-600" : ""}>{d.diagnosis}</span>
              <span className="text-muted-foreground">({probDisplay(d.probability)}%)</span>
              <Badge variant="outline" className="text-[8px] px-1">{d.ranking_source}</Badge>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-1">
            Gold: {result.final_ranking.gold_rank ? `#${result.final_ranking.gold_rank}` : "Not in top 10"} ·
            Top-1: {result.final_ranking.top1_match ? "✓" : "✗"} ·
            Top-3: {result.final_ranking.top3_match ? "✓" : "✗"} ·
            Top-5: {result.final_ranking.top5_match ? "✓" : "✗"}
          </p>
        </div>
      </StageRow>

      {result.failure_reasons.length > 0 && (
        <div className="px-3 py-2 bg-destructive/5 rounded text-xs">
          <p className="font-medium text-destructive mb-1">Failures</p>
          {result.failure_reasons.map((f, i) => <p key={i} className="text-muted-foreground">• {f}</p>)}
        </div>
      )}
    </div>
  );
}

// ── Comparison Table ──

function ComparisonPanel({ report }: { report: PhaseComparisonReport }) {
  const d = report.deltas;
  const deltaColor = (v: number) => v > 0 ? "text-emerald-600" : v < 0 ? "text-destructive" : "text-muted-foreground";
  const deltaSign = (v: number) => v > 0 ? `+${v}` : `${v}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant={report.verdict === "READY" ? "default" : "destructive"} className="text-xs">
          {report.verdict}
        </Badge>
        {report.verdict_reasons.map((r, i) => (
          <span key={i} className="text-[10px] text-muted-foreground">• {r}</span>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Metric</TableHead>
            <TableHead className="text-xs text-right">Phase 8</TableHead>
            <TableHead className="text-xs text-right">Phase 9</TableHead>
            <TableHead className="text-xs text-right">Delta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            ["Top-1 Accuracy", report.phase8_metrics.top1_accuracy, report.phase9_metrics.top1_accuracy, d.top1_delta],
            ["Top-3 Accuracy", report.phase8_metrics.top3_accuracy, report.phase9_metrics.top3_accuracy, d.top3_delta],
            ["Top-5 Accuracy", report.phase8_metrics.top5_accuracy, report.phase9_metrics.top5_accuracy, d.top5_delta],
            ["Candidate Recall", report.phase8_metrics.candidate_recall, report.phase9_metrics.candidate_recall, d.recall_delta],
            ["Safety Sensitivity", report.phase8_metrics.safety_sensitivity, report.phase9_metrics.safety_sensitivity, d.safety_sensitivity_delta],
            ["Safety Specificity", report.phase8_metrics.safety_specificity, report.phase9_metrics.safety_specificity, d.safety_specificity_delta],
          ].map(([label, p8, p9, delta]) => (
            <TableRow key={label as string}>
              <TableCell className="text-xs font-medium">{label as string}</TableCell>
              <TableCell className="text-xs text-right font-mono">{p8}%</TableCell>
              <TableCell className="text-xs text-right font-mono">{p9}%</TableCell>
              <TableCell className={`text-xs text-right font-mono font-bold ${deltaColor(delta as number)}`}>
                {deltaSign(delta as number)}pp
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Phase 9 Alert Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" /> Phase 9 Alert Channel Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{report.phase9_metrics.alert_precision}%</p>
              <p className="text-[10px] text-muted-foreground">Alert Precision</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{report.phase9_metrics.alert_recall}%</p>
              <p className="text-[10px] text-muted-foreground">Alert Recall</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{report.phase9_metrics.alert_to_ranking_overlap}%</p>
              <p className="text-[10px] text-muted-foreground">Alert↔Ranking Overlap</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{report.phase9_metrics.safety_detection_rate}%</p>
              <p className="text-[10px] text-muted-foreground">Combined Detection</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-scenario diffs */}
      {report.regressions.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-destructive flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Regressions ({report.regressions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.regressions.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
                <span className="font-medium">{r.scenario_name}</span>
                <span className="text-destructive">{r.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report.improvements.length > 0 && (
        <Card className="border-emerald-300/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Improvements ({report.improvements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.improvements.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
                <span className="font-medium">{r.scenario_name}</span>
                <span className="text-emerald-600">{r.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Main Dashboard ──

export default function GPBenchmarkDashboard() {
  const [suiteResult, setSuiteResult] = useState<BenchmarkSuiteResult | null>(null);
  const [baseline, setBaseline] = useState<BenchmarkSuiteResult | null>(null);
  const [comparison, setComparison] = useState<PhaseComparisonReport | null>(null);
  const [running, setRunning] = useState(false);
  const [runMode, setRunMode] = useState<"phase9" | "phase8" | "compare">("phase9");
  const [progress, setProgress] = useState<string>("");
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const runBenchmark = useCallback(async (mode: PipelineMode) => {
    setRunning(true);
    setSuiteResult(null);
    setComparison(null);
    setExpandedScenario(null);
    setRunMode(mode);
    try {
      const result = await runBenchmarkSuite((name, idx, total) => {
        setProgress(`[${mode.toUpperCase()}] ${idx + 1}/${total}: ${name}`);
      }, mode);
      setSuiteResult(result);
      if (mode === "phase8") setBaseline(result);
    } finally {
      setRunning(false);
      setProgress("");
    }
  }, []);

  const runComparison = useCallback(async () => {
    setRunning(true);
    setSuiteResult(null);
    setComparison(null);
    setExpandedScenario(null);
    setRunMode("compare");
    try {
      // Phase 8 baseline
      setProgress("[PHASE 8 BASELINE] Starting...");
      const p8 = await runBenchmarkSuite((name, idx, total) => {
        setProgress(`[PHASE 8] ${idx + 1}/${total}: ${name}`);
      }, "phase8");
      setBaseline(p8);

      // Phase 9 experimental
      setProgress("[PHASE 9] Starting...");
      const p9 = await runBenchmarkSuite((name, idx, total) => {
        setProgress(`[PHASE 9] ${idx + 1}/${total}: ${name}`);
      }, "phase9");
      setSuiteResult(p9);

      // Compare
      const report = comparePhases(p8, p9);
      setComparison(report);
    } finally {
      setRunning(false);
      setProgress("");
    }
  }, []);

  const sr = suiteResult;

  return (
    <div className="space-y-6">
      <SEO title="Clinical Reasoning Benchmark" description="Multi-layer diagnostic engine validation" />

      <Tabs defaultValue="v10" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="v10" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Benchmark v10 (Multi-Layer)
          </TabsTrigger>
          <TabsTrigger value="v9" className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Benchmark v9 (Control)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="v10">
          <BenchmarkV10Panel />
        </TabsContent>

        <TabsContent value="v9">
          {/* V9 Control Suite (original 30 scenarios) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Benchmark v9 — Control Suite</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  30 controlled scenarios · Dual-mode Phase 8/9 evaluation
                </p>
              </div>
              <div className="flex items-center gap-2">
                {baseline && (
                  <Badge variant="outline" className="text-[9px] flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" /> Baseline locked
                  </Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => runBenchmark("phase8")} disabled={running}>
                  <Shield className="h-3.5 w-3.5 mr-1" /> Phase 8
                </Button>
                <Button size="sm" variant="outline" onClick={() => runBenchmark("phase9")} disabled={running}>
                  <Brain className="h-3.5 w-3.5 mr-1" /> Phase 9
                </Button>
                <Button size="sm" onClick={runComparison} disabled={running}>
                  {running
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{progress || "Running..."}</>
                    : <><GitCompare className="h-3.5 w-3.5 mr-1" /> Compare P8 vs P9</>
                  }
                </Button>
              </div>
            </div>

            {/* Comparison Report */}
            {comparison && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-primary" /> Phase 8 vs Phase 9 Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ComparisonPanel report={comparison} />
                </CardContent>
              </Card>
            )}

            {/* Scenario List (pre-run) */}
            {!sr && !running && !comparison && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-primary" /> Benchmark Suite — 30 Scenarios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Scenario</TableHead>
                      <TableHead className="text-xs">Organ System</TableHead>
                      <TableHead className="text-xs">Danger</TableHead>
                      <TableHead className="text-xs">Symptoms</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {BENCHMARK_SUITE.map((sc, i) => (
                        <TableRow key={sc.id}>
                          <TableCell className="text-xs font-mono">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{sc.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{sc.ground_truth.expected_organ_systems.join(", ")}</TableCell>
                          <TableCell>{sc.ground_truth.danger_flag ? <Badge variant="destructive" className="text-[9px]">Yes</Badge> : <Badge variant="outline" className="text-[9px]">No</Badge>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{sc.context.symptoms.length} symptoms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 text-center">
                    <Button size="sm" onClick={runComparison}><GitCompare className="h-3.5 w-3.5 mr-1" /> Run Full Comparison</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Running indicator */}
            {running && (
              <Card>
                <CardContent className="py-10 text-center">
                  <Loader2 className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
                  <p className="text-sm font-medium">{progress || "Initializing..."}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {runMode === "compare" ? "Running Phase 8 → Phase 9 → Comparison" : `Running 30 scenarios (${runMode})`}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {sr && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[9px]">{sr.pipeline_mode.toUpperCase()}</Badge>
                  <span className="text-xs text-muted-foreground">{sr.timestamp}</span>
                </div>

                {/* Aggregate Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <MetricCard label="Top-1 Accuracy" value={pct(sr.top1_accuracy)} icon={Target}
                    variant={sr.top1_accuracy >= 60 ? "success" : sr.top1_accuracy >= 40 ? "warning" : "danger"}
                    detail="Target: ≥60%" />
                  <MetricCard label="Top-3 Accuracy" value={pct(sr.top3_accuracy)} icon={Target}
                    variant={sr.top3_accuracy >= 80 ? "success" : sr.top3_accuracy >= 60 ? "warning" : "danger"}
                    detail="Target: ≥80%" />
                  <MetricCard label="Candidate Recall" value={pct(sr.candidate_recall)} icon={Brain}
                    variant={sr.candidate_recall >= 90 ? "success" : sr.candidate_recall >= 70 ? "warning" : "danger"}
                    detail="Target: ≥90%" />
                  <MetricCard label="Safety Sensitivity" value={pct(sr.safety_sensitivity)} icon={Shield}
                    variant={sr.safety_sensitivity >= 85 ? "success" : sr.safety_sensitivity >= 70 ? "warning" : "danger"}
                    detail={`Specificity: ${sr.safety_specificity}%`} />
                  <MetricCard label="Avg Latency" value={`${(sr.avg_latency_ms / 1000).toFixed(1)}s`} icon={Clock}
                    variant={sr.avg_latency_ms <= 5000 ? "success" : "warning"}
                    detail={`Min: ${(sr.min_latency_ms / 1000).toFixed(1)}s · Max: ${(sr.max_latency_ms / 1000).toFixed(1)}s`} />
                </div>

                {/* Pass/Fail + Alert metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard label="Passed" value={`${sr.passed}/${sr.total_scenarios}`} icon={CheckCircle}
                    variant={sr.passed === sr.total_scenarios ? "success" : "warning"} />
                  <MetricCard label="Failed" value={`${sr.failed}`} icon={XCircle}
                    variant={sr.failed === 0 ? "success" : "danger"} />
                  <MetricCard label="Alert Precision" value={pct(sr.alert_precision)} icon={Shield}
                    variant={sr.alert_precision >= 70 ? "success" : "warning"}
                    detail={`Recall: ${sr.alert_recall}%`} />
                  <MetricCard label="Top-5 Accuracy" value={pct(sr.top5_accuracy)} icon={Activity}
                    variant={sr.top5_accuracy >= 85 ? "success" : "warning"} detail="Target: ≥85%" />
                </div>

                {/* Per-Scenario Results */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Per-Scenario Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    {sr.results.map((r) => {
                      const isExpanded = expandedScenario === r.scenario_id;
                      return (
                        <div key={r.scenario_id} className={`border-b last:border-b-0 ${r.passed ? "" : "bg-destructive/5"}`}>
                          <button
                            onClick={() => setExpandedScenario(isExpanded ? null : r.scenario_id)}
                            className="w-full flex items-center justify-between p-3 text-xs font-medium hover:bg-muted/50"
                          >
                            <span className="flex items-center gap-2">
                              <StatusIcon ok={r.passed} />
                              <span className="font-medium">{r.scenario_name}</span>
                              {r.final_ranking.gold_rank && (
                                <Badge variant="outline" className="text-[9px]">Gold #{r.final_ranking.gold_rank}</Badge>
                              )}
                              {!r.metrics.candidate_recall && (
                                <Badge variant="destructive" className="text-[9px]">No Recall</Badge>
                              )}
                              {(r.safety.alert_entries?.length ?? 0) > 0 && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[9px]">
                                  {r.safety.alert_entries!.length} alerts
                                </Badge>
                              )}
                            </span>
                            <span className="flex items-center gap-3 text-muted-foreground">
                              <span className="flex gap-1">
                                <span title="Top-1">{r.metrics.top1_accuracy ? "🎯" : "·"}</span>
                                <span title="Top-3">{r.metrics.top3_accuracy ? "✓" : "·"}</span>
                                <span title="Safety">{r.metrics.safety_correct ? "🛡" : "⚠"}</span>
                              </span>
                              <span className="font-mono w-14 text-right">{(r.metrics.total_latency_ms / 1000).toFixed(1)}s</span>
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3">
                              <div className="flex flex-wrap gap-1 mb-2">
                                {BENCHMARK_SUITE.find(s => s.id === r.scenario_id)?.context.symptoms.map((s, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
                                ))}
                              </div>
                              <ScenarioTrace result={r} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Failure Summary */}
                {sr.failure_summary.length > 0 && (
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-600" /> Failure Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {sr.failure_summary.map((f, i) => (
                        <div key={i}>
                          <p className="text-xs font-medium text-destructive">{f.scenario}</p>
                          {f.reasons.map((r, j) => <p key={j} className="text-xs text-muted-foreground ml-3">• {r}</p>)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Latency Distribution */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-primary" /> Latency Distribution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {sr.results.map((r) => (
                        <div key={r.scenario_id} className="flex items-center gap-2 text-xs">
                          <span className="w-48 truncate">{r.scenario_name}</span>
                          <Progress
                            value={Math.min(100, (r.metrics.total_latency_ms / Math.max(1, sr.max_latency_ms)) * 100)}
                            className="flex-1 h-2"
                          />
                          <span className={`w-14 text-right font-mono ${r.metrics.total_latency_ms <= 5000 ? "text-emerald-600" : "text-amber-600"}`}>
                            {(r.metrics.total_latency_ms / 1000).toFixed(1)}s
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
