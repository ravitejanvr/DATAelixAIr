import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SEO from "@/components/SEO";
import {
  CheckCircle2, Loader2, AlertTriangle, Search, X, User,
  Phone, Calendar, Stethoscope, ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Common symptoms for autocomplete ─── */
const SYMPTOM_DICTIONARY = [
  "Fever", "Cough", "Headache", "Stomach Pain", "Back Pain", "Skin Problem",
  "Breathing Difficulty", "Cold", "Body Pain", "Chest Pain", "Nausea", "Vomiting",
  "Diarrhea", "Dizziness", "Fatigue", "Joint Pain", "Skin Rash", "Sore Throat",
  "Ear Pain", "Eye Pain", "Urinary Issues", "Anxiety", "Insomnia", "Weight Loss",
  "Swelling", "Palpitations", "Numbness", "Constipation", "Blurred Vision",
  "Leg Pain", "Neck Pain", "Toothache", "Sneezing", "Runny Nose",
];

const SYMPTOM_CHIPS = [
  { label: "Fever", icon: "🤒" },
  { label: "Cough", icon: "😷" },
  { label: "Headache", icon: "🤕" },
  { label: "Stomach Pain", icon: "😣" },
  { label: "Back Pain", icon: "💪" },
  { label: "Cold / Flu", icon: "🤧" },
  { label: "Breathing Difficulty", icon: "😮‍💨" },
  { label: "Skin Problem", icon: "🩹" },
];

const DURATION_OPTS = ["Today", "1–2 days", "3–7 days", "More than 1 week"];

const COMMON_CONDITIONS = ["Diabetes", "High BP", "Asthma", "Heart Disease", "Thyroid"];
const COMMON_ALLERGENS = [
  "Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Amoxicillin",
];

const GENDER_OPTS = ["Male", "Female", "Other"];

const SLIDE = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.2 },
};

