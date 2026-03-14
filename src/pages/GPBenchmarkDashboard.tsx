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
  FlaskConical, ArrowDown, ArrowRight,
} from "lucide-react";
import { runControlledBenchmark, CONTROLLED_SCENARIO } from "@/services/benchmark_v9";
import type { BenchmarkResult } from "@/services/benchmark_v9/types";
import { runPipelineValidation, type MultiValidationResult } from "@/services/pipeline_validation/runner";
import SEO from "@/components/SEO";

// ── Metric Card ──

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

// ── Stage Status Icon ──

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
    : <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

// ── Pipeline Validation Panel (kept as-is) ──

function ValidationPanel() {
  const [multiResult, setMultiResult] = useState<MultiValidationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);

  const runValidation = useCallback(async () => {
    setRunning(true);
    setMultiResult(null);
    try {
      const r = await runPipelineValidation((stage) => setCurrentStage(stage));
      setMultiResult(r);
    } finally {
      setRunning(false);
      setCurrentStage(null);
    }
  }, []);

  const statusIcon = (s: string) => {
    if (s === "success" || s === "pass") return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
    if (s === "error" || s === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-primary" />
                Pipeline Validation — 5 Controlled Scenarios
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Gastroenteritis · Appendicitis · Pneumonia · UTI · Migraine
              </p>
            </div>
            <Button size="sm" onClick={runValidation} disabled={running}>
              {running ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />{currentStage || "Running..."}</> : <><Play className="h-3.5 w-3.5 mr-1" /> Run All</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {multiResult && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Passed" value={`${multiResult.summary.passed}/${multiResult.summary.total}`} icon={CheckCircle} variant={multiResult.summary.passed === multiResult.summary.total ? "success" : "warning"} />
            <MetricCard label="Top-1 Accuracy" value={`${Math.round(multiResult.summary.top1_accuracy * 100)}%`} icon={Target} variant={multiResult.summary.top1_accuracy >= 0.66 ? "success" : "warning"} />
            <MetricCard label="Physiology Rate" value={`${Math.round(multiResult.summary.physiology_activation_rate * 100)}%`} icon={Activity} variant={multiResult.summary.physiology_activation_rate >= 0.66 ? "success" : "warning"} />
            <MetricCard label="Avg Latency" value={`${(multiResult.summary.avg_latency_ms / 1000).toFixed(1)}s`} detail="Target: <3s" icon={Clock} variant={multiResult.summary.avg_latency_ms < 3000 ? "success" : "warning"} />
            <MetricCard label="Failed" value={`${multiResult.summary.failed}`} icon={XCircle} variant={multiResult.summary.failed === 0 ? "success" : "danger"} />
          </div>

          {multiResult.scenarios.map((result) => (
            <Card key={result.scenario_id} className={result.overall_status === "pass" ? "border-emerald-300 dark:border-emerald-700" : result.overall_status === "partial" ? "border-amber-300 dark:border-amber-700" : "border-destructive/50"}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedScenario(expandedScenario === result.scenario_id ? null : result.scenario_id)}>
                <CardTitle className="text-sm flex items-center gap-2">
                  {statusIcon(result.overall_status)}
                  {result.scenario_name}
                  <Badge variant="outline" className="text-[9px] ml-auto">{(result.total_latency_ms / 1000).toFixed(2)}s</Badge>
                  <div className="flex gap-1">
                    {Object.entries(result.criteria).map(([key, val]) => (
                      <div key={key} title={key.replace(/_/g, " ")} className={val ? "text-emerald-600" : "text-destructive"}>
                        {val ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      </div>
                    ))}
                  </div>
                  {expandedScenario === result.scenario_id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>

              {expandedScenario === result.scenario_id && (
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Input Symptoms</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {result.trace.input_symptoms.map((s, i) => <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>)}
                    </div>
                    {result.trace.physiology_states.length > 0 ? (
                      <div className="space-y-0.5">
                        {result.trace.physiology_states.slice(0, 6).map((ps, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Badge className="bg-primary/10 text-primary text-[9px]">{ps.state}</Badge>
                            <span className="text-muted-foreground">{ps.system}</span>
                            <span className="font-mono text-muted-foreground">{(ps.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-muted-foreground italic">No physiology activated</p>}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground"><ArrowDown className="h-3 w-3" /><span className="text-[10px]">Final Ranking</span></div>
                  <div className="space-y-0.5">
                    {result.trace.final_ranking.slice(0, 5).map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono">
                        <span className="w-6 text-right text-muted-foreground">#{d.rank}</span>
                        <span>{d.diagnosis}</span>
                        {d.probability > 0 && <span className="text-muted-foreground">({(d.probability * 100).toFixed(1)}%)</span>}
                      </div>
                    ))}
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-xs">Stage</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs text-right">Latency</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {result.stages.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{s.stage}</TableCell>
                          <TableCell className="text-center">{statusIcon(s.status)}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{s.latency_ms}ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {result.knowledge_gaps.length > 0 && (
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-amber-600">Knowledge Gaps:</p>
                      {result.knowledge_gaps.map((gap, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px]">{gap.type}</Badge>
                          <span>{gap.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </>
      )}

      {!multiResult && !running && (
        <Card>
          <CardContent className="py-10 text-center">
            <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <h3 className="text-sm font-medium">Pipeline Validation</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Run 5 controlled scenarios through the full reasoning pipeline to verify architecture correctness.
            </p>
            <Button size="sm" className="mt-3" onClick={runValidation}><Play className="h-3.5 w-3.5 mr-1" /> Run All Scenarios</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Benchmark Result Viewer ──

function BenchmarkResultView({ result }: { result: BenchmarkResult }) {
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const m = result.metrics;

  const toggle = (stage: string) => setExpandedStage(expandedStage === stage ? null : stage);

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <Card className={result.passed ? "border-emerald-300 dark:border-emerald-700" : "border-destructive/50"}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {result.passed ? <CheckCircle className="h-6 w-6 text-emerald-600" /> : <XCircle className="h-6 w-6 text-destructive" />}
            <div>
              <p className="text-lg font-bold">{result.passed ? "PASS" : "FAIL"} — {result.scenario_name}</p>
              <p className="text-xs text-muted-foreground">{new Date(result.timestamp).toLocaleString()} · {(m.total_latency_ms / 1000).toFixed(2)}s</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Candidate Recall" value={m.candidate_recall ? "✓" : "✗"} icon={Target} variant={m.candidate_recall ? "success" : "danger"} detail="Gold in candidates?" />
        <MetricCard label="Top-1 Match" value={m.top1_accuracy ? "✓" : "✗"} icon={Target} variant={m.top1_accuracy ? "success" : m.top3_accuracy ? "warning" : "danger"} detail={result.final_ranking.gold_rank ? `Ranked #${result.final_ranking.gold_rank}` : "Not ranked"} />
        <MetricCard label="Safety" value={m.safety_correct ? "Correct" : "Wrong"} icon={Shield} variant={m.safety_correct ? "success" : "danger"} />
        <MetricCard label="Latency" value={`${(m.total_latency_ms / 1000).toFixed(1)}s`} icon={Clock} variant={m.total_latency_ms <= 3000 ? "success" : m.latency_under_5s ? "warning" : "danger"} detail="Target: ≤3s (optimized)" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Physiology" value={m.physiology_activated ? "Active" : "Inactive"} icon={Brain} variant={m.physiology_activated ? "success" : "danger"} />
        <MetricCard label="Normalization" value={m.normalization_applied ? "Applied" : "None"} icon={Activity} variant={m.normalization_applied ? "success" : "warning"} />
        <MetricCard label="SOAP" value={m.soap_generated ? "Generated" : "Missing"} icon={Zap} variant={m.soap_generated ? "success" : "warning"} />
        <MetricCard label="Cognitive Quality" value={`${result.cognitive_pruning.quality_score.toFixed(0)}`} icon={Brain} variant={result.cognitive_pruning.quality_score >= 50 ? "success" : "warning"} detail="/100" />
      </div>

      {/* Per-Stage Trace */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pipeline Stage Trace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {/* Stage 1: Normalization */}
          <StageRow
            name="1. Input Normalization"
            ok={result.normalization.normalized_tokens.length > 0}
            latency={result.stage_latencies.find(s => s.stage === "Input Normalization")?.latency_ms || 0}
            expanded={expandedStage === "norm"}
            onToggle={() => toggle("norm")}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {result.normalization.mappings.map((m, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px]">
                    <Badge variant="outline" className="text-[9px]">{m.original}</Badge>
                    {m.changed && <><ArrowRight className="h-2.5 w-2.5 text-primary" /><Badge className="bg-primary/10 text-primary text-[9px]">{m.canonical}</Badge></>}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Expected match: {(result.normalization.expected_match_rate * 100).toFixed(0)}%
              </p>
            </div>
          </StageRow>

          {/* Stage 2: Physiology */}
          <StageRow
            name="2. Physiology Inference"
            ok={result.physiology.states_activated.length > 0}
            latency={result.stage_latencies.find(s => s.stage === "Physiology Inference")?.latency_ms || 0}
            expanded={expandedStage === "physio"}
            onToggle={() => toggle("physio")}
          >
            <div className="space-y-2">
              {result.physiology.states_activated.length > 0 ? (
                <div className="space-y-1">
                  {result.physiology.states_activated.slice(0, 8).map((ps, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge className="bg-primary/10 text-primary text-[9px]">{ps.state}</Badge>
                      <span className="text-muted-foreground">{ps.system}</span>
                      <span className="font-mono text-muted-foreground">{(ps.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground italic">No physiology states activated</p>}
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>Organ systems: {result.physiology.affected_organ_systems.join(", ") || "—"}</span>
                <span>· Candidates from physiology: {result.physiology.candidate_diagnosis_ids.length}</span>
              </div>
            </div>
          </StageRow>

          {/* Stage 3: Candidate Generation */}
          <StageRow
            name="3. Candidate Generation (DDX)"
            ok={result.candidate_generation.gold_in_candidates}
            latency={result.stage_latencies.find(s => s.stage === "Candidate Generation (DDX)")?.latency_ms || 0}
            expanded={expandedStage === "ddx"}
            onToggle={() => toggle("ddx")}
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {result.candidate_generation.candidates.slice(0, 10).map((c, i) => (
                  <Badge key={i} variant={i === 0 ? "default" : "outline"} className="text-[9px]">
                    {c.name} ({c.probability > 1 ? c.probability : (c.probability * 100).toFixed(1)}%)
                    {c.must_not_miss && " ⚠"}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {result.candidate_generation.candidate_count} candidates ·
                Gold {result.candidate_generation.gold_in_candidates
                  ? `found at rank #${result.candidate_generation.gold_candidate_rank} (${(result.candidate_generation.gold_candidate_probability || 0) > 1 ? (result.candidate_generation.gold_candidate_probability || 0) : ((result.candidate_generation.gold_candidate_probability || 0) * 100).toFixed(1)}%)`
                  : "NOT FOUND ✗"}
              </p>
            </div>
          </StageRow>

          {/* Stage 4: Bayesian Ranking */}
          <StageRow
            name="4. Bayesian Ranking"
            ok={result.bayesian.ranked_diagnoses.length > 0}
            latency={result.stage_latencies.find(s => s.stage === "Bayesian Ranking")?.latency_ms || 0}
            expanded={expandedStage === "bayes"}
            onToggle={() => toggle("bayes")}
          >
            <div className="space-y-1">
              {result.bayesian.ranked_diagnoses.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-right font-mono text-muted-foreground">#{i + 1}</span>
                  <span className="w-48 truncate">{d.diagnosis}</span>
                  <Progress value={d.probability > 1 ? d.probability : d.probability * 100} className="flex-1 h-2" />
                  <span className="w-14 text-right font-mono text-muted-foreground">{d.probability > 1 ? d.probability.toFixed(1) : (d.probability * 100).toFixed(1)}%</span>
                </div>
              ))}
              {result.bayesian.gold_rank_after_bayesian && (
                <p className="text-[10px] text-muted-foreground">Gold rank after Bayesian: #{result.bayesian.gold_rank_after_bayesian}</p>
              )}
            </div>
          </StageRow>

          {/* Stage 5: Cognitive Pruning */}
          <StageRow
            name="5. Cognitive Pruning"
            ok={!result.cognitive_pruning.gold_pruned}
            latency={result.stage_latencies.find(s => s.stage === "Cognitive Pruning")?.latency_ms || 0}
            expanded={expandedStage === "cog"}
            onToggle={() => toggle("cog")}
          >
            <div className="space-y-2">
              <div className="flex gap-4 text-xs">
                <span>Kept: <span className="font-bold text-emerald-600">{result.cognitive_pruning.kept}</span></span>
                <span>Pruned: <span className="font-bold text-destructive">{result.cognitive_pruning.pruned}</span></span>
                <span>Escalated: <span className="font-bold text-amber-600">{result.cognitive_pruning.escalated}</span></span>
              </div>
              {result.cognitive_pruning.pruned_names.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {result.cognitive_pruning.pruned_names.map((n, i) => <Badge key={i} variant="destructive" className="text-[9px]">{n}</Badge>)}
                </div>
              )}
              {result.cognitive_pruning.gold_pruned && (
                <p className="text-xs text-destructive font-medium">⚠ Gold diagnosis was incorrectly pruned!</p>
              )}
            </div>
          </StageRow>

          {/* Stage 6: Safety */}
          <StageRow
            name="6. Safety Evaluation"
            ok={result.safety.correct}
            latency={result.stage_latencies.find(s => s.stage === "Safety Evaluation")?.latency_ms || 0}
            expanded={expandedStage === "safety"}
            onToggle={() => toggle("safety")}
          >
            <div className="space-y-2 text-xs">
              <div className="flex gap-4">
                <span>Expected danger: {result.safety.expected_danger ? "Yes" : "No"}</span>
                <span>Detected: {result.safety.danger_detected ? "Yes" : "No"}</span>
                <span>Score: {result.safety.safety_score}</span>
              </div>
              <div className="text-muted-foreground">{result.safety.detection_details}</div>
              {result.safety.dangerous_diagnoses.length > 0 && (
                <div>Dangerous Dx detected: {result.safety.dangerous_diagnoses.join(", ")}</div>
              )}
              {result.safety.expected_dangerous_diagnoses.length > 0 && (
                <div>Expected dangerous Dx: {result.safety.expected_dangerous_diagnoses.join(", ")}</div>
              )}
              {result.safety.dangerous_diagnoses_in_candidates.length > 0 && (
                <div className="text-emerald-600">In candidates: {result.safety.dangerous_diagnoses_in_candidates.join(", ")}</div>
              )}
            </div>
          </StageRow>

          {/* Stage 7: Final Ranking */}
          <StageRow
            name="7. Final Ranked Diagnoses"
            ok={result.final_ranking.top3_match}
            latency={0}
            expanded={expandedStage === "final"}
            onToggle={() => toggle("final")}
          >
            <div className="space-y-1">
              {result.final_ranking.ranking.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-6 text-right text-muted-foreground">#{d.rank}</span>
                  <span className={d.rank === result.final_ranking.gold_rank ? "font-bold text-emerald-600" : ""}>{d.diagnosis}</span>
                  <span className="text-muted-foreground">({d.probability > 1 ? d.probability : (d.probability * 100).toFixed(1)}%)</span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground mt-1">
                Gold rank: {result.final_ranking.gold_rank ? `#${result.final_ranking.gold_rank}` : "Not in top 10"} ·
                Top-1: {result.final_ranking.top1_match ? "✓" : "✗"} ·
                Top-3: {result.final_ranking.top3_match ? "✓" : "✗"} ·
                Top-5: {result.final_ranking.top5_match ? "✓" : "✗"}
              </p>
            </div>
          </StageRow>
        </CardContent>
      </Card>

      {/* Stage Latency Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Stage Latencies</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Stage</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-right">Latency</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {result.stage_latencies.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">{s.stage}</TableCell>
                  <TableCell className="text-center"><StatusIcon ok={s.status === "success"} /></TableCell>
                  <TableCell className="text-xs text-right font-mono">{s.latency_ms}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Failures & Recommendations */}
      {(result.failure_reasons.length > 0 || result.recommendations.length > 0) && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-amber-600" /> Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.failure_reasons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-destructive mb-1">Failures</p>
                {result.failure_reasons.map((f, i) => <p key={i} className="text-xs text-muted-foreground">• {f}</p>)}
              </div>
            )}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1">Recommendations</p>
                {result.recommendations.map((r, i) => <p key={i} className="text-xs text-muted-foreground">• {r}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
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

// ── Main Dashboard ──

export default function GPBenchmarkDashboard() {
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [running, setRunning] = useState(false);

  const runBenchmark = useCallback(async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await runControlledBenchmark();
      setResult(r);
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <SEO title="Clinical Reasoning Benchmark" description="Controlled scenario pipeline validation" />

      <Tabs defaultValue="benchmark">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Clinical Reasoning Validation</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Controlled scenario benchmark & pipeline validation</p>
          </div>
          <TabsList>
            <TabsTrigger value="benchmark"><Target className="h-3.5 w-3.5 mr-1" /> Benchmark</TabsTrigger>
            <TabsTrigger value="validation"><FlaskConical className="h-3.5 w-3.5 mr-1" /> Pipeline Validation</TabsTrigger>
          </TabsList>
        </div>

        {/* Benchmark Tab */}
        <TabsContent value="benchmark">
          <div className="space-y-4">
            {/* Scenario Info + Run Button */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold flex items-center gap-1.5">
                      <Target className="h-4 w-4 text-primary" />
                      Controlled Scenario: {CONTROLLED_SCENARIO.name}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">{CONTROLLED_SCENARIO.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {CONTROLLED_SCENARIO.context.symptoms.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" onClick={runBenchmark} disabled={running}>
                    {running ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Running...</> : <><Play className="h-3.5 w-3.5 mr-1" /> Run Benchmark</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {result && <BenchmarkResultView result={result} />}

            {!result && !running && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-sm font-medium">No benchmark results</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Run the controlled scenario to validate all 7 pipeline stages with a textbook pneumonia case.
                  </p>
                  <Button size="sm" className="mt-3" onClick={runBenchmark}><Play className="h-3.5 w-3.5 mr-1" /> Run Benchmark</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Pipeline Validation Tab */}
        <TabsContent value="validation">
          <ValidationPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
