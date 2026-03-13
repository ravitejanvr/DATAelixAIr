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
  Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  Clock, Target, Shield, Activity, Brain, Beaker,
  TrendingUp, BarChart3, Zap, Database, History,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

interface GraphIntegrity {
  table_counts: Record<string, number>;
  total_diseases: number;
  total_symptoms: number;
  total_relationships: number;
  avg_edges_per_disease: number;
  signal_optimization?: {
    specificity_entries: number;
    organ_system_entries: number;
    high_specificity_symptoms: number;
    low_specificity_symptoms: number;
    avg_specificity: number;
  };
  world_model?: {
    activation_rules: number;
    physiology_map_entries: number;
    physiology_diag_entries: number;
    reasoning_traces_stored: number;
  };
  gaps: string[];
  status: string;
  latency_ms: number;
}

interface ScenarioResult {
  scenario_id: string;
  scenario_name: string;
  expected_organ_system: string;
  passed: boolean;
  diagnosis_match_rate: number;
  matched_diagnoses: string[];
  actual_diagnoses: string[];
  graph_diagnoses: string[];
  graph_labs: string[];
  graph_drugs: string[];
  graph_guidelines: string[];
  bayesian_top: any;
  bayesian_count: number;
  safety_alert_count: number;
  danger_detected: boolean;
  soap_generated: boolean;
  world_model?: {
    organ_systems: string[];
    risk_level: string;
    state_confidence: number;
    hypotheses_count: number;
    top_hypotheses: Array<{ disease: string; confidence: number; organ_system: string; source: string }>;
    dangerous_conditions: string[];
    physiological_states: Array<{ process: string; organ_system: string; confidence: number }>;
    reasoning_traces: Array<{ symptom: string; physiology: string; disease: string; chain: string }>;
  };
  engine_status?: Record<string, boolean>;
  wave_latency?: Record<string, number>;
  total_latency_ms: number;
  pipeline_trace?: Record<string, any>;
}

interface V7Report {
  validation_id: string;
  timestamp: string;
  total_duration_ms: number;
  graph_integrity: GraphIntegrity;
  benchmark: {
    total_scenarios: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_diagnosis_match: number;
    scenarios: ScenarioResult[];
  };
  engine_health: Record<string, { active: number; total: number; rate: number }>;
  latency: {
    avg_total_ms: number;
    avg_wave_latency: Record<string, number>;
    target_ms: number;
    meets_target: boolean;
  };
  recommendations: string[];
}

interface PersistedRun {
  test_case: string;
  passed: boolean;
  diagnosis_agreement: number;
  latency_ms: number;
  confidence_score: number;
  confidence_label: string;
  safety_alerts: number;
  run_group_id: string;
  created_at: string;
  pipeline_output: any;
  expected_output: any;
  lab_agreement: number;
  medication_agreement: number;
  guideline_citations: number;
}

// ── Helpers ──

function pct(v: number) { return `${Math.round(v)}%`; }
function ms(v: number) { return v < 1000 ? `${Math.round(v)}ms` : `${(v / 1000).toFixed(1)}s`; }

