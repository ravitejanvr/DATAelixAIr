import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Mail, Lock, LogIn } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Auth() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const totalSteps = 2;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = () => {
    if (step === 0) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (step === 1) return password.length >= 6;
    return true;
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
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
      toast({ title: "Connection error", description: "Unable to reach the server. Please check your internet connection and try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  const next = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleLogin();
    }
  };

  const back = () => step > 0 && setStep(step - 1);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canProceed() && !loading) {
      next();
    }
  };

  const getStepContent = () => {
    if (step === 0) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground mt-2">Enter your email to sign in</p>
          </div>
          <div className="max-w-sm mx-auto relative">
            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@clinic.com"
              className="pl-10 text-center text-lg h-12"
              autoFocus
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground">Enter your password</h2>
          <p className="text-sm text-muted-foreground mt-2">Signing in as <span className="text-foreground font-medium">{email}</span></p>
        </div>
        <div className="max-w-sm mx-auto relative">
          <Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="••••••••"
            className="pl-10 text-center text-lg h-12"
            autoFocus
          />
        </div>
      </div>
    );
  };

  return (
    <>
      <SEO title="Sign In — DATAelixAIr" description="Sign in to access the AI-powered clinical documentation workspace." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <span className="inline-block px-3 py-1 text-xs font-mono rounded-full bg-primary/10 text-primary">
              Clinical Workspace
            </span>
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
                  "Signing in..."
                ) : step === totalSteps - 1 ? (
                  <>Sign In <LogIn className="h-4 w-4 ml-1" /></>
                ) : (
                  <>Next <ArrowRight className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            </div>
          </motion.div>

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
        </div>
      </div>
    </>
  );
}
