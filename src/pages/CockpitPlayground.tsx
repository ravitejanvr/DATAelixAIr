import { useState, useEffect, useCallback, useMemo } from "react";
import { isNewPipelineEnabled } from "@/services/feature_flags";
import type { HypothesisEntry, PipelineEvidence, PipelineCompliance } from "@/components/clinical/ClinicalCopilot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import ClinicalCopilot from "@/components/clinical/ClinicalCopilot";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, FileText, AlertTriangle, CheckCircle,
  HeartPulse, User, Sparkles, RotateCcw, ClipboardCheck, Brain,
  Zap, Activity, Stethoscope, Eye,
  Heart, Wind, Droplets, Shield, ChevronDown,
  Beaker, Play, GitCompare, Layers
} from "lucide-react";
import type { SoapSections } from "@/layers/ai-agents/api";
import { EMPTY_SOAP } from "@/layers/ai-agents/api";
import type { SafetyResults } from "@/layers/safety/api";
import { AI_DRAFT_LABEL } from "@/layers/safety/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext } from "@/lib/clinical-context";
import { startPipelineTimer } from "@/layers/monitoring/api";

// ── Presets (same as Clinical.tsx) ──
const COMMON_SYMPTOMS = ["Fever", "Cough", "Headache", "Body ache", "Vomiting", "Diarrhea", "Cold", "Sore throat", "Fatigue", "Chest pain", "Breathlessness", "Abdominal pain", "Dizziness", "Back pain", "Dysuria", "Rash", "Joint pain", "Palpitations", "Neck stiffness", "Syncope", "Sweating", "Nausea", "Photophobia"];
const DURATION_PRESETS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks", "1 month"];
const ONSET_PRESETS = ["Sudden", "Gradual", "Intermittent", "Progressive", "Episodic"];
const SEVERITY_PRESETS = ["Mild", "Moderate", "Severe", "Worsening", "Improving"];
const BODY_LOCATION_PRESETS = ["Head", "Neck", "Chest", "Upper abdomen", "Lower abdomen", "Back", "Limbs", "Generalized", "Left side", "Right side", "Right lower quadrant"];
const RISK_FACTOR_PRESETS = ["Smoking", "Alcohol", "Diabetes", "Hypertension", "Obesity", "Pregnancy", "Immunocompromised", "Recent surgery", "Recent travel", "Occupational exposure"];
const MEDICAL_HISTORY_PRESETS = ["Asthma", "COPD", "Heart failure", "Diabetes mellitus", "Hypertension", "Previous stroke", "Gallstones", "Thyroid disorder", "Chronic kidney disease", "Cancer history"];
const FAMILY_HISTORY_PRESETS = ["Heart disease", "Diabetes", "Cancer", "Stroke", "Autoimmune disease", "Hypertension", "Asthma"];
const EXAM_FINDINGS_PRESETS = ["Neck stiffness", "Wheezing", "Crepitations", "Rebound tenderness", "Guarding", "Focal neurological deficit", "Pallor", "Jaundice", "Lymphadenopathy", "Pedal edema", "Kernig sign"];

const SYMPTOM_EXPANSIONS: Record<string, { label: string; chips: string[] }> = {
  "Fever": { label: "Fever Type", chips: ["Low-grade", "High", "Intermittent", "Continuous"] },
  "Cough": { label: "Cough Type", chips: ["Dry", "Productive", "With blood", "Nocturnal"] },
  "Chest pain": { label: "Character", chips: ["Sharp", "Dull", "Crushing", "Burning", "Radiating"] },
  "Headache": { label: "Pattern", chips: ["Throbbing", "Constant", "One-sided", "Both sides", "With aura"] },
  "Abdominal pain": { label: "Location", chips: ["Upper", "Lower", "Right", "Left", "Diffuse", "Periumbilical"] },
};

// ── Textbook Scenarios ──
interface Scenario {
  name: string;
  description: string;
  patient: { name: string; age: number; gender: string };
  symptoms: string[];
  duration: string;
  onset: string;
  severity: string;
  bodyLocation: string;
  riskFactors: string[];
  medicalHistory: string[];
  familyHistory: string[];
  examFindings: string[];
  vitals: Record<string, number | null>;
  chiefComplaint: string;
}

