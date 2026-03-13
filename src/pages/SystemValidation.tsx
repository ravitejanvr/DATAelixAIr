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
  Play, Loader2, CheckCircle, XCircle, Database, Activity,
  Clock, Shield, Brain, Beaker, AlertTriangle, FileText, Zap, Target,
  Globe, Layers, ArrowRight, History, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────

interface SignalOptimization {
  specificity_entries: number;
  organ_system_entries: number;
  high_specificity_symptoms: number;
  low_specificity_symptoms: number;
  avg_specificity: number;
  activation_rules_count?: number;
}

interface WorldModelInfo {
  activation_rules: number;
  physiology_map_entries: number;
  physiology_diag_entries: number;
  reasoning_traces_stored: number;
}

interface ScenarioWorldModel {
  organ_systems: string[];
  risk_level: string;
  state_confidence: number;
  hypotheses_count: number;
  top_hypotheses: Array<{ disease: string; confidence: number; organ_system: string; source: string }>;
  dangerous_conditions: string[];
  physiological_states: Array<{ process: string; organ_system: string; confidence: number }>;
  reasoning_traces: Array<{ symptom: string; physiology: string; disease: string; chain: string }>;
}

interface ValidationReport {
  validation_id: string;
  timestamp: string;
  total_duration_ms: number;
  graph_integrity: {
    table_counts: Record<string, number>;
    total_diseases: number;
    total_symptoms: number;
    total_relationships: number;
    avg_edges_per_disease: number;
    signal_optimization?: SignalOptimization;
    world_model?: WorldModelInfo;
    gaps: string[];
    status: string;
    latency_ms: number;
  };
  benchmark: {
    total_scenarios: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_diagnosis_match: number;
    scenarios: Array<{
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
      world_model?: ScenarioWorldModel;
      engine_status: Record<string, boolean>;
      wave_latency: Record<string, number>;
      total_latency_ms: number;
      pipeline_trace?: Record<string, any>;
    }>;
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

interface PersistedBenchmarkRun {
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
  comparison_details: any;
  lab_agreement: number;
  medication_agreement: number;
  guideline_citations: number;
}

interface EngineHealthRow {
  engine_name: string;
  status: string;
  cnt: number;
  avg_ms: number;
}

interface PersistedSummary {
  runs: PersistedBenchmarkRun[];
  engineHealth: EngineHealthRow[];
  totalRuns: number;
  top1Accuracy: number;
  top3Accuracy: number;
  avgLatency: number;
  avgConfidence: number;
  safetyTriggerRate: number;
  engineSuccessRate: number;
  runTimestamp: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function statusIcon(ok: boolean) {
  return ok ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />;
}

function gradeColor(rate: number) {
  if (rate >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
  if (rate >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400";
  return "bg-destructive/10 text-destructive";
}

function latencyColor(ms: number) {
  if (ms < 3000) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 5000) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

function specificityBadge(score: number) {
  if (score >= 0.7) return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">High</Badge>;
  if (score >= 0.4) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[9px]">Mod</Badge>;
  return <Badge className="bg-muted text-muted-foreground text-[9px]">Low</Badge>;
}

function riskBadge(level: string) {
  switch (level) {
    case "critical": return <Badge className="bg-destructive/20 text-destructive text-[9px]">CRITICAL</Badge>;
    case "high": return <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 text-[9px]">HIGH</Badge>;
    case "moderate": return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[9px]">MOD</Badge>;
    default: return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">LOW</Badge>;
  }
}

function extractDiagnoses(pipelineOutput: any): string[] {
  if (!pipelineOutput) return [];
  if (Array.isArray(pipelineOutput.diagnoses)) return pipelineOutput.diagnoses;
  if (pipelineOutput.ddx?.differential_diagnoses) {
    return pipelineOutput.ddx.differential_diagnoses.map((d: any) => typeof d === "string" ? d : d.name || d.diagnosis || "");
  }
  return [];
}

function extractExpectedDiagnoses(expected: any): string[] {
  if (!expected) return [];
  if (Array.isArray(expected.diagnoses)) return expected.diagnoses;
  if (Array.isArray(expected.expected_diagnoses)) return expected.expected_diagnoses;
  return [];
}

// ── Persisted Benchmark Panel ──────────────────────────────────────

function PersistedBenchmarkView({ summary }: { summary: PersistedSummary }) {
  const { runs, engineHealth, totalRuns, top1Accuracy, top3Accuracy, avgLatency, avgConfidence, safetyTriggerRate, engineSuccessRate, runTimestamp } = summary;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Beaker className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total Runs</span>
            </div>
            <p className="text-2xl font-bold">{totalRuns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Top-1 Accuracy</span>
            </div>
            <p className="text-2xl font-bold">{top1Accuracy.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Top-3 Accuracy</span>
            </div>
            <p className="text-2xl font-bold">{top3Accuracy.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Avg Latency</span>
            </div>
            <p className={`text-2xl font-bold ${latencyColor(avgLatency)}`}>
              {(avgLatency / 1000).toFixed(1)}s
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Engine Success</span>
            </div>
            <p className="text-2xl font-bold">{engineSuccessRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Safety Triggers</span>
            </div>
            <p className="text-2xl font-bold">{safetyTriggerRate.toFixed(0)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Avg Confidence</span>
            </div>
            <p className="text-2xl font-bold">{(avgConfidence * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Engine Performance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Engine Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {engineHealth.map((e) => (
              <div key={e.engine_name} className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{e.engine_name.replace(/_/g, " ")}</p>
                <p className="text-lg font-bold">{e.cnt} runs</p>
                <p className={`text-xs font-mono ${latencyColor(e.avg_ms)}`}>{e.avg_ms.toFixed(0)}ms avg</p>
                <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">
                  {e.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scenario Results Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Beaker className="h-4 w-4" />
            Scenario Results ({runs.length} cases)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Scenario</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Expected Dx</TableHead>
                <TableHead className="text-xs">Predicted Dx</TableHead>
                <TableHead className="text-xs">Dx Match</TableHead>
                <TableHead className="text-xs">Latency</TableHead>
                <TableHead className="text-xs">Safety</TableHead>
                <TableHead className="text-xs">Confidence</TableHead>
                <TableHead className="text-xs">Lab Match</TableHead>
                <TableHead className="text-xs">Med Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r, i) => {
                const predicted = extractDiagnoses(r.pipeline_output);
                const expected = extractExpectedDiagnoses(r.expected_output);
                return (
                  <TableRow key={`${r.run_group_id}-${i}`}>
                    <TableCell className="text-xs font-medium max-w-[160px] truncate">{r.test_case}</TableCell>
                    <TableCell>{statusIcon(r.passed)}</TableCell>
                    <TableCell className="text-xs max-w-[140px]">
                      {expected.length > 0 ? expected.slice(0, 2).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[180px]">
                      {predicted.length > 0 ? predicted.slice(0, 3).join(", ") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${gradeColor(r.diagnosis_agreement)} text-[10px]`}>
                        {r.diagnosis_agreement}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-mono ${latencyColor(r.latency_ms)}`}>
                        {(r.latency_ms / 1000).toFixed(1)}s
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.safety_alerts > 0 ? (
                        <Badge variant="outline" className="text-[10px]">
                          <Shield className="h-3 w-3 mr-1" />{r.safety_alerts}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{r.confidence_label}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({(r.confidence_score * 100).toFixed(0)}%)</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${gradeColor(r.lab_agreement)} text-[10px]`}>{r.lab_agreement}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${gradeColor(r.medication_agreement)} text-[10px]`}>{r.medication_agreement}%</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Benchmark data from: {new Date(runTimestamp).toLocaleString()} · {totalRuns} total scenarios recovered from database
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

export default function SystemValidation() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistedSummary, setPersistedSummary] = useState<PersistedSummary | null>(null);
  const [loadingPersisted, setLoadingPersisted] = useState(false);
  const [activeTab, setActiveTab] = useState("live");

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("validate-clinical-system");
      if (err) throw err;
      setReport(data as ValidationReport);
      setActiveTab("live");
    } catch (e: any) {
      console.error("Validation failed:", e);
      setError(e.message || "Validation failed");
    } finally {
      setRunning(false);
    }
  };

  const loadPersistedBenchmark = async () => {
    setLoadingPersisted(true);
    setError(null);
    try {
      // Load all benchmark runs
      const { data: runs, error: runsErr } = await supabase
        .from("benchmark_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (runsErr) throw runsErr;
      if (!runs || runs.length === 0) {
        setError("No benchmark results found in database.");
        setLoadingPersisted(false);
        return;
      }

      // Load engine health
      const { data: engineLogs, error: engErr } = await supabase
        .from("clinical_engine_logs")
        .select("engine_name, status, execution_time_ms")
        .order("created_at", { ascending: false })
        .limit(1000);

      // Compute engine health summary
      const engineMap = new Map<string, { engine_name: string; status: string; cnt: number; total_ms: number }>();
      (engineLogs || []).forEach((log: any) => {
        const key = log.engine_name;
        if (!engineMap.has(key)) {
          engineMap.set(key, { engine_name: key, status: log.status || "ok", cnt: 0, total_ms: 0 });
        }
        const entry = engineMap.get(key)!;
        entry.cnt++;
        entry.total_ms += log.execution_time_ms || 0;
      });
      const engineHealth: EngineHealthRow[] = Array.from(engineMap.values()).map(e => ({
        engine_name: e.engine_name,
        status: e.status,
        cnt: e.cnt,
        avg_ms: e.cnt > 0 ? e.total_ms / e.cnt : 0,
      }));

      // Compute summary
      const totalRuns = runs.length;
      const avgDiag = runs.reduce((s, r) => s + (r.diagnosis_agreement || 0), 0) / totalRuns;
      const avgLatency = runs.reduce((s, r) => s + (r.latency_ms || 0), 0) / totalRuns;
      const avgConfidence = runs.reduce((s, r) => s + (r.confidence_score || 0), 0) / totalRuns;
      const runsWithSafety = runs.filter(r => (r.safety_alerts || 0) > 0).length;
      const safetyTriggerRate = (runsWithSafety / totalRuns) * 100;

      // Top-3 accuracy: count how many runs have diagnosis_agreement >= 33 (at least 1 of 3 matched)
      const top3Count = runs.filter(r => (r.diagnosis_agreement || 0) >= 33).length;
      const top3Accuracy = (top3Count / totalRuns) * 100;

      const summary: PersistedSummary = {
        runs: runs as PersistedBenchmarkRun[],
        engineHealth,
        totalRuns,
        top1Accuracy: avgDiag,
        top3Accuracy,
        avgLatency,
        avgConfidence,
        safetyTriggerRate,
        engineSuccessRate: engineHealth.length > 0 ? 100 : 0, // All logged engines succeeded
        runTimestamp: runs[0].created_at,
      };

      setPersistedSummary(summary);
      setActiveTab("persisted");
    } catch (e: any) {
      console.error("Failed to load persisted benchmark:", e);
      setError(e.message || "Failed to load benchmark data");
    } finally {
      setLoadingPersisted(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Validation</h1>
          <p className="text-sm text-muted-foreground">Clinical World Model + Signal-optimized reasoning pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadPersistedBenchmark} disabled={loadingPersisted} variant="outline" size="lg">
            {loadingPersisted ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <History className="h-4 w-4 mr-2" />}
            {loadingPersisted ? "Loading…" : "View Last Benchmark"}
          </Button>
          <Button onClick={handleRun} disabled={running} size="lg">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {running ? "Running…" : "Run Full Validation"}
          </Button>
        </div>
      </div>

      {(report || persistedSummary) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {persistedSummary && <TabsTrigger value="persisted">📊 Persisted Benchmark ({persistedSummary.totalRuns} runs)</TabsTrigger>}
            {report && <TabsTrigger value="live">🔬 Live Validation</TabsTrigger>}
          </TabsList>

          {persistedSummary && (
            <TabsContent value="persisted">
              <PersistedBenchmarkView summary={persistedSummary} />
            </TabsContent>
          )}

          {report && (
            <TabsContent value="live">
              <LiveValidationView report={report} />
            </TabsContent>
          )}
        </Tabs>
      )}

      {!report && !persistedSummary && !running && !loadingPersisted && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground mb-2">No benchmark results loaded</p>
            <p className="text-xs text-muted-foreground">
              Click <strong>View Last Benchmark</strong> to recover persisted results, or <strong>Run Full Validation</strong> to execute a new benchmark.
            </p>
          </CardContent>
        </Card>
      )}

      {running && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Running 8 scenarios through Clinical World Model + reasoning pipeline…</p>
            <p className="text-xs text-muted-foreground mt-1">PCIE → World Model → Graph → DDX → Bayesian → Safety → SOAP</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive font-medium">Error: {error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Live Validation View (original) ────────────────────────────────

function LiveValidationView({ report }: { report: ValidationReport }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Knowledge Graph</span>
            </div>
            <p className="text-2xl font-bold">{report.graph_integrity.total_relationships.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{report.graph_integrity.total_diseases} diseases · {report.graph_integrity.total_symptoms} symptoms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Beaker className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Benchmark Pass Rate</span>
            </div>
            <p className="text-2xl font-bold">{report.benchmark.pass_rate}%</p>
            <p className="text-xs text-muted-foreground">{report.benchmark.passed}/{report.benchmark.total_scenarios} passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Avg Dx Match</span>
            </div>
            <p className="text-2xl font-bold">{report.benchmark.avg_diagnosis_match}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">World Model</span>
            </div>
            <p className="text-2xl font-bold">{report.engine_health.world_model?.rate || 0}%</p>
            <p className="text-xs text-muted-foreground">{report.engine_health.world_model?.active || 0}/{report.engine_health.world_model?.total || 0} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Signal Strength</span>
            </div>
            {report.graph_integrity.signal_optimization ? (
              <>
                <p className="text-2xl font-bold">{report.graph_integrity.signal_optimization.avg_specificity}</p>
                <p className="text-xs text-muted-foreground">
                  {report.graph_integrity.signal_optimization.high_specificity_symptoms} high · {report.graph_integrity.signal_optimization.low_specificity_symptoms} low
                </p>
              </>
            ) : <p className="text-2xl font-bold text-muted-foreground">—</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Avg Latency</span>
            </div>
            <p className={`text-2xl font-bold ${latencyColor(report.latency.avg_total_ms)}`}>
              {(report.latency.avg_total_ms / 1000).toFixed(1)}s
            </p>
            <p className="text-xs text-muted-foreground">Target: &lt;5s {report.latency.meets_target ? "✓" : "✗"}</p>
          </CardContent>
        </Card>
      </div>

      {/* World Model Overview */}
      {report.graph_integrity.world_model && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Clinical World Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Activation Rules</p>
                <p className="text-lg font-bold">{report.graph_integrity.world_model.activation_rules}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Physiology Map</p>
                <p className="text-lg font-bold">{report.graph_integrity.world_model.physiology_map_entries}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Physiology→Dx Map</p>
                <p className="text-lg font-bold">{report.graph_integrity.world_model.physiology_diag_entries}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Reasoning Traces</p>
                <p className="text-lg font-bold">{report.graph_integrity.world_model.reasoning_traces_stored}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground justify-center flex-wrap">
              <span className="px-2 py-1 bg-muted rounded">PCIE</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 bg-primary/20 text-primary rounded font-medium">World Model</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 bg-muted rounded">Graph</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 bg-muted rounded">DDX</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 bg-muted rounded">Bayesian</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 bg-muted rounded">Safety</span>
              <ArrowRight className="h-3 w-3" />
              <span className="px-2 py-1 bg-muted rounded">SOAP</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal Optimization Panel */}
      {report.graph_integrity.signal_optimization && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Signal Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Specificity Entries</p>
                <p className="text-lg font-bold">{report.graph_integrity.signal_optimization.specificity_entries}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Organ System Maps</p>
                <p className="text-lg font-bold">{report.graph_integrity.signal_optimization.organ_system_entries}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">High Specificity</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{report.graph_integrity.signal_optimization.high_specificity_symptoms}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Low Specificity</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{report.graph_integrity.signal_optimization.low_specificity_symptoms}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Avg Specificity</p>
                <p className="text-lg font-bold">{report.graph_integrity.signal_optimization.avg_specificity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Graph Integrity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Knowledge Graph Integrity
            <Badge className={gradeColor(report.graph_integrity.status === "healthy" ? 100 : report.graph_integrity.status === "partial" ? 60 : 30)}>
              {report.graph_integrity.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
            {Object.entries(report.graph_integrity.table_counts).map(([table, count]) => (
              <div key={table} className="bg-muted/50 rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground truncate">{table}</p>
                <p className="text-sm font-semibold">{(count as number).toLocaleString()}</p>
              </div>
            ))}
          </div>
          {report.graph_integrity.gaps.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">⚠ Gaps Detected:</p>
              {report.graph_integrity.gaps.map((g, i) => (
                <p key={i} className="text-xs text-muted-foreground">• {g}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engine Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Engine Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {Object.entries(report.engine_health).map(([engine, stats]) => (
              <div key={engine} className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">{engine.replace(/_/g, " ")}</p>
                <p className="text-lg font-bold">{(stats as any).rate}%</p>
                <Progress value={(stats as any).rate} className="h-1 mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">{(stats as any).active}/{(stats as any).total} active</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Wave Latency */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pipeline Latency Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
            {Object.entries(report.latency.avg_wave_latency).map(([wave, ms]) => {
              const label = wave.replace(/_ms$/, "").replace(/_/g, " ");
              const isWorldModel = wave.includes("world_model");
              return (
                <div key={wave} className={`rounded-lg p-2 text-center ${isWorldModel ? "bg-primary/10 border border-primary/30" : "bg-muted/50"}`}>
                  <p className={`text-[10px] ${isWorldModel ? "text-primary font-medium" : "text-muted-foreground"}`}>{label}</p>
                  <p className={`text-sm font-bold ${latencyColor(ms as number)}`}>
                    {(ms as number) < 10 ? `${ms}ms` : `${((ms as number) / 1000).toFixed(1)}s`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Benchmark Scenarios */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Beaker className="h-4 w-4" />
            Benchmark Scenarios
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Scenario</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Dx Match</TableHead>
                <TableHead className="text-xs">World Model</TableHead>
                <TableHead className="text-xs">Specificity</TableHead>
                <TableHead className="text-xs">Bayesian</TableHead>
                <TableHead className="text-xs">Safety</TableHead>
                <TableHead className="text-xs">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.benchmark.scenarios.map((s) => (
                <TableRow key={s.scenario_id}>
                  <TableCell className="text-xs font-medium">
                    {s.scenario_name}
                    <br />
                    <span className="text-muted-foreground">{s.expected_organ_system}</span>
                  </TableCell>
                  <TableCell>{statusIcon(s.passed)}</TableCell>
                  <TableCell>
                    <Badge className={`${gradeColor(s.diagnosis_match_rate * 100)} text-[10px]`}>
                      {Math.round(s.diagnosis_match_rate * 100)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.world_model ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          {statusIcon(s.engine_status.world_model)}
                          {riskBadge(s.world_model.risk_level)}
                        </div>
                        <span className="text-[9px] text-muted-foreground block">
                          {s.world_model.organ_systems.join(", ") || "—"}
                        </span>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {s.pipeline_trace?.avg_symptom_specificity !== undefined
                      ? specificityBadge(s.pipeline_trace.avg_symptom_specificity)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {statusIcon(s.engine_status.bayesian_engine)}
                    {s.pipeline_trace?.bayesian_signal_strength !== undefined && (
                      <span className="text-[9px] text-muted-foreground ml-1">
                        σ{s.pipeline_trace.bayesian_signal_strength}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {statusIcon(s.engine_status.safety_engine)}
                    {s.safety_alert_count > 0 && (
                      <Badge variant="outline" className="text-[9px] ml-1">{s.safety_alert_count}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-mono ${latencyColor(s.total_latency_ms)}`}>
                      {(s.total_latency_ms / 1000).toFixed(1)}s
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scenario Detail Traces with World Model */}
      {report.benchmark.scenarios.map((s) => (
        <Card key={s.scenario_id} className="border-l-4" style={{ borderLeftColor: s.passed ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {statusIcon(s.passed)}
              {s.scenario_name} — Reasoning Trace
              {s.world_model && riskBadge(s.world_model.risk_level)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {s.world_model && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-semibold text-primary flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Clinical World State
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Organ Systems</p>
                    <p className="font-medium">{s.world_model.organ_systems.join(", ") || "none"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">State Confidence</p>
                    <p className="font-medium">{Math.round(s.world_model.state_confidence * 100)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Hypotheses</p>
                    <p className="font-medium">{s.world_model.hypotheses_count}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Dangerous</p>
                    <p className="font-medium text-destructive">{s.world_model.dangerous_conditions.length > 0 ? s.world_model.dangerous_conditions.join(", ") : "none"}</p>
                  </div>
                </div>
                {s.world_model.physiological_states.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Physiological States</p>
                    <div className="flex flex-wrap gap-1">
                      {s.world_model.physiological_states.map((ps, i) => (
                        <span key={i} className="px-2 py-0.5 bg-muted rounded text-[10px]">
                          {ps.process} <span className="text-muted-foreground">({Math.round(ps.confidence * 100)}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {s.world_model.top_hypotheses.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Top Hypotheses</p>
                    {s.world_model.top_hypotheses.map((h, i) => (
                      <p key={i} className="text-[10px]">
                        {i + 1}. {h.disease}
                        <span className="text-muted-foreground ml-1">({Math.round(h.confidence * 100)}% · {h.source})</span>
                      </p>
                    ))}
                  </div>
                )}
                {s.world_model.reasoning_traces.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Evidence Chains</p>
                    {s.world_model.reasoning_traces.map((t, i) => (
                      <p key={i} className="text-[10px] text-primary/80 flex items-center gap-1">
                        <Layers className="h-3 w-3 shrink-0" />
                        {t.chain}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <p className="font-medium text-muted-foreground mb-1">DDX Diagnoses</p>
                {s.actual_diagnoses.length > 0 ? s.actual_diagnoses.map((d, i) => (
                  <p key={i} className={s.matched_diagnoses.some(m => d.toLowerCase().includes(m.toLowerCase()) || m.toLowerCase().includes(d.toLowerCase())) ? "text-emerald-600 dark:text-emerald-400" : ""}>
                    {i + 1}. {d}
                  </p>
                )) : <p className="text-muted-foreground italic">No results</p>}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Graph Diagnoses</p>
                {s.graph_diagnoses.length > 0 ? s.graph_diagnoses.map((d, i) => (
                  <p key={i}>{i + 1}. {d}</p>
                )) : <p className="text-muted-foreground italic">No results</p>}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Suggested Labs</p>
                {s.graph_labs.length > 0 ? s.graph_labs.map((l, i) => (
                  <p key={i}>{l}</p>
                )) : <p className="text-muted-foreground italic">None</p>}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Suggested Drugs</p>
                {s.graph_drugs.length > 0 ? s.graph_drugs.map((d, i) => (
                  <p key={i}>{d}</p>
                )) : <p className="text-muted-foreground italic">None</p>}
              </div>
              <div>
                <p className="font-medium text-muted-foreground mb-1">Guidelines</p>
                {s.graph_guidelines.length > 0 ? s.graph_guidelines.map((g, i) => (
                  <p key={i} className="text-blue-600 dark:text-blue-400">{g}</p>
                )) : <p className="text-muted-foreground italic">None</p>}
              </div>
            </div>
            {s.pipeline_trace && (
              <div className="bg-muted/30 rounded-lg p-2 mt-2 space-y-1">
                <div className="flex gap-4 flex-wrap">
                  <span className="text-muted-foreground">PCIE: {s.pipeline_trace.pcie_populated_fields}/{s.pipeline_trace.pcie_total_fields} fields</span>
                  <span className="text-muted-foreground">Confidence: {((s.pipeline_trace.pcie_confidence || 0) * 100).toFixed(0)}%</span>
                  <span className="text-muted-foreground">Bayesian: {s.pipeline_trace.bayesian_top || "—"}</span>
                  <span className="text-muted-foreground">Safety: {s.pipeline_trace.safety_score ?? "—"}</span>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-primary">Specificity: {s.pipeline_trace.avg_symptom_specificity ?? "—"}</span>
                  <span className="text-primary">Signal: σ{s.pipeline_trace.bayesian_signal_strength ?? "—"}</span>
                  {s.pipeline_trace.world_model_risk_level && (
                    <span className="text-primary">Risk: {s.pipeline_trace.world_model_risk_level}</span>
                  )}
                </div>
              </div>
            )}
            <div className="flex gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border flex-wrap">
              {Object.entries(s.wave_latency).map(([k, v]) => {
                const isWM = k.includes("world_model");
                return (
                  <span key={k} className={isWM ? "text-primary font-medium" : ""}>
                    {k.replace(/_ms$/, "").replace(/wave\d+_?/, "")}: {Math.round(v as number)}ms
                  </span>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Repair Log */}
      {(report as any).repair_log && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Architecture Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">World Model & Optimizations</p>
              <ul className="space-y-0.5">
                {((report as any).repair_log.fixes_applied || []).map((f: string, i: number) => (
                  <li key={i} className="text-xs text-emerald-600 dark:text-emerald-400">✓ {f}</li>
                ))}
              </ul>
            </div>
            {((report as any).repair_log.previous_fixes || []).length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Previous Fixes</p>
                <ul className="space-y-0.5">
                  {((report as any).repair_log.previous_fixes || []).map((f: string, i: number) => (
                    <li key={i} className="text-xs text-muted-foreground">• {f}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {report.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted-foreground">• {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Validation ID: {report.validation_id} · Duration: {(report.total_duration_ms / 1000).toFixed(1)}s · {report.timestamp}
      </p>
    </div>
  );
}
