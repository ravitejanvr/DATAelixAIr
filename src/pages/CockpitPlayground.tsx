import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { HypothesisEntry, PipelineEvidence, PipelineCompliance } from "@/components/clinical/ClinicalCopilot";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import ClinicalCopilot from "@/components/clinical/ClinicalCopilot";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, FileText, AlertTriangle, CheckCircle,
  HeartPulse, User, Sparkles, RotateCcw, ClipboardCheck, Brain,
  Zap, Activity, Stethoscope, Eye, Search,
  Heart, Wind, Droplets, Shield, ChevronDown, ChevronRight, ChevronUp,
  Beaker, Play, GitCompare, Layers, Thermometer, X,
  TreePine, Edit3, FlaskConical, Pill, Scale
} from "lucide-react";
import type { SoapSections } from "@/layers/ai-agents/api";
import { EMPTY_SOAP } from "@/layers/ai-agents/api";
import type { SafetyResults } from "@/layers/safety/api";
import { AI_DRAFT_LABEL } from "@/layers/safety/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext } from "@/lib/clinical-context";

// ── Presets ──
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

// ── Scenarios ──
interface Scenario {
  name: string;
  description: string;
  patient: { name: string; age: number; gender: string; location?: string; occupation?: string; diet?: string; allergies?: string[]; pregnancyStatus?: string };
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
    patient: { name: "Priya Sharma", age: 32, gender: "Female", location: "Mumbai", occupation: "Software Engineer", diet: "Vegetarian", allergies: [] },
    symptoms: ["Headache", "Nausea", "Photophobia"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", bodyLocation: "Left side",
    riskFactors: [], medicalHistory: [], familyHistory: ["Hypertension"],
    examFindings: [], vitals: { bp_systolic: 120, bp_diastolic: 80, pulse: 76, spo2: 99, temperature: 98.4, respiratory_rate: 16, weight_kg: 62, blood_sugar: null },
    chiefComplaint: "Headache",
  },
  {
    name: "Subarachnoid Hemorrhage",
    description: "Thunderclap headache — must-not-miss",
    patient: { name: "Ramesh Kumar", age: 55, gender: "Male", location: "Delhi", occupation: "Business Owner", diet: "Non-vegetarian", allergies: ["Sulfa drugs"] },
    symptoms: ["Headache", "Vomiting", "Neck stiffness"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Head",
    riskFactors: ["Smoking", "Hypertension"], medicalHistory: ["Hypertension"], familyHistory: ["Stroke"],
    examFindings: ["Neck stiffness", "Kernig sign"], vitals: { bp_systolic: 180, bp_diastolic: 100, pulse: 95, spo2: 97, temperature: 99.0, respiratory_rate: 20, weight_kg: 85, blood_sugar: null },
    chiefComplaint: "Headache",
  },
  {
    name: "Acute Coronary Syndrome",
    description: "Classic ACS presentation with risk factors",
    patient: { name: "Vijay Patel", age: 58, gender: "Male", location: "Ahmedabad", occupation: "Factory Manager", diet: "Non-vegetarian", allergies: [] },
    symptoms: ["Chest pain", "Sweating", "Palpitations", "Breathlessness"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Chest",
    riskFactors: ["Smoking", "Diabetes", "Hypertension"], medicalHistory: ["Diabetes mellitus", "Hypertension"], familyHistory: ["Heart disease"],
    examFindings: [], vitals: { bp_systolic: 150, bp_diastolic: 95, pulse: 110, spo2: 94, temperature: 98.6, respiratory_rate: 22, weight_kg: 90, blood_sugar: 180 },
    chiefComplaint: "Chest pain",
  },
  {
    name: "Musculoskeletal Chest Pain",
    description: "Benign chest wall pain",
    patient: { name: "Anita Desai", age: 28, gender: "Female", location: "Pune", occupation: "Teacher", diet: "Vegetarian", allergies: [] },
    symptoms: ["Chest pain"],
    duration: "3 days", onset: "Gradual", severity: "Mild", bodyLocation: "Chest",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 110, bp_diastolic: 70, pulse: 72, spo2: 99, temperature: 98.2, respiratory_rate: 14, weight_kg: 55, blood_sugar: null },
    chiefComplaint: "Chest pain",
  },
  {
    name: "Appendicitis",
    description: "Acute appendicitis with classic RLQ pain",
    patient: { name: "Arjun Mehta", age: 22, gender: "Male", location: "Bangalore", occupation: "Student", diet: "Non-vegetarian", allergies: [] },
    symptoms: ["Abdominal pain", "Nausea", "Fever"],
    duration: "Today", onset: "Progressive", severity: "Severe", bodyLocation: "Right lower quadrant",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: ["Rebound tenderness", "Guarding"], vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 100, spo2: 99, temperature: 101.2, respiratory_rate: 18, weight_kg: 70, blood_sugar: null },
    chiefComplaint: "Abdominal pain",
  },
  {
    name: "Gastroenteritis",
    description: "Acute viral gastroenteritis",
    patient: { name: "Meera Nair", age: 30, gender: "Female", location: "Chennai", occupation: "Nurse", diet: "Vegetarian", allergies: [] },
    symptoms: ["Abdominal pain", "Vomiting", "Diarrhea"],
    duration: "2 days", onset: "Gradual", severity: "Moderate", bodyLocation: "Generalized",
    riskFactors: [], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 100, bp_diastolic: 65, pulse: 90, spo2: 99, temperature: 100.4, respiratory_rate: 16, weight_kg: 58, blood_sugar: null },
    chiefComplaint: "Abdominal pain",
  },
  {
    name: "Pulmonary Embolism",
    description: "PE with acute dyspnea and tachycardia",
    patient: { name: "Sunita Reddy", age: 45, gender: "Female", location: "Hyderabad", occupation: "Accountant", diet: "Vegetarian", allergies: ["Penicillin"] },
    symptoms: ["Chest pain", "Breathlessness", "Palpitations"],
    duration: "Today", onset: "Sudden", severity: "Severe", bodyLocation: "Chest",
    riskFactors: ["Recent surgery", "Obesity"], medicalHistory: [], familyHistory: [],
    examFindings: [], vitals: { bp_systolic: 100, bp_diastolic: 60, pulse: 120, spo2: 91, temperature: 99.0, respiratory_rate: 28, weight_kg: 95, blood_sugar: null },
    chiefComplaint: "Breathlessness",
  },
  {
    name: "Community Pneumonia",
    description: "Community-acquired pneumonia",
    patient: { name: "Suresh Iyer", age: 65, gender: "Male", location: "Kolkata", occupation: "Retired", diet: "Vegetarian", allergies: [] },
    symptoms: ["Fever", "Cough", "Breathlessness", "Chest pain"],
    duration: "5 days", onset: "Progressive", severity: "Moderate", bodyLocation: "Chest",
    riskFactors: ["Smoking"], medicalHistory: ["COPD"], familyHistory: [],
    examFindings: ["Crepitations"], vitals: { bp_systolic: 130, bp_diastolic: 80, pulse: 95, spo2: 93, temperature: 102.0, respiratory_rate: 24, weight_kg: 72, blood_sugar: null },
    chiefComplaint: "Cough",
  },
];

