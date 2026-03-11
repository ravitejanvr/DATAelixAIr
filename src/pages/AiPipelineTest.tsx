import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, FlaskConical, BarChart3, ShieldCheck, CheckCircle2, XCircle, Clock, ListChecks, Trophy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_CONTEXT = {
  age: 35,
  gender: "male",
  symptoms: ["fever", "headache", "body ache"],
  duration: "2 days",
  vitals: { temperature: 101, bp: "120/80", pulse: 88, spo2: 98 },
  allergies: ["penicillin"],
  conditions: ["hypertension"],
  current_medications: ["telmisartan"],
};

const BENCHMARK_TESTS = [
  {
    name: "Viral Fever",
    context: {
      age: 32, gender: "male",
      symptoms: ["fever", "body ache", "headache"],
      duration: "2 days",
      vitals: { temperature: 101, bp: "118/78", pulse: 92, spo2: 98 },
      allergies: [], conditions: [], current_medications: [],
    },
  },
  {
    name: "Gastroenteritis",
    context: {
      age: 24, gender: "female",
      symptoms: ["vomiting", "diarrhea", "abdominal pain"],
      duration: "1 day",
      vitals: { temperature: 99, bp: "110/70", pulse: 96, spo2: 99 },
      allergies: [], conditions: [], current_medications: [],
    },
  },
  {
    name: "Respiratory Infection",
    context: {
      age: 45, gender: "male",
      symptoms: ["fever", "cough", "breathlessness"],
      duration: "3 days",
      vitals: { temperature: 100, bp: "122/80", pulse: 100, spo2: 94 },
      allergies: [], conditions: ["smoker"], current_medications: [],
    },
  },
  {
    name: "Chest Pain Emergency",
    context: {
      age: 65, gender: "male",
      symptoms: ["chest pain", "breathlessness", "sweating"],
      duration: "1 hour",
      vitals: { bp: "150/95", pulse: 110, spo2: 93 },
      allergies: [], conditions: ["diabetes", "hypertension"],
      current_medications: ["metformin", "amlodipine"],
    },
  },
  {
    name: "Drug Allergy Conflict",
    context: {
      age: 40, gender: "female",
      symptoms: ["sore throat", "fever"],
      duration: "3 days",
      vitals: { temperature: 100, bp: "118/74", pulse: 88, spo2: 98 },
      allergies: ["penicillin"],
      conditions: [], current_medications: [],
    },
  },
];

interface BenchmarkResult {
  name: string;
  result: any;
  error?: string;
}

