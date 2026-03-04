import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldX } from "lucide-react";
import SEO from "@/components/SEO";

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <>
      <SEO title="Unauthorized — DATAelixAIr" description="You do not have access to this page." />
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <ShieldX className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground mb-6">
            You do not have permission to access this page. Please contact your clinic administrator if you believe this is an error.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            <Button variant="outline" onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </div>
      </div>
    </>
  );
}
