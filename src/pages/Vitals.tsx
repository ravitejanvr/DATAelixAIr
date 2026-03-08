import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, ChipGroup, PresetChipGroup } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { Activity, Save, Search, Zap } from "lucide-react";
import { EMPTY_VITALS, type VitalEntry } from "@/layers/workflow/api";

const TEMP_PRESETS = ["98.6", "99", "100", "101", "102", "103"];
const BP_SYS_PRESETS = ["110", "120", "130", "140", "150", "160"];
const BP_DIA_PRESETS = ["70", "80", "90", "100"];
const PULSE_PRESETS = ["60", "72", "80", "90", "100", "110"];
const SPO2_PRESETS = ["95", "96", "97", "98", "99"];

export default function Vitals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [vitals, setVitals] = useState<VitalEntry>(EMPTY_VITALS);
  const [saving, setSaving] = useState(false);
  const [recentVitals, setRecentVitals] = useState<any[]>([]);

  useEffect(() => { if (user) loadPatients(); }, [user]);

  const loadPatients = async () => {
    const { data } = await supabase.from("patients").select("id, name, age, gender, phone").order("created_at", { ascending: false });
    setPatients(data || []);
  };

  const selectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setVitals(EMPTY_VITALS);
    const { data } = await supabase.from("vitals").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(5);
    setRecentVitals(data || []);
  };

  const setNormalPresets = () => {
    setVitals({
      bp_systolic: "120", bp_diastolic: "80", pulse: "72", temperature: "98.6",
      spo2: "98", respiratory_rate: "16", weight_kg: "", height_cm: "", blood_sugar: "", notes: "",
    });
  };

  const saveVitals = async () => {
    if (!selectedPatient || !user) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("record-vitals", { body: { patient_id: selectedPatient.id, vitals } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const warningMsg = data?.warnings?.length ? ` (${data.warnings.length} range warning(s))` : "";
      toast({ title: "Vitals saved", description: `Recorded for ${selectedPatient.name}${warningMsg}` });
      setVitals(EMPTY_VITALS);
      selectPatient(selectedPatient);
    } catch (err: any) {
      toast({ title: "Error saving vitals", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const filtered = patients.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search));
  const updateVital = (field: keyof VitalEntry, value: string) => setVitals(prev => ({ ...prev, [field]: value }));

  return (
    <>
      <SEO title="Vitals — DATAelixAIr" description="Record patient vitals" />
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-1 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Vitals Station
        </h1>
        <p className="text-sm text-muted-foreground mb-6">Chip-based quick entry with normal presets</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Patient Search */}
          <ClinicalCard>
            <ClinicalCardHeader title="Select Patient" icon={<Search className="h-3.5 w-3.5" />} />
            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone" className="pl-9 h-9 rounded-lg" />
            </div>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {filtered.slice(0, 20).map(p => (
                <button key={p.id} onClick={() => selectPatient(p)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition-all ${selectedPatient?.id === p.id ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:bg-muted/50"}`}>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.age ? `${p.age}y` : ""} {p.gender || ""} {p.phone ? `· ${p.phone}` : ""}</p>
                </button>
              ))}
            </div>
          </ClinicalCard>

          {/* Vitals Entry */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              <ClinicalCard>
                <ClinicalCardHeader
                  title={`Vitals for ${selectedPatient.name}`}
                  icon={<Activity className="h-4 w-4" />}
                  action={
                    <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1.5" onClick={setNormalPresets}>
                      <Zap className="h-3 w-3" /> Normal Preset
                    </Button>
                  }
                />

                <div className="space-y-4">
                  {/* Temperature */}
                  <div>
                    <label className="text-[11px] text-muted-foreground font-semibold mb-1.5 block">Temperature (°F)</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {TEMP_PRESETS.map(t => (
                        <Chip key={t} variant={parseFloat(t) > 99 ? "alert" : "neutral"} size="sm"
                          selected={vitals.temperature === t} onClick={() => updateVital("temperature", t)}>
                          {t}°F
                        </Chip>
                      ))}
                    </div>
                    <Input value={vitals.temperature} onChange={e => updateVital("temperature", e.target.value)} placeholder="Custom" className="h-8 text-xs rounded-lg w-28" type="number" step="0.1" />
                  </div>

                  {/* BP */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold mb-1.5 block">BP Systolic</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {BP_SYS_PRESETS.map(v => (
                          <Chip key={v} variant={parseInt(v) >= 140 ? "alert" : "neutral"} size="sm"
                            selected={vitals.bp_systolic === v} onClick={() => updateVital("bp_systolic", v)}>
                            {v}
                          </Chip>
                        ))}
                      </div>
                      <Input value={vitals.bp_systolic} onChange={e => updateVital("bp_systolic", e.target.value)} placeholder="Custom" className="h-8 text-xs rounded-lg w-24" type="number" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold mb-1.5 block">BP Diastolic</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {BP_DIA_PRESETS.map(v => (
                          <Chip key={v} variant={parseInt(v) >= 90 ? "alert" : "neutral"} size="sm"
                            selected={vitals.bp_diastolic === v} onClick={() => updateVital("bp_diastolic", v)}>
                            {v}
                          </Chip>
                        ))}
                      </div>
                      <Input value={vitals.bp_diastolic} onChange={e => updateVital("bp_diastolic", e.target.value)} placeholder="Custom" className="h-8 text-xs rounded-lg w-24" type="number" />
                    </div>
                  </div>

                  {/* Pulse & SpO2 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold mb-1.5 block">Heart Rate (bpm)</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {PULSE_PRESETS.map(v => (
                          <Chip key={v} variant={parseInt(v) >= 100 ? "lab" : "neutral"} size="sm"
                            selected={vitals.pulse === v} onClick={() => updateVital("pulse", v)}>
                            {v}
                          </Chip>
                        ))}
                      </div>
                      <Input value={vitals.pulse} onChange={e => updateVital("pulse", e.target.value)} placeholder="Custom" className="h-8 text-xs rounded-lg w-24" type="number" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold mb-1.5 block">SpO₂ (%)</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {SPO2_PRESETS.map(v => (
                          <Chip key={v} variant={parseInt(v) < 95 ? "alert" : "neutral"} size="sm"
                            selected={vitals.spo2 === v} onClick={() => updateVital("spo2", v)}>
                            {v}%
                          </Chip>
                        ))}
                      </div>
                      <Input value={vitals.spo2} onChange={e => updateVital("spo2", e.target.value)} placeholder="Custom" className="h-8 text-xs rounded-lg w-24" type="number" />
                    </div>
                  </div>

                  {/* Other fields */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold">Resp. Rate</label>
                      <Input value={vitals.respiratory_rate} onChange={e => updateVital("respiratory_rate", e.target.value)} placeholder="16" className="h-8 text-xs rounded-lg mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold">Weight (kg)</label>
                      <Input value={vitals.weight_kg} onChange={e => updateVital("weight_kg", e.target.value)} placeholder="70" className="h-8 text-xs rounded-lg mt-1" type="number" step="0.1" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold">Height (cm)</label>
                      <Input value={vitals.height_cm} onChange={e => updateVital("height_cm", e.target.value)} placeholder="170" className="h-8 text-xs rounded-lg mt-1" type="number" />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground font-semibold">Glucose</label>
                      <Input value={vitals.blood_sugar} onChange={e => updateVital("blood_sugar", e.target.value)} placeholder="90" className="h-8 text-xs rounded-lg mt-1" type="number" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground font-semibold">Notes</label>
                    <Input value={vitals.notes} onChange={e => updateVital("notes", e.target.value)} placeholder="Any observations..." className="h-8 text-xs rounded-lg mt-1" />
                  </div>

                  <Button onClick={saveVitals} disabled={saving} className="w-full rounded-xl h-10">
                    <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Vitals"}
                  </Button>

                  {recentVitals.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Recent Vitals</p>
                      <div className="space-y-2">
                        {recentVitals.map((v: any) => (
                          <div key={v.id} className="text-[11px] p-2.5 rounded-lg bg-muted/30 flex flex-wrap gap-2">
                            <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
                            {v.bp_systolic && <Chip variant="neutral" size="sm">BP {v.bp_systolic}/{v.bp_diastolic}</Chip>}
                            {v.pulse && <Chip variant="neutral" size="sm">HR {v.pulse}</Chip>}
                            {v.temperature && <Chip variant={parseFloat(v.temperature) > 99 ? "alert" : "neutral"} size="sm">{v.temperature}°F</Chip>}
                            {v.spo2 && <Chip variant={parseInt(v.spo2) < 95 ? "alert" : "neutral"} size="sm">SpO₂ {v.spo2}%</Chip>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ClinicalCard>
            ) : (
              <ClinicalCard className="py-16 text-center">
                <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a patient to begin recording vitals</p>
              </ClinicalCard>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
