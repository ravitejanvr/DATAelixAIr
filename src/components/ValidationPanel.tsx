/**
 * Deterministic Validation Panel — UI for benchmark dashboard
 */
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, Loader2, CheckCircle, XCircle, Shield, Activity,
  AlertTriangle, FlaskConical, Repeat, Database,
} from "lucide-react";
import { runValidationSuite, type ValidationProgress, type ValidationSuiteResult, type TestResult } from "@/services/validation_suite";

function StatusBadge({ passed }: { passed: boolean }) {
  return passed
    ? <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />PASS</Badge>
    : <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />FAIL</Badge>;
}

const TEST_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  determinism: { label: "Determinism", icon: Repeat, color: "text-blue-600" },
  sensitivity: { label: "Sensitivity", icon: Activity, color: "text-amber-600" },
  isolation: { label: "Isolation", icon: Shield, color: "text-purple-600" },
  cache_consistency: { label: "Cache Consistency", icon: Database, color: "text-emerald-600" },
};

export default function ValidationPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [result, setResult] = useState<ValidationSuiteResult | null>(null);

  const runSuite = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setProgress(null);
    try {
      const r = await runValidationSuite((p) => setProgress(p));
      setResult(r);
      console.log("=== VALIDATION SUITE COMPLETE ===", JSON.stringify(r.summary, null, 2));
    } catch (e) {
      console.error("Validation suite error:", e);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, []);

  const summary = result?.summary;
  const grouped = result ? groupByType(result.tests) : {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Deterministic Validation Suite
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              6 scenarios × 4 test types — determinism, sensitivity, isolation, cache consistency
            </p>
          </div>
          <Button onClick={runSuite} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {running ? "Running…" : "Run Suite"}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {running && progress && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground">{progress.message}</span>
              <span className="font-mono">{progress.current}/{progress.total}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Summary Verdict */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Deterministic" ok={summary.deterministic} />
          <SummaryCard label="Stable (Cache)" ok={summary.stable} />
          <SummaryCard label="No State Leak" ok={summary.no_state_leak} />
          <SummaryCard label="Feature Sensitive" ok={summary.feature_sensitive} />
        </div>
      )}

      {summary?.system_not_deterministic && summary.root_cause_hint && (
        <Card className="border-destructive/50">
          <CardContent className="p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-destructive">System Non-Deterministic</p>
              <p className="text-[11px] text-muted-foreground">{summary.root_cause_hint}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results by Type */}
      {Object.entries(grouped).map(([type, tests]) => {
        const meta = TEST_TYPE_META[type] || { label: type, icon: Activity, color: "" };
        const Icon = meta.icon;
        const allPassed = tests.every(t => t.passed);
        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                {meta.label}
                {allPassed
                  ? <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px] ml-auto">ALL PASS</Badge>
                  : <Badge variant="destructive" className="text-[9px] ml-auto">FAILURES</Badge>
                }
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-40">Scenario</TableHead>
                    <TableHead className="text-xs w-20">Status</TableHead>
                    <TableHead className="text-xs">Score Var</TableHead>
                    <TableHead className="text-xs">Rank Var</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tests.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{t.scenario}</TableCell>
                      <TableCell><StatusBadge passed={t.passed} /></TableCell>
                      <TableCell className="text-xs font-mono">
                        {t.score_variance === 0 ? "0" : (t.score_variance * 100).toFixed(3) + "%"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{t.ranking_variance}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground max-w-[200px] truncate">
                        {t.details || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SummaryCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Card className={ok ? "border-emerald-500/30" : "border-destructive/30"}>
      <CardContent className="p-3 flex items-center gap-2">
        {ok ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
        <div>
          <p className="text-xs font-medium">{label}</p>
          <p className={`text-lg font-bold ${ok ? "text-emerald-600" : "text-destructive"}`}>{ok ? "PASS" : "FAIL"}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function groupByType(tests: TestResult[]): Record<string, TestResult[]> {
  const map: Record<string, TestResult[]> = {};
  for (const t of tests) {
    (map[t.test_type] ??= []).push(t);
  }
  return map;
}
