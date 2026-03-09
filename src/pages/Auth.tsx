import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, UserRound, Smartphone } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type AuthMode = "signin" | "signup";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "clinic_admin", label: "Clinic Admin" },
  { value: "patient", label: "Patient" },
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPhone, setSignUpPhone] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpRole, setSignUpRole] = useState<AppRole>("doctor");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) checkApprovalAndRoute(data.session.user.id);
    });
  }, []);

  const canSignIn = useMemo(() => emailRegex.test(signInEmail) && signInPassword.length >= 6 && !loading, [signInEmail, signInPassword, loading]);
  const canSignUp = useMemo(() => signUpName.trim().length >= 2 && emailRegex.test(signUpEmail) && signUpPassword.length >= 6 && !loading, [signUpName, signUpEmail, signUpPassword, loading]);

  const getUserRole = async (userId: string): Promise<AppRole | undefined> => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1);
    return data?.[0]?.role;
  };

  // Designated platform admin emails — auto-promoted on registration
  const PLATFORM_ADMIN_EMAILS = ["raviteja@elixair.uk", "raviteja.nvr@elixair.uk", "raviteja.nvr@gmail.com"];

  const ensureProfileAndRole = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("ensure-profile-role", {
      body: {
        full_name: signUpName,
        phone: signUpPhone || "",
        role: signUpRole,
        email: signUpEmail.trim(),
      },
    });
    if (error) console.error("ensure-profile-role error:", error);
    if (data?.error) console.error("ensure-profile-role data error:", data.error);
  };

  const checkApprovalAndRoute = async (userId: string, fallbackRole?: AppRole) => {
    // Check account_status
    const { data: profile } = await supabase.from("profiles").select("account_status").eq("user_id", userId).maybeSingle();
    const status = (profile as any)?.account_status;

    // Platform admins bypass approval
    const role = fallbackRole ?? (await getUserRole(userId));
    if (role === "platform_admin") {
      navigate("/platform-admin");
      return;
    }

    if (status !== "approved") {
      navigate("/awaiting-approval");
      return;
    }

    switch (role) {
      case "clinic_admin": navigate("/dashboard"); break;
      case "nurse": navigate("/vitals"); break;
      case "patient": navigate("/patient-portal"); break;
      case "receptionist": navigate("/dashboard"); break;
      case "pharmacist": navigate("/prescriptions"); break;
      default: navigate("/dashboard"); break;
    }
  };

  const handleSignIn = async () => {
    if (!canSignIn) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: signInEmail.trim(), password: signInPassword });
      if (error) { toast({ title: "Sign-in failed", description: error.message === "Invalid login credentials" ? "Invalid email or password." : error.message, variant: "destructive" }); return; }
      await checkApprovalAndRoute(data.user.id);
    } catch { toast({ title: "Connection error", description: "Unable to reach authentication service.", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleSignUp = async () => {
    if (!canSignUp) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(), password: signUpPassword,
        options: { data: { full_name: signUpName, role: signUpRole, phone: signUpPhone }, emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) { toast({ title: "Registration failed", description: error.message, variant: "destructive" }); return; }
      if (data.user?.identities?.length === 0) {
        toast({ title: "Account already exists", description: "Please sign in instead.", variant: "destructive" });
        setMode("signin"); setSignInEmail(signUpEmail.trim()); return;
      }
      if (!data.user) { toast({ title: "Registration pending", description: "Please verify your email." }); setMode("signin"); return; }
      if (data.session) {
        await ensureProfileAndRole(data.user.id);
        toast({ title: "Account created", description: "Your account is pending administrator approval." });
        navigate("/awaiting-approval");
        return;
      }
      toast({ title: "Account created", description: "Please verify your email. Your account will then await administrator approval." });
      setMode("signin"); setSignInEmail(signUpEmail.trim());
    } catch { toast({ title: "Connection error", description: "Unable to complete registration.", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!emailRegex.test(signInEmail)) {
      toast({ title: "Enter your email", description: "Type your email address above, then click Forgot Password.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(signInEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Reset email sent", description: "Check your inbox for a password reset link." });
        setShowForgotPassword(false);
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEnter = (e: React.KeyboardEvent, action: "signin" | "signup") => {
    if (e.key !== "Enter") return;
    if (action === "signin") handleSignIn();
    if (action === "signup") handleSignUp();
  };

  return (
    <>
      <SEO title="Sign In — DATAelixAIr" description="Sign in to your Clinical Writing & Workflow Workspace." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-md w-full">
          <div className="text-center mb-7">
            <div className="flex items-center justify-center gap-3 mb-3">
              <img src={brainLogo} alt="DATAelixAIr Logo" className="h-10" />
              <span className="font-display text-xl font-bold tracking-tight text-foreground">DATAelixAIr<sup className="text-[0.5em] text-muted-foreground">™</sup></span>
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Clinical Writing & Workflow Workspace</p>
          </div>

          <div className="border border-border rounded-2xl bg-card p-6 shadow-card space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <Button type="button" variant={mode === "signin" ? "default" : "ghost"} className="h-9" onClick={() => setMode("signin")} disabled={loading}>Sign in</Button>
              <Button type="button" variant={mode === "signup" ? "default" : "ghost"} className="h-9" onClick={() => setMode("signup")} disabled={loading}>Register</Button>
            </div>

            {mode === "signin" ? (
              <>
                <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="email" value={signInEmail} onChange={e => setSignInEmail(e.target.value)} onKeyDown={e => handleEnter(e, "signin")} placeholder="you@clinic.com" className="pl-10 h-11" autoFocus autoComplete="email" /></div>
                <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="password" value={signInPassword} onChange={e => setSignInPassword(e.target.value)} onKeyDown={e => handleEnter(e, "signin")} placeholder="Password" className="pl-10 h-11" autoComplete="current-password" /></div>
                <Button className="w-full h-11" onClick={handleSignIn} disabled={!canSignIn}>{loading ? "Signing in…" : <>Sign In <LogIn className="h-4 w-4 ml-2" /></>}</Button>
                <button type="button" onClick={handleForgotPassword} className="w-full text-xs text-muted-foreground hover:text-primary transition-colors" disabled={loading}>
                  Forgot password?
                </button>
              </>
            ) : (
              <>
                <div className="relative"><UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={signUpName} onChange={e => setSignUpName(e.target.value)} onKeyDown={e => handleEnter(e, "signup")} placeholder="Full name" className="pl-10 h-11" autoFocus autoComplete="name" /></div>
                <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="email" value={signUpEmail} onChange={e => setSignUpEmail(e.target.value)} onKeyDown={e => handleEnter(e, "signup")} placeholder="you@clinic.com" className="pl-10 h-11" autoComplete="email" /></div>
                <div className="relative"><Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="tel" value={signUpPhone} onChange={e => setSignUpPhone(e.target.value)} placeholder="Mobile (optional)" className="pl-10 h-11" autoComplete="tel" /></div>
                <div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input type="password" value={signUpPassword} onChange={e => setSignUpPassword(e.target.value)} onKeyDown={e => handleEnter(e, "signup")} placeholder="Password (min 6 chars)" className="pl-10 h-11" autoComplete="new-password" /></div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select your role</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map(option => (
                      <Button key={option.value} type="button" variant={signUpRole === option.value ? "default" : "outline"} className="h-9 text-xs" onClick={() => setSignUpRole(option.value)} disabled={loading}>{option.label}</Button>
                    ))}
                  </div>
                </div>
                <Button className="w-full h-11" onClick={handleSignUp} disabled={!canSignUp}>{loading ? "Creating account…" : "Create account"}</Button>
              </>
            )}
          </div>

          <p className="text-[10px] text-center text-muted-foreground/50 mt-3">
            Built with healthcare-aligned security principles · Minimal necessary data · Clinic-controlled
          </p>
        </motion.div>
      </div>
    </>
  );
}
