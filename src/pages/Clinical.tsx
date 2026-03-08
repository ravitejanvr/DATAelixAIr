import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import EvidencePanel from "@/components/EvidencePanel";
import ConsultationInput from "@/components/ConsultationInput";
import PatientSelector, { type SelectedPatient } from "@/components/PatientSelector";
import InlineVitals from "@/components/InlineVitals";
import VisitTimeline from "@/components/VisitTimeline";
import InlinePrescriptionBuilder from "@/components/InlinePrescriptionBuilder";
import InlineLabOrders from "@/components/InlineLabOrders";
import IntakeSummary, { type IntakeData } from "@/components/IntakeSummary";
import DoctorIntakeReview from "@/components/DoctorIntakeReview";
import SmartSuggestionsPanel from "@/components/SmartSuggestionsPanel";
import {
  Loader2, Save, CheckCircle2, ChevronDown, ChevronRight, FileText,
  Edit3, Eye, ShieldCheck, AlertTriangle, XCircle, CheckCircle,
  Languages, HeartPulse, Pill, FlaskConical, User, Activity,
  Sparkles, RotateCcw, Clock, ClipboardCheck
} from "lucide-react";
import type { ExtractedData, SoapSections } from "@/layers/ai-agents/api";
import { EMPTY_EXTRACTED, EMPTY_SOAP } from "@/layers/ai-agents/api";
import type { SafetyResults } from "@/layers/safety/api";
import { severityColor } from "@/layers/safety/api";
import type { NormalizationMatch } from "@/layers/multilingual/api";
import {
  captureTranscriptEditSignal,
  captureExtractionCorrectionSignal,
  captureDocumentationStyleSignal,
} from "@/layers/learning/api";
import {
  logAuditEvent,
  startPipelineTimer,
  emitSafetyAlertMetric,
  emitSessionCompletedMetric,
} from "@/layers/monitoring/api";
import { type ClinicalContext, EMPTY_CLINICAL_CONTEXT, buildClinicalContext } from "@/lib/clinical-context";
import ClinicalContextPanel from "@/components/ClinicalContextPanel";

