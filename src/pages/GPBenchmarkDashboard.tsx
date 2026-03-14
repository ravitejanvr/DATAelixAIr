import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Play, Loader2, CheckCircle, XCircle, AlertTriangle, Clock, Brain,
  Activity, Shield, ChevronDown, ChevronUp, Zap, Target, ArrowRight,
} from "lucide-react";
import { runBenchmarkSuite, BENCHMARK_SUITE } from "@/services/benchmark_v9";
import type { BenchmarkResult, BenchmarkSuiteResult } from "@/services/benchmark_v9/types";
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
      {/* Normalization */}
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

      {/* Physiology */}
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

      {/* DDX */}
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

      {/* Bayesian */}
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

      {/* Cognitive */}
      <StageRow name="5. Cognitive Pruning" ok={!result.cognitive_pruning.gold_pruned} latency={result.stage_latencies.find(s => s.stage === "Cognitive Pruning")?.latency_ms || 0} expanded={expandedStage === "cog"} onToggle={() => toggle("cog")}>
        <div className="flex gap-4 text-xs">
          <span>Kept: <span className="font-bold text-emerald-600">{result.cognitive_pruning.kept}</span></span>
          <span>Pruned: <span className="font-bold text-destructive">{result.cognitive_pruning.pruned}</span></span>
          <span>Escalated: <span className="font-bold text-amber-600">{result.cognitive_pruning.escalated}</span></span>
        </div>
      </StageRow>

      {/* Safety */}
      <StageRow name="6. Safety" ok={result.safety.correct} latency={0} expanded={expandedStage === "safety"} onToggle={() => toggle("safety")}>
        <div className="space-y-1 text-xs">
          <div className="flex gap-4">
            <span>Expected: {result.safety.expected_danger ? "Yes" : "No"}</span>
            <span>Detected: {result.safety.danger_detected ? "Yes" : "No"}</span>
          </div>
          <div className="text-muted-foreground">{result.safety.detection_details}</div>
          {result.safety.dangerous_diagnoses.length > 0 && <div>Flagged: {result.safety.dangerous_diagnoses.join(", ")}</div>}
        </div>
      </StageRow>

      {/* Final */}
      <StageRow name="7. Final Ranking" ok={result.final_ranking.top3_match} latency={0} expanded={expandedStage === "final"} onToggle={() => toggle("final")}>
        <div className="space-y-1">
          {result.final_ranking.ranking.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className="w-6 text-right text-muted-foreground">#{d.rank}</span>
              <span className={d.rank === result.final_ranking.gold_rank ? "font-bold text-emerald-600" : ""}>{d.diagnosis}</span>
              <span className="text-muted-foreground">({probDisplay(d.probability)}%)</span>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-1">
            Ranking source: <span className="font-semibold">{result.final_ranking.ranking_source}</span> ·
            Gold: {result.final_ranking.gold_rank ? `#${result.final_ranking.gold_rank}` : "Not in top 10"} ·
            Top-1: {result.final_ranking.top1_match ? "✓" : "✗"} ·
            Top-3: {result.final_ranking.top3_match ? "✓" : "✗"} ·
            Top-5: {result.final_ranking.top5_match ? "✓" : "✗"}
          </p>
        </div>
      </StageRow>

      {/* Failures */}
      {result.failure_reasons.length > 0 && (
        <div className="px-3 py-2 bg-destructive/5 rounded text-xs">
          <p className="font-medium text-destructive mb-1">Failures</p>
          {result.failure_reasons.map((f, i) => <p key={i} className="text-muted-foreground">• {f}</p>)}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──

export default function GPBenchmarkDashboard() {
  const [suiteResult, setSuiteResult] = useState<BenchmarkSuiteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    setSuiteResult(null);
    setExpandedScenario(null);
    try {
      const result = await runBenchmarkSuite((name, idx, total) => {
        setProgress(`${idx + 1}/${total}: ${name}`);
      });
      setSuiteResult(result);
    } finally {
      setRunning(false);
      setProgress("");
    }
  }, []);

  const sr = suiteResult;

  return (
    <div className="space-y-6">
      <SEO title="Clinical Reasoning Benchmark" description="10-scenario diagnostic engine validation" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Clinical Reasoning Benchmark</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            10 controlled scenarios · Core diagnostic pipeline validation
          </p>
        </div>
        <Button size="sm" onClick={runBenchmark} disabled={running}>
          {running
            ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{progress || "Running..."}</>
            : <><Play className="h-3.5 w-3.5 mr-1" /> Run All 10 Scenarios</>
          }
        </Button>
      </div>

      {/* Scenario List (pre-run) */}
      {!sr && !running && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary" /> Benchmark Suite — 10 Scenarios
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
              <Button size="sm" onClick={runBenchmark}><Play className="h-3.5 w-3.5 mr-1" /> Run Benchmark</Button>
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
            <p className="text-xs text-muted-foreground mt-1">Running 10 scenarios through the diagnostic pipeline</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {sr && (
        <>
          {/* Aggregate Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard
              label="Top-1 Accuracy"
              value={pct(sr.top1_accuracy)}
              icon={Target}
              variant={sr.top1_accuracy >= 60 ? "success" : sr.top1_accuracy >= 40 ? "warning" : "danger"}
              detail="Target: ≥60%"
            />
            <MetricCard
              label="Top-3 Accuracy"
              value={pct(sr.top3_accuracy)}
              icon={Target}
              variant={sr.top3_accuracy >= 80 ? "success" : sr.top3_accuracy >= 60 ? "warning" : "danger"}
              detail="Target: ≥80%"
            />
            <MetricCard
              label="Candidate Recall"
              value={pct(sr.candidate_recall)}
              icon={Brain}
              variant={sr.candidate_recall >= 90 ? "success" : sr.candidate_recall >= 70 ? "warning" : "danger"}
              detail="Target: ≥90%"
            />
            <MetricCard
              label="Safety Detection"
              value={pct(sr.safety_detection_rate)}
              icon={Shield}
              variant={sr.safety_detection_rate === 100 ? "success" : "danger"}
              detail="Target: 100%"
            />
            <MetricCard
              label="Avg Latency"
              value={`${(sr.avg_latency_ms / 1000).toFixed(1)}s`}
              icon={Clock}
              variant={sr.avg_latency_ms <= 5000 ? "success" : "warning"}
              detail={`Min: ${(sr.min_latency_ms / 1000).toFixed(1)}s · Max: ${(sr.max_latency_ms / 1000).toFixed(1)}s`}
            />
          </div>

          {/* Pass/Fail summary */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Passed" value={`${sr.passed}/${sr.total_scenarios}`} icon={CheckCircle} variant={sr.passed === sr.total_scenarios ? "success" : "warning"} />
            <MetricCard label="Failed" value={`${sr.failed}`} icon={XCircle} variant={sr.failed === 0 ? "success" : "danger"} />
            <MetricCard label="Top-5 Accuracy" value={pct(sr.top5_accuracy)} icon={Activity} variant={sr.top5_accuracy >= 85 ? "success" : "warning"} detail="Target: ≥85%" />
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
                          <Badge variant="outline" className="text-[9px]">
                            Gold #{r.final_ranking.gold_rank}
                          </Badge>
                        )}
                        {!r.metrics.candidate_recall && (
                          <Badge variant="destructive" className="text-[9px]">No Recall</Badge>
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
  );
}
