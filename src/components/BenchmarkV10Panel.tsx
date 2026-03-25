/**
 * Benchmark v10 Dashboard Panel
 *
 * Multi-layer benchmark execution and comparison UI.
 * Supports Phase 8 / Phase 9 dual-mode runs on 120 v10 cases
 * with per-layer metrics, comparison summaries, and drill-down.
 */

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
  Activity, Shield, ChevronDown, ChevronUp, Zap, Target,
  GitCompare, Lock, BarChart3, Layers, FileText,
} from "lucide-react";
import { runV10Suite, compareV10Runs, compareV10ThreeWay, ALL_NEW_CASES, generateAuditReport } from "@/services/benchmark_v10";
import type {
  SuiteRunResult, SuiteComparison, CaseResult, LayerMetrics, BenchmarkLayer,
} from "@/services/benchmark_v10/types";
import type { V10PipelineMode, V10RunProgress } from "@/services/benchmark_v10/runner";

// ── Helpers ──

const pct = (v: number) => `${v}%`;
const deltaSign = (v: number) => v > 0 ? `+${v}` : `${v}`;
const deltaColor = (v: number) => v > 0 ? "text-emerald-600" : v < 0 ? "text-destructive" : "text-muted-foreground";

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
    : <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

const layerLabels: Record<BenchmarkLayer, string> = {
  control: "Control",
  noisy: "Noisy Real-World",
  ambiguous: "Ambiguous Competition",
  adversarial: "Adversarial Safety",
};

const layerColors: Record<BenchmarkLayer, string> = {
  control: "bg-primary/10 text-primary",
  noisy: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ambiguous: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  adversarial: "bg-destructive/10 text-destructive",
};

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
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Icon className={`h-3.5 w-3.5 ${colors[variant]}`} />
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
        <p className={`text-xl font-bold ${colors[variant]}`}>{value}</p>
        {detail && <p className="text-[9px] text-muted-foreground mt-0.5">{detail}</p>}
      </CardContent>
    </Card>
  );
};

// ── Layer Metrics Card ──

