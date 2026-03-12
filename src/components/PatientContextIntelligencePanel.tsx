/**
 * Patient Context Intelligence Panel
 * 
 * Displays the PCIE-generated context in the Clinical Cockpit left panel.
 * Shows chief complaint, symptoms, risk flags, missing info, medications,
 * allergies with inline editing capability.
 */

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertTriangle, Brain, ChevronDown, ChevronRight, Edit2, Check, X,
  Pill, ShieldAlert, Target, Zap, HelpCircle, Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getConfidenceLabel } from "@/services/context_engine";
import type { RiskFlag, MappedConcept } from "@/services/context_engine";

interface PCIEContext {
  id?: string;
  chief_complaint: string;
  symptoms: MappedConcept[] | string[];
  associated_symptoms: MappedConcept[] | string[];
  duration: string;
  severity: string;
  allergies: string[];
  current_medications: string[];
  risk_flags: RiskFlag[];
  missing_information: string[];
  context_confidence: number;
  vitals: Record<string, unknown> | null;
}

interface PatientContextIntelligencePanelProps {
  visitId: string;
  context?: PCIEContext | null;
  onContextUpdate?: (field: string, value: unknown) => void;
  readOnly?: boolean;
}

export default function PatientContextIntelligencePanel({
  visitId,
  context,
  onContextUpdate,
  readOnly = false,
}: PatientContextIntelligencePanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [riskOpen, setRiskOpen] = useState(true);
  const [missingOpen, setMissingOpen] = useState(false);

  if (!context) {
    return (
      <ClinicalCard className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Brain className="h-3.5 w-3.5" />
          <span>Patient context not yet generated</span>
        </div>
      </ClinicalCard>
    );
  }

  const confidenceLabel = getConfidenceLabel(context.context_confidence);
  const confidenceColor =
    context.context_confidence >= 0.85 ? "text-green-600" :
    context.context_confidence >= 0.65 ? "text-yellow-600" :
    context.context_confidence >= 0.45 ? "text-orange-600" : "text-destructive";

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSave = (field: string) => {
    onContextUpdate?.(field, editValue);
    setEditingField(null);
    toast.success(`${field.replace(/_/g, " ")} updated`);
  };

  const getSymptomLabel = (s: MappedConcept | string): string => {
    if (typeof s === "string") return s;
    return s.canonical_concept || s.original_phrase;
  };

  const hasCriticalFlags = context.risk_flags?.some(f => f.severity === "critical");

  return (
    <div className="space-y-2">
      {/* Confidence Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/[0.03]">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Patient Context</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`text-[10px] font-medium ${confidenceColor}`}>
            {confidenceLabel}
          </div>
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
            {Math.round(context.context_confidence * 100)}%
          </Badge>
        </div>
      </div>

      {/* Chief Complaint */}
      <div className="px-2">
        <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Target className="h-2.5 w-2.5" /> Chief Complaint
        </Label>
        {editingField === "chief_complaint" ? (
          <div className="flex items-center gap-1 mt-0.5">
            <Input
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              className="h-6 text-xs flex-1"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleSave("chief_complaint")}>
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingField(null)}>
              <X className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs font-medium text-foreground flex-1">
              {context.chief_complaint || "—"}
            </span>
            {!readOnly && (
              <Button size="icon" variant="ghost" className="h-5 w-5 opacity-50 hover:opacity-100"
                onClick={() => handleEdit("chief_complaint", context.chief_complaint)}>
                <Edit2 className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        )}
        {context.duration && (
          <span className="text-[10px] text-muted-foreground">Duration: {context.duration}</span>
        )}
      </div>

      {/* Symptoms */}
      {context.symptoms.length > 0 && (
        <div className="px-2">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Activity className="h-2.5 w-2.5" /> Symptoms ({context.symptoms.length})
          </Label>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {context.symptoms.map((s, i) => (
              <Badge key={i} variant="outline" className="text-[9px] capitalize">
                {getSymptomLabel(s)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Risk Flags */}
      {context.risk_flags.length > 0 && (
        <Collapsible open={riskOpen} onOpenChange={setRiskOpen}>
          <CollapsibleTrigger asChild>
            <button className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left ${
              hasCriticalFlags
                ? "bg-destructive/10 border border-destructive/30"
                : "bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-800"
            }`}>
              <AlertTriangle className={`h-3 w-3 ${hasCriticalFlags ? "text-destructive" : "text-orange-600"}`} />
              <span className={`text-[10px] font-semibold flex-1 ${hasCriticalFlags ? "text-destructive" : "text-orange-700 dark:text-orange-400"}`}>
                Risk Flags ({context.risk_flags.length})
              </span>
              {riskOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-1">
            {context.risk_flags.map((flag, i) => (
              <div key={i} className={`px-2 py-1.5 rounded text-[10px] border ${
                flag.severity === "critical"
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-orange-50 border-orange-200 dark:bg-orange-950/10 dark:border-orange-800"
              }`}>
                <div className="font-semibold">{flag.condition}</div>
                <div className="text-muted-foreground mt-0.5">{flag.action}</div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Medications */}
      {context.current_medications.length > 0 && (
        <div className="px-2">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Pill className="h-2.5 w-2.5" /> Current Medications
          </Label>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {context.current_medications.map((m, i) => (
              <Badge key={i} variant="outline" className="text-[9px] capitalize">{m}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Allergies */}
      {context.allergies.length > 0 && (
        <div className="px-2">
          <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ShieldAlert className="h-2.5 w-2.5 text-destructive" /> Allergies
          </Label>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {context.allergies.map((a, i) => (
              <Badge key={i} variant="outline" className="text-[9px] border-destructive/30 text-destructive capitalize">
                {a}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Missing Information */}
      {context.missing_information.length > 0 && (
        <Collapsible open={missingOpen} onOpenChange={setMissingOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 border border-border text-left">
              <HelpCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-muted-foreground flex-1">
                Missing Info ({context.missing_information.length})
              </span>
              {missingOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <div className="flex flex-wrap gap-1 px-2">
              {context.missing_information.map((m, i) => (
                <Badge key={i} variant="secondary" className="text-[9px]">
                  {typeof m === "string" ? m.replace(/_/g, " ") : String(m)}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
