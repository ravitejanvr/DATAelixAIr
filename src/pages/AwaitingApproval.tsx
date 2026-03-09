import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock, RefreshCw, Mic, FileText, Pill, FlaskConical,
  MessageSquare, CreditCard, Shield, CheckCircle2, ArrowRight,
  Stethoscope, Activity, Brain, ChevronRight
} from "lucide-react";
import SEO from "@/components/SEO";
import brainLogo from "@/assets/brain-logo-nobg.png";
import { motion } from "framer-motion";

// Demo consultation data
const DEMO_TRANSCRIPT = `Patient: Doctor, I've been having a headache for the past 3 days, mostly on the right side. It gets worse in the evenings.
Doctor: I see. Any nausea or visual changes?
Patient: No nausea, but sometimes I feel a bit dizzy when I stand up quickly.
Doctor: Have you been taking any medications?
Patient: Just paracetamol, but it only helps for a few hours.`;

const DEMO_SOAP = {
  subjective: "Patient reports 3-day history of right-sided headache, worse in evenings. Associated postural dizziness. Partial relief with paracetamol. Denies nausea or visual disturbance.",
  objective: "Alert, oriented. Vitals: BP 130/85, Pulse 78, Temp 98.4°F. No papilledema. No focal neurological deficits.",
  assessment: "Tension-type headache. Rule out secondary causes if persistent. Postural dizziness may suggest mild dehydration or orthostatic component.",
  plan: "1. Continue paracetamol 500mg PRN (max 4/day)\n2. Adequate hydration\n3. Monitor BP at home\n4. Follow-up in 1 week if not improving\n5. Red flag counseling provided",
};

const DEMO_PRESCRIPTION = [
  { drug: "Paracetamol 500mg", dose: "1 tablet", frequency: "TID", duration: "5 days" },
  { drug: "Domperidone 10mg", dose: "1 tablet", frequency: "BD", duration: "3 days" },
];

type DemoView = "overview" | "consultation" | "soap" | "prescription";

