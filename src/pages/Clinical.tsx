import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { runClinicalAgent, type PatientData, type ClinicalAgentResponse } from "@/lib/clinical-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  Activity, AlertTriangle, Beaker, BookOpen, ClipboardList,
  LogOut, Pill, Search, Shield, Stethoscope, User, FileText,
  CheckCircle2, XCircle, AlertCircle, Loader2, Share2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import VoiceRecorder from "@/components/VoiceRecorder";
import ReportShareDialog from "@/components/ReportShareDialog";
import OnboardingWalkthrough from "@/components/OnboardingWalkthrough";

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { className: string; icon: React.ReactNode }> = {
    safe: { className: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    caution: { className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <AlertCircle className="h-3 w-3" /> },
    warning: { className: "bg-orange-100 text-orange-800 border-orange-200", icon: <AlertTriangle className="h-3 w-3" /> },
    danger: { className: "bg-red-100 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
  };
  const c = config[severity] || config.safe;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${c.className}`}>
      {c.icon} {severity}
    </span>
  );
}

export default function Clinical() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Patient from navigation state (from patient detail page)
  const linkedPatient = (location.state as any)?.patient || null;

  // Patient input state
  const [patientName, setPatientName] = useState(linkedPatient?.name || "Ravi");
  const [patientAge, setPatientAge] = useState(String(linkedPatient?.age || "45"));
  const [patientGender, setPatientGender] = useState(linkedPatient?.gender || "male");
  const [conditions, setConditions] = useState("Type 2 Diabetes, HbA1c 7.8, retinopathy risk");
  const [symptoms, setSymptoms] = useState("blurring vision 2 months, family history diabetes");
  const [ethnicity, setEthnicity] = useState("South Asian / Indian");
  const [medications, setMedications] = useState(linkedPatient?.current_medications?.join(", ") || "Metformin");
  const [clinicalQuery, setClinicalQuery] = useState("Assess retinopathy risk, recommend treatment plan with evidence");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClinicalAgentResponse | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [savedConsultationId, setSavedConsultationId] = useState<string | null>(null);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const patientData: PatientData = {
        name: patientName,
        age: parseInt(patientAge) || 0,
        gender: patientGender,
        conditions: conditions.split(",").map(s => s.trim()).filter(Boolean),
        symptoms: symptoms.split(",").map(s => s.trim()).filter(Boolean),
        ethnicity,
        medications: medications.split(",").map(s => s.trim()).filter(Boolean),
      };

      const drugs = medications.split(",").map(s => s.trim()).filter(Boolean);
      const response = await runClinicalAgent(patientData, clinicalQuery, drugs);
      setResult(response);

      // Always save consultation — create patient if not linked
      let patientId = linkedPatient?.id;
      let patientLabel = linkedPatient?.name || patientName;

      if (!patientId) {
        // Create a quick patient record
        const { data: newPatient, error: patientError } = await supabase.from("patients").insert({
          name: patientName,
          age: parseInt(patientAge) || null,
          gender: patientGender,
          doctor_id: user?.id,
          current_medications: medications.split(",").map(s => s.trim()).filter(Boolean),
        }).select("id").single();

        if (patientError) {
          console.error("Failed to create patient:", patientError.message);
        } else {
          patientId = newPatient.id;
        }
      }

      if (patientId) {
        const { data: consultData, error } = await supabase.from("consultations").insert({
          patient_id: patientId,
          doctor_id: user?.id,
          chief_complaint: conditions,
          soap_subjective: response.assessment.soap_notes?.subjective || "",
          soap_objective: response.assessment.soap_notes?.objective || "",
          soap_assessment: response.assessment.soap_notes?.assessment || "",
          soap_plan: response.assessment.soap_notes?.plan || "",
          risk_assessment: response.assessment.risk_assessment || {},
          drug_recommendations: response.assessment.drug_recommendations || [],
          drug_interactions: response.assessment.drug_interactions || [],
          pubmed_citations: response.assessment.citations || [],
          tests_ordered: response.assessment.tests_recommended || [],
          ai_summary: response.assessment.summary || "",
          status: "draft",
        }).select("id").single();

        if (error) {
          console.error("Failed to save consultation:", error.message);
        } else {
          setSavedConsultationId(consultData.id);
          setSavedPatientId(patientId);
          toast({ title: "Consultation saved", description: `Linked to ${patientLabel}` });
        }
      }
    } catch (err: any) {
      toast({
        title: "Analysis failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const a = result?.assessment;

  return (
    <>
      <SEO title="CDSS Analysis — DATAelixAIr" description="AI-powered Clinical Decision Support System with PubMed RAG evidence" />

      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={brainLogo} alt="DATAelixAIr" className="h-8" />
            <div>
              <h1 className="text-sm font-bold text-foreground">DATAelixAIr CDSS</h1>
              <p className="text-xs text-muted-foreground">Clinical Decision Support System</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono ml-2">Prototype</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <Activity className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/patients")}>
              <User className="h-4 w-4 mr-1" /> Patient Records
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-8 px-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">

          {/* LEFT: Patient Input */}
          <div className="lg:col-span-1 space-y-4">
            <VoiceRecorder
              onExtracted={(data) => {
                if (data.name) setPatientName(data.name);
                if (data.age) setPatientAge(data.age);
                if (data.gender) setPatientGender(data.gender);
                if (data.conditions) setConditions(data.conditions);
                if (data.symptoms) setSymptoms(data.symptoms);
                if (data.ethnicity) setEthnicity(data.ethnicity);
                if (data.medications) setMedications(data.medications);
                if (data.clinicalQuery) setClinicalQuery(data.clinicalQuery);
              }}
            />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> Patient Details
                </CardTitle>
                <CardDescription>Enter patient information for clinical analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={patientName} onChange={e => setPatientName(e.target.value)} placeholder="Patient name" />
                  </div>
                  <div>
                    <Label className="text-xs">Age</Label>
                    <Input value={patientAge} onChange={e => setPatientAge(e.target.value)} type="number" placeholder="Age" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Gender</Label>
                  <select
                    value={patientGender}
                    onChange={e => setPatientGender(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Ethnicity</Label>
                  <Input value={ethnicity} onChange={e => setEthnicity(e.target.value)} placeholder="e.g. South Asian" />
                </div>
                <div>
                  <Label className="text-xs">Conditions / Lab Values</Label>
                  <Textarea value={conditions} onChange={e => setConditions(e.target.value)} placeholder="T2DM, HbA1c 7.8..." rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Symptoms / History</Label>
                  <Textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Blurring vision..." rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Current Medications</Label>
                  <Input value={medications} onChange={e => setMedications(e.target.value)} placeholder="Metformin, Atorvastatin..." />
                </div>
                <div>
                  <Label className="text-xs">Clinical Query</Label>
                  <Textarea value={clinicalQuery} onChange={e => setClinicalQuery(e.target.value)} placeholder="What do you want to assess?" rows={2} />
                </div>
                <Button onClick={handleAnalyze} disabled={loading} className="w-full" size="lg">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Running CDSS Analysis...</>
                  ) : (
                    <><Stethoscope className="h-4 w-4 mr-2" /> Run CDSS Analysis</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Results */}
          <div className="lg:col-span-2 space-y-4">
            {!result && !loading && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <Activity className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground">Ready for CDSS Analysis</h3>
                  <p className="text-sm text-muted-foreground/70 max-w-md mt-2">
                    Enter patient data and click "Run CDSS Analysis" to get evidence-based risk assessment,
                    drug recommendations, and structured SOAP notes.
                  </p>
                  <p className="text-xs text-primary/70 mt-3 font-medium">
                    → Your next step: Fill in patient details on the left, then click the analysis button.
                  </p>
                  <div className="flex gap-2 mt-4 flex-wrap justify-center">
                    <Badge variant="outline"><Search className="h-3 w-3 mr-1" /> PubMed RAG</Badge>
                    <Badge variant="outline"><Pill className="h-3 w-3 mr-1" /> Drug Interactions</Badge>
                    <Badge variant="outline"><FileText className="h-3 w-3 mr-1" /> SOAP Notes</Badge>
                    <Badge variant="outline"><Shield className="h-3 w-3 mr-1" /> Risk Assessment</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <h3 className="text-lg font-semibold">Analyzing Patient Data...</h3>
                  <p className="text-sm text-muted-foreground mt-1">Querying PubMed + Europe PMC + RxNorm</p>
                  <div className="flex gap-3 mt-4 text-xs text-muted-foreground">
                    <span>📚 Searching literature...</span>
                    <span>💊 Checking interactions...</span>
                    <span>🤖 AI reasoning...</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {result && a && (
              <>
              <div className="flex justify-end gap-2">
                {savedConsultationId && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/prescriptions?consultation=${savedConsultationId}&patient=${savedPatientId}`)}>
                    <Pill className="h-4 w-4 mr-1" /> Generate Prescription
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
                  <Share2 className="h-4 w-4 mr-1" /> Share / Export Report
                </Button>
              </div>
              <Tabs defaultValue="summary" className="space-y-4">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
                  <TabsTrigger value="soap" className="text-xs">SOAP Notes</TabsTrigger>
                  <TabsTrigger value="drugs" className="text-xs">Drugs</TabsTrigger>
                  <TabsTrigger value="risk" className="text-xs">Risk</TabsTrigger>
                  <TabsTrigger value="evidence" className="text-xs">Evidence</TabsTrigger>
                </TabsList>

                {/* SUMMARY */}
                <TabsContent value="summary">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardList className="h-5 w-5 text-primary" /> Clinical Summary
                      </CardTitle>
                      <CardDescription>Generated {new Date(result.timestamp).toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent className="prose prose-sm max-w-none">
                      {a.raw ? (
                        <ReactMarkdown>{a.summary || ""}</ReactMarkdown>
                      ) : (
                        <>
                          <p className="text-foreground">{a.summary}</p>
                          {a.icd_codes && a.icd_codes.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-sm">ICD-11 Codes</h4>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {a.icd_codes.map((c, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {c.code}: {c.description}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {a.tests_recommended && a.tests_recommended.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-sm flex items-center gap-1">
                                <Beaker className="h-4 w-4" /> Tests Recommended
                              </h4>
                              <ul className="list-disc pl-5 text-sm">
                                {a.tests_recommended.map((t, i) => <li key={i}>{t}</li>)}
                              </ul>
                            </div>
                          )}
                          {a.follow_up && (
                            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                              <h4 className="font-semibold text-sm">Follow-up</h4>
                              <p className="text-sm">{a.follow_up}</p>
                            </div>
                          )}
                        </>
                      )}
                      {a.disclaimer && (
                        <p className="text-xs text-muted-foreground italic mt-4 p-2 bg-muted/30 rounded">
                          ⚕️ {a.disclaimer}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* SOAP NOTES */}
                <TabsContent value="soap">
                  <div className="grid gap-4">
                    {a.soap_notes && (
                      <>
                        {[
                          { label: "Subjective", content: a.soap_notes.subjective, color: "bg-blue-50 border-blue-200" },
                          { label: "Objective", content: a.soap_notes.objective, color: "bg-green-50 border-green-200" },
                          { label: "Assessment", content: a.soap_notes.assessment, color: "bg-amber-50 border-amber-200" },
                          { label: "Plan", content: a.soap_notes.plan, color: "bg-purple-50 border-purple-200" },
                        ].map((section, i) => (
                          <Card key={i} className={`border ${section.color}`}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-base">
                                <span className="font-mono text-primary mr-2">{section.label[0]}</span>
                                {section.label}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-sm max-w-none">
                              <ReactMarkdown>{section.content}</ReactMarkdown>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}
                    {!a.soap_notes && (
                      <Card><CardContent className="py-8 text-center text-muted-foreground">No SOAP notes generated.</CardContent></Card>
                    )}
                  </div>
                </TabsContent>

                {/* DRUGS */}
                <TabsContent value="drugs">
                  <div className="space-y-4">
                    {a.drug_recommendations && a.drug_recommendations.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Pill className="h-5 w-5 text-primary" /> Drug Recommendations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {a.drug_recommendations.map((d, i) => (
                              <div key={i} className="p-3 rounded-lg border bg-card">
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="font-semibold">{d.drug}</h4>
                                  <Badge variant="outline" className="text-xs">Evidence: {d.evidence_level}</Badge>
                                </div>
                                <p className="text-sm"><strong>Dosage:</strong> {d.dosage} — {d.frequency}</p>
                                <p className="text-sm text-muted-foreground">{d.rationale}</p>
                                {d.interactions && <p className="text-xs mt-1 text-amber-600">⚠️ {d.interactions}</p>}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {a.drug_interactions && a.drug_interactions.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" /> Drug Interactions
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {a.drug_interactions.map((d, i) => (
                              <div key={i} className="p-3 rounded-lg border flex items-start gap-3">
                                <SeverityBadge severity={d.severity} />
                                <div>
                                  <p className="text-sm font-medium">{d.drugs.join(" + ")}</p>
                                  <p className="text-xs text-muted-foreground">{d.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                {/* RISK */}
                <TabsContent value="risk">
                  {a.risk_assessment && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Shield className="h-5 w-5 text-primary" /> Risk Assessment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center">
                          <p className="text-sm font-medium text-muted-foreground">{a.risk_assessment.primary_risk}</p>
                          <p className="text-3xl font-bold text-primary mt-1">{a.risk_assessment.risk_percentage}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-red-600 mb-2">Risk Factors</h4>
                            <ul className="text-sm space-y-1">
                              {a.risk_assessment.risk_factors?.map((r, i) => (
                                <li key={i} className="flex items-start gap-1"><XCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" /> {r}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-green-600 mb-2">Protective Factors</h4>
                            <ul className="text-sm space-y-1">
                              {a.risk_assessment.protective_factors?.map((p, i) => (
                                <li key={i} className="flex items-start gap-1"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 shrink-0" /> {p}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        {a.guidelines_referenced && a.guidelines_referenced.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-sm font-semibold mb-1">Guidelines Referenced</h4>
                            <div className="flex flex-wrap gap-1">
                              {a.guidelines_referenced.map((g, i) => (
                                <Badge key={i} variant="outline" className="text-xs">{g}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* EVIDENCE */}
                <TabsContent value="evidence">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" /> PubMed Evidence ({result.evidence.length} articles)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {a.citations && a.citations.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-semibold mb-2">Cited in Assessment</h4>
                            {a.citations.map((c, i) => (
                              <div key={i} className="p-2 rounded border bg-primary/5 mb-2">
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                                  PMID:{c.pmid} — {c.title}
                                </a>
                                <p className="text-xs text-muted-foreground mt-0.5">{c.relevance}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <h4 className="text-sm font-semibold">All Retrieved Articles</h4>
                        {result.evidence.map((e, i) => (
                          <div key={i} className="p-3 rounded-lg border">
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
                              PMID:{e.pmid} ({e.year})
                            </a>
                            <p className="text-sm mt-1">{e.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{e.abstract}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              <ReportShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                result={result}
                patientName={patientName}
              />
              </>
            )}
          </div>
        </div>
      </main>
      <OnboardingWalkthrough />
    </>
  );
}
