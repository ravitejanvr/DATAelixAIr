import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, FlaskConical, BarChart3, ShieldCheck, CheckCircle2, XCircle, Clock, ListChecks, Trophy, AlertTriangle, Zap, Activity } from "lucide-react";
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

// ═══════════════════════════════════════════
// BENCHMARK V4 — 10 Clinical Scenarios
// ═══════════════════════════════════════════
const V4_BENCHMARK_TESTS = [
  {
    name: "1. Viral Fever",
    context: {
      age: 32, gender: "male",
      symptoms: ["fever", "headache", "myalgia"],
      duration: "2 days",
      vitals: { temperature: 101, bp: "118/78", pulse: 92, spo2: 98 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["viral infection", "dengue", "malaria"],
      labs: ["CBC", "Dengue NS1", "malaria smear"],
      medications: ["paracetamol"],
      guidelines: ["WHO fever guideline"],
      dangerous_diagnosis_required: false,
      safety_alert_required: null as string | null,
    },
  },
  {
    name: "2. Gastroenteritis",
    context: {
      age: 24, gender: "female",
      symptoms: ["vomiting", "diarrhea", "abdominal pain"],
      duration: "1 day",
      vitals: { temperature: 99, bp: "110/70", pulse: 96, spo2: 99 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["acute gastroenteritis", "food poisoning"],
      labs: ["stool culture", "electrolytes"],
      medications: ["ORS", "ondansetron"],
      guidelines: ["WHO diarrhea guideline"],
      dangerous_diagnosis_required: false,
      safety_alert_required: null,
    },
  },
  {
    name: "3. Respiratory Infection",
    context: {
      age: 45, gender: "male",
      symptoms: ["fever", "cough", "breathlessness"],
      duration: "3 days",
      vitals: { temperature: 100, bp: "122/80", pulse: 100, spo2: 94 },
      allergies: [], conditions: ["smoker"], current_medications: [],
    },
    expected: {
      diagnoses: ["community-acquired pneumonia", "acute bronchitis"],
      labs: ["CBC", "chest x-ray"],
      medications: ["amoxicillin", "paracetamol"],
      guidelines: ["NICE pneumonia guideline"],
      dangerous_diagnosis_required: false,
      safety_alert_required: null,
    },
  },
  {
    name: "4. Chest Pain Emergency",
    context: {
      age: 65, gender: "male",
      symptoms: ["chest pain", "sweating", "breathlessness"],
      duration: "1 hour",
      vitals: { bp: "150/95", pulse: 110, spo2: 93 },
      allergies: [], conditions: ["diabetes", "hypertension"],
      current_medications: ["metformin", "amlodipine"],
    },
    expected: {
      diagnoses: ["myocardial infarction", "pulmonary embolism", "aortic dissection"],
      labs: ["ECG", "troponin", "D-dimer"],
      medications: ["aspirin", "nitroglycerin"],
      guidelines: ["AHA chest pain guideline"],
      dangerous_diagnosis_required: true,
      safety_alert_required: null,
    },
  },
  {
    name: "5. Drug Allergy Conflict",
    context: {
      age: 40, gender: "female",
      symptoms: ["fever", "sore throat"],
      duration: "3 days",
      vitals: { temperature: 100, bp: "118/74", pulse: 88, spo2: 98 },
      allergies: ["penicillin"],
      conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["viral pharyngitis", "streptococcal pharyngitis"],
      labs: [],
      medications: ["azithromycin"],
      guidelines: [],
      dangerous_diagnosis_required: false,
      safety_alert_required: "penicillin",
    },
  },
  {
    name: "6. Conflicting Symptoms",
    context: {
      age: 30, gender: "male",
      symptoms: ["fever", "cough", "abdominal pain"],
      duration: "2 days",
      vitals: { temperature: 101, bp: "120/80", pulse: 90, spo2: 97 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["influenza", "pneumonia", "appendicitis"],
      labs: [],
      medications: [],
      guidelines: [],
      dangerous_diagnosis_required: false,
      safety_alert_required: null,
    },
  },
  {
    name: "7. Missing Evidence",
    context: {
      age: 28, gender: "female",
      symptoms: ["fever", "headache"],
      duration: "1 day",
      vitals: {},
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: [],
      labs: [],
      medications: [],
      guidelines: [],
      dangerous_diagnosis_required: false,
      safety_alert_required: null,
      expect_low_confidence: true,
    },
  },
  {
    name: "8. Dangerous Diagnosis Detection",
    context: {
      age: 22, gender: "male",
      symptoms: ["neck stiffness", "fever", "confusion"],
      duration: "6 hours",
      vitals: { temperature: 103, bp: "100/60", pulse: 120, spo2: 95 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["bacterial meningitis"],
      labs: ["lumbar puncture"],
      medications: [],
      guidelines: [],
      dangerous_diagnosis_required: true,
      safety_alert_required: null,
    },
  },
  {
    name: "9. Polypharmacy Interaction",
    context: {
      age: 70, gender: "male",
      symptoms: ["knee pain"],
      duration: "1 week",
      vitals: { bp: "130/85", pulse: 72, spo2: 98 },
      allergies: [], conditions: ["atrial fibrillation"],
      current_medications: ["warfarin"],
    },
    expected: {
      diagnoses: [],
      labs: [],
      medications: [],
      guidelines: [],
      dangerous_diagnosis_required: false,
      safety_alert_required: "drug interaction",
    },
  },
  {
    name: "10. Pediatric Fever",
    context: {
      age: 5, gender: "male",
      symptoms: ["fever"],
      duration: "1 day",
      vitals: { temperature: 102, bp: "90/60", pulse: 110, spo2: 98 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: [],
      labs: [],
      medications: ["paracetamol"],
      guidelines: [],
      dangerous_diagnosis_required: false,
      safety_alert_required: "dose validation",
    },
  },
];

interface BenchmarkResult {
  name: string;
  result: any;
  error?: string;
}

interface V4TestResult {
  test_name: string;
  passed: boolean;
  failure_reasons: string[];
  diagnosis_match: number;
  lab_match: number;
  medication_match: number;
  guideline_count: number;
  confidence_score: number;
  confidence_label: string;
  latency_ms: number;
  ddx_latency_ms: number | null;
  uncertainty_latency_ms: number | null;
  safety_alerts: number;
  safety_flags: string[];
  dangerous_diagnosis_detected: boolean;
  module_logs: any[];
  modular_diagnoses: string[];
  modular_labs: string[];
  modular_medications: string[];
  modular_guidelines: any[];
  legacy_diagnoses: string[];
  expected: typeof V4_BENCHMARK_TESTS[0]["expected"];
  raw_result: any;
}

// ─── Fuzzy matching helpers ───
function fuzzyMatch(a: string, b: string): boolean {
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return true;
  if (la.includes(lb) || lb.includes(la)) return true;
  // Common aliases
  const aliases: Record<string, string[]> = {
    "paracetamol": ["acetaminophen", "tylenol", "crocin"],
    "myocardial infarction": ["heart attack", "mi", "acute coronary syndrome", "acs"],
    "community-acquired pneumonia": ["cap", "pneumonia"],
    "acute bronchitis": ["bronchitis"],
    "acute gastroenteritis": ["gastroenteritis", "age"],
    "viral infection": ["viral fever", "viral syndrome"],
    "streptococcal pharyngitis": ["strep throat", "strep pharyngitis"],
    "viral pharyngitis": ["pharyngitis", "sore throat"],
    "bacterial meningitis": ["meningitis"],
    "pulmonary embolism": ["pe"],
    "aortic dissection": ["dissection"],
    "cbc": ["complete blood count", "full blood count", "fbc", "hemogram"],
    "chest x-ray": ["cxr", "chest radiograph", "x-ray chest"],
    "ecg": ["electrocardiogram", "ekg", "12-lead ecg"],
    "d-dimer": ["d dimer"],
    "dengue ns1": ["ns1 antigen", "ns1", "dengue ns1 antigen"],
    "malaria smear": ["peripheral smear", "blood smear", "mp", "malaria parasite"],
    "stool culture": ["stool c/s"],
    "lumbar puncture": ["lp", "spinal tap", "csf analysis"],
    "ors": ["oral rehydration", "oral rehydration salts"],
  };
  for (const [key, vals] of Object.entries(aliases)) {
    const all = [key, ...vals];
    const aMatch = all.some(v => la.includes(v) || v.includes(la));
    const bMatch = all.some(v => lb.includes(v) || v.includes(lb));
    if (aMatch && bMatch) return true;
  }
  return false;
}

function computeFuzzyOverlap(actual: string[], expected: string[]): number {
  if (expected.length === 0) return 100; // no expectation = pass
  if (actual.length === 0) return 0;
  let matches = 0;
  for (const exp of expected) {
    if (actual.some(a => fuzzyMatch(a, exp))) matches++;
  }
  return Math.round((matches / expected.length) * 100);
}

// ─── V4 pass criteria ───
const V4_PASS_CRITERIA = {
  diagnosis_match: 70,
  lab_match: 60,
  medication_match: 70,
  guideline_citations_min: 2,
  latency_max_ms: 20000,
  ddx_latency_max_ms: 1000,
  uncertainty_latency_max_ms: 200,
};

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

  // V4 Benchmark Suite
  const [v4Loading, setV4Loading] = useState(false);
  const [v4Results, setV4Results] = useState<V4TestResult[]>([]);
  const [v4Progress, setV4Progress] = useState(0);
  const [v4Summary, setV4Summary] = useState<any>(null);
  const [v4SelectedTest, setV4SelectedTest] = useState<number | null>(null);

  const runV3Benchmark = async () => {
    setV3Loading(true);
    setV3Results(null);
    setV3Progress(0);
    const totalTests = 8;
    const allResults: any[] = [];
    let passed = 0;
    let failed = 0;
    let errors = 0;

    for (let i = 0; i < totalTests; i++) {
      setV3Progress(Math.round(((i) / totalTests) * 100));
      try {
        const { data, error } = await supabase.functions.invoke("run-clinical-benchmark-suite", {
          body: { benchmark_version: "benchmark_v4_full_reasoning", test_indices: [i] },
        });
        if (error) {
          errors++;
          allResults.push({ test_case: `Test ${i + 1}`, error: error.message, passed: false, failure_reasons: [error.message] });
          continue;
        }
        const testResult = data?.results?.[0];
        if (testResult) {
          allResults.push(testResult);
          if (testResult.passed) passed++;
          else failed++;
        } else {
          errors++;
          allResults.push({ test_case: `Test ${i + 1}`, error: "No result returned", passed: false, failure_reasons: ["No result"] });
        }
      } catch (e: any) {
        errors++;
        allResults.push({ test_case: `Test ${i + 1}`, error: e.message, passed: false, failure_reasons: [e.message] });
      }
    }

    setV3Progress(100);

    const successful = allResults.filter(r => !r.error);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const summary = {
      benchmark_version: "benchmark_v4_full_reasoning",
      total_tests: totalTests,
      passed,
      failed,
      errors,
      avg_diagnosis_agreement: avg(successful.map(r => r.diagnosis_agreement ?? 0)),
      avg_lab_agreement: avg(successful.map(r => r.lab_agreement ?? 0)),
      avg_medication_agreement: avg(successful.map(r => r.medication_agreement ?? 0)),
      avg_guideline_citations: avg(successful.map(r => r.guideline_citations ?? 0)),
      avg_latency_ms: avg(successful.map(r => r.latency_ms ?? 0)),
      avg_confidence_score: successful.length ? Math.round((successful.reduce((a: number, r: any) => a + (r.confidence_score ?? 0), 0) / successful.length) * 100) / 100 : 0,
      avg_ddx_latency_ms: avg(successful.map(r => r.ddx_latency_ms ?? 0)),
      avg_uncertainty_latency_ms: avg(successful.map(r => r.uncertainty_latency_ms ?? 0)),
      avg_safety_alerts: avg(successful.map(r => r.safety_alerts ?? 0)),
      pass_thresholds: {
        diagnosis_agreement: 50,
        lab_agreement: 40,
        medication_agreement: 40,
        guideline_citations_min: 1,
      },
    };

    setV3Results({ summary, results: allResults });
    toast.success(`Benchmark v3 complete: ${passed}/${totalTests} passed`);
    setV3Loading(false);
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
        },
        diagnosis_agreement_rate: avg(diagOverlaps),
        lab_agreement_rate: avg(labOverlaps),
        medication_agreement_rate: avg(medOverlaps),
      });
    }

    setBenchmarkLoading(false);
    toast.success(`Benchmark complete: ${successful.length}/${BENCHMARK_TESTS.length} tests passed`);
  };

  // ═══════════════════════════════════════════
  // V4 BENCHMARK RUNNER
  // ═══════════════════════════════════════════
  const runV4Benchmark = async (singleIndex?: number) => {
    setV4Loading(true);
    if (singleIndex === undefined) {
      setV4Results([]);
      setV4Summary(null);
    }
    setV4Progress(0);

    const tests = singleIndex !== undefined ? [V4_BENCHMARK_TESTS[singleIndex]] : V4_BENCHMARK_TESTS;
    const runGroupId = `v4_${Date.now()}`;
    const allResults: V4TestResult[] = singleIndex !== undefined ? [...v4Results] : [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const globalIdx = singleIndex !== undefined ? singleIndex : i;
      setV4Progress(Math.round((i / tests.length) * 100));

      try {
        const { data, error } = await supabase.functions.invoke("compare-ai-pipelines", {
          body: { patient_context: test.context },
        });

        if (error) {
          const errResult: V4TestResult = {
            test_name: test.name,
            passed: false,
            failure_reasons: [error.message],
            diagnosis_match: 0, lab_match: 0, medication_match: 0,
            guideline_count: 0, confidence_score: 0, confidence_label: "N/A",
            latency_ms: 0, ddx_latency_ms: null, uncertainty_latency_ms: null,
            safety_alerts: 0, safety_flags: [], dangerous_diagnosis_detected: false,
            module_logs: [], modular_diagnoses: [], modular_labs: [],
            modular_medications: [], modular_guidelines: [], legacy_diagnoses: [],
            expected: test.expected, raw_result: null,
          };
          allResults[globalIdx] = errResult;
          setV4Results([...allResults]);
          continue;
        }

        // Extract modular outputs
        const mod = data.modular_pipeline || {};
        const leg = data.legacy_pipeline || {};
        const modDiagnoses: string[] = mod.diagnoses || [];
        const modLabs: string[] = mod.labs || [];
        const modMeds: string[] = mod.medications || [];
        const modGuidelines: any[] = mod.guidelines || [];
        const safetyFlags: string[] = mod.safety_flags || [];
        const moduleLogs: any[] = data.module_execution_logs || [];

        // Compute match rates against expected
        const diagMatch = computeFuzzyOverlap(modDiagnoses, test.expected.diagnoses);
        const labMatch = computeFuzzyOverlap(modLabs, test.expected.labs);
        const medMatch = computeFuzzyOverlap(modMeds, test.expected.medications);
        const guidelineCount = modGuidelines.length;

        // Extract module latencies
        const ddxLog = moduleLogs.find((l: any) => l.module === "ddx_engine");
        const uncLog = moduleLogs.find((l: any) => l.module === "uncertainty_engine");
        const ddxLatency = ddxLog?.latency_ms ?? null;
        const uncLatency = uncLog?.latency_ms ?? null;

        const confidenceScore = mod.uncertainty?.confidence_score ?? 0;
        const confidenceLabel = mod.uncertainty?.confidence_label ?? "N/A";

        // Dangerous diagnosis detection
        const dangerousDetected = modDiagnoses.some((d: string) => {
          const dl = d.toLowerCase();
          return dl.includes("meningitis") || dl.includes("myocardial") || dl.includes("heart attack") ||
            dl.includes("pulmonary embolism") || dl.includes("aortic dissection") || dl.includes("stroke") ||
            dl.includes("acs") || dl.includes("acute coronary");
        }) || (mod.ddx?.dangerous_diagnoses_injected > 0);

        // Safety alert check
        let safetyAlertMet = true;
        if (test.expected.safety_alert_required) {
          const keyword = test.expected.safety_alert_required.toLowerCase();
          safetyAlertMet = safetyFlags.some((f: string) => f.toLowerCase().includes(keyword));
        }

        // Determine pass/fail
        const failureReasons: string[] = [];
        const hasExpectedDx = test.expected.diagnoses.length > 0;
        const hasExpectedLabs = test.expected.labs.length > 0;
        const hasExpectedMeds = test.expected.medications.length > 0;

        if (hasExpectedDx && diagMatch < V4_PASS_CRITERIA.diagnosis_match)
          failureReasons.push(`Dx match ${diagMatch}% < ${V4_PASS_CRITERIA.diagnosis_match}%`);
        if (hasExpectedLabs && labMatch < V4_PASS_CRITERIA.lab_match)
          failureReasons.push(`Lab match ${labMatch}% < ${V4_PASS_CRITERIA.lab_match}%`);
        if (hasExpectedMeds && medMatch < V4_PASS_CRITERIA.medication_match)
          failureReasons.push(`Med match ${medMatch}% < ${V4_PASS_CRITERIA.medication_match}%`);
        if (test.expected.dangerous_diagnosis_required && !dangerousDetected)
          failureReasons.push("Dangerous diagnosis NOT detected");
        if (test.expected.safety_alert_required && !safetyAlertMet)
          failureReasons.push(`Safety alert '${test.expected.safety_alert_required}' NOT triggered`);
        if ((test.expected as any).expect_low_confidence && confidenceScore >= 0.6)
          failureReasons.push(`Expected low confidence but got ${confidenceScore} (${confidenceLabel})`);
        if (mod.latency_ms > V4_PASS_CRITERIA.latency_max_ms)
          failureReasons.push(`Latency ${mod.latency_ms}ms > ${V4_PASS_CRITERIA.latency_max_ms}ms`);

        const testResult: V4TestResult = {
          test_name: test.name,
          passed: failureReasons.length === 0,
          failure_reasons: failureReasons,
          diagnosis_match: diagMatch,
          lab_match: labMatch,
          medication_match: medMatch,
          guideline_count: guidelineCount,
          confidence_score: confidenceScore,
          confidence_label: confidenceLabel,
          latency_ms: mod.latency_ms || 0,
          ddx_latency_ms: ddxLatency,
          uncertainty_latency_ms: uncLatency,
          safety_alerts: safetyFlags.length,
          safety_flags: safetyFlags,
          dangerous_diagnosis_detected: dangerousDetected,
          module_logs: moduleLogs,
          modular_diagnoses: modDiagnoses,
          modular_labs: modLabs,
          modular_medications: modMeds,
          modular_guidelines: modGuidelines,
          legacy_diagnoses: leg.diagnoses || [],
          expected: test.expected,
          raw_result: data,
        };

        allResults[globalIdx] = testResult;
        setV4Results([...allResults]);

        // Store to database (non-blocking)
        supabase.from("ai_pipeline_tests_v4" as any).insert({
          test_name: test.name,
          pipeline_version: "benchmark_v4",
          patient_context: test.context,
          expected_output: test.expected,
          modular_output: mod,
          legacy_output: leg,
          diagnosis_match: diagMatch,
          lab_match: labMatch,
          medication_match: medMatch,
          guideline_count: guidelineCount,
          confidence_score: confidenceScore,
          confidence_label: confidenceLabel,
          latency_ms: mod.latency_ms || 0,
          ddx_latency_ms: ddxLatency,
          uncertainty_latency_ms: uncLatency,
          safety_alerts: safetyFlags.length,
          safety_flags: safetyFlags,
          dangerous_diagnosis_detected: dangerousDetected,
          module_logs: moduleLogs,
          passed: failureReasons.length === 0,
          failure_reasons: failureReasons,
          run_group_id: runGroupId,
        } as any).then(() => {});

      } catch (e: any) {
        const errResult: V4TestResult = {
          test_name: test.name,
          passed: false,
          failure_reasons: [e.message || "Unknown error"],
          diagnosis_match: 0, lab_match: 0, medication_match: 0,
          guideline_count: 0, confidence_score: 0, confidence_label: "N/A",
          latency_ms: 0, ddx_latency_ms: null, uncertainty_latency_ms: null,
          safety_alerts: 0, safety_flags: [], dangerous_diagnosis_detected: false,
          module_logs: [], modular_diagnoses: [], modular_labs: [],
          modular_medications: [], modular_guidelines: [], legacy_diagnoses: [],
          expected: test.expected, raw_result: null,
        };
        allResults[globalIdx] = errResult;
        setV4Results([...allResults]);
      }
    }

    setV4Progress(100);

    // Compute aggregate summary
    const valid = allResults.filter(r => r && r.latency_ms > 0);
    const passedCount = allResults.filter(r => r?.passed).length;
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const avgF = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

    const dangerousTests = V4_BENCHMARK_TESTS.filter(t => t.expected.dangerous_diagnosis_required);
    const dangerousDetectedCount = allResults.filter((r, i) =>
      V4_BENCHMARK_TESTS[i]?.expected.dangerous_diagnosis_required && r?.dangerous_diagnosis_detected
    ).length;

    setV4Summary({
      total_tests: V4_BENCHMARK_TESTS.length,
      tests_passed: passedCount,
      tests_failed: allResults.length - passedCount,
      diagnosis_match_rate: avg(valid.map(r => r.diagnosis_match)),
      lab_match_rate: avg(valid.map(r => r.lab_match)),
      medication_match_rate: avg(valid.map(r => r.medication_match)),
      guideline_citations: avg(valid.map(r => r.guideline_count)),
      dangerous_diagnosis_detection_rate: dangerousTests.length > 0
        ? Math.round((dangerousDetectedCount / dangerousTests.length) * 100) : 100,
      avg_confidence: avgF(valid.map(r => r.confidence_score)),
      avg_latency: avg(valid.map(r => r.latency_ms)),
      avg_ddx_latency: avg(valid.filter(r => r.ddx_latency_ms !== null).map(r => r.ddx_latency_ms!)),
      avg_uncertainty_latency: avg(valid.filter(r => r.uncertainty_latency_ms !== null).map(r => r.uncertainty_latency_ms!)),
      avg_safety_alerts: avg(valid.map(r => r.safety_alerts)),
    });

    toast.success(`Benchmark v4 complete: ${passedCount}/${V4_BENCHMARK_TESTS.length} passed`);
    setV4Loading(false);
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

        <Tabs defaultValue="v4" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="v4"><Zap className="h-3 w-3 mr-1" /> Benchmark v4 (10)</TabsTrigger>
            <TabsTrigger value="single"><Play className="h-3 w-3 mr-1" /> Single Test</TabsTrigger>
            <TabsTrigger value="benchmark"><ListChecks className="h-3 w-3 mr-1" /> Legacy (5)</TabsTrigger>
            <TabsTrigger value="v3"><Trophy className="h-3 w-3 mr-1" /> v3 (8)</TabsTrigger>
          </TabsList>

          {/* ═══ V4 BENCHMARK TAB ═══ */}
          <TabsContent value="v4" className="mt-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Benchmark Suite v4
                  <Badge variant="outline" className="text-[10px]">10 Scenarios · Full Reasoning + Medication Intelligence</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Evaluates Context Engine, DDX Engine, Knowledge Graph, Hypothesis Engine, Guideline Engine, Medication Intelligence, Oversight Safety, Uncertainty Calibration, and SOAP Generator across 10 clinical scenarios.
                </p>

                {/* Test scenario grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {V4_BENCHMARK_TESTS.map((t, i) => {
                    const r = v4Results[i];
                    return (
                      <button
                        key={i}
                        onClick={() => !v4Loading && setV4SelectedTest(v4SelectedTest === i ? null : i)}
                        className={`p-2 rounded border text-xs space-y-1 text-left transition-colors hover:bg-muted/50 ${v4SelectedTest === i ? "border-primary bg-primary/5" : ""}`}
                      >
                        <div className="font-semibold flex items-center gap-1">
                          {r ? (
                            r.passed ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />
                          ) : v4Loading && i === v4Results.filter(Boolean).length ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border shrink-0" />
                          )}
                          <span className="truncate">{t.name}</span>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {t.context.symptoms.join(", ")}
                        </div>
                        {r && r.latency_ms > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="secondary" className="text-[8px]">{r.diagnosis_match}% dx</Badge>
                            <Badge variant="secondary" className="text-[8px]">{r.latency_ms}ms</Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {v4Loading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Running test {v4Results.filter(Boolean).length + 1} of {V4_BENCHMARK_TESTS.length}...</span>
                      <span>{Math.round(v4Progress)}%</span>
                    </div>
                    <Progress value={v4Progress} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={() => runV4Benchmark()} disabled={v4Loading} className="flex-1">
                    {v4Loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                    {v4Loading ? `Running ${v4Results.filter(Boolean).length + 1}/${V4_BENCHMARK_TESTS.length}...` : "Run All 10 Tests"}
                  </Button>
                  {v4SelectedTest !== null && (
                    <Button
                      variant="outline"
                      onClick={() => runV4Benchmark(v4SelectedTest)}
                      disabled={v4Loading}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run #{v4SelectedTest + 1}
                    </Button>
                  )}
                </div>

                {/* Pass criteria reference */}
                <div className="text-[10px] text-muted-foreground bg-muted/30 rounded p-2 space-y-0.5">
                  <p className="font-semibold">v4 Pass Criteria:</p>
                  <p>Dx ≥{V4_PASS_CRITERIA.diagnosis_match}% · Lab ≥{V4_PASS_CRITERIA.lab_match}% · Med ≥{V4_PASS_CRITERIA.medication_match}% · Guidelines ≥{V4_PASS_CRITERIA.guideline_citations_min} · Latency &lt;{V4_PASS_CRITERIA.latency_max_ms / 1000}s · DDX &lt;{V4_PASS_CRITERIA.ddx_latency_max_ms}ms · Uncertainty &lt;{V4_PASS_CRITERIA.uncertainty_latency_max_ms}ms</p>
                </div>
              </CardContent>
            </Card>

            {/* V4 Aggregate Summary */}
            {v4Summary && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Aggregate Benchmark v4 Summary
                    <Badge variant={v4Summary.tests_failed === 0 ? "default" : "destructive"} className="ml-auto text-[10px]">
                      {v4Summary.tests_passed}/{v4Summary.total_tests} Passed
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryStatCard label="Tests Passed" value={`${v4Summary.tests_passed}/${v4Summary.total_tests}`} highlight={v4Summary.tests_failed === 0} />
                    <SummaryStatCard label="Dx Match Rate" value={`${v4Summary.diagnosis_match_rate}%`} highlight={v4Summary.diagnosis_match_rate >= 70} />
                    <SummaryStatCard label="Lab Match Rate" value={`${v4Summary.lab_match_rate}%`} highlight={v4Summary.lab_match_rate >= 60} />
                    <SummaryStatCard label="Med Match Rate" value={`${v4Summary.medication_match_rate}%`} highlight={v4Summary.medication_match_rate >= 70} />
                    <SummaryStatCard label="Avg Confidence" value={`${v4Summary.avg_confidence}`} highlight={v4Summary.avg_confidence >= 0.6} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryStatCard label="Avg Latency" value={`${v4Summary.avg_latency}ms`} highlight={v4Summary.avg_latency < 20000} />
                    <SummaryStatCard label="Avg DDX Latency" value={`${v4Summary.avg_ddx_latency}ms`} highlight={v4Summary.avg_ddx_latency < 1000} />
                    <SummaryStatCard label="Avg Unc. Latency" value={`${v4Summary.avg_uncertainty_latency}ms`} highlight={v4Summary.avg_uncertainty_latency < 200} />
                    <SummaryStatCard label="Guideline Citations" value={`${v4Summary.guideline_citations}`} />
                    <SummaryStatCard label="Danger Detection" value={`${v4Summary.dangerous_diagnosis_detection_rate}%`} highlight={v4Summary.dangerous_diagnosis_detection_rate === 100} />
                  </div>

                  <MetricBar label="Diagnosis Match Rate" value={v4Summary.diagnosis_match_rate} />
                  <MetricBar label="Lab Match Rate" value={v4Summary.lab_match_rate} />
                  <MetricBar label="Medication Match Rate" value={v4Summary.medication_match_rate} />
                  <MetricBar label="Dangerous Dx Detection" value={v4Summary.dangerous_diagnosis_detection_rate} />
                  <MetricBar label="Confidence Score" value={Math.round(v4Summary.avg_confidence * 100)} />
                </CardContent>
              </Card>
            )}

            {/* V4 Individual Results */}
            {v4Results.filter(Boolean).map((r, idx) => (
              <Card key={idx} className={r.passed ? "" : "border-destructive/30"}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {r.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    {r.test_name}
                    <Badge variant="secondary" className="ml-auto text-[10px]">{r.latency_ms}ms</Badge>
                    {r.confidence_label !== "N/A" && (
                      <Badge
                        variant={r.confidence_label === "High" ? "default" : r.confidence_label === "Moderate" ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {r.confidence_label} ({r.confidence_score})
                      </Badge>
                    )}
                    {r.dangerous_diagnosis_detected && (
                      <Badge variant="destructive" className="text-[10px]">⚠ Dangerous Dx</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  {/* Match metrics */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`text-center p-2 rounded ${r.diagnosis_match >= V4_PASS_CRITERIA.diagnosis_match ? "bg-green-500/10" : "bg-destructive/10"}`}>
                      <div className="font-bold font-mono">{r.diagnosis_match}%</div>
                      <div className="text-[10px] text-muted-foreground">Dx Match</div>
                    </div>
                    <div className={`text-center p-2 rounded ${r.lab_match >= V4_PASS_CRITERIA.lab_match ? "bg-green-500/10" : r.expected.labs.length === 0 ? "bg-muted/30" : "bg-destructive/10"}`}>
                      <div className="font-bold font-mono">{r.lab_match}%</div>
                      <div className="text-[10px] text-muted-foreground">Lab Match</div>
                    </div>
                    <div className={`text-center p-2 rounded ${r.medication_match >= V4_PASS_CRITERIA.medication_match ? "bg-green-500/10" : r.expected.medications.length === 0 ? "bg-muted/30" : "bg-destructive/10"}`}>
                      <div className="font-bold font-mono">{r.medication_match}%</div>
                      <div className="text-[10px] text-muted-foreground">Med Match</div>
                    </div>
                  </div>

                  {/* Side-by-side: Modular vs Expected */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <p className="font-semibold text-primary">Modular Pipeline</p>
                      <Section title="Diagnoses" items={r.modular_diagnoses} />
                      <Section title="Labs" items={r.modular_labs} />
                      <Section title="Medications" items={r.modular_medications} />
                    </div>
                    <div className="space-y-2">
                      <p className="font-semibold text-muted-foreground">Expected</p>
                      <Section title="Diagnoses" items={r.expected.diagnoses} />
                      <Section title="Labs" items={r.expected.labs} />
                      <Section title="Medications" items={r.expected.medications} />
                    </div>
                  </div>

                  {/* Legacy diagnoses */}
                  {r.legacy_diagnoses.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1 text-muted-foreground">Legacy Pipeline Diagnoses</p>
                      <div className="flex flex-wrap gap-1">
                        {r.legacy_diagnoses.map((d: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Safety flags */}
                  {r.safety_flags.length > 0 && (
                    <div>
                      <p className="font-semibold mb-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Safety Alerts ({r.safety_alerts})</p>
                      <div className="flex flex-wrap gap-1">
                        {r.safety_flags.map((f: string, i: number) => (
                          <Badge key={i} variant="destructive" className="text-[9px]">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Latency details */}
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>Total: {r.latency_ms}ms</span>
                    {r.ddx_latency_ms !== null && <span>DDX: {r.ddx_latency_ms}ms</span>}
                    {r.uncertainty_latency_ms !== null && <span>Uncertainty: {r.uncertainty_latency_ms}ms</span>}
                    <span>Guidelines: {r.guideline_count}</span>
                  </div>

                  {/* Failure reasons */}
                  {r.failure_reasons.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-semibold flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Failure Reasons
                      </p>
                      {r.failure_reasons.map((reason: string, i: number) => (
                        <div key={i} className="text-[10px] text-destructive bg-destructive/5 p-1 rounded">{reason}</div>
                      ))}
                    </div>
                  )}

                  {/* Module logs (collapsible) */}
                  {r.module_logs.length > 0 && <ModuleLogsCard logs={r.module_logs} />}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

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
                  {v3Loading ? `Running test ${Math.min(Math.round(v3Progress / 12.5) + 1, 8)} of 8...` : "Run Clinical Benchmark v3"}
                </Button>
              </CardContent>
            </Card>

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

                  <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
                    <p className="font-semibold">Pass Criteria:</p>
                    <p>Dx ≥{v3Results.summary.pass_thresholds.diagnosis_agreement}% · Lab ≥{v3Results.summary.pass_thresholds.lab_agreement}% · Med ≥{v3Results.summary.pass_thresholds.medication_agreement}% · Guidelines ≥{v3Results.summary.pass_thresholds.guideline_citations_min}</p>
                  </div>
                </CardContent>
              </Card>
            )}

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
        </Tabs>
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
