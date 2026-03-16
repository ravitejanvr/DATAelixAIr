/**
 * Modifier Sensitivity Test
 *
 * Runs controlled textbook clinical pairs through the full diagnostic pipeline
 * to verify that changing modifiers (onset, severity, location, risk factors, etc.)
 * actually alters candidate diagnoses, Bayesian scores, and SOAP output.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, CheckCircle, XCircle, AlertTriangle, Brain, Activity, ArrowRight } from "lucide-react";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT } from "@/lib/clinical-context";
import { runUnifiedClinicalPipeline, type PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import SEO from "@/components/SEO";

// ── Test Case Definitions ──

interface TestCase {
  id: string;
  label: string;
  expectedTop: string[];
  context: Partial<ClinicalContext> & { onset_pattern?: string; severity?: string; body_location?: string; risk_factors?: string[]; family_history?: string[]; exam_findings?: string[] };
}

interface TestPair {
  title: string;
  baseSymptom: string;
  caseA: TestCase;
  caseB: TestCase;
}

const TEST_PAIRS: TestPair[] = [
  {
    title: "Headache — Migraine vs Subarachnoid Hemorrhage",
    baseSymptom: "Headache",
    caseA: {
      id: "headache-migraine",
      label: "Case A: Migraine Profile",
      expectedTop: ["Migraine", "Tension headache", "Cluster headache"],
      context: {
        chief_complaint: "Headache",
        symptoms: ["Headache", "Nausea", "Photophobia"],
        symptom_duration: "2 days",
        onset_pattern: "Gradual",
        severity: "Moderate",
        body_location: "Head",
        risk_factors: [],
        medical_history: [],
      },
    },
    caseB: {
      id: "headache-sah",
      label: "Case B: Subarachnoid Hemorrhage Profile",
      expectedTop: ["Subarachnoid hemorrhage", "Meningitis", "Migraine"],
      context: {
        chief_complaint: "Headache",
        symptoms: ["Headache", "Vomiting", "Neck stiffness"],
        symptom_duration: "Today",
        onset_pattern: "Sudden",
        severity: "Severe",
        body_location: "Head",
        risk_factors: [],
        medical_history: [],
        exam_findings: ["Neck stiffness"],
      },
    },
  },
  {
    title: "Chest Pain — Musculoskeletal vs Acute Coronary Syndrome",
    baseSymptom: "Chest pain",
    caseA: {
      id: "chest-msk",
      label: "Case A: Musculoskeletal Chest Pain",
      expectedTop: ["Costochondritis", "Musculoskeletal chest pain", "GERD"],
      context: {
        chief_complaint: "Chest pain",
        symptoms: ["Chest pain"],
        symptom_duration: "3 days",
        onset_pattern: "Gradual",
        severity: "Mild",
        body_location: "Chest",
        risk_factors: [],
        medical_history: [],
      },
    },
    caseB: {
      id: "chest-acs",
      label: "Case B: Acute Coronary Syndrome",
      expectedTop: ["Acute coronary syndrome", "Myocardial infarction", "Pulmonary embolism"],
      context: {
        chief_complaint: "Chest pain",
        symptoms: ["Chest pain", "Sweating", "Palpitations"],
        symptom_duration: "Today",
        onset_pattern: "Sudden",
        severity: "Severe",
        body_location: "Chest",
        risk_factors: ["Smoking"],
        medical_history: [],
      },
    },
  },
  {
    title: "Abdominal Pain — Gastroenteritis vs Appendicitis",
    baseSymptom: "Abdominal pain",
    caseA: {
      id: "abd-ge",
      label: "Case A: Gastroenteritis",
      expectedTop: ["Gastroenteritis", "Food poisoning"],
      context: {
        chief_complaint: "Abdominal pain",
        symptoms: ["Abdominal pain", "Diarrhea", "Vomiting"],
        symptom_duration: "1 day",
        onset_pattern: "Gradual",
        severity: "Mild",
        body_location: "Generalized",
        risk_factors: [],
        medical_history: [],
      },
    },
    caseB: {
      id: "abd-appendicitis",
      label: "Case B: Appendicitis",
      expectedTop: ["Appendicitis", "Mesenteric adenitis"],
      context: {
        chief_complaint: "Abdominal pain",
        symptoms: ["Abdominal pain", "Nausea", "Fever"],
        symptom_duration: "1 day",
        onset_pattern: "Progressive",
        severity: "Severe",
        body_location: "Lower abdomen",
        risk_factors: [],
        medical_history: [],
        exam_findings: ["Rebound tenderness"],
      },
    },
  },
];

// ── Result Types ──

interface CaseResult {
  caseId: string;
  label: string;
  expectedTop: string[];
  candidateNames: string[];
  bayesianRanking: Array<{ name: string; probability: number; modifiers: Record<string, number | undefined> }>;
  ddxCount: number;
  bayesianCount: number;
  totalLatencyMs: number;
  soapAssessment: string;
  pipelineSource: string;
  raw: PipelineResult;
}

interface PairComparison {
  title: string;
  caseA: CaseResult;
  caseB: CaseResult;
  candidatesChanged: boolean;
  rankingChanged: boolean;
  topDiagnosisChanged: boolean;
  soapChanged: boolean;
  sensitivityScore: number;
  verdict: "pass" | "partial" | "fail";
}

// ── Helpers ──

function buildFullContext(partial: TestCase["context"]): ClinicalContext {
  return {
    ...EMPTY_CLINICAL_CONTEXT,
    patient_age: 40,
    patient_sex: "male",
    ...partial,
  } as ClinicalContext;
}

async function runCase(tc: TestCase): Promise<CaseResult> {
  const ctx = buildFullContext(tc.context);

  const result = await runUnifiedClinicalPipeline({
    clinical_context: ctx,
    visit_id: null,
    consultation_id: null,
    clinic_id: null,
    skip_cache: true, // Force full pipeline — no reasoning cache
  });

  // Extract candidate names from DDX
  const candidateNames = result.ddx?.differential_diagnoses.map(d => d.diagnosis_name) || [];

  // Extract Bayesian ranking
  const bayesianRanking = (result.bayesian?.diagnoses || []).map(d => {
    // Try to resolve name from DDX
    const ddxMatch = result.ddx?.differential_diagnoses.find(dx => dx.diagnosis_id === d.diagnosis_id);
    return {
      name: ddxMatch?.diagnosis_name || d.diagnosis_id.slice(0, 12),
      probability: d.posterior_probability,
      modifiers: {
        prior: d.prior,
        symptom: d.symptom_likelihood,
        physiology: d.physiology_likelihood,
        risk: d.risk_modifier,
        duration: d.duration_modifier,
        onset: d.onset_modifier,
        vital: d.vital_modifier,
        cluster: d.cluster_modifier,
        history: d.history_multiplier,
        coverage: d.coverage_ratio,
      },
    };
  });

  // SOAP assessment
  const soapAssessment = result.soap_fallback?.soap?.assessment || "(no SOAP generated)";

  return {
    caseId: tc.id,
    label: tc.label,
    expectedTop: tc.expectedTop,
    candidateNames,
    bayesianRanking,
    ddxCount: candidateNames.length,
    bayesianCount: bayesianRanking.length,
    totalLatencyMs: result.total_latency_ms,
    soapAssessment,
    pipelineSource: result.bayesian?.source || "unknown",
    raw: result,
  };
}

function comparePair(title: string, a: CaseResult, b: CaseResult): PairComparison {
  // Check if candidate sets differ
  const setA = new Set(a.candidateNames.map(n => n.toLowerCase()));
  const setB = new Set(b.candidateNames.map(n => n.toLowerCase()));
  const candidatesChanged = ![...setA].every(x => setB.has(x)) || ![...setB].every(x => setA.has(x));

  // Check if top diagnosis changed
  const topA = a.bayesianRanking[0]?.name.toLowerCase() || "";
  const topB = b.bayesianRanking[0]?.name.toLowerCase() || "";
  const topDiagnosisChanged = topA !== topB;

  // Check if any probability shifted
  const probMapA = new Map(a.bayesianRanking.map(r => [r.name.toLowerCase(), r.probability]));
  let changed = 0;
  let total = 0;
  for (const r of b.bayesianRanking) {
    total++;
    const probA = probMapA.get(r.name.toLowerCase());
    if (probA === undefined || Math.abs(probA - r.probability) > 0.005) {
      changed++;
    }
  }
  // Also count diagnoses only in A
  for (const r of a.bayesianRanking) {
    if (!b.bayesianRanking.find(x => x.name.toLowerCase() === r.name.toLowerCase())) {
      total++;
      changed++;
    }
  }
  const rankingChanged = changed > 0;
  const sensitivityScore = total > 0 ? Math.round((changed / total) * 100) : 0;

  const soapChanged = a.soapAssessment !== b.soapAssessment;

  const passCount = [candidatesChanged, rankingChanged, topDiagnosisChanged, soapChanged].filter(Boolean).length;
  const verdict: PairComparison["verdict"] = passCount >= 3 ? "pass" : passCount >= 1 ? "partial" : "fail";

  return { title, caseA: a, caseB: b, candidatesChanged, rankingChanged, topDiagnosisChanged, soapChanged, sensitivityScore, verdict };
}

// ── Component ──

export default function ModifierSensitivityTest() {
  const [running, setRunning] = useState(false);
  const [currentPair, setCurrentPair] = useState<number>(-1);
  const [currentCase, setCurrentCase] = useState<string>("");
  const [comparisons, setComparisons] = useState<PairComparison[]>([]);
  const [expandedPair, setExpandedPair] = useState<number | null>(null);

  const runAllTests = async () => {
    setRunning(true);
    setComparisons([]);
    const results: PairComparison[] = [];

    for (let i = 0; i < TEST_PAIRS.length; i++) {
      const pair = TEST_PAIRS[i];
      setCurrentPair(i);

      setCurrentCase(pair.caseA.label);
      console.log(`[ModifierTest] Running ${pair.caseA.id}...`);
      const resultA = await runCase(pair.caseA);
      console.log(`[ModifierTest] ${pair.caseA.id} complete:`, {
        candidates: resultA.candidateNames.slice(0, 5),
        bayesian: resultA.bayesianRanking.slice(0, 5).map(r => `${r.name}: ${(r.probability * 100).toFixed(1)}%`),
        latency: resultA.totalLatencyMs,
      });

      setCurrentCase(pair.caseB.label);
      console.log(`[ModifierTest] Running ${pair.caseB.id}...`);
      const resultB = await runCase(pair.caseB);
      console.log(`[ModifierTest] ${pair.caseB.id} complete:`, {
        candidates: resultB.candidateNames.slice(0, 5),
        bayesian: resultB.bayesianRanking.slice(0, 5).map(r => `${r.name}: ${(r.probability * 100).toFixed(1)}%`),
        latency: resultB.totalLatencyMs,
      });

      const comparison = comparePair(pair.title, resultA, resultB);
      results.push(comparison);
      setComparisons([...results]);

      console.log(`[ModifierTest] Pair ${i + 1} result:`, {
        candidatesChanged: comparison.candidatesChanged,
        rankingChanged: comparison.rankingChanged,
        topDiagnosisChanged: comparison.topDiagnosisChanged,
        soapChanged: comparison.soapChanged,
        sensitivityScore: comparison.sensitivityScore,
        verdict: comparison.verdict,
      });
    }

    setRunning(false);
    setCurrentPair(-1);
    setCurrentCase("");
  };

  const overallScore = comparisons.length > 0
    ? Math.round(comparisons.reduce((sum, c) => sum + c.sensitivityScore, 0) / comparisons.length)
    : 0;

  const overallVerdict = comparisons.length === TEST_PAIRS.length
    ? comparisons.every(c => c.verdict === "pass") ? "pass"
      : comparisons.some(c => c.verdict === "fail") ? "fail"
      : "partial"
    : null;

  return (
    <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto space-y-6">
      <SEO title="Modifier Sensitivity Test" description="Controlled clinical case testing" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Modifier Sensitivity Test</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Runs 3 controlled case pairs through the full diagnostic pipeline to verify modifiers influence output.
          </p>
        </div>
        <Button onClick={runAllTests} disabled={running} size="lg" className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {running ? `Running ${currentCase}...` : "Run All Tests"}
        </Button>
      </div>

      {/* Overall Score */}
      {comparisons.length > 0 && (
        <Card className={`border-2 ${overallVerdict === "pass" ? "border-emerald-500" : overallVerdict === "fail" ? "border-destructive" : "border-amber-500"}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {overallVerdict === "pass" ? <CheckCircle className="h-6 w-6 text-emerald-500" /> :
               overallVerdict === "fail" ? <XCircle className="h-6 w-6 text-destructive" /> :
               <AlertTriangle className="h-6 w-6 text-amber-500" />}
              <div>
                <p className="font-semibold text-lg">
                  Overall Modifier Sensitivity: {overallScore}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {comparisons.filter(c => c.verdict === "pass").length}/{comparisons.length} pairs passed,{" "}
                  {comparisons.filter(c => c.verdict === "partial").length} partial,{" "}
                  {comparisons.filter(c => c.verdict === "fail").length} failed
                </p>
              </div>
            </div>
            <Badge variant={overallVerdict === "pass" ? "default" : overallVerdict === "fail" ? "destructive" : "secondary"} className="text-sm px-3 py-1">
              {overallVerdict === "pass" ? "✅ PASS" : overallVerdict === "fail" ? "❌ FAIL" : "⚠️ PARTIAL"}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Test Pair Results */}
      {comparisons.map((comp, i) => (
        <Card key={i} className={`border ${comp.verdict === "pass" ? "border-emerald-200 dark:border-emerald-800" : comp.verdict === "fail" ? "border-destructive/30" : "border-amber-200 dark:border-amber-800"}`}>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedPair(expandedPair === i ? null : i)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {comp.verdict === "pass" ? <CheckCircle className="h-4 w-4 text-emerald-500" /> :
                 comp.verdict === "fail" ? <XCircle className="h-4 w-4 text-destructive" /> :
                 <AlertTriangle className="h-4 w-4 text-amber-500" />}
                {comp.title}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">Sensitivity: {comp.sensitivityScore}%</Badge>
                <Badge variant={comp.candidatesChanged ? "default" : "destructive"} className="text-xs">{comp.candidatesChanged ? "✓" : "✗"} Candidates</Badge>
                <Badge variant={comp.rankingChanged ? "default" : "destructive"} className="text-xs">{comp.rankingChanged ? "✓" : "✗"} Ranking</Badge>
                <Badge variant={comp.topDiagnosisChanged ? "default" : "destructive"} className="text-xs">{comp.topDiagnosisChanged ? "✓" : "✗"} Top Dx</Badge>
                <Badge variant={comp.soapChanged ? "default" : "destructive"} className="text-xs">{comp.soapChanged ? "✓" : "✗"} SOAP</Badge>
              </div>
            </div>
          </CardHeader>

          {expandedPair === i && (
            <CardContent className="space-y-4">
              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 gap-4">
                {[comp.caseA, comp.caseB].map((c) => (
                  <div key={c.caseId} className="space-y-3 border rounded-lg p-3 bg-muted/30">
                    <p className="font-semibold text-sm">{c.label}</p>

                    {/* Input context */}
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Input Context</p>
                      <div className="flex flex-wrap gap-1">
                        {(c.raw.enriched_context as any)?.clinical_context?.onset_pattern && (
                          <Badge variant="outline" className="text-[9px]">Onset: {(c.raw.enriched_context as any).clinical_context.onset_pattern}</Badge>
                        )}
                        {(c.raw.enriched_context as any)?.clinical_context?.severity && (
                          <Badge variant="outline" className="text-[9px]">Severity: {(c.raw.enriched_context as any).clinical_context.severity}</Badge>
                        )}
                        {(c.raw.enriched_context as any)?.clinical_context?.body_location && (
                          <Badge variant="outline" className="text-[9px]">Location: {(c.raw.enriched_context as any).clinical_context.body_location}</Badge>
                        )}
                        {(c.raw.enriched_context as any)?.clinical_context?.symptom_duration && (
                          <Badge variant="outline" className="text-[9px]">Duration: {(c.raw.enriched_context as any).clinical_context.symptom_duration}</Badge>
                        )}
                      </div>
                    </div>

                    {/* DDX Candidates */}
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Brain className="h-3 w-3" /> DDX Candidates ({c.ddxCount})
                      </p>
                      <div className="space-y-0.5">
                        {c.candidateNames.slice(0, 8).map((name, j) => (
                          <p key={j} className="text-xs text-foreground">{j + 1}. {name}</p>
                        ))}
                      </div>
                    </div>

                    {/* Bayesian Ranking */}
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Bayesian Ranking ({c.bayesianCount})
                      </p>
                      <div className="space-y-1">
                        {c.bayesianRanking.slice(0, 6).map((r, j) => (
                          <div key={j} className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground flex-1">{j + 1}. {r.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">{(r.probability * 100).toFixed(1)}%</Badge>
                            <div className="flex gap-0.5">
                              {r.modifiers.onset !== undefined && r.modifiers.onset !== 1.0 && (
                                <Badge variant="secondary" className="text-[7px] px-1">O:{r.modifiers.onset?.toFixed(2)}</Badge>
                              )}
                              {r.modifiers.duration !== undefined && r.modifiers.duration !== 1.0 && (
                                <Badge variant="secondary" className="text-[7px] px-1">D:{r.modifiers.duration?.toFixed(2)}</Badge>
                              )}
                              {r.modifiers.vital !== undefined && r.modifiers.vital !== 1.0 && (
                                <Badge variant="secondary" className="text-[7px] px-1">V:{r.modifiers.vital?.toFixed(2)}</Badge>
                              )}
                              {r.modifiers.cluster !== undefined && r.modifiers.cluster !== 1.0 && (
                                <Badge variant="secondary" className="text-[7px] px-1">C:{r.modifiers.cluster?.toFixed(2)}</Badge>
                              )}
                              {r.modifiers.risk !== undefined && r.modifiers.risk !== 1.0 && (
                                <Badge variant="secondary" className="text-[7px] px-1">R:{r.modifiers.risk?.toFixed(2)}</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SOAP */}
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">SOAP Assessment</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{c.soapAssessment}</p>
                    </div>

                    <Badge variant="outline" className="text-[9px]">
                      Latency: {c.totalLatencyMs}ms | Source: {c.pipelineSource}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Comparison Arrow */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>{comp.caseA.bayesianRanking[0]?.name || "?"}</span>
                <ArrowRight className="h-4 w-4" />
                <span>{comp.caseB.bayesianRanking[0]?.name || "?"}</span>
                <span className="text-xs">
                  ({comp.topDiagnosisChanged ? "✅ Top diagnosis changed" : "❌ Same top diagnosis"})
                </span>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Pending pairs indicator */}
      {running && comparisons.length < TEST_PAIRS.length && (
        <div className="space-y-2">
          {TEST_PAIRS.slice(comparisons.length).map((pair, i) => (
            <Card key={i} className="border border-muted opacity-50">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                  {currentPair === comparisons.length + i ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  {pair.title}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Pipeline Trace Logs */}
      {comparisons.length > 0 && expandedPair !== null && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pipeline Trace — {comparisons[expandedPair]?.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[comparisons[expandedPair]?.caseA, comparisons[expandedPair]?.caseB].map((c) => c && (
                <div key={c.caseId} className="space-y-1">
                  <p className="text-xs font-semibold">{c.label}</p>
                  <div className="bg-muted/50 rounded p-2 text-[9px] font-mono space-y-0.5 max-h-48 overflow-auto">
                    {c.raw.logs.map((log, j) => (
                      <p key={j} className={log.status === "failed" ? "text-destructive" : log.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                        {log.status === "failed" ? "❌" : log.status === "completed" ? "✅" : log.status === "skipped" ? "⏭️" : "▶️"}{" "}
                        {log.stage} → {log.status}
                        {log.duration_ms ? ` (${log.duration_ms}ms)` : ""}
                      </p>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(c.raw.stage_latencies).map(([k, v]) => (
                      <Badge key={k} variant="outline" className="text-[7px]">{k}: {v}ms</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
