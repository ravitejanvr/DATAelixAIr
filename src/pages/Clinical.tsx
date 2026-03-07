import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import EvidencePanel from "@/components/EvidencePanel";
import {
  Loader2, Save, Mic,
  CheckCircle2, ChevronRight, FileText, Clock, Edit3, Eye, EyeOff,
  ShieldCheck, AlertTriangle, XCircle, CheckCircle, Info, Languages,
  HeartPulse, Siren
} from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";
import type { ExtractedData, SoapSections, PipelineStep } from "@/layers/ai-agents/api";
import { EMPTY_EXTRACTED, EMPTY_SOAP, PIPELINE_STEPS } from "@/layers/ai-agents/api";
import type { SafetyResults } from "@/layers/safety/api";
import { severityColor } from "@/layers/safety/api";
import type { NormalizationMatch } from "@/layers/multilingual/api";
import {
  captureTranscriptEditSignal,
  captureExtractionCorrectionSignal,
  captureDocumentationStyleSignal,
} from "@/layers/learning/api";
import {
  startPipelineTimer,
  emitSafetyAlertMetric,
  emitSessionCompletedMetric,
} from "@/layers/monitoring/api";

export default function Clinical() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<PipelineStep>("record");
  const [rawTranscript, setRawTranscript] = useState("");
  const [stabilizedTranscript, setStabilizedTranscript] = useState("");
  const [editedTranscript, setEditedTranscript] = useState("");
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const [isStabilizing, setIsStabilizing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [soapSections, setSoapSections] = useState<SoapSections>(EMPTY_SOAP);
  const [soapFullText, setSoapFullText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [safetyResults, setSafetyResults] = useState<SafetyResults | null>(null);
  const [isRunningSafety, setIsRunningSafety] = useState(false);
  const [patientExplanation, setPatientExplanation] = useState("");
  const [explanationLang, setExplanationLang] = useState<"english" | "telugu">("telugu");
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);
  const [showPatientExplanation, setShowPatientExplanation] = useState(false);
  const [normalizationResults, setNormalizationResults] = useState<NormalizationMatch[]>([]);
  const [detectedLanguages, setDetectedLanguages] = useState<string[]>([]);
  const [previousSessions, setPreviousSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  // Learning layer: store AI baselines for diff comparison
  const [aiExtractedBaseline, setAiExtractedBaseline] = useState<ExtractedData>(EMPTY_EXTRACTED);
  const [aiSoapBaseline, setAiSoapBaseline] = useState<SoapSections>(EMPTY_SOAP);
  const [sessionStartTime] = useState(() => performance.now());

  useEffect(() => { if (user) loadPreviousSessions(); }, [user]);

  const loadPreviousSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    try {
      const { data } = await supabase
        .from("consultations")
        .select("id, created_at, chief_complaint, ai_summary, status")
        .eq("doctor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setPreviousSessions(data || []);
    } catch {} finally { setLoadingSessions(false); }
  };

  const handleTranscriptUpdate = (transcript: string) => setRawTranscript(transcript);

  const goToReview = async () => {
    if (!rawTranscript.trim()) {
      toast({ title: "Empty transcript", description: "Record or type something first.", variant: "destructive" });
      return;
    }
    setStep("review");
    setIsStabilizing(true);
    setReviewConfirmed(false);
    try {
      const { data, error } = await supabase.functions.invoke("stabilize-transcript", {
        body: { transcript: rawTranscript.trim() },
      });
      if (error) throw new Error(error.message);
      const stabilized = data.stabilized_transcript || rawTranscript;
      setStabilizedTranscript(stabilized);
      setEditedTranscript(stabilized);
      // Capture normalization results from the enhanced pipeline
      setNormalizationResults(data.normalization_results || []);
      setDetectedLanguages(data.detected_languages || []);
    } catch {
      toast({ title: "Stabilization notice", description: "Could not stabilize transcript. Showing raw version." });
      setStabilizedTranscript(rawTranscript);
      setEditedTranscript(rawTranscript);
      setNormalizationResults([]);
      setDetectedLanguages([]);
    } finally { setIsStabilizing(false); }
  };

  const confirmTranscript = () => {
    if (!editedTranscript.trim()) {
      toast({ title: "Empty transcript", description: "Review the transcript first.", variant: "destructive" });
      return;
    }
    if (!reviewConfirmed) {
      toast({ title: "Confirmation required", description: "Please confirm you have reviewed the transcript.", variant: "destructive" });
      return;
    }
    setStep("extract");
    runExtraction();
  };

  const runExtraction = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-patient-data", {
        body: { transcript: editedTranscript.trim() },
      });
      if (error) throw new Error(error.message);
      const extracted = {
        chief_complaint: data.chief_complaint || "", duration: data.duration || "",
        associated_symptoms: data.associated_symptoms || "", vitals: data.vitals || "",
        chronic_conditions: data.chronic_conditions || "", current_medications: data.current_medications || "",
        allergies: data.allergies || "",
      };
      setExtractedData(extracted);
      setAiExtractedBaseline({ ...extracted }); // Learning layer: baseline for diff
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally { setIsExtracting(false); }
  };

  const runSafetyCheck = async () => {
    setIsRunningSafety(true);
    setStep("safety");
    try {
      const medications = extractedData.current_medications
        ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : [];
      const allergies = extractedData.allergies
        ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : [];
      // Parse vitals from extracted text
      const vitalsText = extractedData.vitals || "";
      const parseVital = (pattern: RegExp): number | null => {
        const m = vitalsText.match(pattern);
        return m ? parseFloat(m[1]) : null;
      };
      const vitalsObj: Record<string, number | null> = {
        bp_systolic: parseVital(/(\d{2,3})\s*\/\s*\d+/),
        bp_diastolic: parseVital(/\d+\s*\/\s*(\d{2,3})/),
        pulse: parseVital(/(?:pulse|hr|heart\s*rate)[:\s]*(\d+)/i) ?? parseVital(/(\d{2,3})\s*bpm/i),
        temperature: parseVital(/(?:temp|temperature)[:\s]*([\d.]+)/i),
        spo2: parseVital(/(?:spo2|sp02|o2\s*sat|oxygen)[:\s]*(\d+)/i),
        respiratory_rate: parseVital(/(?:rr|resp|respiratory)[:\s]*(\d+)/i),
        blood_sugar: parseVital(/(?:sugar|glucose|bs|rbs)[:\s]*(\d+)/i),
      };
      // Gather symptoms from chief complaint + associated symptoms
      const symptomParts = [
        extractedData.chief_complaint,
        extractedData.associated_symptoms,
      ].filter(Boolean).join(", ").split(",").map(s => s.trim()).filter(Boolean);

      if (medications.length === 0 && !Object.values(vitalsObj).some(v => v != null) && symptomParts.length === 0) {
        setSafetyResults({ normalized_drugs: [], interaction_flags: [], allergy_flags: [], dose_warnings: [], vitals_dangers: [], emergency_patterns: [], confidence_level: "high", requires_manual_review: false, timestamp: new Date().toISOString() });
        return;
      }
      const { data, error } = await supabase.functions.invoke("clinical-safety", { body: { medications, allergies, vitals: vitalsObj, symptoms: symptomParts } });
      if (error) throw new Error(error.message);
      setSafetyResults(data as SafetyResults);
    } catch (err: any) {
      toast({ title: "Safety check notice", description: err.message || "Safety check could not complete." });
      setSafetyResults({ normalized_drugs: [], interaction_flags: [], allergy_flags: [], dose_warnings: [], vitals_dangers: [], emergency_patterns: [], confidence_level: "moderate", requires_manual_review: true, timestamp: new Date().toISOString() });
    } finally { setIsRunningSafety(false); }
  };

  const generateSoap = async () => {
    setIsGeneratingSoap(true);
    setStep("soap");
    try {
      const { data, error } = await supabase.functions.invoke("clinical-soap", {
        body: { transcript: editedTranscript.trim(), extractedData: { ...extractedData, safety_results: safetyResults } },
      });
      if (error) throw new Error(error.message);
      setSoapFullText(data.soap_text || "");
      const sections = {
        "Visit Summary": data.sections?.["Visit Summary"] || "", "Findings": data.sections?.["Findings"] || "",
        "Provisional Diagnosis": data.sections?.["Provisional Diagnosis"] || "",
        "Safety Warnings": data.sections?.["Safety Warnings"] || "No safety concerns identified.",
        "Treatment Plan": data.sections?.["Treatment Plan"] || "", "Advice": data.sections?.["Advice"] || "",
        "Follow-up": data.sections?.["Follow-up"] || "",
      };
      setSoapSections(sections);
      setAiSoapBaseline({ ...sections }); // Learning layer: baseline for diff
    } catch (err: any) {
      toast({ title: "Summary generation failed", description: err.message, variant: "destructive" });
      setStep("safety");
    } finally { setIsGeneratingSoap(false); }
  };

  const saveSession = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const editedSoapText = Object.entries(soapSections).map(([h, c]) => `**${h}**\n${c}`).join("\n\n");
      const { data: patientData, error: patientError } = await supabase.from("patients").insert({
        name: extractedData.chief_complaint ? `Session Patient` : "Quick Patient",
        doctor_id: user.id,
        current_medications: extractedData.current_medications ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : [],
        allergies: extractedData.allergies ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
      }).select("id").single();
      if (patientError) throw new Error(patientError.message);

      const { data: consultData, error } = await supabase.from("consultations").insert({
        patient_id: patientData.id, doctor_id: user.id, chief_complaint: extractedData.chief_complaint,
        raw_transcript: rawTranscript, stabilized_transcript: stabilizedTranscript,
        doctor_final_transcript: editedTranscript, review_confirmed: reviewConfirmed,
        edited_transcript: editedTranscript, extracted_data: extractedData as any, ai_summary: editedSoapText,
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
      setStep("saved");
      toast({ title: "Session saved", description: "Clinical session saved successfully." });
      loadPreviousSessions();

      // Learning layer: capture signals after doctor-validated save (fire-and-forget, no PHI)
      const clinicId = null; // TODO: wire from profile when available
      captureTranscriptEditSignal(user.id, clinicId, stabilizedTranscript, editedTranscript);
      captureExtractionCorrectionSignal(user.id, clinicId, aiExtractedBaseline as any, extractedData as any);
      captureDocumentationStyleSignal(user.id, clinicId, aiSoapBaseline as unknown as Record<string, string>, soapSections as unknown as Record<string, string>);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const startNewSession = () => {
    setStep("record"); setRawTranscript(""); setStabilizedTranscript(""); setEditedTranscript("");
    setReviewConfirmed(false); setShowRawTranscript(false); setExtractedData(EMPTY_EXTRACTED);
    setSoapSections(EMPTY_SOAP); setSoapFullText(""); setSavedSessionId(null);
    setSafetyResults(null); setPatientExplanation(""); setShowPatientExplanation(false);
  };

  const generatePatientExplanation = async () => {
    setIsGeneratingExplanation(true);
    try {
      const soapText = Object.entries(soapSections).map(([h, c]) => `${h}: ${c}`).join("\n");
      const { data, error } = await supabase.functions.invoke("patient-explanation", {
        body: { soap_summary: soapText, language: explanationLang },
      });
      if (error) throw new Error(error.message);
      setPatientExplanation(data.explanation || "");
      setShowPatientExplanation(true);
    } catch (err: any) {
      toast({ title: "Explanation generation failed", description: err.message, variant: "destructive" });
    } finally { setIsGeneratingExplanation(false); }
  };

  const updateExtractedField = (field: keyof ExtractedData, value: string) => setExtractedData(prev => ({ ...prev, [field]: value }));
  const updateSoapSection = (section: keyof SoapSections, value: string) => setSoapSections(prev => ({ ...prev, [section]: value }));

  const steps = PIPELINE_STEPS;

  const stepIndex = steps.findIndex(s => s.key === step);

  // severityColor imported from @/layers/safety/api

  const confidenceBadge = (level: string) => {
    if (level === "high") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"><CheckCircle className="h-3 w-3 mr-1" />High Confidence</Badge>;
    if (level === "moderate") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"><AlertTriangle className="h-3 w-3 mr-1" />Moderate Confidence</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800"><XCircle className="h-3 w-3 mr-1" />Low Confidence — Review Required</Badge>;
  };

  return (
    <>
      <SEO title="Write / Record — DATAelixAIr" description="AI clinical documentation workspace" />

      <div className="p-6 max-w-5xl mx-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i < stepIndex ? "bg-primary/10 text-primary" :
                i === stepIndex ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < stepIndex ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-mono">{i + 1}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">

            {/* STEP 1: Record */}
            {step === "record" && (
              <>
                <VoiceRecorder onTranscriptUpdate={handleTranscriptUpdate} />
                {rawTranscript && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-base">Live Transcript</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{rawTranscript}</p>
                      <Button onClick={goToReview} className="mt-3 w-full" size="sm">
                        Stabilize & Review <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                )}
                {!rawTranscript && (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Mic className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Click "Start Recording" or type the transcript directly</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => { setStep("review"); setEditedTranscript(""); setStabilizedTranscript(""); }}>
                        Type transcript manually
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* STEP 2: Review */}
            {step === "review" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Edit3 className="h-5 w-5 text-primary" /> Review Transcript</CardTitle>
                  <CardDescription>Review, edit, and confirm before extraction.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isStabilizing ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Stabilizing transcript...</span>
                    </div>
                  ) : (
                    <>
                      <Textarea value={editedTranscript} onChange={e => { setEditedTranscript(e.target.value); setReviewConfirmed(false); }} placeholder="Paste or type the consultation transcript here..." rows={12} className="text-sm font-mono" />
                      
                      {/* Normalization & Language Detection Results */}
                      {(normalizationResults.length > 0 || detectedLanguages.length > 1) && (
                        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                          {detectedLanguages.length > 1 && (
                            <div className="flex items-center gap-2">
                              <Languages className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs text-muted-foreground">Languages detected:</span>
                              {detectedLanguages.map(lang => (
                                <Badge key={lang} variant="outline" className="text-[10px] capitalize">{lang}</Badge>
                              ))}
                            </div>
                          )}
                          {normalizationResults.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Info className="h-3 w-3" /> Clinical vocabulary mapped ({normalizationResults.length} terms)
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {normalizationResults.map((m, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border bg-background">
                                    <span className="text-muted-foreground">{m.original}</span>
                                    <span className="text-muted-foreground">→</span>
                                    <span className="font-medium text-foreground">{m.clinical}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {rawTranscript && (
                        <Collapsible open={showRawTranscript} onOpenChange={setShowRawTranscript}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {showRawTranscript ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {showRawTranscript ? "Hide Raw" : "View Raw"}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="rounded-md border border-border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{rawTranscript}</p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox id="review-confirm" checked={reviewConfirmed} onCheckedChange={(c) => setReviewConfirmed(c === true)} />
                        <label htmlFor="review-confirm" className="text-xs text-muted-foreground cursor-pointer select-none">I have reviewed and corrected the transcript.</label>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("record")}>← Back</Button>
                        <Button onClick={confirmTranscript} className="flex-1" size="sm" disabled={!reviewConfirmed}>
                          Confirm & Extract <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 3: Extract */}
            {step === "extract" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Structured Extraction</CardTitle>
                  <CardDescription>AI-extracted clinical data. Review each field.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isExtracting ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /><span className="text-sm text-muted-foreground">Extracting clinical data...</span></div>
                  ) : (
                    <>
                      {([
                        { key: "chief_complaint" as const, label: "Chief Complaint" },
                        { key: "duration" as const, label: "Duration" },
                        { key: "associated_symptoms" as const, label: "Associated Symptoms" },
                        { key: "vitals" as const, label: "Vitals" },
                        { key: "chronic_conditions" as const, label: "Chronic Conditions" },
                        { key: "current_medications" as const, label: "Current Medications" },
                        { key: "allergies" as const, label: "Allergies" },
                      ]).map(({ key, label }) => (
                        <div key={key}>
                          <Label className="text-xs font-medium">{label}</Label>
                          <Input value={extractedData[key]} onChange={e => updateExtractedField(key, e.target.value)} placeholder={`${label} (leave blank if not mentioned)`} className="text-sm" />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("review")}>← Edit Transcript</Button>
                        <Button onClick={runSafetyCheck} className="flex-1" size="sm">
                          <ShieldCheck className="h-4 w-4 mr-1" /> Run Safety Check <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 4: Safety */}
            {step === "safety" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Safety Check</CardTitle>
                  <CardDescription>Automated safety validation. Review flags before generating summary.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isRunningSafety ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /><span className="text-sm text-muted-foreground">Running safety checks...</span></div>
                  ) : safetyResults ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Overall Confidence</span>
                        {confidenceBadge(safetyResults.confidence_level)}
                      </div>

                      {/* Normalization */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-primary" /> Drug Normalization</h4>
                        {safetyResults.normalized_drugs.length === 0 ? (
                          <p className="text-xs text-muted-foreground pl-5">No medications to normalize.</p>
                        ) : (
                          <div className="space-y-1.5 pl-5">
                            {safetyResults.normalized_drugs.map((drug, i) => (
                              <div key={i} className={`flex items-start gap-2 p-2 rounded-md border text-xs ${drug.rxnorm_id ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"}`}>
                                {drug.rxnorm_id ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />}
                                <div>
                                  <span className="font-medium">{drug.original_name}</span>
                                  {drug.canonical_name && drug.canonical_name !== drug.original_name && <span className="text-muted-foreground"> → {drug.canonical_name}</span>}
                                  {drug.rxnorm_id && <span className="text-muted-foreground ml-1">(RxCUI: {drug.rxnorm_id})</span>}
                                  {drug.warning && <p className="text-amber-700 dark:text-amber-400 mt-0.5">{drug.warning}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Interactions */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Interaction Risks</h4>
                        {safetyResults.interaction_flags.length === 0 ? (
                          <div className="flex items-center gap-1.5 pl-5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-muted-foreground">No interactions detected.</p></div>
                        ) : (
                          <div className="space-y-1.5 pl-5">
                            {safetyResults.interaction_flags.map((flag, i) => (
                              <div key={i} className={`p-2 rounded-md border text-xs ${severityColor(flag.severity)}`}>
                                <div className="flex items-center gap-1.5 font-medium">
                                  {flag.severity === "severe" ? <XCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                                  {flag.drug_a} ↔ {flag.drug_b}
                                  <Badge variant="outline" className="text-[9px] ml-auto">{flag.severity}</Badge>
                                </div>
                                <p className="mt-0.5 pl-5">{flag.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Allergies */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" /> Allergy Conflicts</h4>
                        {safetyResults.allergy_flags.length === 0 ? (
                          <div className="flex items-center gap-1.5 pl-5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-muted-foreground">No allergy conflicts.</p></div>
                        ) : (
                          <div className="space-y-1.5 pl-5">
                            {safetyResults.allergy_flags.map((flag, i) => (
                              <div key={i} className="p-2 rounded-md border border-destructive/30 bg-destructive/5 text-xs text-destructive dark:bg-destructive/10">
                                <div className="flex items-center gap-1.5 font-semibold"><XCircle className="h-3.5 w-3.5 shrink-0" />{flag.message}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dose */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-primary" /> Dose Sanity</h4>
                        {safetyResults.dose_warnings.length === 0 ? (
                          <div className="flex items-center gap-1.5 pl-5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-muted-foreground">No dosage concerns.</p></div>
                        ) : (
                          <div className="space-y-1.5 pl-5">
                            {safetyResults.dose_warnings.map((w, i) => (
                              <div key={i} className="p-2 rounded-md border border-amber-200 bg-amber-50/50 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
                                <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{w.message}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Vitals Dangers */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><HeartPulse className="h-3.5 w-3.5 text-destructive" /> Vitals Assessment</h4>
                        {(!safetyResults.vitals_dangers || safetyResults.vitals_dangers.length === 0) ? (
                          <div className="flex items-center gap-1.5 pl-5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-muted-foreground">No dangerous vital signs detected.</p></div>
                        ) : (
                          <div className="space-y-1.5 pl-5">
                            {safetyResults.vitals_dangers.map((v, i) => (
                              <div key={i} className={`p-2 rounded-md border text-xs ${severityColor(v.severity)}`}>
                                <div className="flex items-center gap-1.5 font-medium">
                                  {v.severity === "critical" ? <Siren className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                                  {v.message}
                                  <Badge variant="outline" className="text-[9px] ml-auto">{v.severity}</Badge>
                                </div>
                                <p className="mt-0.5 pl-5 text-muted-foreground">{v.action_hint}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Emergency Patterns */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5"><Siren className="h-3.5 w-3.5 text-destructive" /> Emergency Patterns</h4>
                        {(!safetyResults.emergency_patterns || safetyResults.emergency_patterns.length === 0) ? (
                          <div className="flex items-center gap-1.5 pl-5"><CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /><p className="text-xs text-muted-foreground">No emergency patterns detected.</p></div>
                        ) : (
                          <div className="space-y-1.5 pl-5">
                            {safetyResults.emergency_patterns.map((ep, i) => (
                              <div key={i} className={`p-3 rounded-md border text-xs ${severityColor(ep.severity)}`}>
                                <div className="flex items-center gap-1.5 font-semibold">
                                  <Siren className="h-4 w-4 shrink-0" />
                                  {ep.pattern}
                                  <Badge variant="outline" className="text-[9px] ml-auto">{ep.severity}</Badge>
                                </div>
                                <p className="mt-1 pl-5.5">{ep.message}</p>
                                <div className="mt-1 pl-5.5 flex flex-wrap gap-1">
                                  {ep.matched_indicators.map((ind, j) => (
                                    <Badge key={j} variant="outline" className="text-[9px]">{ind}</Badge>
                                  ))}
                                </div>
                                <p className="mt-1.5 pl-5.5 font-medium">→ {ep.action_hint}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {safetyResults.requires_manual_review && (
                        <div className="p-3 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>Manual review recommended. Please verify flagged items before proceeding.</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("extract")}>← Edit Extraction</Button>
                        <Button onClick={generateSoap} className="flex-1" size="sm">Generate Clinical Summary <ChevronRight className="h-4 w-4 ml-1" /></Button>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* STEP 5: Summary */}
            {step === "soap" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Clinical Summary</CardTitle>
                  <CardDescription>Review and edit before saving.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isGeneratingSoap ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /><span className="text-sm text-muted-foreground">Generating clinical summary...</span></div>
                  ) : (
                    <>
                      {(Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section) => (
                        <div key={section}>
                          <Label className={`text-xs font-semibold ${section === "Safety Warnings" ? "text-amber-600 dark:text-amber-400" : ""}`}>
                            {section === "Safety Warnings" && <ShieldCheck className="h-3 w-3 inline mr-1" />}{section}
                          </Label>
                          <Textarea value={soapSections[section]} onChange={e => updateSoapSection(section, e.target.value)} rows={section === "Safety Warnings" ? 3 : 2} className={`text-sm ${section === "Safety Warnings" ? "border-amber-200 dark:border-amber-800" : ""}`} />
                        </div>
                      ))}

                      <EvidencePanel
                        medications={extractedData.current_medications ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : []}
                        diagnosis={soapSections["Provisional Diagnosis"] || extractedData.chief_complaint}
                        allergies={extractedData.allergies ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : []}
                        confidenceLevel={safetyResults?.confidence_level || "moderate"}
                      />

                      <Card className="border-border">
                        <CardContent className="py-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Languages className="h-4 w-4 text-primary" />
                              <span className="text-xs font-medium">Patient-Friendly Explanation</span>
                              <Badge variant="outline" className="text-[9px]">Optional</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <select value={explanationLang} onChange={e => setExplanationLang(e.target.value as "english" | "telugu")} className="text-[10px] border border-border rounded px-1.5 py-0.5 bg-background">
                                <option value="english">English</option>
                                <option value="telugu">Telugu</option>
                              </select>
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={generatePatientExplanation} disabled={isGeneratingExplanation}>
                                {isGeneratingExplanation ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generate"}
                              </Button>
                            </div>
                          </div>
                          {showPatientExplanation && patientExplanation && (
                            <div className="p-3 rounded-md border border-primary/20 bg-primary/5 text-xs whitespace-pre-wrap">{patientExplanation}</div>
                          )}
                        </CardContent>
                      </Card>

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("safety")}>← Safety Check</Button>
                        <Button onClick={saveSession} disabled={isSaving} className="flex-1" size="sm">
                          {isSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</> : <><Save className="h-4 w-4 mr-1" /> Save Session</>}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 6: Saved */}
            {step === "saved" && (
              <Card className="border-primary/20">
                <CardContent className="py-8 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="text-lg font-semibold">Session Saved</h3>
                  <p className="text-sm text-muted-foreground">Clinical session saved successfully.</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={startNewSession} size="sm"><Mic className="h-4 w-4 mr-1" /> New Session</Button>
                    {savedSessionId && (
                      <Button variant="outline" size="sm" onClick={() => navigate(`/consultations/${savedSessionId}`)}>View Details</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Previous Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSessions ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : previousSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No previous sessions</p>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {previousSessions.map(session => (
                      <button key={session.id} onClick={() => navigate(`/consultations/${session.id}`)} className="w-full text-left p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-[10px]">{session.status || "draft"}</Badge>
                          <span className="text-[10px] text-muted-foreground">{new Date(session.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-1">{session.chief_complaint || "No complaint recorded"}</p>
                        {session.ai_summary && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{session.ai_summary.substring(0, 80)}...</p>}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
