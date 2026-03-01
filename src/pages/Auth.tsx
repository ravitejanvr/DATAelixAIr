import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Fingerprint, Smartphone, ScanFace, UserRound } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

type AuthMode = "signin" | "signup";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "doctor", label: "Doctor" },
  { value: "patient", label: "Patient" },
  { value: "nurse", label: "Nurse" },
  { value: "allied_health", label: "Allied Health" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "lab", label: "Lab" },
  { value: "care_coordinator", label: "Care Coordinator" },
  { value: "front_desk", label: "Front Desk" },
  { value: "admin", label: "Admin" },
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("signin");

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

  const canSignIn = useMemo(() => {
    return emailRegex.test(signInEmail) && signInPassword.length >= 6 && !loading;
  }, [signInEmail, signInPassword, loading]);

  const canSignUp = useMemo(() => {
    return signUpName.trim().length >= 2 && emailRegex.test(signUpEmail) && signUpPassword.length >= 6 && !loading;
  }, [signUpName, signUpEmail, signUpPassword, loading]);

  const getUserRole = async (userId: string): Promise<AppRole | undefined> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1);

    if (error) return undefined;
    return data?.[0]?.role;
  };

  const ensureProfileAndRole = async (userId: string) => {
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingRole?.length) {
      await supabase.from("user_roles").insert({
        user_id: userId,
        role: signUpRole,
      });
    }

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (!existingProfile?.length) {
      await supabase.from("profiles").insert({
        user_id: userId,
        full_name: signUpName,
        phone: signUpPhone || "",
      });
      return;
    }

    await supabase
      .from("profiles")
      .update({
        full_name: signUpName,
        phone: signUpPhone || "",
      })
      .eq("user_id", userId);
  };

  const routeAfterAuth = async (userId: string, fallbackRole?: AppRole) => {
    const role = fallbackRole ?? (await getUserRole(userId));
    navigate(role === "patient" ? "/patient-portal" : "/dashboard");
  };

  const handleSignIn = async () => {
    if (!canSignIn) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: signInEmail.trim(),
        password: signInPassword,
      });

      if (error) {
        toast({
          title: "Sign-in failed",
          description: error.message === "Invalid login credentials" ? "Invalid email or password." : error.message,
          variant: "destructive",
        });
        return;
      }

      await routeAfterAuth(data.user.id);
    } catch {
      toast({
        title: "Connection error",
        description: "Unable to reach authentication service. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!canSignUp) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail.trim(),
        password: signUpPassword,
        options: {
          data: {
            full_name: signUpName,
            role: signUpRole,
            phone: signUpPhone,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        toast({ title: "Registration failed", description: error.message, variant: "destructive" });
        return;
      }

      if (!data.user) {
        toast({
          title: "Registration pending",
          description: "Please verify your email, then sign in.",
        });
        setMode("signin");
        return;
      }

      if (data.session) {
        await ensureProfileAndRole(data.user.id);
        toast({ title: "Account created", description: "You’re signed in successfully." });
        await routeAfterAuth(data.user.id, signUpRole);
        return;
      }

      toast({
        title: "Account created",
        description: "Please verify your email before signing in.",
      });
      setMode("signin");
      setSignInEmail(signUpEmail.trim());
    } catch {
      toast({
        title: "Connection error",
        description: "Unable to complete registration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = () => {
    if (!window.PublicKeyCredential) {
      toast({ title: "Not supported", description: "Fingerprint login is not supported on this device/browser.", variant: "destructive" });
      return;
    }
    toast({ title: "Coming soon", description: "Fingerprint sign-in will be enabled in the next prototype step." });
  };

  const handleFaceId = () => {
    if (!window.PublicKeyCredential) {
      toast({ title: "Not supported", description: "Face ID is not supported on this device/browser.", variant: "destructive" });
      return;
    }
    toast({ title: "Coming soon", description: "Face ID sign-in will be enabled in the next prototype step." });
  };

  const handleOtp = () => {
    toast({ title: "Coming soon", description: "Mobile OTP sign-in will be enabled in the next prototype step." });
  };

  const handleEnter = (e: React.KeyboardEvent, action: "signin" | "signup") => {
    if (e.key !== "Enter") return;
    if (action === "signin") handleSignIn();
    if (action === "signup") handleSignUp();
  };

  return (
    <>
      <SEO title="Sign In — DATAelixAIr" description="Sign in or register to access your AI-powered clinical workspace." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="max-w-md w-full"
        >
          <div className="text-center mb-7">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <h1 className="font-display text-2xl font-bold text-foreground">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-muted-foreground mt-1">Fast access to your clinical workspace</p>
          </div>

          <div className="border border-border rounded-2xl bg-card p-6 shadow-card space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <Button
                type="button"
                variant={mode === "signin" ? "default" : "ghost"}
                className="h-9"
                onClick={() => setMode("signin")}
                disabled={loading}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === "signup" ? "default" : "ghost"}
                className="h-9"
                onClick={() => setMode("signup")}
                disabled={loading}
              >
                Register
              </Button>
            </div>

            {mode === "signin" ? (
              <>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    onKeyDown={(e) => handleEnter(e, "signin")}
                    placeholder="you@clinic.com"
                    className="pl-10 h-11"
                    autoFocus
                    autoComplete="email"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    onKeyDown={(e) => handleEnter(e, "signin")}
                    placeholder="Password"
                    className="pl-10 h-11"
                    autoComplete="current-password"
                  />
                </div>

                <Button className="w-full h-11" onClick={handleSignIn} disabled={!canSignIn}>
                  {loading ? "Signing in…" : <>Sign In <LogIn className="h-4 w-4 ml-2" /></>}
                </Button>
              </>
            ) : (
              <>
                <div className="relative">
                  <UserRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    onKeyDown={(e) => handleEnter(e, "signup")}
                    placeholder="Full name"
                    className="pl-10 h-11"
                    autoFocus
                    autoComplete="name"
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    onKeyDown={(e) => handleEnter(e, "signup")}
                    placeholder="you@clinic.com"
                    className="pl-10 h-11"
                    autoComplete="email"
                  />
                </div>

                <div className="relative">
                  <Smartphone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    value={signUpPhone}
                    onChange={(e) => setSignUpPhone(e.target.value)}
                    onKeyDown={(e) => handleEnter(e, "signup")}
                    placeholder="Mobile number (optional)"
                    className="pl-10 h-11"
                    autoComplete="tel"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    onKeyDown={(e) => handleEnter(e, "signup")}
                    placeholder="Create password (min 6 chars)"
                    className="pl-10 h-11"
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select your role</p>
                  <div className="grid grid-cols-3 gap-2">
                    {ROLE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={signUpRole === option.value ? "default" : "outline"}
                        className="h-9 text-xs"
                        onClick={() => setSignUpRole(option.value)}
                        disabled={loading}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button className="w-full h-11" onClick={handleSignUp} disabled={!canSignUp}>
                  {loading ? "Creating account…" : "Create account"}
                </Button>
              </>
            )}

            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-10 text-xs" onClick={handleBiometric}>
                <Fingerprint className="h-4 w-4 mr-1" />
                Fingerprint
              </Button>
              <Button variant="outline" className="h-10 text-xs" onClick={handleFaceId}>
                <ScanFace className="h-4 w-4 mr-1" />
                Face ID
              </Button>
              <Button variant="outline" className="h-10 text-xs" onClick={handleOtp}>
                <Smartphone className="h-4 w-4 mr-1" />
                OTP
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-center text-muted-foreground/50 mt-3">
            Data encrypted with TLS 1.3 · DPDP / GDPR aligned · Human-in-the-loop AI
          </p>
        </motion.div>
      </div>
    </>
  );
}
