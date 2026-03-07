import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import { ClipboardCheck, Search, Save, AlertTriangle } from "lucide-react";
import {
  EMPTY_TRIAGE, PAIN_SCORES, PREGNANCY_OPTIONS, PRIORITY_OPTIONS,
  type TriageEntry,
} from "@/layers/workflow/api";

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

  useEffect(() => {
    if (!user) return;
    loadPatients();
  }, [user]);

  const loadPatients = async () => {
    const { data } = await supabase
      .from("patients")
      .select("id, name, age, gender, phone")
      .order("created_at", { ascending: false });
    setPatients(data || []);
  };

  const selectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setTriage(EMPTY_TRIAGE);

    // Find active visit for this patient
    const { data: visits } = await supabase
      .from("patient_visits")
      .select("*")
      .eq("patient_id", patient.id)
      .neq("status", "complete")
      .order("check_in_time", { ascending: false })
      .limit(1);
    setActiveVisit(visits?.[0] || null);

    // Load recent triage records
    const { data: triageData } = await supabase
      .from("triage")
      .select("*")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentTriage(triageData || []);
  };

  const saveTriage = async () => {
    if (!selectedPatient || !user || !activeVisit) return;
    if (!triage.chief_complaint.trim()) {
      toast({ title: "Chief complaint required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("clinic_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await supabase.from("triage").insert({
        visit_id: activeVisit.id,
        patient_id: selectedPatient.id,
        clinic_id: profile?.clinic_id || activeVisit.clinic_id,
        recorded_by: user.id,
        chief_complaint: triage.chief_complaint.trim(),
        symptom_duration: triage.symptom_duration || null,
        pain_score: triage.pain_score ? parseInt(triage.pain_score) : null,
        allergies_noted: triage.allergies_noted || null,
        pregnancy_status: triage.pregnancy_status,
        priority: triage.priority,
        notes: triage.notes || null,
      } as any);

      if (error) throw error;

      // Advance visit to next step
      await supabase
        .from("patient_visits")
        .update({ status: "vitals" } as any)
        .eq("id", activeVisit.id);

      toast({ title: "Triage saved", description: `Triage complete for ${selectedPatient.name}` });
      setTriage(EMPTY_TRIAGE);
      selectPatient(selectedPatient);
    } catch (err: any) {
      toast({ title: "Error saving triage", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filtered = patients.filter(
    (p) =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.includes(search)
  );

  const updateField = (field: keyof TriageEntry, value: string) => {
    setTriage((prev) => ({ ...prev, [field]: value }));
  };

  const priorityConfig = PRIORITY_OPTIONS.find((p) => p.value === triage.priority);

  return (
    <>
      <SEO title="Triage — DATAelixAIr" description="Clinical triage assessment" />
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Clinical Triage
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Quick clinical assessment before vitals and doctor consultation.
        </p>

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
                {filtered.slice(0, 20).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                      selectedPatient?.id === p.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.age ? `${p.age}y` : ""} {p.gender || ""}{" "}
                      {p.phone ? `· ${p.phone}` : ""}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Triage Form */}
          <div className="lg:col-span-2">
            {selectedPatient ? (
              !activeVisit ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <AlertTriangle className="h-10 w-10 text-amber-500/50 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No active visit found for {selectedPatient.name}.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Register a visit first via the Visit Tracker.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">
                        Triage for{" "}
                        <span className="text-primary">{selectedPatient.name}</span>
                      </CardTitle>
                      {priorityConfig && (
                        <Badge variant="outline" className={priorityConfig.color}>
                          {priorityConfig.label}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Chief Complaint */}
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">
                        Chief Complaint <span className="text-destructive">*</span>
                      </label>
                      <Textarea
                        value={triage.chief_complaint}
                        onChange={(e) => updateField("chief_complaint", e.target.value)}
                        placeholder="e.g., Persistent cough for 3 days with fever"
                        className="mt-1 min-h-[60px]"
                        maxLength={500}
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Symptom Duration */}
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Symptom Duration
                        </label>
                        <Input
                          value={triage.symptom_duration}
                          onChange={(e) => updateField("symptom_duration", e.target.value)}
                          placeholder="e.g., 3 days"
                          className="h-9 mt-1"
                          maxLength={100}
                        />
                      </div>

                      {/* Pain Score */}
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Pain Score (0–10)
                        </label>
                        <Select
                          value={triage.pain_score}
                          onValueChange={(val) => updateField("pain_score", val)}
                        >
                          <SelectTrigger className="h-9 mt-1">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {PAIN_SCORES.map((ps) => (
                              <SelectItem key={ps.value} value={ps.value} className="text-xs">
                                {ps.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Priority */}
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Priority
                        </label>
                        <Select
                          value={triage.priority}
                          onValueChange={(val) => updateField("priority", val)}
                        >
                          <SelectTrigger className="h-9 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((p) => (
                              <SelectItem key={p.value} value={p.value} className="text-xs">
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Allergies */}
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Allergies
                        </label>
                        <Input
                          value={triage.allergies_noted}
                          onChange={(e) => updateField("allergies_noted", e.target.value)}
                          placeholder="e.g., Penicillin, NSAID"
                          className="h-9 mt-1"
                          maxLength={200}
                        />
                      </div>

                      {/* Pregnancy Status */}
                      <div>
                        <label className="text-[10px] text-muted-foreground font-medium">
                          Pregnancy Status
                        </label>
                        <Select
                          value={triage.pregnancy_status}
                          onValueChange={(val) => updateField("pregnancy_status", val)}
                        >
                          <SelectTrigger className="h-9 mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PREGNANCY_OPTIONS.map((p) => (
                              <SelectItem key={p.value} value={p.value} className="text-xs">
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">
                        Additional Notes
                      </label>
                      <Input
                        value={triage.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="Any observations..."
                        className="h-9 mt-1"
                        maxLength={500}
                      />
                    </div>

                    <Button onClick={saveTriage} disabled={saving} className="w-full">
                      <Save className="h-4 w-4 mr-2" />{" "}
                      {saving ? "Saving..." : "Save Triage & Advance"}
                    </Button>

                    {/* Recent Triage */}
                    {recentTriage.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Recent Triage Records
                        </p>
                        <div className="space-y-2">
                          {recentTriage.map((t: any) => (
                            <div
                              key={t.id}
                              className="text-[11px] p-2 rounded bg-muted/30 space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{t.chief_complaint}</span>
                                <span className="text-muted-foreground">
                                  {new Date(t.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 text-muted-foreground">
                                {t.symptom_duration && <span>Duration: {t.symptom_duration}</span>}
                                {t.pain_score != null && <span>Pain: {t.pain_score}/10</span>}
                                {t.priority && <span>Priority: {t.priority}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <ClipboardCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Select a patient to begin triage assessment
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
