import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { Chip, ChipGroup, PresetChipGroup } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader, SkeletonCard } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import EvidencePanel from "@/components/EvidencePanel";
import ConsultationInput from "@/components/ConsultationInput";
import PatientSelector, { type SelectedPatient } from "@/components/PatientSelector";
import IntakeSummary, { type IntakeData } from "@/components/IntakeSummary";
import ClinicalCopilot from "@/components/clinical/ClinicalCopilot";
import AiDisclosureBadge from "@/components/AiDisclosureBadge";

import ConsultationTimeline from "@/components/ConsultationTimeline";
import ConsultationComplete from "@/components/ConsultationComplete";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Save, FileText,
  Edit3, ShieldCheck, AlertTriangle, XCircle, CheckCircle,
  Languages, HeartPulse, Pill, FlaskConical, User,
  Sparkles, RotateCcw, Clock, ClipboardCheck, Brain, CalendarDays,
  Zap, Activity, Stethoscope, Eye, Search, Moon, Sun,
  Heart, Thermometer, Wind, Droplets, Shield, Mic, PenLine,
  ChevronDown, ChevronUp, Phone, FileUp, X, Send, MessageSquare
} from "lucide-react";
import type { ExtractedData, SoapSections } from "@/layers/ai-agents/api";
import { EMPTY_EXTRACTED, EMPTY_SOAP } from "@/layers/ai-agents/api";
import type { SafetyResults } from "@/layers/safety/api";
import { severityColor, AI_DRAFT_LABEL } from "@/layers/safety/api";
import type { NormalizationMatch } from "@/layers/multilingual/api";
import {
  captureTranscriptEditSignal,
  captureExtractionCorrectionSignal,
  captureDocumentationStyleSignal,
} from "@/layers/learning/api";
import {
  startPipelineTimer,
  emitSafetyAlertMetric,
} from "@/layers/monitoring/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext } from "@/lib/clinical-context";

// Symptom presets
const COMMON_SYMPTOMS = ["Fever", "Cough", "Headache", "Body ache", "Vomiting", "Diarrhea", "Cold", "Sore throat", "Fatigue", "Chest pain", "Breathlessness", "Abdominal pain"];
const DURATION_PRESETS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks", "1 month"];
const MEDICATION_PRESETS = ["Paracetamol", "Ibuprofen", "Azithromycin", "Amoxicillin", "ORS", "Pantoprazole", "Cetirizine"];

// Chief complaint → recommended symptoms map
const CHIEF_COMPLAINT_SYMPTOMS: Record<string, string[]> = {
  "Fever": ["Headache", "Body ache", "Cold", "Fatigue", "Cough"],
  "Cough": ["Fever", "Sore throat", "Breathlessness", "Cold", "Chest pain"],
  "Headache": ["Fever", "Vomiting", "Fatigue", "Dizziness", "Neck stiffness"],
  "Chest pain": ["Breathlessness", "Sweating", "Nausea", "Palpitations", "Dizziness"],
  "Abdominal pain": ["Vomiting", "Diarrhea", "Fever", "Bloating", "Loss of appetite"],
  "Vomiting": ["Fever", "Abdominal pain", "Diarrhea", "Headache", "Dehydration"],
  "Diarrhea": ["Vomiting", "Fever", "Abdominal pain", "Dehydration", "Body ache"],
  "Breathlessness": ["Chest pain", "Cough", "Fever", "Wheezing", "Fatigue"],
  "Cold": ["Fever", "Cough", "Sore throat", "Headache", "Sneezing"],
  "Sore throat": ["Fever", "Cough", "Cold", "Difficulty swallowing", "Headache"],
};

// Dynamic expansions
const SYMPTOM_EXPANSIONS: Record<string, { label: string; chips: string[]; variant: "symptom" | "neutral" }> = {
  "Fever": { label: "Fever Type", chips: ["Low-grade", "High", "Intermittent", "Continuous"], variant: "neutral" },
  "Cough": { label: "Cough Type", chips: ["Dry", "Productive", "With blood", "Nocturnal"], variant: "neutral" },
  "Chest pain": { label: "Character", chips: ["Sharp", "Dull", "Crushing", "Burning", "Radiating"], variant: "neutral" },
  "Headache": { label: "Pattern", chips: ["Throbbing", "Constant", "One-sided", "Both sides", "With aura"], variant: "neutral" },
  "Abdominal pain": { label: "Location", chips: ["Upper", "Lower", "Right", "Left", "Diffuse", "Periumbilical"], variant: "neutral" },
};

// Quick Rx templates
const QUICK_RX_TEMPLATES: Record<string, { drug: string; dose: string; freq: string; dur: string }[]> = {
  "Fever": [
    { drug: "Paracetamol", dose: "650mg", freq: "TID", dur: "3 days" },
    { drug: "ORS", dose: "1 sachet", freq: "BD", dur: "3 days" },
  ],
  "Cough": [
    { drug: "Ambroxol", dose: "30mg", freq: "BD", dur: "5 days" },
    { drug: "Cetirizine", dose: "10mg", freq: "OD", dur: "5 days" },
  ],
};

// AI Copilot maps
const DIAGNOSIS_MAP: Record<string, string[]> = {
  "Fever": ["Viral Fever", "Dengue", "Malaria", "Typhoid"],
  "Cough": ["URTI", "Bronchitis", "Pneumonia"],
  "Headache": ["Tension headache", "Migraine", "Sinusitis"],
  "Chest pain": ["Costochondritis", "GERD", "Angina"],
  "Abdominal pain": ["Gastritis", "Appendicitis", "IBS"],
  "Vomiting": ["Acute Gastroenteritis", "Food poisoning"],
  "Diarrhea": ["Acute Gastroenteritis", "IBS"],
};

const TEST_MAP: Record<string, string[]> = {
  "Fever": ["CBC", "Dengue NS1", "Malaria Antigen", "Widal"],
  "Cough": ["Chest X-Ray", "Sputum Culture", "CBC"],
  "Chest pain": ["ECG", "Troponin", "Chest X-Ray"],
  "Headache": ["CT Brain", "CBC", "ESR"],
  "Abdominal pain": ["USG Abdomen", "CBC", "LFT"],
  "Vomiting": ["CBC", "Serum Electrolytes", "LFT"],
  "Diarrhea": ["Stool Test", "CBC", "Serum Electrolytes"],
};

// Instructions map based on diagnosis/symptoms
const INSTRUCTION_MAP: Record<string, string[]> = {
  "Fever": ["Drink plenty of fluids", "Rest for 2-3 days", "Sponge with lukewarm water if temp > 101°F", "Report if fever persists > 3 days"],
  "Cough": ["Avoid cold drinks/food", "Steam inhalation BD", "Gargle with warm salt water", "Avoid dust and smoke"],
  "Headache": ["Adequate rest and sleep", "Avoid screen time", "Stay hydrated", "Report if worsening or vision changes"],
  "Chest pain": ["Avoid exertion", "Report immediately if pain radiates to arm/jaw", "Follow up in 48 hours"],
  "Abdominal pain": ["Light diet (khichdi, curd rice)", "Avoid spicy/oily food", "Report if vomiting blood or black stools"],
  "Vomiting": ["Sip ORS frequently", "Avoid solid food for 4-6 hours", "BRAT diet when tolerated", "Report if unable to keep fluids down"],
  "Diarrhea": ["ORS after each loose stool", "Avoid dairy products", "BRAT diet", "Report if blood in stool"],
  "Viral Fever": ["Paracetamol only for fever > 100°F", "Monitor platelet count if > 3 days", "Avoid aspirin/ibuprofen if dengue suspected"],
  "Dengue": ["Daily platelet monitoring", "Hydration is key", "Watch for warning signs: abdominal pain, persistent vomiting, bleeding"],
  "URTI": ["Warm fluids", "Steam inhalation", "Honey for throat relief", "Complete antibiotic course if prescribed"],
  "Gastritis": ["Eat small frequent meals", "Avoid NSAIDs on empty stomach", "No alcohol or smoking"],
};

