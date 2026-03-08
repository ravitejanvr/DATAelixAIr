import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, AlertTriangle, Pill, Clock, Thermometer } from "lucide-react";

export interface IntakeData {
  chief_complaint: string;
  symptom_duration: string | null;
  pain_score: number | null;
  allergies_noted: string | null;
  pregnancy_status: string | null;
  priority: string | null;
  notes: string | null;
  current_medications?: string;
}

interface IntakeSummaryProps {
  patientId: string | null;
  visitId?: string | null;
  /** Directly provided intake data (from navigation state) */
  intakeData?: IntakeData | null;
}

export default function IntakeSummary({ patientId, visitId, intakeData: directData }: IntakeSummaryProps) {
  const [intake, setIntake] = useState<IntakeData | null>(directData || null);

  useEffect(() => {
    if (directData) { setIntake(directData); return; }
    if (!patientId) { setIntake(null); return; }

    (async () => {
      let query = supabase
        .from("triage")
        .select("chief_complaint, symptom_duration, pain_score, allergies_noted, pregnancy_status, priority, notes")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (visitId) query = query.eq("visit_id", visitId);

      const { data } = await query.maybeSingle();
      setIntake(data as IntakeData | null);
    })();
  }, [patientId, visitId, directData]);

  if (!intake) return null;

  const painColor = (score: number) => {
    if (score <= 3) return "text-emerald-600 dark:text-emerald-400";
    if (score <= 6) return "text-amber-600 dark:text-amber-400";
    return "text-destructive";
  };

  const priorityColor = (p: string) => {
    if (p === "emergent") return "border-destructive/30 bg-destructive/10 text-destructive";
    if (p === "urgent") return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
    return "border-border";
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.02] p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Intake Summary</span>
        </div>
        <div className="flex items-center gap-1">
          {intake.priority && (
            <Badge variant="outline" className={`text-[8px] capitalize ${priorityColor(intake.priority)}`}>
              {intake.priority}
            </Badge>
          )}
          {intake.pain_score != null && intake.pain_score > 0 && (
            <Badge variant="outline" className={`text-[8px] ${painColor(intake.pain_score)}`}>
              Pain {intake.pain_score}/10
            </Badge>
          )}
        </div>
      </div>

      {/* Chief complaint */}
      <p className="text-xs text-foreground leading-relaxed">{intake.chief_complaint}</p>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {intake.symptom_duration && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" /> {intake.symptom_duration}
          </span>
        )}
        {intake.allergies_noted && (
          <span className="text-[10px] text-destructive flex items-center gap-0.5 font-medium">
            <AlertTriangle className="h-2.5 w-2.5" /> {intake.allergies_noted}
          </span>
        )}
        {intake.current_medications && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Pill className="h-2.5 w-2.5" /> {intake.current_medications}
          </span>
        )}
        {intake.pregnancy_status && intake.pregnancy_status !== "not_applicable" && (
          <Badge variant="outline" className="text-[8px] capitalize">{intake.pregnancy_status.replace("_", " ")}</Badge>
        )}
      </div>

      {intake.notes && (
        <p className="text-[10px] text-muted-foreground italic border-t border-border pt-1 mt-1">{intake.notes}</p>
      )}
    </div>
  );
}
