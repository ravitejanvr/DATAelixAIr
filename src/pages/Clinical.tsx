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
import DoctorFavoritesPanel from "@/components/DoctorFavoritesPanel";
import IntakeSummary, { type IntakeData } from "@/components/IntakeSummary";
import SmartSuggestionsPanel from "@/components/SmartSuggestionsPanel";
import CollapsibleSection from "@/components/clinical/CollapsibleSection";
import FollowUpPanel from "@/components/clinical/FollowUpPanel";
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
  "Fever": { label: "Temperature", chips: ["99°F", "100°F", "101°F", "102°F", "103°F+"], variant: "neutral" },
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

const ADVICE_MAP: Record<string, string[]> = {
  "Fever": ["Adequate hydration", "Rest", "Monitor temperature", "Light diet"],
  "Cough": ["Steam inhalation", "Warm fluids", "Avoid cold drinks"],
  "Headache": ["Adequate rest", "Avoid screen time", "Hydration"],
  default: ["Follow prescribed medication", "Review if symptoms worsen", "Stay hydrated"],
};

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: "easeOut" as const },
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

  // Consultation summary & copilot selections
  const [consultationSummary, setConsultationSummary] = useState("");
  const [summaryManuallyEdited, setSummaryManuallyEdited] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedAdvice, setSelectedAdvice] = useState<string[]>([]);
  const [doctorNotes, setDoctorNotes] = useState("");

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
      subjParts.push(`${age ? `${age}-year-old` : ""}${sex ? ` ${sex.toLowerCase()}` : ""}${selectedPatient?.name ? ` (${selectedPatient.name})` : ""}`);
    }
    if (selectedSymptoms.length > 0) {
      subjParts.push(`presents with ${selectedSymptoms.join(", ")}`);
    }
    if (selectedDuration) subjParts.push(`for ${selectedDuration}`);

    const expDetails = Object.entries(expansionSelections)
      .filter(([_, vals]) => vals.length > 0)
      .map(([symptom, vals]) => `${symptom}: ${vals.join(", ")}`);
    if (expDetails.length) subjParts.push(expDetails.join(". "));

    if (intakeData?.chief_complaint && selectedSymptoms.length === 0) {
      subjParts.push(`Chief complaint: ${intakeData.chief_complaint}`);
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
    if (objParts.length) lines.push(`O: ${objParts.join(", ")}`);

    // Known history
    const histParts: string[] = [];
    if (priorMeds.length > 0) histParts.push(`Prior medication: ${priorMeds.join(", ")}`);
    if (selectedPatient?.allergies?.length) histParts.push(`Allergies: ${selectedPatient.allergies.join(", ")}`);
    if (selectedPatient?.current_medications?.length) histParts.push(`Current meds: ${selectedPatient.current_medications.join(", ")}`);
    const conditions = selectedPatient?.medical_history;
    if (conditions && Array.isArray(conditions) && conditions.length > 0) {
      histParts.push(`Conditions: ${conditions.map((h: any) => typeof h === "string" ? h : h?.condition || String(h)).join(", ")}`);
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
    if (selectedAdvice.length > 0) {
      planParts.push(`Advice: ${selectedAdvice.join(", ")}`);
    }
    if (planParts.length) lines.push(`P: ${planParts.join(". ")}`);

    // Doctor notes / recording
    if (doctorNotes.trim()) lines.push(`\nDoctor Notes: ${doctorNotes}`);
    if (transcript.trim() && transcript !== doctorNotes) lines.push(`\nRecording: ${transcript}`);

    return lines.join("\n");
  }, [selectedPatient, selectedSymptoms, selectedDuration, patientVitals, expansionSelections, priorMeds, selectedDiagnoses, pendingRxFromSuggestions, selectedTests, selectedAdvice, doctorNotes, transcript, intakeData]);

  // Auto-update summary unless manually edited
  useEffect(() => {
    if (!summaryManuallyEdited && generatedSummary) {
      setConsultationSummary(generatedSummary);
    }
  }, [generatedSummary, summaryManuallyEdited]);

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
        .select("bp_systolic, bp_diastolic, pulse, temperature, spo2, respiratory_rate, weight_kg, height_cm")
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
    { label: "Record", status: hasTranscript || doctorNotes.trim() ? "done" as const : "pending" as const },
    { label: "Summary", status: isProcessing ? "active" as const : pipelineComplete ? "done" as const : consultationSummary ? "done" as const : "pending" as const },
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

  const copilotAdvice = useMemo(() => {
    const set = new Set<string>();
    selectedSymptoms.forEach(s => (ADVICE_MAP[s] || ADVICE_MAP.default).forEach(a => set.add(a)));
    if (set.size === 0) ADVICE_MAP.default.forEach(a => set.add(a));
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
        toast({ title: "Incomplete Clinical Context", description: "Please fill required fields before generating AI notes.", variant: "destructive" });
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

  // ── Approve & Save ──
  const approveAndSave = async () => {
    if (!user) return;
    if (!reviewConfirmed) { toast({ title: "Confirmation required", description: "Please confirm you have reviewed.", variant: "destructive" }); return; }

    // Run safety check before finalization
    if (!safetyResults) {
      await runSafetyCheck();
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

      // Check workflow mode
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
        toast({ title: "✓ Sent to Front Desk", description: "Consultation saved. Front desk will process report and billing." });
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
        toast({ title: "✓ Consultation finalized", description: "Prescription, labs, invoice, and report generated." });
      }
    } catch (err: any) {
      toast({ title: "Finalization failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); setIsFinalizingConsultation(false); }
  };

  const startNewSession = () => {
    setTranscript(""); setStabilizedTranscript(""); setExtractedData(EMPTY_EXTRACTED);
    setSoapSections(EMPTY_SOAP); setSavedSessionId(null); setSafetyResults(null); setPendingRxFromSuggestions([]);
    setReviewConfirmed(false); setPipelineComplete(false);
    setNormalizationResults([]); setDetectedLanguages([]); setSelectedPatient(null);
    setIntakeData(null); setVisitId(null);
    setClinicalContext(EMPTY_CLINICAL_CONTEXT); setPatientVitals(null);
    setFollowUpDate(""); setFollowUpNotes("");
    setSelectedSymptoms([]); setSelectedDuration(""); setExpansionSelections({});
    setPriorMeds([]); setAutoGenerateTriggered(false); setSymptomSearch("");
    setFinalizationResults(null); setIsFinalizingConsultation(false);
    setConsultationSummary(""); setSummaryManuallyEdited(false);
    setSelectedDiagnoses([]); setSelectedTests([]); setSelectedAdvice([]);
    setDoctorNotes("");
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

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <>
      <SEO title="Clinical Workspace — DATAelixAIr" description="AI clinical consultation workspace" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">

        {/* ── Toolbar ── */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Stethoscope className="h-4 w-4 text-primary" />
              </div>
              <span className="hidden sm:inline">Clinical Cockpit</span>
            </h1>
            <div className="hidden md:block">
              <ConsultationTimeline steps={timelineSteps} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {isProcessing && (
                <motion.div key="processing" {...fadeIn} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-[11px] text-primary font-medium">
                    {isStabilizing ? "Analyzing…" : isExtracting ? "Extracting…" : isRunningSafety ? "Safety check…" : "Building care plan…"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {safetyResults && safetyAlertCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-alert border border-chip-alert-border">
                <AlertTriangle className="h-3 w-3 text-chip-alert-text" />
                <span className="text-[11px] text-chip-alert-text font-medium">{safetyAlertCount} alert{safetyAlertCount > 1 ? "s" : ""}</span>
              </div>
            )}

            <button onClick={toggleDarkMode} className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors">
              {darkMode ? <Sun className="h-3.5 w-3.5 text-foreground" /> : <Moon className="h-3.5 w-3.5 text-foreground" />}
            </button>

            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={startNewSession}>
              <RotateCcw className="h-3 w-3" /> New
            </Button>
          </div>
        </div>

        {/* ── Main Content: Two-column (Main + Copilot sidebar) ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[1fr_320px]">

          {/* ═══ MAIN COLUMN ═══ */}
          <div className="overflow-y-auto pb-20">

            {/* Post-Finalization */}
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
            <div className="max-w-3xl mx-auto w-full p-4 space-y-4">

              {/* ══ SECTION 1: Patient Header ══ */}
              <motion.div {...fadeIn}>
                <ClinicalCard className="p-3">
                  {!selectedPatient ? (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <User className="h-3 w-3" /> Select Patient
                      </p>
                      <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-base shrink-0">
                          {selectedPatient.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{selectedPatient.name}</p>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {selectedPatient.age ? `${selectedPatient.age}y` : "?"} · {selectedPatient.gender?.charAt(0)?.toUpperCase() || "?"}
                            </Badge>
                            {visitId && <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">Visit Active</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            {selectedPatient.phone && <><Phone className="h-2.5 w-2.5" />{selectedPatient.phone}</>}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedPatient(null)}>Change</Button>
                      </div>

                      {/* ── Intake Data: Always visible ── */}

                      {/* Chief Complaint from intake */}
                      {intakeData?.chief_complaint && (
                        <div className="p-2.5 rounded-lg bg-primary/[0.04] border border-primary/15">
                          <p className="text-[9px] font-semibold text-primary uppercase tracking-widest mb-1">Chief Complaint</p>
                          <p className="text-xs text-foreground">{intakeData.chief_complaint}</p>
                          {intakeData.symptom_duration && (
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {intakeData.symptom_duration}</p>
                          )}
                        </div>
                      )}

                      {/* Vitals row */}
                      {patientVitals && (
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Activity className="h-2.5 w-2.5" /> Vitals
                          </p>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                            {patientVitals.bp_systolic && (
                              <div className="text-center p-1.5 rounded-lg bg-background border border-border">
                                <Heart className="h-3 w-3 text-chip-alert-text mx-auto mb-0.5" />
                                <p className="text-[11px] font-semibold text-foreground">{patientVitals.bp_systolic}/{patientVitals.bp_diastolic}</p>
                                <p className="text-[8px] text-muted-foreground">BP</p>
                              </div>
                            )}
                            {patientVitals.pulse && (
                              <div className="text-center p-1.5 rounded-lg bg-background border border-border">
                                <Activity className="h-3 w-3 text-primary mx-auto mb-0.5" />
                                <p className="text-[11px] font-semibold text-foreground">{patientVitals.pulse}</p>
                                <p className="text-[8px] text-muted-foreground">HR</p>
                              </div>
                            )}
                            {patientVitals.temperature && (
                              <div className={`text-center p-1.5 rounded-lg border ${Number(patientVitals.temperature) > 99 ? "bg-chip-alert border-chip-alert-border" : "bg-background border-border"}`}>
                                <Thermometer className="h-3 w-3 mx-auto mb-0.5" />
                                <p className="text-[11px] font-semibold">{patientVitals.temperature}°F</p>
                                <p className="text-[8px] text-muted-foreground">Temp</p>
                              </div>
                            )}
                            {patientVitals.spo2 && (
                              <div className={`text-center p-1.5 rounded-lg border ${Number(patientVitals.spo2) < 95 ? "bg-chip-alert border-chip-alert-border" : "bg-background border-border"}`}>
                                <Droplets className="h-3 w-3 mx-auto mb-0.5" />
                                <p className="text-[11px] font-semibold">{patientVitals.spo2}%</p>
                                <p className="text-[8px] text-muted-foreground">SpO₂</p>
                              </div>
                            )}
                            {patientVitals.respiratory_rate && (
                              <div className="text-center p-1.5 rounded-lg bg-background border border-border">
                                <Wind className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                                <p className="text-[11px] font-semibold text-foreground">{patientVitals.respiratory_rate}</p>
                                <p className="text-[8px] text-muted-foreground">RR</p>
                              </div>
                            )}
                            {patientVitals.weight_kg && (
                              <div className="text-center p-1.5 rounded-lg bg-background border border-border">
                                <p className="text-[11px] font-semibold text-foreground">{patientVitals.weight_kg}kg</p>
                                <p className="text-[8px] text-muted-foreground">Weight</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Allergies, Medications, Conditions — always visible */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {selectedPatient.allergies?.length ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-semibold text-chip-alert-text uppercase flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" /> Allergies:</span>
                            {selectedPatient.allergies.map(a => <Chip key={a} variant="alert" size="sm">{a}</Chip>)}
                          </div>
                        ) : null}
                        {selectedPatient.current_medications?.length ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase flex items-center gap-0.5"><Pill className="h-2.5 w-2.5" /> Meds:</span>
                            {selectedPatient.current_medications.map(m => <Chip key={m} variant="medication" size="sm">{m}</Chip>)}
                          </div>
                        ) : null}
                        {selectedPatient.medical_history && Array.isArray(selectedPatient.medical_history) && (selectedPatient.medical_history as any[]).length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase">Conditions:</span>
                            {(selectedPatient.medical_history as any[]).map((h: any, i: number) => (
                              <Chip key={i} variant="diagnosis" size="sm">{typeof h === "string" ? h : h?.condition || String(h)}</Chip>
                            ))}
                          </div>
                        )}
                      </div>

                      {intakeData?.notes && (
                        <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">{intakeData.notes}</p>
                      )}
                    </div>
                  )}
                </ClinicalCard>
              </motion.div>

              {/* ══ SECTION 2: Symptoms & Duration (quick capture) ══ */}
              {selectedPatient && (
                <motion.div {...fadeIn}>
                  <ClinicalCard>
                    <ClinicalCardHeader
                      title="Symptoms & Duration"
                      icon={<ClipboardCheck className="h-4 w-4" />}
                      badge={selectedSymptoms.length > 0 ? <Badge variant="outline" className="text-[10px]">{selectedSymptoms.length} selected</Badge> : undefined}
                    />

                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        {filteredSymptoms.map(s => (
                          <Chip key={s} variant="symptom" selected={selectedSymptoms.includes(s)} onClick={() => toggleSymptom(s)}>{s}</Chip>
                        ))}
                      </div>
                    </div>

                    {/* Search */}
                    <div className="mt-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text" value={symptomSearch} onChange={e => setSymptomSearch(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && symptomSearch.trim()) { toggleSymptom(symptomSearch.trim()); setSymptomSearch(""); } }}
                          placeholder="Search or add symptom…"
                          className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </div>
                    </div>

                    {/* Expansions */}
                    <AnimatePresence>
                      {activeExpansions.map(symptom => {
                        const expansion = SYMPTOM_EXPANSIONS[symptom];
                        return (
                          <motion.div key={`exp-${symptom}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
                            <div className="pl-3 border-l-2 border-primary/20">
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

                    {/* Duration */}
                    <AnimatePresence>
                      {selectedSymptoms.length > 0 && (
                        <motion.div {...fadeIn} className="mt-3">
                          <ChipGroup label="Duration">
                            {DURATION_PRESETS.map(d => (
                              <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>{d}</Chip>
                            ))}
                          </ChipGroup>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Prior meds */}
                    <AnimatePresence>
                      {selectedSymptoms.length > 0 && (
                        <motion.div {...fadeIn} className="mt-3">
                          <PresetChipGroup label="Medication already taken" options={MEDICATION_PRESETS} selected={priorMeds} onToggle={(m) => setPriorMeds(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])} variant="medication" allowCustom />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* ══ SECTION 3: Record / Write (Doctor Notes + Voice) ══ */}
              {selectedPatient && (
                <motion.div {...fadeIn}>
                  <ClinicalCard>
                    <ClinicalCardHeader
                      title="Record / Write"
                      icon={<Mic className="h-4 w-4" />}
                      badge={
                        <div className="flex gap-1">
                          {hasTranscript && <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">Recording captured</Badge>}
                        </div>
                      }
                    />
                    <p className="text-[10px] text-muted-foreground mb-2">Record the consultation or type notes. AI will validate and extract clinical data automatically.</p>
                    <ConsultationInput transcript={transcript} onTranscriptChange={setTranscript} disabled={pipelineRunning} />
                    <div className="mt-3">
                      <Label className="text-[10px] font-semibold text-muted-foreground uppercase">Additional Notes</Label>
                      <Textarea
                        value={doctorNotes}
                        onChange={(e) => setDoctorNotes(e.target.value)}
                        rows={2}
                        className="text-xs min-h-[40px] resize-y rounded-lg mt-1"
                        placeholder="Additional findings, observations…"
                      />
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* AI Processing Animation */}
              <AnimatePresence>
                {pipelineRunning && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="py-2">
                    <ClinicalCard className="border-primary/20">
                      <div className="flex flex-col items-center justify-center py-6 space-y-3">
                        <div className="relative">
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center"><Brain className="h-6 w-6 text-primary" /></div>
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center"><Loader2 className="h-2.5 w-2.5 animate-spin text-primary-foreground" /></div>
                        </div>
                        <p className="text-sm font-semibold text-foreground">AI analyzing…</p>
                        <p className="text-[11px] text-muted-foreground">Building transcript, safety checks, and care plan</p>
                      </div>
                    </ClinicalCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ══ SECTION 4: Auto-Generated Consultation Summary (SOAP Transcript) ══ */}
              {(selectedSymptoms.length > 0 || hasTranscript || intakeData) && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="border-primary/15">
                    <ClinicalCardHeader
                      title="Consultation Transcript"
                      icon={<FileText className="h-4 w-4" />}
                      badge={
                        <div className="flex gap-1">
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] gap-1"><Sparkles className="h-2.5 w-2.5" />Auto-generated</Badge>
                          {summaryManuallyEdited && <Badge variant="outline" className="text-[9px]">Edited</Badge>}
                        </div>
                      }
                      action={
                        <div className="flex gap-1">
                          {summaryManuallyEdited && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => { setSummaryManuallyEdited(false); setConsultationSummary(generatedSummary); }}>
                              <RotateCcw className="h-2.5 w-2.5 mr-1" /> Reset
                            </Button>
                          )}
                          {!pipelineRunning && hasSymptomInput && (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={runFullPipeline} disabled={pipelineRunning}>
                              <Brain className="h-2.5 w-2.5" /> Run AI
                            </Button>
                          )}
                        </div>
                      }
                    />
                    <Textarea
                      value={consultationSummary}
                      onChange={(e) => { setConsultationSummary(e.target.value); setSummaryManuallyEdited(true); }}
                      rows={8}
                      className="text-xs min-h-[100px] resize-y rounded-lg bg-muted/30 border-border/50 font-mono"
                      placeholder="SOAP transcript will auto-generate from symptoms, recording, and AI copilot selections…"
                    />
                    <p className="text-[9px] text-muted-foreground mt-1.5">This transcript updates live as you select symptoms, record, and choose from AI copilot. Edit freely.</p>

                    {/* Safety alerts inline */}
                    {safetyResults && safetyAlertCount > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-semibold text-chip-alert-text uppercase flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Clinical Guardrails</p>
                        {safetyResults.allergy_flags.map((f, i) => (
                          <div key={`a-${i}`} className="p-2 rounded-lg border border-chip-alert-border bg-chip-alert text-[11px] text-chip-alert-text font-medium flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{f.message}
                          </div>
                        ))}
                        {safetyResults.interaction_flags.map((f, i) => (
                          <div key={`i-${i}`} className={`p-2 rounded-lg border text-[11px] flex items-center gap-2 ${severityColor(f.severity)}`}>
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-semibold">{f.drug_a} ↔ {f.drug_b}</span>: {f.description}
                          </div>
                        ))}
                        {safetyResults.dose_warnings.map((w, i) => (
                          <div key={`d-${i}`} className="p-2 rounded-lg border border-chip-lab-border bg-chip-lab text-[11px] text-chip-lab-text flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{w.message}
                          </div>
                        ))}
                        {(safetyResults.vitals_dangers || []).map((v, i) => (
                          <div key={`v-${i}`} className={`p-2 rounded-lg border text-[11px] ${severityColor(v.severity)}`}>{v.message}</div>
                        ))}
                        {(safetyResults.emergency_patterns || []).map((ep, i) => (
                          <div key={`e-${i}`} className={`p-2 rounded-lg border text-[11px] ${severityColor(ep.severity)}`}>
                            <span className="font-semibold">{ep.pattern}</span>: {ep.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* SOAP from AI pipeline (if available) */}
                    {pipelineComplete && hasSoap && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                          <Brain className="h-3 w-3 text-primary" /> AI SOAP Notes
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] ml-1">Draft</Badge>
                        </p>
                        {(Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section) => (
                          soapSections[section]?.trim() ? (
                            <div key={section} className="space-y-0.5">
                              <Label className="text-[10px] font-semibold text-muted-foreground">{section}</Label>
                              <Textarea value={soapSections[section]} onChange={e => updateSoapSection(section, e.target.value)} rows={2} className="text-xs min-h-[28px] resize-y rounded-lg bg-background/50" />
                            </div>
                          ) : null
                        ))}
                      </div>
                    )}
                  </ClinicalCard>
                </motion.div>
              )}

              {/* ══ SECTION 5: Final Review Panel ══ */}
              {(selectedDiagnoses.length > 0 || pendingRxFromSuggestions.length > 0 || selectedTests.length > 0 || selectedAdvice.length > 0 || (selectedPatient && hasSymptomInput)) && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="border-primary/15 bg-gradient-to-br from-chip-medication/20 to-transparent">
                    <ClinicalCardHeader title="Final Review" icon={<ClipboardCheck className="h-4 w-4" />} />

                    {/* Diagnosis */}
                    {selectedDiagnoses.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Diagnosis</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDiagnoses.map(d => <Chip key={d} variant="diagnosis" selected removable onRemove={() => toggleDiagnosis(d)}>{d}</Chip>)}
                        </div>
                      </div>
                    )}

                    {/* Prescription */}
                    {pendingRxFromSuggestions.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Prescription</p>
                        <div className="space-y-1.5">
                          {pendingRxFromSuggestions.map((rx, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                              <Pill className="h-3 w-3 text-chip-medication-text shrink-0" />
                              <span className="text-xs font-medium text-foreground">{rx.drug_name}</span>
                              <span className="text-[10px] text-muted-foreground">{rx.dose} · {rx.frequency} · {rx.duration}</span>
                              <button onClick={() => setPendingRxFromSuggestions(prev => prev.filter((_, idx) => idx !== i))} className="ml-auto text-muted-foreground hover:text-destructive">
                                <XCircle className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lab Tests */}
                    {selectedTests.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Lab Orders</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTests.map(t => <Chip key={t} variant="lab" selected removable onRemove={() => toggleTest(t)}>{t}</Chip>)}
                        </div>
                      </div>
                    )}

                    {/* Advice */}
                    {selectedAdvice.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Advice</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedAdvice.map(a => <Chip key={a} variant="neutral" selected removable onRemove={() => toggleAdvice(a)}>{a}</Chip>)}
                        </div>
                      </div>
                    )}

                    {/* Follow-up */}
                    <div className="mb-3">
                      <FollowUpPanel followUpDate={followUpDate} onFollowUpDateChange={setFollowUpDate} followUpNotes={followUpNotes} onFollowUpNotesChange={setFollowUpNotes} />
                    </div>

                    {/* Approve & Finalize */}
                    <div className="pt-3 border-t border-border space-y-3">
                      <div className="flex items-start gap-2">
                        <Checkbox id="final-review" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} />
                        <label htmlFor="final-review" className="text-[11px] text-muted-foreground cursor-pointer select-none leading-relaxed">
                          I have reviewed the consultation summary, prescriptions, and safety alerts. Send to front desk / finalize.
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <motion.div whileTap={{ scale: 0.98 }} className="flex-1">
                          <Button onClick={approveAndSave} disabled={isSaving || isFinalizingConsultation || !reviewConfirmed} className="w-full h-11 rounded-xl text-sm font-semibold gap-2" size="lg">
                            {(isSaving || isFinalizingConsultation) ? <><Loader2 className="h-4 w-4 animate-spin" />Finalizing…</> : <><CheckCircle className="h-4 w-4" />Finalize & Send</>}
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* Empty state */}
              {!selectedPatient && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                    <Stethoscope className="h-8 w-8 text-primary/20" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">Select a patient to start the consultation.</p>
                </motion.div>
              )}
            </div>
            )}
          </div>

          {/* ═══ RIGHT: AI Copilot Sidebar ═══ */}
          <div className="overflow-y-auto border-l border-border bg-card/30 max-lg:hidden">
            <div className="p-3 space-y-3">

              {/* Copilot Header */}
              <div className="flex items-center gap-2 px-1">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center relative">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-chip-medication-text animate-pulse" />
                </div>
                <span className="text-xs font-semibold text-foreground">AI Copilot</span>
                <Badge className="bg-chip-medication border-chip-medication-border text-chip-medication-text text-[9px] ml-auto">Active</Badge>
              </div>

              {/* AI Suggestions — Diagnosis */}
              {selectedSymptoms.length > 0 && copilotDiagnoses.length > 0 && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="p-3 border-primary/10">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Brain className="h-3 w-3 text-primary" /> Possible Diagnosis
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {copilotDiagnoses.map(d => (
                        <Chip key={d} variant="diagnosis" size="sm" selected={selectedDiagnoses.includes(d)} onClick={() => toggleDiagnosis(d)}>{d}</Chip>
                      ))}
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* AI Suggestions — Tests */}
              {selectedSymptoms.length > 0 && copilotTests.length > 0 && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="p-3 border-primary/10">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                      <FlaskConical className="h-3 w-3 text-chip-lab-text" /> Suggested Tests
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {copilotTests.map(t => (
                        <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)} onClick={() => toggleTest(t)}>{t}</Chip>
                      ))}
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* AI Suggestions — Medications */}
              {contextualRx.length > 0 && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="p-3 border-primary/10">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Pill className="h-3 w-3 text-chip-medication-text" /> Suggested Medications
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {contextualRx.map((rx, i) => (
                        <Chip
                          key={i} variant="medication" size="sm" addable
                          selected={pendingRxFromSuggestions.some(p => p.drug_name === rx.drug)}
                          onClick={() => {
                            if (pendingRxFromSuggestions.some(p => p.drug_name === rx.drug)) {
                              setPendingRxFromSuggestions(prev => prev.filter(p => p.drug_name !== rx.drug));
                            } else {
                              setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
                            }
                          }}
                        >
                          {rx.drug} {rx.dose}
                        </Chip>
                      ))}
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* AI Suggestions — Advice */}
              {selectedSymptoms.length > 0 && copilotAdvice.length > 0 && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="p-3 border-primary/10">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Advice</p>
                    <div className="flex flex-wrap gap-1.5">
                      {copilotAdvice.map(a => (
                        <Chip key={a} variant="neutral" size="sm" selected={selectedAdvice.includes(a)} onClick={() => toggleAdvice(a)}>{a}</Chip>
                      ))}
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* Doctor Favorites */}
              <CollapsibleSection title="Quick Rx" icon={Pill} defaultOpen>
                <div className="px-0.5">
                  <DoctorFavoritesPanel
                    onSelectDrug={(drug) => {
                      setPendingRxFromSuggestions(prev => [...prev, { drug_name: drug.drug_name, dose: drug.dosage, frequency: drug.frequency, duration: drug.duration }]);
                      toast({ title: `+ ${drug.drug_name}`, description: `${drug.dosage} · ${drug.frequency}` });
                    }}
                  />
                </div>
              </CollapsibleSection>

              {/* Smart Suggestions (AI backend) */}
              <SmartSuggestionsPanel
                chiefComplaint={extractedData.chief_complaint}
                duration={extractedData.duration || ""}
                symptoms={extractedData.associated_symptoms || ""}
                vitals={extractedData.vitals || ""}
                patientAge={selectedPatient?.age ?? null}
                patientGender={selectedPatient?.gender ?? null}
                allergies={extractedData.allergies || ""}
                medications={extractedData.current_medications || ""}
                conditions={extractedData.chronic_conditions || ""}
                userId={user?.id || ""}
                transcriptExcerpt={stabilizedTranscript || transcript}
                clinicalContext={clinicalContext}
                onAddPrescription={(rx) => {
                  setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug_name, dose: rx.dose, frequency: rx.frequency, duration: rx.duration }]);
                  toast({ title: `+ ${rx.drug_name}`, description: `${rx.dose} · ${rx.frequency}` });
                }}
                onAddLabTest={(testName) => { toggleTest(testName); toast({ title: `+ ${testName}`, description: "Added to lab orders" }); }}
                onInsertText={(text) => { setDoctorNotes(prev => prev ? `${prev}\n${text}` : text); toast({ title: "Inserted", description: text.slice(0, 50) + "…" }); }}
              />

              {/* Evidence */}
              {hasSoap && (
                <EvidencePanel
                  medications={extractedData.current_medications ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : []}
                  diagnosis={soapSections["Provisional Diagnosis"] || extractedData.chief_complaint}
                  allergies={extractedData.allergies ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : []}
                  confidenceLevel={safetyResults?.confidence_level || "moderate"}
                />
              )}
            </div>
          </div>
        </div>

        {/* ═══ FLOATING BOTTOM BAR — only for finalization shortcut ═══ */}
        <AnimatePresence>
          {!finalizationResults && selectedPatient && hasSymptomInput && !savedSessionId && (
            <motion.div
              initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-0 left-0 lg:left-56 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {pipelineRunning && <><Loader2 className="h-3 w-3 animate-spin text-primary" /> AI analyzing…</>}
                {pipelineComplete && !pipelineRunning && <><CheckCircle className="h-3 w-3 text-primary" /> AI analysis complete</>}
                {!pipelineComplete && !pipelineRunning && <><Sparkles className="h-3 w-3" /> AI runs automatically when ready</>}
              </div>
              <Button
                onClick={approveAndSave}
                disabled={isSaving || isFinalizingConsultation || !reviewConfirmed}
                className="h-10 rounded-xl text-sm font-semibold gap-2 px-8"
                size="lg"
              >
                {(isSaving || isFinalizingConsultation) ? <><Loader2 className="h-4 w-4 animate-spin" />Finalizing…</> : <><CheckCircle className="h-4 w-4" />Finalize & Send</>}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