// Compact collapsible section wrapper
function Section({ title, icon: Icon, badge, defaultOpen = false, children, className = "" }: {
  title: string; icon: React.ElementType; badge?: React.ReactNode;
  defaultOpen?: boolean; children: React.ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left ${className}`}>
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground flex-1">{title}</span>
          {badge}
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

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

  // Pipeline processing states
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isRunningSafety, setIsRunningSafety] = useState(false);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AI outputs
  const [extractedData, setExtractedData] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [soapSections, setSoapSections] = useState<SoapSections>(EMPTY_SOAP);
  const [safetyResults, setSafetyResults] = useState<SafetyResults | null>(null);
  const [normalizationResults, setNormalizationResults] = useState<NormalizationMatch[]>([]);
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);

  // Patient explanation
  const [patientExplanation, setPatientExplanation] = useState("");
  const [explanationLang, setExplanationLang] = useState<"english" | "telugu">("telugu");
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);

  // Session management
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [pendingRxFromSuggestions, setPendingRxFromSuggestions] = useState<{ drug_name: string; dose: string; frequency: string; duration: string }[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [intakeApproved, setIntakeApproved] = useState(false);

  // Clinical Context Layer
  const [clinicalContext, setClinicalContext] = useState<ClinicalContext>(EMPTY_CLINICAL_CONTEXT);
  const [patientVitals, setPatientVitals] = useState<any>(null);

  // Learning baselines
  const [aiExtractedBaseline, setAiExtractedBaseline] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [aiSoapBaseline, setAiSoapBaseline] = useState<SoapSections>(EMPTY_SOAP);
  const [sessionStartTime] = useState(() => performance.now());

  // Profile for clinic_id
  const [profileClinicId, setProfileClinicId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.clinic_id) setProfileClinicId(data.clinic_id);
    });
    // Check navigation state (from intake or patient detail)
    const state = window.history.state?.usr;
    if (state?.patient) setSelectedPatient(state.patient);
    if (state?.queuePatient) {
      const qp = state.queuePatient;
      setSelectedPatient({ id: qp.id, name: qp.name, age: qp.age, gender: qp.gender, phone: qp.phone, allergies: null, current_medications: null, medical_history: null, created_at: "" });
    }
    if (state?.visitId) setVisitId(state.visitId);
    if (state?.intakeData) {
      setIntakeData(state.intakeData as IntakeData);
      // Pre-fill extracted data from intake
      const id = state.intakeData as IntakeData;
      setExtractedData(prev => ({
        ...prev,
        chief_complaint: id.chief_complaint || prev.chief_complaint,
        allergies: id.allergies_noted || prev.allergies,
        current_medications: id.current_medications || prev.current_medications,
      }));
    }
  }, [user]);

  // Pre-fill allergies/meds from selected patient
  useEffect(() => {
    if (selectedPatient) {
      if (selectedPatient.allergies?.length) {
        setExtractedData(prev => ({ ...prev, allergies: selectedPatient.allergies!.join(", ") }));
      }
      if (selectedPatient.current_medications?.length) {
        setExtractedData(prev => ({ ...prev, current_medications: selectedPatient.current_medications!.join(", ") }));
      }
    }
  }, [selectedPatient]);

  // Fetch vitals for clinical context
  useEffect(() => {
    if (!selectedPatient?.id) { setPatientVitals(null); return; }
    (async () => {
      const { data } = await supabase
        .from("vitals")
        .select("bp_systolic, bp_diastolic, pulse, temperature, spo2, respiratory_rate, weight_kg, height_cm")
        .eq("patient_id", selectedPatient.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setPatientVitals(data);
    })();
  }, [selectedPatient?.id]);

  // Rebuild clinical context whenever source data changes
  useEffect(() => {
    const ctx = buildClinicalContext(
      selectedPatient ? { age: selectedPatient.age, gender: selectedPatient.gender, medical_history: selectedPatient.medical_history, allergies: selectedPatient.allergies, current_medications: selectedPatient.current_medications } : null,
      patientVitals,
      intakeData ? { chief_complaint: intakeData.chief_complaint, symptom_duration: intakeData.symptom_duration, allergies_noted: intakeData.allergies_noted, current_medications: intakeData.current_medications } : null,
      extractedData.chief_complaint,
      extractedData.duration,
      extractedData.current_medications,
      extractedData.allergies,
    );
    setClinicalContext(ctx);
  }, [selectedPatient, patientVitals, intakeData, extractedData]);

  const hasTranscript = transcript.trim().length > 0;
  const hasExtraction = extractedData.chief_complaint.trim().length > 0;
  const hasSoap = Object.values(soapSections).some(v => v.trim().length > 0);
  const isProcessing = isStabilizing || isExtracting || isRunningSafety || isGeneratingSoap;

  // ── Full AI Pipeline ──────────────────────────────
  const runFullPipeline = async () => {
    if (!transcript.trim()) {
      toast({ title: "Empty input", description: "Record or type consultation notes first.", variant: "destructive" });
      return;
    }
    setPipelineRunning(true);
    setPipelineComplete(false);

    // 1. Stabilize
    setIsStabilizing(true);
    let stableText = transcript;
    const t1 = startPipelineTimer("stabilizer");
    try {
      const { data, error } = await supabase.functions.invoke("stabilize-transcript", {
        body: { transcript: transcript.trim() },
      });
      if (!error && data?.stabilized_transcript) {
        stableText = data.stabilized_transcript;
        setNormalizationResults(data.normalization_results || []);
        setDetectedLanguages(data.detected_languages || []);
        t1.stop(true, { match_count: data.match_count || 0 });
      } else { t1.stop(false); }
    } catch { t1.stop(false); }
    setStabilizedTranscript(stableText);
    setTranscript(stableText);
    setIsStabilizing(false);

    // 2. Extract
    setIsExtracting(true);
    const t2 = startPipelineTimer("extraction");
    try {
      const { data, error } = await supabase.functions.invoke("extract-patient-data", {
        body: { transcript: stableText.trim() },
      });
      if (error) throw new Error(error.message);
      const extracted = {
        chief_complaint: data.chief_complaint || "", duration: data.duration || "",
        associated_symptoms: data.associated_symptoms || "", vitals: data.vitals || "",
        chronic_conditions: data.chronic_conditions || "", current_medications: data.current_medications || "",
        allergies: data.allergies || "",
      };
      setExtractedData(extracted);
      setAiExtractedBaseline({ ...extracted });
      t2.stop(true);
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
      t2.stop(false);
      setPipelineRunning(false);
      return;
    }
    setIsExtracting(false);

    // 3. Safety Check — pass clinical context
    setIsRunningSafety(true);
    const t3 = startPipelineTimer("safety_controller");
    try {
      const { data: safetyData } = await supabase.functions.invoke("clinical-safety", {
        body: {
          medications: clinicalContext.current_medications,
          allergies: clinicalContext.allergies,
          vitals: {
            bp_systolic: clinicalContext.blood_pressure ? parseInt(clinicalContext.blood_pressure.split("/")[0]) : null,
            bp_diastolic: clinicalContext.blood_pressure ? parseInt(clinicalContext.blood_pressure.split("/")[1]) : null,
            pulse: clinicalContext.pulse,
            temperature: clinicalContext.temperature,
            spo2: clinicalContext.oxygen_saturation,
            respiratory_rate: clinicalContext.respiratory_rate,
          },
          symptoms: [clinicalContext.chief_complaint, extractedData.associated_symptoms].filter(Boolean).join(", ").split(",").map(s => s.trim()).filter(Boolean),
          clinical_context: clinicalContext,
        },
      });
      setSafetyResults(safetyData as SafetyResults || {
        normalized_drugs: [], interaction_flags: [], allergy_flags: [],
        dose_warnings: [], vitals_dangers: [], emergency_patterns: [],
        confidence_level: "high", requires_manual_review: false, timestamp: new Date().toISOString(),
      });
      t3.stop(true);
      emitSafetyAlertMetric({
        interactions: safetyData?.interaction_flags?.length || 0,
        allergies: safetyData?.allergy_flags?.length || 0,
        dose_warnings: safetyData?.dose_warnings?.length || 0,
        vitals_dangers: safetyData?.vitals_dangers?.length || 0,
        emergency_patterns: safetyData?.emergency_patterns?.length || 0,
      });
    } catch {
      setSafetyResults({
        normalized_drugs: [], interaction_flags: [], allergy_flags: [],
        dose_warnings: [], vitals_dangers: [], emergency_patterns: [],
        confidence_level: "moderate", requires_manual_review: true, timestamp: new Date().toISOString(),
      });
      t3.stop(false);
    }
    setIsRunningSafety(false);

    // 4. Generate SOAP
    setIsGeneratingSoap(true);
    const t4 = startPipelineTimer("documentation");
    try {
      // Build intake context for SOAP generation
      const intakeContext: Record<string, string> = {};
      if (intakeData) {
        intakeContext.chief_complaint = intakeData.chief_complaint || "";
        intakeContext.symptom_duration = intakeData.symptom_duration || "";
        intakeContext.pain_score = intakeData.pain_score != null ? `${intakeData.pain_score}/10` : "";
        intakeContext.allergies = intakeData.allergies_noted || "";
        intakeContext.medications = intakeData.current_medications || "";
        intakeContext.pregnancy_status = intakeData.pregnancy_status || "";
      }
      const { data, error } = await supabase.functions.invoke("clinical-soap", {
        body: { transcript: stableText.trim(), extractedData: intakeContext, clinical_context: clinicalContext },
      });
      if (error) throw new Error(error.message);
      const sections = {
        "Visit Summary": data.sections?.["Visit Summary"] || "",
        "Findings": data.sections?.["Findings"] || "",
        "Provisional Diagnosis": data.sections?.["Provisional Diagnosis"] || "",
        "Safety Warnings": data.sections?.["Safety Warnings"] || "No safety concerns identified.",
        "Treatment Plan": data.sections?.["Treatment Plan"] || "",
        "Advice": data.sections?.["Advice"] || "",
        "Follow-up": data.sections?.["Follow-up"] || "",
      };
      setSoapSections(sections);
      setAiSoapBaseline({ ...sections });
      t4.stop(true);
    } catch (err: any) {
      toast({ title: "Summary generation failed", description: err.message, variant: "destructive" });
      t4.stop(false);
    }
    setIsGeneratingSoap(false);
    setPipelineRunning(false);
    setPipelineComplete(true);
  };

  // ── Safety re-run ──
  const runSafetyCheck = async () => {
    setIsRunningSafety(true);
    const timer = startPipelineTimer("safety_controller");
    try {
      const medications = extractedData.current_medications?.split(",").map(s => s.trim()).filter(Boolean) || [];
      const allergies = extractedData.allergies?.split(",").map(s => s.trim()).filter(Boolean) || [];
      const vitalsText = extractedData.vitals || "";
      const parseVital = (pattern: RegExp): number | null => { const m = vitalsText.match(pattern); return m ? parseFloat(m[1]) : null; };
      const vitalsObj: Record<string, number | null> = {
        bp_systolic: parseVital(/(\d{2,3})\s*\/\s*\d+/),
        bp_diastolic: parseVital(/\d+\s*\/\s*(\d{2,3})/),
        pulse: parseVital(/(?:pulse|hr|heart\s*rate)[:\s]*(\d+)/i) ?? parseVital(/(\d{2,3})\s*bpm/i),
        temperature: parseVital(/(?:temp|temperature)[:\s]*([\d.]+)/i),
        spo2: parseVital(/(?:spo2|sp02|o2\s*sat|oxygen)[:\s]*(\d+)/i),
        respiratory_rate: parseVital(/(?:rr|resp|respiratory)[:\s]*(\d+)/i),
        blood_sugar: parseVital(/(?:sugar|glucose|bs|rbs)[:\s]*(\d+)/i),
      };
      const symptoms = [extractedData.chief_complaint, extractedData.associated_symptoms].filter(Boolean).join(", ").split(",").map(s => s.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("clinical-safety", { body: { medications, allergies, vitals: vitalsObj, symptoms } });
      if (error) throw new Error(error.message);
      setSafetyResults(data as SafetyResults);
      timer.stop(true);
      emitSafetyAlertMetric({
        interactions: data.interaction_flags?.length || 0, allergies: data.allergy_flags?.length || 0,
        dose_warnings: data.dose_warnings?.length || 0, vitals_dangers: data.vitals_dangers?.length || 0,
        emergency_patterns: data.emergency_patterns?.length || 0,
      });
    } catch (err: any) {
      toast({ title: "Safety check notice", description: err.message || "Could not complete" });
      timer.stop(false);
    } finally { setIsRunningSafety(false); }
  };

  // ── Save Session ──
  const saveSession = async () => {
    if (!user) return;
    if (!reviewConfirmed) {
      toast({ title: "Confirmation required", description: "Please confirm you have reviewed the AI outputs.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const editedSoapText = Object.entries(soapSections).map(([h, c]) => `**${h}**\n${c}`).join("\n\n");
      let patientId = selectedPatient?.id;

      // Create patient if none selected
      if (!patientId) {
        const { data: patientData, error: patientError } = await supabase.from("patients").insert({
          name: extractedData.chief_complaint ? "Session Patient" : "Quick Patient",
          doctor_id: user.id,
          clinic_id: profileClinicId,
          current_medications: extractedData.current_medications ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : [],
          allergies: extractedData.allergies ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
        }).select("id").single();
        if (patientError) throw new Error(patientError.message);
        patientId = patientData.id;
      }

      const { data: consultData, error } = await supabase.from("consultations").insert({
        patient_id: patientId, doctor_id: user.id, clinic_id: profileClinicId,
        chief_complaint: extractedData.chief_complaint,
        raw_transcript: stabilizedTranscript || transcript, stabilized_transcript: stabilizedTranscript,
        doctor_final_transcript: transcript, review_confirmed: reviewConfirmed,
        edited_transcript: transcript, extracted_data: extractedData as any, ai_summary: editedSoapText,
        soap_subjective: soapSections["Visit Summary"], soap_objective: soapSections["Findings"],
        soap_assessment: soapSections["Provisional Diagnosis"],
        soap_plan: `${soapSections["Treatment Plan"]}\n\n${soapSections["Advice"]}\n\n${soapSections["Follow-up"]}`,
        status: "completed",
        safety_flags: safetyResults ? [...safetyResults.interaction_flags, ...safetyResults.allergy_flags, ...safetyResults.dose_warnings] : [],
        normalization_results: safetyResults?.normalized_drugs || [],
        confidence_score: safetyResults?.confidence_level || "moderate",
      } as any).select("id").single();
      if (error) throw new Error(error.message);

      setSavedSessionId(consultData.id);
      toast({ title: "Session saved", description: "Clinical session saved successfully." });

      // Governance audit + learning signals
      const transcriptWasEdited = stabilizedTranscript !== transcript;
      const extractionWasCorrected = JSON.stringify(aiExtractedBaseline) !== JSON.stringify(extractedData);
      const soapWasEdited = JSON.stringify(aiSoapBaseline) !== JSON.stringify(soapSections);
      const safetyAlertsCount = safetyResults ? (safetyResults.interaction_flags.length + safetyResults.allergy_flags.length + safetyResults.dose_warnings.length + safetyResults.vitals_dangers.length + safetyResults.emergency_patterns.length) : 0;

      logAuditEvent({ actor_id: user.id, event_type: "session_completed", target_type: "consultation", target_id: consultData.id, metadata: { transcript_edited: transcriptWasEdited, extraction_corrected: extractionWasCorrected, soap_edited: soapWasEdited, safety_alerts_count: safetyAlertsCount, model_version: "gemini-3-flash-preview", duration_ms: Math.round(performance.now() - sessionStartTime) } });
      if (transcriptWasEdited) logAuditEvent({ actor_id: user.id, event_type: "ai_output_edited", target_type: "transcript", target_id: consultData.id, metadata: { stage: "transcript" } });
      if (extractionWasCorrected) logAuditEvent({ actor_id: user.id, event_type: "ai_output_edited", target_type: "extraction", target_id: consultData.id, metadata: { stage: "extraction" } });
      if (soapWasEdited) logAuditEvent({ actor_id: user.id, event_type: "ai_output_edited", target_type: "soap", target_id: consultData.id, metadata: { stage: "soap" } });

      captureTranscriptEditSignal(user.id, null, stabilizedTranscript, transcript);
      captureExtractionCorrectionSignal(user.id, null, aiExtractedBaseline as any, extractedData as any);
      captureDocumentationStyleSignal(user.id, null, aiSoapBaseline as unknown as Record<string, string>, soapSections as unknown as Record<string, string>);
      emitSessionCompletedMetric({ transcript_edited: transcriptWasEdited, extraction_corrected: extractionWasCorrected, soap_edited: soapWasEdited, safety_alerts_count: safetyAlertsCount, total_duration_ms: Math.round(performance.now() - sessionStartTime) });
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

  const confidenceBadge = (level: string) => {
    if (level === "high") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 text-[10px]"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />High</Badge>;
    if (level === "moderate") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[10px]"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Moderate</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800 text-[10px]"><XCircle className="h-2.5 w-2.5 mr-0.5" />Low</Badge>;
  };

  // Pre-save checklist
  const checklistItems = [
    { label: "Patient selected", ok: !!selectedPatient },
    { label: "Notes present", ok: hasTranscript },
    { label: "AI summary generated", ok: hasSoap },
    { label: "Review confirmed", ok: reviewConfirmed },
  ];

  return (
    <>
      <SEO title="Consultation — DATAelixAIr" description="AI clinical documentation workspace" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
        {/* ── Top Context Bar: Patient + Vitals + Timeline ── */}
        <div className="shrink-0 border-b border-border bg-card">
          {/* Action row */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/50">
            <div className="flex items-center gap-3">
              {isProcessing && (
                <div className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isStabilizing && "Stabilizing…"}
                  {isExtracting && "Extracting…"}
                  {isRunningSafety && "Safety check…"}
                  {isGeneratingSoap && "Generating notes…"}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {savedSessionId && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/consultations/${savedSessionId}`)}>
                  View Saved
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startNewSession}>
                <RotateCcw className="h-3 w-3" /> New
              </Button>
            </div>
          </div>

          {/* Context panels row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 px-4 py-2">
            {/* Patient Info */}
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <User className="h-2.5 w-2.5" /> Patient
              </div>
              <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
            </div>

            {/* Vitals */}
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <HeartPulse className="h-2.5 w-2.5" /> Vitals
              </div>
              <InlineVitals patientId={selectedPatient?.id || null} />
            </div>

            {/* Visit Timeline */}
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> Visit History
              </div>
              <VisitTimeline patientId={selectedPatient?.id || null} />
          </div>

          {/* Doctor Intake Review Panel */}
          <div className="lg:col-span-3 px-4 py-1.5 border-t border-border/50">
            <DoctorIntakeReview
              patientId={selectedPatient?.id || null}
              visitId={visitId}
              intakeData={intakeData}
              userId={user?.id || ""}
              onApproved={(approved) => {
                setIntakeData(approved);
                setIntakeApproved(true);
                setExtractedData(prev => ({
                  ...prev,
                  chief_complaint: approved.chief_complaint || prev.chief_complaint,
                  allergies: approved.allergies_noted || prev.allergies,
                  current_medications: approved.current_medications || prev.current_medications,
                }));
              }}
            />
          </div>
        </div>
        </div>

        {/* ── Main workspace ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-0">

          {/* ══ LEFT COLUMN: Input + Extraction + Safety ══ */}
          <div className="overflow-y-auto border-r border-border p-4 space-y-3">

            {/* Consultation Input (Record + Write unified) */}
            <ConsultationInput
              transcript={transcript}
              onTranscriptChange={setTranscript}
              disabled={pipelineRunning}
            />

            {/* Normalization results */}
            {normalizationResults.length > 0 && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                {detectedLanguages.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Languages className="h-3 w-3 text-primary" />
                    <span className="text-[10px] text-muted-foreground">Detected:</span>
                    {detectedLanguages.map(l => <Badge key={l} variant="outline" className="text-[9px] capitalize">{l}</Badge>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {normalizationResults.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border border-border bg-background">
                      <span className="text-muted-foreground">{m.original}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium text-foreground">{m.clinical}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Run AI Pipeline button */}
            <Button
              onClick={runFullPipeline}
              disabled={!hasTranscript || pipelineRunning}
              className="w-full"
              size="sm"
            >
              {pipelineRunning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Processing…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1.5" /> Run AI Pipeline</>
              )}
            </Button>

            {/* Extracted Data */}
            <Section title="Extracted Clinical Data" icon={FileText} defaultOpen={hasExtraction}
              badge={hasExtraction ? <Badge variant="outline" className="text-[9px] gap-0.5"><Sparkles className="h-2 w-2" />AI Draft</Badge> : undefined}>
              <div className="space-y-2 px-1">
                {([
                  { key: "chief_complaint" as const, label: "Chief Complaint" },
                  { key: "duration" as const, label: "Duration" },
                  { key: "associated_symptoms" as const, label: "Associated Symptoms" },
                  { key: "vitals" as const, label: "Vitals" },
                  { key: "chronic_conditions" as const, label: "Chronic Conditions" },
                  { key: "current_medications" as const, label: "Medications" },
                  { key: "allergies" as const, label: "Allergies" },
                ]).map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-[10px] font-medium text-muted-foreground">{label}</Label>
                    <Input value={extractedData[key]} onChange={e => updateExtractedField(key, e.target.value)} placeholder={label} className="h-8 text-xs" />
                  </div>
                ))}
                {hasExtraction && (
                  <Button variant="outline" size="sm" className="w-full h-7 text-xs mt-1" onClick={runSafetyCheck} disabled={isRunningSafety}>
                    {isRunningSafety ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                    Re-run Safety Check
                  </Button>
                )}
              </div>
            </Section>

            {/* Safety Flags */}
            {safetyResults && (
              <Section title="Safety Check" icon={ShieldCheck}
                defaultOpen={safetyAlertCount > 0}
                badge={
                  safetyAlertCount > 0
                    ? <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[9px]">{safetyAlertCount} alerts</Badge>
                    : <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 text-[9px]">Clear</Badge>
                }>
                <div className="space-y-2 px-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Confidence</span>
                    {confidenceBadge(safetyResults.confidence_level)}
                  </div>
                  {safetyResults.interaction_flags.length > 0 && safetyResults.interaction_flags.map((f, i) => (
                    <div key={i} className={`p-1.5 rounded border text-[10px] ${severityColor(f.severity)}`}>
                      <span className="font-medium">{f.drug_a} ↔ {f.drug_b}</span>: {f.description}
                    </div>
                  ))}
                  {safetyResults.allergy_flags.length > 0 && safetyResults.allergy_flags.map((f, i) => (
                    <div key={i} className="p-1.5 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive font-medium">{f.message}</div>
                  ))}
                  {safetyResults.dose_warnings.length > 0 && safetyResults.dose_warnings.map((w, i) => (
                    <div key={i} className="p-1.5 rounded border border-amber-200 bg-amber-50/50 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">{w.message}</div>
                  ))}
                  {(safetyResults.vitals_dangers?.length || 0) > 0 && safetyResults.vitals_dangers!.map((v, i) => (
                    <div key={i} className={`p-1.5 rounded border text-[10px] ${severityColor(v.severity)}`}>{v.message}</div>
                  ))}
                  {(safetyResults.emergency_patterns?.length || 0) > 0 && safetyResults.emergency_patterns!.map((ep, i) => (
                    <div key={i} className={`p-1.5 rounded border text-[10px] ${severityColor(ep.severity)}`}>
                      <span className="font-semibold">{ep.pattern}</span>: {ep.message}
                    </div>
                  ))}
                  {safetyAlertCount === 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-3 w-3" /> No safety concerns detected
                    </div>
                  )}
                </div>
              </Section>
            )}
          </div>

          {/* ══ RIGHT COLUMN: AI Notes + Rx + Labs + Review ══ */}
          <div className="overflow-y-auto p-4 space-y-3">

            {/* Smart Suggestions Panel — Clinical Knowledge Layer */}
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
              onAddPrescription={(rx) => {
                setPendingRxFromSuggestions(prev => [...prev, { drug_name: rx.drug_name, dose: rx.dose, frequency: rx.frequency, duration: rx.duration }]);
                toast({ title: `Added to Rx: ${rx.drug_name}`, description: `${rx.dose} · ${rx.frequency} · ${rx.duration}` });
              }}
              onAddLabTest={(testName) => {
                toast({ title: `Lab test queued: ${testName}`, description: "Add via Lab Orders below." });
              }}
              onInsertText={(text) => {
                setTranscript(prev => prev ? `${prev}\n${text}` : text);
                toast({ title: "Text inserted", description: text.slice(0, 60) + "…" });
              }}
            />

            {/* SOAP / Clinical Summary */}
            <Section title="AI Draft Clinical Summary" icon={Edit3} defaultOpen={hasSoap}
              badge={hasSoap ? <Badge variant="outline" className="text-[9px] gap-0.5"><Sparkles className="h-2 w-2" />AI Generated Draft</Badge> : undefined}>
              <div className="space-y-2 px-1">
                {hasSoap ? (
                  (Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section) => (
                    <div key={section}>
                      <div className="flex items-center justify-between">
                        <Label className={`text-[10px] font-semibold ${section === "Safety Warnings" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                          {section === "Safety Warnings" && <ShieldCheck className="h-2.5 w-2.5 inline mr-0.5" />}{section}
                        </Label>
                        <Badge variant="outline" className="text-[7px] gap-0.5"><Sparkles className="h-1.5 w-1.5" />AI Draft</Badge>
                      </div>
                      <Textarea value={soapSections[section]} onChange={e => updateSoapSection(section, e.target.value)} rows={2} className="text-xs min-h-[40px]" />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">Run the AI pipeline to generate clinical notes</p>
                )}
              </div>
            </Section>

            {/* Evidence Panel */}
            {hasSoap && (
              <EvidencePanel
                medications={extractedData.current_medications ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : []}
                diagnosis={soapSections["Provisional Diagnosis"] || extractedData.chief_complaint}
                allergies={extractedData.allergies ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : []}
                confidenceLevel={safetyResults?.confidence_level || "moderate"}
              />
            )}

            {/* Inline Prescription Builder */}
            <Section title="Prescriptions" icon={Pill} defaultOpen={false}>
              <div className="px-1">
                <InlinePrescriptionBuilder
                  patientId={selectedPatient?.id || null}
                  consultationId={savedSessionId}
                  patientAllergies={selectedPatient?.allergies || []}
                  externalDrugs={pendingRxFromSuggestions}
                />
              </div>
            </Section>

            {/* Inline Lab Orders */}
            <Section title="Lab Orders" icon={FlaskConical} defaultOpen={false}>
              <div className="px-1">
                <InlineLabOrders
                  patientId={selectedPatient?.id || null}
                  visitId={null}
                  clinicId={profileClinicId}
                />
              </div>
            </Section>

            {/* Patient Explanation */}
            {hasSoap && (
              <Section title="Patient-Friendly Explanation" icon={Languages} badge={<Badge variant="outline" className="text-[9px]">Optional</Badge>}>
                <div className="space-y-2 px-1">
                  <div className="flex items-center gap-2">
                    <select value={explanationLang} onChange={e => setExplanationLang(e.target.value as "english" | "telugu")} className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-background">
                      <option value="english">English</option>
                      <option value="telugu">Telugu</option>
                    </select>
                    <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={generatePatientExplanation} disabled={isGeneratingExplanation}>
                      {isGeneratingExplanation ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Generate"}
                    </Button>
                  </div>
                  {patientExplanation && (
                    <div className="p-2 rounded-md border border-primary/20 bg-primary/5 text-xs whitespace-pre-wrap">{patientExplanation}</div>
                  )}
                </div>
              </Section>
            )}

            {/* Final Review & Save */}
            {hasSoap && (
              <Card className="border-primary/20 bg-primary/[0.02]">
                <CardContent className="py-3 space-y-3">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> Pre-Save Checklist
                  </h4>

                  {/* Checklist */}
                  <div className="space-y-1">
                    {checklistItems.map(item => (
                      <div key={item.label} className="flex items-center gap-2 text-[11px]">
                        {item.ok ? (
                          <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        )}
                        <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 pt-1 border-t border-border">
                    <Checkbox id="final-review" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} />
                    <label htmlFor="final-review" className="text-[11px] text-muted-foreground cursor-pointer select-none leading-tight">
                      I have reviewed and approve the transcript, extracted data, safety alerts, and clinical summary. AI outputs are drafts only.
                    </label>
                  </div>
                  <Button onClick={saveSession} disabled={isSaving || !reviewConfirmed} className="w-full" size="sm">
                    {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Saving…</> : <><Save className="h-4 w-4 mr-1.5" /> Save & Finalize</>}
                  </Button>
                  {savedSessionId && (
                    <div className="flex items-center gap-1.5 text-xs text-primary">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Session saved — <button className="underline" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View details</button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Empty state */}
            {!hasSoap && !pipelineRunning && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Write or record your consultation notes on the left, then click <strong>Run AI Pipeline</strong> to generate structured clinical documentation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
