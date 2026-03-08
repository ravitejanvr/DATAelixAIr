import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sparkles, RotateCcw, Clock, ClipboardCheck, Brain, CalendarDays
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

  // Clinical Context
  const [clinicalContext, setClinicalContext] = useState<ClinicalContext>(EMPTY_CLINICAL_CONTEXT);
  const [patientVitals, setPatientVitals] = useState<any>(null);

  // Learning baselines
  const [aiExtractedBaseline, setAiExtractedBaseline] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [aiSoapBaseline, setAiSoapBaseline] = useState<SoapSections>(EMPTY_SOAP);
  const [sessionStartTime] = useState(() => performance.now());
  const [profileClinicId, setProfileClinicId] = useState<string | null>(null);

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

  // Fetch vitals
  useEffect(() => {
    if (!selectedPatient?.id) { setPatientVitals(null); return; }
    (async () => {
      const { data } = await supabase.from("vitals")
        .select("bp_systolic, bp_diastolic, pulse, temperature, spo2, respiratory_rate, weight_kg, height_cm")
        .eq("patient_id", selectedPatient.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      setPatientVitals(data);
    })();
  }, [selectedPatient?.id]);

  // Rebuild clinical context
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

  // ── Full AI Pipeline (server-side orchestration) ──
  const runFullPipeline = async () => {
    if (!transcript.trim()) { toast({ title: "Empty input", description: "Record or type consultation notes first.", variant: "destructive" }); return; }
    setPipelineRunning(true); setPipelineComplete(false);
    setIsStabilizing(true); setIsExtracting(true); setIsRunningSafety(true); setIsGeneratingSoap(true);

    const timer = startPipelineTimer("full_pipeline");
    try {
      const { data, error } = await supabase.functions.invoke("run-ai-pipeline", {
        body: {
          transcript: transcript.trim(),
          clinic_id: profileClinicId,
          clinical_context: clinicalContext,
          intake_data: intakeData,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      // Update stabilization outputs
      if (data.stabilized_transcript) {
        setStabilizedTranscript(data.stabilized_transcript);
        setTranscript(data.stabilized_transcript);
      }
      setNormalizationResults(data.normalization_results || []);
      setDetectedLanguages(data.detected_languages || []);
      setIsStabilizing(false);

      // Update extraction outputs
      if (data.extracted_data) {
        setExtractedData(data.extracted_data);
        setAiExtractedBaseline({ ...data.extracted_data });
      }
      setIsExtracting(false);

      // Update safety outputs
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

      // Update SOAP outputs
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

  // ── Save Session (via Edge Function) ──
  const saveSession = async () => {
    if (!user) return;
    if (!reviewConfirmed) { toast({ title: "Confirmation required", description: "Please confirm you have reviewed the AI outputs.", variant: "destructive" }); return; }
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
      toast({ title: "Session saved", description: "Clinical session saved successfully." });

      // Finalize visit if linked
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

  const checklistItems = [
    { label: "Patient", ok: !!selectedPatient },
    { label: "Notes", ok: hasTranscript },
    { label: "AI Summary", ok: hasSoap },
    { label: "Rx", ok: pendingRxFromSuggestions.length > 0 },
    { label: "Reviewed", ok: reviewConfirmed },
  ];

  return (
    <>
      <SEO title="Clinical Pad — DATAelixAIr" description="AI clinical documentation workspace" />

      <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-background">

        {/* ── Toolbar ── */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Clinical Pad</span>
            </h1>

            {isProcessing && (
              <div className="flex items-center gap-1.5 text-[11px] text-primary animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                {isStabilizing && "Stabilizing…"}
                {isExtracting && "Extracting…"}
                {isRunningSafety && "Safety…"}
                {isGeneratingSoap && "Drafting notes…"}
              </div>
            )}

            {safetyResults && safetyAlertCount > 0 && (
              <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[9px] gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" /> {safetyAlertCount} alert{safetyAlertCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Checklist */}
            <div className="hidden md:flex items-center gap-1.5 mr-2">
              {checklistItems.map(item => (
                <div key={item.label} className="flex items-center gap-0.5 text-[9px]">
                  {item.ok ? <CheckCircle className="h-2.5 w-2.5 text-emerald-500" /> : <XCircle className="h-2.5 w-2.5 text-muted-foreground/30" />}
                  <span className={item.ok ? "text-foreground" : "text-muted-foreground/50"}>{item.label}</span>
                </div>
              ))}
            </div>

            {savedSessionId && (
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View Saved</Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 gap-1" onClick={startNewSession}>
              <RotateCcw className="h-2.5 w-2.5" /> New
            </Button>
          </div>
        </div>

        {/* ── 3-Column Layout (desktop) / Single scroll (mobile) ── */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[260px_1fr_300px]">

          {/* ═══ LEFT: Patient Context ═══ */}
          <div className="overflow-y-auto border-r border-border bg-card/50 max-lg:border-b max-lg:max-h-[40vh]">
            <div className="p-2.5 space-y-2">
              <div>
                <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                  <User className="h-2.5 w-2.5" /> Patient
                </div>
                <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
              </div>

              <ClinicalContextPanel
                context={clinicalContext}
                onUpdate={(field, value) => setClinicalContext(prev => ({ ...prev, [field]: value }))}
              />

              <CollapsibleSection title="Vitals" icon={HeartPulse} defaultOpen={!!selectedPatient}>
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

          {/* ═══ CENTER: Clinical Pad ═══ */}
          <div className="overflow-y-auto flex flex-col">
            <div className="flex-1 p-3 space-y-2">

              {/* Main consultation input */}
              <ConsultationInput
                transcript={transcript}
                onTranscriptChange={setTranscript}
                disabled={pipelineRunning}
              />

              {/* Normalization feedback */}
              {normalizationResults.length > 0 && (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-1">
                  {detectedLanguages.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Languages className="h-2.5 w-2.5 text-primary" />
                      <span className="text-[9px] text-muted-foreground">Detected:</span>
                      {detectedLanguages.map(l => <Badge key={l} variant="outline" className="text-[8px] capitalize">{l}</Badge>)}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-0.5">
                    {normalizationResults.map((m, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded-full border border-border bg-background">
                        <span className="text-muted-foreground">{m.original}</span>→
                        <span className="font-medium text-foreground">{m.clinical}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Run Pipeline */}
              <div className="flex gap-2">
                <Button onClick={runFullPipeline} disabled={!hasTranscript || pipelineRunning} className="flex-1 h-9" size="sm">
                  {pipelineRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Processing…</> : <><Sparkles className="h-3.5 w-3.5 mr-1.5" />Run AI Pipeline</>}
                </Button>
                {hasExtraction && (
                  <Button variant="outline" size="sm" className="h-9 text-[10px] gap-1" onClick={runSafetyCheck} disabled={isRunningSafety}>
                    {isRunningSafety ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />} Safety
                  </Button>
                )}
              </div>

              {/* Extracted Data */}
              {hasExtraction && (
                <CollapsibleSection title="Extracted Data" icon={Brain} defaultOpen badge={<Badge variant="outline" className="text-[8px] gap-0.5"><Sparkles className="h-2 w-2" />AI</Badge>}>
                  <div className="grid grid-cols-2 gap-1.5 px-0.5">
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
                        <Label className="text-[9px] text-muted-foreground">{label}</Label>
                        <Input value={extractedData[key]} onChange={e => updateExtractedField(key, e.target.value)} className="h-7 text-[11px]" />
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Safety Alerts */}
              {safetyResults && safetyAlertCount > 0 && (
                <CollapsibleSection title="Safety Alerts" icon={ShieldCheck} defaultOpen
                  badge={<Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[8px]">{safetyAlertCount}</Badge>}>
                  <div className="space-y-1 px-0.5">
                    {safetyResults.interaction_flags.map((f, i) => (
                      <div key={`int-${i}`} className={`p-1.5 rounded border text-[10px] ${severityColor(f.severity)}`}>
                        <span className="font-medium">{f.drug_a} ↔ {f.drug_b}</span>: {f.description}
                      </div>
                    ))}
                    {safetyResults.allergy_flags.map((f, i) => (
                      <div key={`alg-${i}`} className="p-1.5 rounded border border-destructive/30 bg-destructive/5 text-[10px] text-destructive font-medium">{f.message}</div>
                    ))}
                    {safetyResults.dose_warnings.map((w, i) => (
                      <div key={`dose-${i}`} className="p-1.5 rounded border border-amber-200 bg-amber-50/50 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">{w.message}</div>
                    ))}
                    {(safetyResults.vitals_dangers || []).map((v, i) => (
                      <div key={`vit-${i}`} className={`p-1.5 rounded border text-[10px] ${severityColor(v.severity)}`}>{v.message}</div>
                    ))}
                    {(safetyResults.emergency_patterns || []).map((ep, i) => (
                      <div key={`em-${i}`} className={`p-1.5 rounded border text-[10px] ${severityColor(ep.severity)}`}>
                        <span className="font-semibold">{ep.pattern}</span>: {ep.message}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Context Completeness Warnings */}
              {safetyResults?.context_completeness && !safetyResults.context_completeness.context_complete && (
                <CollapsibleSection title="Missing Context" icon={AlertTriangle} defaultOpen
                  badge={<Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[8px]">Action Required</Badge>}>
                  <div className="space-y-1 px-0.5">
                    {safetyResults.context_completeness.issues.map((issue, i) => (
                      <div key={i} className={`p-1.5 rounded border text-[10px] ${severityColor(issue.severity)}`}>
                        <span className="font-medium capitalize">{issue.field.replace(/_/g, " ")}</span>: {issue.message}
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* SOAP Draft */}
              {hasSoap && (
                <CollapsibleSection title="AI Clinical Summary" icon={Edit3} defaultOpen
                  badge={<Badge variant="outline" className="text-[8px] gap-0.5"><Sparkles className="h-2 w-2" />Draft</Badge>}>
                  <div className="px-0.5">
                    <div className="mb-1.5 px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[9px] text-amber-700 dark:text-amber-400 font-medium">
                      ⚕️ {AI_DRAFT_LABEL}
                    </div>
                    <div className="space-y-1.5">
                      {(Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section) => (
                        <div key={section}>
                          <Label className={`text-[9px] font-semibold ${section === "Safety Warnings" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {section}
                          </Label>
                          <Textarea value={soapSections[section]} onChange={e => updateSoapSection(section, e.target.value)} rows={2} className="text-[11px] min-h-[32px] resize-y" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Patient Explanation */}
              {hasSoap && (
                <CollapsibleSection title="Patient Explanation" icon={Languages} badge={<Badge variant="outline" className="text-[8px]">Optional</Badge>}>
                  <div className="space-y-1.5 px-0.5">
                    <div className="flex items-center gap-1.5">
                      <select value={explanationLang} onChange={e => setExplanationLang(e.target.value as "english" | "telugu")} className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-background">
                        <option value="english">English</option>
                        <option value="telugu">Telugu</option>
                      </select>
                      <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={generatePatientExplanation} disabled={isGeneratingExplanation}>
                        {isGeneratingExplanation ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Generate"}
                      </Button>
                    </div>
                    {patientExplanation && (
                      <div className="p-2 rounded-md border border-primary/20 bg-primary/5 text-[11px] whitespace-pre-wrap">{patientExplanation}</div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Empty state */}
              {!hasSoap && !pipelineRunning && !hasExtraction && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="h-8 w-8 text-muted-foreground/15 mb-2" />
                  <p className="text-xs text-muted-foreground max-w-xs">Write or record consultation notes above, then run the AI pipeline to generate structured clinical documentation.</p>
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Orders + Save ═══ */}
          <div className="overflow-y-auto border-l border-border bg-card/30 max-lg:border-t">
            <div className="p-2.5 space-y-2">

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
                  toast({ title: `Rx: ${rx.drug_name}`, description: `${rx.dose} · ${rx.frequency}` });
                }}
                onAddLabTest={(testName) => {
                  toast({ title: `Lab: ${testName}`, description: "Queued — add via Lab Orders below." });
                }}
                onInsertText={(text) => {
                  setTranscript(prev => prev ? `${prev}\n${text}` : text);
                  toast({ title: "Inserted", description: text.slice(0, 50) + "…" });
                }}
              />

              {/* Doctor Favorites + Recent Rx */}
              <CollapsibleSection title="Quick Rx" icon={Pill} defaultOpen>
                <div className="px-0.5">
                  <DoctorFavoritesPanel
                    onSelectDrug={(drug) => {
                      setPendingRxFromSuggestions(prev => [...prev, { drug_name: drug.drug_name, dose: drug.dosage, frequency: drug.frequency, duration: drug.duration }]);
                      toast({ title: `Added: ${drug.drug_name}`, description: `${drug.dosage} · ${drug.frequency}` });
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
                    visitId={null}
                    clinicId={profileClinicId}
                  />
                </div>
              </CollapsibleSection>

              {/* Follow-Up Instructions */}
              <CollapsibleSection title="Follow-Up Instructions" icon={CalendarDays} defaultOpen={!!followUpDate || !!followUpNotes}>
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

              {/* Finalize Card */}
              <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-2.5 space-y-2">
                <h4 className="text-[11px] font-semibold flex items-center gap-1">
                  <ClipboardCheck className="h-3 w-3 text-primary" /> Finalize Consultation
                </h4>

                <div className="flex items-start gap-2">
                  <Checkbox id="final-review" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} />
                  <label htmlFor="final-review" className="text-[10px] text-muted-foreground cursor-pointer select-none leading-tight">
                    I have reviewed the AI-generated summary, prescriptions, and safety alerts.
                  </label>
                </div>

                <Button onClick={saveSession} disabled={isSaving || !reviewConfirmed} className="w-full h-8" size="sm">
                  {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Saving…</> : <><Save className="h-3.5 w-3.5 mr-1" />Save & Finalize</>}
                </Button>

                {savedSessionId && (
                  <div className="flex items-center gap-1 text-[10px] text-primary">
                    <CheckCircle className="h-3 w-3" />
                    Saved — <button className="underline" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View</button>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
