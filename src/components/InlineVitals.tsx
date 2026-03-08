import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Thermometer, Heart, Wind, Droplets, Weight, Ruler, AlertTriangle, Activity } from "lucide-react";

interface InlineVitalsProps {
  patientId: string | null;
}

interface VitalData {
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  created_at: string;
}

const RANGES: Record<string, { min: number; max: number }> = {
  bp_systolic: { min: 90, max: 140 },
  bp_diastolic: { min: 60, max: 90 },
  pulse: { min: 60, max: 100 },
  temperature: { min: 36.1, max: 37.5 },
  spo2: { min: 95, max: 100 },
  respiratory_rate: { min: 12, max: 20 },
};

function isAbnormal(key: string, val: number | null): boolean {
  if (val == null) return false;
  const r = RANGES[key];
  return r ? (val < r.min || val > r.max) : false;
}

export default function InlineVitals({ patientId }: InlineVitalsProps) {
  const [vitals, setVitals] = useState<VitalData | null>(null);

  useEffect(() => {
    if (!patientId) { setVitals(null); return; }
    (async () => {
      const { data } = await supabase
        .from("vitals")
        .select("bp_systolic, bp_diastolic, pulse, temperature, spo2, respiratory_rate, weight_kg, height_cm, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setVitals(data as VitalData | null);
    })();
  }, [patientId]);

  if (!patientId) return <div className="text-[10px] text-muted-foreground px-2 py-1.5">Select a patient to view vitals</div>;
  if (!vitals) return <div className="text-[10px] text-muted-foreground px-2 py-1.5">No vitals recorded</div>;

  const items: { key: string; label: string; icon: typeof Heart; value: string; abnormal: boolean }[] = [
    { key: "bp", label: "BP", icon: Activity, value: vitals.bp_systolic && vitals.bp_diastolic ? `${vitals.bp_systolic}/${vitals.bp_diastolic}` : "—", abnormal: isAbnormal("bp_systolic", vitals.bp_systolic) || isAbnormal("bp_diastolic", vitals.bp_diastolic) },
    { key: "pulse", label: "HR", icon: Heart, value: vitals.pulse != null ? `${vitals.pulse}` : "—", abnormal: isAbnormal("pulse", vitals.pulse) },
    { key: "temp", label: "Temp", icon: Thermometer, value: vitals.temperature != null ? `${vitals.temperature}°C` : "—", abnormal: isAbnormal("temperature", vitals.temperature) },
    { key: "rr", label: "RR", icon: Wind, value: vitals.respiratory_rate != null ? `${vitals.respiratory_rate}` : "—", abnormal: isAbnormal("respiratory_rate", vitals.respiratory_rate) },
    { key: "spo2", label: "SpO₂", icon: Droplets, value: vitals.spo2 != null ? `${vitals.spo2}%` : "—", abnormal: isAbnormal("spo2", vitals.spo2) },
    { key: "wt", label: "Wt", icon: Weight, value: vitals.weight_kg != null ? `${vitals.weight_kg}kg` : "—", abnormal: false },
    { key: "ht", label: "Ht", icon: Ruler, value: vitals.height_cm != null ? `${vitals.height_cm}cm` : "—", abnormal: false },
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map(v => (
        <div key={v.key} className={`flex items-center gap-1 px-1.5 py-1 rounded border text-[10px] ${v.abnormal ? "border-destructive/30 bg-destructive/5" : "border-border bg-background"}`}>
          <v.icon className={`h-2.5 w-2.5 shrink-0 ${v.abnormal ? "text-destructive" : "text-muted-foreground"}`} />
          <span className="text-muted-foreground">{v.label}</span>
          <span className={`font-semibold ml-auto ${v.abnormal ? "text-destructive" : "text-foreground"}`}>{v.value}</span>
          {v.abnormal && <AlertTriangle className="h-2 w-2 text-destructive shrink-0" />}
        </div>
      ))}
    </div>
  );
}