export default function QRVisitRegistration() {
  const [searchParams] = useSearchParams();
  const clinicId = searchParams.get("clinic");

  // Step: 0=basic info, 1=symptoms, 2=optional details, 3=review
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [clinicName, setClinicName] = useState("");

  // Basic info
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");

  // Symptoms
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomSearch, setSymptomSearch] = useState("");
  const [duration, setDuration] = useState("");

  // Optional
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [allergySearch, setAllergySearch] = useState("");

  // Load clinic name once
  useState(() => {
    if (!clinicId) return;
    supabase.from("clinics").select("name").eq("id", clinicId).single()
      .then(({ data }) => { if (data) setClinicName(data.name); });
  });

  const filteredSuggestions = useMemo(() => {
    if (symptomSearch.length < 2) return [];
    const q = symptomSearch.toLowerCase();
    return SYMPTOM_DICTIONARY.filter(
      (s) => s.toLowerCase().includes(q) && !selectedSymptoms.includes(s)
    ).slice(0, 5);
  }, [symptomSearch, selectedSymptoms]);

  const filteredAllergens = useMemo(() => {
    if (allergySearch.length < 2) return [];
    const q = allergySearch.toLowerCase();
    return COMMON_ALLERGENS.filter(
      (a) => a.toLowerCase().includes(q) && !allergies.includes(a)
    ).slice(0, 5);
  }, [allergySearch, allergies]);

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const toggleCondition = (c: string) =>
    setConditions((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const chiefComplaint = selectedSymptoms.join(", ");

  const canProceed: Record<number, boolean> = {
    0: name.trim().length >= 2 && age.trim().length > 0 && !!gender && phone.trim().length >= 10,
    1: selectedSymptoms.length > 0,
    2: true, // optional step
    3: true,
  };

  const goNext = () => step < 3 && setStep(step + 1);
  const goBack = () => step > 0 && setStep(step - 1);

  const handleSubmit = async () => {
    if (!clinicId) return;
    setSubmitting(true);

    try {
      // 1. Check if patient already exists by phone+clinic
      const { data: existingPatients } = await supabase
        .from("patients")
        .select("id, doctor_id")
        .eq("phone", phone.trim())
        .eq("clinic_id", clinicId)
        .limit(1);

      let patientId: string;
      let doctorId: string;

      if (existingPatients && existingPatients.length > 0) {
        // Existing patient — update demographics if needed
        patientId = existingPatients[0].id;
        doctorId = existingPatients[0].doctor_id;

        await supabase.from("patients").update({
          age: parseInt(age),
          gender: gender.toLowerCase(),
          ...(allergies.length > 0 ? { allergies } : {}),
        }).eq("id", patientId);
      } else {
        // Need a doctor_id for the patient record — use clinic's first doctor
        // For QR registration, we use a placeholder that gets reassigned when doctor calls
        const { data: clinicDoctor } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("clinic_id", clinicId)
          .limit(1);

        doctorId = clinicDoctor?.[0]?.user_id || clinicId; // fallback

        const { data: newPatient, error: pErr } = await supabase
          .from("patients")
          .insert({
            name: name.trim(),
            age: parseInt(age),
            gender: gender.toLowerCase(),
            phone: phone.trim(),
            doctor_id: doctorId,
            clinic_id: clinicId,
            allergies: allergies.length > 0 ? allergies : [],
            medical_history: conditions.length > 0
              ? conditions.map((c) => ({ condition: c }))
              : [],
          })
          .select("id")
          .single();

        if (pErr) throw pErr;
        patientId = newPatient.id;
      }

      // 2. Create patient visit (token auto-generated by trigger)
      const { data: visit, error: vErr } = await supabase
        .from("patient_visits")
        .insert({
          patient_id: patientId,
          clinic_id: clinicId,
          visit_type: "qr-walkin",
          status: "registered",
        })
        .select("id, token_number")
        .single();

      if (vErr) throw vErr;

      // 3. Create triage record with intake data
      await supabase.from("triage").insert({
        visit_id: visit.id,
        patient_id: patientId,
        clinic_id: clinicId,
        chief_complaint: chiefComplaint,
        symptom_duration: duration || null,
        pain_score: 0,
        priority: "routine",
        allergies_noted: allergies.join(", ") || null,
        notes: conditions.length > 0 ? `Conditions: ${conditions.join(", ")}` : null,
        recorded_by: patientId, // self-recorded
      });

      setTokenNumber(visit.token_number);
      setSubmitted(true);
    } catch (e: any) {
      console.error("QR registration error:", e);
    } finally {
      setSubmitting(false);
    }
  };

  // Invalid clinic
  if (!clinicId) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Invalid QR Code</h2>
            <p className="text-sm text-muted-foreground">
              This link is invalid. Please scan the QR code at the clinic reception.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted — show token
  if (submitted) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <SEO title="Registered | DATAelixAIr" description="Visit registration complete." />
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 className="h-14 w-14 text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">You're Registered!</h2>
            {tokenNumber && (
              <div className="my-4">
                <p className="text-sm text-muted-foreground mb-1">Your Token Number</p>
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/10 border-2 border-primary">
                  <span className="text-4xl font-bold text-primary">{tokenNumber}</span>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Please wait for your number to be called.
              {clinicName && <> Welcome to <strong>{clinicName}</strong>.</>}
            </p>
            <p className="text-xs text-muted-foreground">You may close this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <SEO title="Quick Registration | DATAelixAIr" description="Register your clinic visit quickly." />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-base font-bold text-foreground">Quick Registration</h1>
              {clinicName && (
                <p className="text-xs text-muted-foreground">{clinicName}</p>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              Step {step + 1}/4
            </Badge>
          </div>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-md mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 0: Basic Info */}
            {step === 0 && (
              <motion.div key="step0" {...SLIDE} className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Your Details
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Basic information for your visit
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="h-12 text-base"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">
                        Age <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Age"
                        className="h-12 text-base"
                        min={0}
                        max={120}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-1 block">
                        Gender <span className="text-destructive">*</span>
                      </label>
                      <div className="flex gap-2">
                        {GENDER_OPTS.map((g) => (
                          <button
                            key={g}
                            onClick={() => setGender(g)}
                            className={`flex-1 h-12 rounded-lg border text-sm font-medium transition-all ${
                              gender === g
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card text-foreground border-border hover:border-primary/50"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-1 block">
                      <Phone className="h-3.5 w-3.5 inline mr-1" />
                      Phone Number <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit phone number"
                      className="h-12 text-base"
                      maxLength={15}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 1: Symptoms */}
            {step === 1 && (
              <motion.div key="step1" {...SLIDE} className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-primary" /> What brings you in?
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tap your symptoms (select all that apply)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {SYMPTOM_CHIPS.map((chip) => {
                    const active = selectedSymptoms.includes(chip.label);
                    return (
                      <button
                        key={chip.label}
                        onClick={() => toggleSymptom(chip.label)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                          active
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-card border-border text-foreground hover:border-primary/40"
                        }`}
                      >
                        <span className="text-lg">{chip.icon}</span>
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                {/* Search for more */}
                <div className="relative">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={symptomSearch}
                    onChange={(e) => setSymptomSearch(e.target.value)}
                    placeholder="Search more symptoms..."
                    className="pl-9 h-12 text-base"
                  />
                  {filteredSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                      {filteredSuggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            toggleSymptom(s);
                            setSymptomSearch("");
                          }}
                          className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-accent transition-colors border-b border-border last:border-0"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedSymptoms.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSymptoms.map((s) => (
                      <Badge
                        key={s}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => toggleSymptom(s)}
                      >
                        {s} <X className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Duration */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    How long have you had these symptoms?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {DURATION_OPTS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          duration === d
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-card border-border text-foreground hover:border-primary/40"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Optional Details */}
            {step === 2 && (
              <motion.div key="step2" {...SLIDE} className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Additional Information
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Optional — helps your doctor prepare
                  </p>
                </div>

                {/* Conditions */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Any existing medical conditions?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CONDITIONS.map((c) => {
                      const active = conditions.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() => toggleCondition(c)}
                          className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                            active
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-card border-border text-foreground hover:border-primary/40"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Allergies */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Any drug allergies?
                  </label>
                  <div className="relative">
                    <Input
                      value={allergySearch}
                      onChange={(e) => setAllergySearch(e.target.value)}
                      placeholder="Type allergy name..."
                      className="h-11"
                    />
                    {filteredAllergens.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                        {filteredAllergens.map((a) => (
                          <button
                            key={a}
                            onClick={() => {
                              setAllergies((prev) => [...prev, a]);
                              setAllergySearch("");
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-accent border-b border-border last:border-0"
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {allergies.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allergies.map((a) => (
                        <Badge
                          key={a}
                          variant="destructive"
                          className="gap-1 cursor-pointer"
                          onClick={() => setAllergies((prev) => prev.filter((x) => x !== a))}
                        >
                          {a} <X className="h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div key="step3" {...SLIDE} className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    Confirm Your Details
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review before submitting
                  </p>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <ReviewRow label="Name" value={name} />
                    <ReviewRow label="Age / Gender" value={`${age} / ${gender}`} />
                    <ReviewRow label="Phone" value={phone} />
                    <div className="border-t border-border my-2" />
                    <ReviewRow label="Chief Complaint" value={chiefComplaint} highlight />
                    {duration && <ReviewRow label="Duration" value={duration} />}
                    {conditions.length > 0 && (
                      <ReviewRow label="Conditions" value={conditions.join(", ")} />
                    )}
                    {allergies.length > 0 && (
                      <ReviewRow label="Allergies" value={allergies.join(", ")} highlight />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="sticky bottom-0 bg-card border-t border-border px-4 py-3 safe-area-bottom">
        <div className="max-w-md mx-auto flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={goBack} className="h-12">
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={goNext}
              disabled={!canProceed[step]}
              className="flex-1 h-12 text-base gap-2"
            >
              {step === 2 ? "Review" : "Next"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-12 text-base"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Register Visit"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${highlight ? "font-medium text-foreground" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
