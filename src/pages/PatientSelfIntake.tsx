import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import SEO from "@/components/SEO";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Loader2,
  AlertTriangle, Pill, Stethoscope, Activity, FileText,
  Search, X
} from "lucide-react";

/* ─── Symptom chips ─── */
const SYMPTOM_CHIPS = [
  "Fever", "Cough", "Cold", "Headache", "Body Pain", "Chest Pain",
  "Abdominal Pain", "Nausea", "Vomiting", "Diarrhea", "Breathing Difficulty",
  "Dizziness", "Fatigue", "Back Pain", "Joint Pain", "Skin Rash",
  "Sore Throat", "Ear Pain", "Eye Pain", "Urinary Issues",
  "Anxiety", "Insomnia", "Weight Loss", "Swelling",
];

const DURATION_OPTIONS = [
  "Today", "1-2 days", "3-5 days", "1 week", "2 weeks", "1 month", "Over a month",
];

const SEVERITY_OPTIONS = [
  { label: "Mild", value: 2, color: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" },
  { label: "Moderate", value: 5, color: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  { label: "Severe", value: 8, color: "border-destructive/30 bg-destructive/10 text-destructive" },
  { label: "Very Severe", value: 10, color: "border-destructive bg-destructive/20 text-destructive" },
];

const COMMON_ALLERGIES = [
  "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Codeine",
  "Latex", "Peanuts", "Shellfish", "Dust", "Pollen",
  "None",
];

const COMMON_CONDITIONS = [
  "Diabetes", "Hypertension", "Asthma", "Heart Disease", "Thyroid Disorder",
  "Arthritis", "COPD", "Kidney Disease", "Liver Disease", "Epilepsy",
  "Depression", "None",
];

const COMMON_MEDICATIONS = [
  "Metformin", "Amlodipine", "Atorvastatin", "Losartan", "Omeprazole",
  "Levothyroxine", "Paracetamol", "Aspirin", "Metoprolol", "Pantoprazole",
  "Salbutamol Inhaler", "Insulin", "Clopidogrel", "Telmisartan",
];

const PREGNANCY_OPTIONS = [
  { label: "Not Applicable", value: "not_applicable" },
  { label: "Not Pregnant", value: "not_pregnant" },
  { label: "Pregnant", value: "pregnant" },
  { label: "Breastfeeding", value: "breastfeeding" },
];

type Step = "symptoms" | "details" | "history" | "review";
const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "symptoms", label: "Symptoms", icon: Stethoscope },
  { key: "details", label: "Details", icon: Activity },
  { key: "history", label: "History", icon: Pill },
  { key: "review", label: "Review", icon: FileText },
];

