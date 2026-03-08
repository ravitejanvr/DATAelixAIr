import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import {
  ChevronDown, ChevronRight, Brain, User, Heart, Thermometer,
  Wind, Droplets, Weight, Ruler, Activity, AlertTriangle, Pill, ShieldAlert,
} from "lucide-react";
import type { ClinicalContext } from "@/lib/clinical-context";

interface ClinicalContextPanelProps {
  context: ClinicalContext;
  onUpdate: (field: keyof ClinicalContext, value: any) => void;
  readOnly?: boolean;
}

export default function ClinicalContextPanel({ context, onUpdate, readOnly = false }: ClinicalContextPanelProps) {
  const [open, setOpen] = useState(false);

  const filledCount = [
    context.patient_age, context.patient_sex, context.blood_pressure,
    context.pulse, context.temperature, context.chief_complaint,
  ].filter(v => v != null && v !== "").length;

  const vitalItems: { key: string; label: string; icon: typeof Heart; value: string; unit?: string }[] = [
    { key: "blood_pressure", label: "BP", icon: Activity, value: context.blood_pressure || "—", unit: "mmHg" },
    { key: "pulse", label: "HR", icon: Heart, value: context.pulse != null ? `${context.pulse}` : "—", unit: "bpm" },
    { key: "temperature", label: "Temp", icon: Thermometer, value: context.temperature != null ? `${context.temperature}` : "—", unit: "°C" },
    { key: "respiratory_rate", label: "RR", icon: Wind, value: context.respiratory_rate != null ? `${context.respiratory_rate}` : "—", unit: "/min" },
    { key: "oxygen_saturation", label: "SpO₂", icon: Droplets, value: context.oxygen_saturation != null ? `${context.oxygen_saturation}` : "—", unit: "%" },
    { key: "weight", label: "Wt", icon: Weight, value: context.weight != null ? `${context.weight}` : "—", unit: "kg" },
    { key: "height", label: "Ht", icon: Ruler, value: context.height != null ? `${context.height}` : "—", unit: "cm" },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06] transition-colors text-left">
          <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground flex-1">Clinical Context</span>
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{filledCount}/6</Badge>
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-2 px-1">
        {/* Demographics */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="h-2.5 w-2.5" />Age</Label>
            {readOnly ? (
              <div className="text-xs font-medium text-foreground">{context.patient_age ?? "—"}</div>
            ) : (
              <Input
                type="number" value={context.patient_age ?? ""} className="h-7 text-xs"
                onChange={e => onUpdate("patient_age", e.target.value ? parseInt(e.target.value) : null)}
              />
            )}
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><User className="h-2.5 w-2.5" />Sex</Label>
            {readOnly ? (
              <div className="text-xs font-medium text-foreground capitalize">{context.patient_sex ?? "—"}</div>
            ) : (
              <select
                value={context.patient_sex || ""} className="h-7 text-xs w-full border border-border rounded px-2 bg-background"
                onChange={e => onUpdate("patient_sex", e.target.value || null)}
              >
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            )}
          </div>
        </div>

        {/* Vitals grid */}
        <div>
          <Label className="text-[10px] text-muted-foreground mb-1 block">Vitals</Label>
          <div className="grid grid-cols-4 gap-1">
            {vitalItems.map(v => (
              <div key={v.key} className="flex items-center gap-1 px-1.5 py-1 rounded border border-border bg-background text-[10px]">
                <v.icon className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{v.label}</span>
                <span className="font-semibold text-foreground ml-auto">{v.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chief complaint & duration */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label className="text-[10px] text-muted-foreground">Chief Complaint</Label>
            {readOnly ? (
              <div className="text-xs font-medium text-foreground">{context.chief_complaint || "—"}</div>
            ) : (
              <Input value={context.chief_complaint} className="h-7 text-xs" onChange={e => onUpdate("chief_complaint", e.target.value)} />
            )}
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Duration</Label>
            {readOnly ? (
              <div className="text-xs font-medium text-foreground">{context.symptom_duration || "—"}</div>
            ) : (
              <Input value={context.symptom_duration} className="h-7 text-xs" onChange={e => onUpdate("symptom_duration", e.target.value)} />
            )}
          </div>
        </div>

        {/* Medications, Allergies, History */}
        <div className="space-y-1.5">
          {context.current_medications.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Pill className="h-2.5 w-2.5" />Current Medications</Label>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {context.current_medications.map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] capitalize">{m}</Badge>
                ))}
              </div>
            </div>
          )}
          {context.allergies.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-2.5 w-2.5 text-destructive" />Allergies</Label>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {context.allergies.map((a, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] border-destructive/30 text-destructive capitalize">{a}</Badge>
                ))}
              </div>
            </div>
          )}
          {context.medical_history.length > 0 && (
            <div>
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" />Medical History</Label>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {context.medical_history.map((h, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] capitalize">{h}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
