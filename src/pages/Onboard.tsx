import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, HeartPulse, CalendarCheck, Settings,
  CheckCircle2, Loader2, Mail, Phone, KeyRound, Sparkles
} from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

// Mock phone OTP code for pilot mode
const MOCK_PHONE_OTP = "123456";

// Platform admin emails — auto-promoted
const PLATFORM_ADMIN_EMAILS = ["raviteja@elixair.uk", "raviteja.nvr@elixair.uk", "raviteja.nvr@gmail.com"];

const ROLES = [
  { key: "doctor", icon: Stethoscope, label: "Doctor" },
  { key: "nurse", icon: HeartPulse, label: "Nurse" },
  { key: "front_desk", icon: CalendarCheck, label: "Front Desk" },
  { key: "admin", icon: Settings, label: "Admin" },
] as const;

export default function Onboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("doctor");

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  // Phone OTP state (mock)
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  // Final state
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  // Email resend cooldown timer
  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setTimeout(() => setEmailResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailResendCooldown]);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = phone.trim().length >= 10;
  const isFullyVerified = emailVerified && phoneVerified;

  // --- Email OTP ---
  const sendEmailOtp = async () => {
    if (!isValidEmail) return;
    setEmailLoading(true);
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
        toast({ title: "Code sent", description: `Check your inbox at ${email}` });
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (emailOtp.length !== 6) return;
    setEmailLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: emailOtp,
        type: "email",
      });
      if (error) {
        toast({ title: "Invalid code", description: "Please check and try again.", variant: "destructive" });
      } else if (data.session) {
        setEmailVerified(true);
        toast({ title: "Email verified" });
      }
    } catch {
      toast({ title: "Verification failed", variant: "destructive" });
    } finally {
      setEmailLoading(false);
    }
  };

  // --- Phone OTP (Mock) ---
  const sendPhoneOtp = () => {
    if (!isValidPhone) return;
    setPhoneOtpSent(true);
    toast({
      title: "Pilot mode",
      description: "SMS verification is in pilot mode. Use code: 123456",
    });
  };

  const verifyPhoneOtp = () => {
    if (phoneOtp === MOCK_PHONE_OTP) {
      setPhoneVerified(true);
      toast({ title: "Phone verified" });
    } else {
      toast({ title: "Invalid code", description: "Use code: 123456", variant: "destructive" });
    }
  };

  // --- Create workspace and start consultation ---
  const startFirstConsultation = async () => {
    setCreatingWorkspace(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Session error", description: "Please refresh and try again.", variant: "destructive" });
        setCreatingWorkspace(false);
        return;
      }

      const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
      const roleMap: Record<string, string> = {
        doctor: "doctor",
        nurse: "nurse",
        front_desk: "front_desk",
        admin: "clinic_admin",
      };
      const appRole = isPlatformAdmin ? "platform_admin" : (roleMap[role] || "doctor");
      const assignedStatus = isPlatformAdmin ? "approved" : "pending";

      // Determine email domain type
      const domain = email.split("@")[1]?.toLowerCase() || "";
      const personalDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "aol.com"];
      const emailDomainType = personalDomains.includes(domain) ? "personal" : "institutional";

      // 1. Create clinic workspace
      const clinicName = `${email.split("@")[0]}'s Clinic`;
      const { data: clinic, error: clinicErr } = await supabase
        .from("clinics")
        .insert({ name: clinicName, status: "pending" })
        .select("id")
        .single();

      if (clinicErr) {
        console.error("Clinic creation failed:", clinicErr);
        toast({ title: "Setup failed", description: "Could not create workspace.", variant: "destructive" });
        setCreatingWorkspace(false);
        return;
      }

      const clinicId = clinic.id;

      // 2. Ensure user role
      const { data: existingRole } = await supabase.from("user_roles").select("id").eq("user_id", user.id).limit(1);
      if (!existingRole?.length) {
        await supabase.from("user_roles").insert({ user_id: user.id, role: appRole as any });
      }

      // 3. Update profile
      await supabase.from("profiles").update({
        full_name: email.split("@")[0],
        email: email.trim(),
        phone,
        account_status: assignedStatus,
        verification_status: "email_verified",
        email_verified: true,
        phone_verified: true,
        email_domain_type: emailDomainType,
        clinic_id: clinicId,
        role_subtype: role,
      }).eq("user_id", user.id);

      // 4. Add to clinic_members
      await supabase.from("clinic_members").insert({
        user_id: user.id,
        clinic_id: clinicId,
        role: appRole === "clinic_admin" ? "admin" : "staff",
        is_primary: true,
      });

      // 5. Create demo patient
      const { data: demoPatient } = await supabase
        .from("patients")
        .insert({
          name: "Demo Patient",
          age: 35,
          gender: "Male",
          phone: "+91 98765 00000",
          doctor_id: user.id,
          clinic_id: clinicId,
          allergies: ["Penicillin"],
          medical_history: [{ condition: "Hypertension", since: "2020" }],
        })
        .select("id")
        .single();

      // 6. Create demo visit
      if (demoPatient) {
        await supabase.from("patient_visits").insert({
          patient_id: demoPatient.id,
          clinic_id: clinicId,
          status: "in_consultation",
          chief_complaint: "Headache and mild fever for 2 days",
          visit_type: "walk-in",
        });
      }

      // 7. Create workflow config
      await supabase.from("clinic_workflow_config").insert({
        clinic_id: clinicId,
        workflow_mode: "doctor_only",
      });

      // 8. Compute trust score (non-blocking)
      supabase.functions.invoke("compute-trust-score", { body: { user_id: user.id } }).catch(() => {});

      toast({ title: "Workspace ready", description: "Opening your first consultation..." });

      // Navigate to clinical cockpit
      if (isPlatformAdmin) {
        navigate("/platform-admin");
      } else {
        navigate("/clinical");
      }
    } catch (err) {
      console.error("Workspace creation error:", err);
      toast({ title: "Setup failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setCreatingWorkspace(false);
    }
  };

  return (
    <>
      <SEO title="Get Started — DATAelixAIr" description="Start your first AI consultation in 60 seconds." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <img src={brainLogo} alt="DATAelixAIr" className="h-12 mx-auto mb-4" />
            <h1 className="font-display text-2xl font-bold text-foreground">Start Your First Consultation</h1>
            <p className="text-sm text-muted-foreground mt-2">AI clinical notes in under 60 seconds</p>
          </div>

          {/* Main card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-border rounded-2xl bg-card p-6 shadow-card space-y-6"
          >
            {/* Email Section */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                Email
                {emailVerified && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
              </label>

              {!emailVerified ? (
                <>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailOtpSent(false); setEmailOtp(""); }}
                      placeholder="you@clinic.com"
                      className="h-11"
                      disabled={emailOtpSent}
                    />
                    {!emailOtpSent && (
                      <Button
                        onClick={sendEmailOtp}
                        disabled={!isValidEmail || emailLoading}
                        className="shrink-0 h-11"
                      >
                        {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Code"}
                      </Button>
                    )}
                  </div>

                  <AnimatePresence>
                    {emailOtpSent && !emailVerified && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3"
                      >
                        <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to {email}</p>
                        <div className="flex items-center gap-3">
                          <InputOTP maxLength={6} value={emailOtp} onChange={setEmailOtp}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                          <Button
                            size="sm"
                            onClick={verifyEmailOtp}
                            disabled={emailOtp.length !== 6 || emailLoading}
                          >
                            {emailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={sendEmailOtp}
                          disabled={emailResendCooldown > 0 || emailLoading}
                          className="text-[11px] text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                        >
                          {emailResendCooldown > 0 ? `Resend in ${emailResendCooldown}s` : "Resend code"}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <span>{email}</span>
                  <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                </div>
              )}
            </div>

            {/* Phone Section — only show after email verified */}
            <AnimatePresence>
              {emailVerified && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    Mobile
                    {phoneVerified && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto" />}
                  </label>

                  {!phoneVerified ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          type="tel"
                          value={phone}
                          onChange={(e) => { setPhone(e.target.value); setPhoneOtpSent(false); setPhoneOtp(""); }}
                          placeholder="+91 98765 43210"
                          className="h-11"
                          disabled={phoneOtpSent}
                        />
                        {!phoneOtpSent && (
                          <Button
                            onClick={sendPhoneOtp}
                            disabled={!isValidPhone}
                            className="shrink-0 h-11"
                          >
                            Send Code
                          </Button>
                        )}
                      </div>

                      <AnimatePresence>
                        {phoneOtpSent && !phoneVerified && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-3"
                          >
                            <div className="rounded-lg border border-border bg-muted/50 p-2 text-center">
                              <p className="text-[11px] text-muted-foreground">
                                🧪 Pilot mode — Use code: <span className="font-semibold text-foreground">123456</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <InputOTP maxLength={6} value={phoneOtp} onChange={setPhoneOtp}>
                                <InputOTPGroup>
                                  <InputOTPSlot index={0} />
                                  <InputOTPSlot index={1} />
                                  <InputOTPSlot index={2} />
                                  <InputOTPSlot index={3} />
                                  <InputOTPSlot index={4} />
                                  <InputOTPSlot index={5} />
                                </InputOTPGroup>
                              </InputOTP>
                              <Button
                                size="sm"
                                onClick={verifyPhoneOtp}
                                disabled={phoneOtp.length !== 6}
                              >
                                Verify
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2">
                      <span>{phone}</span>
                      <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Role Selection — only show after both verified */}
            <AnimatePresence>
              {isFullyVerified && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <label className="text-xs font-medium text-muted-foreground">Your role</label>
                  <div className="grid grid-cols-4 gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRole(r.key)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          role === r.key
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border hover:border-primary/40 text-muted-foreground"
                        }`}
                      >
                        <r.icon className={`h-5 w-5 ${role === r.key ? "text-primary" : ""}`} />
                        <span className="text-[10px] font-medium">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Start Consultation CTA — only show after fully verified */}
            <AnimatePresence>
              {isFullyVerified && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-2"
                >
                  <Button
                    className="w-full h-12 text-base gap-2"
                    onClick={startFirstConsultation}
                    disabled={creatingWorkspace}
                  >
                    {creatingWorkspace ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Creating workspace...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Start Your First Consultation
                      </>
                    )}
                  </Button>

                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">Demo Mode</span> — Real patient messaging activates after clinic verification.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Footer */}
          <div className="text-center mt-6 space-y-3">
            <p className="text-[10px] text-muted-foreground/60">
              Secure verification • Demo workspace • Full AI workflow
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
