import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  ArrowLeft, User, Pill, AlertTriangle, Stethoscope,
  Clock, Loader2, Calendar, FileText, BookOpen,
  ExternalLink, Shield, Beaker, ChevronDown, ChevronUp, Edit, Save, X,
  IndianRupee, Send, Download
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ConsultationFull {
  id: string;
  patient_id: string;
  visit_id: string | null;
  clinic_id: string | null;
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
  extracted_data: Json;
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [consultation, setConsultation] = useState<ConsultationFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    soap: true, risk: true, drugs: true, interactions: true, citations: true, tests: true,
    prescriptions: true, invoice: true, transcript: false,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    chief_complaint: "", soap_subjective: "", soap_objective: "",
    soap_assessment: "", soap_plan: "", ai_summary: "",
  });
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any>(null);
  const [sendingReport, setSendingReport] = useState(false);

  useEffect(() => { if (id) fetchConsultation(); }, [id]);

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
    const c = data as unknown as ConsultationFull;
    setConsultation(c);

    // Load related data in parallel
    const [rxRes, invRes] = await Promise.all([
      supabase.from("prescriptions").select("*").eq("consultation_id", id!),
      supabase.from("invoices").select("*").eq("consultation_id", id!).maybeSingle(),
    ]);
    setPrescriptions(rxRes.data || []);
    setInvoice(invRes.data);
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
    setFinalizing(true);
    try {
      // 1. Update visit status via finalize-visit if visit exists
      if (consultation.visit_id) {
        const { data: visitData, error: visitError } = await supabase.functions.invoke("finalize-visit", {
          body: {
            visit_id: consultation.visit_id,
            consultation_id: consultation.id,
            clinic_id: consultation.clinic_id,
            target_status: "consultation_complete",
            billing_enabled: true,
          },
        });
        if (visitError) throw new Error(visitError.message);
        if (visitData?.error) throw new Error(visitData.error);
      }

      // 2. Generate patient report
      const { data: reportData, error: reportError } = await supabase.functions.invoke("generate-patient-report", {
        body: {
          consultation_id: consultation.id,
          visit_id: consultation.visit_id,
        },
      });
      if (reportError) throw new Error(reportError.message);

      // 3. Store report_data and set completed
      await supabase.from("consultations").update({
        status: "completed",
        report_data: reportData?.report || {},
      }).eq("id", consultation.id);

      // 4. Generate invoice if not already present
      if (!invoice) {
        await supabase.functions.invoke("generate-invoice", {
          body: {
            patient_id: consultation.patient_id,
            consultation_id: consultation.id,
            visit_id: consultation.visit_id,
            clinic_id: consultation.clinic_id,
          },
        });
      }

      toast({ title: "Consultation finalised", description: "Report generated, visit updated, invoice created." });
      fetchConsultation();
    } catch (err: any) {
      toast({ title: "Finalisation failed", description: err.message, variant: "destructive" });
    } finally {
      setFinalizing(false);
    }
  };

  const handleSendReport = async () => {
    if (!consultation) return;
    setSendingReport(true);
    try {
      const { error } = await supabase.functions.invoke("send-report", {
        body: {
          consultation_id: consultation.id,
          patient_id: consultation.patient_id,
          clinic_id: consultation.clinic_id,
        },
      });
      if (error) throw new Error(error.message);
      toast({ title: "Report sent", description: "Patient will receive the report via SMS/WhatsApp." });
    } catch (err: any) {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingReport(false);
    }
  };

  const handleMarkPaid = async (mode: string) => {
    if (!invoice) return;
    const { error } = await supabase.from("invoices")
      .update({ status: "paid", payment_mode: mode })
      .eq("id", invoice.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Payment recorded", description: `Paid via ${mode}` });
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

  const hasClinicalContent = consultation.soap_subjective || consultation.soap_objective ||
    consultation.soap_assessment || consultation.soap_plan || consultation.ai_summary ||
    reportData?.consultation;
  const isDraft = consultation.status === "draft";

  const SectionHeader = ({ title, icon: Icon, sectionKey, badge }: { title: string; icon: any; sectionKey: string; badge?: string }) => (
    <button onClick={() => toggleSection(sectionKey)} className="w-full flex items-center justify-between py-2 group">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" /> {title}
        {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
      </h3>
      {expandedSections[sectionKey] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
    </button>
  );

  return (
    <>
      <SEO title={`Consultation — ${patient?.name || "Detail"}`} description="Consultation detail" />

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

            {consultation.chief_complaint && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Chief Complaint</p>
                <p className="text-sm text-foreground">{consultation.chief_complaint}</p>
              </div>
            )}

            {(consultation.ai_summary || reportData?.consultation?.visit_summary || reportData?.soap_notes?.subjective) && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Consultation Summary</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {reportData?.soap_notes?.subjective || reportData?.consultation?.visit_summary || consultation.ai_summary}
                </p>
              </div>
            )}

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

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/patients/${consultation.patient_id}`)}>
                <User className="h-4 w-4 mr-1" /> Patient Record
              </Button>
              {isDraft && !isEditing && (
                <>
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Edit className="h-4 w-4 mr-1" /> Edit Draft
                  </Button>
                  <Button size="sm" onClick={handleFinalise} disabled={finalizing}>
                    {finalizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Stethoscope className="h-4 w-4 mr-1" />}
                    Finalise & Generate Report
                  </Button>
                </>
              )}
              {consultation.status === "completed" && (
                <>
                  <Button size="sm" variant="outline" onClick={handleSendReport} disabled={sendingReport}>
                    {sendingReport ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Send Report to Patient
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Empty state guidance for drafts with no AI content */}
        {isDraft && !hasClinicalContent && !isEditing && (
          <Card className="mb-6 border-dashed border-2 border-primary/20">
            <CardContent className="py-10 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No consultation report generated yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                This consultation is still in draft. Click "Finalise & Generate Report" to run the AI pipeline, generate prescriptions, create an invoice, and produce the patient report.
              </p>
              <Button size="sm" className="mt-4" onClick={handleFinalise} disabled={finalizing}>
                {finalizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Stethoscope className="h-4 w-4 mr-1" />}
                Finalise Consultation
              </Button>
            </CardContent>
          </Card>
        )}

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

        {/* Clinical Summary Sections */}
        {hasClinicalContent && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Clinical Summary" icon={FileText} sectionKey="soap" />
              {expandedSections.soap && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  {[
                    { label: "Visit Summary", content: reportData?.consultation?.visit_summary || consultation.soap_subjective, color: "border-blue-300" },
                    { label: "Findings", content: reportData?.consultation?.findings || consultation.soap_objective, color: "border-emerald-300" },
                    { label: "Provisional Diagnosis", content: reportData?.consultation?.diagnosis || consultation.soap_assessment, color: "border-amber-300" },
                    { label: "Treatment Plan", content: reportData?.consultation?.treatment_plan || consultation.soap_plan, color: "border-purple-300" },
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

        {/* Safety Warnings */}
        {safetyFlags && safetyFlags.length > 0 && (
          <Card className="mb-4 border-destructive/30">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="text-sm font-semibold text-destructive">Safety Warnings</h3>
              </div>
              <div className="space-y-2">
                {safetyFlags.map((flag: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-sm text-foreground font-medium">{flag.severity}: {flag.message}</p>
                    {flag.recommendation && <p className="text-xs text-muted-foreground mt-1">{flag.recommendation}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Prescriptions */}
        {prescriptions.length > 0 && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Prescriptions" icon={Pill} sectionKey="prescriptions" badge={`${prescriptions.length}`} />
              {expandedSections.prescriptions && (
                <div className="mt-3 space-y-2">
                  {prescriptions.map((rx: any) => (
                    <div key={rx.id} className="p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-sm font-semibold text-foreground">{rx.drug_name}</span>
                        {rx.severity && rx.severity !== "safe" && (
                          <Badge variant="destructive" className="text-[10px]">{rx.severity}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground mt-1">
                        {rx.dosage && <span><strong>Dose:</strong> {rx.dosage}</span>}
                        {rx.frequency && <span><strong>Freq:</strong> {rx.frequency}</span>}
                        {rx.duration && <span><strong>Duration:</strong> {rx.duration}</span>}
                        {rx.route && <span><strong>Route:</strong> {rx.route}</span>}
                      </div>
                      {rx.instructions && <p className="text-xs text-muted-foreground mt-1 italic">{rx.instructions}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice */}
        {invoice && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <SectionHeader title="Invoice" icon={IndianRupee} sectionKey="invoice" />
              {expandedSections.invoice && (
                <div className="mt-3">
                  <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{invoice.invoice_number || "Invoice"}</span>
                      <Badge variant={invoice.status === "paid" ? "default" : "secondary"} className="text-xs">
                        {invoice.status || "pending"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Consultation Fee</p>
                        <p className="font-medium">₹{invoice.consultation_fee || 0}</p>
                      </div>
                      {invoice.discount > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Discount</p>
                          <p className="font-medium text-destructive">-₹{invoice.discount}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-lg font-bold text-primary">₹{invoice.total || 0}</span>
                    </div>
                    {invoice.status === "pending" && (
                      <div className="flex gap-2 pt-2">
                        <p className="text-xs text-muted-foreground self-center mr-2">Collect Payment:</p>
                        {["cash", "upi", "card"].map(mode => (
                          <Button key={mode} size="sm" variant="outline" className="text-xs capitalize" onClick={() => handleMarkPaid(mode)}>
                            {mode}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Follow-up */}
        {(consultation.follow_up_date || reportData?.consultation?.follow_up_date) && (
          <Card className="mb-4">
            <CardContent className="py-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Follow-up</p>
                  <p className="text-sm text-foreground">
                    {new Date(reportData?.consultation?.follow_up_date || consultation.follow_up_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
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
                    {risk.risk_percentage && <Badge variant="outline" className="text-xs">{risk.risk_percentage}</Badge>}
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
                        {drug.evidence_level && <Badge variant="outline" className="text-[10px]">{drug.evidence_level}</Badge>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                        {drug.dosage && <span><strong>Dose:</strong> {drug.dosage}</span>}
                        {drug.frequency && <span><strong>Freq:</strong> {drug.frequency}</span>}
                        {drug.route && <span><strong>Route:</strong> {drug.route}</span>}
                      </div>
                      {drug.rationale && <p className="text-xs text-muted-foreground mt-2 italic">{drug.rationale}</p>}
                      {drug.interactions && <p className="text-xs text-destructive mt-1">⚠ {drug.interactions}</p>}
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
                          <a href={c.url || `https://pubmed.ncbi.nlm.nih.gov/${c.pmid}`} target="_blank" rel="noopener noreferrer" className="shrink-0">
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

        {/* Raw Transcript — collapsed by default */}
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
