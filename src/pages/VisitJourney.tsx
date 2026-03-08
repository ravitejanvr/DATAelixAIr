import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { motion } from "framer-motion";
import {
  CheckCircle, Clock, Stethoscope, Activity, FlaskConical,
  Pill, CreditCard, FileText, Loader2, Download, Languages
} from "lucide-react";
import brainLogo from "@/assets/brain-logo-nobg.png";

const JOURNEY_STAGES = [
  { key: "registered", label: "Visit Registered", icon: CheckCircle },
  { key: "arrived", label: "Arrived", icon: CheckCircle },
  { key: "triage", label: "Triage / Vitals", icon: Activity },
  { key: "vitals", label: "Vitals Recorded", icon: Activity },
  { key: "doctor", label: "Doctor Consultation", icon: Stethoscope },
  { key: "consultation_complete", label: "Consultation Complete", icon: FileText },
  { key: "lab", label: "Lab Tests", icon: FlaskConical },
  { key: "pharmacy", label: "Pharmacy", icon: Pill },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "complete", label: "Visit Complete", icon: CheckCircle },
];

const STATUS_ORDER = JOURNEY_STAGES.map(s => s.key);

interface VisitData {
  id: string;
  status: string;
  token_number: number | null;
  check_in_time: string;
  chief_complaint: string | null;
  clinic: { name: string } | null;
  patient: { name: string } | null;
}

export default function VisitJourney() {
  const { visitId } = useParams<{ visitId: string }>();
  const [visit, setVisit] = useState<VisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<"en" | "hi" | "te" | "ur">("en");

  useEffect(() => {
    if (!visitId) return;
    fetchVisit();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchVisit, 10000);
    return () => clearInterval(interval);
  }, [visitId]);

  const fetchVisit = async () => {
    if (!visitId) return;
    const { data, error } = await supabase
      .from("patient_visits")
      .select("id, status, token_number, check_in_time, chief_complaint, clinic_id")
      .eq("id", visitId)
      .maybeSingle();

    if (data) {
      // Fetch clinic name
      let clinicName = "";
      if (data.clinic_id) {
        const { data: clinic } = await supabase.from("clinics").select("name").eq("id", data.clinic_id).maybeSingle();
        clinicName = clinic?.name || "";
      }
      // Fetch patient name
      const { data: pvData } = await supabase.from("patient_visits").select("patient_id").eq("id", visitId).maybeSingle();
      let patientName = "";
      if (pvData?.patient_id) {
        const { data: patient } = await supabase.from("patients").select("name").eq("id", pvData.patient_id).maybeSingle();
        patientName = patient?.name || "";
      }

      setVisit({
        ...data,
        clinic: { name: clinicName },
        patient: { name: patientName },
      } as any);
    }
    setLoading(false);
  };

  const currentIndex = visit ? STATUS_ORDER.indexOf(visit.status) : -1;

  const labels: Record<string, Record<string, string>> = {
    en: { title: "Visit Progress", token: "Token", estimated: "Estimated wait", minutes: "minutes" },
    hi: { title: "विज़िट की प्रगति", token: "टोकन", estimated: "अनुमानित प्रतीक्षा", minutes: "मिनट" },
    te: { title: "సందర్శన పురోగతి", token: "టోకెన్", estimated: "అంచనా వేచి ఉండండి", minutes: "నిమిషాలు" },
    ur: { title: "دورے کی پیشرفت", token: "ٹوکن", estimated: "تخمینی انتظار", minutes: "منٹ" },
  };

  const t = labels[language] || labels.en;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Visit not found</p>
      </div>
    );
  }

  return (
    <>
      <SEO title="Visit Progress — DATAelixAIr" description="Track your clinic visit in real-time" />
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-4">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <img src={brainLogo} alt="DATAelixAIr" className="h-8 w-8" />
            <div className="flex-1">
              <h1 className="text-sm font-bold text-foreground">{visit.clinic?.name || "Clinic"}</h1>
              <p className="text-[10px] text-muted-foreground">Powered by DATAelixAIr</p>
            </div>
            {/* Language Toggle */}
            <div className="flex gap-1">
              {(["en", "hi", "te", "ur"] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${language === l ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:bg-muted"}`}
                >
                  {l === "en" ? "EN" : l === "hi" ? "हि" : l === "te" ? "తె" : "اردو"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
          {/* Patient Card */}
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-lg font-bold text-foreground">{visit.patient?.name || "Patient"}</p>
              {visit.token_number && (
                <div className="mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase">{t.token}</p>
                  <p className="text-3xl font-black text-primary">{visit.token_number}</p>
                </div>
              )}
              {visit.chief_complaint && (
                <Badge variant="outline" className="mt-2 text-xs">{visit.chief_complaint}</Badge>
              )}
            </CardContent>
          </Card>

          {/* Journey Timeline */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-4">{t.title}</h2>
            <div className="space-y-0">
              {JOURNEY_STAGES.map((stage, idx) => {
                const isDone = idx <= currentIndex;
                const isActive = idx === currentIndex;
                const isPending = idx > currentIndex;
                const Icon = stage.icon;

                return (
                  <div key={stage.key} className="flex items-start gap-3">
                    {/* Vertical line + circle */}
                    <div className="flex flex-col items-center">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: isActive ? 1.1 : 1 }}
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                          isDone ? "bg-primary border-primary" :
                          isActive ? "bg-primary/20 border-primary animate-pulse" :
                          "bg-muted border-border"
                        }`}
                      >
                        {isDone && !isActive ? (
                          <CheckCircle className="h-4 w-4 text-primary-foreground" />
                        ) : isActive ? (
                          <Clock className="h-4 w-4 text-primary" />
                        ) : (
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </motion.div>
                      {idx < JOURNEY_STAGES.length - 1 && (
                        <div className={`w-0.5 h-8 ${isDone ? "bg-primary" : "bg-border"}`} />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pt-1.5">
                      <p className={`text-sm font-medium ${isDone || isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {stage.label}
                      </p>
                      {isActive && (
                        <p className="text-[10px] text-primary font-medium mt-0.5">In progress…</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estimated Wait */}
          {currentIndex >= 0 && currentIndex < 4 && (
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">{t.estimated}</p>
                <p className="text-2xl font-bold text-foreground">{Math.max(5, (4 - currentIndex) * 10)} {t.minutes}</p>
              </CardContent>
            </Card>
          )}

          {/* Visit time */}
          <p className="text-[10px] text-muted-foreground text-center">
            Check-in: {new Date(visit.check_in_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </>
  );
}
