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
  ArrowRight, ArrowLeft, CheckCircle2, Search, MapPin, Loader2, X,
  Mail, Phone, Shield, Building2, FileText, Lock, KeyRound
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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

// Mock phone OTP code for pilot mode
const MOCK_PHONE_OTP = "123456";

// Platform admin emails — auto-promoted
const PLATFORM_ADMIN_EMAILS = ["raviteja@elixair.uk", "raviteja.nvr@elixair.uk", "raviteja.nvr@gmail.com"];

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

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  // Phone OTP state (mock)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Clinic search state
  const [clinicQuery, setClinicQuery] = useState("");
  const [clinicResults, setClinicResults] = useState<ClinicResult[]>([]);
  const [clinicSearching, setClinicSearching] = useState(false);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Email resend cooldown timer
  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setTimeout(() => setEmailResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailResendCooldown]);

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

  // Steps: role, name, email, email_otp, password, phone, phone_otp, license?, specialisation?, clinic
  const steps: string[] = ["role", "name", "email", "email_otp", "password", "phone", "phone_otp"];
  if (needsLicense) steps.push("license");
  if (hasSpecialisation) steps.push("specialisation");
  steps.push("clinic");

  const totalSteps = steps.length;
  const currentStepType = steps[step];
  const progress = ((step + 1) / totalSteps) * 100;

  // --- Email OTP ---
  const sendEmailOtp = async () => {
    setEmailOtpLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) {
        toast({ title: "Failed to send code", description: error.message, variant: "destructive" });
      } else {
        setEmailOtpSent(true);
        setEmailResendCooldown(60);
        toast({ title: "Verification code sent", description: `Check your inbox at ${email}` });
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (emailOtp.length !== 6) return;
    setEmailOtpLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: emailOtp,
        type: "email",
      });
      if (error) {
        toast({ title: "Invalid code", description: "Please check the code and try again.", variant: "destructive" });
      } else if (data.session) {
        setEmailVerified(true);
        toast({ title: "Email verified", description: "Your email has been confirmed." });
        // Auto-advance to next step
        setStep(s => s + 1);
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setEmailOtpLoading(false);
    }
  };

  // --- Phone OTP (Mock) ---
  const sendPhoneOtp = () => {
    setPhoneOtpSent(true);
    toast({
      title: "Pilot mode",
      description: "SMS verification is in pilot mode. Use code: 123456",
    });
  };

  const verifyPhoneOtp = () => {
    if (phoneOtp === MOCK_PHONE_OTP) {
      setPhoneVerified(true);
      toast({ title: "Phone verified", description: "Mobile number confirmed." });
      setStep(s => s + 1);
    } else {
      toast({ title: "Invalid code", description: "Please enter the correct verification code.", variant: "destructive" });
    }
  };

  const canProceed = () => {
    switch (currentStepType) {
      case "role": return !!role;
      case "name": return fullName.trim().length >= 2;
      case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      case "email_otp": return emailVerified;
      case "password": return password.length >= 6;
      case "phone": return phone.trim().length >= 10;
      case "phone_otp": return phoneVerified;
      case "license": return licenseNumber.trim().length >= 3;
      case "specialisation": return !!specialisation;
      case "clinic": return true;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // User is already signed in via email OTP — set their password
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        toast({ title: "Failed to set password", description: pwError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Session error", description: "Please try again.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());

      // Determine role mapping
      const roleMap: Record<string, string> = {
        doctor: "doctor",
        nurse: "nurse",
        pharmacist: "pharmacist",
        care_coordinator: "care_coordinator",
        admin: "clinic_admin",
      };
      const appRole = isPlatformAdmin ? "platform_admin" : (roleMap[role] || "doctor");

      // Update user metadata
      await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          role: appRole,
          role_subtype: specialisation,
          phone,
        },
      });

      // Ensure role exists
      const { data: existingRole } = await supabase.from("user_roles").select("id").eq("user_id", user.id).limit(1);
      if (!existingRole?.length) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: appRole as any });
      } else if (isPlatformAdmin) {
        await supabase.from("user_roles").update({ role: appRole as any }).eq("user_id", user.id);
      }

      // Determine email domain type
      const domain = email.split("@")[1]?.toLowerCase() || "";
      const personalDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "aol.com"];
      const emailDomainType = personalDomains.includes(domain) ? "personal" : "institutional";

      // Update profile
      const assignedStatus = isPlatformAdmin ? "approved" : "pending";
      await supabase.from("profiles").update({
        full_name: fullName,
        phone,
        email: email.trim(),
        account_status: assignedStatus,
        verification_status: "email_verified",
        email_verified: true,
        phone_verified: true,
        email_domain_type: emailDomainType,
        ...(clinicName ? { clinic_name: clinicName } : {}),
        ...(specialisation ? { role_subtype: specialisation } : {}),
        ...(licenseNumber ? { license_number: licenseNumber } : {}),
        ...(city ? { city } : {}),
        ...(clinicPhone ? { clinic_phone: clinicPhone } : {}),
      }).eq("user_id", user.id);

      // Compute trust score (non-blocking)
      try {
        await supabase.functions.invoke("compute-trust-score", {
          body: { user_id: user.id },
        });
      } catch { /* non-blocking */ }

      setSubmitted(true);
    } catch {
      toast({ title: "Registration failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    // For email step, send OTP first
    if (currentStepType === "email" && !emailOtpSent) {
      sendEmailOtp();
      setStep(s => s + 1); // Move to email_otp step
      return;
    }
    // For email_otp, verification handles step advance
    if (currentStepType === "email_otp") return;
    // For phone step, send mock OTP
    if (currentStepType === "phone" && !phoneOtpSent) {
      sendPhoneOtp();
      setStep(s => s + 1);
      return;
    }
    // For phone_otp, verification handles step advance
    if (currentStepType === "phone_otp") return;

    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const back = () => {
    if (step > 0) {
      // Skip OTP steps when going back
      const prevStep = steps[step - 1];
      if (prevStep === "email_otp" && emailVerified) {
        setStep(step - 2); // Skip back past email_otp to email
        return;
      }
      if (prevStep === "phone_otp" && phoneVerified) {
        setStep(step - 2);
        return;
      }
      setStep(step - 1);
    }
  };

  const getStepContent = () => {
    switch (currentStepType) {
      case "role":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Select your role to get started</p>
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
              <p className="text-sm text-muted-foreground mt-2">We'll send a 6-digit verification code</p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailOtpSent(false); setEmailVerified(false); setEmailOtp(""); }}
                  placeholder="you@clinic.com"
                  className="pl-10 text-base h-12"
                  autoFocus
                />
              </div>
              {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
                <p className="text-[10px] text-muted-foreground text-center">
                  {["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"].includes(email.split("@")[1]?.toLowerCase())
                    ? "📋 Personal email detected — license verification will be required"
                    : "✓ Institutional domain noted"}
                </p>
              )}
            </div>
          </div>
        );

      case "email_otp":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">Verify your email</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>
              </p>
            </div>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={emailOtp}
                onChange={setEmailOtp}
                disabled={emailVerified}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {emailVerified ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span>Email verified</span>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full h-11"
                  onClick={verifyEmailOtp}
                  disabled={emailOtp.length !== 6 || emailOtpLoading}
                >
                  {emailOtpLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Verify Code
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={sendEmailOtp}
                    disabled={emailResendCooldown > 0 || emailOtpLoading}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {emailResendCooldown > 0 ? `Resend in ${emailResendCooldown}s` : "Resend code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case "password":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold text-foreground">Create a password</h2>
              <p className="text-sm text-muted-foreground mt-2">Minimum 6 characters — for future sign-ins</p>
            </div>
            <div className="max-w-sm mx-auto">
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 text-lg h-12" minLength={6} autoFocus />
              </div>
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
            <div className="max-w-sm mx-auto space-y-3">
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="pl-10 text-base h-12" autoFocus />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                📱 SMS verification is currently in pilot mode
              </p>
            </div>
          </div>
        );

      case "phone_otp":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground">Verify your mobile</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Enter the verification code for <span className="font-medium text-foreground">{phone}</span>
              </p>
            </div>

            <div className="mx-auto max-w-sm rounded-lg border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground text-center">
                🧪 SMS verification is currently in pilot mode.<br/>
                <span className="font-semibold">Use code: 123456</span>
              </p>
            </div>

            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={phoneOtp}
                onChange={setPhoneOtp}
                disabled={phoneVerified}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            {phoneVerified ? (
              <div className="flex items-center justify-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                <span>Mobile verified</span>
              </div>
            ) : (
              <Button
                className="w-full h-11"
                onClick={verifyPhoneOtp}
                disabled={phoneOtp.length !== 6}
              >
                Verify Code
              </Button>
            )}
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
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">City</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Hyderabad, Mumbai" className="pl-10 text-sm h-11" />
                </div>
              </div>
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
    { icon: Mail, label: "Email verification", done: emailVerified },
    { icon: Phone, label: "Mobile verification", done: phoneVerified },
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
              Your account is currently under verification. You can explore the system in Demo Mode while approval is processed.
            </p>

            <div className="border border-border rounded-xl p-4 text-left space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                  Demo Mode Active
                </span>
              </div>
              <div className="space-y-2">
                {trustLayers.map((layer, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <layer.icon className="h-3.5 w-3.5" />
                    <span>{layer.label}</span>
                    <span className={`ml-auto text-[10px] ${layer.done ? "text-primary font-medium" : ""}`}>
                      {layer.done ? "✓ Verified" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60">
              Demo Mode — Real patient messaging will activate after clinic verification.
            </p>

            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate("/awaiting-approval")} className="gap-1.5">
                Explore Demo <ArrowRight className="h-4 w-4" />
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

  // Determine if the "Next" button should be shown for OTP steps
  const isOtpStep = currentStepType === "email_otp" || currentStepType === "phone_otp";
  const canGoNext = canProceed();

  return (
    <>
      <SEO title="Set Up Your Clinical Workspace — DATAelixAIr" description="Create your AI clinical workspace in under 2 minutes." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <h1 className="font-display text-lg font-bold text-foreground">Set Up Your Clinical Workspace</h1>
            <p className="text-xs text-muted-foreground mt-1">Access will be activated after quick verification</p>
          </div>

          <Progress value={progress} className="h-1 mb-8 max-w-xs mx-auto" />

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

            {/* Navigation — hide for OTP steps (they have their own buttons) */}
            {!isOtpStep && (
              <div className="flex items-center justify-between mt-8">
                <Button variant="ghost" size="sm" onClick={back} disabled={step === 0} className="text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>

                <span className="text-xs text-muted-foreground">
                  {step + 1} of {totalSteps}
                </span>

                <Button size="sm" onClick={next} disabled={!canGoNext || loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {step === totalSteps - 1 ? (
                    <>Create Workspace <CheckCircle2 className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            )}

            {/* OTP step navigation (back only) */}
            {isOtpStep && (
              <div className="flex items-center justify-between mt-8">
                <Button variant="ghost" size="sm" onClick={back} className="text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <span className="text-xs text-muted-foreground">
                  {step + 1} of {totalSteps}
                </span>
                <div className="w-16" /> {/* Spacer */}
              </div>
            )}
          </motion.div>

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
