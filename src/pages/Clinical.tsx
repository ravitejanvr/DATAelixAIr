import { useState, useEffect } from "react";
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
import InlineVitals from "@/components/InlineVitals";
import VisitTimeline from "@/components/VisitTimeline";
import InlinePrescriptionBuilder from "@/components/InlinePrescriptionBuilder";
import InlineLabOrders from "@/components/InlineLabOrders";
import DoctorFavoritesPanel from "@/components/DoctorFavoritesPanel";
import IntakeSummary, { type IntakeData } from "@/components/IntakeSummary";
import DoctorIntakeReview from "@/components/DoctorIntakeReview";
import SmartSuggestionsPanel from "@/components/SmartSuggestionsPanel";
import ClinicalContextPanel from "@/components/ClinicalContextPanel";
import CollapsibleSection from "@/components/clinical/CollapsibleSection";
import FollowUpPanel from "@/components/clinical/FollowUpPanel";
import {
  Loader2, Save, FileText,
  Edit3, ShieldCheck, AlertTriangle, XCircle, CheckCircle,
  Languages, HeartPulse, Pill, FlaskConical, User,
  Sparkles, RotateCcw, Clock, ClipboardCheck, Brain, CalendarDays,
  Zap, Activity, Stethoscope
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

// Common symptom chips
const COMMON_SYMPTOMS = ["Fever", "Cough", "Headache", "Body ache", "Vomiting", "Diarrhea", "Cold", "Sore throat", "Fatigue", "Chest pain", "Breathlessness", "Abdominal pain"];
const DURATION_PRESETS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks", "1 month"];

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

  // Symptom chips
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<string>("");

  // Clinical Context
  const [clinicalContext, setClinicalContext] = useState<ClinicalContext>(EMPTY_CLINICAL_CONTEXT);
  const [patientVitals, setPatientVitals] = useState<any>(null);

  // Learning baselines
  const [aiExtractedBaseline, setAiExtractedBaseline] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [aiSoapBaseline, setAiSoapBaseline] = useState<SoapSections>(EMPTY_SOAP);
  const [sessionStartTime] = useState(() => performance.now());
  const [profileClinicId, setProfileClinicId] = useState<string | null>(null);

  // Sync symptom chips to extracted data
  useEffect(() => {
    if (selectedSymptoms.length > 0) {
      const complaint = selectedSymptoms[0];
      const associated = selectedSymptoms.slice(1).join(", ");
      setExtractedData(prev => ({
        ...prev,
        chief_complaint: prev.chief_complaint || complaint,
        associated_symptoms: associated || prev.associated_symptoms,
      }));
    }
  }, [selectedSymptoms]);

  useEffect(() => {
    if (selectedDuration) {
      setExtractedData(prev => ({ ...prev, duration: selectedDuration }));
    }
  }, [selectedDuration]);

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

  // ── Full AI Pipeline ──
  const runFullPipeline = async () => {
    // Build transcript from chips if none typed
    let effectiveTranscript = transcript.trim();
    if (!effectiveTranscript && selectedSymptoms.length > 0) {
      effectiveTranscript = `Patient presents with ${selectedSymptoms.join(", ")}. Duration: ${selectedDuration || "not specified"}.`;
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
        toast({ title: "Incomplete Clinical Context", description: "Please fill required fields (age, sex, chief complaint) before generating AI notes.", variant: "destructive" });
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

  // ── Approve & Save (single action) ──
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
    setSelectedSymptoms([]); setSelectedDuration("");
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
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

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
              <span className="hidden sm:inline">Clinical Workspace</span>
            </h1>

            {isProcessing && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-[11px] text-primary font-medium">
                  {isStabilizing && "Stabilizing…"}
                  {isExtracting && "Extracting…"}
                  {isRunningSafety && "Safety check…"}
                  {isGeneratingSoap && "Generating care plan…"}
                </span>
              </div>
            )}

            {pipelineComplete && !isProcessing && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-medication border border-chip-medication-border">
                <CheckCircle className="h-3 w-3 text-chip-medication-text" />
                <span className="text-[11px] text-chip-medication-text font-medium">Care plan ready</span>
              </div>
            )}

            {safetyResults && safetyAlertCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-chip-alert border border-chip-alert-border">
                <AlertTriangle className="h-3 w-3 text-chip-alert-text" />
                <span className="text-[11px] text-chip-alert-text font-medium">{safetyAlertCount} alert{safetyAlertCount > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {savedSessionId && (
              <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View Saved</Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 rounded-lg" onClick={startNewSession}>
              <RotateCcw className="h-3 w-3" /> New Session
            </Button>
          </div>
        </div>

        {/* ── 3-Column Layout ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr_320px]">

          {/* ═══ LEFT: Patient Context ═══ */}
          <div className="overflow-y-auto border-r border-border bg-card/50 max-lg:border-b max-lg:max-h-[40vh]">
            <div className="p-3 space-y-3">
              {/* Patient Selector */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <User className="h-3 w-3" /> Patient
                </p>
                <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
              </div>

              {/* Quick Vitals Summary */}
              {patientVitals && (
                <ClinicalCard className="p-3">
                  <ClinicalCardHeader title="Vitals" icon={<Activity className="h-3.5 w-3.5" />} />
                  <div className="flex flex-wrap gap-1.5">
                    {patientVitals.bp_systolic && (
                      <Chip variant="neutral" size="sm">BP {patientVitals.bp_systolic}/{patientVitals.bp_diastolic}</Chip>
                    )}
                    {patientVitals.pulse && <Chip variant="neutral" size="sm">HR {patientVitals.pulse}</Chip>}
                    {patientVitals.temperature && <Chip variant="neutral" size="sm">{patientVitals.temperature}°F</Chip>}
                    {patientVitals.spo2 && <Chip variant="neutral" size="sm">SpO₂ {patientVitals.spo2}%</Chip>}
                  </div>
                </ClinicalCard>
              )}

              {/* Medical Context Chips */}
              {selectedPatient && (
                <ClinicalCard className="p-3">
                  <ClinicalCardHeader title="Medical Context" icon={<HeartPulse className="h-3.5 w-3.5" />} />
                  <div className="space-y-2">
                    {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                      <ChipGroup label="Allergies">
                        {selectedPatient.allergies.map(a => (
                          <Chip key={a} variant="alert" size="sm">{a}</Chip>
                        ))}
                      </ChipGroup>
                    )}
                    {selectedPatient.current_medications && selectedPatient.current_medications.length > 0 && (
                      <ChipGroup label="Medications">
                        {selectedPatient.current_medications.map(m => (
                          <Chip key={m} variant="medication" size="sm">{m}</Chip>
                        ))}
                      </ChipGroup>
                    )}
                  </div>
                </ClinicalCard>
              )}

              <ClinicalContextPanel
                context={clinicalContext}
                onUpdate={(field, value) => setClinicalContext(prev => ({ ...prev, [field]: value }))}
              />

              <CollapsibleSection title="Vitals Detail" icon={HeartPulse} defaultOpen={false}>
                <InlineVitals patientId={selectedPatient?.id || null} />
              </CollapsibleSection>

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

              <CollapsibleSection title="Visit History" icon={Clock}>
                <VisitTimeline patientId={selectedPatient?.id || null} />
              </CollapsibleSection>
            </div>
          </div>

          {/* ═══ CENTER: Smart Clinical Builder ═══ */}
          <div className="overflow-y-auto flex flex-col">
            <div className="flex-1 p-4 space-y-4">

              {/* Symptom Chip Builder */}
              <ClinicalCard>
                <ClinicalCardHeader 
                  title="Clinical Input" 
                  icon={<Edit3 className="h-4 w-4" />}
                  badge={selectedSymptoms.length > 0 ? <Badge variant="outline" className="text-[10px]">{selectedSymptoms.length} selected</Badge> : undefined}
                />

                {/* Complaint Chips */}
                <PresetChipGroup
                  label="Chief Complaint"
                  options={COMMON_SYMPTOMS}
                  selected={selectedSymptoms}
                  onToggle={toggleSymptom}
                  variant="symptom"
                  allowCustom
                />

                {/* Duration Chips */}
                {selectedSymptoms.length > 0 && (
                  <div className="mt-3">
                    <ChipGroup label="Duration">
                      {DURATION_PRESETS.map(d => (
                        <Chip
                          key={d}
                          variant="neutral"
                          selected={selectedDuration === d}
                          onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}
                        >
                          {d}
                        </Chip>
                      ))}
                    </ChipGroup>
                  </div>
                )}

                {/* Voice / Text Input */}
                <div className="mt-4">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Voice / Notes
                  </p>
                  <ConsultationInput
                    transcript={transcript}
                    onTranscriptChange={setTranscript}
                    disabled={pipelineRunning}
                  />
                </div>
              </ClinicalCard>

              {/* Normalization feedback */}
              {normalizationResults.length > 0 && (
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
              )}

              {/* Generate AI Care Plan */}
              <Button
                onClick={runFullPipeline}
                disabled={!hasSymptomInput || pipelineRunning}
                className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                size="lg"
              >
                {pipelineRunning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Generating Care Plan…</>
                ) : (
                  <><Sparkles className="h-4 w-4" />Generate AI Care Plan</>
                )}
              </Button>

              {/* ══ AI Care Plan Review ══ */}
              {pipelineComplete && hasSoap && (
                <ClinicalCard className="border-primary/20 bg-primary/[0.02]">
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

                  {/* Safety Alerts */}
                  {safetyResults && safetyAlertCount > 0 && (
                    <div className="mb-3 space-y-1.5">
                      {safetyResults.interaction_flags.map((f, i) => (
                        <div key={`int-${i}`} className={`p-2 rounded-lg border text-[11px] ${severityColor(f.severity)}`}>
                          <span className="font-semibold">{f.drug_a} ↔ {f.drug_b}</span>: {f.description}
                        </div>
                      ))}
                      {safetyResults.allergy_flags.map((f, i) => (
                        <div key={`alg-${i}`} className="p-2 rounded-lg border border-chip-alert-border bg-chip-alert text-[11px] text-chip-alert-text font-medium">{f.message}</div>
                      ))}
                      {safetyResults.dose_warnings.map((w, i) => (
                        <div key={`dose-${i}`} className="p-2 rounded-lg border border-chip-lab-border bg-chip-lab text-[11px] text-chip-lab-text">{w.message}</div>
                      ))}
                      {(safetyResults.vitals_dangers || []).map((v, i) => (
                        <div key={`vit-${i}`} className={`p-2 rounded-lg border text-[11px] ${severityColor(v.severity)}`}>{v.message}</div>
                      ))}
                      {(safetyResults.emergency_patterns || []).map((ep, i) => (
                        <div key={`em-${i}`} className={`p-2 rounded-lg border text-[11px] ${severityColor(ep.severity)}`}>
                          <span className="font-semibold">{ep.pattern}</span>: {ep.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SOAP Sections as editable cards */}
                  <div className="space-y-3">
                    {(Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section) => (
                      <div key={section} className="space-y-1">
                        <Label className={`text-[11px] font-semibold ${section === "Safety Warnings" ? "text-chip-alert-text" : "text-muted-foreground"}`}>
                          {section}
                        </Label>
                        <Textarea
                          value={soapSections[section]}
                          onChange={e => updateSoapSection(section, e.target.value)}
                          rows={2}
                          className="text-xs min-h-[36px] resize-y rounded-lg bg-background/50"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Approve & Save */}
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="flex items-start gap-2">
                      <Checkbox id="final-review" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} />
                      <label htmlFor="final-review" className="text-[11px] text-muted-foreground cursor-pointer select-none leading-relaxed">
                        I have reviewed the AI care plan, prescriptions, and safety alerts.
                      </label>
                    </div>

                    <Button
                      onClick={approveAndSave}
                      disabled={isSaving || !reviewConfirmed}
                      className="w-full h-11 rounded-xl text-sm font-semibold gap-2"
                      size="lg"
                    >
                      {isSaving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                      ) : (
                        <><CheckCircle className="h-4 w-4" />Approve & Save Consultation</>
                      )}
                    </Button>

                    {savedSessionId && (
                      <div className="flex items-center gap-1.5 text-xs text-primary justify-center">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Saved — <button className="underline" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View</button>
                      </div>
                    )}
                  </div>
                </ClinicalCard>
              )}

              {/* Extracted Data (collapsed when care plan is visible) */}
              {hasExtraction && !pipelineComplete && (
                <CollapsibleSection title="Extracted Data" icon={Brain} defaultOpen badge={<Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] gap-0.5"><Sparkles className="h-2 w-2" />AI</Badge>}>
                  <div className="grid grid-cols-2 gap-2 px-0.5">
                    {([
                      { key: "chief_complaint" as const, label: "Complaint" },
                      { key: "duration" as const, label: "Duration" },
                      { key: "associated_symptoms" as const, label: "Symptoms" },
                      { key: "vitals" as const, label: "Vitals" },
                      { key: "chronic_conditions" as const, label: "Conditions" },
                      { key: "current_medications" as const, label: "Meds" },
                      { key: "allergies" as const, label: "Allergies" },
                    ]).map(({ key, label }) => (
                      <div key={key} className={key === "chief_complaint" ? "col-span-2" : ""}>
                        <Label className="text-[10px] text-muted-foreground">{label}</Label>
                        <Input value={extractedData[key]} onChange={e => updateExtractedField(key, e.target.value)} className="h-8 text-xs rounded-lg" />
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
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
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
                    <Sparkles className="h-8 w-8 text-primary/20" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Select symptoms above or record notes, then generate an AI care plan.
                  </p>
                  <p className="text-[11px] text-muted-foreground/60 mt-1">
                    Most consultations complete in 10–20 seconds
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: AI Copilot ═══ */}
          <div className="overflow-y-auto border-l border-border bg-card/30 max-lg:border-t">
            <div className="p-3 space-y-3">

              {/* AI Copilot Header */}
              <div className="flex items-center gap-2 px-1">
                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold text-foreground">AI Copilot</span>
              </div>

              {/* Smart Suggestions */}
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
                onAddLabTest={(testName) => {
                  toast({ title: `+ ${testName}`, description: "Added to lab orders" });
                }}
                onInsertText={(text) => {
                  setTranscript(prev => prev ? `${prev}\n${text}` : text);
                  toast({ title: "Inserted", description: text.slice(0, 50) + "…" });
                }}
              />

              {/* Quick Rx */}
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
              <CollapsibleSection title="Prescriptions" icon={Pill} defaultOpen>
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
              <CollapsibleSection title="Lab Orders" icon={FlaskConical} defaultOpen>
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
      </div>
    </>
  );
}