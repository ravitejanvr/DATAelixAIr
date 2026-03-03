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
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  Activity, LogOut, Loader2, Save, User, Mic,
  CheckCircle2, ChevronRight, FileText, Clock, Edit3, Eye, EyeOff
} from "lucide-react";
import VoiceRecorder from "@/components/VoiceRecorder";

interface ExtractedData {
  chief_complaint: string;
  duration: string;
  associated_symptoms: string;
  vitals: string;
  chronic_conditions: string;
  current_medications: string;
  allergies: string;
}

interface SoapSections {
  "Visit Summary": string;
  "Findings": string;
  "Provisional Diagnosis": string;
  "Treatment Plan": string;
  "Advice": string;
  "Follow-up": string;
}

type PipelineStep = "record" | "review" | "extract" | "soap" | "saved";

const EMPTY_EXTRACTED: ExtractedData = {
  chief_complaint: "",
  duration: "",
  associated_symptoms: "",
  vitals: "",
  chronic_conditions: "",
  current_medications: "",
  allergies: "",
};

const EMPTY_SOAP: SoapSections = {
  "Visit Summary": "",
  "Findings": "",
  "Provisional Diagnosis": "",
  "Treatment Plan": "",
  "Advice": "",
  "Follow-up": "",
};

export default function Clinical() {
  const { user, signOut } = useAuth();
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

  const [previousSessions, setPreviousSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    if (user) loadPreviousSessions();
  }, [user]);

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
    } catch {} finally {
      setLoadingSessions(false);
    }
  };

  const handleTranscriptUpdate = (transcript: string) => {
    setRawTranscript(transcript);
  };

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
    } catch (err: any) {
      toast({ title: "Stabilization notice", description: "Could not stabilize transcript. Showing raw version.", variant: "default" });
      setStabilizedTranscript(rawTranscript);
      setEditedTranscript(rawTranscript);
    } finally {
      setIsStabilizing(false);
    }
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
      setExtractedData({
        chief_complaint: data.chief_complaint || "",
        duration: data.duration || "",
        associated_symptoms: data.associated_symptoms || "",
        vitals: data.vitals || "",
        chronic_conditions: data.chronic_conditions || "",
        current_medications: data.current_medications || "",
        allergies: data.allergies || "",
      });
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err.message, variant: "destructive" });
    } finally {
      setIsExtracting(false);
    }
  };

  const generateSoap = async () => {
    setIsGeneratingSoap(true);
    setStep("soap");
    try {
      const { data, error } = await supabase.functions.invoke("clinical-soap", {
        body: { transcript: editedTranscript.trim(), extractedData },
      });
      if (error) throw new Error(error.message);
      setSoapFullText(data.soap_text || "");
      setSoapSections({
        "Visit Summary": data.sections?.["Visit Summary"] || "",
        "Findings": data.sections?.["Findings"] || "",
        "Provisional Diagnosis": data.sections?.["Provisional Diagnosis"] || "",
        "Treatment Plan": data.sections?.["Treatment Plan"] || "",
        "Advice": data.sections?.["Advice"] || "",
        "Follow-up": data.sections?.["Follow-up"] || "",
      });
    } catch (err: any) {
      toast({ title: "SOAP generation failed", description: err.message, variant: "destructive" });
      setStep("extract");
    } finally {
      setIsGeneratingSoap(false);
    }
  };

  const saveSession = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const editedSoapText = Object.entries(soapSections)
        .map(([heading, content]) => `**${heading}**\n${content}`)
        .join("\n\n");

      const { data: patientData, error: patientError } = await supabase.from("patients").insert({
        name: extractedData.chief_complaint ? `Session Patient` : "Quick Patient",
        doctor_id: user.id,
        current_medications: extractedData.current_medications ? extractedData.current_medications.split(",").map(s => s.trim()).filter(Boolean) : [],
        allergies: extractedData.allergies ? extractedData.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
      }).select("id").single();

      if (patientError) throw new Error(patientError.message);

      const { data: consultData, error } = await supabase.from("consultations").insert({
        patient_id: patientData.id,
        doctor_id: user.id,
        chief_complaint: extractedData.chief_complaint,
        raw_transcript: rawTranscript,
        stabilized_transcript: stabilizedTranscript,
        doctor_final_transcript: editedTranscript,
        review_confirmed: reviewConfirmed,
        edited_transcript: editedTranscript,
        extracted_data: extractedData as any,
        ai_summary: editedSoapText,
        soap_subjective: soapSections["Visit Summary"],
        soap_objective: soapSections["Findings"],
        soap_assessment: soapSections["Provisional Diagnosis"],
        soap_plan: `${soapSections["Treatment Plan"]}\n\n${soapSections["Advice"]}\n\n${soapSections["Follow-up"]}`,
        status: "completed",
      } as any).select("id").single();

      if (error) throw new Error(error.message);

      setSavedSessionId(consultData.id);
      setStep("saved");
      toast({ title: "Session saved", description: "Clinical session saved successfully." });
      loadPreviousSessions();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const startNewSession = () => {
    setStep("record");
    setRawTranscript("");
    setStabilizedTranscript("");
    setEditedTranscript("");
    setReviewConfirmed(false);
    setShowRawTranscript(false);
    setExtractedData(EMPTY_EXTRACTED);
    setSoapSections(EMPTY_SOAP);
    setSoapFullText("");
    setSavedSessionId(null);
  };

  const updateExtractedField = (field: keyof ExtractedData, value: string) => {
    setExtractedData(prev => ({ ...prev, [field]: value }));
  };

  const updateSoapSection = (section: keyof SoapSections, value: string) => {
    setSoapSections(prev => ({ ...prev, [section]: value }));
  };

  const steps: { key: PipelineStep; label: string; num: number }[] = [
    { key: "record", label: "Record", num: 1 },
    { key: "review", label: "Review", num: 2 },
    { key: "extract", label: "Extract", num: 3 },
    { key: "soap", label: "SOAP", num: 4 },
    { key: "saved", label: "Saved", num: 5 },
  ];

  const stepIndex = steps.findIndex(s => s.key === step);

  return (
    <>
      <SEO title="Clinical Session — DATAelixAIr" description="Multilingual AI clinical documentation" />

      <header className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={brainLogo} alt="DATAelixAIr" className="h-8" />
            <div>
              <h1 className="text-sm font-bold text-foreground">Clinical Session</h1>
              <p className="text-xs text-muted-foreground">AI Scribe</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono ml-2">Prototype</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Activity className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
              <User className="h-4 w-4 mr-1" /> Patients
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-8 px-4 max-w-5xl mx-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mt-4 mb-6 overflow-x-auto">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                i < stepIndex ? "bg-primary/10 text-primary" :
                i === stepIndex ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < stepIndex ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-mono">{s.num}</span>}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main pipeline area */}
          <div className="lg:col-span-2 space-y-4">

            {/* STEP 1: Record */}
            {step === "record" && (
              <>
                <VoiceRecorder onTranscriptUpdate={handleTranscriptUpdate} />
                {rawTranscript && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Live Transcript</CardTitle>
                    </CardHeader>
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
                      <p className="text-sm text-muted-foreground">
                        Click "Start Recording" or type the transcript directly in the next step
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => { setStep("review"); setEditedTranscript(""); setStabilizedTranscript(""); }}>
                        Type transcript manually
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* STEP 2: Review & Edit Stabilized Transcript */}
            {step === "review" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-primary" /> Review Transcript
                  </CardTitle>
                  <CardDescription>
                    The transcript has been stabilized (repetitions removed, medical terms corrected). Review, edit, and confirm before extraction.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isStabilizing ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Stabilizing transcript...</span>
                    </div>
                  ) : (
                    <>
                      <Textarea
                        value={editedTranscript}
                        onChange={e => { setEditedTranscript(e.target.value); setReviewConfirmed(false); }}
                        placeholder="Paste or type the consultation transcript here..."
                        rows={12}
                        className="text-sm font-mono"
                      />

                      {/* Raw transcript toggle */}
                      {rawTranscript && (
                        <Collapsible open={showRawTranscript} onOpenChange={setShowRawTranscript}>
                          <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              {showRawTranscript ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              {showRawTranscript ? "Hide Raw Transcript" : "View Raw Transcript"}
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2">
                            <div className="rounded-md border border-border bg-muted/30 p-3">
                              <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{rawTranscript}</p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      {/* Review confirmation */}
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id="review-confirm"
                          checked={reviewConfirmed}
                          onCheckedChange={(checked) => setReviewConfirmed(checked === true)}
                        />
                        <label htmlFor="review-confirm" className="text-xs text-muted-foreground cursor-pointer select-none">
                          I have reviewed and corrected the transcript.
                        </label>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("record")}>
                          ← Back to Record
                        </Button>
                        <Button
                          onClick={confirmTranscript}
                          className="flex-1"
                          size="sm"
                          disabled={!reviewConfirmed}
                        >
                          Confirm & Extract <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 3: Structured Extraction */}
            {step === "extract" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Structured Extraction
                  </CardTitle>
                  <CardDescription>
                    AI-extracted clinical data. Review and edit each field before generating the summary.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isExtracting ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Extracting clinical data...</span>
                    </div>
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
                          <Input
                            value={extractedData[key]}
                            onChange={e => updateExtractedField(key, e.target.value)}
                            placeholder={`${label} (leave blank if not mentioned)`}
                            className="text-sm"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("review")}>
                          ← Edit Transcript
                        </Button>
                        <Button onClick={generateSoap} className="flex-1" size="sm">
                          Generate Clinical Summary <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 4: SOAP / Clinical Summary */}
            {step === "soap" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Clinical Summary
                  </CardTitle>
                  <CardDescription>
                    Review and edit the AI-generated clinical summary before saving.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isGeneratingSoap ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-muted-foreground">Generating clinical summary...</span>
                    </div>
                  ) : (
                    <>
                      {(Object.keys(EMPTY_SOAP) as (keyof SoapSections)[]).map((section) => (
                        <div key={section}>
                          <Label className="text-xs font-semibold">{section}</Label>
                          <Textarea
                            value={soapSections[section]}
                            onChange={e => updateSoapSection(section, e.target.value)}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setStep("extract")}>
                          ← Edit Extraction
                        </Button>
                        <Button onClick={saveSession} disabled={isSaving} className="flex-1" size="sm">
                          {isSaving ? (
                            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</>
                          ) : (
                            <><Save className="h-4 w-4 mr-1" /> Save Session</>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* STEP 5: Saved */}
            {step === "saved" && (
              <Card className="border-primary/20">
                <CardContent className="py-8 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="text-lg font-semibold">Session Saved</h3>
                  <p className="text-sm text-muted-foreground">
                    Clinical session has been saved successfully.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={startNewSession} size="sm">
                      <Mic className="h-4 w-4 mr-1" /> New Session
                    </Button>
                    {savedSessionId && (
                      <Button variant="outline" size="sm" onClick={() => navigate(`/consultation/${savedSessionId}`)}>
                        View Details
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT SIDEBAR: Previous Sessions */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Previous Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSessions ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : previousSessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No previous sessions</p>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {previousSessions.map(session => (
                      <button
                        key={session.id}
                        onClick={() => navigate(`/consultation/${session.id}`)}
                        className="w-full text-left p-2.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-[10px]">
                            {session.status || "draft"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(session.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-foreground line-clamp-1">
                          {session.chief_complaint || "No complaint recorded"}
                        </p>
                        {session.ai_summary && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                            {session.ai_summary.substring(0, 80)}...
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
