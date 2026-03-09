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
} from "@/layers/monitoring/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext } from "@/lib/clinical-context";

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

  // ── Auto-save consultation draft every 10 seconds ──
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
    }, 10000);
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

      // Explicitly update visit status via finalize-visit edge function
      if (visitId) {
        try {
          await supabase.functions.invoke("finalize-visit", {
            body: {
              visit_id: visitId,
              consultation_id: consultationId,
              clinic_id: profileClinicId,
              target_status: "consultation_complete",
              billing_enabled: true,
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
        await supabase.from("consultations").update({ status: "awaiting_frontdesk" }).eq("id", consultationId);
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

  // Helper: update a vital field
  const updateVital = (field: string, value: string) => {
    setPatientVitals((prev: any) => ({
      ...(prev || {}),
      [field]: value === "" ? null : isNaN(Number(value)) ? value : Number(value),
    }));
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

          {/* ═══ LEFT COLUMN (expands to span left+center when finalized) ═══ */}
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

                    {/* Conditions / Allergies / Meds */}
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
                      {selectedPatient.current_medications?.length ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-0.5"><Pill className="h-2.5 w-2.5" />Meds:</span>
                          {selectedPatient.current_medications.map(m => <Chip key={m} variant="medication" size="sm">{m}</Chip>)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </ClinicalCard>

              {/* Vitals Grid */}
              {selectedPatient && (
                <ClinicalCard className="p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Vitals
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                    {[
                      { field: "bp_systolic", label: "SYS", icon: Heart, iconClass: "text-chip-alert-text", isBp: true },
                      { field: "pulse", label: "HR", icon: Activity, iconClass: "text-primary" },
                      { field: "spo2", label: "SpO₂%", icon: Droplets, iconClass: "text-primary", alert: patientVitals?.spo2 && Number(patientVitals.spo2) < 95 },
                      { field: "respiratory_rate", label: "RR", icon: Wind, iconClass: "text-muted-foreground" },
                    ].map(v => (
                      <div key={v.field} className={`text-center p-1.5 rounded-lg border cursor-text ${v.alert ? "bg-chip-alert border-chip-alert-border" : "bg-muted/40 border-border"}`}>
                        <v.icon className={`h-3 w-3 mx-auto mb-0.5 ${v.iconClass}`} />
                        {v.isBp ? (
                          <div className="flex items-center justify-center gap-0.5">
                            <input type="number" value={patientVitals?.bp_systolic ?? ""} onChange={e => updateVital("bp_systolic", e.target.value)} className="w-7 text-center text-xs font-semibold bg-transparent border-none outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                            <span className="text-[10px] text-muted-foreground">/</span>
                            <input type="number" value={patientVitals?.bp_diastolic ?? ""} onChange={e => updateVital("bp_diastolic", e.target.value)} className="w-7 text-center text-xs font-semibold bg-transparent border-none outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                          </div>
                        ) : (
                          <input type="number" value={patientVitals?.[v.field] ?? ""} onChange={e => updateVital(v.field, e.target.value)} className="w-full text-center text-xs font-semibold bg-transparent border-none outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                        )}
                        <p className="text-[8px] text-muted-foreground mt-0.5">{v.isBp ? "BP" : v.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { field: "temperature", label: "Temp °F", step: "0.1" },
                      { field: "weight_kg", label: "Wt kg" },
                      { field: "blood_sugar", label: "BS(F)" },
                      { field: "hba1c", label: "HbA1c", step: "0.1" },
                    ].map(v => (
                      <div key={v.field} className={`text-center p-1.5 rounded-lg border cursor-text ${v.field === "temperature" && patientVitals?.temperature && Number(patientVitals.temperature) > 99 ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-muted/40 border-border"}`}>
                        <input type="number" step={v.step || "1"} value={patientVitals?.[v.field] ?? ""} onChange={e => updateVital(v.field, e.target.value)} className="w-full text-center text-xs font-semibold bg-transparent border-none outline-none text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="—" />
                        <p className="text-[8px] text-muted-foreground mt-0.5">{v.label}</p>
                      </div>
                    ))}
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
                  <div className="flex flex-wrap gap-1 mt-1">
                    {filteredSymptoms.map(s => (
                      <Chip key={s} variant="symptom" selected={selectedSymptoms.includes(s)} onClick={() => toggleSymptom(s)}>{s}</Chip>
                    ))}
                  </div>
                  <div className="mt-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text" value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && symptomSearch.trim()) { toggleSymptom(symptomSearch.trim()); setSymptomSearch(""); } }}
                        placeholder="Search or add…"
                        className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Expansions (non-Fever) */}
                  <AnimatePresence>
                    {activeExpansions.filter(s => SYMPTOM_EXPANSIONS[s]?.chips.length > 0).map(symptom => {
                      const expansion = SYMPTOM_EXPANSIONS[symptom];
                      return (
                        <motion.div key={`exp-${symptom}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-1">
                          <div className="pl-2 border-l-2 border-primary/20">
                            <ChipGroup label={`${symptom} → ${expansion.label}`}>
                              {expansion.chips.map(chip => (
                                <Chip key={chip} variant={expansion.variant} selected={(expansionSelections[symptom] || []).includes(chip)} onClick={() => toggleExpansionChip(symptom, chip)} size="sm">{chip}</Chip>
                              ))}
                            </ChipGroup>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Duration + Prior Meds inline */}
                  <AnimatePresence>
                    {selectedSymptoms.length > 0 && (
                      <motion.div {...fadeIn} className="mt-1.5 space-y-1">
                        <ChipGroup label="Duration">
                          {DURATION_PRESETS.map(d => (
                            <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>{d}</Chip>
                          ))}
                        </ChipGroup>
                        <PresetChipGroup label="Medication taken" options={MEDICATION_PRESETS} selected={priorMeds} onToggle={(m) => setPriorMeds(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} variant="medication" allowCustom />
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

          {/* ═══ CENTER COLUMN: Transcript + Review + Finalize (hidden when finalized) ═══ */}
          {!finalizationResults && (
          <div className="overflow-y-auto border-r border-border">
            {selectedPatient && (
            <div className="p-3 space-y-2.5">

              {/* Record */}
              <ClinicalCard className="p-3">
                <ClinicalCardHeader
                  title="Record"
                  icon={<Mic className="h-3.5 w-3.5" />}
                  badge={hasTranscript ? <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Captured</Badge> : undefined}
                />
                <ConsultationInput transcript={transcript} onTranscriptChange={setTranscript} disabled={pipelineRunning} />
              </ClinicalCard>

              {/* AI Processing */}
              <AnimatePresence>
                {pipelineRunning && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <ClinicalCard className="border-primary/20 p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><Brain className="h-3.5 w-3.5 text-primary" /></div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-foreground">AI analyzing…</p>
                          <p className="text-[11px] text-muted-foreground">Building transcript & safety checks</p>
                        </div>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </div>
                    </ClinicalCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Consultation Transcript */}
              {(selectedSymptoms.length > 0 || hasTranscript || intakeData) && !pipelineRunning && (
                <ClinicalCard className="p-3 border-primary/15">
                  <ClinicalCardHeader
                    title="Consultation Transcript"
                    icon={<FileText className="h-3.5 w-3.5" />}
                    badge={
                      <div className="flex gap-1">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-0.5"><Sparkles className="h-2.5 w-2.5" />Auto</Badge>
                        {summaryManuallyEdited && <Badge variant="outline" className="text-[10px]">Edited</Badge>}
                      </div>
                    }
                    action={summaryManuallyEdited ? (
                      <Button variant="ghost" size="sm" className="h-5 text-xs" onClick={() => { setSummaryManuallyEdited(false); setConsultationSummary(generatedSummary); }}>
                        <RotateCcw className="h-2.5 w-2.5 mr-0.5" /> Reset
                      </Button>
                    ) : undefined}
                  />
                  <Textarea
                    value={consultationSummary}
                    onChange={e => { setConsultationSummary(e.target.value); setSummaryManuallyEdited(true); }}
                    rows={5}
                    className="text-xs font-mono resize-none min-h-[80px] bg-background/50 rounded-lg"
                  />

                  {/* Safety alerts inline */}
                  {safetyResults && safetyAlertCount > 0 && (
                    <div className="mt-2 space-y-1">
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

                  {/* SOAP Visual Blocks */}
                  {pipelineComplete && hasSoap && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                          <Brain className="h-3 w-3 text-primary" /> AI Clinical Notes
                        </p>
                        <AiDisclosureBadge label="AI Draft — Review Required" tooltip="These notes were generated by AI based on the consultation transcript. Your doctor reviews and edits all content before finalisation." />
                      </div>
                      {([
                        { key: "Visit Summary" as keyof SoapSections, label: "Subjective", icon: User, color: "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400" },
                        { key: "Findings" as keyof SoapSections, label: "Objective", icon: Eye, color: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
                        { key: "Provisional Diagnosis" as keyof SoapSections, label: "Assessment", icon: Brain, color: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400" },
                        { key: "Treatment Plan" as keyof SoapSections, label: "Plan", icon: ClipboardCheck, color: "bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400" },
                      ]).map(({ key, label, icon: Icon, color }) => (
                        soapSections[key]?.trim() ? (
                          <div key={key} className={`rounded-xl border p-3 ${color.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-")).join(" ")}`}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Icon className={`h-3.5 w-3.5 ${color.split(" ").filter(c => c.startsWith("text-") || c.startsWith("dark:")).join(" ")}`} />
                              <span className={`text-[11px] font-bold uppercase tracking-wide ${color.split(" ").filter(c => c.startsWith("text-") || c.startsWith("dark:")).join(" ")}`}>{label}</span>
                            </div>
                            <Textarea
                              value={soapSections[key]}
                              onChange={e => updateSoapSection(key, e.target.value)}
                              rows={2}
                              className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                            />
                          </div>
                        ) : null
                      ))}

                      {/* Instructions for Patient & Follow-up blocks */}
                      {(["Advice", "Follow-up"] as (keyof SoapSections)[]).map(key => (
                        soapSections[key]?.trim() ? (
                          <div key={key} className="rounded-xl border border-border bg-muted/30 p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                {key === "Advice" ? "Instructions for Patient" : key}
                              </span>
                            </div>
                            <Textarea
                              value={soapSections[key]}
                              onChange={e => updateSoapSection(key, e.target.value)}
                              rows={2}
                              className="text-xs min-h-[28px] resize-y rounded-lg bg-background/80 border-none shadow-sm"
                            />
                          </div>
                        ) : null
                      ))}
                    </div>
                  )}
                </ClinicalCard>
              )}

              {/* Final Review */}
              {(selectedDiagnoses.length > 0 || pendingRxFromSuggestions.length > 0 || selectedTests.length > 0 || hasSymptomInput) && (
                <ClinicalCard className="p-3 border-primary/15 bg-gradient-to-br from-chip-medication/20 to-transparent">
                  <ClinicalCardHeader title="Final Review" icon={<ClipboardCheck className="h-3.5 w-3.5" />} />

                  {selectedDiagnoses.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Diagnosis</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedDiagnoses.map(d => <Chip key={d} variant="diagnosis" selected removable onRemove={() => toggleDiagnosis(d)}>{d}</Chip>)}
                      </div>
                    </div>
                  )}

                  {pendingRxFromSuggestions.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Prescription</p>
                      <div className="flex flex-wrap gap-1">
                        {pendingRxFromSuggestions.map((rx, i) => (
                          <Chip
                            key={i}
                            variant="medication"
                            selected
                            removable
                            onRemove={() => setPendingRxFromSuggestions(prev => prev.filter((_, idx) => idx !== i))}
                          >
                            {rx.drug_name} {rx.dose}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTests.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Lab Orders</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedTests.map(t => <Chip key={t} variant="lab" selected removable onRemove={() => toggleTest(t)}>{t}</Chip>)}
                      </div>
                    </div>
                  )}

                  <div className="mb-2">
                    <FollowUpPanel followUpDate={followUpDate} onFollowUpDateChange={setFollowUpDate} followUpNotes={followUpNotes} onFollowUpNotesChange={setFollowUpNotes} />
                  </div>

                  {/* Clinical Safety Status Indicator */}
                  {validationComplete && (
                    <div className={`rounded-xl border p-3 ${safetyAlertCount === 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/5 border-amber-500/20"}`}>
                      <p className={`text-[11px] font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5 ${safetyAlertCount === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                        <Shield className="h-3.5 w-3.5" /> Clinical Safety Check
                      </p>
                      <div className="space-y-1">
                        {/* Allergy check */}
                        <div className="flex items-center gap-1.5 text-xs">
                          {safetyResults && safetyResults.allergy_flags.length > 0 ? (
                            <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Allergy conflict detected</span></>
                          ) : (
                            <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No allergy conflicts</span></>
                          )}
                        </div>
                        {/* Dose check */}
                        <div className="flex items-center gap-1.5 text-xs">
                          {safetyResults && safetyResults.dose_warnings.length > 0 ? (
                            <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Dose warning detected</span></>
                          ) : (
                            <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">Dose within limits</span></>
                          )}
                        </div>
                        {/* Vitals check */}
                        <div className="flex items-center gap-1.5 text-xs">
                          {safetyResults && (safetyResults.vitals_dangers?.length || 0) > 0 ? (
                            <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Dangerous vitals flagged</span></>
                          ) : (
                            <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No dangerous vitals</span></>
                          )}
                        </div>
                        {/* Drug interaction check */}
                        <div className="flex items-center gap-1.5 text-xs">
                          {safetyResults && safetyResults.interaction_flags.length > 0 ? (
                            <><AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" /><span className="text-amber-700 dark:text-amber-400">Possible drug interaction detected</span></>
                          ) : (
                            <><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No drug interactions</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Validate + Finalize */}
                  <div className="pt-2 border-t border-border space-y-2">
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
              )}
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
              {selectedPatient && (
                <ClinicalCopilot
                  diagnoses={copilotDiagnoses}
                  selectedDiagnoses={selectedDiagnoses}
                  onToggleDiagnosis={toggleDiagnosis}
                  tests={copilotTests}
                  selectedTests={selectedTests}
                  onToggleTest={toggleTest}
                  medications={contextualRx}
                  selectedMedications={pendingRxFromSuggestions}
                  onToggleMedication={(rx) => {
                    if (pendingRxFromSuggestions.some(p => p.drug_name === rx.drug)) {
                      setPendingRxFromSuggestions(prev => prev.filter(p => p.drug_name !== rx.drug));
                    } else {
                      setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
                      toast({ title: `+ ${rx.drug}` });
                    }
                  }}
                  safetyResults={safetyResults}
                  patientAge={selectedPatient?.age}
                  allergies={selectedPatient?.allergies || []}
                  diagnosis={selectedDiagnoses[0]}
                />
              )}
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
                      <ClinicalCopilot
                        diagnoses={copilotDiagnoses}
                        selectedDiagnoses={selectedDiagnoses}
                        onToggleDiagnosis={toggleDiagnosis}
                        tests={copilotTests}
                        selectedTests={selectedTests}
                        onToggleTest={toggleTest}
                        medications={contextualRx}
                        selectedMedications={pendingRxFromSuggestions}
                        onToggleMedication={(rx) => {
                          if (pendingRxFromSuggestions.some(p => p.drug_name === rx.drug)) {
                            setPendingRxFromSuggestions(prev => prev.filter(p => p.drug_name !== rx.drug));
                          } else {
                            setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
                            toast({ title: `+ ${rx.drug}` });
                          }
                        }}
                        safetyResults={safetyResults}
                        patientAge={selectedPatient?.age}
                        allergies={selectedPatient?.allergies || []}
                        diagnosis={selectedDiagnoses[0]}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
