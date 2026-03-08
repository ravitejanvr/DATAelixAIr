import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Chip, ChipGroup, PresetChipGroup } from "@/components/ui/chip";
import { ClinicalCard, ClinicalCardHeader } from "@/components/ui/clinical-card";
import SEO from "@/components/SEO";
import PatientSelector, { type SelectedPatient } from "@/components/PatientSelector";
import { ClipboardList, User, AlertTriangle, Pill, Loader2, Save, Heart } from "lucide-react";
import { z } from "zod";

const intakeSchema = z.object({
  chief_complaint: z.string().trim().min(1, "Chief complaint is required").max(500),
  symptom_duration: z.string().trim().max(100).optional(),
  pain_score: z.number().min(0).max(10).optional(),
  allergies_noted: z.string().trim().max(500).optional(),
  current_medications: z.string().trim().max(500).optional(),
  pregnancy_status: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const COMMON_COMPLAINTS = ["Fever", "Cough", "Cold", "Headache", "Body ache", "Stomach pain", "Vomiting", "Diarrhea", "Chest pain", "Breathlessness", "Back pain", "Joint pain"];
const DURATION_OPTIONS = ["Today", "2 days", "3 days", "5 days", "1 week", "2 weeks", "1 month"];
const SEVERITY_LEVELS = [
  { score: 0, label: "None", emoji: "😊" },
  { score: 2, label: "Mild", emoji: "😐" },
  { score: 4, label: "Moderate", emoji: "😟" },
  { score: 6, label: "Significant", emoji: "😣" },
  { score: 8, label: "Severe", emoji: "😫" },
  { score: 10, label: "Worst", emoji: "🚨" },
];
const PRIORITY_OPTIONS = [
  { value: "routine", label: "Routine", variant: "symptom" as const },
  { value: "urgent", label: "Urgent", variant: "lab" as const },
  { value: "emergent", label: "Emergent", variant: "alert" as const },
];

export default function Intake() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileClinicId, setProfileClinicId] = useState<string | null>(null);

  const [selectedComplaints, setSelectedComplaints] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [painScore, setPainScore] = useState<number>(0);
  const [allergiesNoted, setAllergiesNoted] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [pregnancyStatus, setPregnancyStatus] = useState("not_applicable");
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.clinic_id) setProfileClinicId(data.clinic_id);
    });
  }, [user]);

  useEffect(() => {
    if (selectedPatient) {
      if (selectedPatient.allergies?.length) setAllergiesNoted(selectedPatient.allergies.join(", "));
      if (selectedPatient.current_medications?.length) setCurrentMedications(selectedPatient.current_medications.join(", "));
    }
  }, [selectedPatient]);

  const toggleComplaint = (c: string) => {
    setSelectedComplaints(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const handleSubmit = async () => {
    if (!user) return;
    const chiefComplaint = selectedComplaints.join(", ");

    const parsed = intakeSchema.safeParse({
      chief_complaint: chiefComplaint,
      symptom_duration: selectedDuration || undefined,
      pain_score: painScore,
      allergies_noted: allergiesNoted || undefined,
      current_medications: currentMedications || undefined,
      pregnancy_status: pregnancyStatus,
      notes: notes || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach(issue => { fieldErrors[issue.path[0] as string] = issue.message; });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (!selectedPatient) { toast({ title: "Patient required", variant: "destructive" }); return; }
    if (!profileClinicId) { toast({ title: "Clinic not assigned", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const { data: visitData, error: visitError } = await supabase.from("patient_visits").insert({
        patient_id: selectedPatient.id, clinic_id: profileClinicId, visit_type: "walk-in", status: "triage",
      }).select("id").single();
      if (visitError) throw new Error(visitError.message);

      const { error: triageError } = await supabase.from("triage").insert({
        patient_id: selectedPatient.id, clinic_id: profileClinicId, visit_id: visitData.id,
        recorded_by: user.id, chief_complaint: chiefComplaint.trim(),
        symptom_duration: selectedDuration || null, pain_score: painScore,
        allergies_noted: allergiesNoted.trim() || null, pregnancy_status: pregnancyStatus,
        priority, notes: notes.trim() || null,
      });
      if (triageError) throw new Error(triageError.message);

      if (allergiesNoted.trim() || currentMedications.trim()) {
        const updates: Record<string, any> = {};
        if (allergiesNoted.trim()) updates.allergies = allergiesNoted.split(",").map(s => s.trim()).filter(Boolean);
        if (currentMedications.trim()) updates.current_medications = currentMedications.split(",").map(s => s.trim()).filter(Boolean);
        await supabase.from("patients").update(updates).eq("id", selectedPatient.id);
      }

      toast({ title: "Intake saved" });
      navigate("/clinical", { state: { patient: selectedPatient, visitId: visitData.id, intakeData: { chief_complaint: chiefComplaint, symptom_duration: selectedDuration, pain_score: painScore, allergies_noted: allergiesNoted, current_medications: currentMedications, pregnancy_status: pregnancyStatus, priority, notes } } });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <>
      <SEO title="Smart Intake — DATAelixAIr" description="Patient clinical intake form" />
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground tracking-tight">Smart Clinical Intake</h1>
          <Badge variant="outline" className="text-[10px]">Pre-consultation</Badge>
        </div>

        {/* Patient */}
        <ClinicalCard>
          <ClinicalCardHeader title="Patient" icon={<User className="h-3.5 w-3.5" />} />
          <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
        </ClinicalCard>

        {/* Step 1: Complaint chips */}
        <ClinicalCard>
          <ClinicalCardHeader title="What brings you in today?" icon={<ClipboardList className="h-3.5 w-3.5" />} />
          <PresetChipGroup
            label=""
            options={COMMON_COMPLAINTS}
            selected={selectedComplaints}
            onToggle={toggleComplaint}
            variant="symptom"
            allowCustom
          />
          {errors.chief_complaint && <p className="text-[11px] text-destructive mt-2">{errors.chief_complaint}</p>}
        </ClinicalCard>

        {/* Step 2: Duration */}
        {selectedComplaints.length > 0 && (
          <ClinicalCard>
            <ClinicalCardHeader title="How long?" icon={<ClipboardList className="h-3.5 w-3.5" />} />
            <ChipGroup>
              {DURATION_OPTIONS.map(d => (
                <Chip key={d} variant="neutral" selected={selectedDuration === d} onClick={() => setSelectedDuration(selectedDuration === d ? "" : d)}>
                  {d}
                </Chip>
              ))}
            </ChipGroup>
          </ClinicalCard>
        )}

        {/* Step 3: Severity */}
        {selectedComplaints.length > 0 && (
          <ClinicalCard>
            <ClinicalCardHeader title="Pain / Severity" icon={<ClipboardList className="h-3.5 w-3.5" />} />
            <div className="flex flex-wrap gap-2">
              {SEVERITY_LEVELS.map(s => (
                <button
                  key={s.score}
                  onClick={() => setPainScore(s.score)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                    painScore === s.score
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">{s.label}</span>
                </button>
              ))}
            </div>
          </ClinicalCard>
        )}

        {/* Step 4: Priority */}
        {selectedComplaints.length > 0 && (
          <ClinicalCard>
            <ClinicalCardHeader title="Priority" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
            <ChipGroup>
              {PRIORITY_OPTIONS.map(p => (
                <Chip key={p.value} variant={p.variant} selected={priority === p.value} onClick={() => setPriority(p.value)}>
                  {p.label}
                </Chip>
              ))}
            </ChipGroup>
          </ClinicalCard>
        )}

        {/* Medical Context */}
        <ClinicalCard>
          <ClinicalCardHeader title="Medical Context" icon={<Heart className="h-3.5 w-3.5" />} />
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5 text-destructive" /> Known Allergies
              </Label>
              <Input value={allergiesNoted} onChange={e => setAllergiesNoted(e.target.value)} placeholder="e.g. Penicillin, Sulfa drugs" className="h-9 text-xs rounded-lg mt-1" maxLength={500} />
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Pill className="h-2.5 w-2.5" /> Current Medications
              </Label>
              <Input value={currentMedications} onChange={e => setCurrentMedications(e.target.value)} placeholder="e.g. Metformin 500mg" className="h-9 text-xs rounded-lg mt-1" maxLength={500} />
            </div>
            <div>
              <Label className="text-[11px] font-semibold text-muted-foreground">Additional Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any other observations…" rows={2} className="text-xs rounded-lg mt-1" maxLength={1000} />
            </div>
          </div>
        </ClinicalCard>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={saving || !selectedPatient || selectedComplaints.length === 0} className="w-full rounded-xl h-11" size="lg">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : <><Save className="h-4 w-4 mr-2" /> Save & Proceed to Consultation</>}
        </Button>
      </div>
    </>
  );
}