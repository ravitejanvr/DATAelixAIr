import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import {
  Pill, Plus, Printer, ArrowLeft, Trash2, Loader2,
  AlertTriangle, CheckCircle2, XCircle, AlertCircle, FileText, Star
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

export default function Prescriptions() {
  const { user } = useAuth();
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
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => { if (user) fetchData(); }, [user, consultationId, patientId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileRes, favRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("doctor_favorites").select("*").eq("doctor_id", user!.id).order("generic_name"),
      ]);
      setDoctorProfile(profileRes.data);
      setFavorites(favRes.data || []);

      if (patientId) {
        const { data } = await supabase.from("patients").select("*").eq("id", patientId).single();
        if (data) setPatient(data);
      }

      if (consultationId) {
        const [consultRes, rxRes] = await Promise.all([
          supabase.from("consultations").select("*, patients(*)").eq("id", consultationId).single(),
          supabase.from("prescriptions").select("*").eq("consultation_id", consultationId).order("created_at"),
        ]);
        if (consultRes.data) {
          setConsultation(consultRes.data);
          if (!patientId && consultRes.data.patients) setPatient(consultRes.data.patients);
          if ((rxRes.data || []).length > 0) {
            setExistingPrescriptions(rxRes.data || []);
          } else {
            const recs = (consultRes.data.drug_recommendations as any[]) || [];
            if (recs.length > 0) {
              setDrugs(recs.map(r => ({
                drug_name: r.drug || "", dosage: r.dosage || "", frequency: r.frequency || "",
                duration: "", route: "oral", instructions: r.rationale || "",
                severity: "safe", interactions: r.interactions || null,
              })));
            }
          }
        }
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const addDrug = () => setDrugs(prev => [...prev, { drug_name: "", dosage: "", frequency: "", duration: "", route: "oral", instructions: "", severity: "safe", interactions: null }]);
  const removeDrug = (idx: number) => setDrugs(prev => prev.filter((_, i) => i !== idx));
  const updateDrug = (idx: number, field: keyof DrugEntry, value: string) => setDrugs(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));

  const addFromFavorite = (fav: any) => {
    setDrugs(prev => [...prev, {
      drug_name: fav.generic_name + (fav.preferred_brand ? ` (${fav.preferred_brand})` : ""),
      dosage: fav.default_dose || "", frequency: fav.frequency || "",
      duration: fav.duration || "", route: fav.route || "oral",
      instructions: fav.instructions || "", severity: "safe", interactions: null,
    }]);
    toast({ title: "Added from favorites", description: fav.generic_name });
  };

  const savePrescriptions = async () => {
    if (!consultationId || !patient?.id || !user?.id) return;
    const valid = drugs.filter(d => d.drug_name.trim());
    if (valid.length === 0) { toast({ title: "No drugs to save", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const rows = valid.map(d => ({
        consultation_id: consultationId, patient_id: patient.id, doctor_id: user.id,
        drug_name: d.drug_name, dosage: d.dosage, frequency: d.frequency || null,
        duration: d.duration || null, route: d.route || "oral",
        instructions: d.instructions || null, severity: d.severity || "safe",
        interactions: d.interactions || [],
      }));
      const { error } = await supabase.from("prescriptions").insert(rows);
      if (error) throw error;
      toast({ title: "Prescriptions saved", description: `${valid.length} drugs saved` });
      setExistingPrescriptions([...existingPrescriptions, ...rows]);
      setDrugs([]);
    } catch (err: any) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Prescription</title><style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto}table{width:100%;border-collapse:collapse}td,th{padding:6px 8px;border:1px solid #ddd;text-align:left;font-size:13px}.total{font-weight:bold}</style></head><body>${printRef.current.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <>
      <SEO title="Prescriptions — DATAelixAIr" description="Prescription management" />
      <div className="p-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><Pill className="h-5 w-5 text-primary" /> Prescription</h2>
            {patient && <p className="text-sm text-muted-foreground mt-1">Patient: <span className="font-medium text-foreground">{patient.name}</span>{patient.age && ` • ${patient.age}y`}{patient.gender && ` • ${patient.gender}`}</p>}
          </div>
          {(existingPrescriptions.length > 0 || drugs.length > 0) && (
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          )}
        </div>

        {patient?.allergies?.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive"><strong>Known allergies:</strong> {patient.allergies.join(", ")}</p>
          </div>
        )}

        {favorites.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Your Common Prescriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {favorites.map(fav => (
                  <Button key={fav.id} variant="outline" size="sm" className="text-xs h-7" onClick={() => addFromFavorite(fav)}>
                    <Plus className="h-3 w-3 mr-1" /> {fav.generic_name}{fav.default_dose ? ` ${fav.default_dose}` : ""}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {existingPrescriptions.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Saved Prescriptions</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Drug</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Dosage</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Frequency</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Duration</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Route</th>
                  </tr></thead>
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

        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> {drugs.length > 0 ? "Edit Prescription" : "Add Drugs"}</CardTitle>
              <Button variant="outline" size="sm" onClick={addDrug}><Plus className="h-4 w-4 mr-1" /> Add Drug</Button>
            </div>
          </CardHeader>
          <CardContent>
            {drugs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Pill className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{consultationId ? "No drug recommendations found. Click 'Add Drug' to add manually." : "Select a consultation first."}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {drugs.map((drug, idx) => (
                  <div key={idx} className="p-4 rounded-lg border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Drug #{idx + 1}</span>
                      <Button variant="ghost" size="sm" onClick={() => removeDrug(idx)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div><Label className="text-xs">Drug Name *</Label><Input value={drug.drug_name} onChange={e => updateDrug(idx, "drug_name", e.target.value)} placeholder="Generic name" className="mt-1" /></div>
                      <div><Label className="text-xs">Dosage *</Label><Input value={drug.dosage} onChange={e => updateDrug(idx, "dosage", e.target.value)} placeholder="500mg" className="mt-1" /></div>
                      <div><Label className="text-xs">Frequency</Label><Input value={drug.frequency} onChange={e => updateDrug(idx, "frequency", e.target.value)} placeholder="twice daily" className="mt-1" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div><Label className="text-xs">Duration</Label><Input value={drug.duration} onChange={e => updateDrug(idx, "duration", e.target.value)} placeholder="5 days" className="mt-1" /></div>
                      <div><Label className="text-xs">Route</Label><Input value={drug.route} onChange={e => updateDrug(idx, "route", e.target.value)} placeholder="oral" className="mt-1" /></div>
                      <div><Label className="text-xs">Instructions</Label><Input value={drug.instructions} onChange={e => updateDrug(idx, "instructions", e.target.value)} placeholder="After food" className="mt-1" /></div>
                    </div>
                  </div>
                ))}
                <Button onClick={savePrescriptions} disabled={saving || !consultationId} className="w-full">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</> : `Save ${drugs.filter(d => d.drug_name.trim()).length} Prescriptions`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div ref={printRef} className="hidden">
          {patient && (
            <div>
              <h2>DATAelixAIr™ — Prescription</h2>
              <p>Doctor: {doctorProfile?.full_name || "—"}{doctorProfile?.specialization ? ` · ${doctorProfile.specialization}` : ""}</p>
              <p>Patient: {patient.name}{patient.age ? ` · ${patient.age}y` : ""}{patient.gender ? ` · ${patient.gender}` : ""}</p>
              <p>Date: {new Date().toLocaleDateString()}</p>
              {patient.allergies?.length > 0 && <p style={{ color: "red" }}>⚠️ Allergies: {patient.allergies.join(", ")}</p>}
              <table><thead><tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Route</th><th>Instructions</th></tr></thead>
                <tbody>
                  {[...existingPrescriptions, ...drugs].filter(d => d.drug_name?.trim()).map((d, i) => (
                    <tr key={i}><td>{d.drug_name}</td><td>{d.dosage}</td><td>{d.frequency || "—"}</td><td>{d.duration || "—"}</td><td>{d.route || "oral"}</td><td>{d.instructions || "—"}</td></tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: "10px", color: "#999", marginTop: "20px" }}>AI-assisted documentation. Clinician reviewed.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
