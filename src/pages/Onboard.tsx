import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, HeartPulse, Pill, CalendarCheck, User, Settings, ArrowRight, ArrowLeft, CheckCircle2, Search, MapPin, Loader2, X, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

interface ClinicResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  user_ratings_total: number;
  open_now: boolean | null;
}

const ROLES = [
  { key: "doctor", icon: Stethoscope, label: "Doctor / Consultant" },
  { key: "nurse", icon: HeartPulse, label: "Nursing / Allied Health" },
  { key: "pharmacist", icon: Pill, label: "Pharmacy / Lab" },
  { key: "care_coordinator", icon: CalendarCheck, label: "Coordinator / Front Desk" },
  { key: "admin", icon: Settings, label: "Administrator / Owner" },
] as const;

const SPECIALISATIONS: Record<string, { value: string; label: string }[]> = {
  doctor: [
    { value: "general_practitioner", label: "General Practitioner" },
    { value: "specialist", label: "Specialist / Consultant" },
    { value: "surgeon", label: "Surgeon" },
    { value: "pediatrician", label: "Pediatrician" },
    { value: "psychiatrist", label: "Psychiatrist" },
    { value: "emergency", label: "Emergency Medicine" },
  ],
  nurse: [
    { value: "nurse", label: "Nurse" },
    { value: "physiotherapist", label: "Physiotherapist" },
    { value: "dietitian", label: "Dietitian / Nutritionist" },
    { value: "psychologist", label: "Psychologist" },
    { value: "occupational_therapist", label: "Occupational Therapist" },
  ],
  pharmacist: [
    { value: "pharmacist", label: "Pharmacist" },
    { value: "lab_technician", label: "Lab Technician" },
    { value: "radiologist", label: "Radiologist / Imaging" },
  ],
  care_coordinator: [
    { value: "care_coordinator", label: "Care Coordinator" },
    { value: "front_desk", label: "Front Desk / Reception" },
    { value: "billing", label: "Billing / Insurance" },
  ],
};

