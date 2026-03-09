import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SEO from "@/components/SEO";
import PatientTrustBanner from "@/components/PatientTrustBanner";
import { CheckCircle2, Clock, Loader2, AlertTriangle, Users } from "lucide-react";
import { VISIT_STATUS_CONFIG } from "@/layers/workflow/api";

const PATIENT_STEPS = [
  { key: "registered", label: "Checked In", icon: "📋" },
  { key: "triage", label: "Initial Assessment", icon: "🩺" },
  { key: "vitals", label: "Vitals Recorded", icon: "❤️" },
  { key: "doctor", label: "With Doctor", icon: "👨‍⚕️" },
  { key: "complete", label: "Visit Complete", icon: "✅" },
];

// Average minutes per status (clinic-configurable in future)
const AVG_DURATION_MINS: Record<string, number> = {
  registered: 5,
  triage: 5,
  vitals: 5,
  doctor: 15,
  lab: 10,
  pharmacy: 5,
  billing: 5,
};

export default function VisitStatus() {
  const { visitId } = useParams<{ visitId: string }>();
  const [visit, setVisit] = useState<any>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visitId) {
      setError("Invalid visit link");
      setLoading(false);
      return;
    }
    loadVisitStatus();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel(`visit-status-${visitId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "patient_visits", filter: `id=eq.${visitId}` }, () => loadVisitStatus())
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, [visitId]);

  const loadVisitStatus = async () => {
    const { data, error: fetchError } = await supabase
      .from("patient_visits")
      .select("id, status, token_number, check_in_time, clinic_id, patients(name)")
      .eq("id", visitId)
      .maybeSingle();
    
    if (fetchError || !data) {
      setError("Visit not found or link expired");
      setLoading(false);
      return;
    }
    
    setVisit(data);
    
    // Calculate queue position
    const { data: queueData } = await supabase
      .from("patient_visits")
      .select("id, status, check_in_time")
      .eq("clinic_id", data.clinic_id)
      .in("status", ["registered", "triage", "vitals"])
      .lt("check_in_time", data.check_in_time);
    
    const position = (queueData?.length || 0) + 1;
    setQueuePosition(position);
    
    // Estimate wait time based on people ahead
    const waitMins = position <= 1 ? 5 : (position - 1) * 10;
    setEstimatedWait(waitMins);
    
    setLoading(false);
  };

  const getStepIndex = (status: string) => {
    const mapping: Record<string, number> = {
      registered: 0,
      arrived: 0,
      triage: 1,
      vitals: 2,
      doctor: 3,
      lab: 3,
      pharmacy: 3,
      billing: 3,
      complete: 4,
    };
    return mapping[status] ?? 0;
  };

  const currentStep = visit ? getStepIndex(visit.status) : 0;
  const progressPercent = ((currentStep + 1) / PATIENT_STEPS.length) * 100;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold text-foreground">Unable to Load</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComplete = visit.status === "complete";

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Your Visit Status | DATAelixAIr" description="Track your clinic visit in real-time" />
      
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-bold text-foreground">Your Visit Status</h1>
          <p className="text-xs text-muted-foreground">
            {(visit.patients as any)?.name || "Patient"} · Token #{visit.token_number || "–"}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Queue Position Card */}
        {!isComplete && (
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Queue Position</p>
                  <p className="text-3xl font-bold text-primary">{queuePosition}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Est. Wait</p>
                  <p className="text-2xl font-bold text-foreground">
                    {estimatedWait && estimatedWait < 60 
                      ? `${estimatedWait} min` 
                      : estimatedWait 
                        ? `${Math.floor(estimatedWait / 60)}h ${estimatedWait % 60}m`
                        : "–"
                    }
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Check-in: {new Date(visit.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Visit Progress</p>
              <Badge variant={isComplete ? "default" : "outline"} className={isComplete ? "bg-emerald-500" : ""}>
                {VISIT_STATUS_CONFIG[visit.status]?.label || visit.status}
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2 mb-4" />
            
            {/* Steps */}
            <div className="space-y-3">
              {PATIENT_STEPS.map((step, idx) => {
                const isDone = idx < currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm ${
                      isDone ? "bg-emerald-500 text-white" :
                      isCurrent ? "bg-primary text-primary-foreground animate-pulse" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </p>
                    </div>
                    {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {isCurrent && <Badge variant="outline" className="text-[10px]">Now</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Completion message */}
        {isComplete && (
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-foreground">Visit Complete</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Thank you for visiting. Your report will be sent to you shortly.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Trust Banner */}
        <PatientTrustBanner compact />
      </div>
    </div>
  );
}
