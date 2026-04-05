/**
 * V3 Production Validation Panel
 * Runs 30-case validation suite and displays structured results with metrics.
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
  Play, Loader2, CheckCircle, XCircle, Shield, AlertTriangle,
  Activity, Beaker, Target, TrendingUp,
} from "lucide-react";
import { runV3ValidationSuite, type V3ValidationProgress } from "@/services/v3_validation";
import type { V3CaseResult, V3ValidationSuiteResult } from "@/services/v3_validation";

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  strong_systemic: { label: "Strong Systemic", color: "text-red-600", icon: Activity },
  pure_local: { label: "Pure Local", color: "text-blue-600", icon: Target },
  ambiguous_overlap: { label: "Ambiguous", color: "text-amber-600", icon: Beaker },
};

export default function V3ValidationPanel() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<V3ValidationProgress | null>(null);
  const [result, setResult] = useState<V3ValidationSuiteResult | null>(null);

  const runSuite = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await runV3ValidationSuite((p) => setProgress(p));
      setResult(r);
      console.log("=== V3 VALIDATION COMPLETE ===", JSON.stringify(r.metrics, null, 2));
    } catch (e) {
      console.error("V3 Validation error:", e);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }, []);

  const m = result?.metrics;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              V3 Production Validation Suite
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              30 cases: 10 Systemic + 10 Local + 10 Ambiguous — validates ranking correctness and systemic reasoning
            </p>
          </div>
          <Button onClick={runSuite} disabled={running} size="sm">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {running ? "Running…" : "Run V3 Validation"}
          </Button>
        </CardContent>
      </Card>

      {/* Progress */}
      {running && progress && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-muted-foreground truncate max-w-[70%]">{progress.case_name}</span>
              <span className="font-mono">{progress.current}/{progress.total}</span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Metrics Summary */}
      {m && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Top-1 Accuracy" value={`${(m.top1_accuracy * 100).toFixed(0)}%`} target="≥80%" ok={m.top1_accuracy >= 0.8} />
            <MetricCard label="Top-3 Recall" value={`${(m.top3_recall * 100).toFixed(0)}%`} target="≥95%" ok={m.top3_recall >= 0.95} />
            <MetricCard label="Systemic Top-1" value={`${(m.systemic_top1_accuracy * 100).toFixed(0)}%`} target="100%" ok={m.systemic_top1_accuracy >= 0.9} />
            <MetricCard label="Local Top-1" value={`${(m.local_top1_accuracy * 100).toFixed(0)}%`} target="≥80%" ok={m.local_top1_accuracy >= 0.8} />
            <MetricCard label="Ambiguous Top-3" value={`${(m.ambiguous_top3_rate * 100).toFixed(0)}%`} target="≥90%" ok={m.ambiguous_top3_rate >= 0.9} />
          </div>

          {/* Critical Diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DiagnosticCard
              label="V1 Overpowers V3 (systemic)"
              count={result!.v1_overpower_count}
              ok={result!.v1_overpower_count === 0}
              detail="V1 symptom scores dominating V3 state scores in systemic cases"
            />
            <DiagnosticCard
              label="Systemic Flips Local"
              count={result!.systemic_flip_local_count}
              ok={result!.systemic_flip_local_count === 0}
              detail="Systemic weighting incorrectly overriding local diagnoses"
            />
            <DiagnosticCard
              label="Fragile Rankings"
              count={result!.fragile_cases.length}
              ok={result!.fragile_cases.length <= 2}
              detail={result!.fragile_cases.length > 0 ? `Cases: ${result!.fragile_cases.join(", ")}` : "No fragile rankings"}
            />
          </div>

          {/* Verdict */}
          <Card className={
            m.top1_accuracy >= 0.8 && m.top3_recall >= 0.95 && m.systemic_top1_accuracy >= 0.9
              ? "border-emerald-500/50 bg-emerald-50/30"
              : "border-destructive/50 bg-destructive/5"
          }>
            <CardContent className="p-4 flex items-center gap-3">
              {m.top1_accuracy >= 0.8 && m.top3_recall >= 0.95 && m.systemic_top1_accuracy >= 0.9
                ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                : <AlertTriangle className="h-5 w-5 text-destructive" />
              }
              <div>
                <p className="text-sm font-semibold">
                  {m.top1_accuracy >= 0.8 && m.top3_recall >= 0.95 && m.systemic_top1_accuracy >= 0.9
                    ? "✅ V3 is production-ready"
                    : "⚠️ V3 requires further stabilization"
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Top-1: {(m.top1_accuracy * 100).toFixed(0)}% | Top-3: {(m.top3_recall * 100).toFixed(0)}% | Systemic: {(m.systemic_top1_accuracy * 100).toFixed(0)}%
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Per-Category Results */}
      {result && ["strong_systemic", "pure_local", "ambiguous_overlap"].map((cat) => {
        const cases = result.results.filter((r) => r.category === cat);
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;
        const allPass = cases.every((c) => cat === "ambiguous_overlap" ? c.top3_match : c.top1_match);

        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className={`h-4 w-4 ${meta.color}`} />
                {meta.label}
                <span className="text-xs text-muted-foreground font-normal">({cases.length} cases)</span>
                {allPass
                  ? <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px] ml-auto">ALL PASS</Badge>
                  : <Badge variant="destructive" className="text-[9px] ml-auto">FAILURES</Badge>
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-48">Case</TableHead>
                    <TableHead className="text-xs w-16">Status</TableHead>
                    <TableHead className="text-xs">Top-1</TableHead>
                    <TableHead className="text-xs w-14">Prob</TableHead>
                    <TableHead className="text-xs w-14">GT Rank</TableHead>
                    <TableHead className="text-xs w-14">SysSev</TableHead>
                    <TableHead className="text-xs w-14">V3/V1</TableHead>
                    <TableHead className="text-xs">Explanation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((c) => {
                    const pass = cat === "ambiguous_overlap" ? c.top3_match : c.top1_match;
                    return (
                      <TableRow key={c.case_id} className={!pass ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs font-medium">{c.case_name}</TableCell>
                        <TableCell>
                          {pass
                            ? <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" />PASS</Badge>
                            : <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-1" />FAIL</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-xs">{c.top3[0]?.diagnosis ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{c.top3[0] ? `${(c.top3[0].probability * 100).toFixed(1)}%` : "—"}</TableCell>
                        <TableCell className="text-xs font-mono text-center">
                          {c.ground_truth_rank ? `#${c.ground_truth_rank}` : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{c.systemic_severity.toFixed(2)}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {c.v3_state_contribution_top1.toFixed(2)}/{c.v1_symptom_contribution_top1.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-[250px] truncate">
                          {c.explanation}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean }) {
  return (
    <Card className={ok ? "border-emerald-500/30" : "border-destructive/30"}>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold ${ok ? "text-emerald-600" : "text-destructive"}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground">Target: {target}</p>
      </CardContent>
    </Card>
  );
}

function DiagnosticCard({ label, count, ok, detail }: { label: string; count: number; ok: boolean; detail: string }) {
  return (
    <Card className={ok ? "border-emerald-500/20" : "border-destructive/30"}>
      <CardContent className="p-3 flex items-start gap-2">
        {ok ? <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />}
        <div>
          <p className="text-xs font-medium">{label}: <span className={ok ? "text-emerald-600" : "text-destructive"}>{count}</span></p>
          <p className="text-[10px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