export default function AiPipelineTest() {
  const [input, setInput] = useState(JSON.stringify(DEFAULT_CONTEXT, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [benchmarkSummary, setBenchmarkSummary] = useState<any>(null);

  // V3 Benchmark Suite
  const [v3Loading, setV3Loading] = useState(false);
  const [v3Results, setV3Results] = useState<any>(null);
  const [v3Progress, setV3Progress] = useState(0);

  const runV3Benchmark = async () => {
    setV3Loading(true);
    setV3Results(null);
    setV3Progress(10);
    try {
      const { data, error } = await supabase.functions.invoke("run-clinical-benchmark-suite", {
        body: { benchmark_version: "benchmark_v4_full_reasoning" },
      });
      if (error) throw error;
      setV3Results(data);
      setV3Progress(100);
      toast.success(`Benchmark v3 complete: ${data.summary?.passed}/${data.summary?.total_tests} passed`);
    } catch (e: any) {
      toast.error(e.message || "Benchmark failed");
    } finally {
      setV3Loading(false);
    }
  };

  const runComparison = async () => {
    setLoading(true);
    setResult(null);
    try {
      const parsed = JSON.parse(input);
      const { data, error } = await supabase.functions.invoke("compare-ai-pipelines", {
        body: { patient_context: parsed },
      });
      if (error) throw error;
      setResult(data);
      toast.success("Pipeline comparison complete");
    } catch (e: any) {
      toast.error(e.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const runBenchmarks = async () => {
    setBenchmarkLoading(true);
    setBenchmarkResults([]);
    setBenchmarkSummary(null);
    setBenchmarkProgress(0);

    const results: BenchmarkResult[] = [];

    for (let i = 0; i < BENCHMARK_TESTS.length; i++) {
      const test = BENCHMARK_TESTS[i];
      setBenchmarkProgress(((i) / BENCHMARK_TESTS.length) * 100);
      try {
        const { data, error } = await supabase.functions.invoke("compare-ai-pipelines", {
          body: { patient_context: test.context },
        });
        if (error) throw error;
        results.push({ name: test.name, result: data });
      } catch (e: any) {
        results.push({ name: test.name, result: null, error: e.message || "Failed" });
      }
      setBenchmarkResults([...results]);
    }

    setBenchmarkProgress(100);

    // Compute summary
    const successful = results.filter(r => r.result);
    if (successful.length > 0) {
      const legacyLatencies = successful.map(r => r.result.legacy_pipeline?.latency_ms || 0);
      const modularLatencies = successful.map(r => r.result.modular_pipeline?.latency_ms || 0);
      const diagOverlaps = successful.map(r => r.result.comparison?.diagnosis_overlap || 0);
      const labOverlaps = successful.map(r => r.result.comparison?.lab_overlap || 0);
      const medOverlaps = successful.map(r => r.result.comparison?.medication_overlap || 0);
      const guidelineCounts = successful.map(r => r.result.modular_pipeline?.guidelines?.length || 0);
      const safetyAlerts = successful.map(r => r.result.modular_pipeline?.safety_flags?.length || 0);
      const confidenceScores = successful.map(r => r.result.modular_pipeline?.uncertainty?.confidence_score ?? null).filter((v: any) => v !== null);
      const confidenceLabels = successful.map(r => r.result.modular_pipeline?.uncertainty?.confidence_label || "N/A");

      const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      const avgFloat = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

      setBenchmarkSummary({
        total_tests: BENCHMARK_TESTS.length,
        successful: successful.length,
        failed: results.filter(r => r.error).length,
        legacy_pipeline: { avg_latency_ms: avg(legacyLatencies) },
        modular_pipeline: {
          avg_latency_ms: avg(modularLatencies),
          avg_guideline_citations: avg(guidelineCounts),
          avg_safety_alerts: avg(safetyAlerts),
          avg_confidence_score: avgFloat(confidenceScores as number[]),
          confidence_labels: confidenceLabels,
        },
        diagnosis_agreement_rate: avg(diagOverlaps),
        lab_agreement_rate: avg(labOverlaps),
        medication_agreement_rate: avg(medOverlaps),
      });
    }

    setBenchmarkLoading(false);
    toast.success(`Benchmark complete: ${successful.length}/${BENCHMARK_TESTS.length} tests passed`);
  };

  const comp = result?.comparison;

  return (
    <PlatformAdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">AI Pipeline Comparison Test Harness</h1>
          <Badge variant="outline" className="ml-2">Developer Tool</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Run both legacy and modular pipelines with identical inputs to compare outputs. Does NOT modify production workflows.
        </p>

        <Tabs defaultValue="single" className="w-full">
          <TabsList>
            <TabsTrigger value="single"><Play className="h-3 w-3 mr-1" /> Single Test</TabsTrigger>
            <TabsTrigger value="benchmark"><ListChecks className="h-3 w-3 mr-1" /> Legacy Benchmark (5)</TabsTrigger>
            <TabsTrigger value="v3"><Trophy className="h-3 w-3 mr-1" /> Clinical Benchmark v3 (8)</TabsTrigger>
          </TabsList>

          {/* ─── Single Test Tab ─── */}
          <TabsContent value="single" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader><CardTitle className="text-sm">Patient Context (JSON)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={input} onChange={(e) => setInput(e.target.value)} className="font-mono text-xs min-h-[350px]" />
                  <Button onClick={runComparison} disabled={loading} className="w-full">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {loading ? "Running both pipelines..." : "Run Comparison"}
                  </Button>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-4">
                {comp && <ComparisonMetrics comp={comp} />}
                {result && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PipelineCard title="Legacy Pipeline" data={result.legacy_pipeline} variant="legacy" />
                    <PipelineCard title="Modular Pipeline" data={result.modular_pipeline} variant="modular" />
                  </div>
                )}
                {result?.module_execution_logs?.length > 0 && <ModuleLogsCard logs={result.module_execution_logs} />}
                {!result && !loading && <EmptyState />}
              </div>
            </div>
          </TabsContent>

          {/* ─── Benchmark Tab ─── */}
          <TabsContent value="benchmark" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListChecks className="h-4 w-4" /> Structured Benchmark Suite
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                  {BENCHMARK_TESTS.map((t, i) => {
                    const br = benchmarkResults[i];
                    return (
                      <div key={i} className="p-2 rounded border text-xs space-y-1">
                        <div className="font-semibold flex items-center gap-1">
                          {br ? (
                            br.error ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : benchmarkLoading && i === benchmarkResults.length ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border" />
                          )}
                          {t.name}
                        </div>
                        <div className="text-muted-foreground">
                          {t.context.symptoms.join(", ")}
                        </div>
                        {br?.result && (
                          <Badge variant="secondary" className="text-[9px]">
                            {br.result.comparison?.diagnosis_overlap}% dx match
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>

                {benchmarkLoading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Running test {benchmarkResults.length + 1} of {BENCHMARK_TESTS.length}...</span>
                      <span>{Math.round(benchmarkProgress)}%</span>
                    </div>
                    <Progress value={benchmarkProgress} className="h-2" />
                  </div>
                )}

                <Button onClick={runBenchmarks} disabled={benchmarkLoading} className="w-full">
                  {benchmarkLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  {benchmarkLoading ? `Running test ${benchmarkResults.length + 1}/${BENCHMARK_TESTS.length}...` : "Run All 5 Benchmark Tests"}
                </Button>
              </CardContent>
            </Card>

            {/* Aggregate Summary */}
            {benchmarkSummary && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Aggregate Benchmark Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryStatCard label="Tests Run" value={`${benchmarkSummary.successful}/${benchmarkSummary.total_tests}`} />
                    <SummaryStatCard label="Avg Legacy Latency" value={`${benchmarkSummary.legacy_pipeline.avg_latency_ms}ms`} />
                    <SummaryStatCard label="Avg Modular Latency" value={`${benchmarkSummary.modular_pipeline.avg_latency_ms}ms`} />
                    <SummaryStatCard label="Semantic Dx Match" value={`${benchmarkSummary.diagnosis_agreement_rate}%`} highlight />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryStatCard label="Lab Equivalence" value={`${benchmarkSummary.lab_agreement_rate}%`} />
                    <SummaryStatCard label="Med Equivalence" value={`${benchmarkSummary.medication_agreement_rate}%`} />
                    <SummaryStatCard label="Avg Guideline Citations" value={String(benchmarkSummary.modular_pipeline.avg_guideline_citations)} />
                    <SummaryStatCard label="Avg Safety Alerts" value={String(benchmarkSummary.modular_pipeline.avg_safety_alerts)} />
                    <SummaryStatCard label="Avg Confidence" value={String(benchmarkSummary.modular_pipeline.avg_confidence_score)} highlight />
                  </div>
                  <MetricBar label="Semantic Diagnosis Match Rate" value={benchmarkSummary.diagnosis_agreement_rate} />
                  <MetricBar label="Lab Equivalence Match Rate" value={benchmarkSummary.lab_agreement_rate} />
                  <MetricBar label="Medication Equivalence Match Rate" value={benchmarkSummary.medication_agreement_rate} />
                  <MetricBar label="Avg Diagnostic Confidence" value={Math.round(benchmarkSummary.modular_pipeline.avg_confidence_score * 100)} />
                </CardContent>
              </Card>
            )}

            {/* Individual Results */}
            {benchmarkResults.filter(r => r.result).map((br, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Test Case {idx + 1}: {br.name}
                    {br.result?.legacy_pipeline && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">
                        Legacy: {br.result.legacy_pipeline.latency_ms}ms · Modular: {br.result.modular_pipeline.latency_ms}ms
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {br.result?.comparison && <ComparisonMetrics comp={br.result.comparison} />}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PipelineCard title="Legacy" data={br.result.legacy_pipeline} variant="legacy" />
                    <PipelineCard title="Modular" data={br.result.modular_pipeline} variant="modular" />
                  </div>
                  {br.result?.module_execution_logs?.length > 0 && <ModuleLogsCard logs={br.result.module_execution_logs} />}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ─── V3 Clinical Benchmark Tab ─── */}
          <TabsContent value="v3" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Clinical Benchmark Suite v3
                  <Badge variant="outline" className="text-[10px]">8 Test Cases · Full Reasoning Stack</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Evaluates DDX Engine, Knowledge Graph, Guideline Engine, Safety Guardrails, and Uncertainty Calibration across 8 clinical scenarios including edge cases.
                </p>

                {v3Loading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Running full benchmark suite...</span>
                      <span>{Math.round(v3Progress)}%</span>
                    </div>
                    <Progress value={v3Progress} className="h-2" />
                  </div>
                )}

                <Button onClick={runV3Benchmark} disabled={v3Loading} className="w-full">
                  {v3Loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
                  {v3Loading ? "Running 8 test cases..." : "Run Clinical Benchmark v3"}
                </Button>
              </CardContent>
            </Card>

            {/* V3 Summary */}
            {v3Results?.summary && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Benchmark v3 Summary
                    <Badge variant={v3Results.summary.failed === 0 ? "default" : "destructive"} className="ml-auto text-[10px]">
                      {v3Results.summary.passed}/{v3Results.summary.total_tests} Passed
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryStatCard label="Tests Passed" value={`${v3Results.summary.passed}/${v3Results.summary.total_tests}`} highlight={v3Results.summary.failed === 0} />
                    <SummaryStatCard label="Avg Dx Match" value={`${v3Results.summary.avg_diagnosis_agreement}%`} highlight={v3Results.summary.avg_diagnosis_agreement >= 60} />
                    <SummaryStatCard label="Avg Lab Match" value={`${v3Results.summary.avg_lab_agreement}%`} />
                    <SummaryStatCard label="Avg Med Match" value={`${v3Results.summary.avg_medication_agreement}%`} />
                    <SummaryStatCard label="Avg Confidence" value={`${v3Results.summary.avg_confidence_score}`} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryStatCard label="Avg Latency" value={`${v3Results.summary.avg_latency_ms}ms`} />
                    <SummaryStatCard label="Avg DDX Latency" value={`${v3Results.summary.avg_ddx_latency_ms}ms`} />
                    <SummaryStatCard label="Avg Uncertainty Latency" value={`${v3Results.summary.avg_uncertainty_latency_ms}ms`} />
                    <SummaryStatCard label="Avg Guidelines" value={`${v3Results.summary.avg_guideline_citations}`} />
                  </div>
                  <MetricBar label="Diagnosis Agreement" value={v3Results.summary.avg_diagnosis_agreement} />
                  <MetricBar label="Lab Agreement" value={v3Results.summary.avg_lab_agreement} />
                  <MetricBar label="Medication Agreement" value={v3Results.summary.avg_medication_agreement} />
                  <MetricBar label="Confidence Score" value={Math.round(v3Results.summary.avg_confidence_score * 100)} />

                  {/* Pass thresholds */}
                  <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
                    <p className="font-semibold">Pass Criteria:</p>
                    <p>Dx ≥{v3Results.summary.pass_thresholds.diagnosis_agreement}% · Lab ≥{v3Results.summary.pass_thresholds.lab_agreement}% · Med ≥{v3Results.summary.pass_thresholds.medication_agreement}% · Guidelines ≥{v3Results.summary.pass_thresholds.guideline_citations_min}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* V3 Individual Results */}
            {v3Results?.results?.map((r: any, idx: number) => (
              <Card key={idx} className={r.passed ? "" : "border-destructive/30"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {r.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    {r.test_case}
                    <Badge variant="secondary" className="ml-auto text-[10px]">{r.latency_ms}ms</Badge>
                    {r.confidence_label && (
                      <Badge
                        variant={r.confidence_label === "High" ? "default" : r.confidence_label === "Moderate" ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {r.confidence_label} ({r.confidence_score})
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded bg-muted/30">
                      <div className="font-bold font-mono">{r.diagnosis_agreement}%</div>
                      <div className="text-[10px] text-muted-foreground">Dx Match</div>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/30">
                      <div className="font-bold font-mono">{r.lab_agreement}%</div>
                      <div className="text-[10px] text-muted-foreground">Lab Match</div>
                    </div>
                    <div className="text-center p-2 rounded bg-muted/30">
                      <div className="font-bold font-mono">{r.medication_agreement}%</div>
                      <div className="text-[10px] text-muted-foreground">Med Match</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="font-semibold mb-1">Pipeline Diagnoses</p>
                      <div className="flex flex-wrap gap-1">
                        {(r.pipeline_diagnoses || []).map((d: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Expected Diagnoses</p>
                      <div className="flex flex-wrap gap-1">
                        {(r.expected_diagnoses || []).map((d: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[9px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>Guidelines: {r.guideline_citations}</span>
                    <span>Safety Alerts: {r.safety_alerts}</span>
                    {r.ddx_latency_ms !== null && <span>DDX: {r.ddx_latency_ms}ms</span>}
                    {r.uncertainty_latency_ms !== null && <span>Uncertainty: {r.uncertainty_latency_ms}ms</span>}
                  </div>

                  {r.failure_reasons?.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-semibold flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Failure Reasons
                      </p>
                      {r.failure_reasons.map((reason: string, i: number) => (
                        <div key={i} className="text-[10px] text-destructive bg-destructive/5 p-1 rounded">{reason}</div>
                      ))}
                    </div>
                  )}

                  {r.module_logs?.length > 0 && <ModuleLogsCard logs={r.module_logs} />}

                  {r.error && (
                    <div className="p-2 bg-destructive/10 rounded text-destructive text-[10px]">{r.error}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
      </div>
    </PlatformAdminLayout>
  );
}

function SummaryStatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg border text-center ${highlight ? "border-primary/50 bg-primary/5" : "bg-muted/30"}`}>
      <div className={`text-lg font-bold font-mono ${highlight ? "text-primary" : ""}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ComparisonMetrics({ comp }: { comp: any }) {
  const hasSemanticDelta = comp.semantic_diagnosis_delta !== undefined;
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Comparison Metrics
          {hasSemanticDelta && <Badge variant="secondary" className="text-[9px]">Semantic Matching</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricBar label="Semantic Diagnosis Match" value={comp.diagnosis_overlap} />
        {hasSemanticDelta && comp.text_diagnosis_overlap !== undefined && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground -mt-1 ml-1">
            <span>Text-only: {comp.text_diagnosis_overlap}%</span>
            {comp.semantic_diagnosis_delta > 0 && (
              <Badge variant="outline" className="text-[9px] text-green-600">+{comp.semantic_diagnosis_delta}% semantic boost</Badge>
            )}
          </div>
        )}
        <MetricBar label="Lab Equivalence Match" value={comp.lab_overlap} />
        {hasSemanticDelta && comp.text_lab_overlap !== undefined && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground -mt-1 ml-1">
            <span>Text-only: {comp.text_lab_overlap}%</span>
            {comp.semantic_lab_delta > 0 && (
              <Badge variant="outline" className="text-[9px] text-green-600">+{comp.semantic_lab_delta}% semantic boost</Badge>
            )}
          </div>
        )}
        <MetricBar label="Medication Equivalence Match" value={comp.medication_overlap} />
        {hasSemanticDelta && comp.text_medication_overlap !== undefined && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground -mt-1 ml-1">
            <span>Text-only: {comp.text_medication_overlap}%</span>
            {comp.semantic_medication_delta > 0 && (
              <Badge variant="outline" className="text-[9px] text-green-600">+{comp.semantic_medication_delta}% semantic boost</Badge>
            )}
          </div>
        )}
        <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Latency Diff: {comp.latency_difference_ms}ms</span>
          <span>{comp.legacy_faster ? "Legacy faster" : "Modular faster"}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Modules: {comp.modules_executed}/{comp.modules_total} executed</span>
          {comp.modules_failed > 0 && <span className="text-destructive">{comp.modules_failed} failed</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleLogsCard({ logs }: { logs: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" /> Module Execution Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {logs.map((log: any, i: number) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs">
              {log.status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{log.module}</span>
                  <Badge variant="secondary" className="text-[10px]">{log.latency_ms}ms</Badge>
                </div>
                {log.details && <p className="text-muted-foreground mt-0.5 break-words">{log.details}</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="flex items-center justify-center min-h-[300px] text-muted-foreground">
      <div className="text-center space-y-2">
        <FlaskConical className="h-10 w-10 mx-auto opacity-30" />
        <p className="text-sm">Configure patient context and run comparison</p>
      </div>
    </Card>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "text-green-600" : value >= 40 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className={`font-mono font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function PipelineCard({ title, data, variant }: { title: string; data: any; variant: "legacy" | "modular" }) {
  if (!data) return null;
  const borderColor = variant === "modular" ? "border-blue-500/30" : "border-muted";

  return (
    <Card className={borderColor}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <Badge variant="secondary" className="text-[10px]">{data.latency_ms}ms</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {data.error && (
          <div className="p-2 bg-destructive/10 rounded text-destructive text-xs">{data.error}</div>
        )}
        <Section title="Diagnoses" items={data.diagnoses} />
        <Section title="Labs" items={data.labs} />
        <Section title="Medications" items={data.medications} />

        {variant === "modular" && (
          <>
            {/* DDX Engine Results */}
            {data.ddx?.differential_diagnoses?.length > 0 && (
              <div>
                <p className="font-semibold mb-1 flex items-center gap-1">
                  DDX Engine
                  <Badge variant="secondary" className="text-[9px]">{data.ddx.execution_ms}ms</Badge>
                  {data.ddx.dangerous_diagnoses_injected > 0 && (
                    <Badge variant="destructive" className="text-[9px]">{data.ddx.dangerous_diagnoses_injected} must-not-miss</Badge>
                  )}
                </p>
                {data.ddx.differential_diagnoses.map((d: any, i: number) => (
                  <div key={i} className="p-1.5 bg-muted/50 rounded mb-1 flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      {d.must_not_miss && <Badge variant="destructive" className="text-[8px] px-1">⚠</Badge>}
                      {d.diagnosis_name}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{d.probability}%</Badge>
                  </div>
                ))}
                {data.ddx.recommended_labs?.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] text-muted-foreground mb-0.5">DDX Labs:</p>
                    <div className="flex flex-wrap gap-1">
                      {data.ddx.recommended_labs.map((l: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{l.test_name} ({l.priority})</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.ddx.suggested_medications?.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] text-muted-foreground mb-0.5">DDX Meds:</p>
                    <div className="flex flex-wrap gap-1">
                      {data.ddx.suggested_medications.map((m: any, i: number) => (
                        <Badge key={i} variant={m.safe ? "outline" : "destructive"} className="text-[9px]">
                          {m.generic_name} {!m.safe && "(unsafe)"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Uncertainty Engine Results */}
            {data.uncertainty && (
              <div>
                <p className="font-semibold mb-1 flex items-center gap-1">
                  Uncertainty Calibration
                  <Badge variant="secondary" className="text-[9px]">{data.uncertainty.execution_ms}ms</Badge>
                  <Badge
                    variant={data.uncertainty.confidence_label === "High" ? "default" : data.uncertainty.confidence_label === "Moderate" ? "secondary" : "destructive"}
                    className="text-[9px]"
                  >
                    {data.uncertainty.confidence_label} ({data.uncertainty.confidence_score})
                  </Badge>
                </p>
                {/* Scoring breakdown */}
                <div className="grid grid-cols-2 gap-1 mb-1">
                  {Object.entries(data.uncertainty.scoring_breakdown || {}).map(([key, val]: [string, any]) => (
                    <div key={key} className="flex justify-between text-[10px] text-muted-foreground px-1">
                      <span>{key.replace(/_/g, " ")}</span>
                      <span className="font-mono">{val}</span>
                    </div>
                  ))}
                </div>
                {data.uncertainty.missing_evidence?.length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Missing Evidence:</p>
                    <div className="flex flex-wrap gap-1">
                      {data.uncertainty.missing_evidence.map((m: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px] text-yellow-600">{m}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {data.uncertainty.diagnostic_conflict && (
                  <div className="mt-1">
                    <p className="text-[10px] text-destructive mb-0.5">Diagnostic Conflicts:</p>
                    <div className="flex flex-wrap gap-1">
                      {(data.uncertainty.conflict_details || []).map((c: string, i: number) => (
                        <Badge key={i} variant="destructive" className="text-[9px]">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {data.hypotheses?.length > 0 && (
              <div>
                <p className="font-semibold mb-1">AI Hypotheses</p>
                {data.hypotheses.map((h: any, i: number) => (
                  <div key={i} className="p-1.5 bg-muted/50 rounded mb-1 flex justify-between">
                    <span>{h.diagnosis}</span>
                    <Badge variant="secondary" className="text-[10px]">{Math.round((h.confidence || 0) * 100)}%</Badge>
                  </div>
                ))}
              </div>
            )}
            {data.evidence && (
              <div>
                <p className="font-semibold mb-1">Evidence</p>
                <div className="text-muted-foreground">
                  {data.evidence.citation_count} citations from {(data.evidence.sources_queried || []).join(", ")} · {data.evidence.retrieval_confidence}
                </div>
              </div>
            )}
            {data.compliance && (
              <div>
                <p className="font-semibold mb-1">Guideline Compliance</p>
                <div className="text-muted-foreground">
                  {data.compliance.guidelines_matched} guidelines from {(data.compliance.guidelines_sources || []).join(", ")}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Safety: <strong>{data.safety_score}/100</strong></span>
            </div>
            {data.safety_flags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.safety_flags.map((f: string, i: number) => (
                  <Badge key={i} variant="destructive" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="font-semibold mb-1">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <Badge key={i} variant="outline" className="text-[10px]">{item}</Badge>
        ))}
      </div>
    </div>
  );
}
