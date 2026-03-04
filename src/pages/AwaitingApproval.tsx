import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";

export default function AwaitingApproval() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <SEO title="Awaiting Approval — DATAelixAIr" description="Your pilot access is pending approval." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <img src={brainLogo} alt="DATAelixAIr" className="h-12 mx-auto mb-4" />
          <Clock className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Awaiting Approval</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your clinic pilot request is being reviewed. You'll receive access once approved by our team.
            This typically takes 1–2 business days.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>Back to Website</Button>
            <Button variant="ghost" onClick={() => { signOut(); navigate("/auth"); }}>Sign Out</Button>
          </div>
        </div>
      </div>
    </>
  );
}