function statusIcon(ok: boolean) {
  return ok
    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
    : <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function metricColor(value: number, good: number, warn: number) {
  if (value >= good) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
  if (value >= warn) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400";
  return "bg-destructive/10 text-destructive";
}

function latencyColor(v: number) {
  if (v < 3000) return "text-emerald-600 dark:text-emerald-400";
  if (v < 5000) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

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

export default function BenchmarkDashboardV7() {
  const [report, setReport] = useState<V7Report | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistedRuns, setPersistedRuns] = useState<PersistedRun[] | null>(null);
  const [loadingPersisted, setLoadingPersisted] = useState(false);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Run live benchmark via edge function
  const handleRunBenchmark = useCallback(async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("validate-clinical-system");
      if (err) throw err;
      setReport(data as V7Report);
      setActiveTab("overview");
    } catch (e: any) {
      console.error("[BenchmarkV7] Run failed:", e);
      setError(e.message || "Benchmark run failed");
    } finally {
      setRunning(false);
    }
  }, []);

  // Load persisted results from database
  const handleLoadPersisted = useCallback(async () => {
    setLoadingPersisted(true);
    setError(null);
    try {
      const { data: runs, error: runsErr } = await supabase
        .from("benchmark_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (runsErr) throw runsErr;
      if (!runs || runs.length === 0) {
        setError("No persisted benchmark results found.");
        setLoadingPersisted(false);
        return;
      }
      setPersistedRuns(runs as PersistedRun[]);
      setActiveTab("persisted");
    } catch (e: any) {
      console.error("[BenchmarkV7] Load failed:", e);
      setError(e.message || "Failed to load persisted data");
    } finally {
      setLoadingPersisted(false);
    }
  }, []);

  // Compute persisted summary
  const persistedSummary = persistedRuns ? (() => {
    const total = persistedRuns.length;
    const passed = persistedRuns.filter(r => r.passed).length;
    const avgDx = persistedRuns.reduce((s, r) => s + (r.diagnosis_agreement || 0), 0) / total;
    const avgLatency = persistedRuns.reduce((s, r) => s + (r.latency_ms || 0), 0) / total;
    const avgConf = persistedRuns.reduce((s, r) => s + (r.confidence_score || 0), 0) / total;
    const safetyTriggered = persistedRuns.filter(r => (r.safety_alerts || 0) > 0).length;
    const top3 = persistedRuns.filter(r => (r.diagnosis_agreement || 0) >= 33).length;
    return {
      total, passed, passRate: (passed / total) * 100,
      avgDx, avgLatency, avgConf,
      safetyRate: (safetyTriggered / total) * 100,
      top3Accuracy: (top3 / total) * 100,
      timestamp: persistedRuns[0]?.created_at,
    };
  })() : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Benchmark v7 — Diagnostic Reasoning Suite
          </h2>
          <p className="text-xs text-muted-foreground">
            50 scenarios · 10 specialties · Full pipeline evaluation (PCIE → World Model → DDX → Bayesian → Safety → SOAP)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleLoadPersisted}
            size="sm"
            variant="outline"
            disabled={loadingPersisted}
          >
            {loadingPersisted ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <History className="h-3.5 w-3.5 mr-1" />}
            Load History
          </Button>
          <Button
            onClick={handleRunBenchmark}
            size="sm"
            disabled={running}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
            {running ? "Running…" : "Run Benchmark"}
          </Button>
        </div>
      </div>

      {/* Running indicator */}
      {running && (
        <Card className="border-primary/30">
          <CardContent className="py-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium">Running 50-scenario benchmark suite…</span>
            </div>
            <p className="text-xs text-muted-foreground">
              PCIE → World Model → Graph → DDX → Bayesian → Safety → SOAP
            </p>
            <Progress className="h-1.5" />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* No data state */}
      {!report && !persistedRuns && !running && !error && (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Run a live benchmark or load historical results to view diagnostic performance.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {(report || persistedRuns) && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            {report && (
              <>
                <TabsTrigger value="overview" className="text-xs"><BarChart3 className="h-3 w-3 mr-1" />Overview</TabsTrigger>
                <TabsTrigger value="graph" className="text-xs"><Database className="h-3 w-3 mr-1" />Knowledge Graph</TabsTrigger>
                <TabsTrigger value="scenarios" className="text-xs"><Beaker className="h-3 w-3 mr-1" />Scenarios ({report.benchmark.total_scenarios})</TabsTrigger>
                <TabsTrigger value="latency" className="text-xs"><Clock className="h-3 w-3 mr-1" />Latency</TabsTrigger>
                <TabsTrigger value="engines" className="text-xs"><Activity className="h-3 w-3 mr-1" />Engines</TabsTrigger>
              </>
            )}
            {persistedRuns && (
              <TabsTrigger value="persisted" className="text-xs"><History className="h-3 w-3 mr-1" />History ({persistedRuns.length})</TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview ── */}
          {report && (
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard
                  label="Pass Rate"
                  value={pct(report.benchmark.pass_rate)}
                  icon={<CheckCircle className="h-4 w-4" />}
                  good={report.benchmark.pass_rate >= 70}
                  target="≥70%"
                  subtitle={`${report.benchmark.passed}/${report.benchmark.total_scenarios} passed`}
                />
                <MetricCard
                  label="Avg Dx Match"
                  value={pct(report.benchmark.avg_diagnosis_match)}
                  icon={<Target className="h-4 w-4" />}
                  good={report.benchmark.avg_diagnosis_match >= 60}
                  target="≥60%"
                />
                <MetricCard
                  label="Avg Latency"
                  value={ms(report.latency.avg_total_ms)}
                  icon={<Clock className="h-4 w-4" />}
                  good={report.latency.avg_total_ms < 5000}
                  target="<5s"
                />
                <MetricCard
                  label="Knowledge Graph"
                  value={(report.graph_integrity.total_relationships ?? 0).toLocaleString()}
                  icon={<Database className="h-4 w-4" />}
                  good={(report.graph_integrity.total_relationships ?? 0) >= 5000}
                  subtitle={`${report.graph_integrity.total_diseases ?? 0} dx · ${report.graph_integrity.total_symptoms ?? 0} sx`}
                />
                <MetricCard
                  label="Safety Detection"
                  value={pct(report.engine_health?.safety?.rate ?? 0)}
                  icon={<Shield className="h-4 w-4" />}
                  good={(report.engine_health?.safety?.rate ?? 0) >= 90}
                  target="≥95%"
                />
                <MetricCard
                  label="Total Duration"
                  value={ms(report.total_duration_ms)}
                  icon={<Zap className="h-4 w-4" />}
                  good={report.total_duration_ms < 60000}
                  subtitle={`${ms(report.total_duration_ms / Math.max(1, report.benchmark.total_scenarios))}/scenario`}
                />
              </div>

              {/* Recommendations */}
              {report.recommendations.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <ul className="space-y-1">
                      {report.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <span className="text-amber-500 mt-0.5">•</span>{r}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Specialty distribution */}
              {report.benchmark.scenarios.length > 0 && (
                <Card>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs">Results by Specialty</CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-2">
                    <SpecialtyBreakdownTable scenarios={report.benchmark.scenarios} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ── Knowledge Graph ── */}
          {report && (
            <TabsContent value="graph" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Diseases" value={String(report.graph_integrity.total_diseases ?? 0)} icon={<Database className="h-4 w-4" />} good={true} />
                <MetricCard label="Symptoms" value={String(report.graph_integrity.total_symptoms ?? 0)} icon={<Activity className="h-4 w-4" />} good={true} />
                <MetricCard label="Relationships" value={(report.graph_integrity.total_relationships ?? 0).toLocaleString()} icon={<TrendingUp className="h-4 w-4" />} good={(report.graph_integrity.total_relationships ?? 0) >= 5000} target="≥8,000" />
                <MetricCard label="Avg Edges/Disease" value={(report.graph_integrity.avg_edges_per_disease ?? 0).toFixed(1)} icon={<BarChart3 className="h-4 w-4" />} good={(report.graph_integrity.avg_edges_per_disease ?? 0) >= 12} target="≥12" />
              </div>

              {/* Table counts */}
              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs">Table Counts</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {Object.entries(report.graph_integrity.table_counts || {}).map(([table, count]) => (
                      <div key={table} className="bg-muted/50 rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground truncate">{table}</p>
                        <p className="text-sm font-semibold">{((count as number) ?? 0).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* World Model */}
              {report.graph_integrity.world_model && (
                <Card className="border-primary/30">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs flex items-center gap-1">
                      <Brain className="h-3.5 w-3.5 text-primary" /> World Model
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Activation Rules</p>
                        <p className="text-lg font-bold">{report.graph_integrity.world_model.activation_rules}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Physiology Map</p>
                        <p className="text-lg font-bold">{report.graph_integrity.world_model.physiology_map_entries}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Physiology→Dx Map</p>
                        <p className="text-lg font-bold">{report.graph_integrity.world_model.physiology_diag_entries}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Reasoning Traces</p>
                        <p className="text-lg font-bold">{report.graph_integrity.world_model.reasoning_traces_stored}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Graph gaps */}
              {report.graph_integrity.gaps.length > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Knowledge Gaps ({report.graph_integrity.gaps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <ul className="space-y-0.5">
                      {report.graph_integrity.gaps.map((g, i) => (
                        <li key={i} className="text-xs text-muted-foreground">• {g}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ── Scenarios ── */}
          {report && (
            <TabsContent value="scenarios" className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] w-6"></TableHead>
                    <TableHead className="text-[10px]">Scenario</TableHead>
                    <TableHead className="text-[10px]">Specialty</TableHead>
                    <TableHead className="text-[10px] text-center">Pass</TableHead>
                    <TableHead className="text-[10px] text-center">Dx Match</TableHead>
                    <TableHead className="text-[10px] text-center">Bayesian</TableHead>
                    <TableHead className="text-[10px] text-center">Safety</TableHead>
                    <TableHead className="text-[10px] text-center">SOAP</TableHead>
                    <TableHead className="text-[10px] text-center">Latency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.benchmark.scenarios.map(s => (
                    <>
                      <TableRow
                        key={s.scenario_id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setExpandedScenario(expandedScenario === s.scenario_id ? null : s.scenario_id)}
                      >
                        <TableCell>
                          {expandedScenario === s.scenario_id
                            ? <ChevronUp className="h-3 w-3" />
                            : <ChevronDown className="h-3 w-3" />}
                        </TableCell>
                        <TableCell className="text-[10px] font-medium max-w-[200px] truncate">
                          {s.scenario_name}
                        </TableCell>
                        <TableCell className="text-[10px] capitalize">{s.expected_organ_system}</TableCell>
                        <TableCell className="text-center">{statusIcon(s.passed)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${metricColor(s.diagnosis_match_rate * 100, 70, 40)} text-[9px] font-mono`}>
                            {pct(s.diagnosis_match_rate * 100)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-[10px] font-mono">{s.bayesian_count ?? 0}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          {s.safety_alert_count > 0
                            ? <Badge variant="outline" className="text-[9px]"><Shield className="h-2.5 w-2.5 mr-0.5" />{s.safety_alert_count}</Badge>
                            : <span className="text-[10px] text-muted-foreground">0</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {statusIcon(s.soap_generated)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-[10px] font-mono ${latencyColor(s.total_latency_ms)}`}>
                            {ms(s.total_latency_ms)}
                          </span>
                        </TableCell>
                      </TableRow>
                      {expandedScenario === s.scenario_id && (
                        <TableRow key={`${s.scenario_id}-detail`}>
                          <TableCell colSpan={9} className="bg-muted/20 p-3">
                            <ScenarioDetail s={s} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          )}

          {/* ── Latency ── */}
          {report && (
            <TabsContent value="latency" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <MetricCard label="Avg Total" value={ms(report.latency.avg_total_ms)} icon={<Clock className="h-4 w-4" />} good={report.latency.avg_total_ms < 5000} target="<5s" />
                <MetricCard label="Target" value={ms(report.latency.target_ms)} icon={<Target className="h-4 w-4" />} good={report.latency.meets_target} />
                <MetricCard label="Meets Target" value={report.latency.meets_target ? "Yes" : "No"} icon={report.latency.meets_target ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} good={report.latency.meets_target} />
                <MetricCard label="Per Scenario" value={ms(report.latency.avg_total_ms)} icon={<Zap className="h-4 w-4" />} good={report.latency.avg_total_ms < 3000} />
              </div>
              {Object.keys(report.latency.avg_wave_latency || {}).length > 0 && (
                <Card>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-xs">Average Latency per Stage</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(report.latency.avg_wave_latency).map(([stage, val]) => (
                        <div key={stage} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5">
                          <span className="capitalize text-muted-foreground">{stage.replace(/_ms$/, "").replace(/_/g, " ")}</span>
                          <span className={`font-mono ${latencyColor(val as number)}`}>{ms(val as number)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ── Engines ── */}
          {report && (
            <TabsContent value="engines" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(report.engine_health || {}).map(([name, stats]) => (
                  <Card key={name}>
                    <CardContent className="py-3 px-4">
                      <p className="text-[10px] text-muted-foreground mb-1 capitalize">{name.replace(/_/g, " ")}</p>
                      <p className="text-xl font-bold">{(stats?.rate ?? 0).toFixed(0)}%</p>
                      <p className="text-[9px] text-muted-foreground">{stats?.active ?? 0}/{stats?.total ?? 0} active</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}

          {/* ── Persisted History ── */}
          {persistedRuns && (
            <TabsContent value="persisted" className="space-y-4">
              {persistedSummary && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <MetricCard label="Total Runs" value={String(persistedSummary.total)} icon={<Beaker className="h-4 w-4" />} good={true} />
                  <MetricCard label="Pass Rate" value={pct(persistedSummary.passRate)} icon={<CheckCircle className="h-4 w-4" />} good={persistedSummary.passRate >= 70} />
                  <MetricCard label="Avg Dx Match" value={pct(persistedSummary.avgDx)} icon={<Target className="h-4 w-4" />} good={persistedSummary.avgDx >= 50} />
                  <MetricCard label="Top-3 Accuracy" value={pct(persistedSummary.top3Accuracy)} icon={<Brain className="h-4 w-4" />} good={persistedSummary.top3Accuracy >= 70} />
                  <MetricCard label="Avg Latency" value={ms(persistedSummary.avgLatency)} icon={<Clock className="h-4 w-4" />} good={persistedSummary.avgLatency < 5000} />
                  <MetricCard label="Safety Triggers" value={pct(persistedSummary.safetyRate)} icon={<Shield className="h-4 w-4" />} good={persistedSummary.safetyRate > 0} />
                  <MetricCard label="Avg Confidence" value={pct((persistedSummary.avgConf ?? 0) * 100)} icon={<TrendingUp className="h-4 w-4" />} good={(persistedSummary.avgConf ?? 0) >= 0.5} />
                </div>
              )}

              <Card>
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-xs flex items-center gap-1">
                    <History className="h-3.5 w-3.5" /> Historical Benchmark Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto px-2 pb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Scenario</TableHead>
                        <TableHead className="text-[10px] text-center">Pass</TableHead>
                        <TableHead className="text-[10px] text-center">Dx Match</TableHead>
                        <TableHead className="text-[10px] text-center">Latency</TableHead>
                        <TableHead className="text-[10px] text-center">Safety</TableHead>
                        <TableHead className="text-[10px] text-center">Confidence</TableHead>
                        <TableHead className="text-[10px] text-center">Lab Match</TableHead>
                        <TableHead className="text-[10px] text-center">Med Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {persistedRuns.map((r, i) => (
                        <TableRow key={`${r.run_group_id}-${i}`}>
                          <TableCell className="text-[10px] font-medium max-w-[180px] truncate">{r.test_case}</TableCell>
                          <TableCell className="text-center">{statusIcon(r.passed)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${metricColor(r.diagnosis_agreement, 70, 40)} text-[9px] font-mono`}>
                              {r.diagnosis_agreement}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-[10px] font-mono ${latencyColor(r.latency_ms)}`}>{ms(r.latency_ms)}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {r.safety_alerts > 0
                              ? <Badge variant="outline" className="text-[9px]"><Shield className="h-2.5 w-2.5 mr-0.5" />{r.safety_alerts}</Badge>
                              : <span className="text-[10px] text-muted-foreground">0</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-[10px]">{r.confidence_label}</span>
                            <span className="text-[9px] text-muted-foreground ml-0.5">({pct((r.confidence_score ?? 0) * 100)})</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${metricColor(r.lab_agreement, 70, 40)} text-[9px] font-mono`}>{r.lab_agreement}%</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${metricColor(r.medication_agreement, 70, 40)} text-[9px] font-mono`}>{r.medication_agreement}%</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {persistedSummary?.timestamp && (
                <p className="text-xs text-muted-foreground text-center">
                  Latest results from: {new Date(persistedSummary.timestamp).toLocaleString()} · {persistedSummary.total} scenarios
                </p>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

// ── Sub-components ──

function SpecialtyBreakdownTable({ scenarios }: { scenarios: ScenarioResult[] }) {
  const bySpecialty = new Map<string, ScenarioResult[]>();
  scenarios.forEach(s => {
    const key = s.expected_organ_system || "unknown";
    if (!bySpecialty.has(key)) bySpecialty.set(key, []);
    bySpecialty.get(key)!.push(s);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-[10px]">Specialty</TableHead>
          <TableHead className="text-[10px] text-center">Cases</TableHead>
          <TableHead className="text-[10px] text-center">Passed</TableHead>
          <TableHead className="text-[10px] text-center">Avg Dx Match</TableHead>
          <TableHead className="text-[10px] text-center">Avg Latency</TableHead>
          <TableHead className="text-[10px] text-center">Safety Alerts</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from(bySpecialty.entries())
          .sort(([, a], [, b]) => b.length - a.length)
          .map(([specialty, cases]) => {
            const passCount = cases.filter(c => c.passed).length;
            const avgDx = cases.reduce((s, c) => s + c.diagnosis_match_rate, 0) / cases.length;
            const avgLat = cases.reduce((s, c) => s + c.total_latency_ms, 0) / cases.length;
            const safetyTotal = cases.reduce((s, c) => s + c.safety_alert_count, 0);
            return (
              <TableRow key={specialty}>
                <TableCell className="text-[10px] font-medium capitalize">{specialty}</TableCell>
                <TableCell className="text-[10px] text-center">{cases.length}</TableCell>
                <TableCell className="text-[10px] text-center">{passCount}/{cases.length}</TableCell>
                <TableCell className="text-center">
                  <Badge className={`${metricColor(avgDx * 100, 70, 40)} text-[9px] font-mono`}>{pct(avgDx * 100)}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-[10px] font-mono ${latencyColor(avgLat)}`}>{ms(avgLat)}</span>
                </TableCell>
                <TableCell className="text-[10px] text-center">{safetyTotal}</TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}

function ScenarioDetail({ s }: { s: ScenarioResult }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Diagnoses</p>
        <p className="text-muted-foreground">Matched: {s.matched_diagnoses.join(", ") || "—"}</p>
        <p className="text-muted-foreground">Actual: {s.actual_diagnoses.slice(0, 5).join(", ") || "—"}</p>
        <p className="text-muted-foreground">Graph Dx: {s.graph_diagnoses.slice(0, 5).join(", ") || "—"}</p>
        <p className="text-muted-foreground">Graph Labs: {s.graph_labs.slice(0, 5).join(", ") || "—"}</p>
        <p className="text-muted-foreground">Graph Drugs: {s.graph_drugs.slice(0, 5).join(", ") || "—"}</p>
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">World Model</p>
        {s.world_model ? (
          <>
            <p className="text-muted-foreground">Organ Systems: {s.world_model.organ_systems.join(", ") || "—"}</p>
            <p className="text-muted-foreground">Risk Level: {s.world_model.risk_level}</p>
            <p className="text-muted-foreground">State Confidence: {pct(s.world_model.state_confidence * 100)}</p>
            <p className="text-muted-foreground">Hypotheses: {s.world_model.hypotheses_count}</p>
            {s.world_model.dangerous_conditions.length > 0 && (
              <p className="text-destructive">Dangerous: {s.world_model.dangerous_conditions.join(", ")}</p>
            )}
          </>
        ) : <p className="text-muted-foreground">Not available</p>}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-foreground">Pipeline</p>
        {s.wave_latency && Object.entries(s.wave_latency).map(([wave, val]) => (
          <p key={wave} className="text-muted-foreground">
            {wave.replace(/_ms$/, "").replace(/_/g, " ")}: <span className="font-mono">{ms(val as number)}</span>
          </p>
        ))}
        <p className="text-muted-foreground">SOAP: {s.soap_generated ? "Generated" : "Missing"}</p>
        <p className="text-muted-foreground">Guidelines: {s.graph_guidelines.length}</p>
      </div>
    </div>
  );
}