export default function AwaitingApproval() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [accountStatus, setAccountStatus] = useState("pending");
  const [verificationStatus, setVerificationStatus] = useState("unverified");
  const [trustScore, setTrustScore] = useState(0);
  const [demoView, setDemoView] = useState<DemoView>("overview");

  const checkStatus = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const { data } = await supabase.from("profiles").select("account_status, verification_status, trust_score, clinic_id").eq("user_id", user.id).maybeSingle();
      const d = data as any;
      setAccountStatus(d?.account_status || "pending");
      setVerificationStatus(d?.verification_status || "unverified");
      setTrustScore(d?.trust_score || 0);

      if (d?.account_status === "approved") {
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1);
        const role = roleData?.[0]?.role;
        switch (role) {
          case "platform_admin": navigate("/platform-admin"); break;
          case "nurse": navigate("/vitals"); break;
          case "patient": navigate("/patient-portal"); break;
          default: navigate("/dashboard"); break;
        }
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const statusConfig = {
    pending: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", label: "Verification Pending", icon: Clock },
    rejected: { color: "bg-destructive/10 text-destructive", label: "Registration Rejected", icon: Shield },
  };
  const status = statusConfig[accountStatus as keyof typeof statusConfig] || statusConfig.pending;

  const workspaceFeatures = [
    { icon: Mic, label: "Voice Consultation", desc: "Record or type — AI generates clinical notes" },
    { icon: FileText, label: "SOAP Notes", desc: "Structured clinical documentation" },
    { icon: Pill, label: "Prescriptions", desc: "AI-assisted drug recommendations" },
    { icon: FlaskConical, label: "Lab Orders", desc: "Automated test ordering" },
    { icon: MessageSquare, label: "Patient Reports", desc: "Multilingual patient summaries" },
    { icon: CreditCard, label: "Billing", desc: "Integrated invoice generation" },
  ];

  return (
    <>
      <SEO title="Your Clinical Workspace — DATAelixAIr" description="Explore your clinical workspace while approval is processed." />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={brainLogo} alt="DATAelixAIr" className="h-7 w-7" />
              <div>
                <p className="text-sm font-bold text-foreground leading-none">DATAelixAIr<sup className="text-[0.5em] text-muted-foreground">™</sup></p>
                <p className="text-[10px] text-muted-foreground">Clinical Workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${status.color} text-[10px] gap-1`}>
                <status.icon className="h-3 w-3" />
                {status.label}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/auth"); }} className="text-xs text-muted-foreground">
                Sign Out
              </Button>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Status banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-amber-200 dark:border-amber-800 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 p-4 mb-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-lg font-bold text-foreground">Demo Mode Active</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Real patient messaging will activate after clinic verification. You can explore the full AI workflow below.
                </p>
                {trustScore > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-muted-foreground">Trust Score:</span>
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${trustScore}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-foreground">{trustScore}/100</span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={checkStatus} disabled={checking} className="shrink-0">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
                {checking ? "Checking…" : "Check Status"}
              </Button>
            </div>
          </motion.div>

          {/* Demo mode tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {[
              { key: "overview", label: "Workspace Overview", icon: Activity },
              { key: "consultation", label: "Demo Consultation", icon: Mic },
              { key: "soap", label: "AI Clinical Notes", icon: Brain },
              { key: "prescription", label: "Demo Prescription", icon: Pill },
            ].map((tab) => (
              <Button
                key={tab.key}
                variant={demoView === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setDemoView(tab.key as DemoView)}
                className="shrink-0 text-xs gap-1.5"
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </Button>
            ))}
          </div>

          {/* Content */}
          {demoView === "overview" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaceFeatures.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="hover:border-primary/30 transition-colors cursor-default">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <f.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{f.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{f.desc}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}

              {/* Restricted features note */}
              <Card className="border-dashed border-muted-foreground/20 md:col-span-2 lg:col-span-3">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span><strong>Demo mode:</strong> You can explore the AI workflow. Real prescriptions, patient reports, and SMS notifications will be available after approval.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {demoView === "consultation" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mic className="h-4 w-4 text-primary" />
                  Demo Consultation Transcript
                  <Badge variant="outline" className="text-[9px] ml-2">Sample Data</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {DEMO_TRANSCRIPT}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => setDemoView("soap")} className="text-xs gap-1.5">
                    View AI Clinical Notes <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <p className="text-[10px] text-muted-foreground">AI processes this transcript into structured clinical notes</p>
                </div>
              </CardContent>
            </Card>
          )}

          {demoView === "soap" && (
            <div className="space-y-4">
              {[
                { label: "Subjective", content: DEMO_SOAP.subjective, color: "border-blue-200 dark:border-blue-800" },
                { label: "Objective", content: DEMO_SOAP.objective, color: "border-emerald-200 dark:border-emerald-800" },
                { label: "Assessment", content: DEMO_SOAP.assessment, color: "border-amber-200 dark:border-amber-800" },
                { label: "Plan", content: DEMO_SOAP.plan, color: "border-purple-200 dark:border-purple-800" },
              ].map((section, i) => (
                <motion.div key={section.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card className={section.color}>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        {section.label}
                        <Badge variant="outline" className="text-[8px]">AI Generated</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{section.content}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setDemoView("prescription")} className="text-xs gap-1.5">
                  View Prescription <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {demoView === "prescription" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pill className="h-4 w-4 text-primary" />
                  Demo Prescription
                  <Badge variant="outline" className="text-[9px] ml-2">Sample Data</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Drug</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Dose</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Frequency</th>
                        <th className="text-left py-2 text-xs font-medium text-muted-foreground">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_PRESCRIPTION.map((rx, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 font-medium">{rx.drug}</td>
                          <td className="py-2 text-muted-foreground">{rx.dose}</td>
                          <td className="py-2 text-muted-foreground">{rx.frequency}</td>
                          <td className="py-2 text-muted-foreground">{rx.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 mt-4 text-[10px] text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-amber-500" />
                  Real prescriptions will be available after account approval. All AI suggestions require clinician review.
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
