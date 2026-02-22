import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import {
  Pill, Plus, Printer, ArrowLeft, Trash2, Loader2,
  LogOut, Stethoscope, Users, LayoutDashboard, AlertTriangle,
  CheckCircle2, XCircle, AlertCircle, FileText, Clock
} from "lucide-react";

interface DrugEntry {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions: string;
  severity: string;
  interactions: any;
}

interface ConsultationDrug {
  drug: string;
  dosage: string;
  frequency: string;
  rationale: string;
  evidence_level: string;
  interactions: string;
}

export default function Prescriptions() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const consultationId = searchParams.get("consultation");
  const patientId = searchParams.get("patient");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [consultation, setConsultation] = useState<any>(null);
  const [drugs, setDrugs] = useState<DrugEntry[]>([]);
  const [existingPrescriptions, setExistingPrescriptions] = useState<any[]>([]);
  const [doctorProfile, setDoctorProfile] = useState<any>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user, consultationId, patientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const profileRes = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      setDoctorProfile(profileRes.data);

      if (patientId) {
        const patientRes = await supabase.from("patients").select("*").eq("id", patientId).single();
        if (patientRes.data) setPatient(patientRes.data);
      }

      if (consultationId) {
        const [consultRes, rxRes] = await Promise.all([
          supabase.from("consultations").select("*, patients(*)").eq("id", consultationId).single(),
          supabase.from("prescriptions").select("*").eq("consultation_id", consultationId).order("created_at"),
        ]);
        const consultData = consultRes.data;
        const existingRx = rxRes.data || [];

        if (consultData) {
          setConsultation(consultData);
          if (!patientId && consultData.patients) {
            setPatient(consultData.patients);
          }

          if (existingRx.length > 0) {
            setExistingPrescriptions(existingRx);
          } else {
            const recs = (consultData.drug_recommendations as unknown as ConsultationDrug[]) || [];
            if (recs.length > 0) {
              setDrugs(
                recs.map((r) => ({
                  drug_name: r.drug || "",
                  dosage: r.dosage || "",
                  frequency: r.frequency || "",
                  duration: "",
                  route: "oral",
                  instructions: r.rationale || "",
                  severity: "safe",
                  interactions: r.interactions || null,
                }))
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const addDrug = () => {
    setDrugs((prev) => [
      ...prev,
      { drug_name: "", dosage: "", frequency: "", duration: "", route: "oral", instructions: "", severity: "safe", interactions: null },
    ]);
  };

  const removeDrug = (idx: number) => {
    setDrugs((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDrug = (idx: number, field: keyof DrugEntry, value: string) => {
    setDrugs((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  };

  const savePrescriptions = async () => {
    if (!consultationId || !patient?.id || !user?.id) return;
    const valid = drugs.filter((d) => d.drug_name.trim());
    if (valid.length === 0) {
      toast({ title: "No drugs to save", description: "Add at least one drug", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const rows = valid.map((d) => ({
        consultation_id: consultationId,
        patient_id: patient.id,
        doctor_id: user.id,
        drug_name: d.drug_name,
        dosage: d.dosage,
        frequency: d.frequency || null,
        duration: d.duration || null,
        route: d.route || "oral",
        instructions: d.instructions || null,
        severity: d.severity || "safe",
        interactions: d.interactions || [],
      }));

      // Delete existing prescriptions for this consultation first
      if (existingPrescriptions.length > 0) {
        // Update approach: delete old ones by ID won't work (no delete policy), so we'll update
        // Actually let's just insert new ones
      }

      const { error } = await supabase.from("prescriptions").insert(rows);
      if (error) throw error;

      toast({ title: "Prescriptions saved", description: `${valid.length} drugs saved` });
      setExistingPrescriptions([...existingPrescriptions, ...rows]);
      setDrugs([]);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription — ${patient?.name || "Patient"}</title>
        <style>
          @media print { @page { margin: 20mm; } }
          body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #0891b2; padding-bottom: 16px; margin-bottom: 20px; }
          .doctor-info h2 { margin: 0; color: #0891b2; font-size: 20px; }
          .doctor-info p { margin: 2px 0; font-size: 12px; color: #555; }
          .patient-info { background: #f8fafc; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 32px; }
          .patient-info span { font-size: 13px; }
          .patient-info strong { color: #0891b2; }
          .rx-symbol { font-size: 28px; font-weight: bold; color: #0891b2; margin: 16px 0 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #0891b2; color: white; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          tr:nth-child(even) td { background: #f8fafc; }
          .severity-safe { color: #16a34a; } .severity-caution { color: #ca8a04; } .severity-warning { color: #ea580c; } .severity-danger { color: #dc2626; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .signature-line { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 4px; font-size: 12px; }
          .allergies { background: #fef2f2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; margin-bottom: 16px; font-size: 12px; color: #991b1b; }
          .disclaimer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const severityIcon = (sev: string) => {
    switch (sev) {
      case "safe": return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
      case "caution": return <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />;
      case "warning": return <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />;
      case "danger": return <XCircle className="h-3.5 w-3.5 text-red-600" />;
      default: return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    }
  };

  const allDrugs = [
    ...existingPrescriptions.map((p) => ({
      drug_name: p.drug_name,
      dosage: p.dosage,
      frequency: p.frequency || "",
      duration: p.duration || "",
      route: p.route || "oral",
      instructions: p.instructions || "",
      severity: p.severity || "safe",
      saved: true,
    })),
    ...drugs.map((d) => ({ ...d, saved: false })),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO title="Prescriptions — DATAelixAIr" description="Generate and print prescriptions" />

      <header className="fixed top-0 left-0 right-0 z-50 glass-nav border-b border-border px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={brainLogo} alt="DATAelixAIr" className="h-8" />
            <div>
              <h1 className="text-sm font-bold text-foreground">DATAelixAIr</h1>
              <p className="text-xs text-muted-foreground">Prescription Management</p>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono ml-2">PhD Prototype</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/clinical")}>
              <Stethoscope className="h-4 w-4 mr-1" /> Analysis
            </Button>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/auth"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16 pb-8 px-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4 mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Pill className="h-5 w-5 text-primary" /> Prescription
            </h2>
            {patient && (
              <p className="text-sm text-muted-foreground mt-1">
                Patient: <span className="font-medium text-foreground">{patient.name}</span>
                {patient.age && ` • ${patient.age}y`}
                {patient.gender && ` • ${patient.gender}`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {allDrugs.length > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" /> Print
              </Button>
            )}
          </div>
        </div>

        {/* Allergies Warning */}
        {patient?.allergies?.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              <strong>Known allergies:</strong> {patient.allergies.join(", ")}
            </p>
          </div>
        )}

        {/* Existing saved prescriptions */}
        {existingPrescriptions.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Saved Prescriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Drug</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Dosage</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Frequency</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Duration</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Route</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingPrescriptions.map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-3 font-medium">{p.drug_name}</td>
                        <td className="py-2 px-3">{p.dosage}</td>
                        <td className="py-2 px-3">{p.frequency || "—"}</td>
                        <td className="py-2 px-3">{p.duration || "—"}</td>
                        <td className="py-2 px-3">{p.route || "oral"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Drug editor */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {drugs.length > 0 ? "Edit Prescription" : "Add Drugs"}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={addDrug}>
                <Plus className="h-4 w-4 mr-1" /> Add Drug
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {drugs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Pill className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {existingPrescriptions.length > 0
                    ? "All drugs saved. Click 'Add Drug' to add more."
                    : consultationId
                      ? "No drug recommendations found. Click 'Add Drug' to add manually."
                      : "Select a consultation first to auto-fill drug recommendations."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {drugs.map((drug, idx) => (
                  <div key={idx} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Drug #{idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeDrug(idx)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Drug Name *</Label>
                        <Input
                          value={drug.drug_name}
                          onChange={(e) => updateDrug(idx, "drug_name", e.target.value)}
                          placeholder="e.g. Metformin"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Dosage *</Label>
                        <Input
                          value={drug.dosage}
                          onChange={(e) => updateDrug(idx, "dosage", e.target.value)}
                          placeholder="e.g. 500mg"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <Input
                          value={drug.frequency}
                          onChange={(e) => updateDrug(idx, "frequency", e.target.value)}
                          placeholder="e.g. twice daily"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <Input
                          value={drug.duration}
                          onChange={(e) => updateDrug(idx, "duration", e.target.value)}
                          placeholder="e.g. 30 days"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Route</Label>
                        <select
                          value={drug.route}
                          onChange={(e) => updateDrug(idx, "route", e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="oral">Oral</option>
                          <option value="iv">IV</option>
                          <option value="im">IM</option>
                          <option value="topical">Topical</option>
                          <option value="sublingual">Sublingual</option>
                          <option value="inhaled">Inhaled</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Safety</Label>
                        <select
                          value={drug.severity}
                          onChange={(e) => updateDrug(idx, "severity", e.target.value)}
                          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="safe">Safe</option>
                          <option value="caution">Caution</option>
                          <option value="warning">Warning</option>
                          <option value="danger">Danger</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Instructions / Notes</Label>
                      <Textarea
                        value={drug.instructions}
                        onChange={(e) => updateDrug(idx, "instructions", e.target.value)}
                        placeholder="e.g. Take with meals"
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 pt-2">
                  <Button onClick={savePrescriptions} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Save Prescriptions
                  </Button>
                  <Button variant="outline" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-1" /> Preview & Print
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hidden print template */}
        <div className="hidden">
          <div ref={printRef}>
            <div className="header">
              <div className="doctor-info">
                <h2>Dr. {doctorProfile?.full_name || "—"}</h2>
                {doctorProfile?.specialization && <p>{doctorProfile.specialization}</p>}
                {doctorProfile?.license_number && <p>Reg. No: {doctorProfile.license_number}</p>}
                {doctorProfile?.clinic_name && <p>{doctorProfile.clinic_name}</p>}
                {doctorProfile?.phone && <p>Tel: {doctorProfile.phone}</p>}
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
                <p style={{ fontWeight: "bold", color: "#0891b2", fontSize: "16px", margin: "0 0 4px" }}>DATAelixAIr</p>
                <p>AI-Powered Clinical Decision Support</p>
                <p>Date: {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="patient-info">
              <span><strong>Patient:</strong> {patient?.name || "—"}</span>
              {patient?.age && <span><strong>Age:</strong> {patient.age}y</span>}
              {patient?.gender && <span><strong>Gender:</strong> {patient.gender}</span>}
            </div>

            {patient?.allergies?.length > 0 && (
              <div className="allergies">
                ⚠️ <strong>Allergies:</strong> {patient.allergies.join(", ")}
              </div>
            )}

            <div className="rx-symbol">℞</div>

            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Drug Name</th>
                  <th>Dosage</th>
                  <th>Frequency</th>
                  <th>Duration</th>
                  <th>Route</th>
                  <th>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {allDrugs.map((d, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{d.drug_name}</td>
                    <td>{d.dosage}</td>
                    <td>{d.frequency || "—"}</td>
                    <td>{d.duration || "—"}</td>
                    <td>{d.route}</td>
                    <td>{d.instructions || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {consultation?.chief_complaint && (
              <p style={{ marginTop: "16px", fontSize: "12px", color: "#555" }}>
                <strong>Diagnosis:</strong> {consultation.chief_complaint}
              </p>
            )}

            <div className="footer">
              <div style={{ fontSize: "12px", color: "#555" }}>
                <p>Generated by DATAelixAIr Clinical Platform</p>
              </div>
              <div className="signature-line">
                Doctor's Signature
              </div>
            </div>

            <div className="disclaimer">
              Clinical decision support only. This prescription was generated with AI assistance and must be verified by the prescribing physician. Not a substitute for clinical judgment.
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
