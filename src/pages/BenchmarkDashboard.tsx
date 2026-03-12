import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, Loader2, CheckCircle, XCircle, AlertTriangle,
  Clock, Target, Shield, Activity, Beaker,
} from "lucide-react";
import { runBenchmarkV5, BENCHMARK_CASES_V5, type BenchmarkSuiteResult } from "@/services/benchmark_v5";

function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}

function latencyBadge(ms: number) {
  if (ms === 0) return <Badge variant="outline" className="text-[9px]">—</Badge>;
  const color = ms < 5000 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
    : ms < 10000 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
    : "bg-destructive/10 text-destructive";
  return <Badge className={`${color} text-[9px]`}>{(ms / 1000).toFixed(1)}s</Badge>;
}

function scoreBadge(rate: number) {
  const color = rate >= 0.7 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
    : rate >= 0.4 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400"
    : "bg-destructive/10 text-destructive";
  return <Badge className={`${color} text-[9px]`}>{pct(rate)}</Badge>;
}

export default function BenchmarkDashboard() {
  const [result, setResult] = useState<BenchmarkSuiteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" });

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await runBenchmarkV5((i, total, name) => {
        setProgress({ current: i + 1, total, name });
      });
      setResult(res);
    } catch (e) {
      console.error("[BenchmarkV5] Suite failed:", e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Benchmark v5</h2>
          <p className="text-xs text-muted-foreground">
            {BENCHMARK_CASES_V5.length} clinical test cases · Full pipeline evaluation
          </p>
        </div>
        <Button onClick={handleRun} disabled={running} size="sm">
          {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1" />}
          {running ? "Running..." : "Run Benchmark"}
        </Button>
      </div>

      {/* Progress */}
      {running && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">
                Case {progress.current}/{progress.total}: {progress.name}
              </span>
            </div>
            <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] text-muted-foreground">Pass Rate</p>
                </div>
                <p className="text-2xl font-bold">{result.passed_cases}/{result.total_cases}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Beaker className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] text-muted-foreground">Avg Diagnosis Match</p>
                </div>
                <p className="text-2xl font-bold">{pct(result.avg_diagnosis_match)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-[10px] text-muted-foreground">Danger Detection</p>
                </div>
                <p className="text-2xl font-bold">{pct(result.danger_detection_rate)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">Avg Latency</p>
                </div>
                <p className="text-2xl font-bold">{(result.avg_latency_ms / 1000).toFixed(1)}s</p>
              </CardContent>
            </Card>
          </div>

          {/* Accuracy Bars */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Accuracy Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Diagnosis Match</span>
                  <span className="font-medium">{pct(result.avg_diagnosis_match)}</span>
                </div>
                <Progress value={result.avg_diagnosis_match * 100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Lab Match</span>
                  <span className="font-medium">{pct(result.avg_lab_match)}</span>
                </div>
                <Progress value={result.avg_lab_match * 100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Medication Match</span>
                  <span className="font-medium">{pct(result.avg_medication_match)}</span>
                </div>
                <Progress value={result.avg_medication_match * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Wave Latency */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" /> Wave Latency (avg)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Wave 1 (DDX + Knowledge)</p>
                  {latencyBadge(result.module_avg_latency.wave1_ms)}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Wave 2 (Guidelines + Meds + Safety)</p>
                  {latencyBadge(result.module_avg_latency.wave2_ms)}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Wave 3 (Uncertainty + SOAP)</p>
                  {latencyBadge(result.module_avg_latency.wave3_ms)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Case Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Case</TableHead>
                      <TableHead className="text-[10px]">Category</TableHead>
                      <TableHead className="text-[10px]">Pass</TableHead>
                      <TableHead className="text-[10px]">Dx Match</TableHead>
                      <TableHead className="text-[10px]">Lab Match</TableHead>
                      <TableHead className="text-[10px]">Med Match</TableHead>
                      <TableHead className="text-[10px]">Guidelines</TableHead>
                      <TableHead className="text-[10px]">Danger</TableHead>
                      <TableHead className="text-[10px]">Confidence</TableHead>
                      <TableHead className="text-[10px]">Latency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.cases.map((c) => (
                      <TableRow key={c.case_id}>
                        <TableCell className="text-xs font-medium">{c.case_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px]">{c.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {c.passed
                            ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                        </TableCell>
                        <TableCell>{scoreBadge(c.diagnosis_match_rate)}</TableCell>
                        <TableCell>{scoreBadge(c.lab_match_rate)}</TableCell>
                        <TableCell>{scoreBadge(c.medication_match_rate)}</TableCell>
                        <TableCell className="text-xs text-center">{c.guideline_citations}</TableCell>
                        <TableCell>
                          {c.expected_danger ? (
                            c.danger_detected
                              ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[8px]">Detected</Badge>
                              : <Badge className="bg-destructive/10 text-destructive text-[8px]">Missed!</Badge>
                          ) : (
                            <span className="text-[9px] text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[8px]">
                            {c.confidence_label} ({Math.round(c.confidence_score * 100)}%)
                          </Badge>
                        </TableCell>
                        <TableCell>{latencyBadge(c.latency.total_ms)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Detail panels for each case */}
          <div className="space-y-3">
            {result.cases.map((c) => (
              <details key={c.case_id} className="group">
                <summary className="cursor-pointer text-xs font-medium flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md hover:bg-muted">
                  {c.passed ? <CheckCircle className="h-3 w-3 text-emerald-600" /> : <XCircle className="h-3 w-3 text-destructive" />}
                  {c.case_name}
                  <span className="text-muted-foreground ml-auto">{pct(c.diagnosis_match_rate)} dx · {(c.latency.total_ms / 1000).toFixed(1)}s</span>
                </summary>
                <div className="mt-2 p-3 bg-muted/30 rounded-md text-[11px] space-y-2">
                  <div><strong>Matched Diagnoses:</strong> {c.matched_diagnoses.join(", ") || "None"}</div>
                  <div><strong>Matched Labs:</strong> {c.matched_labs.join(", ") || "None"}</div>
                  <div><strong>Matched Medications:</strong> {c.matched_medications.join(", ") || "None"}</div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div>W1: {c.latency.wave1_ms}ms</div>
                    <div>W2: {c.latency.wave2_ms}ms</div>
                    <div>W3: {c.latency.wave3_ms}ms</div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {!result && !running && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Click "Run Benchmark" to evaluate the clinical pipeline against 10 test cases.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
