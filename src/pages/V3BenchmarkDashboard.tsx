/**
 * V3 Benchmark Dashboard — Demo Mode
 * Production-grade validation with visual metrics for stakeholder demos.
 */
import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SEO from "@/components/SEO";
import {
  runV3BenchmarkSuite,
  V3_BENCH_CASES,
  type V3BenchSuiteResult,
  type V3BenchProgress,
} from "@/services/v3_benchmark";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  FlaskConical, CheckCircle, XCircle, Loader2, Target, TrendingUp,
  Shield, Activity, BarChart3, Download, Zap, AlertTriangle,
} from "lucide-react";

const COLORS = {
  systemic: "hsl(var(--destructive))",
  local: "hsl(var(--primary))",
  ambiguous: "hsl(var(--warning, 45 93% 47%))",
  success: "hsl(142 76% 36%)",
  fail: "hsl(var(--destructive))",
};

const PIE_COLORS = ["#ef4444", "#f59e0b", "#6366f1", "#22c55e", "#8b5cf6"];

export default function V3BenchmarkDashboard() {
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<V3BenchProgress | null>(null);
  const [result, setResult] = useState<V3BenchSuiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await runV3BenchmarkSuite((p) => setProgress(p));
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, []);

  const heroCases = useMemo(() => {
    if (!result) return [];
    return result.results
      .filter((r) => r.top1_match && r.confidence_gap > 0.05)
      .sort((a, b) => b.confidence_gap - a.confidence_gap)
      .slice(0, 5);
  }, [result]);

  const accuracyChartData = useMemo(() => {
    if (!result) return [];
    const m = result.metrics;
    return [
      { name: "Systemic Top-1", value: m.systemic_top1 * 100, fill: COLORS.systemic },
      { name: "Local Top-1", value: m.local_top1 * 100, fill: COLORS.local },
      { name: "Ambiguous Top-3", value: m.ambiguous_top3 * 100, fill: COLORS.ambiguous },
      { name: "Overall Top-1", value: m.top1_accuracy * 100, fill: COLORS.success },
      { name: "Overall Top-3", value: m.top3_recall * 100, fill: "hsl(var(--primary))" },
    ];
  }, [result]);

  const radarData = useMemo(() => {
    if (!result) return [];
    const m = result.metrics;
    return [
      { metric: "Systemic", value: m.systemic_sensitivity * 100 },
      { metric: "Local", value: m.local_sensitivity * 100 },
      { metric: "Ambiguous", value: m.ambiguous_sensitivity * 100 },
      { metric: "Precision", value: m.precision * 100 },
      { metric: "Confidence", value: m.avg_confidence_correct * 100 },
    ];
  }, [result]);

  const failurePieData = useMemo(() => {
    if (!result) return [];
    const fb = result.failure_breakdown;
    return [
      { name: "Missing State", value: fb.missing_state },
      { name: "Weak Discrimination", value: fb.weak_discrimination },
      { name: "Feature Mismatch", value: fb.feature_mismatch },
      { name: "Generic Leakage", value: fb.generic_leakage },
      { name: "Scoring Interference", value: fb.scoring_interference },
    ].filter((d) => d.value > 0);
  }, [result]);

  const confidenceDistribution = useMemo(() => {
    if (!result) return [];
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}%`,
      correct: 0,
      incorrect: 0,
    }));
    for (const r of result.results) {
      if (!r.top3.length) continue;
      const conf = r.top3[0].probability * 100;
      const idx = Math.min(Math.floor(conf / 10), 9);
      if (r.top1_match) buckets[idx].correct++;
      else buckets[idx].incorrect++;
    }
    return buckets;
  }, [result]);

  const handleExport = useCallback(() => {
    if (!result) return;
    const m = result.metrics;
    let md = `# V3 Benchmark Report\n\n`;
    md += `**Date:** ${result.timestamp}\n`;
    md += `**Cases:** ${result.total_cases}\n`;
    md += `**Verdict:** ${result.verdict === "production_ready" ? "✅ Production Ready" : "⚠️ Needs Stabilization"}\n\n`;
    md += `## Metrics\n| Metric | Value |\n|---|---|\n`;
    md += `| Top-1 Accuracy | ${(m.top1_accuracy * 100).toFixed(1)}% |\n`;
    md += `| Top-3 Recall | ${(m.top3_recall * 100).toFixed(1)}% |\n`;
    md += `| Systemic Top-1 | ${(m.systemic_top1 * 100).toFixed(1)}% |\n`;
    md += `| Local Top-1 | ${(m.local_top1 * 100).toFixed(1)}% |\n`;
    md += `| Ambiguous Top-3 | ${(m.ambiguous_top3 * 100).toFixed(1)}% |\n`;
    md += `| Avg Confidence (correct) | ${(m.avg_confidence_correct * 100).toFixed(1)}% |\n`;
    md += `| Fragile Cases | ${m.fragile_count} |\n\n`;
    md += `## Case Results\n| Case | Expected | Top-1 | Match | Confidence |\n|---|---|---|---|---|\n`;
    for (const r of result.results) {
      const top1 = r.top3[0]?.diagnosis || "—";
      const conf = r.top3[0] ? `${(r.top3[0].probability * 100).toFixed(1)}%` : "—";
      md += `| ${r.case_name} | ${r.expected_top1} | ${top1} | ${r.top1_match ? "✅" : "❌"} | ${conf} |\n`;
    }
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `v3-benchmark-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <SEO title="V3 Benchmark Dashboard" description="Production-grade V3 engine validation suite" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            V3 Benchmark Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {V3_BENCH_CASES.length}-case production validation suite • Demo Mode
          </p>
        </div>
        <div className="flex gap-2">
          {result && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          )}
          <Button onClick={handleRun} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
            {running ? "Running…" : "Run Benchmark"}
          </Button>
        </div>
      </div>

      {/* Progress */}
      {running && progress && (
        <Card>
          <CardContent className="py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Running: {progress.case_name}</span>
              <span className="font-medium">{progress.current}/{progress.total}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} />
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" /> {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Verdict Banner */}
          <Card className={result.verdict === "production_ready"
            ? "border-green-500 bg-green-500/5"
            : "border-yellow-500 bg-yellow-500/5"
          }>
            <CardContent className="py-4 flex items-center gap-3">
              {result.verdict === "production_ready" ? (
                <>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <div className="font-semibold text-green-700">Production Ready</div>
                    <div className="text-sm text-muted-foreground">V3 passes all production thresholds</div>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  <div>
                    <div className="font-semibold text-yellow-700">Needs Stabilization</div>
                    <div className="text-sm text-muted-foreground">Some metrics below production thresholds</div>
                  </div>
                </>
              )}
              <div className="ml-auto flex gap-2">
                <Badge variant="outline">{result.total_cases} cases</Badge>
                <Badge variant="outline">{result.timestamp.split("T")[0]}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard label="Top-1 Accuracy" value={`${(result.metrics.top1_accuracy * 100).toFixed(1)}%`} icon={Target} target="≥80%" pass={result.metrics.top1_accuracy >= 0.8} />
            <KPICard label="Top-3 Recall" value={`${(result.metrics.top3_recall * 100).toFixed(1)}%`} icon={TrendingUp} target="≥90%" pass={result.metrics.top3_recall >= 0.9} />
            <KPICard label="Systemic Top-1" value={`${(result.metrics.systemic_top1 * 100).toFixed(1)}%`} icon={Shield} target="≥90%" pass={result.metrics.systemic_top1 >= 0.9} />
            <KPICard label="Local Top-1" value={`${(result.metrics.local_top1 * 100).toFixed(1)}%`} icon={Activity} target="≥75%" pass={result.metrics.local_top1 >= 0.75} />
            <KPICard label="Ambiguous Top-3" value={`${(result.metrics.ambiguous_top3 * 100).toFixed(1)}%`} icon={BarChart3} target="≥80%" pass={result.metrics.ambiguous_top3 >= 0.8} />
            <KPICard label="Avg Confidence" value={`${(result.metrics.avg_confidence_correct * 100).toFixed(1)}%`} icon={Zap} target="" pass={true} />
          </div>

          {/* Charts Tabs */}
          <Tabs defaultValue="accuracy" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
              <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
              <TabsTrigger value="confidence">Confidence</TabsTrigger>
              <TabsTrigger value="failures">Failures</TabsTrigger>
            </TabsList>

            <TabsContent value="accuracy">
              <Card>
                <CardHeader><CardTitle className="text-base">Accuracy by Category</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accuracyChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {accuracyChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sensitivity">
              <Card>
                <CardHeader><CardTitle className="text-base">Sensitivity Radar</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Radar name="V3" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="confidence">
              <Card>
                <CardHeader><CardTitle className="text-base">Confidence Distribution</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={confidenceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="range" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="correct" stackId="a" fill="hsl(142 76% 36%)" name="Correct" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="incorrect" stackId="a" fill="hsl(var(--destructive))" name="Incorrect" radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="failures">
              <Card>
                <CardHeader><CardTitle className="text-base">Failure Breakdown</CardTitle></CardHeader>
                <CardContent className="h-72">
                  {failurePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={failurePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={(e) => `${e.name} (${e.value})`}>
                          {failurePieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <CheckCircle className="h-5 w-5 mr-2 text-green-500" /> No failures detected
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Hero Cases */}
          {heroCases.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Best Demo Cases</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {heroCases.map((h) => (
                    <div key={h.case_id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                      <div>
                        <span className="font-medium text-sm">{h.case_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">→ {h.top3[0]?.diagnosis}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{(h.top3[0]?.probability * 100).toFixed(1)}%</Badge>
                        <Badge variant="default" className="text-xs bg-green-600">✓ Top-1</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stability Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{result.metrics.fragile_count}</div>
                <div className="text-xs text-muted-foreground">Fragile Rankings</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{result.metrics.systemic_flip_count}</div>
                <div className="text-xs text-muted-foreground">Systemic Flips (Local)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{(result.metrics.generic_overuse_rate * 100).toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Generic Overuse Rate</div>
              </CardContent>
            </Card>
          </div>

          {/* Full Results Table */}
          <Card>
            <CardHeader><CardTitle className="text-base">All Case Results</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-2">Case</th>
                    <th className="text-left py-2 px-2">Category</th>
                    <th className="text-left py-2 px-2">Expected</th>
                    <th className="text-left py-2 px-2">Predicted</th>
                    <th className="text-center py-2 px-2">Top-1</th>
                    <th className="text-center py-2 px-2">Top-3</th>
                    <th className="text-right py-2 px-2">Conf</th>
                    <th className="text-right py-2 px-2">Gap</th>
                    <th className="text-right py-2 px-2">ms</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.case_id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-1.5 px-2 font-medium">{r.case_name}</td>
                      <td className="py-1.5 px-2">
                        <Badge variant="outline" className="text-[10px]">
                          {r.category === "strong_systemic" ? "SYS" : r.category === "pure_local" ? "LOC" : "AMB"}
                        </Badge>
                      </td>
                      <td className="py-1.5 px-2">{r.expected_top1}</td>
                      <td className="py-1.5 px-2">{r.top3[0]?.diagnosis || "—"}</td>
                      <td className="py-1.5 px-2 text-center">{r.top1_match ? "✅" : "❌"}</td>
                      <td className="py-1.5 px-2 text-center">{r.top3_match ? "✅" : "❌"}</td>
                      <td className="py-1.5 px-2 text-right">{r.top3[0] ? `${(r.top3[0].probability * 100).toFixed(1)}%` : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{(r.confidence_gap * 100).toFixed(1)}%</td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">{r.latency_ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Pre-run info */}
      {!result && !running && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div className="text-lg font-medium text-foreground">V3 Benchmark Suite</div>
            <div className="text-sm text-muted-foreground max-w-md mx-auto">
              {V3_BENCH_CASES.length} cases: {V3_BENCH_CASES.filter((c) => c.category === "strong_systemic").length} systemic,{" "}
              {V3_BENCH_CASES.filter((c) => c.category === "pure_local").length} local,{" "}
              {V3_BENCH_CASES.filter((c) => c.category === "ambiguous_overlap").length} ambiguous
            </div>
            <Button onClick={handleRun} className="mt-4">
              <Zap className="h-4 w-4 mr-1" /> Run Full Benchmark
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPICard({ label, value, icon: Icon, target, pass }: {
  label: string; value: string; icon: any; target: string; pass: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-4 space-y-1">
        <div className="flex items-center justify-between">
          <Icon className={`h-4 w-4 ${pass ? "text-green-600" : "text-yellow-600"}`} />
          {target && (
            <Badge variant="outline" className={`text-[9px] ${pass ? "border-green-500 text-green-600" : "border-yellow-500 text-yellow-600"}`}>
              {target}
            </Badge>
          )}
        </div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
