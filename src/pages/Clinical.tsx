import { useState, useEffect, useCallback } from "react";
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
import InlinePrescriptionBuilder from "@/components/InlinePrescriptionBuilder";
import InlineLabOrders from "@/components/InlineLabOrders";
import DoctorFavoritesPanel from "@/components/DoctorFavoritesPanel";
import IntakeSummary, { type IntakeData } from "@/components/IntakeSummary";
import DoctorIntakeReview from "@/components/DoctorIntakeReview";
import SmartSuggestionsPanel from "@/components/SmartSuggestionsPanel";
import CollapsibleSection from "@/components/clinical/CollapsibleSection";
import FollowUpPanel from "@/components/clinical/FollowUpPanel";
import ConsultationTimeline from "@/components/ConsultationTimeline";
import ConsultationComplete from "@/components/ConsultationComplete";
import VisitTimeline from "@/components/VisitTimeline";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Save, FileText,
  Edit3, ShieldCheck, AlertTriangle, XCircle, CheckCircle,
  Languages, HeartPulse, Pill, FlaskConical, User,
  Sparkles, RotateCcw, Clock, ClipboardCheck, Brain, CalendarDays,
  Zap, Activity, Stethoscope, Eye, Search, Moon, Sun,
  Heart, Thermometer, Wind, Droplets, Shield
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
const SUGGESTED_CONDITIONS = ["Dengue suspicion", "Malaria suspicion", "UTI symptoms", "URTI", "Gastritis", "Viral syndrome"];
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

  // Patient explanation
  const [patientExplanation, setPatientExplanation] = useState("");
  const [explanationLang, setExplanationLang] = useState<"english" | "telugu">("telugu");
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);

  // Follow-up
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");

  // Session management
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [pendingRxFromSuggestions, setPendingRxFromSuggestions] = useState<{ drug_name: string; dose: string; frequency: string; duration: string }[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [intakeApproved, setIntakeApproved] = useState(false);
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

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  }, [darkMode]);

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
    const hasEnoughContext = selectedSymptoms.length >= 2 && selectedDuration !== "";
    if (hasEnoughContext && selectedPatient) {
      setAutoGenerateTriggered(true);
      // Small delay so UI feels intentional
      const timer = setTimeout(() => runFullPipeline(), 800);
      return () => clearTimeout(timer);
    }
  }, [selectedSymptoms, selectedDuration, selectedPatient, autoGenerateTriggered, pipelineRunning, pipelineComplete]);

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
    { label: "Symptoms", status: hasSymptomInput ? "done" as const : "pending" as const },
    { label: "AI Plan", status: isProcessing ? "active" as const : pipelineComplete ? "done" as const : "pending" as const },
    { label: "Review", status: pipelineComplete && !savedSessionId ? "active" as const : savedSessionId ? "done" as const : "pending" as const },
    { label: "Saved", status: savedSessionId ? "done" as const : "pending" as const },
  ];

  const activeExpansions = selectedSymptoms.filter(s => SYMPTOM_EXPANSIONS[s]);
  
  // Contextual quick Rx based on selected symptoms
  const contextualRx = selectedSymptoms.flatMap(s => QUICK_RX_TEMPLATES[s] || []);

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
    if (!effectiveTranscript) { toast({ title: "No input", description: "Select symptoms or type notes first.", variant: "destructive" }); return; }
    
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
    if (!reviewConfirmed) { toast({ title: "Confirmation required", description: "Please confirm you have reviewed the AI care plan.", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-consultation", {
        body: {
          patient_id: selectedPatient?.id || null,
          clinic_id: profileClinicId,
          visit_id: visitId,
          transcript,
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
      if (error) throw new Error(error.message);
      setSavedSessionId(data.consultation_id);

      if (visitId) {
        await supabase.functions.invoke("finalize-visit", {
          body: {
            visit_id: visitId,
            consultation_id: data.consultation_id,
            clinic_id: profileClinicId,
            target_status: "consultation_complete",
            billing_enabled: true,
          },
        });
      }

      toast({ title: "✓ Consultation saved", description: "Care plan approved. Prescriptions, lab orders, and report generated." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const startNewSession = () => {
    setTranscript(""); setStabilizedTranscript(""); setExtractedData(EMPTY_EXTRACTED);
    setSoapSections(EMPTY_SOAP); setSavedSessionId(null); setSafetyResults(null); setPendingRxFromSuggestions([]);
    setPatientExplanation(""); setReviewConfirmed(false); setPipelineComplete(false);
    setNormalizationResults([]); setDetectedLanguages([]); setSelectedPatient(null);
    setIntakeData(null); setVisitId(null); setIntakeApproved(false);
    setClinicalContext(EMPTY_CLINICAL_CONTEXT); setPatientVitals(null);
    setFollowUpDate(""); setFollowUpNotes("");
    setSelectedSymptoms([]); setSelectedDuration(""); setExpansionSelections({});
    setPriorMeds([]); setAutoGenerateTriggered(false); setSymptomSearch("");
  };

  const generatePatientExplanation = async () => {
    setIsGeneratingExplanation(true);
    try {
      const soapText = Object.entries(soapSections).map(([h, c]) => `${h}: ${c}`).join("\n");
      const { data, error } = await supabase.functions.invoke("patient-explanation", { body: { soap_summary: soapText, language: explanationLang } });
      if (error) throw new Error(error.message);
      setPatientExplanation(data.explanation || "");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setIsGeneratingExplanation(false); }
  };

  const updateExtractedField = (field: keyof ExtractedData, value: string) => setExtractedData(prev => ({ ...prev, [field]: value }));
  const updateSoapSection = (section: keyof SoapSections, value: string) => setSoapSections(prev => ({ ...prev, [section]: value }));

  const safetyAlertCount = safetyResults ? (safetyResults.interaction_flags.length + safetyResults.allergy_flags.length + safetyResults.dose_warnings.length + (safetyResults.vitals_dangers?.length || 0) + (safetyResults.emergency_patterns?.length || 0)) : 0;

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

  // Filtered symptoms for search
  const filteredSymptoms = symptomSearch
    ? COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(symptomSearch.toLowerCase()))
    : COMMON_SYMPTOMS;

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

            {/* Progress Steps */}
            <div className="hidden md:block">
              <ConsultationTimeline steps={timelineSteps} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Status Indicator */}
            <AnimatePresence mode="wait">
              {isProcessing && (
                <motion.div key="processing" {...fadeIn} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                  <div className="relative">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <div className="absolute inset-0 h-3 w-3 rounded-full bg-primary/20 animate-ping" />
                  </div>
                  <span className="text-[11px] text-primary font-medium">
                    {isStabilizing && "Analyzing…"}
                    {!isStabilizing && isExtracting && "Extracting…"}
                    {!isStabilizing && !isExtracting && isRunningSafety && "Safety check…"}
                    {!isStabilizing && !isExtracting && !isRunningSafety && isGeneratingSoap && "Building care plan…"}
                  </span>
                </motion.div>
              )}

              {pipelineComplete && !isProcessing && !savedSessionId && (
                <motion.div key="ready" {...fadeIn} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-chip-medication border border-chip-medication-border">
                  <CheckCircle className="h-3 w-3 text-chip-medication-text" />
                  <span className="text-[11px] text-chip-medication-text font-semibold">AI Plan Ready — Review Below</span>
                </motion.div>
              )}
            </AnimatePresence>

            {safetyResults && safetyAlertCount > 0 && (
              <motion.div {...fadeIn} className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-alert border border-chip-alert-border">
                <AlertTriangle className="h-3 w-3 text-chip-alert-text" />
                <span className="text-[11px] text-chip-alert-text font-medium">{safetyAlertCount} alert{safetyAlertCount > 1 ? "s" : ""}</span>
              </motion.div>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
              title="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5 text-foreground" /> : <Moon className="h-3.5 w-3.5 text-foreground" />}
            </button>

            {/* Command palette hint */}
            <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-muted/50 text-muted-foreground cursor-pointer hover:bg-muted transition-colors" onClick={() => { const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true }); document.dispatchEvent(event); }}>
              <Search className="h-3 w-3" />
              <span className="text-[10px]">⌘K</span>
            </div>

            {savedSessionId && (
              <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View Saved</Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={startNewSession}>
              <RotateCcw className="h-3 w-3" /> New
            </Button>
          </div>
        </div>

        {/* ── 3-Column Layout ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[300px_1fr_340px]">

          {/* ═══ LEFT: Patient Context (Visual Cards) ═══ */}
          <div className="overflow-y-auto border-r border-border bg-card/50 max-lg:border-b max-lg:max-h-[40vh]">
            <div className="p-3 space-y-3">
              {/* Patient Selector */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Patient
                </p>
                <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
              </div>

              {/* Patient Identity Card */}
              <AnimatePresence>
                {selectedPatient && (
                  <motion.div {...fadeIn}>
                    <ClinicalCard className="p-3 bg-gradient-to-br from-primary/[0.04] to-transparent">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {selectedPatient.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{selectedPatient.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {selectedPatient.age ? `${selectedPatient.age}${selectedPatient.gender ? selectedPatient.gender.charAt(0).toUpperCase() : ""}` : "Age unknown"}
                            {selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Vitals Chips */}
                      {patientVitals && (
                        <div className="mb-2.5">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <Activity className="h-2.5 w-2.5" /> Vitals
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {patientVitals.bp_systolic && (
                              <Chip variant="neutral" size="sm" icon={<Heart className="h-2.5 w-2.5 text-chip-alert-text" />}>
                                BP {patientVitals.bp_systolic}/{patientVitals.bp_diastolic}
                              </Chip>
                            )}
                            {patientVitals.pulse && (
                              <Chip variant="neutral" size="sm" icon={<Activity className="h-2.5 w-2.5 text-primary" />}>
                                HR {patientVitals.pulse}
                              </Chip>
                            )}
                            {patientVitals.temperature && (
                              <Chip variant={Number(patientVitals.temperature) > 99 ? "alert" : "neutral"} size="sm" icon={<Thermometer className="h-2.5 w-2.5" />}>
                                {patientVitals.temperature}°F
                              </Chip>
                            )}
                            {patientVitals.spo2 && (
                              <Chip variant={Number(patientVitals.spo2) < 95 ? "alert" : "neutral"} size="sm" icon={<Droplets className="h-2.5 w-2.5" />}>
                                SpO₂ {patientVitals.spo2}%
                              </Chip>
                            )}
                            {patientVitals.respiratory_rate && (
                              <Chip variant="neutral" size="sm" icon={<Wind className="h-2.5 w-2.5" />}>
                                RR {patientVitals.respiratory_rate}
                              </Chip>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Conditions */}
                      {selectedPatient.medical_history && (Array.isArray(selectedPatient.medical_history) ? selectedPatient.medical_history : []).length > 0 && (
                        <div className="mb-2.5">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Conditions</p>
                          <div className="flex flex-wrap gap-1">
                            {(Array.isArray(selectedPatient.medical_history) ? selectedPatient.medical_history : []).map((h: any, i: number) => (
                              <Chip key={i} variant="diagnosis" size="sm">{typeof h === 'string' ? h : h?.condition || String(h)}</Chip>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Allergies */}
                      {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                        <div className="mb-2.5">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <Shield className="h-2.5 w-2.5 text-chip-alert-text" /> Allergies
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedPatient.allergies.map(a => (
                              <Chip key={a} variant="alert" size="sm">{a}</Chip>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Medications */}
                      {selectedPatient.current_medications && selectedPatient.current_medications.length > 0 && (
                        <div>
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <Pill className="h-2.5 w-2.5 text-chip-medication-text" /> Current Medications
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {selectedPatient.current_medications.map(m => (
                              <Chip key={m} variant="medication" size="sm">{m}</Chip>
                            ))}
                          </div>
                        </div>
                      )}
                    </ClinicalCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Intake Review */}
              <DoctorIntakeReview
                patientId={selectedPatient?.id || null}
                visitId={visitId}
                intakeData={intakeData}
                userId={user?.id || ""}
                onApproved={(approved) => {
                  setIntakeData(approved); setIntakeApproved(true);
                  setExtractedData(prev => ({
                    ...prev,
                    chief_complaint: approved.chief_complaint || prev.chief_complaint,
                    allergies: approved.allergies_noted || prev.allergies,
                    current_medications: approved.current_medications || prev.current_medications,
                  }));
                }}
              />

              {/* Visit History */}
              <CollapsibleSection title="Visit History" icon={Clock}>
                <VisitTimeline patientId={selectedPatient?.id || null} />
              </CollapsibleSection>
            </div>
          </div>

          {/* ═══ CENTER: Structured Clinical Builder ═══ */}
          <div className="overflow-y-auto flex flex-col pb-20 lg:pb-16">
            <div className="flex-1 p-4 space-y-4 max-w-3xl mx-auto w-full">

              {/* ── Structured Sentence Builder ── */}
              <motion.div {...fadeIn}>
                <ClinicalCard>
                  <ClinicalCardHeader 
                    title="Clinical Builder" 
                    icon={<Edit3 className="h-4 w-4" />}
                    badge={selectedSymptoms.length > 0 ? <Badge variant="outline" className="text-[10px]">{selectedSymptoms.length} selected</Badge> : undefined}
                  />

                  {/* Structured sentence */}
                  {selectedSymptoms.length > 0 && (
                    <motion.div {...fadeIn} className="mb-4 p-3 rounded-xl bg-muted/50 border border-border">
                      <p className="text-xs text-foreground leading-relaxed">
                        <span className="text-muted-foreground">Patient has </span>
                        {selectedSymptoms.map((s, i) => (
                          <span key={s}>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-chip-symptom text-chip-symptom-text text-[11px] font-medium mx-0.5">{s}</span>
                            {i < selectedSymptoms.length - 1 && <span className="text-muted-foreground">{i === selectedSymptoms.length - 2 ? " and " : ", "}</span>}
                          </span>
                        ))}
                        {selectedDuration && (
                          <>
                            <span className="text-muted-foreground"> for </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted border border-border text-[11px] font-medium">{selectedDuration}</span>
                          </>
                        )}
                        {priorMeds.length > 0 && (
                          <>
                            <span className="text-muted-foreground">. Already taken </span>
                            {priorMeds.map((m, i) => (
                              <span key={m}>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-chip-medication text-chip-medication-text text-[11px] font-medium mx-0.5">{m}</span>
                                {i < priorMeds.length - 1 && <span className="text-muted-foreground">, </span>}
                              </span>
                            ))}
                          </>
                        )}
                        <span className="text-muted-foreground">.</span>
                      </p>
                    </motion.div>
                  )}

                  {/* Common Symptoms */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Common Symptoms</p>
                    <div className="flex flex-wrap gap-1.5">
                      {filteredSymptoms.map(s => (
                        <Chip
                          key={s}
                          variant="symptom"
                          selected={selectedSymptoms.includes(s)}
                          onClick={() => toggleSymptom(s)}
                        >
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {/* AI Suggested Conditions */}
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5 text-primary" /> Suggested
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_CONDITIONS.map(s => (
                        <Chip
                          key={s}
                          variant="diagnosis"
                          selected={selectedSymptoms.includes(s)}
                          onClick={() => toggleSymptom(s)}
                        >
                          {s}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {/* Search symptom */}
                  <div className="mt-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={symptomSearch}
                        onChange={e => setSymptomSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && symptomSearch.trim()) {
                            toggleSymptom(symptomSearch.trim());
                            setSymptomSearch("");
                          }
                        }}
                        placeholder="Search or add symptom…"
                        className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Dynamic Symptom Expansions */}
                  <AnimatePresence>
                    {activeExpansions.map(symptom => {
                      const expansion = SYMPTOM_EXPANSIONS[symptom];
                      return (
                        <motion.div
                          key={`expansion-${symptom}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden mt-3"
                        >
                          <div className="pl-3 border-l-2 border-primary/20">
                            <ChipGroup label={`${symptom} → ${expansion.label}`}>
                              {expansion.chips.map(chip => (
                                <Chip
                                  key={chip}
                                  variant={expansion.variant}
                                  selected={(expansionSelections[symptom] || []).includes(chip)}
                                  onClick={() => toggleExpansionChip(symptom, chip)}
                                  size="sm"
                                >
                                  {chip}
                                </Chip>
                              ))}
                            </ChipGroup>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Duration Chips */}
                  <AnimatePresence>
                    {selectedSymptoms.length > 0 && (
                      <motion.div {...fadeIn} className="mt-3">
                        <ChipGroup label="Duration">
                          {DURATION_PRESETS.map(d => (
                            <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>
                              {d}
                            </Chip>
                          ))}
                        </ChipGroup>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Prior Medication */}
                  <AnimatePresence>
                    {selectedSymptoms.length > 0 && (
                      <motion.div {...fadeIn} className="mt-3">
                        <PresetChipGroup
                          label="Medication already taken"
                          options={MEDICATION_PRESETS}
                          selected={priorMeds}
                          onToggle={(m) => setPriorMeds(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                          variant="medication"
                          allowCustom
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Voice / Notes (compact) */}
                  <CollapsibleSection title="Voice / Additional Notes" icon={Edit3} defaultOpen={false}>
                    <ConsultationInput
                      transcript={transcript}
                      onTranscriptChange={setTranscript}
                      disabled={pipelineRunning}
                    />
                  </CollapsibleSection>
                </ClinicalCard>
              </motion.div>

              {/* Normalization feedback */}
              <AnimatePresence>
                {normalizationResults.length > 0 && (
                  <motion.div {...fadeIn}>
                    <ClinicalCard className="p-3">
                      {detectedLanguages.length > 1 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          <Languages className="h-3 w-3 text-primary" />
                          <span className="text-[10px] text-muted-foreground">Detected:</span>
                          {detectedLanguages.map(l => <Chip key={l} variant="neutral" size="sm">{l}</Chip>)}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {normalizationResults.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border bg-background">
                            <span className="text-muted-foreground">{m.original}</span>→
                            <span className="font-medium text-foreground">{m.clinical}</span>
                          </span>
                        ))}
                      </div>
                    </ClinicalCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Processing Animation */}
              <AnimatePresence>
                {pipelineRunning && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="py-8"
                  >
                    <ClinicalCard className="border-primary/20">
                      <div className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div className="relative">
                          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Brain className="h-7 w-7 text-primary" />
                          </div>
                          <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                            <Loader2 className="h-2.5 w-2.5 animate-spin text-primary-foreground" />
                          </div>
                        </div>
                        <div className="text-center space-y-1">
                          <p className="text-sm font-semibold text-foreground">AI analyzing symptoms…</p>
                          <p className="text-[11px] text-muted-foreground">Building diagnosis, treatment plan, and safety checks</p>
                        </div>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-primary"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    </ClinicalCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ══ AI Care Plan Card ══ */}
              <AnimatePresence>
                {pipelineComplete && hasSoap && (
                  <motion.div
                    data-care-plan
                    initial={{ opacity: 0, y: 20, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <ClinicalCard className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
                      <ClinicalCardHeader
                        title="AI Care Plan"
                        icon={<Brain className="h-4 w-4" />}
                        badge={<Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" />AI Draft</Badge>}
                        action={
                          <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 rounded-lg" onClick={runSafetyCheck} disabled={isRunningSafety}>
                            {isRunningSafety ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Re-check Safety
                          </Button>
                        }
                      />

                      {/* Draft Warning */}
                      <div className="mb-3 px-3 py-2 rounded-lg bg-chip-lab border border-chip-lab-border text-[11px] text-chip-lab-text font-medium flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        {AI_DRAFT_LABEL}
                      </div>

                      {/* Inline Safety Alerts */}
                      <AnimatePresence>
                        {safetyResults && safetyAlertCount > 0 && (
                          <motion.div {...fadeIn} className="mb-3 space-y-1.5">
                            {safetyResults.allergy_flags.map((f, i) => (
                              <div key={`alg-${i}`} className="p-2.5 rounded-lg border border-chip-alert-border bg-chip-alert text-[11px] text-chip-alert-text font-medium flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {f.message}
                              </div>
                            ))}
                            {safetyResults.interaction_flags.map((f, i) => (
                              <div key={`int-${i}`} className={`p-2.5 rounded-lg border text-[11px] flex items-center gap-2 ${severityColor(f.severity)}`}>
                                <Shield className="h-3.5 w-3.5 shrink-0" />
                                <span><span className="font-semibold">{f.drug_a} ↔ {f.drug_b}</span>: {f.description}</span>
                              </div>
                            ))}
                            {safetyResults.dose_warnings.map((w, i) => (
                              <div key={`dose-${i}`} className="p-2.5 rounded-lg border border-chip-lab-border bg-chip-lab text-[11px] text-chip-lab-text flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                {w.message}
                              </div>
                            ))}
                            {(safetyResults.vitals_dangers || []).map((v, i) => (
                              <div key={`vit-${i}`} className={`p-2.5 rounded-lg border text-[11px] ${severityColor(v.severity)}`}>{v.message}</div>
                            ))}
                            {(safetyResults.emergency_patterns || []).map((ep, i) => (
                              <div key={`em-${i}`} className={`p-2.5 rounded-lg border text-[11px] ${severityColor(ep.severity)}`}>
                                <span className="font-semibold">{ep.pattern}</span>: {ep.message}
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* SOAP Sections */}
                      <div className="space-y-3">
                        {(Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section, idx) => (
                          <motion.div
                            key={section}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.05 * idx }}
                            className="space-y-1"
                          >
                            <Label className={`text-[11px] font-semibold ${section === "Safety Warnings" ? "text-chip-alert-text" : "text-muted-foreground"}`}>
                              {section}
                            </Label>
                            <Textarea
                              value={soapSections[section]}
                              onChange={e => updateSoapSection(section, e.target.value)}
                              rows={2}
                              className="text-xs min-h-[36px] resize-y rounded-lg bg-background/50"
                            />
                          </motion.div>
                        ))}
                      </div>

                      {/* Confidence */}
                      {safetyResults && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Confidence:</span>
                          <Badge variant="outline" className={`text-[10px] ${safetyResults.confidence_level === 'high' ? 'border-chip-medication-border text-chip-medication-text' : safetyResults.confidence_level === 'moderate' ? 'border-chip-lab-border text-chip-lab-text' : 'border-chip-alert-border text-chip-alert-text'}`}>
                            {safetyResults.confidence_level}
                          </Badge>
                        </div>
                      )}

                      {/* Approve & Save */}
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <div className="flex items-start gap-2">
                          <Checkbox id="final-review" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} />
                          <label htmlFor="final-review" className="text-[11px] text-muted-foreground cursor-pointer select-none leading-relaxed">
                            I have reviewed the AI care plan, prescriptions, and safety alerts.
                          </label>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => { setPipelineComplete(false); setAutoGenerateTriggered(false); }}
                            className="flex-1 h-11 rounded-xl text-sm gap-2"
                          >
                            <Edit3 className="h-4 w-4" /> Modify
                          </Button>
                          <motion.div whileTap={{ scale: 0.98 }} className="flex-[2]">
                            <Button
                              onClick={approveAndSave}
                              disabled={isSaving || !reviewConfirmed}
                              className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                              size="lg"
                            >
                              {isSaving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                              ) : (
                                <><CheckCircle className="h-4 w-4" />Approve & Save</>
                              )}
                            </Button>
                          </motion.div>
                        </div>

                        {savedSessionId && (
                          <motion.div {...fadeIn} className="flex items-center gap-1.5 text-xs text-primary justify-center">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Saved — <button className="underline" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View</button>
                          </motion.div>
                        )}
                      </div>
                    </ClinicalCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Consultation Timeline / Audit Log */}
              {(pipelineComplete || savedSessionId) && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="p-3">
                    <ClinicalCardHeader title="Consultation Timeline" icon={<Clock className="h-3.5 w-3.5" />} />
                    <div className="space-y-2">
                      {[
                        { time: new Date(sessionStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), label: "Session started", done: true },
                        { time: "", label: "Patient selected", done: !!selectedPatient },
                        { time: "", label: `${selectedSymptoms.length} symptom(s) selected`, done: selectedSymptoms.length > 0 },
                        { time: "", label: "AI care plan generated", done: pipelineComplete },
                        { time: "", label: "Consultation saved", done: !!savedSessionId },
                      ].map((step, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${step.done ? 'bg-primary' : 'bg-border'}`} />
                          <span className={`text-[11px] ${step.done ? 'text-foreground' : 'text-muted-foreground/50'}`}>{step.label}</span>
                        </div>
                      ))}
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* Patient Explanation */}
              {hasSoap && (
                <CollapsibleSection title="Patient Explanation" icon={Languages} badge={<Badge variant="outline" className="text-[9px]">Optional</Badge>}>
                  <div className="space-y-2 px-0.5">
                    <div className="flex items-center gap-2">
                      <select value={explanationLang} onChange={e => setExplanationLang(e.target.value as "english" | "telugu")} className="text-xs border border-border rounded-lg px-2 py-1 bg-background">
                        <option value="english">English</option>
                        <option value="telugu">Telugu</option>
                      </select>
                      <Button size="sm" variant="outline" className="text-xs h-7 rounded-lg" onClick={generatePatientExplanation} disabled={isGeneratingExplanation}>
                        {isGeneratingExplanation ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
                      </Button>
                    </div>
                    {patientExplanation && (
                      <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs whitespace-pre-wrap">{patientExplanation}</div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Empty state */}
              {!hasSoap && !pipelineRunning && !hasExtraction && selectedSymptoms.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary/20" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Select symptoms above to build a clinical context. AI will auto-generate a care plan.
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-2">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono mx-0.5">⌘K</kbd> to search patients, drugs & labs
                  </p>
                </motion.div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: AI Copilot (Active Thinking Assistant) ═══ */}
          <div className="overflow-y-auto border-l border-border bg-card/30 max-lg:border-t">
            <div className="p-3 space-y-3">

              {/* AI Copilot Header */}
              <div className="flex items-center gap-2 px-1">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center relative">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-chip-medication-text animate-pulse" />
                </div>
                <span className="text-xs font-semibold text-foreground">AI Copilot</span>
                <Badge className="bg-chip-medication border-chip-medication-border text-chip-medication-text text-[9px] ml-auto">Active</Badge>
              </div>

              {/* AI Detected Context */}
              {selectedSymptoms.length > 0 && (
                <motion.div {...fadeIn}>
                  <ClinicalCard className="p-3 border-primary/15 bg-primary/[0.02]">
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-widest mb-2 flex items-center gap-1">
                      <Brain className="h-3 w-3" /> AI Detected
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSymptoms.map(s => (
                        <Chip key={s} variant="symptom" size="sm">{s}</Chip>
                      ))}
                    </div>

                    {/* Quick diagnosis suggestions based on symptoms */}
                    {selectedSymptoms.includes("Fever") && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Possible Diagnosis</p>
                        <div className="flex flex-wrap gap-1">
                          {["Viral Fever", "Dengue", "Malaria", "Typhoid"].map(d => (
                            <Chip key={d} variant="diagnosis" size="sm" onClick={() => toggleSymptom(d)}>{d}</Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested tests */}
                    <div className="mt-3 pt-2 border-t border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Suggested Tests</p>
                      <div className="flex flex-wrap gap-1">
                        {["CBC", "Dengue NS1", "Malaria Antigen", "Widal"].filter((_, i) => i < (selectedSymptoms.length > 2 ? 4 : 2)).map(t => (
                          <Chip key={t} variant="lab" size="sm" addable onClick={() => toast({ title: `+ ${t}`, description: "Added to lab orders" })}>{t}</Chip>
                        ))}
                      </div>
                    </div>

                    {/* Suggested treatment */}
                    {contextualRx.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Suggested Treatment</p>
                        <div className="flex flex-wrap gap-1">
                          {contextualRx.slice(0, 3).map((rx, i) => (
                            <Chip
                              key={i}
                              variant="medication"
                              size="sm"
                              addable
                              onClick={() => {
                                setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug, dose: rx.dose, frequency: rx.freq, duration: rx.dur }]);
                                toast({ title: `+ ${rx.drug}`, description: `${rx.dose} · ${rx.freq} · ${rx.dur}` });
                              }}
                            >
                              {rx.drug} {rx.dose}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Advice */}
                    <div className="mt-3 pt-2 border-t border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Advice</p>
                      <div className="flex flex-wrap gap-1">
                        {["Hydration", "Rest", "Monitor temperature"].map(a => (
                          <Chip key={a} variant="neutral" size="sm">{a}</Chip>
                        ))}
                      </div>
                    </div>
                  </ClinicalCard>
                </motion.div>
              )}

              {/* Smart Suggestions (from AI backend) */}
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
                onAddLabTest={(testName) => toast({ title: `+ ${testName}`, description: "Added to lab orders" })}
                onInsertText={(text) => {
                  setTranscript(prev => prev ? `${prev}\n${text}` : text);
                  toast({ title: "Inserted", description: text.slice(0, 50) + "…" });
                }}
              />

              {/* Quick Rx with Favorites */}
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

              {/* Prescriptions */}
              <CollapsibleSection title="Prescriptions" icon={Pill}>
                <div className="px-0.5">
                  <InlinePrescriptionBuilder
                    patientId={selectedPatient?.id || null}
                    consultationId={savedSessionId}
                    patientAllergies={selectedPatient?.allergies || []}
                    externalDrugs={pendingRxFromSuggestions}
                  />
                </div>
              </CollapsibleSection>

              {/* Lab Orders */}
              <CollapsibleSection title="Quick Labs" icon={FlaskConical}>
                <div className="px-0.5">
                  <InlineLabOrders
                    patientId={selectedPatient?.id || null}
                    visitId={visitId}
                    clinicId={profileClinicId}
                  />
                </div>
              </CollapsibleSection>

              {/* Follow-Up */}
              <CollapsibleSection title="Follow-Up" icon={CalendarDays} defaultOpen={!!followUpDate || !!followUpNotes}>
                <FollowUpPanel
                  followUpDate={followUpDate}
                  onFollowUpDateChange={setFollowUpDate}
                  followUpNotes={followUpNotes}
                  onFollowUpNotesChange={setFollowUpNotes}
                />
              </CollapsibleSection>

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

        {/* ═══ FLOATING BOTTOM ACTION BAR ═══ */}
        <AnimatePresence>
          {(hasSymptomInput && !pipelineComplete && !pipelineRunning && !savedSessionId) && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-0 left-0 lg:left-56 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center justify-center gap-3"
            >
              <Button
                onClick={runFullPipeline}
                disabled={!hasSymptomInput || pipelineRunning}
                className="h-10 rounded-xl text-sm font-semibold gap-2 px-8"
                size="lg"
              >
                <Sparkles className="h-4 w-4" /> Generate AI Care Plan
              </Button>
            </motion.div>
          )}

          {pipelineComplete && !savedSessionId && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed bottom-0 left-0 lg:left-56 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 flex items-center justify-center gap-3"
            >
              <Button
                variant="outline"
                onClick={() => document.querySelector('[data-care-plan]')?.scrollIntoView({ behavior: 'smooth' })}
                className="h-10 rounded-xl text-sm gap-2"
              >
                <Eye className="h-4 w-4" /> Review Plan
              </Button>
              <Button
                onClick={approveAndSave}
                disabled={isSaving || !reviewConfirmed}
                className="h-10 rounded-xl text-sm font-semibold gap-2 px-8"
                size="lg"
              >
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <><CheckCircle className="h-4 w-4" />Finalize Consultation</>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