// ── Vital ranges ──
const VITAL_RANGES: Record<string, { min?: number; max?: number; critMin?: number; critMax?: number }> = {
  bp_systolic: { min: 90, max: 140, critMin: 80, critMax: 180 },
  bp_diastolic: { min: 60, max: 90, critMin: 50, critMax: 120 },
  pulse: { min: 60, max: 100, critMin: 40, critMax: 150 },
  spo2: { min: 95, critMin: 90 },
  respiratory_rate: { min: 12, max: 20, critMax: 30 },
  temperature: { max: 99.4, critMax: 103.0 },
  blood_sugar: { min: 70, max: 140, critMin: 50, critMax: 300 },
};

type VitalStatus = "normal" | "abnormal" | "critical";
const getVitalStatus = (field: string, value: number | null | undefined): VitalStatus => {
  if (value == null) return "normal";
  const r = VITAL_RANGES[field];
  if (!r) return "normal";
  if ((r.critMin != null && value < r.critMin) || (r.critMax != null && value > r.critMax)) return "critical";
  if ((r.min != null && value < r.min) || (r.max != null && value > r.max)) return "abnormal";
  return "normal";
};

const vitalStatusColor = (s: VitalStatus) => {
  if (s === "critical") return "text-destructive bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20";
  if (s === "abnormal") return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-foreground bg-muted/30 border-border";
};

// ── Comparison type ──
interface PipelineSnapshot {
  label: string;
  hypotheses: HypothesisEntry[];
  bayesian: any;
  soap: SoapSections;
  timestamp: number;
}

// ── Context Tree Node types ──
type ContextCategory = "chief_complaint" | "symptoms" | "modifiers" | "risk_factors" | "medical_history" | "family_history" | "exam_findings";