export default function Onboard() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Clinic search state
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicResults, setClinicResults] = useState<ClinicResult[]>([]);
  const [clinicSearching, setClinicSearching] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowClinicDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchClinics = async (q: string) => {
    if (!q.trim()) { setClinicResults([]); return; }
    setClinicSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("places-search", { body: { query: q } });
      if (!error && data?.clinics) {
        setClinicResults(data.clinics);
        setShowClinicDropdown(true);
      }
    } catch { /* silent */ } finally { setClinicSearching(false); }
  };

  const handleClinicInput = (val: string) => {
    setClinicQuery(val);
    if (clinicName) setClinicName("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchClinics(val), 400);
  };

  const selectClinic = (c: ClinicResult) => {
    setClinicName(c.name);
    setClinicQuery(c.name);
    setShowClinicDropdown(false);
  };

  const hasSpecialisation = !!SPECIALISATIONS[role];

  // Dynamic steps
  const totalSteps = hasSpecialisation ? 6 : 5;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    switch (step) {
      case 0: return !!role;
      case 1: return fullName.trim().length >= 2;
      case 2: return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      case 3: return password.length >= 6;
      case 4: return hasSpecialisation ? !!specialisation : true; // specialisation or clinic
      case 5: return true; // clinic (optional)
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role, role_subtype: specialisation, clinic_name: clinicName },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else if (data.session) {
      if (clinicName || specialisation) {
        await supabase.from("profiles").update({
          ...(clinicName ? { clinic_name: clinicName } : {}),
          ...(specialisation ? { role_subtype: specialisation } : {}),
        }).eq("user_id", data.user!.id);
      }
      setSubmitted(true);
    } else {
      setSubmitted(true);
    }
  };

  const next = () => {
    const lastInputStep = totalSteps - 1;
    if (step < lastInputStep) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const back = () => step > 0 && setStep(step - 1);

  // Get current step content
  const getStepContent = () => {
    // Step 0: Role
    if (step === 0) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">I am a healthcare professional</h2>
            <p className="text-sm text-muted-foreground mt-2">Select your role to get started</p>
          </div>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
            {ROLES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => { setRole(r.key); setSpecialisation(""); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                  role === r.key
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:border-primary/40 text-muted-foreground"
                }`}
              >
                <r.icon className={`h-6 w-6 ${role === r.key ? "text-primary" : ""}`} />
                <span className="text-xs font-medium leading-tight text-center">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Step 1: Name
    if (step === 1) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">What's your full name?</h2>
            <p className="text-sm text-muted-foreground mt-2">As it appears on your professional registration</p>
          </div>
          <div className="max-w-sm mx-auto">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. / Mr. / Ms."
              className="text-center text-lg h-12"
              autoFocus
            />
          </div>
        </div>
      );
    }

    // Step 2: Email
    if (step === 2) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">What's your email address?</h2>
            <p className="text-sm text-muted-foreground mt-2">We'll send a verification link to confirm</p>
          </div>
          <div className="max-w-sm mx-auto">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@clinic.com"
              className="text-center text-lg h-12"
              autoFocus
            />
          </div>
        </div>
      );
    }

    // Step 3: Password
    if (step === 3) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">Create a password</h2>
            <p className="text-sm text-muted-foreground mt-2">Minimum 6 characters</p>
          </div>
          <div className="max-w-sm mx-auto">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="text-center text-lg h-12"
              minLength={6}
              autoFocus
            />
          </div>
        </div>
      );
    }

    // Step 4: Specialisation (if applicable) or Clinic
    if (step === 4 && hasSpecialisation) {
      const specs = SPECIALISATIONS[role];
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">Your specialisation</h2>
            <p className="text-sm text-muted-foreground mt-2">Select the closest match to your role</p>
          </div>
          <div className="max-w-sm mx-auto">
            <Select value={specialisation} onValueChange={setSpecialisation}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Select specialisation…" />
              </SelectTrigger>
              <SelectContent>
                {specs.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // Clinic step (last step for roles with specialisation, or step 4 for others)
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">Organisation / Clinic Name</h2>
          <p className="text-sm text-muted-foreground mt-2">Optional — search or type your clinic name</p>
        </div>
        <div ref={wrapperRef} className="max-w-sm mx-auto relative">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={clinicName || clinicQuery}
              onChange={(e) => handleClinicInput(e.target.value)}
              onFocus={() => clinicResults.length > 0 && setShowClinicDropdown(true)}
              placeholder="Search clinic or type name..."
              className="pl-10 pr-8 text-base h-12"
              autoFocus
            />
            {clinicName && (
              <button
                type="button"
                onClick={() => { setClinicName(""); setClinicQuery(""); setClinicResults([]); }}
                className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {clinicSearching && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-primary" />}
          </div>
          {showClinicDropdown && clinicResults.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-background border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {clinicResults.map((c) => (
                <button
                  key={c.place_id}
                  type="button"
                  onClick={() => selectClinic(c)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{c.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (submitted) {
    return (
      <>
        <SEO title="Pilot Application Submitted — DATAelixAIr" description="Your pilot access request has been submitted." />
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full teal-muted-bg border teal-muted-border flex items-center justify-center mx-auto">
              <CheckCircle2 className="text-primary" size={32} />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Application Submitted</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Thank you, <strong>{fullName}</strong>. We've received your pilot access request. Please check your email to verify your account. Our team will review your application and grant workspace access.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Prototype clinical AI outputs require clinician review before medical use.
            </p>
            <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
              Return to Homepage
            </Button>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Request Pilot Access — DATAelixAIr" description="Apply for early pilot access to the AI clinical documentation workspace." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <span className="inline-block px-3 py-1 text-xs font-mono rounded-full bg-primary/10 text-primary">
              Early Pilot Programme
            </span>
          </div>

          {/* Progress */}
          <Progress value={progress} className="h-1 mb-8 max-w-xs mx-auto" />

          {/* Step content */}
          <motion.div
            className="border border-border rounded-2xl bg-card p-8 shadow-card"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {getStepContent()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8">
              <Button
                variant="ghost"
                size="sm"
                onClick={back}
                disabled={step === 0}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              <span className="text-xs text-muted-foreground">
                {step + 1} of {totalSteps}
              </span>

              <Button
                size="sm"
                onClick={next}
                disabled={!canProceed() || loading}
              >
                {loading ? (
                  "Submitting..."
                ) : step === totalSteps - 1 ? (
                  <>Submit <CheckCircle2 className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          </motion.div>

          <p className="text-[10px] text-center text-muted-foreground/50 mt-6">
            Data encrypted with TLS 1.3 · DPDP / GDPR aligned · Human-in-the-loop AI
          </p>
        </div>
      </div>
    </>
  );
}
