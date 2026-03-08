import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Activity, Save, Search } from "lucide-react";
import { EMPTY_VITALS, type VitalEntry } from "@/layers/workflow/api";

export default function Vitals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [vitals, setVitals] = useState<VitalEntry>(EMPTY_VITALS);
  const [saving, setSaving] = useState(false);
  const [recentVitals, setRecentVitals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadPatients();
  }, [user]);

  const loadPatients = async () => {
    const { data } = await supabase.from("patients").select("id, name, age, gender, phone").order("created_at", { ascending: false });
    setPatients(data || []);
  };

  const selectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setVitals(EMPTY_VITALS);
    const { data } = await supabase
      .from("vitals")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentVitals(data || []);
  };

  const saveVitals = async () => {
    if (!selectedPatient || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-vitals", {
        body: { patient_id: selectedPatient.id, vitals },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const warningMsg = data?.warnings?.length ? ` (${data.warnings.length} range warning(s))` : "";
      toast({ title: "Vitals saved", description: `Vitals recorded for ${selectedPatient.name}${warningMsg}` });
      setVitals(EMPTY_VITALS);
      selectPatient(selectedPatient);
    } catch (err: any) {
      toast({ title: "Error saving vitals", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone?.includes(search)
  );

  const updateVital = (field: keyof VitalEntry, value: string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <SEO title="Vitals — DATAelixAIr" description="Record and manage patient vitals." />
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Vitals Station
        </h1>
        <p className="text-sm text-muted-foreground mb-6">Record vitals for walk-in patients. Auto-saved and visible to doctors instantly.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Select Patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone"
                  className="pl-9 h-9"
                />
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {filtered.slice(0, 20).map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                      selectedPatient?.id === p.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.age ? `${p.age}y` : ""} {p.gender || ""} {p.phone ? `· ${p.phone}` : ""}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vitals Grid */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    Recording vitals for <span className="text-primary">{selectedPatient.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">BP Systolic</label>
                      <Input value={vitals.bp_systolic} onChange={e => updateVital("bp_systolic", e.target.value)} placeholder="120" className="h-9 mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">BP Diastolic</label>
                      <Input value={vitals.bp_diastolic} onChange={e => updateVital("bp_diastolic", e.target.value)} placeholder="80" className="h-9 mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Heart Rate (bpm)</label>
                      <Input value={vitals.pulse} onChange={e => updateVital("pulse", e.target.value)} placeholder="72" className="h-9 mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Temp (°F)</label>
                      <Input value={vitals.temperature} onChange={e => updateVital("temperature", e.target.value)} placeholder="98.6" className="h-9 mt-1" type="number" step="0.1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">SpO2 (%)</label>
                      <Input value={vitals.spo2} onChange={e => updateVital("spo2", e.target.value)} placeholder="98" className="h-9 mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Resp. Rate (/min)</label>
                      <Input value={vitals.respiratory_rate} onChange={e => updateVital("respiratory_rate", e.target.value)} placeholder="16" className="h-9 mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Weight (kg)</label>
                      <Input value={vitals.weight_kg} onChange={e => updateVital("weight_kg", e.target.value)} placeholder="70" className="h-9 mt-1" type="number" step="0.1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Height (cm)</label>
                      <Input value={vitals.height_cm} onChange={e => updateVital("height_cm", e.target.value)} placeholder="170" className="h-9 mt-1" type="number" step="0.1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Glucose (mg/dL)</label>
                      <Input value={vitals.blood_sugar} onChange={e => updateVital("blood_sugar", e.target.value)} placeholder="90" className="h-9 mt-1" type="number" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium">Notes</label>
                    <Input value={vitals.notes} onChange={e => updateVital("notes", e.target.value)} placeholder="Any observations..." className="h-9 mt-1" />
                  </div>
                  <Button onClick={saveVitals} disabled={saving} className="w-full">
                    <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Vitals"}
                  </Button>

                  {recentVitals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recent Vitals</p>
                      <div className="space-y-2">
                        {recentVitals.map((v: any) => (
                          <div key={v.id} className="text-[11px] p-2 rounded bg-muted/30 flex flex-wrap gap-3">
                            <span>{new Date(v.created_at).toLocaleString()}</span>
                            {v.bp_systolic && <span>BP: {v.bp_systolic}/{v.bp_diastolic}</span>}
                            {v.pulse && <span>HR: {v.pulse}</span>}
                            {v.temperature && <span>Temp: {v.temperature}°F</span>}
                            {v.spo2 && <span>SpO2: {v.spo2}%</span>}
                            {v.respiratory_rate && <span>RR: {v.respiratory_rate}</span>}
                            {v.weight_kg && <span>Wt: {v.weight_kg}kg</span>}
                            {v.height_cm && <span>Ht: {v.height_cm}cm</span>}
                            {v.blood_sugar && <span>Glucose: {v.blood_sugar}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Select a patient to begin recording vitals</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
