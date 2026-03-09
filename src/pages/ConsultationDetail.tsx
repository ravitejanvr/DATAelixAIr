import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  ArrowLeft, User, Pill, AlertTriangle, Stethoscope, Activity,
  Clock, LogOut, Loader2, Calendar, FileText, BookOpen,
  ExternalLink, Shield, Beaker, ChevronDown, ChevronUp, Edit, Save, X
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ConsultationFull {
  id: string;
  patient_id: string;
  chief_complaint: string | null;
  ai_summary: string | null;
  status: string | null;
  soap_subjective: string | null;
  soap_objective: string | null;
  soap_assessment: string | null;
  soap_plan: string | null;
  raw_transcript: string | null;
  risk_assessment: Json;
  drug_recommendations: Json;
  drug_interactions: Json;
  pubmed_citations: Json;
  tests_ordered: string[] | null;
  follow_up_date: string | null;
  billing_amount: number | null;
  created_at: string;
  updated_at: string;
  report_data: Json;
  safety_flags: Json;
  patients: { name: string; age: number | null; gender: string | null; allergies: string[] | null };
}

const statusColor: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  shared: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function ConsultationDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [consultation, setConsultation] = useState<ConsultationFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    soap: true, risk: true, drugs: true, interactions: true, citations: true, tests: true, transcript: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    chief_complaint: "",
    soap_subjective: "",
    soap_objective: "",
    soap_assessment: "",
    soap_plan: "",
    ai_summary: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchConsultation();
  }, [id]);

  const fetchConsultation = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("consultations")
      .select("*, patients(name, age, gender, allergies)")
      .eq("id", id!)
      .single();

    if (error) {
      toast({ title: "Consultation not found", description: error.message, variant: "destructive" });
      navigate("/dashboard");
      return;
    }
    setConsultation(data as unknown as ConsultationFull);
    setLoading(false);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const startEditing = () => {
    if (!consultation) return;
    setEditData({
      chief_complaint: consultation.chief_complaint || "",
      soap_subjective: consultation.soap_subjective || "",
      soap_objective: consultation.soap_objective || "",
      soap_assessment: consultation.soap_assessment || "",
      soap_plan: consultation.soap_plan || "",
      ai_summary: consultation.ai_summary || "",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!consultation) return;
    setSaving(true);
    const { error } = await supabase
      .from("consultations")
      .update({
        chief_complaint: editData.chief_complaint,
        soap_subjective: editData.soap_subjective,
        soap_objective: editData.soap_objective,
        soap_assessment: editData.soap_assessment,
        soap_plan: editData.soap_plan,
        ai_summary: editData.ai_summary,
      })
      .eq("id", consultation.id);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Draft updated", description: "Consultation changes saved." });
      setIsEditing(false);
      fetchConsultation();
    }
  };

  const handleFinalise = async () => {
    if (!consultation) return;
    const { error } = await supabase
      .from("consultations")
      .update({ status: "completed" })
      .eq("id", consultation.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Consultation finalised", description: "Status set to completed." });
      fetchConsultation();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!consultation) return null;

  const patient = consultation.patients;
  const reportData = consultation.report_data as any;
  const risk = consultation.risk_assessment as Record<string, any> | null;
  const drugs = (consultation.drug_recommendations || []) as Array<Record<string, any>>;
  const interactions = (consultation.drug_interactions || []) as Array<Record<string, any>>;
  const citations = (consultation.pubmed_citations || []) as Array<Record<string, any>>;
  const safetyFlags = (consultation.safety_flags || []) as Array<Record<string, any>>;

  const SectionHeader = ({ title, icon: Icon, sectionKey, badge }: { title: string; icon: any; sectionKey: string; badge?: string }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between py-2 group"
    >
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" /> {title}
        {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
      </h3>
      {expandedSections[sectionKey] ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <>
      <SEO title={`Consultation — ${patient?.name || "Detail"}`} description="Consultation detail with SOAP notes and citations" />

      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={brainLogo} alt="Logo" className="h-8" />
          <div>
            <h1 className="text-sm font-bold text-foreground">DATAelixAIr CDSS</h1>
            <p className="text-xs text-muted-foreground">Clinical Decision Support System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/clinical")}>
            <Stethoscope className="h-4 w-4 mr-1" /> Clinical Insights
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        {/* Top overview card */}
        <Card className="mb-6">
          <CardContent className="py-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{patient?.name || "Unknown"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {patient?.age && `${patient.age}y`}{patient?.gender && ` • ${patient.gender}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${statusColor[consultation.status || "draft"] || statusColor.draft}`}>
                  {consultation.status || "draft"}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {new Date(consultation.created_at).toLocaleString()}
                </div>
                {consultation.follow_up_date && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Follow-up: {new Date(consultation.follow_up_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Chief complaint */}
            {consultation.chief_complaint && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Chief Complaint</p>
                <p className="text-sm text-foreground">{consultation.chief_complaint}</p>
              </div>
            )}

            {/* AI Summary */}
            {consultation.ai_summary && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">AI Summary</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{consultation.ai_summary}</p>
              </div>
            )}

            {/* Allergies warning */}
            {patient?.allergies && patient.allergies.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-destructive mb-1">Known Allergies</p>
                  <div className="flex flex-wrap gap-1">
                    {patient.allergies.map((a, i) => (
                      <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(`/prescriptions?consultation=${consultation.id}&patient=${consultation.patient_id}`)}>
                <Pill className="h-4 w-4 mr-1" /> Generate Prescription
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${consultation.patient_id}`)}>
                <User className="h-4 w-4 mr-1" /> Patient Record
              </Button>
              {consultation.status === "draft" && !isEditing && (
                <Button size="sm" variant="outline" onClick={startEditing}>
                  <Edit className="h-4 w-4 mr-1" /> Edit Draft
                </Button>
              )}
              {consultation.status === "draft" && !isEditing && (
                <Button size="sm" variant="default" onClick={handleFinalise}>
                  Finalise Consultation
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Draft Editing Panel */}
        {isEditing && (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" /> Edit Draft Consultation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Chief Complaint</Label>
                <Textarea value={editData.chief_complaint} onChange={e => setEditData(d => ({ ...d, chief_complaint: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label className="text-xs">AI Summary</Label>
                <Textarea value={editData.ai_summary} onChange={e => setEditData(d => ({ ...d, ai_summary: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">SOAP — Subjective</Label>
                  <Textarea value={editData.soap_subjective} onChange={e => setEditData(d => ({ ...d, soap_subjective: e.target.value }))} rows={3} />
                </div>
                <div>
                  <Label className="text-xs">SOAP — Objective</Label>
                  <Textarea value={editData.soap_objective} onChange={e => setEditData(d => ({ ...d, soap_objective: e.target.value }))} rows={3} />
                </div>
                <div>
                  <Label className="text-xs">SOAP — Assessment</Label>
                  <Textarea value={editData.soap_assessment} onChange={e => setEditData(d => ({ ...d, soap_assessment: e.target.value }))} rows={3} />
                </div>
                <div>
                  <Label className="text-xs">SOAP — Plan</Label>
                  <Textarea value={editData.soap_plan} onChange={e => setEditData(d => ({ ...d, soap_plan: e.target.value }))} rows={3} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SOAP Notes */}
        {(consultation.soap_subjective || consultation.soap_objective || consultation.soap_assessment || consultation.soap_plan) && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="SOAP Notes" icon={FileText} sectionKey="soap" />
              {expandedSections.soap && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {[
                    { label: "Subjective", content: consultation.soap_subjective, color: "border-blue-300" },
                    { label: "Objective", content: consultation.soap_objective, color: "border-emerald-300" },
                    { label: "Assessment", content: consultation.soap_assessment, color: "border-amber-300" },
                    { label: "Plan", content: consultation.soap_plan, color: "border-purple-300" },
                  ].map((s) => s.content && (
                    <div key={s.label} className={`p-3 rounded-lg bg-muted/30 border-l-4 ${s.color}`}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{s.label}</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{s.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Risk Assessment */}
        {risk && Object.keys(risk).length > 0 && risk.primary_risk && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Risk Assessment" icon={Shield} sectionKey="risk" />
              {expandedSections.risk && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{risk.primary_risk}</span>
                    {risk.risk_percentage && (
                      <Badge variant="outline" className="text-xs">{risk.risk_percentage}</Badge>
                    )}
                  </div>
                  {risk.risk_factors && (risk.risk_factors as string[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-destructive mb-1">Risk Factors</p>
                      <ul className="list-disc list-inside text-sm text-foreground space-y-0.5">
                        {(risk.risk_factors as string[]).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                  {risk.protective_factors && (risk.protective_factors as string[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-primary mb-1">Protective Factors</p>
                      <ul className="list-disc list-inside text-sm text-foreground space-y-0.5">
                        {(risk.protective_factors as string[]).map((f: string, i: number) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Drug Recommendations */}
        {drugs.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Drug Recommendations" icon={Pill} sectionKey="drugs" badge={`${drugs.length}`} />
              {expandedSections.drugs && (
                <div className="mt-3 space-y-3">
                  {drugs.map((drug, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-semibold text-foreground">{drug.drug || drug.drug_name}</span>
                        {drug.evidence_level && (
                          <Badge variant="outline" className="text-[10px]">{drug.evidence_level}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                        {drug.dosage && <span><strong>Dose:</strong> {drug.dosage}</span>}
                        {drug.frequency && <span><strong>Freq:</strong> {drug.frequency}</span>}
                        {drug.route && <span><strong>Route:</strong> {drug.route}</span>}
                      </div>
                      {drug.rationale && (
                        <p className="text-xs text-muted-foreground mt-2 italic">{drug.rationale}</p>
                      )}
                      {drug.interactions && (
                        <p className="text-xs text-destructive mt-1">⚠ {drug.interactions}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Drug Interactions */}
        {interactions.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Drug Interactions" icon={AlertTriangle} sectionKey="interactions" badge={`${interactions.length}`} />
              {expandedSections.interactions && (
                <div className="mt-3 space-y-2">
                  {interactions.map((ix, i) => (
                    <div key={i} className={`p-3 rounded-lg border ${
                      ix.severity === "high" ? "border-destructive/30 bg-destructive/5" :
                      ix.severity === "moderate" ? "border-amber-300 bg-amber-50" :
                      "border-border bg-muted/20"
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={ix.severity === "high" ? "destructive" : "outline"} className="text-[10px]">
                          {ix.severity || "unknown"}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">
                          {Array.isArray(ix.drugs) ? ix.drugs.join(" ↔ ") : "Drug interaction"}
                        </span>
                      </div>
                      {ix.description && <p className="text-xs text-muted-foreground">{ix.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PubMed Citations */}
        {citations.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="PubMed Citations" icon={BookOpen} sectionKey="citations" badge={`${citations.length}`} />
              {expandedSections.citations && (
                <div className="mt-3 space-y-2">
                  {citations.map((c, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.title}</p>
                          {c.relevance && <p className="text-xs text-muted-foreground mt-1">{c.relevance}</p>}
                        </div>
                        {(c.url || c.pmid) && (
                          <a
                            href={c.url || `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0"
                          >
                            <Badge variant="outline" className="text-[10px] cursor-pointer hover:bg-primary/10">
                              <ExternalLink className="h-2.5 w-2.5 mr-0.5" /> PMID {c.pmid}
                            </Badge>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tests Recommended */}
        {consultation.tests_ordered && consultation.tests_ordered.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Tests Recommended" icon={Beaker} sectionKey="tests" badge={`${consultation.tests_ordered.length}`} />
              {expandedSections.tests && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {consultation.tests_ordered.map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Raw Transcript */}
        {consultation.raw_transcript && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Raw Transcript" icon={FileText} sectionKey="transcript" />
              {expandedSections.transcript && (
                <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border max-h-60 overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap font-mono">{consultation.raw_transcript}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
