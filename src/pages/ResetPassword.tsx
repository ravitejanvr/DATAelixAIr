import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion } from "framer-motion";
import { Lock, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for recovery event from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (hashParams.get("type") === "recovery") {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (password.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      } else {
        setDone(true);
        toast({ title: "Password updated", description: "You can now sign in with your new password." });
        setTimeout(() => navigate("/auth"), 2000);
      }
    } catch {
      toast({ title: "Connection error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO title="Reset Password — DATAelixAIr" description="Set your new password." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="max-w-md w-full">
          <div className="text-center mb-7">
            <img src={brainLogo} alt="DATAelixAIr" className="h-10 mx-auto mb-3" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              {done ? "Password Updated" : "Set New Password"}
            </h1>
          </div>

          <div className="border border-border rounded-2xl bg-card p-6 shadow-card space-y-4">
            {done ? (
              <div className="text-center py-4 space-y-3">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-sm text-muted-foreground">Redirecting to sign in…</p>
              </div>
            ) : !isRecovery ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-sm text-muted-foreground">Invalid or expired reset link.</p>
                <Button variant="outline" onClick={() => navigate("/auth")}>Back to Sign In</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password (min 6 chars)" className="pl-10 h-11" autoFocus autoComplete="new-password" />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleReset()} placeholder="Confirm new password" className="pl-10 h-11" autoComplete="new-password" />
                </div>
                <Button className="w-full h-11" onClick={handleReset} disabled={loading || password.length < 6}>
                  {loading ? "Updating…" : "Update Password"}
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
