import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, HeartPulse, Pill, CalendarCheck, Settings,
  ArrowRight, ArrowLeft, CheckCircle2, Search, MapPin, Loader2, X, Star,
  Mail, Phone, Shield, Building2, FileText, User
} from "lucide-react";
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
  ],
  pharmacist: [
    { value: "pharmacist", label: "Pharmacist" },
    { value: "lab_technician", label: "Lab Technician" },
  ],
  care_coordinator: [
    { value: "care_coordinator", label: "Care Coordinator" },
    { value: "front_desk", label: "Front Desk / Reception" },
  ],
};

export default function Onboard() {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [specialisation, setSpecialisation] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [city, setCity] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
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
  const needsLicense = role === "doctor";

  // Steps: 0=Role, 1=Name, 2=Email, 3=Password, 4=Phone, 5=License(doctor), 6=Specialisation(if applicable), 7=Clinic+City
  const steps: string[] = ["role", "name", "email", "password", "phone"];
  if (needsLicense) steps.push("license");
  if (hasSpecialisation) steps.push("specialisation");
  steps.push("clinic");

  const totalSteps = steps.length;
  const currentStepType = steps[step];
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    switch (currentStepType) {
      case "role": return !!role;
      case "name": return fullName.trim().length >= 2;
      case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      case "password": return password.length >= 6;
      case "phone": return phone.trim().length >= 10;
      case "license": return licenseNumber.trim().length >= 3;
      case "specialisation": return !!specialisation;
      case "clinic": return true;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          role_subtype: specialisation,
          clinic_name: clinicName,
          phone,
        },
        emailRedirectTo: window.location.origin + "/auth",
      },
    });
    setLoading(false);

    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      toast({
        title: "Account already exists",
        description: "This email is already registered. Please log in instead.",
        variant: "destructive",
      });
      return;
    }

    // Update profile with additional fields
    if (data.user) {
      await supabase.from("profiles").update({
        ...(clinicName ? { clinic_name: clinicName } : {}),
        ...(specialisation ? { role_subtype: specialisation } : {}),
        ...(phone ? { phone } : {}),
        ...(licenseNumber ? { license_number: licenseNumber } : {}),
        ...(city ? { city } : {}),
        ...(clinicPhone ? { clinic_phone: clinicPhone } : {}),
      }).eq("user_id", data.user.id);

      // Compute trust score
      try {
        await supabase.functions.invoke("compute-trust-score", {
          body: { user_id: data.user.id },
        });
      } catch { /* non-blocking */ }
    }

    setSubmitted(true);
  };

  const next = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const back = () => step > 0 && setStep(step - 1);

  const getStepContent = () => {
    switch (currentStepType) {
      case "role":
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

      case "name":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">What's your full name?</h2>
              <p className="text-sm text-muted-foreground mt-2">As it appears on your professional registration</p>
            </div>
            <div className="max-w-sm mx-auto">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. / Mr. / Ms." className="text-center text-lg h-12" autoFocus />
            </div>
          </div>
        );

      case "email":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">Your email address</h2>
              <p className="text-sm text-muted-foreground mt-2">We'll send a verification code to confirm</p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" className="pl-10 text-base h-12" autoFocus />
              </div>
              {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <p className="text-[10px] text-muted-foreground text-center">
                  {["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(email.split("@")[1]?.toLowerCase())
                    ? "📋 Personal email detected — license verification will be required"
                    : "✓ Domain noted for verification"}
                </p>
              )}
            </div>
          </div>
        );

      case "password":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">Create a password</h2>
              <p className="text-sm text-muted-foreground mt-2">Minimum 6 characters</p>
            </div>
            <div className="max-w-sm mx-auto">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="text-center text-lg h-12" minLength={6} autoFocus />
            </div>
          </div>
        );

      case "phone":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">Your mobile number</h2>
              <p className="text-sm text-muted-foreground mt-2">Used for verification and clinical notifications</p>
            </div>
            <div className="max-w-sm mx-auto">
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="pl-10 text-base h-12" autoFocus />
              </div>
            </div>
          </div>
        );

      case "license":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">Medical license number</h2>
              <p className="text-sm text-muted-foreground mt-2">Your NMC / State Medical Council registration number</p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <div className="relative">
                <FileText className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="e.g. MCI-12345 or KMC-67890" className="pl-10 text-base h-12" autoFocus />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                License will be verified during admin review. This helps us ensure clinical safety.
              </p>
            </div>
          </div>
        );

      case "specialisation":
        const specs = SPECIALISATIONS[role] || [];
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

      case "clinic":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">Clinic details</h2>
              <p className="text-sm text-muted-foreground mt-2">Help us set up your workspace</p>
            </div>
            <div className="max-w-sm mx-auto space-y-4">
              {/* Clinic search */}
              <div ref={wrapperRef} className="relative">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Clinic / Organisation name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={clinicName || clinicQuery}
                    onChange={(e) => handleClinicInput(e.target.value)}
                    onFocus={() => clinicResults.length > 0 && setShowClinicDropdown(true)}
                    placeholder="Search clinic or type name..."
                    className="pl-10 pr-8 text-sm h-11"
                  />
                  {clinicName && (
                    <button type="button" onClick={() => { setClinicName(""); setClinicQuery(""); setClinicResults([]); }} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {clinicSearching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-primary" />}
                </div>
                {showClinicDropdown && clinicResults.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-background border border-border rounded-lg shadow-lg max-h-36 overflow-y-auto">
                    {clinicResults.map((c) => (
                      <button key={c.place_id} type="button" onClick={() => selectClinic(c)} className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border last:border-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.address}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* City */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Hyderabad, Mumbai" className="pl-10 text-sm h-11" />
                </div>
              </div>

              {/* Clinic phone */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Clinic phone (optional)</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="tel" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="Clinic landline or mobile" className="pl-10 text-sm h-11" />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Trust layer indicators
  const trustLayers = [
    { icon: Mail, label: "Email verification", done: false },
    { icon: Phone, label: "Mobile verification", done: false },
    { icon: Building2, label: "Clinic verification", done: false },
    { icon: Shield, label: "Admin approval", done: false },
  ];

  if (submitted) {
    return (
      <>
        <SEO title="Workspace Created — DATAelixAIr" description="Your clinical workspace is being set up." />
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="text-primary" size={32} />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Your Clinic Workspace Is Ready</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your account is currently under verification. You can explore the system while approval is processed.
            </p>

            {/* Verification status */}
            <div className="border border-border rounded-xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                  Verification Pending
                </span>
              </div>
              <div className="space-y-2">
                {trustLayers.map((layer, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <layer.icon className="h-3.5 w-3.5" />
                    <span>{layer.label}</span>
                    <span className="ml-auto text-[10px]">Pending</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60">
              Please check your email to verify your account. Our team will review your application.
            </p>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate("/auth")} className="gap-1.5">
                Sign In <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                Return Home
              </Button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Set Up Your Clinical Workspace — DATAelixAIr" description="Create your AI clinical workspace in under 2 minutes." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <h1 className="font-display text-lg font-bold text-foreground">Set Up Your Clinical Workspace</h1>
            <p className="text-xs text-muted-foreground mt-1">Access will be activated after quick verification</p>
          </div>

          {/* Progress */}
          <Progress value={progress} className="h-1 mb-8 max-w-xs mx-auto" />

          {/* Step content */}
          <motion.div className="border border-border rounded-2xl bg-card p-8 shadow-card">
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
              <Button variant="ghost" size="sm" onClick={back} disabled={step === 0} className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              <span className="text-xs text-muted-foreground">
                {step + 1} of {totalSteps}
              </span>

              <Button size="sm" onClick={next} disabled={!canProceed() || loading}>
                {loading ? "Creating workspace…" : step === totalSteps - 1 ? (
                  <>Create Workspace <CheckCircle2 className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Trust signal */}
          <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> 3-layer verification</span>
            <span>·</span>
            <span>Takes ~2 minutes</span>
          </div>

          <p className="text-center mt-3">
            <button onClick={() => navigate("/auth")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Already have an account? Log in
            </button>
          </p>
        </div>
      </div>
    </>
  );
}