const SCENARIOS: Scenario[] = [
  {
    name: "Migraine",
    description: "Classic migraine with aura",
    patient: { name: "Test Patient (Migraine)", age: 32, gender: "Female" },
    symptoms: ["Headache", "Nausea", "Photophobia"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", bodyLocation: "Left side",
    riskFactors: [], medicalHistory: [], familyHistory: ["Hypertension"],
    examFindings: [], vitals: { bp_systolic: 120, bp_diastolic: 80, pulse: 76, spo2: 99, temperature: 98.4, respiratory_rate: 16, weight_kg: 62, height_cm: 165, blood_sugar: null },
    chiefComplaint: "Headache",
  },
  {
    name: "Subarachnoid Hemorrhage",
    description: "Thunderclap headache — must-not-miss",
    patient: { name: "Test Patient (SAH)", age: 55, gender: "Male" },
    symptoms: ["Headache", "Vomiting", "Neck stiffness"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Head",
    riskFactors: ["Smoking", "Hypertension"], medicalHistory: ["Hypertension"], familyHistory: ["Stroke"],
    examFindings: ["Neck stiffness", "Kernig sign"], vitals: { bp_systolic: 180, bp_diastolic: 100, pulse: 95, spo2: 97, temperature: 99.0, respiratory_rate: 20, weight_kg: 85, height_cm: 175, blood_sugar: null },
    chiefComplaint: "Headache",
  },
  {
    name: "Acute Coronary Syndrome",
    description: "Classic ACS presentation with risk factors",
    patient: { name: "Test Patient (ACS)", age: 58, gender: "Male" },
    symptoms: ["Chest pain", "Sweating", "Palpitations", "Breathlessness"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Chest",
    riskFactors: ["Smoking", "Diabetes", "Hypertension"], medicalHistory: ["Diabetes mellitus", "Hypertension"], familyHistory: ["Heart disease"],
    examFindings: [], vitals: { bp_systolic: 150, bp_diastolic: 95, pulse: 110, spo2: 94, temperature: 98.6, respiratory_rate: 22, weight_kg: 90, height_cm: 170, blood_sugar: 180 },
    chiefComplaint: "Chest pain",
  },
  {
    name: "Musculoskeletal Chest Pain",
    description: "Benign chest wall pain",
    patient: { name: "Test Patient (MSK)", age: 28, gender: "Female" },
    symptoms: ["Chest pain"],
    duration: "3 days", onset: "Gradual", severity: "Mild", bodyLocation: "Chest",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 110, bp_diastolic: 70, pulse: 72, spo2: 99, temperature: 98.2, respiratory_rate: 14, weight_kg: 55, height_cm: 160, blood_sugar: null },
    chiefComplaint: "Chest pain",
  },
  {
    name: "Appendicitis",
    description: "Acute appendicitis with classic RLQ pain",
    patient: { name: "Test Patient (Appendicitis)", age: 22, gender: "Male" },
    symptoms: ["Abdominal pain", "Nausea", "Fever"],
    duration: "Today", onset: "Progressive", severity: "Severe", bodyLocation: "Right lower quadrant",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: ["Rebound tenderness", "Guarding"], vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 100, spo2: 99, temperature: 101.2, respiratory_rate: 18, weight_kg: 70, height_cm: 175, blood_sugar: null },
    chiefComplaint: "Abdominal pain",
  },
  {
    name: "Gastroenteritis",
    description: "Acute viral gastroenteritis",
    patient: { name: "Test Patient (GE)", age: 30, gender: "Female" },
    symptoms: ["Abdominal pain", "Vomiting", "Diarrhea"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", bodyLocation: "Generalized",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 100, bp_diastolic: 65, pulse: 90, spo2: 99, temperature: 100.4, respiratory_rate: 16, weight_kg: 58, height_cm: 160, blood_sugar: null },
    chiefComplaint: "Abdominal pain",
  },
  {
    name: "Pulmonary Embolism",
    description: "PE with acute dyspnea and tachycardia",
    patient: { name: "Test Patient (PE)", age: 45, gender: "Female" },
    symptoms: ["Chest pain", "Breathlessness", "Palpitations"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Chest",
    riskFactors: ["Recent surgery", "Obesity"], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 100, bp_diastolic: 60, pulse: 120, spo2: 91, temperature: 99.0, respiratory_rate: 28, weight_kg: 95, height_cm: 165, blood_sugar: null },
    chiefComplaint: "Breathlessness",
  },
  {
    name: "Community Pneumonia",
    description: "Community-acquired pneumonia",
    patient: { name: "Test Patient (Pneumonia)", age: 65, gender: "Male" },
    symptoms: ["Fever", "Cough", "Breathlessness", "Chest pain"],
    duration: "5 days", onset: "Progressive", severity: "Moderate", bodyLocation: "Chest",
    riskFactors: ["Smoking"], medicalHistory: ["COPD"], familyHistory: [],
    examFindings: ["Crepitations"], vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 95, spo2: 93, temperature: 102.0, respiratory_rate: 24, weight_kg: 72, height_cm: 170, blood_sugar: null },
    chiefComplaint: "Cough",
  },
];

// ── Vital abnormal ranges ──
const VITAL_ABNORMAL: Record<string, { min?: number; max?: number }> = {
  bp_systolic: { min: 90, max: 140 }, bp_diastolic: { min: 60, max: 90 },
  pulse: { min: 60, max: 100 }, spo2: { min: 95 }, respiratory_rate: { min: 12, max: 20 },
  temperature: { max: 99.4 }, blood_sugar: { min: 70, max: 140 },
};
const isVitalAbnormal = (field: string, value: number | null | undefined): boolean => {
  if (value == null) return false;
  const range = VITAL_ABNORMAL[field];
  if (!range) return false;
  if (range.min != null && value < range.min) return true;
  if (range.max != null && value > range.max) return true;
  return false;
};

// ── Comparison result type ──
interface PipelineSnapshot {
  label: string;
  hypotheses: HypothesisEntry[];
  bayesian: any;
  soap: SoapSections;
  timestamp: number;
}

export default function CockpitPlayground() {
  const { toast } = useToast();

  // ── Mock patient ──
  const [mockPatient, setMockPatient] = useState<Scenario["patient"] | null>(null);

  // ── Cockpit state ──
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedOnset, setSelectedOnset] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedBodyLocation, setSelectedBodyLocation] = useState("");
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>([]);
  const [selectedMedicalHistory, setSelectedMedicalHistory] = useState<string[]>([]);
  const [selectedFamilyHistory, setSelectedFamilyHistory] = useState<string[]>([]);
  const [selectedExamFindings, setSelectedExamFindings] = useState<string[]>([]);
  const [expansionSelections, setExpansionSelections] = useState<Record<string, string[]>>({});
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [patientVitals, setPatientVitals] = useState<any>(null);
  const [symptomSearch, setSymptomSearch] = useState("");

  // ── SOAP ──
  const [soapSections, setSoapSections] = useState<SoapSections>(EMPTY_SOAP);

  // ── Pipeline state ──
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [stageLatencies, setStageLatencies] = useState<Record<string, number>>({});

  // ── Copilot state ──
  const [pipelineHypotheses, setPipelineHypotheses] = useState<HypothesisEntry[]>([]);
  const [pipelineEvidence, setPipelineEvidence] = useState<PipelineEvidence | null>(null);
  const [pipelineCompliance, setPipelineCompliance] = useState<PipelineCompliance | null>(null);
  const [pipelinePhysiology, setPipelinePhysiology] = useState<any>(null);
  const [pipelineBayesian, setPipelineBayesian] = useState<any>(null);
  const [safetyResults, setSafetyResults] = useState<SafetyResults | null>(null);

  // ── Copilot selections ──
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [pendingRx, setPendingRx] = useState<{ drug_name: string; dose: string; frequency: string; duration: string }[]>([]);

  // ── Scenario & comparison ──
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [scenarioOpen, setScenarioOpen] = useState(true);
  const [reasoningLevel, setReasoningLevel] = useState<"doctor" | "explanation" | "debug">("doctor");

  // ── Comparison ──
  const [snapshots, setSnapshots] = useState<PipelineSnapshot[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // ── Scenario loader ──
  const loadScenario = useCallback((scenarioName: string) => {
    const scenario = SCENARIOS.find(s => s.name === scenarioName);
    if (!scenario) return;

    setMockPatient(scenario.patient);
    setSelectedSymptoms(scenario.symptoms);
    setSelectedDuration(scenario.duration);
    setSelectedOnset(scenario.onset);
    setSelectedSeverity(scenario.severity);
    setSelectedBodyLocation(scenario.bodyLocation);
    setSelectedRiskFactors(scenario.riskFactors);
    setSelectedMedicalHistory(scenario.medicalHistory);
    setSelectedFamilyHistory(scenario.familyHistory);
    setSelectedExamFindings(scenario.examFindings);
    setPatientVitals(scenario.vitals);
    setChiefComplaint(scenario.chiefComplaint);
    setExpansionSelections({});
    setPipelineComplete(false);
    setPipelineHypotheses([]);
    setPipelineBayesian(null);
    setSoapSections(EMPTY_SOAP);
    setSelectedDiagnoses([]);
    setSelectedTests([]);
    setSelectedInstructions([]);
    setPendingRx([]);
    setSelectedScenario(scenarioName);
    toast({ title: `Loaded: ${scenarioName}`, description: scenario.description });
  }, [toast]);

  // ── Reset ──
  const resetCase = () => {
    setMockPatient(null);
    setSelectedSymptoms([]); setSelectedDuration(""); setSelectedOnset(""); setSelectedSeverity("");
    setSelectedBodyLocation(""); setSelectedRiskFactors([]); setSelectedMedicalHistory([]);
    setSelectedFamilyHistory([]); setSelectedExamFindings([]); setExpansionSelections({});
    setChiefComplaint(""); setPatientVitals(null); setSymptomSearch("");
    setSoapSections(EMPTY_SOAP); setPipelineComplete(false); setPipelineRunning(false);
    setPipelineHypotheses([]); setPipelineEvidence(null); setPipelineCompliance(null);
    setPipelinePhysiology(null); setPipelineBayesian(null); setSafetyResults(null);
    setSelectedDiagnoses([]); setSelectedTests([]); setSelectedInstructions([]);
    setPendingRx([]); setSelectedScenario(""); setSnapshots([]); setShowComparison(false);
    setPipelineStage(null); setStageLatencies({});
  };

  // ── Run pipeline ──
  const runPipeline = async () => {
    if (selectedSymptoms.length === 0) {
      toast({ title: "No symptoms", description: "Add symptoms before running.", variant: "destructive" });
      return;
    }

    // Snapshot previous run for comparison
    if (pipelineComplete && pipelineHypotheses.length > 0) {
      setSnapshots(prev => [...prev.slice(-2), {
        label: selectedScenario || "Custom",
        hypotheses: [...pipelineHypotheses],
        bayesian: pipelineBayesian ? JSON.parse(JSON.stringify(pipelineBayesian)) : null,
        soap: { ...soapSections },
        timestamp: Date.now(),
      }]);
    }

    setPipelineRunning(true);
    setPipelineComplete(false);
    setPipelineStage("context");
    setStageLatencies({});

    try {
      const { runUnifiedClinicalPipeline } = await import("@/services/clinical_pipeline/orchestrator");
      const { buildClinicalContext } = await import("@/lib/clinical-context");

      const pipelineContext = buildClinicalContext(
        { age: mockPatient?.age ?? 30, gender: mockPatient?.gender ?? "Unknown", medical_history: selectedMedicalHistory, allergies: [], current_medications: [] },
        patientVitals, null,
      );
      if (chiefComplaint) (pipelineContext as any).chief_complaint = chiefComplaint;
      (pipelineContext as any).symptoms = selectedSymptoms;
      if (selectedOnset) (pipelineContext as any).onset_pattern = selectedOnset;
      if (selectedSeverity) (pipelineContext as any).severity = selectedSeverity;
      if (selectedBodyLocation) (pipelineContext as any).body_location = selectedBodyLocation;
      if (selectedRiskFactors.length > 0) (pipelineContext as any).risk_factors = selectedRiskFactors;
      if (selectedFamilyHistory.length > 0) (pipelineContext as any).family_history = selectedFamilyHistory;
      if (selectedDuration) (pipelineContext as any).symptom_duration = selectedDuration;
      if (selectedMedicalHistory.length > 0) {
        (pipelineContext as any).medical_history = [
          ...(pipelineContext.medical_history || []),
          ...selectedMedicalHistory.filter(mh => !(pipelineContext.medical_history || []).includes(mh)),
        ];
      }
      if (selectedExamFindings.length > 0) {
        const existingSymptoms = (pipelineContext as any).symptoms || [];
        (pipelineContext as any).symptoms = [...new Set([...existingSymptoms, ...selectedExamFindings])];
        (pipelineContext as any).exam_findings = selectedExamFindings;
      }
      if (patientVitals?.blood_sugar) (pipelineContext as any).blood_sugar = patientVitals.blood_sugar;

      const result = await runUnifiedClinicalPipeline(
        {
          clinical_context: pipelineContext,
          visit_id: null,
          consultation_id: null,
          clinic_id: null,
          intake_approved: false,
        },
        (stage, data) => {
          setPipelineStage(stage);
          if (data.physiological_context) setPipelinePhysiology(data.physiological_context);
          if (data.bayesian) setPipelineBayesian(data.bayesian);
          if (data.hypotheses?.hypotheses) {
            setPipelineHypotheses(data.hypotheses.hypotheses.map((h: any) => ({
              diagnosis: h.hypothesis || h.diagnosis || h.diagnosis_name || "",
              confidence: h.probability || h.confidence || 0,
              supporting_factors: h.supporting_evidence || h.supporting_factors || [],
              contradicting_factors: h.contradicting_factors || [],
              recommended_tests: h.recommended_tests || [],
            })));
          }
          if (data.evidence) {
            setPipelineEvidence({
              citations: data.evidence.items?.map((i: any) => ({ title: i.title, source: i.source, year: i.year })) || [],
              sources_queried: [], retrieval_confidence: "moderate",
            });
          }
          if (data.guideline_alignment) {
            setPipelineCompliance({
              results: [], guidelines_matched: 0,
              guidelines_sources: data.guideline_alignment.guideline_sources_used || [],
              guideline_sources_used: data.guideline_alignment.guideline_sources_used || [],
              guideline_compliance_score: data.guideline_alignment.guideline_compliance_score || 0,
              conflicts_detected: (data.guideline_alignment.conflicts_detected || []).map((c: any) => ({
                recommendation: c.recommendation || c.prescribed_drug || "",
                conflicting_guideline: c.conflicting_guideline || c.guideline_recommends || "",
                organization: c.organization || c.source || "",
                severity: c.severity || "moderate", explanation: c.explanation || "",
              })),
            });
          }
          if (data.oversight) {
            setSafetyResults({
              normalized_drugs: [], interaction_flags: [], allergy_flags: [],
              dose_warnings: [], vitals_dangers: [], emergency_patterns: [],
              context_completeness: { issues: [], context_complete: true, ai_suggestions_blocked: false },
              confidence_level: "moderate", requires_manual_review: data.oversight.requires_review || false,
              ai_suggestions_blocked: false,
              output_policy: { label: AI_DRAFT_LABEL, conservative_language: true, evidence_required: true },
              timestamp: new Date().toISOString(),
            });
          }
          if (data.stage_latencies) setStageLatencies(prev => ({ ...prev, ...data.stage_latencies }));
        },
      );

      if (result.enabled && result.hybrid_reasoning) {
        const soap = (result.hybrid_reasoning as any).soap;
        if (soap) {
          setSoapSections({
            "Visit Summary": soap.subjective || "",
            "Findings": soap.objective || "",
            "Provisional Diagnosis": soap.assessment || "",
            "Safety Warnings": "", "Treatment Plan": soap.plan || "",
            "Advice": "", "Follow-up": "",
          });
        }
        setStageLatencies(result.stage_latencies);
      }
      setPipelineStage("complete");
      setPipelineComplete(true);
      toast({ title: "Pipeline complete", description: `${result.total_latency_ms}ms total` });
    } catch (err: any) {
      toast({ title: "Pipeline failed", description: err.message, variant: "destructive" });
    } finally {
      setPipelineRunning(false);
      setTimeout(() => setPipelineStage(null), 2000);
    }
  };

  // ── Auto-trigger on scenario load ──
  useEffect(() => {
    if (mockPatient && selectedSymptoms.length >= 1 && !pipelineRunning && !pipelineComplete) {
      const timer = setTimeout(() => runPipeline(), 600);
      return () => clearTimeout(timer);
    }
  }, [mockPatient]);

  // Toggles
  const toggleSymptom = (s: string) => setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleExpansionChip = (symptom: string, chip: string) => {
    setExpansionSelections(prev => {
      const current = prev[symptom] || [];
      return { ...prev, [symptom]: current.includes(chip) ? current.filter(c => c !== chip) : [...current, chip] };
    });
  };

  const updateVital = (field: string, value: string) => {
    setPatientVitals((prev: any) => ({
      ...(prev || {}),
      [field]: value === "" ? null : isNaN(Number(value)) ? value : Number(value),
    }));
  };

  const filteredSymptoms = useMemo(() => {
    if (symptomSearch.length >= 1) {
      return COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(symptomSearch.toLowerCase()) && !selectedSymptoms.includes(s));
    }
    return [];
  }, [symptomSearch, selectedSymptoms]);

  // ── Copilot props ──
  const copilotProps = {
    diagnoses: [], selectedDiagnoses,
    onToggleDiagnosis: (d: string) => setSelectedDiagnoses(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]),
    tests: [], selectedTests,
    onToggleTest: (t: string) => setSelectedTests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]),
    medications: [], selectedMedications: pendingRx,
    onToggleMedication: (rx: any) => {
      if (pendingRx.some(p => p.drug_name === rx.drug)) {
        setPendingRx(prev => prev.filter(p => p.drug_name !== rx.drug));
      } else {
        setPendingRx(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
      }
    },
    safetyResults,
    patientAge: mockPatient?.age,
    allergies: [],
    diagnosis: selectedDiagnoses[0],
    chiefComplaint,
    instructions: [], selectedInstructions,
    onToggleInstruction: (inst: string) => setSelectedInstructions(prev => prev.includes(inst) ? prev.filter(x => x !== inst) : [...prev, inst]),
    hypotheses: pipelineHypotheses.length > 0 ? pipelineHypotheses : undefined,
    pipelineEvidence, pipelineCompliance,
    visitId: null, consultationId: null, clinicId: null,
    pipelineStage: pipelineRunning ? pipelineStage : null,
    stageLatencies,
    physiologicalContext: pipelinePhysiology,
    bayesianResult: pipelineBayesian,
    isAdmin: true,
  };

  return (
    <>
      <SEO title="Cockpit Playground — Admin" description="Test clinical cockpit UI with mock data" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">
        {/* ── Header ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Beaker className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">Cockpit Playground</span>
            <Badge variant="outline" className="text-[10px]">Admin Testing</Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {pipelineRunning && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/5 border border-primary/10">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                <span className="text-[10px] text-primary font-medium">{pipelineStage || "Running…"}</span>
              </div>
            )}

            {pipelineComplete && !pipelineRunning && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={runPipeline}>
                <RotateCcw className="h-2.5 w-2.5" /> Re-analyze
              </Button>
            )}

            {snapshots.length > 0 && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setShowComparison(!showComparison)}>
                <GitCompare className="h-2.5 w-2.5" /> Compare ({snapshots.length})
              </Button>
            )}

            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={resetCase}>
              <RotateCcw className="h-2.5 w-2.5" /> Reset
            </Button>
          </div>
        </div>

        {/* ── Scenario Selector ── */}
        <div className="shrink-0 px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scenarios:</span>
            {SCENARIOS.map(s => (
              <Button
                key={s.name}
                variant={selectedScenario === s.name ? "default" : "outline"}
                size="sm"
                className="h-6 text-[10px] rounded-full"
                onClick={() => loadScenario(s.name)}
              >
                {s.name}
              </Button>
            ))}
          </div>
        </div>

        {/* ── Comparison overlay ── */}
        <AnimatePresence>
          {showComparison && snapshots.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="shrink-0 border-b border-border bg-card overflow-hidden"
            >
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <GitCompare className="h-3.5 w-3.5 text-primary" /> Run Comparison
                  </p>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setShowComparison(false)}>Close</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {snapshots.map((snap, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-2 bg-muted/20">
                      <p className="text-[10px] font-bold text-foreground mb-1">{snap.label} <span className="text-muted-foreground font-normal">({new Date(snap.timestamp).toLocaleTimeString()})</span></p>
                      {snap.hypotheses.slice(0, 5).map((h, hi) => (
                        <div key={hi} className="flex items-center justify-between text-[10px] py-0.5">
                          <span className="text-foreground truncate">{h.diagnosis}</span>
                          <Badge variant="outline" className="text-[9px]">{Math.round(h.confidence * 100)}%</Badge>
                        </div>
                      ))}
                      {snap.bayesian?.diagnoses?.slice(0, 5).map((d: any, di: number) => (
                        <div key={`b-${di}`} className="flex items-center justify-between text-[9px] py-0.5 text-muted-foreground">
                          <span className="truncate font-mono">{d.diagnosis_id?.slice(0, 8)}…</span>
                          <span>{Math.round((d.posterior_probability || 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {/* Current run comparison */}
                {pipelineComplete && pipelineHypotheses.length > 0 && (
                  <div className="rounded-lg border border-primary/20 p-2 bg-primary/5">
                    <p className="text-[10px] font-bold text-primary mb-1">Current Run</p>
                    {pipelineHypotheses.slice(0, 5).map((h, hi) => (
                      <div key={hi} className="flex items-center justify-between text-[10px] py-0.5">
                        <span className="text-foreground truncate">{h.diagnosis}</span>
                        <Badge variant="outline" className="text-[9px]">{Math.round(h.confidence * 100)}%</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Content ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_minmax(320px,1.2fr)_260px]">

          {/* ═══ LEFT: Patient Context & Signals ═══ */}
          <div className="overflow-y-auto border-r border-border">
            <div className="p-2.5 space-y-2">

              {/* Patient Header */}
              <ClinicalCard className="p-3">
                {!mockPatient ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center mb-2">
                      <Stethoscope className="h-5 w-5 text-primary/20" />
                    </div>
                    <p className="text-xs text-muted-foreground">Select a scenario above to begin.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {mockPatient.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground truncate">{mockPatient.name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {mockPatient.age}y · {mockPatient.gender.charAt(0)}
                          </Badge>
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[9px]">Mock</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Chief Complaint */}
                    {chiefComplaint && (
                      <div className="p-2 rounded-lg bg-primary/[0.04] border border-primary/15">
                        <p className="text-[9px] font-semibold text-primary uppercase tracking-widest">Chief Complaint</p>
                        <p className="text-xs text-foreground">{chiefComplaint}
                          {selectedDuration && <span className="text-muted-foreground ml-1">· {selectedDuration}</span>}
                        </p>
                      </div>
                    )}

                    {/* Medical History */}
                    {selectedMedicalHistory.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">Hx:</span>
                        {selectedMedicalHistory.map(h => <Chip key={h} variant="diagnosis" size="sm">{h}</Chip>)}
                      </div>
                    )}
                  </div>
                )}
              </ClinicalCard>

              {/* Vitals Grid */}
              {mockPatient && (
                <ClinicalCard className="p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Vitals
                  </p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[
                      { field: "bp_systolic", label: "BP", icon: Heart, iconClass: "text-destructive", isBp: true },
                      { field: "pulse", label: "HR", icon: Activity, iconClass: "text-primary", unit: "bpm" },
                      { field: "spo2", label: "SpO₂", icon: Droplets, iconClass: "text-primary", unit: "%" },
                      { field: "respiratory_rate", label: "RR", icon: Wind, iconClass: "text-muted-foreground", unit: "/min" },
                    ].map(v => {
                      const abnBpSys = v.isBp && isVitalAbnormal("bp_systolic", patientVitals?.bp_systolic);
                      const abnBpDia = v.isBp && isVitalAbnormal("bp_diastolic", patientVitals?.bp_diastolic);
                      const abnormal = v.isBp ? (abnBpSys || abnBpDia) : isVitalAbnormal(v.field, patientVitals?.[v.field]);
                      return (
                        <div key={v.field} className={`text-center p-2 rounded-xl border transition-all ${abnormal ? "bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20" : "bg-muted/30 border-border hover:bg-muted/50"}`}>
                          <v.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${abnormal ? "text-destructive" : v.iconClass}`} />
                          {v.isBp ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <input type="number" value={patientVitals?.bp_systolic ?? ""} onChange={e => updateVital("bp_systolic", e.target.value)} className={`w-7 text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${abnBpSys ? "text-destructive" : "text-foreground"}`} placeholder="—" />
                              <span className="text-[10px] text-muted-foreground">/</span>
                              <input type="number" value={patientVitals?.bp_diastolic ?? ""} onChange={e => updateVital("bp_diastolic", e.target.value)} className={`w-7 text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${abnBpDia ? "text-destructive" : "text-foreground"}`} placeholder="—" />
                            </div>
                          ) : (
                            <input type="number" value={patientVitals?.[v.field] ?? ""} onChange={e => updateVital(v.field, e.target.value)} className={`w-full text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${abnormal ? "text-destructive" : "text-foreground"}`} placeholder="—" />
                          )}
                          <p className={`text-[8px] mt-0.5 font-medium ${abnormal ? "text-destructive" : "text-muted-foreground"}`}>{v.isBp ? "mmHg" : v.unit || v.label}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { field: "temperature", label: "Temp", unit: "°F", step: "0.1" },
                      { field: "weight_kg", label: "Weight", unit: "kg" },
                      { field: "blood_sugar", label: "Sugar", unit: "mg/dL" },
                      { field: "height_cm", label: "Height", unit: "cm" },
                    ].map(v => {
                      const abnormal = isVitalAbnormal(v.field, patientVitals?.[v.field]);
                      return (
                        <div key={v.field} className={`text-center p-2 rounded-xl border transition-all ${abnormal ? "bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20" : "bg-muted/30 border-border hover:bg-muted/50"}`}>
                          <input type="number" step={v.step || "1"} value={patientVitals?.[v.field] ?? ""} onChange={e => updateVital(v.field, e.target.value)} className={`w-full text-center text-xs font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${abnormal ? "text-destructive" : "text-foreground"}`} placeholder="—" />
                          <p className={`text-[8px] mt-0.5 font-medium ${abnormal ? "text-destructive" : "text-muted-foreground"}`}>{v.unit}</p>
                          <p className="text-[7px] text-muted-foreground">{v.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </ClinicalCard>
              )}

              {/* Symptoms & Modifiers */}
              {mockPatient && (
                <ClinicalCard className="p-3">
                  <ClinicalCardHeader
                    title="Symptoms & Duration"
                    icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                    badge={selectedSymptoms.length > 0 ? <Badge variant="outline" className="text-xs">{selectedSymptoms.length}</Badge> : undefined}
                  />

                  {/* Selected symptoms with expansions */}
                  {selectedSymptoms.length > 0 && (
                    <div className="space-y-1 mt-1.5">
                      {selectedSymptoms.map(symptom => {
                        const expansion = SYMPTOM_EXPANSIONS[symptom];
                        return (
                          <div key={symptom} className="flex items-start gap-1 flex-wrap">
                            <Chip variant="symptom" selected removable onRemove={() => toggleSymptom(symptom)}>{symptom}</Chip>
                            {expansion && expansion.chips.map(chip => (
                              <Chip key={chip} variant="neutral" size="sm" selected={(expansionSelections[symptom] || []).includes(chip)} onClick={() => toggleExpansionChip(symptom, chip)}>{chip}</Chip>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Symptom search */}
                  <div className="relative mt-2">
                    <input type="text" value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && symptomSearch.trim()) { toggleSymptom(symptomSearch.trim()); setSymptomSearch(""); } }}
                      placeholder="+ Search symptoms…"
                      className="w-full h-7 px-2.5 text-[11px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    {filteredSymptoms.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-lg shadow-md z-10 max-h-32 overflow-y-auto">
                        {filteredSymptoms.map(s => (
                          <button key={s} className="w-full text-left px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors" onClick={() => { toggleSymptom(s); setSymptomSearch(""); }}>{s}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Common symptoms quick-add */}
                  <div className="mt-2">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Quick Add</p>
                    <div className="flex flex-wrap gap-1">
                      {COMMON_SYMPTOMS.filter(s => !selectedSymptoms.includes(s)).slice(0, 10).map(s => (
                        <Chip key={s} variant="symptom" size="sm" onClick={() => toggleSymptom(s)}>{s}</Chip>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="mt-3">
                    <ChipGroup label="Duration">
                      {DURATION_PRESETS.map(d => (
                        <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>{d}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Onset */}
                  <div className="mt-2">
                    <ChipGroup label="Onset Pattern">
                      {ONSET_PRESETS.map(o => (
                        <Chip key={o} variant="neutral" selected={selectedOnset === o} onClick={() => setSelectedOnset(selectedOnset === o ? "" : o)}>{o}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Severity */}
                  <div className="mt-2">
                    <ChipGroup label="Severity">
                      {SEVERITY_PRESETS.map(s => (
                        <Chip key={s} variant={s === "Severe" || s === "Worsening" ? "alert" : "neutral"} selected={selectedSeverity === s} onClick={() => setSelectedSeverity(selectedSeverity === s ? "" : s)}>{s}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Location */}
                  <div className="mt-2">
                    <ChipGroup label="Location">
                      {BODY_LOCATION_PRESETS.map(l => (
                        <Chip key={l} variant="neutral" selected={selectedBodyLocation === l} onClick={() => setSelectedBodyLocation(selectedBodyLocation === l ? "" : l)}>{l}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Risk Factors */}
                  <div className="mt-2">
                    <ChipGroup label="Risk Factors">
                      {RISK_FACTOR_PRESETS.map(rf => (
                        <Chip key={rf} variant="alert" size="sm" selected={selectedRiskFactors.includes(rf)} onClick={() => setSelectedRiskFactors(prev => prev.includes(rf) ? prev.filter(x => x !== rf) : [...prev, rf])}>{rf}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Medical History */}
                  <div className="mt-2">
                    <ChipGroup label="Medical History">
                      {MEDICAL_HISTORY_PRESETS.map(mh => (
                        <Chip key={mh} variant="diagnosis" size="sm" selected={selectedMedicalHistory.includes(mh)} onClick={() => setSelectedMedicalHistory(prev => prev.includes(mh) ? prev.filter(x => x !== mh) : [...prev, mh])}>{mh}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Family History */}
                  <div className="mt-2">
                    <ChipGroup label="Family History">
                      {FAMILY_HISTORY_PRESETS.map(fh => (
                        <Chip key={fh} variant="neutral" size="sm" selected={selectedFamilyHistory.includes(fh)} onClick={() => setSelectedFamilyHistory(prev => prev.includes(fh) ? prev.filter(x => x !== fh) : [...prev, fh])}>{fh}</Chip>
                      ))}
                    </ChipGroup>
                  </div>

                  {/* Exam Findings */}
                  <div className="mt-2">
                    <ChipGroup label="Exam Findings">
                      {EXAM_FINDINGS_PRESETS.map(ef => (
                        <Chip key={ef} variant="alert" size="sm" selected={selectedExamFindings.includes(ef)} onClick={() => setSelectedExamFindings(prev => prev.includes(ef) ? prev.filter(x => x !== ef) : [...prev, ef])}>{ef}</Chip>
                      ))}
                    </ChipGroup>
                  </div>
                </ClinicalCard>
              )}
            </div>
          </div>

          {/* ═══ CENTER: SOAP Output ═══ */}
          <div className="overflow-y-auto border-r border-border flex flex-col">
            {mockPatient && (
              <div className="p-3 space-y-3 flex-1">
                <ClinicalCard className="p-3 border-primary/15">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">SOAP Output</span>
                    </div>
                    <div className="flex gap-1">
                      <AiDisclosureBadge label="AI Draft" tooltip="Generated by AI pipeline" />
                      <Button variant="outline" size="sm" className="h-5 text-[10px] gap-1" onClick={runPipeline} disabled={pipelineRunning}>
                        <Play className="h-2.5 w-2.5" /> Run Pipeline
                      </Button>
                    </div>
                  </div>

                  {/* Pipeline processing indicator */}
                  <AnimatePresence>
                    {pipelineRunning && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mb-3">
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                          <Brain className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-primary font-medium flex-1">
                            Stage: {pipelineStage || "initializing"}
                          </span>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Stage Latencies */}
                  {Object.keys(stageLatencies).length > 0 && (
                    <div className="mb-3 p-2 rounded-lg bg-muted/30 border border-border">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Pipeline Latency</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {Object.entries(stageLatencies).map(([stage, ms]) => (
                          <span key={stage} className="text-[9px] font-mono text-muted-foreground">
                            {stage}: <span className="text-foreground font-semibold">{ms}ms</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SOAP Sections */}
                  <div className="space-y-3">
                    <div className="rounded-xl border p-3 bg-primary/[0.03] border-primary/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">Subjective</span>
                      </div>
                      <Textarea
                        value={soapSections["Visit Summary"] || `${selectedSymptoms.length > 0 ? `c/o ${selectedSymptoms.join(", ")}` : ""}${selectedDuration ? ` × ${selectedDuration}` : ""}${selectedOnset ? ` | Onset: ${selectedOnset}` : ""}${selectedSeverity ? ` | Severity: ${selectedSeverity}` : ""}`}
                        onChange={e => setSoapSections(prev => ({ ...prev, "Visit Summary": e.target.value }))}
                        rows={3}
                        className="text-xs min-h-[36px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>

                    <div className="rounded-xl border p-3 bg-emerald-500/5 border-emerald-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Objective</span>
                      </div>
                      <Textarea
                        value={soapSections["Findings"] || (() => {
                          const parts: string[] = [];
                          if (patientVitals?.temperature) parts.push(`Temp: ${patientVitals.temperature}°F`);
                          if (patientVitals?.bp_systolic) parts.push(`BP: ${patientVitals.bp_systolic}/${patientVitals.bp_diastolic}`);
                          if (patientVitals?.pulse) parts.push(`HR: ${patientVitals.pulse}`);
                          if (patientVitals?.spo2) parts.push(`SpO₂: ${patientVitals.spo2}%`);
                          if (selectedExamFindings.length > 0) parts.push(`Exam: ${selectedExamFindings.join(", ")}`);
                          return parts.join(", ");
                        })()}
                        onChange={e => setSoapSections(prev => ({ ...prev, "Findings": e.target.value }))}
                        rows={2}
                        className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>

                    <div className="rounded-xl border p-3 bg-amber-500/5 border-amber-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Brain className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Assessment</span>
                      </div>
                      {/* Bayesian differential inline */}
                      {pipelineBayesian?.diagnoses?.length > 0 && (
                        <div className="mb-2 space-y-1">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase">AI Differential</p>
                          {pipelineBayesian.diagnoses.slice(0, 5).map((d: any, i: number) => {
                            const pct = Math.round((d.posterior_probability || 0) * 100);
                            const name = pipelineHypotheses?.find(
                              (h: any) => h.diagnosis && d.supporting_evidence?.some((e: string) => h.supporting_factors?.includes(e))
                            )?.diagnosis || d.diagnosis_id;
                            const isUUID = /^[0-9a-f]{8}-/.test(name);
                            const displayName = isUUID ? (d.supporting_evidence?.[0] || `Dx ${i + 1}`) : name;
                            return (
                              <div key={d.diagnosis_id} className="flex items-center gap-1.5">
                                <Chip variant="diagnosis" size="sm" onClick={() => setSelectedDiagnoses(prev => prev.includes(displayName) ? prev.filter(x => x !== displayName) : [...prev, displayName])}>
                                  {displayName}
                                </Chip>
                                <Badge variant="outline" className="text-[9px]">{pct}%</Badge>
                                {d.must_not_miss && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <Textarea
                        value={soapSections["Provisional Diagnosis"] || selectedDiagnoses.join(", ")}
                        onChange={e => setSoapSections(prev => ({ ...prev, "Provisional Diagnosis": e.target.value }))}
                        rows={2}
                        className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>

                    <div className="rounded-xl border p-3 bg-purple-500/5 border-purple-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ClipboardCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">Plan</span>
                      </div>
                      <Textarea
                        value={soapSections["Treatment Plan"] || ""}
                        onChange={e => setSoapSections(prev => ({ ...prev, "Treatment Plan": e.target.value }))}
                        rows={2}
                        className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>
                  </div>
                </ClinicalCard>

                {/* Active Context Summary */}
                <ClinicalCard className="p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Layers className="h-3 w-3" /> Active Context
                  </p>
                  <div className="space-y-1 text-[10px]">
                    {selectedOnset && <div className="flex justify-between"><span className="text-muted-foreground">Onset</span><span className="font-medium text-foreground">{selectedOnset}</span></div>}
                    {selectedSeverity && <div className="flex justify-between"><span className="text-muted-foreground">Severity</span><span className="font-medium text-foreground">{selectedSeverity}</span></div>}
                    {selectedBodyLocation && <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium text-foreground">{selectedBodyLocation}</span></div>}
                    {selectedDuration && <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium text-foreground">{selectedDuration}</span></div>}
                    {selectedRiskFactors.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Risk Factors</span><span className="font-medium text-foreground">{selectedRiskFactors.join(", ")}</span></div>}
                    {selectedMedicalHistory.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">PMH</span><span className="font-medium text-foreground">{selectedMedicalHistory.join(", ")}</span></div>}
                    {selectedFamilyHistory.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Family Hx</span><span className="font-medium text-foreground">{selectedFamilyHistory.join(", ")}</span></div>}
                    {selectedExamFindings.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Exam</span><span className="font-medium text-foreground">{selectedExamFindings.join(", ")}</span></div>}
                  </div>
                </ClinicalCard>
              </div>
            )}
          </div>

          {/* ═══ RIGHT: AI Copilot ═══ */}
          <div className="overflow-y-auto border-l border-border bg-card/30 hidden lg:block">
            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center relative">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  {pipelineComplete && <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
                </div>
                <span className="text-sm font-semibold text-foreground">AI Copilot</span>
                <Badge className={`text-[10px] ml-auto ${pipelineComplete ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                  {pipelineComplete ? "Active" : "Idle"}
                </Badge>
              </div>
              {mockPatient && <ClinicalCopilot {...copilotProps} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
