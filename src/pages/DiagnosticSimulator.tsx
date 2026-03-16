/**
 * Diagnostic Simulator — Platform Admin Tool
 * 
 * Allows administrators to simulate clinical cases, inspect reasoning behavior,
 * and visualize modifier sensitivity across the full diagnostic pipeline.
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip, ChipGroup, PresetChipGroup } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, Play, Brain, Activity, ArrowRight, ChevronDown, ChevronRight,
  FlaskConical, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Eye,
  Target, Zap, Settings2, BookOpen, RotateCcw
} from "lucide-react";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT } from "@/lib/clinical-context";
import { runUnifiedClinicalPipeline, type PipelineResult } from "@/services/clinical_pipeline/orchestrator";
import SEO from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";

// ── Prebuilt Cases ──

interface PrebuiltCase {
  id: string;
  title: string;
  description: string;
  symptoms: string[];
  duration: string;
  onset: string;
  severity: string;
  location: string;
  riskFactors: string[];
  medicalHistory: string[];
  examFindings: string[];
  expectedTop: string[];
}

const PREBUILT_CASES: PrebuiltCase[] = [
  {
    id: "migraine",
    title: "Migraine Profile",
    description: "Gradual onset unilateral headache with nausea and photophobia",
    symptoms: ["Headache", "Nausea", "Photophobia"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", location: "Head",
    riskFactors: [], medicalHistory: [], examFindings: [],
    expectedTop: ["Migraine", "Tension headache"],
  },
  {
    id: "sah",
    title: "Subarachnoid Hemorrhage",
    description: "Sudden severe thunderclap headache with neck stiffness",
    symptoms: ["Headache", "Vomiting", "Neck stiffness"],
    duration: "Today", onset: "Sudden", severity: "Severe", location: "Head",
    riskFactors: [], medicalHistory: [], examFindings: ["Neck stiffness"],
    expectedTop: ["Subarachnoid hemorrhage", "Meningitis"],
  },
  {
    id: "msk-chest",
    title: "Musculoskeletal Chest Pain",
    description: "Localized, reproducible chest wall pain",
    symptoms: ["Chest pain"],
    duration: "3 days", onset: "Gradual", severity: "Mild", location: "Chest",
    riskFactors: [], medicalHistory: [], examFindings: [],
    expectedTop: ["Costochondritis", "GERD"],
  },
  {
    id: "acs",
    title: "Acute Coronary Syndrome",
    description: "Sudden severe chest pressure with sweating, radiation, and smoking history",
    symptoms: ["Chest pain", "Sweating", "Palpitations"],
    duration: "Today", onset: "Sudden", severity: "Severe", location: "Chest",
    riskFactors: ["Smoking", "Hypertension"], medicalHistory: [], examFindings: [],
    expectedTop: ["Acute coronary syndrome", "Myocardial infarction"],
  },
  {
    id: "gastroenteritis",
    title: "Gastroenteritis",
    description: "Diffuse abdominal pain with diarrhea and vomiting",
    symptoms: ["Abdominal pain", "Diarrhea", "Vomiting"],
    duration: "1 day", onset: "Gradual", severity: "Mild", location: "Lower abdomen",
    riskFactors: [], medicalHistory: [], examFindings: [],
    expectedTop: ["Gastroenteritis", "Food poisoning"],
  },
  {
    id: "appendicitis",
    title: "Appendicitis",
    description: "Progressive RLQ pain with rebound tenderness and fever",
    symptoms: ["Abdominal pain", "Nausea", "Fever"],
    duration: "Today", onset: "Progressive", severity: "Severe", location: "Right side",
    riskFactors: [], medicalHistory: [], examFindings: ["Rebound tenderness", "Guarding"],
    expectedTop: ["Appendicitis", "Mesenteric adenitis"],
  },
  {
    id: "pe",
    title: "Pulmonary Embolism",
    description: "Sudden dyspnea with pleuritic chest pain and recent travel",
    symptoms: ["Breathlessness", "Chest pain", "Palpitations"],
    duration: "Today", onset: "Sudden", severity: "Severe", location: "Chest",
    riskFactors: ["Recent surgery", "Recent travel"], medicalHistory: [], examFindings: [],
    expectedTop: ["Pulmonary embolism", "Pneumonia"],
  },
  {
    id: "pneumonia",
    title: "Community Pneumonia",
    description: "Productive cough with fever, crepitations",
    symptoms: ["Cough", "Fever", "Breathlessness"],
    duration: "5 days", onset: "Gradual", severity: "Moderate", location: "Chest",
    riskFactors: ["Smoking"], medicalHistory: ["COPD"], examFindings: ["Crepitations"],
    expectedTop: ["Pneumonia", "Bronchitis"],
  },
];

const SYMPTOM_OPTIONS = ["Fever", "Cough", "Headache", "Body ache", "Vomiting", "Diarrhea", "Sore throat", "Fatigue", "Chest pain", "Breathlessness", "Abdominal pain", "Dizziness", "Back pain", "Palpitations", "Neck stiffness", "Sweating", "Nausea", "Photophobia", "Joint pain", "Rash"];
const ONSET_OPTIONS = ["Sudden", "Gradual", "Intermittent", "Progressive", "Episodic"];
const SEVERITY_OPTIONS = ["Mild", "Moderate", "Severe", "Worsening"];
const LOCATION_OPTIONS = ["Head", "Neck", "Chest", "Upper abdomen", "Lower abdomen", "Back", "Limbs", "Left side", "Right side", "Generalized"];
const RISK_OPTIONS = ["Smoking", "Alcohol", "Diabetes", "Hypertension", "Obesity", "Pregnancy", "Immunocompromised", "Recent surgery", "Recent travel"];
const HISTORY_OPTIONS = ["Asthma", "COPD", "Heart failure", "Diabetes mellitus", "Hypertension", "Previous stroke", "Thyroid disorder"];
const EXAM_OPTIONS = ["Neck stiffness", "Wheezing", "Crepitations", "Rebound tenderness", "Guarding", "Focal neurological deficit", "Pallor", "Jaundice"];
const DURATION_OPTIONS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks"];

interface SimResult {
  pipelineResult: PipelineResult;
  bayesianDiagnoses: Array<{ name: string; pct: number; modifiers: Record<string, number> }>;
  candidateCount: number;
  soapAssessment: string;
  executionMs: number;
}

export default function DiagnosticSimulator() {
  // Input state
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [duration, setDuration] = useState("Today");
  const [onset, setOnset] = useState("");
  const [severity, setSeverity] = useState("");
  const [location, setLocation] = useState("");
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [medicalHistory, setMedicalHistory] = useState<string[]>([]);
  const [examFindings, setExamFindings] = useState<string[]>([]);
  const [patientAge, setPatientAge] = useState(45);
  const [patientSex, setPatientSex] = useState("Male");

  // Results
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [compareResult, setCompareResult] = useState<SimResult | null>(null);
  const [traceExpanded, setTraceExpanded] = useState(false);
  const [rawResult, setRawResult] = useState<PipelineResult | null>(null);
  const [rawCompareResult, setRawCompareResult] = useState<PipelineResult | null>(null);

  const loadPrebuiltCase = (c: PrebuiltCase) => {
    setSymptoms(c.symptoms);
    setDuration(c.duration);
    setOnset(c.onset);
    setSeverity(c.severity);
    setLocation(c.location);
    setRiskFactors(c.riskFactors);
    setMedicalHistory(c.medicalHistory);
    setExamFindings(c.examFindings);
    setResult(null);
    setCompareResult(null);
  };

  const buildContext = (): Partial<ClinicalContext> & Record<string, any> => ({
    ...EMPTY_CLINICAL_CONTEXT,
    chief_complaint: symptoms[0] || "",
    symptoms,
    symptom_duration: duration,
    onset_pattern: onset,
    severity,
    body_location: location,
    risk_factors: riskFactors,
    medical_history: medicalHistory,
    exam_findings: examFindings,
    patient_age: patientAge,
    patient_sex: patientSex,
    family_history: [],
  });

  const extractSimResult = (pr: PipelineResult): SimResult => {
    const bayesian = pr.bayesian_result;
    const hypotheses = (pr.hypotheses as any)?.hypotheses || [];
    const bayesianDiagnoses = bayesian?.diagnoses?.slice(0, 8).map((d: any) => {
      const resolved = hypotheses.find((h: any) =>
        (h.hypothesis || h.diagnosis || "").toLowerCase().includes(d.diagnosis_id?.slice(0, 6)) ||
        d.supporting_evidence?.some((e: string) => (h.supporting_factors || h.supporting_evidence || []).includes(e))
      );
      const name = resolved?.hypothesis || resolved?.diagnosis || d.diagnosis_id || "Unknown";
      return {
        name: /^[0-9a-f]{8}-/.test(name) ? (d.supporting_evidence?.[0] || name.slice(0, 12)) : name,
        pct: Math.round((d.posterior_probability || 0) * 100),
        modifiers: {
          onset: d.onset_modifier || 1,
          duration: d.duration_modifier || 1,
          vital: d.vital_modifier || 1,
          risk: d.risk_modifier || 1,
          cluster: d.cluster_modifier || 1,
        },
      };
    }) || [];

    const soap = (pr.hybrid_reasoning as any)?.soap;
    return {
      pipelineResult: pr,
      bayesianDiagnoses,
      candidateCount: bayesian?.total_candidates || 0,
      soapAssessment: soap?.assessment || "",
      executionMs: pr.total_latency_ms || 0,
    };
  };

  const runSimulation = async (isCompare = false) => {
    setRunning(true);
    try {
      const ctx = buildContext();
      // Merge exam findings into symptoms
      if (examFindings.length > 0) {
        ctx.symptoms = [...new Set([...(ctx.symptoms || []), ...examFindings])];
      }

      const transcript = `Patient presents with ${(ctx.symptoms || []).join(", ")}. Duration: ${duration}. Onset: ${onset || "not specified"}. Severity: ${severity || "not specified"}. Location: ${location || "not specified"}.${riskFactors.length > 0 ? ` Risk factors: ${riskFactors.join(", ")}.` : ""}${medicalHistory.length > 0 ? ` Medical history: ${medicalHistory.join(", ")}.` : ""}${examFindings.length > 0 ? ` Exam findings: ${examFindings.join(", ")}.` : ""}`;

      ctx.transcript = transcript;

      const pr = await runUnifiedClinicalPipeline({
        clinical_context: ctx as ClinicalContext,
        visit_id: null,
        consultation_id: null,
        clinic_id: null,
        intake_approved: false,
        skip_cache: true,
      });

      const simResult = extractSimResult(pr);
      if (isCompare) {
        setCompareResult(simResult);
        setRawCompareResult(pr);
      } else {
        setResult(simResult);
        setRawResult(pr);
      }
    } catch (err: any) {
      console.error("[Simulator]", err);
    } finally {
      setRunning(false);
    }
  };

  const sensitivityDelta = useMemo(() => {
    if (!result || !compareResult) return null;
    const aMap = new Map(result.bayesianDiagnoses.map(d => [d.name, d.pct]));
    const bMap = new Map(compareResult.bayesianDiagnoses.map(d => [d.name, d.pct]));
    const allNames = [...new Set([...aMap.keys(), ...bMap.keys()])];
    return allNames.map(name => ({
      name,
      pctA: aMap.get(name) ?? 0,
      pctB: bMap.get(name) ?? 0,
      delta: (bMap.get(name) ?? 0) - (aMap.get(name) ?? 0),
    })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [result, compareResult]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-6">
      <SEO title="Diagnostic Simulator | DATAelixAIr Admin" description="Simulate clinical cases and inspect diagnostic reasoning" />

      <div className="flex items-center gap-3 mb-2">
        <Brain className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Diagnostic Simulator</h1>
          <p className="text-xs text-muted-foreground">Simulate clinical cases and inspect reasoning pipeline behavior</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ── LEFT: Case Input ── */}
        <div className="space-y-4">
          {/* Case Library */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-primary" /> Case Library</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {PREBUILT_CASES.map(c => (
                <button
                  key={c.id}
                  onClick={() => loadPrebuiltCase(c)}
                  className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-xs font-medium text-foreground group-hover:text-primary">{c.title}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Manual Input */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5"><Settings2 className="h-4 w-4 text-primary" /> Case Input</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Demographics */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Age</label>
                  <Input type="number" value={patientAge} onChange={e => setPatientAge(Number(e.target.value))} className="h-7 text-xs mt-0.5" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase">Sex</label>
                  <div className="flex gap-1 mt-0.5">
                    {["Male", "Female"].map(s => (
                      <Chip key={s} variant="neutral" size="sm" selected={patientSex === s} onClick={() => setPatientSex(s)}>{s}</Chip>
                    ))}
                  </div>
                </div>
              </div>

              <PresetChipGroup label="Symptoms" options={SYMPTOM_OPTIONS} selected={symptoms} onToggle={v => setSymptoms(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} variant="symptom" allowCustom />
              <PresetChipGroup label="Duration" options={DURATION_OPTIONS} selected={duration ? [duration] : []} onToggle={v => setDuration(v === duration ? "" : v)} variant="neutral" />
              <PresetChipGroup label="Onset" options={ONSET_OPTIONS} selected={onset ? [onset] : []} onToggle={v => setOnset(v === onset ? "" : v)} variant="neutral" />
              <PresetChipGroup label="Severity" options={SEVERITY_OPTIONS} selected={severity ? [severity] : []} onToggle={v => setSeverity(v === severity ? "" : v)} variant="neutral" />
              <PresetChipGroup label="Location" options={LOCATION_OPTIONS} selected={location ? [location] : []} onToggle={v => setLocation(v === location ? "" : v)} variant="neutral" />
              <PresetChipGroup label="Risk Factors" options={RISK_OPTIONS} selected={riskFactors} onToggle={v => setRiskFactors(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} variant="lab" />
              <PresetChipGroup label="Medical History" options={HISTORY_OPTIONS} selected={medicalHistory} onToggle={v => setMedicalHistory(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} variant="diagnosis" />
              <PresetChipGroup label="Exam Findings" options={EXAM_OPTIONS} selected={examFindings} onToggle={v => setExamFindings(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} variant="alert" />

              <div className="flex gap-2 pt-2">
                <Button onClick={() => runSimulation(false)} disabled={running || symptoms.length === 0} className="flex-1 h-8 text-xs">
                  {running ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  Run Simulation
                </Button>
                {result && (
                  <Button onClick={() => runSimulation(true)} disabled={running || symptoms.length === 0} variant="outline" className="flex-1 h-8 text-xs">
                    <ArrowRight className="h-3 w-3 mr-1" />Compare
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── CENTER: Results ── */}
        <div className="space-y-4">
          {result && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-primary" /> Bayesian Ranking
                    <Badge variant="outline" className="text-[9px] ml-auto">{result.executionMs}ms</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.bayesianDiagnoses.map((d, i) => (
                    <div key={d.name} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-xs font-medium text-foreground flex-1">{d.name}</span>
                        <span className={`text-sm font-bold tabular-nums ${d.pct >= 30 ? "text-emerald-600 dark:text-emerald-400" : d.pct >= 15 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {d.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden ml-6">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(d.pct, 2)}%` }} />
                      </div>
                      {/* Modifier tags */}
                      <div className="flex flex-wrap gap-0.5 ml-6">
                        {Object.entries(d.modifiers).filter(([_, v]) => v !== 1).map(([k, v]) => (
                          <span key={k} className={`text-[8px] px-1.5 py-0.5 rounded-full border ${v > 1 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"}`}>
                            {k} ×{v.toFixed(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[9px] text-muted-foreground pt-1 border-t border-border">
                    {result.candidateCount} candidates evaluated
                  </p>
                </CardContent>
              </Card>

              {/* SOAP Assessment */}
              {result.soapAssessment && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5"><Zap className="h-4 w-4 text-primary" /> SOAP Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{result.soapAssessment}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!result && !running && (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a case or build your own, then click Run Simulation</p>
              </CardContent>
            </Card>
          )}

          {running && (
            <Card>
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 text-primary mx-auto mb-2 animate-spin" />
                <p className="text-sm text-muted-foreground">Running diagnostic pipeline...</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── RIGHT: Comparison & Trace ── */}
        <div className="space-y-4">
          {/* Modifier Sensitivity Comparison */}
          {sensitivityDelta && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-primary" /> Modifier Sensitivity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sensitivityDelta.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-xs text-foreground flex-1 truncate">{d.name}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{d.pctA}%</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{d.pctB}%</span>
                    <Badge variant="outline" className={`text-[9px] w-12 text-center ${d.delta > 0 ? "text-emerald-600 border-emerald-200" : d.delta < 0 ? "text-destructive border-destructive/30" : "text-muted-foreground"}`}>
                      {d.delta > 0 ? "+" : ""}{d.delta}%
                    </Badge>
                  </div>
                ))}
                <div className="pt-1 border-t border-border">
                  <p className="text-[9px] text-muted-foreground">
                    Sensitivity Score: {Math.round((sensitivityDelta.filter(d => d.delta !== 0).length / Math.max(sensitivityDelta.length, 1)) * 100)}%
                    ({sensitivityDelta.filter(d => d.delta !== 0).length}/{sensitivityDelta.length} diagnoses shifted)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compare result */}
          {compareResult && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-amber-500" /> Compare Result
                  <Badge variant="outline" className="text-[9px] ml-auto">{compareResult.executionMs}ms</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {compareResult.bayesianDiagnoses.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-xs text-foreground flex-1">{d.name}</span>
                    <span className={`text-xs font-bold tabular-nums ${d.pct >= 30 ? "text-emerald-600" : d.pct >= 15 ? "text-amber-600" : "text-muted-foreground"}`}>{d.pct}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Pipeline Trace */}
          {rawResult && (
            <Card>
              <CardHeader className="pb-2">
                <Collapsible open={traceExpanded} onOpenChange={setTraceExpanded}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-1.5 w-full text-left">
                      <Eye className="h-4 w-4 text-primary shrink-0" />
                      <CardTitle className="text-sm flex-1">Pipeline Trace</CardTitle>
                      {traceExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-2 space-y-2">
                      {/* Stage latencies */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Stage Latencies</p>
                        <div className="space-y-0.5">
                          {Object.entries(rawResult.stage_latencies || {}).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-1 text-[10px]">
                              <span className="text-muted-foreground flex-1">{k}</span>
                              <span className="text-foreground font-mono">{v}ms</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* Raw context */}
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Input Context</p>
                        <pre className="text-[9px] text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto max-h-48 font-mono">
                          {JSON.stringify({
                            symptoms, duration, onset, severity, location,
                            riskFactors, medicalHistory, examFindings,
                            patientAge, patientSex,
                          }, null, 2)}
                        </pre>
                      </div>
                      {/* Bayesian raw */}
                      {rawResult.bayesian_result && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Bayesian Raw</p>
                          <pre className="text-[9px] text-muted-foreground bg-muted rounded-lg p-2 overflow-x-auto max-h-48 font-mono">
                            {JSON.stringify(rawResult.bayesian_result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </CardHeader>
            </Card>
          )}

          {/* Reset */}
          {(result || compareResult) && (
            <Button
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={() => {
                setResult(null);
                setCompareResult(null);
                setRawResult(null);
                setRawCompareResult(null);
                setSymptoms([]);
                setOnset("");
                setSeverity("");
                setLocation("");
                setRiskFactors([]);
                setMedicalHistory([]);
                setExamFindings([]);
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Reset Simulator
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