function LayerMetricsCard({ metrics }: { metrics: LayerMetrics }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-2">
          <Badge className={`text-[9px] ${layerColors[metrics.layer]}`}>
            {layerLabels[metrics.layer]}
          </Badge>
          <span className="text-muted-foreground font-normal">{metrics.total_cases} cases</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Top-1", value: metrics.top1_accuracy },
            { label: "Top-3", value: metrics.top3_accuracy },
            { label: "Recall", value: metrics.candidate_recall },
            { label: "Safety", value: metrics.safety_sensitivity },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className={`text-lg font-bold ${value >= 70 ? "text-emerald-600" : value >= 50 ? "text-amber-600" : "text-destructive"}`}>
                {value}%
              </p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center mt-2 pt-2 border-t">
          <div>
            <p className="text-sm font-semibold text-foreground">{metrics.noise_robustness_score}%</p>
            <p className="text-[9px] text-muted-foreground">Noise Robust.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{metrics.ambiguity_resolution_score}%</p>
            <p className="text-[9px] text-muted-foreground">Ambig. Resol.</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{metrics.clinical_acceptability_score}%</p>
            <p className="text-[9px] text-muted-foreground">Clinical Accept.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Comparison Table ──

function V10ComparisonPanel({ comparison }: { comparison: SuiteComparison }) {
  const [showRegressions, setShowRegressions] = useState(true);

  const verdictColors: Record<string, string> = {
    SAFE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    UNSAFE: "bg-destructive/10 text-destructive",
    REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  };

  const metricRows = [
    "top1_accuracy", "top3_accuracy", "top5_accuracy", "candidate_recall",
    "safety_sensitivity", "safety_specificity", "alert_precision", "alert_recall",
    "clinical_acceptability_score", "avg_latency_ms",
  ];

  const metricLabels: Record<string, string> = {
    top1_accuracy: "Top-1 Accuracy",
    top3_accuracy: "Top-3 Accuracy",
    top5_accuracy: "Top-5 Accuracy",
    candidate_recall: "Candidate Recall",
    safety_sensitivity: "Safety Sensitivity",
    safety_specificity: "Safety Specificity",
    alert_precision: "Alert Precision",
    alert_recall: "Alert Recall",
    clinical_acceptability_score: "Clinical Acceptability",
    avg_latency_ms: "Avg Latency (ms)",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={`text-xs ${verdictColors[comparison.verdict]}`}>
          {comparison.verdict}
        </Badge>
        {comparison.verdict_reasons.map((r, i) => (
          <span key={i} className="text-[10px] text-muted-foreground">• {r}</span>
        ))}
      </div>

      {/* Aggregate metric deltas */}
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
          {metricRows.map(key => {
            const p8Val = (comparison.run_a as any)[key] ?? comparison.metric_deltas[key];
            const delta = comparison.metric_deltas[key] ?? 0;
            const p9Val = p8Val != null ? p8Val + delta : delta;
            const isLatency = key === "avg_latency_ms";
            const unit = isLatency ? "ms" : "%";
            const dColor = isLatency ? deltaColor(-delta) : deltaColor(delta);

            return (
              <TableRow key={key}>
                <TableCell className="text-xs font-medium">{metricLabels[key]}</TableCell>
                <TableCell className="text-xs text-right font-mono">—</TableCell>
                <TableCell className="text-xs text-right font-mono">—</TableCell>
                <TableCell className={`text-xs text-right font-mono font-bold ${dColor}`}>
                  {deltaSign(delta)}{isLatency ? "ms" : "pp"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Per-layer deltas */}
      {comparison.per_layer_deltas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> Per-Layer Deltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comparison.per_layer_deltas.map(ld => (
                <div key={ld.layer}>
                  <Badge className={`text-[9px] mb-1 ${layerColors[ld.layer]}`}>
                    {layerLabels[ld.layer]}
                  </Badge>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {["top1_accuracy", "top3_accuracy", "candidate_recall", "safety_sensitivity"].map(m => (
                      <div key={m}>
                        <p className={`text-sm font-bold ${deltaColor(ld.deltas[m] || 0)}`}>
                          {deltaSign(ld.deltas[m] || 0)}pp
                        </p>
                        <p className="text-[8px] text-muted-foreground">{m.replace(/_/g, " ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regressions */}
      {comparison.regressions.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-destructive flex items-center gap-1.5 cursor-pointer"
              onClick={() => setShowRegressions(!showRegressions)}>
              <XCircle className="h-3.5 w-3.5" /> Regressions ({comparison.regressions.length})
              {showRegressions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CardTitle>
          </CardHeader>
          {showRegressions && (
            <CardContent>
              {comparison.regressions.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-destructive text-[10px]">{r.reason}</span>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Improvements */}
      {comparison.improvements.length > 0 && (
        <Card className="border-emerald-300/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Improvements ({comparison.improvements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comparison.improvements.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b last:border-b-0">
                <span className="font-medium">{r.name}</span>
                <span className="text-emerald-600 text-[10px]">{r.reason}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Per-Case Results Table ──

function CaseResultsTable({ results, expandedCase, onToggle }: {
  results: CaseResult[];
  expandedCase: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-0">
      {results.map(r => {
        const isExpanded = expandedCase === r.case_id;
        return (
          <div key={r.case_id} className={`border-b last:border-b-0 ${r.failure_reasons.length > 0 ? "bg-destructive/5" : ""}`}>
            <button
              onClick={() => onToggle(r.case_id)}
              className="w-full flex items-center justify-between p-2.5 text-xs font-medium hover:bg-muted/50"
            >
              <span className="flex items-center gap-2">
                <StatusIcon ok={r.failure_reasons.length === 0 && r.candidate_recall} />
                <Badge className={`text-[8px] px-1 ${layerColors[r.layer]}`}>
                  {r.layer.slice(0, 3).toUpperCase()}
                </Badge>
                <span className="font-medium truncate max-w-[200px]">{r.name}</span>
                {r.gold_rank && (
                  <Badge variant="outline" className="text-[8px]">#{r.gold_rank}</Badge>
                )}
                {!r.candidate_recall && (
                  <Badge variant="destructive" className="text-[8px]">No Recall</Badge>
                )}
                {r.safety_alerts.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-[8px]">
                    {r.safety_alerts.length} alerts
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="flex gap-0.5">
                  <span title="Top-1">{r.top1_match ? "🎯" : "·"}</span>
                  <span title="Top-3">{r.top3_match ? "✓" : "·"}</span>
                  <span title="Safety">{r.safety_correct ? "🛡" : "⚠"}</span>
                </span>
                <span className="font-mono w-12 text-right">{(r.latency_ms / 1000).toFixed(1)}s</span>
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </span>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {/* Top 5 predictions */}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">Top 5 Predictions</p>
                  {r.predicted_top5.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-right font-mono text-muted-foreground">#{i + 1}</span>
                      <span className={i === 0 && r.top1_match ? "font-bold text-emerald-600" : ""}>{p.diagnosis}</span>
                      <Progress value={Math.min(100, p.probability * 100)} className="flex-1 h-1.5" />
                      <span className="w-12 text-right font-mono text-muted-foreground text-[10px]">
                        {(p.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Safety alerts */}
                {r.safety_alerts.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Safety Alerts</p>
                    {r.safety_alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px]">
                        <Badge variant="destructive" className="text-[8px]">{a.severity}</Badge>
                        <span>{a.condition}</span>
                        <Badge variant="outline" className="text-[8px]">{a.source}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Failures */}
                {r.failure_reasons.length > 0 && (
                  <div className="bg-destructive/5 rounded p-2">
                    <p className="text-[10px] font-medium text-destructive mb-0.5">Failures</p>
                    {r.failure_reasons.map((f, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">• {f}</p>
                    ))}
                  </div>
                )}

                {/* Clinical acceptability */}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>CAS: <span className="font-bold text-foreground">{(r.clinical_acceptability * 100).toFixed(0)}%</span></span>
                  <span>Latency: <span className="font-bold text-foreground">{r.latency_ms}ms</span></span>
                  <span>Safety expected: {r.safety_expected ? "Yes" : "No"}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Panel ──

export default function BenchmarkV10Panel() {
  const [suiteResult, setSuiteResult] = useState<SuiteRunResult | null>(null);
  const [phase8Baseline, setPhase8Baseline] = useState<SuiteRunResult | null>(null);
  const [phase9Baseline, setPhase9Baseline] = useState<SuiteRunResult | null>(null);
  const [comparison, setComparison] = useState<SuiteComparison | null>(null);
  const [threeWay, setThreeWay] = useState<{ p8_vs_p9: SuiteComparison; p9_vs_p10: SuiteComparison; p8_vs_p10: SuiteComparison } | null>(null);
  const [running, setRunning] = useState(false);
  const [runMode, setRunMode] = useState<string>("");
  const [progress, setProgress] = useState<V10RunProgress | null>(null);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<string>("all");
  const [comparisonTab, setComparisonTab] = useState<string>("p9_vs_p10");

  const handleProgress = useCallback((p: V10RunProgress) => setProgress(p), []);

  const runSingle = useCallback(async (mode: V10PipelineMode) => {
    setRunning(true);
    setSuiteResult(null);
    setComparison(null);
    setThreeWay(null);
    setRunMode(mode);
    try {
      const result = await runV10Suite(mode, handleProgress, { executionMode: "benchmark", parallelCases: 5 });
      setSuiteResult(result);
      if (mode === "phase8") setPhase8Baseline(result);
      if (mode === "phase9") setPhase9Baseline(result);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [handleProgress]);

  const runComparison = useCallback(async () => {
    setRunning(true);
    setSuiteResult(null);
    setComparison(null);
    setThreeWay(null);
    setRunMode("compare");
    try {
      setRunMode("phase8");
      const p8 = await runV10Suite("phase8", handleProgress, { executionMode: "benchmark", parallelCases: 5 });
      setPhase8Baseline(p8);

      setRunMode("phase9");
      const p9 = await runV10Suite("phase9", handleProgress, { executionMode: "benchmark", parallelCases: 5 });
      setPhase9Baseline(p9);
      setSuiteResult(p9);

      const comp = compareV10Runs(p8, p9);
      setComparison(comp);
      setRunMode("compare");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [handleProgress]);

  const runThreeWayComparison = useCallback(async () => {
    setRunning(true);
    setSuiteResult(null);
    setComparison(null);
    setThreeWay(null);
    setRunMode("3-way");
    try {
      setRunMode("phase8");
      const p8 = await runV10Suite("phase8", handleProgress, { executionMode: "benchmark", parallelCases: 5 });
      setPhase8Baseline(p8);

      setRunMode("phase9");
      const p9 = await runV10Suite("phase9", handleProgress, { executionMode: "benchmark", parallelCases: 5 });
      setPhase9Baseline(p9);

      setRunMode("phase10");
      const p10 = await runV10Suite("phase10", handleProgress, { executionMode: "benchmark", parallelCases: 5 });
      setSuiteResult(p10);

      const tw = compareV10ThreeWay(p8, p9, p10);
      setThreeWay(tw);
      setRunMode("3-way");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, [handleProgress]);

  const audit = generateAuditReport();

  const filteredResults = suiteResult?.results.filter(r =>
    activeLayer === "all" || r.layer === activeLayer
  ) || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Benchmark v10 — Multi-Layer Suite</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ALL_NEW_CASES.length} cases · 3 layers (Noisy · Ambiguous · Adversarial)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase8Baseline && (
            <Badge variant="outline" className="text-[9px] flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> P8 Baseline
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => runSingle("phase8")} disabled={running}>
            <Shield className="h-3.5 w-3.5 mr-1" /> Phase 8
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSingle("phase9")} disabled={running}>
            <Brain className="h-3.5 w-3.5 mr-1" /> Phase 9
          </Button>
          <Button size="sm" variant="outline" onClick={() => runSingle("phase10")} disabled={running}>
            <Zap className="h-3.5 w-3.5 mr-1" /> Phase 10
          </Button>
          <Button size="sm" variant="outline" onClick={runComparison} disabled={running}>
            <GitCompare className="h-3.5 w-3.5 mr-1" /> P8 vs P9
          </Button>
          <Button size="sm" onClick={runThreeWayComparison} disabled={running}>
            {running
              ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  {progress ? `[${runMode.toUpperCase()}] ${progress.index + 1}/${progress.total}` : "Starting..."}
                </>
              : <><GitCompare className="h-3.5 w-3.5 mr-1" /> 3-Way Compare</>
            }
          </Button>
        </div>
      </div>

      {/* Running indicator */}
      {running && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 text-primary mx-auto mb-3 animate-spin" />
            <p className="text-sm font-medium">
              {progress ? `${progress.case_name}` : "Initializing..."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {progress
                ? `[${runMode.toUpperCase()}] Case ${progress.index + 1} of ${progress.total} · Layer: ${layerLabels[progress.layer]}`
                : "Preparing benchmark suite..."
              }
            </p>
            {progress && (
              <Progress
                value={((progress.index + 1) / progress.total) * 100}
                className="mt-3 max-w-md mx-auto h-2"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Comparison Report */}
      {comparison && !threeWay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" /> Phase 8 vs Phase 9 Comparison (v10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <V10ComparisonPanel comparison={comparison} />
          </CardContent>
        </Card>
      )}

      {/* 3-Way Comparison Report */}
      {threeWay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-primary" /> 3-Way Comparison: P8 → P9 → P10 (v10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={comparisonTab} onValueChange={setComparisonTab}>
              <TabsList className="mb-3">
                <TabsTrigger value="p9_vs_p10" className="text-xs">P9 vs P10 (Primary)</TabsTrigger>
                <TabsTrigger value="p8_vs_p9" className="text-xs">P8 vs P9</TabsTrigger>
                <TabsTrigger value="p8_vs_p10" className="text-xs">P8 vs P10</TabsTrigger>
              </TabsList>
              <TabsContent value="p9_vs_p10">
                <V10ComparisonPanel comparison={threeWay.p9_vs_p10} />
              </TabsContent>
              <TabsContent value="p8_vs_p9">
                <V10ComparisonPanel comparison={threeWay.p8_vs_p9} />
              </TabsContent>
              <TabsContent value="p8_vs_p10">
                <V10ComparisonPanel comparison={threeWay.p8_vs_p10} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Audit Summary (pre-run) */}
      {!suiteResult && !running && !comparison && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" /> Dataset Audit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Coverage" value={pct(audit.coverage_score)} icon={Target}
                  variant={audit.coverage_score >= 80 ? "success" : "warning"} />
                <MetricCard label="Ambiguity" value={pct(audit.ambiguity_score)} icon={Brain}
                  variant={audit.ambiguity_score >= 30 ? "success" : "warning"} />
                <MetricCard label="Noise" value={pct(audit.noise_score)} icon={Activity}
                  variant={audit.noise_score >= 30 ? "success" : "warning"} />
                <MetricCard label="Clinical Realism" value={pct(audit.clinical_realism_score)} icon={Shield}
                  variant={audit.clinical_realism_score >= 40 ? "success" : "warning"} />
              </div>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(audit.layer_composition).map(([layer, count]) => (
                  <div key={layer} className="text-center">
                    <Badge className={`text-[9px] ${layerColors[layer as BenchmarkLayer]}`}>
                      {layerLabels[layer as BenchmarkLayer]}
                    </Badge>
                    <p className="text-sm font-bold text-foreground mt-1">{count}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center flex gap-2 justify-center">
                <Button size="sm" variant="outline" onClick={runComparison}>
                  <GitCompare className="h-3.5 w-3.5 mr-1" /> P8 vs P9
                </Button>
                <Button size="sm" onClick={runThreeWayComparison}>
                  <GitCompare className="h-3.5 w-3.5 mr-1" /> Full 3-Way Comparison (P8 · P9 · P10)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {suiteResult && !running && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-[9px]">{suiteResult.pipeline_phase.toUpperCase()}</Badge>
            <span className="text-[10px] text-muted-foreground">{suiteResult.timestamp}</span>
            <span className="text-[10px] text-muted-foreground">· {suiteResult.run_id}</span>
          </div>

          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Top-1 Accuracy" value={pct(suiteResult.aggregate_metrics.top1_accuracy)} icon={Target}
              variant={suiteResult.aggregate_metrics.top1_accuracy >= 50 ? "success" : suiteResult.aggregate_metrics.top1_accuracy >= 30 ? "warning" : "danger"} />
            <MetricCard label="Top-3 Accuracy" value={pct(suiteResult.aggregate_metrics.top3_accuracy)} icon={Target}
              variant={suiteResult.aggregate_metrics.top3_accuracy >= 60 ? "success" : suiteResult.aggregate_metrics.top3_accuracy >= 40 ? "warning" : "danger"} />
            <MetricCard label="Candidate Recall" value={pct(suiteResult.aggregate_metrics.candidate_recall)} icon={Brain}
              variant={suiteResult.aggregate_metrics.candidate_recall >= 70 ? "success" : suiteResult.aggregate_metrics.candidate_recall >= 50 ? "warning" : "danger"} />
            <MetricCard label="Safety Sensitivity" value={pct(suiteResult.aggregate_metrics.safety_sensitivity)} icon={Shield}
              variant={suiteResult.aggregate_metrics.safety_sensitivity >= 80 ? "success" : suiteResult.aggregate_metrics.safety_sensitivity >= 60 ? "warning" : "danger"}
              detail={`Specificity: ${suiteResult.aggregate_metrics.safety_specificity}%`} />
            <MetricCard label="Avg Latency" value={`${(suiteResult.aggregate_metrics.avg_latency_ms / 1000).toFixed(1)}s`} icon={Clock}
              variant={suiteResult.aggregate_metrics.avg_latency_ms <= 5000 ? "success" : "warning"} />
          </div>

          {/* Pass/Fail */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Passed" value={`${suiteResult.passed}/${suiteResult.total_cases}`} icon={CheckCircle}
              variant={suiteResult.passed > suiteResult.total_cases * 0.7 ? "success" : "warning"} />
            <MetricCard label="Failed" value={`${suiteResult.failed}`} icon={XCircle}
              variant={suiteResult.failed === 0 ? "success" : "danger"} />
            <MetricCard label="Alert Precision" value={pct(suiteResult.aggregate_metrics.alert_precision)} icon={Shield}
              variant={suiteResult.aggregate_metrics.alert_precision >= 60 ? "success" : "warning"}
              detail={`Recall: ${suiteResult.aggregate_metrics.alert_recall}%`} />
            <MetricCard label="Clinical Accept." value={pct(suiteResult.aggregate_metrics.clinical_acceptability_score)} icon={Activity}
              variant={suiteResult.aggregate_metrics.clinical_acceptability_score >= 50 ? "success" : "warning"} />
          </div>

          {/* Per-Layer Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {suiteResult.layer_metrics.map(lm => (
              <LayerMetricsCard key={lm.layer} metrics={lm} />
            ))}
          </div>

          {/* Per-Case Results */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Per-Case Results</CardTitle>
                <div className="flex gap-1">
                  {["all", "noisy", "ambiguous", "adversarial"].map(layer => (
                    <Button
                      key={layer}
                      size="sm"
                      variant={activeLayer === layer ? "default" : "outline"}
                      className="text-[9px] h-6 px-2"
                      onClick={() => setActiveLayer(layer)}
                    >
                      {layer === "all" ? "All" : layerLabels[layer as BenchmarkLayer]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <CaseResultsTable
                results={filteredResults}
                expandedCase={expandedCase}
                onToggle={(id) => setExpandedCase(expandedCase === id ? null : id)}
              />
            </CardContent>
          </Card>

          {/* Failure Summary */}
          {suiteResult.failure_summary.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Failure Analysis ({suiteResult.failure_summary.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {suiteResult.failure_summary.slice(0, 30).map((f, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium text-destructive">{f.name} <span className="text-muted-foreground font-normal">({f.case_id})</span></p>
                    {f.reasons.map((r, j) => <p key={j} className="text-[10px] text-muted-foreground ml-3">• {r}</p>)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
