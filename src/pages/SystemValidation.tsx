import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, Loader2, CheckCircle, XCircle, Database, Activity,
  Clock, Shield, Brain, Beaker, AlertTriangle, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
      engine_status: Record<string, boolean>;
      wave_latency: Record<string, number>;
      total_latency_ms: number;
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

export default function SystemValidation() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("validate-clinical-system");
      if (err) throw err;
      setReport(data as ValidationReport);
    } catch (e: any) {
      console.error("Validation failed:", e);
      setError(e.message || "Validation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Validation</h1>
          <p className="text-sm text-muted-foreground">Full clinical reasoning pipeline validation & benchmarking</p>
        </div>
        <Button onClick={handleRun} disabled={running} size="lg">
          {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {running ? "Running Validation…" : "Run Full Validation"}
        </Button>
      </div>

      {running && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Running 8 benchmark scenarios through 6 pipeline waves…</p>
            <p className="text-xs text-muted-foreground mt-1">This may take 30–60 seconds</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive font-medium">Validation Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <span className="text-xs font-medium text-muted-foreground">Avg Diagnosis Match</span>
                </div>
                <p className="text-2xl font-bold">{report.benchmark.avg_diagnosis_match}%</p>
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
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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

          {/* Wave Latency Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pipeline Latency Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {Object.entries(report.latency.avg_wave_latency).map(([wave, ms]) => {
                  const label = wave.replace(/_ms$/, "").replace(/_/g, " ");
                  return (
                    <div key={wave} className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className={`text-sm font-bold ${latencyColor(ms as number)}`}>
                        {((ms as number) / 1000).toFixed(1)}s
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
                    <TableHead className="text-xs">Graph</TableHead>
                    <TableHead className="text-xs">Bayesian</TableHead>
                    <TableHead className="text-xs">Safety</TableHead>
                    <TableHead className="text-xs">SOAP</TableHead>
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
                      <TableCell>{statusIcon(s.engine_status.graph_engine)}</TableCell>
                      <TableCell>
                        {statusIcon(s.engine_status.bayesian_engine)}
                        <span className="text-[10px] text-muted-foreground ml-1">{s.bayesian_count}</span>
                      </TableCell>
                      <TableCell>
                        {statusIcon(s.engine_status.safety_engine)}
                        {s.safety_alert_count > 0 && (
                          <Badge variant="outline" className="text-[9px] ml-1">{s.safety_alert_count}</Badge>
                        )}
                      </TableCell>
                      <TableCell>{statusIcon(s.soap_generated)}</TableCell>
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

          {/* Scenario Detail Traces */}
          {report.benchmark.scenarios.map((s) => (
            <Card key={s.scenario_id} className="border-l-4" style={{ borderLeftColor: s.passed ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {statusIcon(s.passed)}
                  {s.scenario_name} — Reasoning Trace
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                </div>
                <div className="flex gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border">
                  {Object.entries(s.wave_latency).map(([k, v]) => (
                    <span key={k}>{k.replace(/_ms$/, "").replace(/wave\d_/, "")}: {Math.round(v as number)}ms</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

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

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center">
            Validation ID: {report.validation_id} · Duration: {(report.total_duration_ms / 1000).toFixed(1)}s · {report.timestamp}
          </p>
        </>
      )}
    </div>
  );
}
