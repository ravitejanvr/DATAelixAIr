import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, RefreshCw } from "lucide-react";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";

export default function AwaitingApproval() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const { data } = await supabase.from("profiles").select("account_status, clinic_id").eq("user_id", user.id).maybeSingle();
      if ((data as any)?.account_status === "approved") {
        // Approved — route to workspace
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1);
        const role = roleData?.[0]?.role;
        switch (role) {
          case "platform_admin": navigate("/platform-admin"); break;
          case "nurse": navigate("/vitals"); break;
          case "patient": navigate("/patient-portal"); break;
          default: navigate("/dashboard"); break;
        }
      } else if ((data as any)?.account_status === "rejected") {
        // Account was rejected
      }
    } finally {
      setChecking(false);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <>
      <SEO title="Awaiting Approval — DATAelixAIr" description="Your account is pending administrator approval." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <img src={brainLogo} alt="DATAelixAIr" className="h-12 mx-auto mb-4" />
          <Clock className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Awaiting Administrator Approval</h1>
          <p className="text-sm text-muted-foreground mb-2">
            Your account has been registered successfully. An administrator must approve your account
            and assign you to a clinic before you can access the clinical workspace.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            This page will automatically check for approval. You can also check manually below.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={checkStatus} disabled={checking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
              {checking ? "Checking…" : "Check Status"}
            </Button>
            <Button variant="ghost" onClick={() => { signOut(); navigate("/auth"); }}>Sign Out</Button>
          </div>
        </div>
      </div>
    </>
  );
}