// Abnormal vitals ranges
const VITAL_ABNORMAL: Record<string, { min?: number; max?: number }> = {
  bp_systolic: { min: 90, max: 140 },
  bp_diastolic: { min: 60, max: 90 },
  pulse: { min: 60, max: 100 },
  spo2: { min: 95 },
  respiratory_rate: { min: 12, max: 20 },
  temperature: { max: 99.4 },
  blood_sugar: { min: 70, max: 140 },
};

const isVitalAbnormal = (field: string, value: number | null | undefined): boolean => {
  if (value == null) return false;
  const range = VITAL_ABNORMAL[field];
  if (!range) return false;
  if (range.min != null && value < range.min) return true;
  if (range.max != null && value > range.max) return true;
  return false;
};

const fadeIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

export default function Clinical() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Patient selection
  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);

  // Transcript state
  const [transcript, setTranscript] = useState("");
  const [stabilizedTranscript, setStabilizedTranscript] = useState("");

  // Pipeline processing
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRunningSafety, setIsRunningSafety] = useState(false);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI outputs
  const [extractedData, setExtractedData] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [soapSections, setSoapSections] = useState<SoapSections>(EMPTY_SOAP);
  const [safetyResults, setSafetyResults] = useState<SafetyResults | null>(null);

  const EMPTY_SAFETY: SafetyResults = {
    normalized_drugs: [], interaction_flags: [], allergy_flags: [], dose_warnings: [],
    vitals_dangers: [], emergency_patterns: [],
    context_completeness: { issues: [], context_complete: true, ai_suggestions_blocked: false },
    confidence_level: "high", requires_manual_review: false, ai_suggestions_blocked: false,
    output_policy: { label: AI_DRAFT_LABEL, conservative_language: true, evidence_required: true },
    timestamp: new Date().toISOString(),
  };
  const [normalizationResults, setNormalizationResults] = useState<NormalizationMatch[]>([]);
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  // Session management
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [pendingRxFromSuggestions, setPendingRxFromSuggestions] = useState<{ drug_name: string; dose: string; frequency: string; duration: string }[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [finalizationResults, setFinalizationResults] = useState<any>(null);
  const [isFinalizingConsultation, setIsFinalizingConsultation] = useState(false);

  // Symptom chips
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<string>("");
  const [expansionSelections, setExpansionSelections] = useState<Record<string, string[]>>({});
  const [priorMeds, setPriorMeds] = useState<{ name: string; dose: string; frequency: string }[]>([]);
  const [symptomSearch, setSymptomSearch] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [chiefComplaintSearch, setChiefComplaintSearch] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [medSuggestions, setMedSuggestions] = useState<string[]>([]);
  const [ccSuggestions, setCcSuggestions] = useState<string[]>([]);

  // Clinical Context
  const [clinicalContext, setClinicalContext] = useState<ClinicalContext>(EMPTY_CLINICAL_CONTEXT);
  const [patientVitals, setPatientVitals] = useState<any>(null);

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  // Learning baselines
  const [aiExtractedBaseline, setAiExtractedBaseline] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [aiSoapBaseline, setAiSoapBaseline] = useState<SoapSections>(EMPTY_SOAP);
  const [sessionStartTime] = useState(() => performance.now());
  const [profileClinicId, setProfileClinicId] = useState<string | null>(null);

  // Auto-generate trigger
  const [autoGenerateTriggered, setAutoGenerateTriggered] = useState(false);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(false);

  // Consultation summary & copilot selections
  const [consultationSummary, setConsultationSummary] = useState("");
  const [summaryManuallyEdited, setSummaryManuallyEdited] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedAdvice, setSelectedAdvice] = useState<string[]>([]);
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);

  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);

  // Command bar state
  const [commandQuery, setCommandQuery] = useState("");

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  }, [darkMode]);

  // ── Auto-generate consultation summary (SOAP-like transcript) ──
  const generatedSummary = useMemo(() => {
    const lines: string[] = [];
    const age = selectedPatient?.age;
    const sex = selectedPatient?.gender;

    // S: Subjective
    const subjParts: string[] = [];
    if (age || sex || selectedPatient?.name) {
      subjParts.push(`${age ? `${age}y` : ""}${sex ? ` ${sex.charAt(0)}` : ""}${selectedPatient?.name ? ` (${selectedPatient.name})` : ""}`);
    }
    if (selectedSymptoms.length > 0) {
      subjParts.push(`c/o ${selectedSymptoms.join(", ")}`);
    }
    if (selectedDuration) subjParts.push(`× ${selectedDuration}`);

    const expDetails = Object.entries(expansionSelections)
      .filter(([_, vals]) => vals.length > 0)
      .map(([symptom, vals]) => `${symptom}: ${vals.join(", ")}`);
    if (expDetails.length) subjParts.push(expDetails.join(". "));

    if (intakeData?.chief_complaint && selectedSymptoms.length === 0) {
      subjParts.push(`CC: ${intakeData.chief_complaint}`);
    }
    if (intakeData?.symptom_duration && !selectedDuration) {
      subjParts.push(`Duration: ${intakeData.symptom_duration}`);
    }
    if (subjParts.length) lines.push(`S: ${subjParts.join(". ").replace(/\.\./g, ".")}`);

    // O: Objective (vitals)
    const objParts: string[] = [];
    if (patientVitals?.temperature) objParts.push(`Temp ${patientVitals.temperature}°F`);
    if (patientVitals?.bp_systolic) objParts.push(`BP ${patientVitals.bp_systolic}/${patientVitals.bp_diastolic}`);
    if (patientVitals?.pulse) objParts.push(`HR ${patientVitals.pulse}`);
    if (patientVitals?.spo2) objParts.push(`SpO₂ ${patientVitals.spo2}%`);
    if (patientVitals?.respiratory_rate) objParts.push(`RR ${patientVitals.respiratory_rate}`);
    if (patientVitals?.weight_kg) objParts.push(`Wt ${patientVitals.weight_kg}kg`);
    if (patientVitals?.blood_sugar) objParts.push(`BS(F) ${patientVitals.blood_sugar}`);
    if (objParts.length) lines.push(`O: ${objParts.join(", ")}`);

    // Known history
    const histParts: string[] = [];
    if (priorMeds.length > 0) histParts.push(`Current meds: ${priorMeds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`).join(", ")}`);
    if (selectedPatient?.allergies?.length) histParts.push(`Allergies: ${selectedPatient.allergies.join(", ")}`);
    if (selectedPatient?.current_medications?.length) histParts.push(`Current meds: ${selectedPatient.current_medications.join(", ")}`);
    const conditions = selectedPatient?.medical_history;
    if (conditions && Array.isArray(conditions) && conditions.length > 0) {
      histParts.push(`Hx: ${conditions.map((h: any) => typeof h === "string" ? h : h?.condition || String(h)).join(", ")}`);
    }
    if (histParts.length) lines.push(histParts.join(". "));

    // A: Assessment
    if (selectedDiagnoses.length > 0) {
      lines.push(`A: ${selectedDiagnoses.join(", ")}`);
    }

    // P: Plan
    const planParts: string[] = [];
    if (pendingRxFromSuggestions.length > 0) {
      planParts.push(`Rx: ${pendingRxFromSuggestions.map(r => `${r.drug_name} ${r.dose} ${r.frequency} × ${r.duration}`).join("; ")}`);
    }
    if (selectedTests.length > 0) {
      planParts.push(`Labs: ${selectedTests.join(", ")}`);
    }
    if (selectedInstructions.length > 0) {
      planParts.push(`Advice: ${selectedInstructions.join("; ")}`);
    }
    if (planParts.length) lines.push(`P: ${planParts.join(". ")}`);

    // Recording only if it adds new info not already in the structured fields
    if (transcript.trim()) lines.push(`\nNotes: ${transcript}`);

    return lines.join("\n");
  }, [selectedPatient, selectedSymptoms, selectedDuration, patientVitals, expansionSelections, priorMeds, selectedDiagnoses, pendingRxFromSuggestions, selectedTests, selectedInstructions, transcript, intakeData]);

  // Auto-update summary unless manually edited
  useEffect(() => {
    if (!summaryManuallyEdited && generatedSummary) {
      setConsultationSummary(generatedSummary);
    }
  }, [generatedSummary, summaryManuallyEdited]);

  // ── Auto-save consultation draft every 15 seconds ──
  const DRAFT_KEY = "dataelixair_consultation_draft";

  useEffect(() => {
    if (!selectedPatient || savedSessionId) return;
    const interval = setInterval(() => {
      const draft = {
        timestamp: Date.now(),
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.name,
        visit_id: visitId,
        transcript,
        stabilizedTranscript,
        selectedSymptoms,
        selectedDuration,
        expansionSelections,
        priorMeds,
        extractedData,
        soapSections,
        pendingRxFromSuggestions,
        selectedDiagnoses,
        selectedTests,
        selectedAdvice,
        followUpDate,
        followUpNotes,
        consultationSummary,
      };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch { /* storage full — ignore */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedPatient, savedSessionId, visitId, transcript, stabilizedTranscript, selectedSymptoms, selectedDuration, expansionSelections, priorMeds, extractedData, soapSections, pendingRxFromSuggestions, selectedDiagnoses, selectedTests, selectedAdvice, followUpDate, followUpNotes, consultationSummary]);

  // ── Recover draft on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (Date.now() - draft.timestamp > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      if (!selectedPatient && draft.patient_name) {
        toast({
          title: "Draft recovered",
          description: `Unsaved consultation for ${draft.patient_name}. Select the patient to restore.`,
          duration: 8000,
        });
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Clear draft after successful save
  useEffect(() => {
    if (savedSessionId) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [savedSessionId]);

  // Sync symptom chips to extracted data
  useEffect(() => {
    if (selectedSymptoms.length > 0) {
      const complaint = selectedSymptoms[0];
      const associated = selectedSymptoms.slice(1).join(", ");
      const expansionDetails = Object.entries(expansionSelections)
        .filter(([_, vals]) => vals.length > 0)
        .map(([symptom, vals]) => `${symptom}: ${vals.join(", ")}`)
        .join("; ");
      setExtractedData(prev => ({
        ...prev,
        chief_complaint: prev.chief_complaint || complaint,
        associated_symptoms: [associated, expansionDetails].filter(Boolean).join(". ") || prev.associated_symptoms,
      }));
    }
  }, [selectedSymptoms, expansionSelections]);

  useEffect(() => {
    if (selectedDuration) setExtractedData(prev => ({ ...prev, duration: selectedDuration }));
  }, [selectedDuration]);

  // Auto-trigger pipeline when enough context exists
  useEffect(() => {
    if (autoGenerateTriggered || pipelineRunning || pipelineComplete) return;
    const hasEnoughContext = (selectedSymptoms.length >= 2 && selectedDuration !== "") || transcript.trim().length > 50;
    if (hasEnoughContext && selectedPatient) {
      setAutoGenerateTriggered(true);
      const timer = setTimeout(() => runFullPipeline(), 800);
      return () => clearTimeout(timer);
    }
  }, [selectedSymptoms, selectedDuration, selectedPatient, autoGenerateTriggered, pipelineRunning, pipelineComplete, transcript]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.clinic_id) setProfileClinicId(data.clinic_id);
    });
    const state = window.history.state?.usr;
    if (state?.patient) setSelectedPatient(state.patient);
    if (state?.queuePatient) {
      const qp = state.queuePatient;
      setSelectedPatient({ id: qp.id, name: qp.name, age: qp.age, gender: qp.gender, phone: qp.phone, allergies: null, current_medications: null, medical_history: null, created_at: "" });
    }
    if (state?.visitId) setVisitId(state.visitId);
    if (state?.intakeData) {
      setIntakeData(state.intakeData as IntakeData);
      const id = state.intakeData as IntakeData;
      setExtractedData(prev => ({
        ...prev,
        chief_complaint: id.chief_complaint || prev.chief_complaint,
        allergies: id.allergies_noted || prev.allergies,
        current_medications: id.current_medications || prev.current_medications,
      }));
    }
  }, [user]);

  useEffect(() => {
    if (selectedPatient) {
      if (selectedPatient.allergies?.length) setExtractedData(prev => ({ ...prev, allergies: selectedPatient.allergies!.join(", ") }));
      if (selectedPatient.current_medications?.length) setExtractedData(prev => ({ ...prev, current_medications: selectedPatient.current_medications!.join(", ") }));
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (!selectedPatient?.id) { setPatientVitals(null); return; }
    (async () => {
      const { data } = await supabase.from("vitals")
        .select("bp_systolic, bp_diastolic, pulse, temperature, spo2, respiratory_rate, weight_kg, height_cm, blood_sugar")
        .eq("patient_id", selectedPatient.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setPatientVitals(data);
    })();
  }, [selectedPatient?.id]);

  useEffect(() => {
    const ctx = buildClinicalContext(
      selectedPatient ? { age: selectedPatient.age, gender: selectedPatient.gender, medical_history: selectedPatient.medical_history, allergies: selectedPatient.allergies, current_medications: selectedPatient.current_medications } : null,
      patientVitals, intakeData ? { chief_complaint: intakeData.chief_complaint, symptom_duration: intakeData.symptom_duration, allergies_noted: intakeData.allergies_noted, current_medications: intakeData.current_medications } : null,
      extractedData.chief_complaint, extractedData.duration, extractedData.current_medications, extractedData.allergies,
    );
    setClinicalContext(ctx);
  }, [selectedPatient, patientVitals, intakeData, extractedData]);

  const hasTranscript = transcript.trim().length > 0;
  const hasExtraction = extractedData.chief_complaint.trim().length > 0;
  const hasSoap = Object.values(soapSections).some(v => v.trim().length > 0);
  const isProcessing = isStabilizing || isExtracting || isRunningSafety || isGeneratingSoap;
  const hasSymptomInput = selectedSymptoms.length > 0 || hasTranscript;

  const timelineSteps = [
    { label: "Patient", status: selectedPatient ? "done" as const : "pending" as const },
    { label: "Intake", status: (selectedSymptoms.length > 0 || intakeData) ? "done" as const : "pending" as const },
    { label: "Record", status: hasTranscript ? "done" as const : "pending" as const },
    { label: "Review", status: isProcessing ? "active" as const : pipelineComplete ? "done" as const : consultationSummary ? "done" as const : "pending" as const },
    { label: "Finalize", status: isFinalizingConsultation ? "active" as const : finalizationResults ? "done" as const : "pending" as const },
  ];

  const activeExpansions = selectedSymptoms.filter(s => SYMPTOM_EXPANSIONS[s]);
  const contextualRx = selectedSymptoms.flatMap(s => QUICK_RX_TEMPLATES[s] || []);

  const copilotDiagnoses = useMemo(() => {
    const set = new Set<string>();
    selectedSymptoms.forEach(s => (DIAGNOSIS_MAP[s] || []).forEach(d => set.add(d)));
    return Array.from(set);
  }, [selectedSymptoms]);

  const copilotTests = useMemo(() => {
    const set = new Set<string>();
    selectedSymptoms.forEach(s => (TEST_MAP[s] || []).forEach(t => set.add(t)));
    return Array.from(set);
  }, [selectedSymptoms]);

  // Generate instruction suggestions based on symptoms + diagnoses
  const copilotInstructions = useMemo(() => {
    const set = new Set<string>();
    [...selectedSymptoms, ...selectedDiagnoses].forEach(key => {
      (INSTRUCTION_MAP[key] || []).forEach(inst => set.add(inst));
    });
    return Array.from(set);
  }, [selectedSymptoms, selectedDiagnoses]);

  const safetyAlertCount = safetyResults ? (safetyResults.interaction_flags.length + safetyResults.allergy_flags.length + safetyResults.dose_warnings.length + (safetyResults.vitals_dangers?.length || 0) + (safetyResults.emergency_patterns?.length || 0)) : 0;

  // ── Full AI Pipeline ──
  const runFullPipeline = async () => {
    let effectiveTranscript = transcript.trim();
    if (!effectiveTranscript && selectedSymptoms.length > 0) {
      const expansionDetails = Object.entries(expansionSelections)
        .filter(([_, vals]) => vals.length > 0)
        .map(([symptom, vals]) => `${symptom} characteristics: ${vals.join(", ")}`)
        .join(". ");
      const medsContext = priorMeds.length > 0 ? ` Patient has already taken: ${priorMeds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ""}`).join(", ")}.` : "";
      effectiveTranscript = `Patient presents with ${selectedSymptoms.join(", ")}. Duration: ${selectedDuration || "not specified"}.${expansionDetails ? ` ${expansionDetails}.` : ""}${medsContext}`;
      setTranscript(effectiveTranscript);
    }
    if (!effectiveTranscript) return;

    setPipelineRunning(true); setPipelineComplete(false);
    setIsStabilizing(true); setIsExtracting(true); setIsRunningSafety(true); setIsGeneratingSoap(true);

    const timer = startPipelineTimer("full_pipeline");
    try {
      const { data, error } = await supabase.functions.invoke("run-ai-pipeline", {
        body: {
          transcript: effectiveTranscript,
          clinic_id: profileClinicId,
          clinical_context: clinicalContext,
          intake_data: intakeData,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data.stabilized_transcript) {
        setStabilizedTranscript(data.stabilized_transcript);
        setTranscript(data.stabilized_transcript);
      }
      setNormalizationResults(data.normalization_results || []);
      setDetectedLanguages(data.detected_languages || []);
      setIsStabilizing(false);

      if (data.extracted_data) {
        setExtractedData(data.extracted_data);
        setAiExtractedBaseline({ ...data.extracted_data });
      }
      setIsExtracting(false);

      if (data.safety_results) {
        setSafetyResults(data.safety_results as SafetyResults);
        emitSafetyAlertMetric({
          interactions: data.safety_results.interaction_flags?.length || 0,
          allergies: data.safety_results.allergy_flags?.length || 0,
          dose_warnings: data.safety_results.dose_warnings?.length || 0,
          vitals_dangers: data.safety_results.vitals_dangers?.length || 0,
          emergency_patterns: data.safety_results.emergency_patterns?.length || 0,
        });
      }
      setIsRunningSafety(false);

      if (data.ai_suggestions_blocked) {
        toast({ title: "Incomplete Clinical Context", description: "Please fill required fields.", variant: "destructive" });
        setPipelineRunning(false); setIsGeneratingSoap(false); return;
      }

      if (data.soap_sections) {
        setSoapSections(data.soap_sections);
        setAiSoapBaseline({ ...data.soap_sections });
        if (data.soap_sections["Follow-up"]) setFollowUpNotes(prev => prev || data.soap_sections["Follow-up"]);
      }
      setIsGeneratingSoap(false);

      timer.stop(true, { total_duration_ms: data.total_duration_ms, stage_timings: data.stage_timings });
      setPipelineComplete(true);
    } catch (err: any) {
      toast({ title: "AI Pipeline failed", description: err.message, variant: "destructive" });
      timer.stop(false);
    } finally {
      setPipelineRunning(false);
      setIsStabilizing(false); setIsExtracting(false); setIsRunningSafety(false); setIsGeneratingSoap(false);
    }
  };

  const runSafetyCheck = async () => {
    setIsRunningSafety(true);
    const timer = startPipelineTimer("safety_controller");
    try {
      const medications = extractedData.current_medications?.split(",").map(s => s.trim()).filter(Boolean) || [];
      const allergies = extractedData.allergies?.split(",").map(s => s.trim()).filter(Boolean) || [];
      const vitalsText = extractedData.vitals || "";
      const parseVital = (pattern: RegExp): number | null => { const m = vitalsText.match(pattern); return m ? parseFloat(m[1]) : null; };
      const vitalsObj: Record<string, number | null> = {
        bp_systolic: parseVital(/(\d{2,3})\s*\/\s*\d+/), bp_diastolic: parseVital(/\d+\s*\/\s*(\d{2,3})/),
        pulse: parseVital(/(?:pulse|hr|heart\s*rate)[:\s]*(\d+)/i) ?? parseVital(/(\d{2,3})\s*bpm/i),
        temperature: parseVital(/(?:temp|temperature)[:\s]*([\d.]+)/i),
        spo2: parseVital(/(?:spo2|sp02|o2\s*sat|oxygen)[:\s]*(\d+)/i),
        respiratory_rate: parseVital(/(?:rr|resp|respiratory)[:\s]*(\d+)/i),
        blood_sugar: parseVital(/(?:sugar|glucose|bs|rbs)[:\s]*(\d+)/i),
      };
      const symptoms = [extractedData.chief_complaint, extractedData.associated_symptoms].filter(Boolean).join(", ").split(",").map(s => s.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("clinical-safety", { body: { medications, allergies, vitals: vitalsObj, symptoms } });
      if (error) throw new Error(error.message);
      setSafetyResults(data as SafetyResults); timer.stop(true);
      emitSafetyAlertMetric({ interactions: data.interaction_flags?.length || 0, allergies: data.allergy_flags?.length || 0, dose_warnings: data.dose_warnings?.length || 0, vitals_dangers: data.vitals_dangers?.length || 0, emergency_patterns: data.emergency_patterns?.length || 0 });
    } catch (err: any) {
      toast({ title: "Safety check notice", description: err.message || "Could not complete" }); timer.stop(false);
    } finally { setIsRunningSafety(false); }
  };

  // ── Validate ──
  const runValidation = async () => {
    setIsValidating(true);
    try {
      setIsRunningSafety(true);
      const timer = startPipelineTimer("safety_controller");
      const medications = [
        ...(extractedData.current_medications?.split(",").map(s => s.trim()).filter(Boolean) || []),
        ...pendingRxFromSuggestions.map(r => `${r.drug_name} ${r.dose} ${r.frequency}`),
      ];
      const allergies = [
        ...(extractedData.allergies?.split(",").map(s => s.trim()).filter(Boolean) || []),
        ...(selectedPatient?.allergies || []),
      ];
      const vitalsObj: Record<string, number | null> = {
        bp_systolic: patientVitals?.bp_systolic ?? null,
        bp_diastolic: patientVitals?.bp_diastolic ?? null,
        pulse: patientVitals?.pulse ?? null,
        temperature: patientVitals?.temperature ?? null,
        spo2: patientVitals?.spo2 ?? null,
        respiratory_rate: patientVitals?.respiratory_rate ?? null,
        blood_sugar: patientVitals?.blood_sugar ?? null,
      };
      const symptoms = [
        ...selectedSymptoms,
        ...(extractedData.chief_complaint ? [extractedData.chief_complaint] : []),
        ...(extractedData.associated_symptoms ? extractedData.associated_symptoms.split(",").map(s => s.trim()).filter(Boolean) : []),
      ];

      const { data, error } = await supabase.functions.invoke("clinical-safety", {
        body: { medications, allergies, vitals: vitalsObj, symptoms },
      });

      if (error) throw new Error(error.message);
      const results = data as SafetyResults;
      setSafetyResults(results);
      setIsRunningSafety(false);
      timer.stop(true);

      emitSafetyAlertMetric({
        interactions: results.interaction_flags?.length || 0,
        allergies: results.allergy_flags?.length || 0,
        dose_warnings: results.dose_warnings?.length || 0,
        vitals_dangers: results.vitals_dangers?.length || 0,
        emergency_patterns: results.emergency_patterns?.length || 0,
      });

      const alertCount = (results.interaction_flags?.length || 0) + (results.allergy_flags?.length || 0) +
        (results.dose_warnings?.length || 0) + (results.vitals_dangers?.length || 0) + (results.emergency_patterns?.length || 0);

      setValidationComplete(true);
      if (alertCount === 0) {
        toast({ title: "✓ Validation passed", description: "No safety concerns detected." });
      } else {
        toast({ title: `⚠ ${alertCount} alert(s) found`, description: "Review safety flags before finalizing.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Validation error", description: err.message, variant: "destructive" });
      setIsRunningSafety(false);
    } finally {
      setIsValidating(false);
    }
  };

  // ── Approve & Save ──
  const approveAndSave = async () => {
    if (!user) return;
    if (!reviewConfirmed) { toast({ title: "Confirmation required", description: "Please confirm you have reviewed.", variant: "destructive" }); return; }

    if (!validationComplete) {
      await runValidation();
    }

    setIsSaving(true);
    try {
      const { data: saveData, error: saveError } = await supabase.functions.invoke("save-consultation", {
        body: {
          patient_id: selectedPatient?.id || null,
          clinic_id: profileClinicId,
          visit_id: visitId,
          transcript: consultationSummary || transcript,
          stabilized_transcript: stabilizedTranscript,
          extracted_data: extractedData,
          soap_sections: soapSections,
          safety_results: safetyResults,
          follow_up_date: followUpDate || null,
          follow_up_notes: followUpNotes,
          review_confirmed: reviewConfirmed,
          ai_extracted_baseline: aiExtractedBaseline,
          ai_soap_baseline: aiSoapBaseline,
          session_duration_ms: Math.round(performance.now() - sessionStartTime),
        },
      });
      if (saveError) throw new Error(saveError.message);
      const consultationId = saveData.consultation_id;
      setSavedSessionId(consultationId);

      if (visitId) {
        try {
          await supabase.functions.invoke("update-visit-status", {
            body: { visit_id: visitId, target_status: "consultation_complete" },
          });
        } catch { /* non-blocking */ }
      }

      let workflowMode = "doctor_only";
      if (profileClinicId) {
        const { data: wfConfig } = await supabase.from("clinic_workflow_config").select("workflow_mode").eq("clinic_id", profileClinicId).maybeSingle();
        if (wfConfig?.workflow_mode) workflowMode = wfConfig.workflow_mode;
      }

      if (workflowMode === "doctor_plus_admin") {
        await supabase.functions.invoke("save-consultation", {
          body: { consultation_id: consultationId, status_override: "awaiting_frontdesk" },
        });
        try {
          await supabase.functions.invoke("send-patient-update", {
            body: { patient_id: selectedPatient?.id || saveData.patient_id, visit_id: visitId, clinic_id: profileClinicId, trigger_event: "consultation_complete" },
          });
        } catch { /* non-blocking */ }
        setFinalizationResults({ consultation_id: consultationId, stages: [{ stage: "save", status: "saved" }, { stage: "status", status: "awaiting_frontdesk" }], sent_to_frontdesk: true });
        toast({ title: "✓ Sent to Front Desk", description: "Consultation saved." });
      } else {
        setIsFinalizingConsultation(true);
        const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke("finalize-consultation", {
          body: {
            consultation_id: consultationId,
            patient_id: selectedPatient?.id || saveData.patient_id,
            clinic_id: profileClinicId,
            visit_id: visitId,
            extracted_data: extractedData,
            soap_sections: soapSections,
            safety_results: safetyResults,
            drugs: pendingRxFromSuggestions.map(d => ({ drug_name: d.drug_name, dosage: d.dose, frequency: d.frequency, duration: d.duration })),
            lab_orders: selectedTests.map(t => ({ test_name: t, priority: "routine" })),
            billing_enabled: true,
            safety_override: reviewConfirmed,
          },
        });
        if (finalizeError) throw new Error(finalizeError.message);
        if (finalizeData?.error === "safety_block") {
          toast({ title: "⚠ Safety Block", description: finalizeData.message, variant: "destructive" });
          setIsFinalizingConsultation(false);
          return;
        }
        try {
          await supabase.functions.invoke("send-patient-update", {
            body: { patient_id: selectedPatient?.id || saveData.patient_id, visit_id: visitId, clinic_id: profileClinicId, trigger_event: "consultation_complete" },
          });
        } catch { /* non-blocking */ }
        setFinalizationResults({ ...finalizeData, consultation_id: consultationId });
        toast({ title: "✓ Consultation finalized" });
      }
    } catch (err: any) {
      toast({ title: "Finalization failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); setIsFinalizingConsultation(false); }
  };

  const startNewSession = () => {
    setTranscript(""); setStabilizedTranscript(""); setExtractedData(EMPTY_EXTRACTED);
    setSoapSections(EMPTY_SOAP); setSavedSessionId(null); setSafetyResults(null); setPendingRxFromSuggestions([]);
    setReviewConfirmed(false); setPipelineComplete(false); setValidationComplete(false);
    setNormalizationResults([]); setDetectedLanguages([]); setSelectedPatient(null);
    setIntakeData(null); setVisitId(null);
    setClinicalContext(EMPTY_CLINICAL_CONTEXT); setPatientVitals(null);
    setFollowUpDate(""); setFollowUpNotes("");
    setSelectedSymptoms([]); setSelectedDuration(""); setExpansionSelections({});
    setPriorMeds([]); setAutoGenerateTriggered(false); setSymptomSearch("");
    setFinalizationResults(null); setIsFinalizingConsultation(false);
    setConsultationSummary(""); setSummaryManuallyEdited(false);
    setSelectedDiagnoses([]); setSelectedTests([]); setSelectedAdvice([]);
    setSelectedInstructions([]);
  };

  const updateSoapSection = (section: keyof SoapSections, value: string) => setSoapSections(prev => ({ ...prev, [section]: value }));

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(prev => {
      const next = prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s];
      if (prev.includes(s)) {
        setExpansionSelections(prev => { const copy = { ...prev }; delete copy[s]; return copy; });
      }
      return next;
    });
  };

  const toggleExpansionChip = (symptom: string, chip: string) => {
    setExpansionSelections(prev => {
      const current = prev[symptom] || [];
      return { ...prev, [symptom]: current.includes(chip) ? current.filter(c => c !== chip) : [...current, chip] };
    });
  };

  const toggleDiagnosis = (d: string) => setSelectedDiagnoses(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleTest = (t: string) => setSelectedTests(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleAdvice = (a: string) => setSelectedAdvice(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const toggleInstruction = (inst: string) => setSelectedInstructions(prev => prev.includes(inst) ? prev.filter(x => x !== inst) : [...prev, inst]);

  // Symptom suggestions: show recommended based on chief complaint, or filtered search
  const recommendedSymptoms = useMemo(() => {
    if (chiefComplaint && CHIEF_COMPLAINT_SYMPTOMS[chiefComplaint]) {
      return CHIEF_COMPLAINT_SYMPTOMS[chiefComplaint].filter(s => !selectedSymptoms.includes(s));
    }
    return [];
  }, [chiefComplaint, selectedSymptoms]);

  const filteredSymptoms = useMemo(() => {
    if (symptomSearch.length >= 3) {
      return COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(symptomSearch.toLowerCase()) && !selectedSymptoms.includes(s));
    }
    return [];
  }, [symptomSearch, selectedSymptoms]);

  // Chief complaint suggestions
  const filteredCcSuggestions = useMemo(() => {
    if (chiefComplaintSearch.length >= 3) {
      return Object.keys(CHIEF_COMPLAINT_SYMPTOMS).filter(cc => cc.toLowerCase().includes(chiefComplaintSearch.toLowerCase()) && cc !== chiefComplaint);
    }
    return [];
  }, [chiefComplaintSearch, chiefComplaint]);

  // Medication suggestions
  const filteredMedSuggestions = useMemo(() => {
    if (medSearch.length >= 3) {
      return MEDICATION_PRESETS.filter(m => m.toLowerCase().includes(medSearch.toLowerCase()) && !priorMeds.some(pm => pm.name === m));
    }
    return [];
  }, [medSearch, priorMeds]);


  // Helper: update a vital field
  const updateVital = (field: string, value: string) => {
    setPatientVitals((prev: any) => ({
      ...(prev || {}),
      [field]: value === "" ? null : isNaN(Number(value)) ? value : Number(value),
    }));
  };

  // Helper: add prior med to patient meds section
  const addPriorMedToPatient = (medName: string, dose: string = "", frequency: string = "") => {
    setPriorMeds(prev => {
      if (prev.some(m => m.name === medName)) return prev;
      return [...prev, { name: medName, dose, frequency }];
    });
  };

  const removePriorMed = (medName: string) => {
    setPriorMeds(prev => prev.filter(m => m.name !== medName));
  };

  const updatePriorMedDose = (medName: string, newDose: string) => {
    setPriorMeds(prev => prev.map(m => m.name === medName ? { ...m, dose: newDose } : m));
  };

  const updatePriorMedFrequency = (medName: string, newFreq: string) => {
    setPriorMeds(prev => prev.map(m => m.name === medName ? { ...m, frequency: newFreq } : m));
  };

  // Copilot props builder
  const copilotProps = {
    diagnoses: copilotDiagnoses,
    selectedDiagnoses,
    onToggleDiagnosis: toggleDiagnosis,
    tests: copilotTests,
    selectedTests,
    onToggleTest: toggleTest,
    medications: contextualRx,
    selectedMedications: pendingRxFromSuggestions,
    onToggleMedication: (rx: { drug: string; dose: string; freq: string; dur: string }) => {
      if (pendingRxFromSuggestions.some(p => p.drug_name === rx.drug)) {
        setPendingRxFromSuggestions(prev => prev.filter(p => p.drug_name !== rx.drug));
      } else {
        setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
        toast({ title: `+ ${rx.drug}` });
      }
    },
    safetyResults,
    patientAge: selectedPatient?.age,
    allergies: selectedPatient?.allergies || [],
    diagnosis: selectedDiagnoses[0],
    instructions: copilotInstructions,
    selectedInstructions,
    onToggleInstruction: toggleInstruction,
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <>
      <SEO title="DATAelixAIr — Clinical" description="AI clinical consultation workspace" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">

        {/* ── Toolbar ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-1.5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ConsultationTimeline steps={timelineSteps} />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <AnimatePresence mode="wait">
              {isProcessing && (
                <motion.div key="processing" {...fadeIn} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/5 border border-primary/10">
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                  <span className="text-[10px] text-primary font-medium">
                    {isStabilizing ? "Analyzing…" : isExtracting ? "Extracting…" : isRunningSafety ? "Safety…" : "SOAP…"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {safetyResults && safetyAlertCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-chip-alert border border-chip-alert-border">
                <AlertTriangle className="h-2.5 w-2.5 text-chip-alert-text" />
                <span className="text-[10px] text-chip-alert-text font-medium">{safetyAlertCount}</span>
              </div>
            )}

            <button onClick={toggleDarkMode} className="h-6 w-6 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors">
              {darkMode ? <Sun className="h-3 w-3 text-foreground" /> : <Moon className="h-3 w-3 text-foreground" />}
            </button>

            <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 rounded-lg" onClick={startNewSession}>
              <RotateCcw className="h-2.5 w-2.5" /> New
            </Button>
          </div>
        </div>

        {/* ── Main Content: Three-column no-scroll ── */}
        <div className={`flex-1 overflow-hidden grid grid-cols-1 ${finalizationResults ? "lg:grid-cols-[1fr_260px]" : "lg:grid-cols-[minmax(280px,1fr)_minmax(320px,1.2fr)_260px]"}`}>

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="overflow-y-auto border-r border-border">

            {finalizationResults ? (
              <ConsultationComplete
                results={finalizationResults}
                patientId={selectedPatient?.id || ""}
                clinicId={profileClinicId || ""}
                visitId={visitId}
                patientName={selectedPatient?.name || "Patient"}
                onNewSession={startNewSession}
              />
            ) : (
            <div className="p-2.5 space-y-2">

              {/* Patient Header */}
              <ClinicalCard className="p-3">
                {!selectedPatient ? (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" /> Select Patient
                    </p>
                    <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {selectedPatient.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground truncate">{selectedPatient.name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {selectedPatient.age ? `${selectedPatient.age}y` : "?"} · {selectedPatient.gender?.charAt(0)?.toUpperCase() || "?"}
                          </Badge>
                          {visitId && <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">Visit</Badge>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedPatient(null)}>Change</Button>
                    </div>

                    {/* Chief Complaint from intake */}
                    {intakeData?.chief_complaint && (
                      <div className="p-2 rounded-lg bg-primary/[0.04] border border-primary/15">
                        <p className="text-[9px] font-semibold text-primary uppercase tracking-widest">Chief Complaint</p>
                        <p className="text-xs text-foreground">{intakeData.chief_complaint}
                          {intakeData.symptom_duration && <span className="text-muted-foreground ml-1">· {intakeData.symptom_duration}</span>}
                        </p>
                      </div>
                    )}

                    {/* Conditions / Allergies */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {selectedPatient.medical_history && Array.isArray(selectedPatient.medical_history) && (selectedPatient.medical_history as any[]).length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase">Hx:</span>
                          {(selectedPatient.medical_history as any[]).map((h: any, i: number) => (
                            <Chip key={i} variant="diagnosis" size="sm">{typeof h === "string" ? h : h?.condition || String(h)}</Chip>
                          ))}
                        </div>
                      )}
                      {selectedPatient.allergies?.length ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-semibold text-chip-alert-text uppercase flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" />Allergy:</span>
                          {selectedPatient.allergies.map(a => <Chip key={a} variant="alert" size="sm">{a}</Chip>)}
                        </div>
                      ) : null}
                    </div>

                    {/* Current Medication */}
                    <div>
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-0.5 mb-1"><Pill className="h-2.5 w-2.5" />Current Medication</span>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {selectedPatient.current_medications?.map(m => <Chip key={m} variant="medication" size="sm">{m}</Chip>)}
                        {priorMeds.map(m => (
                          <div key={m.name} className="flex items-center gap-0.5">
                            <Chip variant="medication" size="sm" removable onRemove={() => removePriorMed(m.name)}>
                              {m.name}
                            </Chip>
                            <input
                              type="text"
                              value={m.dose}
                              onChange={e => updatePriorMedDose(m.name, e.target.value)}
                              placeholder="dose"
                              className="h-5 w-14 px-1 text-[9px] rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                            <input
                              type="text"
                              value={m.frequency}
                              onChange={e => updatePriorMedFrequency(m.name, e.target.value)}
                              placeholder="freq"
                              className="h-5 w-12 px-1 text-[9px] rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={medSearch}
                          onChange={e => setMedSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && medSearch.trim()) { addPriorMedToPatient(medSearch.trim()); setMedSearch(""); } }}
                          placeholder="+ Add medication…"
                          className="w-full h-7 px-2.5 text-[11px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        {filteredMedSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-lg shadow-md z-10 max-h-32 overflow-y-auto">
                            {filteredMedSuggestions.map(med => (
                              <button key={med} className="w-full text-left px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors" onClick={() => { addPriorMedToPatient(med); setMedSearch(""); }}>
                                {med}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chief Complaint */}
                    <div>
                      <span className="text-[9px] font-semibold text-primary uppercase flex items-center gap-0.5 mb-1">
                        <Stethoscope className="h-2.5 w-2.5" /> Chief Complaint
                      </span>
                      {chiefComplaint ? (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Chip variant="symptom" selected removable onRemove={() => { setChiefComplaint(""); }}>{chiefComplaint}</Chip>
                          {intakeData?.symptom_duration && <span className="text-[10px] text-muted-foreground">· {intakeData.symptom_duration}</span>}
                        </div>
                      ) : intakeData?.chief_complaint ? (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Chip variant="symptom" selected onClick={() => setChiefComplaint(intakeData.chief_complaint!)}>{intakeData.chief_complaint}</Chip>
                        </div>
                      ) : null}
                      <div className="relative">
                        <input
                          type="text"
                          value={chiefComplaintSearch}
                          onChange={e => setChiefComplaintSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && chiefComplaintSearch.trim()) { setChiefComplaint(chiefComplaintSearch.trim()); setChiefComplaintSearch(""); } }}
                          placeholder="+ Add chief complaint…"
                          className="w-full h-7 px-2.5 text-[11px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                        {filteredCcSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-lg shadow-md z-10 max-h-32 overflow-y-auto">
                            {filteredCcSuggestions.map(cc => (
                              <button key={cc} className="w-full text-left px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors" onClick={() => { setChiefComplaint(cc); setChiefComplaintSearch(""); }}>
                                {cc}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </ClinicalCard>

              {/* Vitals Grid — Enhanced */}
              {selectedPatient && (
                <ClinicalCard className="p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Vitals
                  </p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[
                      { field: "bp_systolic", label: "BP", icon: Heart, iconClass: "text-chip-alert-text", isBp: true },
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

              {/* Symptoms & Duration */}
              {selectedPatient && (
                <ClinicalCard className="p-3">
                  <ClinicalCardHeader
                    title="Symptoms & Duration"
                    icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                    badge={selectedSymptoms.length > 0 ? <Badge variant="outline" className="text-xs">{selectedSymptoms.length}</Badge> : undefined}
                  />

                  {/* Selected symptoms with inline expansions */}
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

                  {/* Recommended symptoms based on chief complaint */}
                  {recommendedSymptoms.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Recommended</p>
                      <div className="flex flex-wrap gap-1">
                        {recommendedSymptoms.slice(0, 5).map(s => (
                          <Chip key={s} variant="symptom" onClick={() => toggleSymptom(s)}>{s}</Chip>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add symptom - autosuggest after 3 chars */}
                  <div className="mt-2 relative">
                    <input
                      type="text" value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && symptomSearch.trim()) { toggleSymptom(symptomSearch.trim()); setSymptomSearch(""); } }}
                      placeholder="+ Add symptom…"
                      className="w-full h-7 px-2.5 text-[11px] rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                    {filteredSymptoms.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-0.5 bg-popover border border-border rounded-lg shadow-md z-10 max-h-32 overflow-y-auto">
                        {filteredSymptoms.map(s => (
                          <button key={s} className="w-full text-left px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted transition-colors" onClick={() => { toggleSymptom(s); setSymptomSearch(""); }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Duration */}
                  <AnimatePresence>
                    {selectedSymptoms.length > 0 && (
                      <motion.div {...fadeIn} className="mt-1.5">
                        <ChipGroup label="Duration">
                          {DURATION_PRESETS.map(d => (
                            <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>{d}</Chip>
                          ))}
                        </ChipGroup>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </ClinicalCard>
              )}

              {/* Empty state */}
              {!selectedPatient && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center mb-2">
                    <Stethoscope className="h-5 w-5 text-primary/20" />
                  </div>
                  <p className="text-xs text-muted-foreground">Select a patient to start.</p>
                </motion.div>
              )}
            </div>
            )}
          </div>

          {/* ═══ CENTER COLUMN: Summary (merged Record + Transcript + Review) ═══ */}
          {!finalizationResults && (
          <div className="overflow-y-auto border-r border-border flex flex-col">
            {selectedPatient && (
            <div className="p-3 space-y-3 flex-1">

              {/* Summary section header */}
              <ClinicalCard className="p-3 border-primary/15">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">Summary</span>
                  </div>
                  <div className="flex gap-1">
                    <AiDisclosureBadge label="AI Draft — Review Required" tooltip="These notes were generated by AI. Your doctor reviews and edits all content before finalisation." />
                    {summaryManuallyEdited && (
                      <Button variant="ghost" size="sm" className="h-5 text-xs" onClick={() => { setSummaryManuallyEdited(false); setConsultationSummary(generatedSummary); }}>
                        <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* AI Processing indicator */}
                <AnimatePresence>
                  {pipelineRunning && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mb-3">
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                        <Brain className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs text-primary font-medium flex-1">AI analyzing…</span>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Safety alerts inline */}
                {safetyResults && safetyAlertCount > 0 && (
                  <div className="mb-3 space-y-1">
                    <p className="text-[10px] font-semibold text-chip-alert-text uppercase flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Safety Alerts
                    </p>
                    {safetyResults.allergy_flags.map((f, i) => (
                      <div key={`a-${i}`} className="p-1.5 rounded-lg border border-chip-alert-border bg-chip-alert text-xs text-chip-alert-text font-medium flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />{f.message}
                      </div>
                    ))}
                    {safetyResults.interaction_flags.map((f, i) => (
                      <div key={`i-${i}`} className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 ${severityColor(f.severity)}`}>
                        <Shield className="h-3 w-3 shrink-0" />
                        <span className="font-semibold">{f.drug_a}↔{f.drug_b}</span>: {f.description}
                      </div>
                    ))}
                    {safetyResults.dose_warnings.map((w, i) => (
                      <div key={`d-${i}`} className="p-1.5 rounded-lg border border-chip-lab-border bg-chip-lab text-xs text-chip-lab-text flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />{w.message}
                      </div>
                    ))}
                    {(safetyResults.vitals_dangers || []).map((v, i) => (
                      <div key={`v-${i}`} className={`p-1.5 rounded-lg border text-xs ${severityColor(v.severity)}`}>{v.message}</div>
                    ))}
                    {(safetyResults.emergency_patterns || []).map((ep, i) => (
                      <div key={`e-${i}`} className={`p-1.5 rounded-lg border text-xs ${severityColor(ep.severity)}`}>
                        <span className="font-semibold">{ep.pattern}</span>: {ep.message}
                      </div>
                    ))}
                  </div>
                )}

                {/* SOAP Sections */}
                <div className="space-y-4">
                  {/* Subjective */}
                  <div className="rounded-xl border p-3 bg-primary/[0.03] border-primary/15">
                    <div className="flex items-center gap-1.5 mb-2">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wide text-primary">Subjective</span>
                    </div>
                    <Textarea
                      value={(() => {
                        const parts: string[] = [];
                        if (soapSections["Visit Summary"]?.trim()) parts.push(soapSections["Visit Summary"]);
                        else {
                          if (selectedSymptoms.length > 0) parts.push(`c/o ${selectedSymptoms.join(", ")}`);
                          if (selectedDuration) parts.push(`Duration: ${selectedDuration}`);
                          if (priorMeds.length > 0) parts.push(`Current meds: ${priorMeds.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` ${m.frequency}` : ""}`).join(", ")}`);
                        }
                        if (transcript.trim()) parts.push(transcript.trim());
                        return parts.join("\n");
                      })()}
                      onChange={e => updateSoapSection("Visit Summary", e.target.value)}
                      rows={3}
                      className="text-xs min-h-[36px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      placeholder="Patient's subjective complaints..."
                    />
                  </div>

                  {/* Objective */}
                  <div className="rounded-xl border p-3 bg-emerald-500/5 border-emerald-500/15">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Objective</span>
                    </div>
                    <Textarea
                      value={(() => {
                        const parts: string[] = [];
                        if (soapSections["Findings"]?.trim()) parts.push(soapSections["Findings"]);
                        else {
                          // Auto-fill from vitals
                          const vitalParts: string[] = [];
                          if (patientVitals?.temperature) vitalParts.push(`Temp: ${patientVitals.temperature}°F`);
                          if (patientVitals?.bp_systolic) vitalParts.push(`BP: ${patientVitals.bp_systolic}/${patientVitals.bp_diastolic} mmHg`);
                          if (patientVitals?.pulse) vitalParts.push(`HR: ${patientVitals.pulse} bpm`);
                          if (patientVitals?.spo2) vitalParts.push(`SpO₂: ${patientVitals.spo2}%`);
                          if (vitalParts.length) parts.push(vitalParts.join(", "));
                          // Lab results from tests
                          if (selectedTests.length > 0) parts.push(`Labs ordered: ${selectedTests.join(", ")}`);
                        }
                        return parts.join("\n");
                      })()}
                      onChange={e => updateSoapSection("Findings", e.target.value)}
                      rows={2}
                      className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      placeholder="Examination findings, vitals..."
                    />
                  </div>

                  {/* Assessment */}
                  <div className="rounded-xl border p-3 bg-amber-500/5 border-amber-500/15">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Brain className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Assessment</span>
                    </div>
                    {selectedDiagnoses.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedDiagnoses.map(d => <Chip key={d} variant="diagnosis" selected removable onRemove={() => toggleDiagnosis(d)}>{d}</Chip>)}
                      </div>
                    )}
                    <Textarea
                      value={soapSections["Provisional Diagnosis"] || (selectedDiagnoses.length > 0 ? selectedDiagnoses.join(", ") : "")}
                      onChange={e => updateSoapSection("Provisional Diagnosis", e.target.value)}
                      rows={2}
                      className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      placeholder="Assessment / provisional diagnosis..."
                    />
                  </div>

                  {/* Plan */}
                  <div className="rounded-xl border p-3 bg-purple-500/5 border-purple-500/15">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ClipboardCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">Plan</span>
                    </div>

                    {/* Prescriptions */}
                    {pendingRxFromSuggestions.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Prescription</p>
                        <div className="flex flex-wrap gap-1">
                          {pendingRxFromSuggestions.map((rx, i) => (
                            <Chip key={i} variant="medication" selected removable onRemove={() => setPendingRxFromSuggestions(prev => prev.filter((_, idx) => idx !== i))}>
                              {rx.drug_name} {rx.dose} {rx.frequency} × {rx.duration}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lab Orders */}
                    {selectedTests.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Lab Orders</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedTests.map(t => <Chip key={t} variant="lab" selected removable onRemove={() => toggleTest(t)}>{t}</Chip>)}
                        </div>
                      </div>
                    )}

                    {/* Instructions */}
                    {selectedInstructions.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Patient Instructions</p>
                        <div className="flex flex-wrap gap-1">
                          {selectedInstructions.map(inst => (
                            <Chip key={inst} variant="action" selected removable onRemove={() => toggleInstruction(inst)} size="sm">
                              {inst}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    <Textarea
                      value={soapSections["Treatment Plan"] || ""}
                      onChange={e => updateSoapSection("Treatment Plan", e.target.value)}
                      rows={2}
                      className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                      placeholder="Treatment plan, medications, follow-up..."
                    />
                  </div>
                </div>

                {/* Clinical Safety Status */}
                {validationComplete && (
                  <div className={`mt-3 rounded-xl border p-3 ${safetyAlertCount === 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                    <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${safetyAlertCount === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                      <Shield className="h-3.5 w-3.5" /> Clinical Safety Check
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        {safetyResults && safetyResults.allergy_flags.length > 0 ? (
                          <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Allergy conflict detected</span></>
                        ) : (
                          <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No allergy conflicts</span></>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {safetyResults && safetyResults.dose_warnings.length > 0 ? (
                          <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Dose warning detected</span></>
                        ) : (
                          <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">Dose within limits</span></>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {safetyResults && (safetyResults.vitals_dangers?.length || 0) > 0 ? (
                          <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Dangerous vitals flagged</span></>
                        ) : (
                          <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No dangerous vitals</span></>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        {safetyResults && safetyResults.interaction_flags.length > 0 ? (
                          <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Drug interaction detected</span></>
                        ) : (
                          <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No drug interactions</span></>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Validate + Finalize */}
                <div className="pt-3 mt-3 border-t border-border space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5"
                    onClick={runValidation}
                    disabled={isValidating}
                  >
                    {isValidating ? (
                      <><Loader2 className="h-3 w-3 animate-spin" /> Validating…</>
                    ) : validationComplete ? (
                      <><CheckCircle className="h-3 w-3 text-primary" /> Validated {safetyAlertCount > 0 ? `(${safetyAlertCount} alerts)` : "✓"}</>
                    ) : (
                      <><ShieldCheck className="h-3 w-3" /> Validate</>
                    )}
                  </Button>

                  <div className="flex items-start gap-1.5">
                    <Checkbox id="final-review" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} className="mt-0.5 h-3.5 w-3.5" />
                    <label htmlFor="final-review" className="text-xs text-muted-foreground cursor-pointer select-none leading-relaxed">
                      I have reviewed the consultation summary, prescriptions, and safety alerts.
                    </label>
                  </div>

                  <Button onClick={approveAndSave} disabled={isSaving || isFinalizingConsultation || !reviewConfirmed} className="w-full h-9 rounded-xl text-xs font-semibold gap-1.5">
                    {(isSaving || isFinalizingConsultation) ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Finalizing…</> : <><CheckCircle className="h-3.5 w-3.5" />Finalize & Send</>}
                  </Button>
                </div>
              </ClinicalCard>
            </div>
            )}


          </div>
          )}

          {/* ═══ RIGHT: AI Copilot Sidebar — desktop ═══ */}
          <div className="overflow-y-auto border-l border-border bg-card/30 hidden lg:block">
            <div className="p-3 space-y-2.5">
              <div className="flex items-center gap-2 px-0.5">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center relative">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-chip-medication-text animate-pulse" />
                </div>
                <span className="text-sm font-semibold text-foreground">AI Copilot</span>
                <Badge className="bg-chip-medication border-chip-medication-border text-chip-medication-text text-[10px] ml-auto">Active</Badge>
              </div>
              {selectedPatient && <ClinicalCopilot {...copilotProps} />}
            </div>
          </div>

          {/* ═══ MOBILE: AI Copilot Floating Drawer ═══ */}
          {selectedPatient && (
            <div className="lg:hidden fixed bottom-4 right-4 z-50">
              {!copilotDrawerOpen ? (
                <Button
                  onClick={() => setCopilotDrawerOpen(true)}
                  className="h-12 w-12 rounded-full shadow-lg p-0"
                >
                  <Zap className="h-5 w-5" />
                </Button>
              ) : (
                <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setCopilotDrawerOpen(false)}>
                  <div
                    className="absolute bottom-0 left-0 right-0 max-h-[75vh] bg-card border-t border-border rounded-t-2xl overflow-y-auto shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="sticky top-0 bg-card border-b border-border p-3 flex items-center justify-between z-10">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">AI Copilot</span>
                        <Badge className="bg-chip-medication border-chip-medication-border text-chip-medication-text text-[10px]">Active</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCopilotDrawerOpen(false)}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="p-3">
                      <ClinicalCopilot {...copilotProps} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ FOOTER: Command Bar — always visible ═══ */}
        <div className="shrink-0 px-4 py-2 border-t border-border bg-card/90 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-border bg-background shadow-sm hover:border-primary/30 transition-colors max-w-3xl mx-auto">
            <Sparkles className="h-4 w-4 text-primary/50 shrink-0" />
            <input
              id="command-bar-input"
              type="text"
              value={commandQuery}
              onChange={e => setCommandQuery(e.target.value)}
              placeholder="Ask anything!"
              className="flex-1 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/60"
              onKeyDown={e => {
                if (e.key === "Enter" && commandQuery.trim()) {
                  toast({ title: "Command received", description: commandQuery });
                  setCommandQuery("");
                }
              }}
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
            <div className="shrink-0">
              <ConsultationInput transcript={transcript} onTranscriptChange={setTranscript} disabled={pipelineRunning} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
