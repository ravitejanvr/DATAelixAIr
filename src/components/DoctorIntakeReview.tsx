import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/layers/monitoring/api";
import type { IntakeData } from "@/components/IntakeSummary";
import {
  ClipboardCheck, ChevronDown, ChevronRight, AlertTriangle,
  ShieldCheck, Edit3, CheckCircle, Pill, HeartPulse, Clock,
  Thermometer, Lock
} from "lucide-react";

const DURATION_OPTIONS = ["Today", "1–2 days", "3–7 days", "More than 1 week"];
const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild", icon: "😊", color: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400" },
  { value: "moderate", label: "Moderate", icon: "😐", color: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400" },
  { value: "severe", label: "Severe", icon: "😣", color: "border-destructive/30 bg-destructive/10 text-destructive" },
];
const CONDITIONS = ["Diabetes", "High Blood Pressure", "Asthma", "Heart Disease", "Thyroid"];

interface DoctorIntakeReviewProps {
  patientId: string | null;
  visitId: string | null;
  intakeData: IntakeData | null;
  userId: string;
  onApproved: (approvedData: IntakeData) => void;
}

export default function DoctorIntakeReview({ patientId, visitId, intakeData: directData, userId, onApproved }: DoctorIntakeReviewProps) {
  const [intake, setIntake] = useState<IntakeData | null>(directData || null);
  const [isOpen, setIsOpen] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("");
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [allergySearch, setAllergySearch] = useState("");
  const [wasEdited, setWasEdited] = useState(false);

  // Load from triage if not directly provided
  useEffect(() => {
    if (directData) { setIntake(directData); return; }
    if (!patientId) { setIntake(null); return; }
    (async () => {
      let query = supabase.from("triage")
        .select("chief_complaint, symptom_duration, pain_score, allergies_noted, pregnancy_status, priority, notes")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (visitId) query = query.eq("visit_id", visitId);
      const { data } = await query.maybeSingle();
      setIntake(data as IntakeData | null);
    })();
  }, [patientId, visitId, directData]);

  // Populate editable fields when intake loads
  useEffect(() => {
    if (!intake) return;
    setChiefComplaint(intake.chief_complaint || "");
    setDuration(intake.symptom_duration || "");
    // Map pain score to severity label
    const ps = intake.pain_score;
    if (ps != null) {
      if (ps <= 3) setSeverity("mild");
      else if (ps <= 6) setSeverity("moderate");
      else setSeverity("severe");
    }
    setConditions(intake.notes || "");
    setAllergies(intake.allergies_noted || "");
  }, [intake]);

  const handleApprove = async () => {
    const approvedData: IntakeData = {
      chief_complaint: chiefComplaint,
      symptom_duration: duration,
      pain_score: severity === "severe" ? 8 : severity === "moderate" ? 5 : 2,
      allergies_noted: allergies || null,
      pregnancy_status: intake?.pregnancy_status || null,
      priority: severity === "severe" ? "urgent" : "routine",
      notes: conditions || null,
      current_medications: intake?.current_medications,
    };

    setIsApproved(true);
    setIsOpen(false);

    // Log audit events
    logAuditEvent({
      actor_id: userId,
      event_type: "intake_approved",
      target_type: "visit",
      target_id: visitId || undefined,
      metadata: { edited: wasEdited, approved_at: new Date().toISOString() },
    });

    if (wasEdited) {
      logAuditEvent({
        actor_id: userId,
        event_type: "intake_edited_by_doctor",
        target_type: "visit",
        target_id: visitId || undefined,
        metadata: { fields_changed: true },
      });
    }

    onApproved(approvedData);
  };

  const markEdited = () => { if (!wasEdited) setWasEdited(true); };

  // Safety flags
  const safetyFlags: string[] = [];
  if (severity === "severe") safetyFlags.push("Severe symptom selected");
  if (allergies && allergies.toLowerCase() !== "none" && allergies.trim()) safetyFlags.push("Allergy reported");
  if (conditions && conditions.toLowerCase() !== "none" && conditions.trim()) safetyFlags.push("Chronic condition present");

  const severityMeta = SEVERITY_OPTIONS.find(s => s.value === severity);

  // No intake at all
  if (!intake && !patientId) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground flex-1">Doctor Intake Review</span>
          {isApproved && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 text-[10px] gap-0.5">
              <Lock className="h-2.5 w-2.5" /> Approved
            </Badge>
          )}
          {!isApproved && safetyFlags.length > 0 && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> {safetyFlags.length}
            </Badge>
          )}
          {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-1.5">
        {!intake ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground">No patient intake submitted.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-3 space-y-3">
            {/* Safety Flags */}
            {safetyFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {safetyFlags.map((flag) => (
                  <Badge key={flag} variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400 gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> {flag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {/* Chief Complaint */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Chief Complaint</label>
                {isEditing ? (
                  <Input
                    value={chiefComplaint}
                    onChange={(e) => { setChiefComplaint(e.target.value); markEdited(); }}
                    className="h-8 text-xs"
                    disabled={isApproved}
                  />
                ) : (
                  <p className="text-xs text-foreground font-medium bg-muted/40 rounded px-2 py-1.5">{chiefComplaint || "—"}</p>
                )}
              </div>

              {/* Duration */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> Duration
                </label>
                {isEditing ? (
                  <Select value={duration} onValueChange={(v) => { setDuration(v); markEdited(); }} disabled={isApproved}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-foreground font-medium bg-muted/40 rounded px-2 py-1.5">{duration || "—"}</p>
                )}
              </div>

              {/* Severity */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                  <Thermometer className="h-2.5 w-2.5" /> Severity
                </label>
                {isEditing ? (
                  <div className="flex gap-1">
                    {SEVERITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSeverity(opt.value); markEdited(); }}
                        disabled={isApproved}
                        className={`flex-1 text-[10px] py-1.5 rounded border font-medium transition-all ${
                          severity === opt.value ? opt.color + " ring-1 ring-offset-1 ring-primary/30" : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={`text-xs font-medium rounded px-2 py-1.5 border ${severityMeta?.color || "bg-muted/40 border-border text-foreground"}`}>
                    {severityMeta ? `${severityMeta.icon} ${severityMeta.label}` : severity || "—"}
                  </p>
                )}
              </div>

              {/* Conditions */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                  <HeartPulse className="h-2.5 w-2.5" /> Conditions
                </label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-1">
                    {CONDITIONS.map(c => {
                      const active = conditions.toLowerCase().includes(c.toLowerCase());
                      return (
                        <button
                          key={c}
                          onClick={() => {
                            if (active) {
                              setConditions(conditions.split(",").map(s=>s.trim()).filter(s => s.toLowerCase() !== c.toLowerCase()).join(", "));
                            } else {
                              setConditions(conditions ? `${conditions}, ${c}` : c);
                            }
                            markEdited();
                          }}
                          disabled={isApproved}
                          className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                            active ? "bg-primary/10 border-primary text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted/50"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-foreground font-medium bg-muted/40 rounded px-2 py-1.5">{conditions || "None"}</p>
                )}
              </div>

              {/* Allergies */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-0.5">
                  <Pill className="h-2.5 w-2.5" /> Medication Allergies
                </label>
                {isEditing ? (
                  <Input
                    value={allergies}
                    onChange={(e) => { setAllergies(e.target.value); markEdited(); }}
                    className="h-8 text-xs"
                    placeholder="Type allergy name…"
                    disabled={isApproved}
                  />
                ) : (
                  <p className={`text-xs font-medium rounded px-2 py-1.5 ${
                    allergies && allergies.toLowerCase() !== "none" && allergies.trim()
                      ? "bg-destructive/10 border border-destructive/20 text-destructive"
                      : "bg-muted/40 text-foreground"
                  }`}>
                    {allergies || "None"}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-border/50">
              {!isApproved ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit3 className="h-3 w-3" /> {isEditing ? "Done Editing" : "Edit Fields"}
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={handleApprove}
                  >
                    <ShieldCheck className="h-3 w-3" /> Approve Intake Data
                  </Button>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">Intake approved and locked</span>
                  {wasEdited && <Badge variant="outline" className="text-[9px]">Doctor-edited</Badge>}
                </div>
              )}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