export default function CockpitPlayground() {
  const { toast } = useToast();

  // Patient demographics
  const [mockPatient, setMockPatient] = useState<Scenario["patient"] | null>(null);

  // Cockpit state
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

  // SOAP
  const [soapSections, setSoapSections] = useState<SoapSections>(EMPTY_SOAP);
  const [soapManualEdits, setSoapManualEdits] = useState<Record<string, boolean>>({});

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [stageLatencies, setStageLatencies] = useState<Record<string, number>>({});

  // Copilot state
  const [pipelineHypotheses, setPipelineHypotheses] = useState<HypothesisEntry[]>([]);
  const [pipelineEvidence, setPipelineEvidence] = useState<PipelineEvidence | null>(null);
  const [pipelineCompliance, setPipelineCompliance] = useState<PipelineCompliance | null>(null);
  const [pipelinePhysiology, setPipelinePhysiology] = useState<any>(null);
  const [pipelineBayesian, setPipelineBayesian] = useState<any>(null);
  const [safetyResults, setSafetyResults] = useState<SafetyResults | null>(null);

  // Copilot selections
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [pendingRx, setPendingRx] = useState<{ drug_name: string; dose: string; frequency: string; duration: string }[]>([]);

  // Scenario & comparison
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [reasoningLevel, setReasoningLevel] = useState<"doctor" | "explanation" | "debug">("doctor");
  const [snapshots, setSnapshots] = useState<PipelineSnapshot[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Context tree inline editing
  const [editingCategory, setEditingCategory] = useState<ContextCategory | null>(null);

  // Pipeline run ref for debouncing
  const pipelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pipelineRunIdRef = useRef(0);

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
    setSoapManualEdits({});
    setSelectedDiagnoses([]);
    setSelectedTests([]);
    setSelectedInstructions([]);
    setPendingRx([]);
    setSelectedScenario(scenarioName);
    setEditingCategory(null);
    toast({ title: `Loaded: ${scenarioName}`, description: scenario.description });
  }, [toast]);

  // ── Reset ──
  const resetCase = () => {
    setMockPatient(null);
    setSelectedSymptoms([]); setSelectedDuration(""); setSelectedOnset(""); setSelectedSeverity("");
    setSelectedBodyLocation(""); setSelectedRiskFactors([]); setSelectedMedicalHistory([]);
    setSelectedFamilyHistory([]); setSelectedExamFindings([]); setExpansionSelections({});
    setChiefComplaint(""); setPatientVitals(null); setSymptomSearch("");
    setSoapSections(EMPTY_SOAP); setSoapManualEdits({});
    setPipelineComplete(false); setPipelineRunning(false);
    setPipelineHypotheses([]); setPipelineEvidence(null); setPipelineCompliance(null);
    setPipelinePhysiology(null); setPipelineBayesian(null); setSafetyResults(null);
    setSelectedDiagnoses([]); setSelectedTests([]); setSelectedInstructions([]);
    setPendingRx([]); setSelectedScenario(""); setSnapshots([]); setShowComparison(false);
    setPipelineStage(null); setStageLatencies({}); setEditingCategory(null);
  };

  // ── Generate SOAP Subjective from all selections ──
  const generatedSubjective = useMemo(() => {
    if (!mockPatient) return "";
    const parts: string[] = [];
    const age = mockPatient.age;
    const gender = mockPatient.gender?.toLowerCase();
    const genderLabel = gender === "male" ? "male" : gender === "female" ? "female" : gender || "patient";
    parts.push(`${age}-year-old ${genderLabel}`);
    if (chiefComplaint) {
      parts.push(`presents with ${chiefComplaint.toLowerCase()}`);
    }
    if (selectedDuration) parts.push(`since ${selectedDuration.toLowerCase()}`);
    if (selectedOnset) parts.push(`The onset is ${selectedOnset.toLowerCase()}`);
    if (selectedSeverity) parts.push(`${selectedSeverity.toLowerCase()} in intensity`);
    if (selectedBodyLocation) parts.push(`localized to ${selectedBodyLocation.toLowerCase()}`);
    const assocSymptoms = selectedSymptoms.filter(s => s.toLowerCase() !== chiefComplaint.toLowerCase());
    if (assocSymptoms.length > 0) {
      parts.push(`Associated symptoms include ${assocSymptoms.join(", ").toLowerCase()}`);
    }
    if (selectedRiskFactors.length > 0) parts.push(`Risk factors: ${selectedRiskFactors.join(", ").toLowerCase()}`);
    if (selectedMedicalHistory.length > 0) parts.push(`Past medical history: ${selectedMedicalHistory.join(", ")}`);
    if (selectedFamilyHistory.length > 0) parts.push(`Family history: ${selectedFamilyHistory.join(", ").toLowerCase()}`);
    if (mockPatient.allergies && mockPatient.allergies.length > 0) parts.push(`Known allergies: ${mockPatient.allergies.join(", ")}`);
    return parts.join(". ").replace(/\.\./g, ".") + ".";
  }, [mockPatient, chiefComplaint, selectedDuration, selectedOnset, selectedSeverity, selectedBodyLocation, selectedSymptoms, selectedRiskFactors, selectedMedicalHistory, selectedFamilyHistory]);

  // ── Generate SOAP Objective from vitals + exam ──
  const generatedObjective = useMemo(() => {
    const parts: string[] = [];
    if (patientVitals?.temperature) parts.push(`Temp: ${patientVitals.temperature}°F`);
    if (patientVitals?.bp_systolic) parts.push(`BP: ${patientVitals.bp_systolic}/${patientVitals.bp_diastolic} mmHg`);
    if (patientVitals?.pulse) parts.push(`HR: ${patientVitals.pulse} bpm`);
    if (patientVitals?.spo2) parts.push(`SpO₂: ${patientVitals.spo2}%`);
    if (patientVitals?.respiratory_rate) parts.push(`RR: ${patientVitals.respiratory_rate}/min`);
    if (patientVitals?.blood_sugar) parts.push(`Blood Sugar: ${patientVitals.blood_sugar} mg/dL`);
    if (selectedExamFindings.length > 0) parts.push(`\nExam findings: ${selectedExamFindings.join(", ")}`);
    return parts.join(" | ");
  }, [patientVitals, selectedExamFindings]);

  // ── Run pipeline ──
  const runPipeline = useCallback(async () => {
    if (selectedSymptoms.length === 0) return;

    const runId = ++pipelineRunIdRef.current;

    // Snapshot previous
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
        { age: mockPatient?.age ?? 30, gender: mockPatient?.gender ?? "Unknown", medical_history: selectedMedicalHistory, allergies: mockPatient?.allergies || [], current_medications: [] },
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
          if (runId !== pipelineRunIdRef.current) return;
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

      if (runId !== pipelineRunIdRef.current) return;

      if (result.enabled && result.hybrid_reasoning) {
        const soap = (result.hybrid_reasoning as any).soap;
        if (soap) {
          setSoapSections(prev => ({
            ...prev,
            ...(soapManualEdits["Visit Summary"] ? {} : { "Visit Summary": soap.subjective || "" }),
            ...(soapManualEdits["Findings"] ? {} : { "Findings": soap.objective || "" }),
            "Provisional Diagnosis": soap.assessment || "",
            "Safety Warnings": "",
            "Treatment Plan": soap.plan || "",
            "Advice": "", "Follow-up": "",
          }));
        }
        setStageLatencies(result.stage_latencies);
      }
      setPipelineStage("complete");
      setPipelineComplete(true);
    } catch (err: any) {
      if (runId !== pipelineRunIdRef.current) return;
      toast({ title: "Pipeline failed", description: err.message, variant: "destructive" });
    } finally {
      if (runId === pipelineRunIdRef.current) {
        setPipelineRunning(false);
        setTimeout(() => setPipelineStage(null), 2000);
      }
    }
  }, [selectedSymptoms, selectedDuration, selectedOnset, selectedSeverity, selectedBodyLocation, selectedRiskFactors, selectedMedicalHistory, selectedFamilyHistory, selectedExamFindings, chiefComplaint, mockPatient, patientVitals, pipelineComplete, pipelineHypotheses, pipelineBayesian, soapSections, selectedScenario, soapManualEdits]);

  // ── Auto-trigger pipeline on any context change ──
  const contextFingerprint = useMemo(() => JSON.stringify({
    symptoms: selectedSymptoms, duration: selectedDuration, onset: selectedOnset,
    severity: selectedSeverity, location: selectedBodyLocation, risks: selectedRiskFactors,
    history: selectedMedicalHistory, family: selectedFamilyHistory, exam: selectedExamFindings,
    vitals: patientVitals, cc: chiefComplaint,
  }), [selectedSymptoms, selectedDuration, selectedOnset, selectedSeverity, selectedBodyLocation, selectedRiskFactors, selectedMedicalHistory, selectedFamilyHistory, selectedExamFindings, patientVitals, chiefComplaint]);

  useEffect(() => {
    if (!mockPatient || selectedSymptoms.length === 0) return;
    if (pipelineTimerRef.current) clearTimeout(pipelineTimerRef.current);
    pipelineTimerRef.current = setTimeout(() => {
      runPipeline();
    }, 1200);
    return () => { if (pipelineTimerRef.current) clearTimeout(pipelineTimerRef.current); };
  }, [contextFingerprint, mockPatient]);

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

  // ── Check if context has data ──
  const hasContext = selectedSymptoms.length > 0 || selectedDuration || selectedOnset || selectedSeverity || selectedBodyLocation || selectedRiskFactors.length > 0 || selectedMedicalHistory.length > 0 || selectedFamilyHistory.length > 0 || selectedExamFindings.length > 0;

  // ── Merged diagnoses for Assessment ──
  const mergedDiagnoses = useMemo(() => {
    const hasBayesian = pipelineBayesian?.diagnoses?.length > 0;
    const hasHyp = pipelineHypotheses.length > 0;
    if (!hasBayesian && !hasHyp) return [];
    if (hasBayesian) {
      return pipelineBayesian.diagnoses.slice(0, 5).map((d: any) => {
        const hyp = pipelineHypotheses.find(
          (h: any) => h.diagnosis && d.supporting_evidence?.some((e: string) => h.supporting_factors?.includes(e))
        );
        const name = hyp?.diagnosis || d.diagnosis_id;
        const isUUID = /^[0-9a-f]{8}-/.test(name);
        const displayName = isUUID ? (d.supporting_evidence?.[0] || `Diagnosis ${pipelineBayesian.diagnoses.indexOf(d) + 1}`) : name;
        return {
          name: displayName,
          pct: Math.round((d.posterior_probability || 0) * 100),
          supporting: [...new Set([...(d.supporting_evidence || []), ...(hyp?.supporting_factors || [])])],
          contradicting: hyp?.contradicting_factors || [],
          tests: hyp?.recommended_tests || [],
          mustNotMiss: d.must_not_miss || false,
          bayesian: d,
        };
      });
    }
    return pipelineHypotheses.slice(0, 5).map(h => ({
      name: h.diagnosis,
      pct: Math.round((h.confidence || 0) * 100),
      supporting: h.supporting_factors || [],
      contradicting: h.contradicting_factors || [],
      tests: h.recommended_tests || [],
      mustNotMiss: false,
    }));
  }, [pipelineBayesian, pipelineHypotheses]);

  // ── Recommended tests from all diagnoses ──
  const allRecommendedTests = useMemo(() => {
    const tests = new Set<string>();
    mergedDiagnoses.forEach((d: any) => d.tests?.forEach((t: string) => tests.add(t)));
    pipelineHypotheses.forEach(h => h.recommended_tests?.forEach(t => tests.add(t)));
    return Array.from(tests);
  }, [mergedDiagnoses, pipelineHypotheses]);

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
    allergies: mockPatient?.allergies || [],
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

  // ── Context Tree Section Renderer ──
  const ContextTreeNode = ({ label, icon: Icon, items, color, category, editPresets, variant, isSingle }: {
    label: string; icon: any; items: string[]; color: string; category: ContextCategory;
    editPresets: string[]; variant?: any; isSingle?: boolean;
  }) => {
    const isEditing = editingCategory === category;
    if (items.length === 0 && !isEditing) return null;

    return (
      <div className="group">
        <button
          onClick={() => setEditingCategory(isEditing ? null : category)}
          className="flex items-center gap-1.5 w-full text-left py-1 hover:bg-muted/50 rounded px-1.5 transition-colors"
        >
          <Icon className={`h-3 w-3 ${color} shrink-0`} />
          <span className="text-[11px] font-semibold text-foreground flex-1">{label}</span>
          {items.length > 0 && <Badge variant="outline" className="text-[8px] h-4">{items.length}</Badge>}
          {isEditing ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <Edit3 className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>

        {/* Tree values */}
        {!isEditing && items.length > 0 && (
          <div className="ml-5 mt-0.5 space-y-0.5">
            {items.map(item => (
              <div key={item} className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-0.5 pl-2 border-l border-border">
                <span className="text-foreground">{item}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (category === "symptoms") toggleSymptom(item);
                    else if (category === "risk_factors") setSelectedRiskFactors(p => p.filter(x => x !== item));
                    else if (category === "medical_history") setSelectedMedicalHistory(p => p.filter(x => x !== item));
                    else if (category === "family_history") setSelectedFamilyHistory(p => p.filter(x => x !== item));
                    else if (category === "exam_findings") setSelectedExamFindings(p => p.filter(x => x !== item));
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Inline edit chips */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-5 mt-1 overflow-hidden"
            >
              <div className="flex flex-wrap gap-1 pb-2">
                {editPresets.map(preset => {
                  const isSelected = items.includes(preset);
                  return (
                    <Chip
                      key={preset}
                      variant={variant || "neutral"}
                      size="sm"
                      selected={isSelected}
                      onClick={() => {
                        if (category === "symptoms") toggleSymptom(preset);
                        else if (category === "risk_factors") setSelectedRiskFactors(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                        else if (category === "medical_history") setSelectedMedicalHistory(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                        else if (category === "family_history") setSelectedFamilyHistory(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                        else if (category === "exam_findings") setSelectedExamFindings(p => p.includes(preset) ? p.filter(x => x !== preset) : [...p, preset]);
                      }}
                    >
                      {preset}
                    </Chip>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Single-value tree node for modifiers ──
  const ModifierTreeNode = ({ label, value, presets, color, onSelect }: {
    label: string; value: string; presets: string[]; color: string;
    onSelect: (v: string) => void;
  }) => {
    const category = label.toLowerCase().replace(/\s/g, "_") as ContextCategory;
    const isEditing = editingCategory === (category as any);
    if (!value && !isEditing) return null;

    return (
      <div className="group">
        <button
          onClick={() => setEditingCategory(isEditing ? null : category as any)}
          className="flex items-center gap-1.5 w-full text-left py-0.5 hover:bg-muted/50 rounded px-1.5 transition-colors ml-3"
        >
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <span className="text-[10px] font-medium text-foreground ml-auto">{value || "—"}</span>
          {!isEditing && <Edit3 className="h-2 w-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>

        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="ml-7 mt-0.5 overflow-hidden"
            >
              <div className="flex flex-wrap gap-1 pb-1.5">
                {presets.map(p => (
                  <Chip key={p} variant="neutral" size="sm" selected={value === p}
                    onClick={() => { onSelect(value === p ? "" : p); setEditingCategory(null); }}
                  >
                    {p}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── Likelihood badge ──
  const likelihoodBadge = (pct: number) => {
    if (pct >= 30) return <Badge className="text-[8px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">High</Badge>;
    if (pct >= 15) return <Badge className="text-[8px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">Moderate</Badge>;
    return <Badge variant="outline" className="text-[8px]">Low</Badge>;
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
            <span className="text-sm font-bold text-foreground">Clinical Cockpit Playground</span>
            <Badge variant="outline" className="text-[10px]">Admin</Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Reasoning Level Toggle */}
            <div className="flex items-center bg-muted rounded-full p-0.5 gap-0.5">
              {(["doctor", "explanation", "debug"] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setReasoningLevel(level)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    reasoningLevel === level
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level === "doctor" ? "Doctor" : level === "explanation" ? "Explain" : "Debug"}
                </button>
              ))}
            </div>

            {pipelineRunning && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/5 border border-primary/10">
                <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                <span className="text-[10px] text-primary font-medium">{pipelineStage || "Running…"}</span>
              </div>
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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 border-b border-border bg-card overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <GitCompare className="h-3.5 w-3.5 text-primary" /> Run Comparison
                  </p>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setShowComparison(false)}>Close</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {snapshots.map((snap, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-2 bg-muted/20">
                      <p className="text-[10px] font-bold text-foreground mb-1">{snap.label} <span className="text-muted-foreground font-normal">({new Date(snap.timestamp).toLocaleTimeString()})</span></p>
                      {snap.hypotheses.slice(0, 5).map((h, hi) => (
                        <div key={hi} className="flex items-center justify-between text-[10px] py-0.5">
                          <span className="text-foreground truncate">{h.diagnosis}</span>
                          <Badge variant="outline" className="text-[9px]">{Math.round(h.confidence * 100)}%</Badge>
                        </div>
                      ))}
                    </div>
                  ))}
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══════════ MAIN CONTENT ══════════ */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[300px_1fr_280px]">

          {/* ═══ LEFT: Patient Context ═══ */}
          <div className="overflow-y-auto border-r border-border">
            <div className="p-3 space-y-3">

              {/* SECTION 1: Patient Demographics */}
              {!mockPatient ? (
                <ClinicalCard className="p-6">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center mb-3">
                      <Stethoscope className="h-6 w-6 text-primary/30" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Select a Scenario</p>
                    <p className="text-[11px] text-muted-foreground">Choose a textbook case above to simulate a clinical consultation.</p>
                  </div>
                </ClinicalCard>
              ) : (
                <>
                  <ClinicalCard className="p-3">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {mockPatient.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{mockPatient.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px]">{mockPatient.age}y · {mockPatient.gender}</Badge>
                          {mockPatient.location && <Badge variant="outline" className="text-[9px]">{mockPatient.location}</Badge>}
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[8px]">Simulation</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] border-t border-border pt-2">
                      {mockPatient.occupation && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Occupation</span><span className="text-foreground font-medium">{mockPatient.occupation}</span></div>
                      )}
                      {mockPatient.diet && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Diet</span><span className="text-foreground font-medium">{mockPatient.diet}</span></div>
                      )}
                      {mockPatient.allergies && mockPatient.allergies.length > 0 && (
                        <div className="col-span-2 flex items-center gap-1 mt-1">
                          <Shield className="h-2.5 w-2.5 text-destructive" />
                          <span className="text-[9px] text-destructive font-semibold">Allergies:</span>
                          {mockPatient.allergies.map(a => (
                            <Badge key={a} className="text-[8px] bg-destructive/10 text-destructive border-destructive/20">{a}</Badge>
                          ))}
                        </div>
                      )}
                      {mockPatient.pregnancyStatus && (
                        <div className="col-span-2 flex justify-between"><span className="text-muted-foreground">Pregnancy</span><span className="text-foreground font-medium">{mockPatient.pregnancyStatus}</span></div>
                      )}
                    </div>
                  </ClinicalCard>

                  {/* SECTION 2: Vitals (always visible) */}
                  <ClinicalCard className="p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <HeartPulse className="h-3 w-3 text-primary" /> Vital Signs
                      {pipelineRunning && <Loader2 className="h-2.5 w-2.5 animate-spin text-primary ml-auto" />}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { field: "bp_systolic", label: "BP", icon: Heart, isBp: true, unit: "mmHg" },
                        { field: "pulse", label: "HR", icon: Activity, unit: "bpm" },
                        { field: "spo2", label: "SpO₂", icon: Droplets, unit: "%" },
                        { field: "respiratory_rate", label: "RR", icon: Wind, unit: "/min" },
                        { field: "temperature", label: "Temp", icon: Thermometer, unit: "°F" },
                        { field: "weight_kg", label: "Wt", icon: User, unit: "kg" },
                        { field: "blood_sugar", label: "Sugar", icon: Activity, unit: "mg/dL" },
                      ].map(v => {
                        const status = v.isBp
                          ? (getVitalStatus("bp_systolic", patientVitals?.bp_systolic) === "critical" || getVitalStatus("bp_diastolic", patientVitals?.bp_diastolic) === "critical" ? "critical" : getVitalStatus("bp_systolic", patientVitals?.bp_systolic) === "abnormal" || getVitalStatus("bp_diastolic", patientVitals?.bp_diastolic) === "abnormal" ? "abnormal" : "normal")
                          : getVitalStatus(v.field, patientVitals?.[v.field]);
                        return (
                          <div key={v.field} className={`text-center p-1.5 rounded-lg border transition-all ${vitalStatusColor(status as VitalStatus)}`}>
                            <v.icon className={`h-3 w-3 mx-auto mb-0.5 ${status === "critical" ? "text-destructive" : status === "abnormal" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                            {v.isBp ? (
                              <div className="flex items-center justify-center gap-0.5">
                                <input type="number" value={patientVitals?.bp_systolic ?? ""} onChange={e => updateVital("bp_systolic", e.target.value)}
                                  className="w-6 text-center text-[10px] font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                                <span className="text-[8px] text-muted-foreground">/</span>
                                <input type="number" value={patientVitals?.bp_diastolic ?? ""} onChange={e => updateVital("bp_diastolic", e.target.value)}
                                  className="w-6 text-center text-[10px] font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                              </div>
                            ) : (
                              <input type="number" value={patientVitals?.[v.field] ?? ""} onChange={e => updateVital(v.field, e.target.value)}
                                className="w-full text-center text-[10px] font-bold bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                            )}
                            <p className="text-[7px] mt-0.5 font-medium text-muted-foreground">{v.unit}</p>
                          </div>
                        );
                      })}
                    </div>
                  </ClinicalCard>

                  {/* SECTION 3: Clinical Context Tree */}
                  <ClinicalCard className="p-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <TreePine className="h-3 w-3 text-primary" /> Clinical Context
                    </p>

                    {/* Chief Complaint */}
                    {chiefComplaint && (
                      <div className="flex items-center gap-1.5 py-1 px-1.5 rounded bg-primary/[0.04] border border-primary/10 mb-2">
                        <Brain className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-[10px] text-muted-foreground">Chief Complaint</span>
                        <span className="text-[11px] font-semibold text-foreground ml-auto">{chiefComplaint}</span>
                      </div>
                    )}

                    <div className="space-y-0.5">
                      {/* Symptoms */}
                      <ContextTreeNode
                        label="Symptoms"
                        icon={Stethoscope}
                        items={selectedSymptoms}
                        color="text-blue-600 dark:text-blue-400"
                        category="symptoms"
                        editPresets={COMMON_SYMPTOMS}
                        variant="symptom"
                      />

                      {/* Symptom expansions */}
                      {selectedSymptoms.map(symptom => {
                        const exp = SYMPTOM_EXPANSIONS[symptom];
                        if (!exp) return null;
                        const selected = expansionSelections[symptom] || [];
                        if (selected.length === 0) return null;
                        return (
                          <div key={`exp-${symptom}`} className="ml-7 text-[10px] text-muted-foreground">
                            {selected.map(s => (
                              <span key={s} className="inline-flex items-center gap-0.5 mr-1.5">
                                <span className="text-foreground">{s}</span>
                              </span>
                            ))}
                          </div>
                        );
                      })}

                      {/* Modifiers */}
                      {(selectedDuration || selectedOnset || selectedSeverity || selectedBodyLocation) && (
                        <div className="mt-1">
                          <div className="flex items-center gap-1.5 py-1 px-1.5">
                            <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[11px] font-semibold text-foreground">Modifiers</span>
                          </div>
                          <ModifierTreeNode label="Duration" value={selectedDuration} presets={DURATION_PRESETS} color="" onSelect={setSelectedDuration} />
                          <ModifierTreeNode label="Onset" value={selectedOnset} presets={ONSET_PRESETS} color="" onSelect={setSelectedOnset} />
                          <ModifierTreeNode label="Severity" value={selectedSeverity} presets={SEVERITY_PRESETS} color="" onSelect={setSelectedSeverity} />
                          <ModifierTreeNode label="Location" value={selectedBodyLocation} presets={BODY_LOCATION_PRESETS} color="" onSelect={setSelectedBodyLocation} />
                        </div>
                      )}

                      {/* Risk Factors */}
                      <ContextTreeNode
                        label="Risk Factors"
                        icon={AlertTriangle}
                        items={selectedRiskFactors}
                        color="text-amber-600 dark:text-amber-400"
                        category="risk_factors"
                        editPresets={RISK_FACTOR_PRESETS}
                        variant="alert"
                      />

                      {/* Past Medical History */}
                      <ContextTreeNode
                        label="Past Medical History"
                        icon={FileText}
                        items={selectedMedicalHistory}
                        color="text-purple-600 dark:text-purple-400"
                        category="medical_history"
                        editPresets={MEDICAL_HISTORY_PRESETS}
                        variant="diagnosis"
                      />

                      {/* Family History */}
                      <ContextTreeNode
                        label="Family History"
                        icon={User}
                        items={selectedFamilyHistory}
                        color="text-purple-500 dark:text-purple-300"
                        category="family_history"
                        editPresets={FAMILY_HISTORY_PRESETS}
                      />

                      {/* Exam Findings */}
                      <ContextTreeNode
                        label="Exam Findings"
                        icon={Eye}
                        items={selectedExamFindings}
                        color="text-destructive"
                        category="exam_findings"
                        editPresets={EXAM_FINDINGS_PRESETS}
                        variant="alert"
                      />
                    </div>

                    {/* Quick add if no context yet */}
                    {!hasContext && (
                      <div className="mt-3">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5">Quick Add Symptoms</p>
                        <div className="flex flex-wrap gap-1">
                          {COMMON_SYMPTOMS.slice(0, 12).map(s => (
                            <Chip key={s} variant="symptom" size="sm" onClick={() => toggleSymptom(s)}>{s}</Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Symptom search */}
                    <div className="relative mt-3">
                      <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg border border-border bg-background focus-within:ring-1 focus-within:ring-primary/30">
                        <Search className="h-3 w-3 text-muted-foreground" />
                        <input type="text" value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && symptomSearch.trim()) { toggleSymptom(symptomSearch.trim()); setSymptomSearch(""); } }}
                          placeholder="Search or add symptom…"
                          className="flex-1 text-[11px] bg-transparent border-none outline-none"
                        />
                      </div>
                      {filteredSymptoms.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-lg shadow-md z-10 max-h-32 overflow-y-auto">
                          {filteredSymptoms.map(s => (
                            <button key={s} className="w-full text-left px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors" onClick={() => { toggleSymptom(s); setSymptomSearch(""); }}>{s}</button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add modifiers if not set yet */}
                    {selectedSymptoms.length > 0 && !selectedDuration && !selectedOnset && !selectedSeverity && !selectedBodyLocation && (
                      <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-border">
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5">Add Modifiers</p>
                        <div className="space-y-2">
                          <ChipGroup label="Duration">
                            {DURATION_PRESETS.map(d => <Chip key={d} variant="neutral" size="sm" onClick={() => setSelectedDuration(d)}>{d}</Chip>)}
                          </ChipGroup>
                          <ChipGroup label="Onset">
                            {ONSET_PRESETS.map(o => <Chip key={o} variant="neutral" size="sm" onClick={() => setSelectedOnset(o)}>{o}</Chip>)}
                          </ChipGroup>
                          <ChipGroup label="Severity">
                            {SEVERITY_PRESETS.map(s => <Chip key={s} variant={s === "Severe" || s === "Worsening" ? "alert" : "neutral"} size="sm" onClick={() => setSelectedSeverity(s)}>{s}</Chip>)}
                          </ChipGroup>
                        </div>
                      </div>
                    )}
                  </ClinicalCard>
                </>
              )}
            </div>
          </div>

          {/* ═══ CENTER: SOAP Output ═══ */}
          <div className="overflow-y-auto">
            {mockPatient && (
              <div className="p-4 space-y-4">
                <ClinicalCard className="p-4 border-primary/15">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Clinical Note</span>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <AiDisclosureBadge label="AI Draft" tooltip="Generated by AI pipeline" />
                      {pipelineComplete && (
                        <Badge className="text-[8px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                          <CheckCircle className="h-2 w-2 mr-0.5" /> Pipeline Complete
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* ── Subjective ── */}
                    <div className="rounded-xl border p-3 bg-primary/[0.03] border-primary/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <User className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold uppercase tracking-wide text-primary">Subjective (HPI)</span>
                      </div>
                      <Textarea
                        value={soapManualEdits["Visit Summary"] ? soapSections["Visit Summary"] : (soapSections["Visit Summary"] || generatedSubjective)}
                        onChange={e => {
                          setSoapSections(prev => ({ ...prev, "Visit Summary": e.target.value }));
                          setSoapManualEdits(prev => ({ ...prev, "Visit Summary": true }));
                        }}
                        rows={4}
                        className="text-xs min-h-[60px] resize-y rounded-lg bg-background/80 border-none shadow-sm leading-relaxed"
                      />
                    </div>

                    {/* ── Objective ── */}
                    <div className="rounded-xl border p-3 bg-emerald-500/5 border-emerald-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Objective</span>
                      </div>
                      <Textarea
                        value={soapManualEdits["Findings"] ? soapSections["Findings"] : (soapSections["Findings"] || generatedObjective)}
                        onChange={e => {
                          setSoapSections(prev => ({ ...prev, "Findings": e.target.value }));
                          setSoapManualEdits(prev => ({ ...prev, "Findings": true }));
                        }}
                        rows={2}
                        className="text-xs min-h-[32px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>

                    {/* ── Assessment (Differential Diagnoses) ── */}
                    <div className="rounded-xl border p-3 bg-amber-500/5 border-amber-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Brain className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Assessment (AI Differential)</span>
                      </div>

                      {mergedDiagnoses.length > 0 ? (
                        <div className="space-y-2.5">
                          {mergedDiagnoses.map((d: any, i: number) => (
                            <div key={i} className="rounded-lg border border-border p-2.5 bg-background/60">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                                <span className="text-xs font-semibold text-foreground flex-1">{d.name}</span>
                                {likelihoodBadge(d.pct)}
                                <Badge variant="outline" className="text-[9px] font-mono">{d.pct}%</Badge>
                                {d.mustNotMiss && <AlertTriangle className="h-3 w-3 text-destructive" />}
                              </div>

                              {/* Probability bar */}
                              <div className="h-1 rounded-full bg-muted mb-1.5">
                                <div
                                  className={`h-full rounded-full transition-all ${d.pct >= 30 ? "bg-emerald-500" : d.pct >= 15 ? "bg-amber-500" : "bg-muted-foreground/30"}`}
                                  style={{ width: `${Math.min(d.pct, 100)}%` }}
                                />
                              </div>

                              {reasoningLevel !== "debug" && (
                                <>
                                  {d.supporting.length > 0 && (
                                    <div className="mt-1">
                                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold mb-0.5">Supporting evidence</p>
                                      <div className="flex flex-wrap gap-1">
                                        {d.supporting.slice(0, 6).map((e: string, ei: number) => (
                                          <span key={ei} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">✓ {e}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  {d.contradicting.length > 0 && (
                                    <div className="mt-1">
                                      <p className="text-[9px] text-destructive font-semibold mb-0.5">Against</p>
                                      <div className="flex flex-wrap gap-1">
                                        {d.contradicting.map((e: string, ei: number) => (
                                          <span key={ei} className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">✗ {e}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Explanation mode extras */}
                              {reasoningLevel === "explanation" && d.bayesian && (
                                <div className="mt-1.5 p-1.5 rounded bg-muted/30 border border-border">
                                  <p className="text-[8px] text-muted-foreground font-semibold uppercase mb-0.5">Modifier Contributions</p>
                                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-[8px] font-mono">
                                    {d.bayesian.onset_modifier != null && d.bayesian.onset_modifier !== 1 && <span>Onset: ×{d.bayesian.onset_modifier?.toFixed(2)}</span>}
                                    {d.bayesian.duration_modifier != null && d.bayesian.duration_modifier !== 1 && <span>Duration: ×{d.bayesian.duration_modifier?.toFixed(2)}</span>}
                                    {d.bayesian.risk_modifier != null && d.bayesian.risk_modifier !== 1 && <span>Risk: ×{d.bayesian.risk_modifier?.toFixed(2)}</span>}
                                    {d.bayesian.cluster_modifier != null && d.bayesian.cluster_modifier !== 1 && <span>Cluster: ×{d.bayesian.cluster_modifier?.toFixed(2)}</span>}
                                    {d.bayesian.vital_modifier != null && d.bayesian.vital_modifier !== 1 && <span>Vitals: ×{d.bayesian.vital_modifier?.toFixed(2)}</span>}
                                    {d.bayesian.anatomical_modifier != null && d.bayesian.anatomical_modifier !== 1 && <span>Location: ×{d.bayesian.anatomical_modifier?.toFixed(2)}</span>}
                                  </div>
                                </div>
                              )}

                              {/* Debug mode extras */}
                              {reasoningLevel === "debug" && d.bayesian && (
                                <div className="mt-1.5 p-1.5 rounded bg-muted/40 border border-border font-mono text-[8px] space-y-0.5">
                                  <p className="font-semibold text-muted-foreground uppercase text-[7px]">Bayesian Breakdown</p>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                    <span>Prior: {d.bayesian.prior?.toFixed(4)}</span>
                                    <span>Symptom LH: {d.bayesian.symptom_likelihood?.toFixed(4)}</span>
                                    <span>Onset: ×{d.bayesian.onset_modifier?.toFixed(3)}</span>
                                    <span>Duration: ×{d.bayesian.duration_modifier?.toFixed(3)}</span>
                                    <span>Risk: ×{d.bayesian.risk_modifier?.toFixed(3)}</span>
                                    <span>Cluster: ×{d.bayesian.cluster_modifier?.toFixed(3)}</span>
                                    <span>Vital: ×{d.bayesian.vital_modifier?.toFixed(3)}</span>
                                    <span>Anatomical: ×{d.bayesian.anatomical_modifier?.toFixed(3)}</span>
                                    <span className="col-span-2 font-bold text-primary">Posterior: {d.bayesian.posterior_probability?.toFixed(4)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          {pipelineRunning ? "Generating differential…" : "Add symptoms to generate differential diagnoses."}
                        </p>
                      )}
                    </div>

                    {/* ── Plan ── */}
                    <div className="rounded-xl border p-3 bg-purple-500/5 border-purple-500/15">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ClipboardCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">Plan</span>
                      </div>

                      {/* Recommended Tests */}
                      {allRecommendedTests.length > 0 && (
                        <div className="mb-2.5">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                            <FlaskConical className="h-2.5 w-2.5" /> Recommended Tests
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {allRecommendedTests.map(t => (
                              <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)}
                                onClick={() => setSelectedTests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}>
                                {t}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Treatment plan */}
                      <Textarea
                        value={soapSections["Treatment Plan"] || ""}
                        onChange={e => setSoapSections(prev => ({ ...prev, "Treatment Plan": e.target.value }))}
                        rows={3}
                        placeholder="Treatment plan, disposition, and follow-up recommendations…"
                        className="text-xs min-h-[36px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      />
                    </div>
                  </div>
                </ClinicalCard>

                {/* Debug: Stage Latencies */}
                {reasoningLevel === "debug" && Object.keys(stageLatencies).length > 0 && (
                  <ClinicalCard className="p-3">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" /> Pipeline Latency
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {Object.entries(stageLatencies).map(([stage, ms]) => (
                        <span key={stage} className="text-[9px] font-mono text-muted-foreground">
                          {stage}: <span className={`font-semibold ${(ms as number) > 3000 ? "text-destructive" : "text-foreground"}`}>{ms as number}ms</span>
                        </span>
                      ))}
                    </div>
                  </ClinicalCard>
                )}
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
                  {pipelineComplete ? "Active" : pipelineRunning ? "Running" : "Idle"}
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
