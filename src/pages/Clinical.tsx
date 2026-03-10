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
import FollowUpPanel from "@/components/clinical/FollowUpPanel";
import AdaptiveAICopilotPanel from "@/components/clinical/AdaptiveAICopilotPanel";
import PatientHeaderCompact from "@/components/clinical/PatientHeaderCompact";
import PatientContextPanel from "@/components/clinical/PatientContextPanel";
import ClinicalWorkspace from "@/components/clinical/ClinicalWorkspace";
import ProgressiveActionBar from "@/components/clinical/ProgressiveActionBar";

import ConsultationComplete from "@/components/ConsultationComplete";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Save, FileText,
  Edit3, ShieldCheck, AlertTriangle, XCircle, CheckCircle,
  Languages, HeartPulse, Pill, FlaskConical, User,
  Sparkles, RotateCcw, Clock, ClipboardCheck, Brain, CalendarDays,
  Zap, Activity, Stethoscope, Eye, Search, Moon, Sun,
  Heart, Thermometer, Wind, Droplets, Shield, Mic, PenLine,
  ChevronDown, ChevronUp, Phone, FileUp
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
  emitMonitoringEvent,
} from "@/layers/monitoring/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext } from "@/lib/clinical-context";
import { getConsultationStage, getNextProgressiveAction } from "@/services/progressiveActionEngine";

