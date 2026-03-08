import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import SEO from "@/components/SEO";
import PatientSelector, { type SelectedPatient } from "@/components/PatientSelector";
import {
  ClipboardList, User, AlertTriangle, Pill, Search, Loader2,
  Save, CheckCircle, Heart
} from "lucide-react";
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

const PREGNANCY_OPTIONS = ["not_applicable", "not_pregnant", "pregnant", "unknown"];
const PRIORITY_OPTIONS = ["routine", "urgent", "emergent"];

export default function Intake() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [selectedPatient, setSelectedPatient] = useState<SelectedPatient | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileClinicId, setProfileClinicId] = useState<string | null>(null);

  // Form state
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptomDuration, setSymptomDuration] = useState("");
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

  // Pre-fill from selected patient
  useEffect(() => {
    if (selectedPatient) {
      if (selectedPatient.allergies?.length) setAllergiesNoted(selectedPatient.allergies.join(", "));
      if (selectedPatient.current_medications?.length) setCurrentMedications(selectedPatient.current_medications.join(", "));
    }
  }, [selectedPatient]);

  const handleSubmit = async () => {
    if (!user) return;

    // Validate
    const parsed = intakeSchema.safeParse({
      chief_complaint: chiefComplaint,
      symptom_duration: symptomDuration || undefined,
      pain_score: painScore,
      allergies_noted: allergiesNoted || undefined,
      current_medications: currentMedications || undefined,
      pregnancy_status: pregnancyStatus,
      notes: notes || undefined,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach(issue => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    if (!selectedPatient) {
      toast({ title: "Patient required", description: "Please select a patient first.", variant: "destructive" });
      return;
    }

    if (!profileClinicId) {
      toast({ title: "Clinic not assigned", description: "Your profile is not linked to a clinic.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Create or find a visit for this patient
      const { data: visitData, error: visitError } = await supabase.from("patient_visits").insert({
        patient_id: selectedPatient.id,
        clinic_id: profileClinicId,
        visit_type: "walk-in",
        status: "triage",
      }).select("id").single();
      if (visitError) throw new Error(visitError.message);

      // Insert triage/intake record
      const { error: triageError } = await supabase.from("triage").insert({
        patient_id: selectedPatient.id,
        clinic_id: profileClinicId,
        visit_id: visitData.id,
        recorded_by: user.id,
        chief_complaint: chiefComplaint.trim(),
        symptom_duration: symptomDuration.trim() || null,
        pain_score: painScore,
        allergies_noted: allergiesNoted.trim() || null,
        pregnancy_status: pregnancyStatus,
        priority,
        notes: notes.trim() || null,
      });
      if (triageError) throw new Error(triageError.message);

      // Update patient allergies/medications if provided
      if (allergiesNoted.trim() || currentMedications.trim()) {
        const updates: Record<string, any> = {};
        if (allergiesNoted.trim()) updates.allergies = allergiesNoted.split(",").map(s => s.trim()).filter(Boolean);
        if (currentMedications.trim()) updates.current_medications = currentMedications.split(",").map(s => s.trim()).filter(Boolean);
        await supabase.from("patients").update(updates).eq("id", selectedPatient.id);
      }

      toast({ title: "Intake saved", description: "Patient intake has been recorded and visit created." });

      // Navigate to consultation with patient + visit context
      navigate("/clinical", { state: { patient: selectedPatient, visitId: visitData.id, intakeData: { chief_complaint: chiefComplaint, symptom_duration: symptomDuration, pain_score: painScore, allergies_noted: allergiesNoted, current_medications: currentMedications, pregnancy_status: pregnancyStatus, priority, notes } } });
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
          <h1 className="text-lg font-bold text-foreground">Smart Clinical Intake</h1>
          <Badge variant="outline" className="text-[10px]">Pre-consultation</Badge>
        </div>

        {/* Patient Selection */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PatientSelector selected={selectedPatient} onSelect={setSelectedPatient} />
          </CardContent>
        </Card>

        {/* Intake Form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-primary" /> Complaint & Symptoms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Chief Complaint */}
            <div>
              <Label className="text-xs font-medium">Chief Complaint <span className="text-destructive">*</span></Label>
              <Textarea
                value={chiefComplaint}
                onChange={e => setChiefComplaint(e.target.value)}
                placeholder="Describe the main reason for the visit…"
                rows={3}
                className="text-sm mt-1"
                maxLength={500}
              />
              {errors.chief_complaint && <p className="text-[10px] text-destructive mt-0.5">{errors.chief_complaint}</p>}
            </div>

            {/* Duration + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Symptom Duration</Label>
                <Input
                  value={symptomDuration}
                  onChange={e => setSymptomDuration(e.target.value)}
                  placeholder="e.g. 3 days, 2 weeks"
                  className="h-9 text-sm mt-1"
                  maxLength={100}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p} value={p} className="text-sm capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pain Score */}
            <div>
              <Label className="text-xs font-medium">Pain Score: <span className="text-primary font-bold">{painScore}/10</span></Label>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[10px] text-muted-foreground">None</span>
                <Slider
                  value={[painScore]}
                  onValueChange={([v]) => setPainScore(v)}
                  min={0}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground">Severe</span>
              </div>
              <div className="flex justify-between mt-1">
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} className={`text-[8px] w-4 text-center ${i === painScore ? "text-primary font-bold" : "text-muted-foreground/50"}`}>{i}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Context */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-primary" /> Medical Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs font-medium flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5 text-destructive" /> Known Allergies
              </Label>
              <Input
                value={allergiesNoted}
                onChange={e => setAllergiesNoted(e.target.value)}
                placeholder="e.g. Penicillin, Sulfa drugs, Peanuts"
                className="h-9 text-sm mt-1"
                maxLength={500}
              />
            </div>
            <div>
              <Label className="text-xs font-medium flex items-center gap-1">
                <Pill className="h-2.5 w-2.5" /> Current Medications
              </Label>
              <Input
                value={currentMedications}
                onChange={e => setCurrentMedications(e.target.value)}
                placeholder="e.g. Metformin 500mg, Amlodipine 5mg"
                className="h-9 text-sm mt-1"
                maxLength={500}
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Pregnancy Status</Label>
              <Select value={pregnancyStatus} onValueChange={setPregnancyStatus}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PREGNANCY_OPTIONS.map(p => (
                    <SelectItem key={p} value={p} className="text-sm capitalize">{p.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium">Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any other observations or relevant information…"
                rows={2}
                className="text-sm mt-1"
                maxLength={1000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={saving || !selectedPatient} className="w-full" size="lg">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : <><Save className="h-4 w-4 mr-2" /> Save Intake & Proceed to Consultation</>}
        </Button>
      </div>
    </>
  );
}
