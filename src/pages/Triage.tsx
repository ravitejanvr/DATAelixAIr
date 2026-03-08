import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, ChipGroup, PresetChipGroup } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { ClipboardCheck, Search, Save, AlertTriangle } from "lucide-react";
import {
  EMPTY_TRIAGE, PREGNANCY_OPTIONS, PRIORITY_OPTIONS,
  type TriageEntry,
} from "@/layers/workflow/api";

const COMMON_COMPLAINTS = ["Fever", "Cough", "Cold", "Headache", "Body ache", "Stomach pain", "Vomiting", "Diarrhea", "Chest pain", "Breathlessness"];
const DURATION_OPTIONS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks"];
const PAIN_CHIPS = [
  { value: "0", label: "0 None" }, { value: "3", label: "3 Mild" },
  { value: "5", label: "5 Moderate" }, { value: "7", label: "7 Severe" },
  { value: "10", label: "10 Worst" },
];

export default function Triage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [triage, setTriage] = useState<TriageEntry>(EMPTY_TRIAGE);
  const [saving, setSaving] = useState(false);
  const [recentTriage, setRecentTriage] = useState<any[]>([]);
  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState("");

  useEffect(() => { if (user) loadPatients(); }, [user]);

  const loadPatients = async () => {
    const { data } = await supabase.from("patients").select("id, name, age, gender, phone").order("created_at", { ascending: false });
    setPatients(data || []);
  };

  const selectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setTriage(EMPTY_TRIAGE);
    setSelectedComplaints([]);
    setSelectedDuration("");
    const { data: visits } = await supabase.from("patient_visits").select("*").eq("patient_id", patient.id).neq("status", "complete").order("check_in_time", { ascending: false }).limit(1);
    setActiveVisit(visits?.[0] || null);
    const { data: triageData } = await supabase.from("triage").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(5);
    setRecentTriage(triageData || []);
  };

  const saveTriage = async () => {
    if (!selectedPatient || !user || !activeVisit) return;
    const chiefComplaint = selectedComplaints.join(", ") || triage.chief_complaint;
    if (!chiefComplaint.trim()) { toast({ title: "Chief complaint required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle();
      const { error } = await supabase.from("triage").insert({
        visit_id: activeVisit.id, patient_id: selectedPatient.id,
        clinic_id: profile?.clinic_id || activeVisit.clinic_id, recorded_by: user.id,
        chief_complaint: chiefComplaint.trim(),
        symptom_duration: selectedDuration || triage.symptom_duration || null,
        pain_score: triage.pain_score ? parseInt(triage.pain_score) : null,
        allergies_noted: triage.allergies_noted || null,
        pregnancy_status: triage.pregnancy_status, priority: triage.priority,
        notes: triage.notes || null,
      } as any);
      if (error) throw error;
      await supabase.from("patient_visits").update({ status: "vitals" } as any).eq("id", activeVisit.id);
      toast({ title: "Triage saved", description: `Complete for ${selectedPatient.name}` });
      setTriage(EMPTY_TRIAGE); setSelectedComplaints([]); setSelectedDuration("");
      selectPatient(selectedPatient);
    } catch (err: any) {
      toast({ title: "Error saving triage", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const filtered = patients.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search));
  const updateField = (field: keyof TriageEntry, value: string) => setTriage(prev => ({ ...prev, [field]: value }));

  return (
    <>
      <SEO title="Triage — DATAelixAIr" description="Clinical triage assessment" />
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-foreground tracking-tight mb-1 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Clinical Triage
        </h1>
        <p className="text-sm text-muted-foreground mb-6">Quick chip-based clinical assessment</p>

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

          {/* Triage Form */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              !activeVisit ? (
                <ClinicalCard className="py-12 text-center">
                  <AlertTriangle className="h-10 w-10 text-chip-lab-text mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No active visit for {selectedPatient.name}.</p>
                  <p className="text-xs text-muted-foreground mt-1">Register a visit first via the Visit Tracker.</p>
                </ClinicalCard>
              ) : (
                <div className="space-y-4">
                  {/* Complaint Chips */}
                  <ClinicalCard>
                    <ClinicalCardHeader title={`Triage for ${selectedPatient.name}`} icon={<ClipboardCheck className="h-4 w-4" />} />
                    <PresetChipGroup
                      label="Chief Complaint"
                      options={COMMON_COMPLAINTS}
                      selected={selectedComplaints}
                      onToggle={(c) => setSelectedComplaints(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                      variant="symptom"
                      allowCustom
                    />
                  </ClinicalCard>

                  {/* Duration */}
                  <ClinicalCard>
                    <ClinicalCardHeader title="Duration" />
                    <ChipGroup>
                      {DURATION_OPTIONS.map(d => (
                        <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>
                          {d}
                        </Chip>
                      ))}
                    </ChipGroup>
                  </ClinicalCard>

                  {/* Pain + Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <ClinicalCard>
                      <ClinicalCardHeader title="Pain Score" />
                      <ChipGroup>
                        {PAIN_CHIPS.map(p => (
                          <Chip key={p.value} variant={parseInt(p.value) >= 7 ? "alert" : "neutral"} size="sm"
                            selected={triage.pain_score === p.value} onClick={() => updateField("pain_score", p.value)}>
                            {p.label}
                          </Chip>
                        ))}
                      </ChipGroup>
                    </ClinicalCard>

                    <ClinicalCard>
                      <ClinicalCardHeader title="Priority" />
                      <ChipGroup>
                        {PRIORITY_OPTIONS.map(p => (
                          <Chip key={p.value}
                            variant={p.value === "emergent" ? "alert" : p.value === "urgent" ? "lab" : "neutral"}
                            selected={triage.priority === p.value}
                            onClick={() => updateField("priority", p.value)}>
                            {p.label}
                          </Chip>
                        ))}
                      </ChipGroup>
                    </ClinicalCard>
                  </div>

                  {/* Additional */}
                  <ClinicalCard>
                    <ClinicalCardHeader title="Additional Info" />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-muted-foreground font-semibold">Allergies</label>
                        <Input value={triage.allergies_noted} onChange={e => updateField("allergies_noted", e.target.value)} placeholder="e.g. Penicillin" className="h-8 text-xs rounded-lg mt-1" />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground font-semibold">Pregnancy</label>
                        <ChipGroup className="mt-1">
                          {PREGNANCY_OPTIONS.map(p => (
                            <Chip key={p.value} variant="neutral" size="sm"
                              selected={triage.pregnancy_status === p.value}
                              onClick={() => updateField("pregnancy_status", p.value)}>
                              {p.label}
                            </Chip>
                          ))}
                        </ChipGroup>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-[11px] text-muted-foreground font-semibold">Notes</label>
                      <Input value={triage.notes} onChange={e => updateField("notes", e.target.value)} placeholder="Any observations..." className="h-8 text-xs rounded-lg mt-1" />
                    </div>
                  </ClinicalCard>

                  <Button onClick={saveTriage} disabled={saving} className="w-full rounded-xl h-10">
                    <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Triage & Advance"}
                  </Button>

                  {recentTriage.length > 0 && (
                    <ClinicalCard>
                      <ClinicalCardHeader title="Recent Triage Records" />
                      <div className="space-y-2">
                        {recentTriage.map((t: any) => (
                          <div key={t.id} className="text-[11px] p-2.5 rounded-lg bg-muted/30 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {t.chief_complaint?.split(",").map((c: string, i: number) => (
                                  <Chip key={i} variant="symptom" size="sm">{c.trim()}</Chip>
                                ))}
                              </div>
                              <span className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-muted-foreground">
                              {t.symptom_duration && <span>Duration: {t.symptom_duration}</span>}
                              {t.pain_score != null && <span>Pain: {t.pain_score}/10</span>}
                              {t.priority && <Chip variant={t.priority === "emergent" ? "alert" : t.priority === "urgent" ? "lab" : "neutral"} size="sm">{t.priority}</Chip>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ClinicalCard>
                  )}
                </div>
              )
            ) : (
              <ClinicalCard className="py-16 text-center">
                <ClipboardCheck className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a patient to begin triage assessment</p>
              </ClinicalCard>
            )}
          </div>
        </div>
      </div>
    </>
  );
}