// Symptom presets
const COMMON_SYMPTOMS = ["Fever", "Cough", "Headache", "Body ache", "Vomiting", "Diarrhea", "Cold", "Sore throat", "Fatigue", "Chest pain", "Breathlessness", "Abdominal pain"];
const DURATION_PRESETS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks", "1 month"];
const MEDICATION_PRESETS = ["Paracetamol", "Ibuprofen", "Azithromycin", "Amoxicillin", "ORS", "Pantoprazole", "Cetirizine"];

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
  const [priorMeds, setPriorMeds] = useState<string[]>([]);
  const [symptomSearch, setSymptomSearch] = useState("");

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

  // Validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationComplete, setValidationComplete] = useState(false);

  // Progressive cockpit helpers
  const [medicationQuery, setMedicationQuery] = useState("");
  const [medicationSuggestions, setMedicationSuggestions] = useState<Array<{ label: string; genericName: string }>>([]);
  const [medicationLoading, setMedicationLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

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
    if (priorMeds.length > 0) histParts.push(`Prior meds: ${priorMeds.join(", ")}`);
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
    if (planParts.length) lines.push(`P: ${planParts.join(". ")}`);

    // Recording only if it adds new info not already in the structured fields
    if (transcript.trim()) lines.push(`\nNotes: ${transcript}`);

    return lines.join("\n");
  }, [selectedPatient, selectedSymptoms, selectedDuration, patientVitals, expansionSelections, priorMeds, selectedDiagnoses, pendingRxFromSuggestions, selectedTests, transcript, intakeData]);

  // Auto-update summary unless manually edited
  useEffect(() => {
    if (!summaryManuallyEdited && generatedSummary) {
      setConsultationSummary(generatedSummary);
    }
  }, [generatedSummary, summaryManuallyEdited]);

  // ── Auto-save consultation draft every 15 seconds ──
  const DRAFT_KEY = "dataelixair_consultation_draft";

  useEffect(() => {
    if (!selectedPatient || savedSessionId) return; // Don't auto-save after finalized
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
      // Only recover if less than 2 hours old and no patient selected yet
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

  const safetyAlertCount = safetyResults ? (safetyResults.interaction_flags.length + safetyResults.allergy_flags.length + safetyResults.dose_warnings.length + (safetyResults.vitals_dangers?.length || 0) + (safetyResults.emergency_patterns?.length || 0)) : 0;

  // ── Full AI Pipeline ──
  const runFullPipeline = async () => {
    let effectiveTranscript = transcript.trim();
    if (!effectiveTranscript && selectedSymptoms.length > 0) {
      const expansionDetails = Object.entries(expansionSelections)
        .filter(([_, vals]) => vals.length > 0)
        .map(([symptom, vals]) => `${symptom} characteristics: ${vals.join(", ")}`)
        .join(". ");
      const medsContext = priorMeds.length > 0 ? ` Patient has already taken: ${priorMeds.join(", ")}.` : "";
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

  // ── Validate (AI analyzes everything and flags) ──
  const runValidation = async () => {
    setIsValidating(true);
    try {
      // Run safety check and wait for results
      setIsRunningSafety(true);
      const timer = startPipelineTimer("safety_controller");
      // Format medications with dose and frequency for accurate validation
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

      // Update visit status via update-visit-status edge function
      if (visitId) {
        try {
          await supabase.functions.invoke("update-visit-status", {
            body: {
              visit_id: visitId,
              target_status: "consultation_complete",
            },
          });
        } catch { /* non-blocking — finalize-consultation also handles status */ }
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

  const filteredSymptoms = symptomSearch
    ? COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(symptomSearch.toLowerCase()))
    : COMMON_SYMPTOMS;

  const progressiveStage = getConsultationStage({
    symptomsCount: selectedSymptoms.length,
    diagnosisCount: selectedDiagnoses.length,
    labsCount: selectedTests.length,
    medicationCount: pendingRxFromSuggestions.length,
    hasAssessment: soapSections["Provisional Diagnosis"].trim().length > 0,
    hasPlan: soapSections["Treatment Plan"].trim().length > 0,
    pipelineComplete,
  });
  const nextAction = getNextProgressiveAction(progressiveStage);

  // Helper: update a vital field
  const updateVital = (field: string, value: string) => {
    setPatientVitals((prev: any) => ({
      ...(prev || {}),
      [field]: value === "" ? null : isNaN(Number(value)) ? value : Number(value),
    }));
  };

  const updateSoapForProgressive = (section: keyof SoapSections, value: string) => {
    setSoapSections((prev) => ({ ...prev, [section]: value }));
  };

  const handleMedicationLookup = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setMedicationSuggestions([]);
      return;
    }

    setMedicationLoading(true);
    try {
      const [brandsRes, masterRes] = await Promise.all([
        supabase
          .from("drug_brands")
          .select("brand_name,generic_name,strength")
          .or(`brand_name.ilike.%${query}%,generic_name.ilike.%${query}%`)
          .limit(5),
        supabase
          .from("drug_master")
          .select("generic_name")
          .ilike("generic_name", `%${query}%`)
          .limit(5),
      ]);

      const merged = [
        ...(brandsRes.data || []).map((row: any) => ({
          label: `${row.brand_name}${row.strength ? ` ${row.strength}` : ""} (${row.generic_name})`,
          genericName: row.generic_name,
        })),
        ...(masterRes.data || []).map((row: any) => ({
          label: row.generic_name,
          genericName: row.generic_name,
        })),
      ];

      const deduped = Array.from(new Map(merged.map((item) => [item.label.toLowerCase(), item])).values()).slice(0, 6);
      setMedicationSuggestions(deduped);
    } finally {
      setMedicationLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleMedicationLookup(medicationQuery);
    }, 220);
    return () => clearTimeout(timer);
  }, [medicationQuery, handleMedicationLookup]);

  const handleMedicationSuggestionSelect = async (item: { label: string; genericName: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke("normalize-medication", {
        body: { input: item.label },
      });
      if (error) throw error;

      const normalized = data?.normalized_medication || {};
      const drugName = normalized.generic_name || item.genericName;
      const alreadyAdded = pendingRxFromSuggestions.some((rx) => rx.drug_name === drugName);
      if (!alreadyAdded) {
        setPendingRxFromSuggestions((prev) => ([
          ...prev,
          {
            drug_name: drugName,
            dose: normalized.dose || "",
            frequency: normalized.frequency || "",
            duration: normalized.duration || "",
          },
        ]));
        setSoapSections((prev) => ({
          ...prev,
          "Treatment Plan": prev["Treatment Plan"]
            ? `${prev["Treatment Plan"]}\n${drugName}`
            : drugName,
        }));
      }

      emitMonitoringEvent({
        event_type: "copilot_action",
        agent_name: "progressive_action_engine",
        success: true,
        metadata: { action: "medication_normalized", input: item.label, output: drugName },
      });
      setMedicationQuery("");
      setMedicationSuggestions([]);
    } catch (error: any) {
      toast({ title: "Medication normalization failed", description: error.message, variant: "destructive" });
    }
  };

  const handleProgressiveAction = async () => {
    emitMonitoringEvent({
      event_type: "action_bar_click",
      agent_name: "progressive_action_engine",
      success: true,
      metadata: { stage: progressiveStage, action: nextAction.label },
    });

    if (progressiveStage === "treatment_selected") {
      setActionBusy(true);
      const timer = startPipelineTimer("clinical_reasoning_engine");
      try {
        const { data, error } = await supabase.functions.invoke("clinical_reasoning_engine", {
          body: {
            patient_id: selectedPatient?.id,
            symptoms: selectedSymptoms,
            diagnoses: selectedDiagnoses,
            labs: selectedTests,
            medications: pendingRxFromSuggestions,
            vitals: patientVitals,
          },
        });

        if (error || !data) {
          await runFullPipeline();
        } else {
          setSoapSections((prev) => ({
            ...prev,
            "Treatment Plan": data?.care_plan?.treatment_plan || prev["Treatment Plan"],
            "Advice": data?.care_plan?.advice || prev["Advice"],
            "Visit Summary": data?.care_plan?.summary || prev["Visit Summary"],
          }));
        }

        emitMonitoringEvent({
          event_type: "care_plan_generation",
          agent_name: "clinical_reasoning_engine",
          success: true,
          metadata: { stage: progressiveStage },
        });
        timer.stop(true);
      } catch {
        await runFullPipeline();
        timer.stop(false);
      } finally {
        setActionBusy(false);
      }
      return;
    }

    if (progressiveStage === "final_review") {
      await approveAndSave();
      return;
    }

    toast({ title: nextAction.label, description: nextAction.description });
  };

  useEffect(() => {
    if (selectedSymptoms.length === 0) return;
    const summary = `${selectedSymptoms.join(", ")}${selectedDuration ? ` for ${selectedDuration}` : ""}`;
    setSoapSections((prev) => ({
      ...prev,
      "Visit Summary": prev["Visit Summary"].trim() ? prev["Visit Summary"] : summary,
    }));
  }, [selectedSymptoms, selectedDuration]);

  useEffect(() => {
    if (!patientVitals) return;
    const objective = [
      patientVitals.temperature ? `Temp ${patientVitals.temperature}°F` : null,
      patientVitals.bp_systolic ? `BP ${patientVitals.bp_systolic}/${patientVitals.bp_diastolic || ""}` : null,
      patientVitals.pulse ? `Pulse ${patientVitals.pulse}` : null,
      patientVitals.spo2 ? `SpO₂ ${patientVitals.spo2}%` : null,
    ].filter(Boolean).join(", ");

    if (!objective) return;
    setSoapSections((prev) => ({
      ...prev,
      "Findings": objective,
    }));
  }, [patientVitals]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <>
      <SEO title="DATAelixAIr — Clinical" description="AI clinical consultation workspace" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">
        <div className="shrink-0 border-b border-border bg-card p-3 space-y-2">
          {!selectedPatient ? (
            <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
          ) : (
            <PatientHeaderCompact
              patientName={selectedPatient.name}
              age={selectedPatient.age}
              gender={selectedPatient.gender}
              visitId={visitId}
              allergies={selectedPatient.allergies || []}
              chronicConditions={Array.isArray(selectedPatient.medical_history) ? selectedPatient.medical_history.map((h: any) => typeof h === "string" ? h : h?.condition || String(h)) : []}
              onChangePatient={() => setSelectedPatient(null)}
            />
          )}
        </div>

        {finalizationResults ? (
          <div className="flex-1 overflow-y-auto p-3">
            <ConsultationComplete
              results={finalizationResults}
              patientId={selectedPatient?.id || ""}
              clinicId={profileClinicId || ""}
              visitId={visitId}
              patientName={selectedPatient?.name || "Patient"}
              onNewSession={startNewSession}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(280px,1fr)_minmax(380px,1.2fr)_320px]">
            <div className="overflow-y-auto border-r border-border p-3">
              <PatientContextPanel
                patientSelected={!!selectedPatient}
                symptoms={selectedSymptoms}
                filteredSymptoms={filteredSymptoms}
                symptomSearch={symptomSearch}
                onSymptomSearchChange={setSymptomSearch}
                onToggleSymptom={(symptom) => {
                  toggleSymptom(symptom);
                  emitMonitoringEvent({ event_type: "copilot_action", agent_name: "progressive_action_engine", success: true, metadata: { action: "symptom_toggle", symptom } });
                }}
                selectedDuration={selectedDuration}
                durationOptions={DURATION_PRESETS}
                onDurationSelect={(duration) => setSelectedDuration((prev) => prev === duration ? "" : duration)}
                priorMeds={priorMeds}
                medicationOptions={MEDICATION_PRESETS}
                onTogglePriorMed={(med) => setPriorMeds((prev) => prev.includes(med) ? prev.filter((x) => x !== med) : [...prev, med])}
                vitals={patientVitals}
                onVitalChange={updateVital}
                allergies={selectedPatient?.allergies || []}
                medicationHistory={selectedPatient?.current_medications || []}
                previousReportsCount={0}
              />
            </div>

            <div className="overflow-hidden border-r border-border bg-muted/20">
              <div className="h-full overflow-y-auto p-3 pb-24">
                <ClinicalWorkspace
                  soapSections={soapSections}
                  onUpdateSoap={updateSoapForProgressive}
                  selectedDiagnoses={selectedDiagnoses}
                  selectedTests={selectedTests}
                  selectedMedications={pendingRxFromSuggestions}
                  onRemoveDiagnosis={toggleDiagnosis}
                  onRemoveLab={toggleTest}
                  onRemoveMedication={(index) => setPendingRxFromSuggestions((prev) => prev.filter((_, i) => i !== index))}
                  medicationQuery={medicationQuery}
                  onMedicationQueryChange={setMedicationQuery}
                  medicationSuggestions={medicationSuggestions}
                  medicationLoading={medicationLoading}
                  onSelectMedicationSuggestion={handleMedicationSuggestionSelect}
                />
                <FollowUpPanel
                  followUpDate={followUpDate}
                  onFollowUpDateChange={setFollowUpDate}
                  followUpNotes={followUpNotes}
                  onFollowUpNotesChange={setFollowUpNotes}
                />
              </div>
              <ProgressiveActionBar
                stage={progressiveStage}
                action={nextAction}
                loading={actionBusy || isSaving || isFinalizingConsultation}
                onClick={handleProgressiveAction}
              />
            </div>

            <div className="overflow-y-auto p-3 bg-card/30 hidden lg:block">
              {selectedPatient && (
                <AdaptiveAICopilotPanel
                  selectedSymptoms={selectedSymptoms}
                  selectedDuration={selectedDuration}
                  patientAge={selectedPatient?.age}
                  patientGender={selectedPatient?.gender}
                  allergies={selectedPatient?.allergies || []}
                  currentMedications={selectedPatient?.current_medications || []}
                  vitalsRecorded={!!patientVitals}
                  vitalsData={patientVitals}
                  soapAssessment={soapSections["Provisional Diagnosis"]}
                  soapPlan={soapSections["Treatment Plan"]}
                  diagnoses={copilotDiagnoses}
                  selectedDiagnoses={selectedDiagnoses}
                  onToggleDiagnosis={toggleDiagnosis}
                  tests={copilotTests}
                  selectedTests={selectedTests}
                  onToggleTest={toggleTest}
                  medications={contextualRx}
                  selectedMedications={pendingRxFromSuggestions}
                  onToggleMedication={(rx) => {
                    if (pendingRxFromSuggestions.some((p) => p.drug_name === rx.drug)) {
                      setPendingRxFromSuggestions((prev) => prev.filter((p) => p.drug_name !== rx.drug));
                    } else {
                      setPendingRxFromSuggestions((prev) => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
                    }
                  }}
                  onAddPrescription={(rx) => {
                    if (!pendingRxFromSuggestions.some((p) => p.drug_name === rx.drug_name)) {
                      setPendingRxFromSuggestions((prev) => [...prev, rx]);
                    }
                  }}
                  onAddLabTest={(test) => {
                    if (!selectedTests.includes(test)) {
                      setSelectedTests((prev) => [...prev, test]);
                    }
                  }}
                  onInsertIntoSoap={(text) => {
                    setSoapSections((prev) => ({ ...prev, "Treatment Plan": prev["Treatment Plan"] ? `${prev["Treatment Plan"]}\n${text}` : text }));
                  }}
                  safetyResults={safetyResults}
                  pipelineComplete={pipelineComplete}
                  pendingRxCount={pendingRxFromSuggestions.length}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
