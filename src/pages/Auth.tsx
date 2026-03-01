import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion } from "framer-motion";
import { Mail, Lock, LogIn, Fingerprint, Smartphone } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const canSubmit = isEmailValid && isPasswordValid && !loading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === "Invalid login credentials") {
          toast({ title: "Invalid credentials", description: "Please check your email and password.", variant: "destructive" });
        } else {
          toast({ title: "Login failed", description: error.message, variant: "destructive" });
        }
        setLoading(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const userRole = roles?.[0]?.role;
      navigate(userRole === "patient" ? "/patient-portal" : "/dashboard");
    } catch (err) {
      toast({
        title: "Connection error",
        description: "Unable to reach the server. Please check your connection and try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) handleLogin();
  };

  const handleBiometric = () => {
    if (!window.PublicKeyCredential) {
      toast({ title: "Not supported", description: "Biometric login is not supported on this device/browser.", variant: "destructive" });
      return;
    }
    toast({ title: "Coming soon", description: "Biometric authentication will be available in a future update." });
  };

  const handleOtp = () => {
    toast({ title: "Coming soon", description: "OTP login via mobile will be available in a future update." });
  };

  return (
    <>
      <SEO title="Sign In — DATAelixAIr" description="Sign in to access the AI-powered clinical documentation workspace." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-sm w-full"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <h1 className="font-display text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your clinical workspace</p>
          </div>

          {/* Form */}
          <div className="border border-border rounded-2xl bg-card p-6 shadow-card space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="you@clinic.com"
                className="pl-10 h-11"
                autoFocus
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Password"
                className="pl-10 h-11"
                autoComplete="current-password"
              />
            </div>

            {/* Sign In Button */}
            <Button
              className="w-full h-11"
              onClick={handleLogin}
              disabled={!canSubmit}
            >
              {loading ? "Signing in…" : (
                <>Sign In <LogIn className="h-4 w-4 ml-2" /></>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Biometric & OTP */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-11 text-sm"
                onClick={handleBiometric}
              >
                <Fingerprint className="h-4 w-4 mr-2" />
                Biometric
              </Button>
              <Button
                variant="outline"
                className="h-11 text-sm"
                onClick={handleOtp}
              >
                <Smartphone className="h-4 w-4 mr-2" />
                OTP
              </Button>
            </div>
          </div>

          {/* Footer links */}
          <p className="text-sm text-center text-muted-foreground mt-6">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/onboard")}
              className="text-primary hover:underline font-medium"
            >
              Request pilot access
            </button>
          </p>

          <p className="text-[10px] text-center text-muted-foreground/50 mt-3">
            Data encrypted with TLS 1.3 · DPDP / GDPR aligned · Human-in-the-loop AI
          </p>
        </motion.div>
      </div>
    </>
  );
}