export default function PatientSelfIntake() {
  const { visitId } = useParams<{ visitId: string }>();
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get("clinic");

  const [step, setStep] = useState<Step>("symptoms");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visitValid, setVisitValid] = useState<boolean | null>(null);
  const [patientName, setPatientName] = useState("");

  // Form state
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomSearch, setSymptomSearch] = useState("");
  const [customSymptom, setCustomSymptom] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState<number>(0);
  const [painScore, setPainScore] = useState<number[]>([3]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergySearch, setAllergySearch] = useState("");
  const [medications, setMedications] = useState<string[]>([]);
  const [medSearch, setMedSearch] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [pregnancyStatus, setPregnancyStatus] = useState("not_applicable");
  const [notes, setNotes] = useState("");

  // Validate visit
  useEffect(() => {
    if (!visitId) { setVisitValid(false); return; }
    (async () => {
      const { data } = await supabase
        .from("patient_visits")
        .select("id, patient_id, patients(name)")
        .eq("id", visitId)
        .maybeSingle();
      if (data) {
        setVisitValid(true);
        const p = data.patients as any;
        setPatientName(p?.name || "");
      } else {
        setVisitValid(false);
      }
    })();
  }, [visitId]);

  const filteredSymptoms = useMemo(() => {
    if (symptomSearch.length < 1) return SYMPTOM_CHIPS;
    const q = symptomSearch.toLowerCase();
    return SYMPTOM_CHIPS.filter(s => s.toLowerCase().includes(q));
  }, [symptomSearch]);

  const filteredAllergies = useMemo(() => {
    if (allergySearch.length < 3) return [];
    const q = allergySearch.toLowerCase();
    return COMMON_ALLERGIES.filter(a => a.toLowerCase().includes(q) && !allergies.includes(a));
  }, [allergySearch, allergies]);

  const filteredMeds = useMemo(() => {
    if (medSearch.length < 3) return [];
    const q = medSearch.toLowerCase();
    return COMMON_MEDICATIONS.filter(m => m.toLowerCase().includes(q) && !medications.includes(m));
  }, [medSearch, medications]);

  const toggleChip = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    if (item === "None") {
      setList(prev => prev.includes("None") ? [] : ["None"]);
      return;
    }
    setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev.filter(i => i !== "None"), item]);
  };

  const chiefComplaint = selectedSymptoms.join(", ") + (customSymptom ? (selectedSymptoms.length ? ", " : "") + customSymptom : "");

  const canProceed: Record<Step, boolean> = {
    symptoms: selectedSymptoms.length > 0 || customSymptom.length > 0,
    details: !!duration && severity > 0,
    history: true,
    review: true,
  };

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const goNext = () => { if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].key); };
  const goBack = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1].key); };

  const handleSubmit = async () => {
    if (!visitId) return;
    setSubmitting(true);
    try {
      // Get visit details
      const { data: visit } = await supabase
        .from("patient_visits")
        .select("patient_id, clinic_id")
        .eq("id", visitId)
        .single();
      if (!visit) throw new Error("Visit not found");

      // Insert triage record (using service-level insert since patient may not be authed)
      const { error } = await supabase.from("triage").insert({
        visit_id: visitId,
        patient_id: visit.patient_id,
        clinic_id: visit.clinic_id,
        chief_complaint: chiefComplaint,
        symptom_duration: duration,
        pain_score: painScore[0],
        allergies_noted: allergies.filter(a => a !== "None").join(", ") || null,
        pregnancy_status: pregnancyStatus,
        priority: severity >= 8 ? "urgent" : severity >= 5 ? "semi_urgent" : "routine",
        notes: [
          conditions.filter(c => c !== "None").length ? `Chronic: ${conditions.filter(c => c !== "None").join(", ")}` : "",
          medications.length ? `Medications: ${medications.join(", ")}` : "",
          notes,
        ].filter(Boolean).join(". ") || null,
        recorded_by: visit.patient_id, // patient self-recorded
      });

      if (error) throw error;

      // Update visit status to indicate intake complete
      await supabase
        .from("patient_visits")
        .update({ status: "triage" })
        .eq("id", visitId);

      // Update patient allergies and medications
      const allergyList = allergies.filter(a => a !== "None");
      const medList = medications;
      if (allergyList.length || medList.length) {
        const updates: Record<string, any> = {};
        if (allergyList.length) updates.allergies = allergyList;
        if (medList.length) updates.current_medications = medList;
        await supabase.from("patients").update(updates).eq("id", visit.patient_id);
      }

      setSubmitted(true);
    } catch (e: any) {
      console.error("Intake submission error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  // Invalid visit
  if (visitValid === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Invalid Link</h2>
            <p className="text-sm text-muted-foreground">This intake link is invalid or has expired. Please ask the reception desk for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (visitValid === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <SEO title="Intake Complete | DATAelixAIr" description="Your intake form has been submitted." />
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Thank You!</h2>
            <p className="text-sm text-muted-foreground">Your intake information has been submitted. Your doctor will review it during your consultation.</p>
            <p className="text-xs text-muted-foreground mt-2">You may close this page now.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Patient Intake | DATAelixAIr" description="Complete your pre-visit intake form." />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-bold text-foreground">Pre-Visit Intake</h1>
            {patientName && <span className="text-xs text-muted-foreground">{patientName}</span>}
          </div>
          {/* Step indicator */}
          <div className="flex gap-1">
            {STEPS.map((s, i) => (
              <div key={s.key} className={`flex-1 h-1 rounded-full transition-colors ${i <= stepIdx ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {STEPS.map((s, i) => (
              <span key={s.key} className={`text-[9px] ${i <= stepIdx ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-24">
        {/* ─── Step 1: Symptoms ─── */}
        {step === "symptoms" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">What brings you in today?</h2>
              <p className="text-xs text-muted-foreground mb-3">Select all that apply or search below.</p>

              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search symptoms..."
                  value={symptomSearch}
                  onChange={e => setSymptomSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {filteredSymptoms.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleChip(selectedSymptoms, setSelectedSymptoms, s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedSymptoms.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Other symptom not listed</label>
              <Input
                placeholder="Describe your symptom..."
                value={customSymptom}
                onChange={e => setCustomSymptom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {selectedSymptoms.length > 0 && (
              <div className="flex flex-wrap gap-1 p-2 bg-primary/5 rounded-lg border border-primary/20">
                <span className="text-[10px] text-primary font-medium w-full mb-1">Selected:</span>
                {selectedSymptoms.map(s => (
                  <Badge key={s} variant="secondary" className="text-[10px] gap-1">
                    {s}
                    <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => toggleChip(selectedSymptoms, setSelectedSymptoms, s)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Details ─── */}
        {step === "details" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">How long have you had this?</h2>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      duration === d
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">How severe is it?</h2>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SEVERITY_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { setSeverity(s.value); setPainScore([s.value]); }}
                    className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all ${
                      severity === s.value ? s.color + " ring-1 ring-offset-1" : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-sm font-semibold text-foreground">Pain level</h2>
                <Badge variant="outline" className="text-xs">{painScore[0]}/10</Badge>
              </div>
              <Slider value={painScore} onValueChange={setPainScore} max={10} min={0} step={1} className="mt-2" />
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>No pain</span><span>Worst pain</span>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Pregnancy status</h2>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PREGNANCY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPregnancyStatus(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      pregnancyStatus === p.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: History ─── */}
        {step === "history" && (
          <div className="space-y-5">
            {/* Allergies */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Any allergies?</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {COMMON_ALLERGIES.map(a => (
                  <button
                    key={a}
                    onClick={() => toggleChip(allergies, setAllergies, a)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      allergies.includes(a)
                        ? a === "None" ? "bg-muted text-foreground border-muted" : "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search other allergies (3+ chars)..."
                  value={allergySearch}
                  onChange={e => setAllergySearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
                {filteredAllergies.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-md max-h-32 overflow-y-auto">
                    {filteredAllergies.map(a => (
                      <button key={a} onClick={() => { setAllergies(prev => [...prev.filter(i => i !== "None"), a]); setAllergySearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors text-foreground">
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Chronic conditions */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Chronic conditions</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {COMMON_CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleChip(conditions, setConditions, c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      conditions.includes(c)
                        ? c === "None" ? "bg-muted text-foreground border-muted" : "bg-primary/10 text-primary border-primary/30"
                        : "bg-card text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Medications */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Current medications</h2>
              {medications.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {medications.map(m => (
                    <Badge key={m} variant="secondary" className="text-[10px] gap-1">
                      {m}
                      <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setMedications(prev => prev.filter(i => i !== m))} />
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search medications (3+ chars)..."
                  value={medSearch}
                  onChange={e => setMedSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
                {filteredMeds.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-lg shadow-md max-h-32 overflow-y-auto">
                    {filteredMeds.map(m => (
                      <button key={m} onClick={() => { setMedications(prev => [...prev, m]); setMedSearch(""); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors text-foreground">
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-1">Anything else? (optional)</h2>
              <Textarea
                placeholder="Any additional information for your doctor..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-sm min-h-[60px]"
                maxLength={500}
              />
            </div>
          </div>
        )}

        {/* ─── Step 4: Review ─── */}
        {step === "review" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Review Your Information</h2>
            <p className="text-xs text-muted-foreground">Please confirm everything is correct before submitting.</p>

            <Card className="border-primary/20">
              <CardContent className="p-3 space-y-2.5">
                <ReviewRow label="Symptoms" value={chiefComplaint || "—"} />
                <ReviewRow label="Duration" value={duration || "—"} />
                <ReviewRow label="Severity" value={SEVERITY_OPTIONS.find(s => s.value === severity)?.label || "—"} />
                <ReviewRow label="Pain score" value={`${painScore[0]}/10`} />
                <ReviewRow label="Allergies" value={allergies.length ? allergies.join(", ") : "None noted"} highlight={allergies.length > 0 && !allergies.includes("None")} />
                <ReviewRow label="Chronic conditions" value={conditions.length ? conditions.join(", ") : "None noted"} />
                <ReviewRow label="Medications" value={medications.length ? medications.join(", ") : "None"} />
                {pregnancyStatus !== "not_applicable" && (
                  <ReviewRow label="Pregnancy" value={pregnancyStatus.replace("_", " ")} />
                )}
                {notes && <ReviewRow label="Notes" value={notes} />}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3 z-20">
        <div className="max-w-lg mx-auto flex gap-3">
          {stepIdx > 0 && (
            <Button variant="outline" onClick={goBack} className="flex-1 h-11 gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          {step !== "review" ? (
            <Button onClick={goNext} disabled={!canProceed[step]} className="flex-1 h-11 gap-1">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-11 gap-1">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Submitting..." : "Submit Intake"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-xs text-right ${highlight ? "text-destructive font-medium" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
