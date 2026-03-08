import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent, emitMonitoringEvent } from "@/layers/monitoring/api";
import {
  Sparkles, Pill, FlaskConical, FileText, ChevronDown, ChevronRight,
  Loader2, Plus, AlertTriangle, Info,
} from "lucide-react";

/* ── Types ── */
export interface PrescriptionSuggestion {
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  rationale: string;
  allergy_conflict?: boolean;
}

export interface LabTestSuggestion {
  test_name: string;
  rationale: string;
  priority: "routine" | "urgent";
}

export interface DocShortcut {
  text: string;
  category: "subjective" | "objective" | "plan" | "advice";
}

export interface SmartSuggestions {
  prescriptions: PrescriptionSuggestion[];
  lab_tests: LabTestSuggestion[];
  documentation_shortcuts: DocShortcut[];
}

interface SmartSuggestionsPanelProps {
  chiefComplaint: string;
  duration: string;
  symptoms: string;
  vitals: string;
  patientAge: number | null;
  patientGender: string | null;
  allergies: string;
  medications: string;
  conditions: string;
  userId: string;
  onAddPrescription: (rx: PrescriptionSuggestion) => void;
  onAddLabTest: (test: string) => void;
  onInsertText: (text: string) => void;
}

export default function SmartSuggestionsPanel({
  chiefComplaint, duration, symptoms, vitals,
  patientAge, patientGender, allergies, medications, conditions,
  userId, onAddPrescription, onAddLabTest, onInsertText,
}: SmartSuggestionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestions | null>(null);
  const [aiModel, setAiModel] = useState("");
  const [selectedRx, setSelectedRx] = useState<Set<string>>(new Set());
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  const hasTrigger = chiefComplaint.trim().length > 2;

  const fetchSuggestions = useCallback(async () => {
    if (!hasTrigger) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-suggestions", {
        body: {
          chief_complaint: chiefComplaint,
          duration, symptoms, vitals,
          age: patientAge, gender: patientGender,
          allergies, medications, conditions,
        },
      });
      if (error) throw new Error(error.message);
      setSuggestions(data.suggestions);
      setAiModel(data.model || "");
      setOpen(true);
      // Reset selections
      setSelectedRx(new Set());
      setSelectedLabs(new Set());
      setSelectedDocs(new Set());

      // Log suggestion display
      emitMonitoringEvent({
        event_type: "pipeline_step_completed",
        agent_name: "smart_suggestions",
        success: true,
        metadata: {
          rx_count: data.suggestions?.prescriptions?.length || 0,
          lab_count: data.suggestions?.lab_tests?.length || 0,
          doc_count: data.suggestions?.documentation_shortcuts?.length || 0,
        },
      });
      logAuditEvent({
        actor_id: userId,
        event_type: "suggestions_displayed",
        target_type: "smart_suggestions",
        metadata: {
          chief_complaint: chiefComplaint,
          model: data.model,
          rx_count: data.suggestions?.prescriptions?.length || 0,
          lab_count: data.suggestions?.lab_tests?.length || 0,
        },
      });
    } catch (err: any) {
      console.error("Smart suggestions error:", err);
      emitMonitoringEvent({
        event_type: "pipeline_step_failed",
        agent_name: "smart_suggestions",
        success: false,
        metadata: { error: err.message },
      });
    } finally {
      setLoading(false);
    }
  }, [chiefComplaint, duration, symptoms, vitals, patientAge, patientGender, allergies, medications, conditions, userId, hasTrigger]);

  // Auto-fetch when chief complaint becomes available
  useEffect(() => {
    if (hasTrigger && !suggestions && !loading) {
      const timer = setTimeout(fetchSuggestions, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const logSelection = (type: string, item: string) => {
    logAuditEvent({
      actor_id: userId,
      event_type: "suggestion_selected",
      target_type: "smart_suggestions",
      metadata: { suggestion_type: type, item, model: aiModel },
    });
    emitMonitoringEvent({
      event_type: "pipeline_step_completed",
      agent_name: "smart_suggestions",
      success: true,
      metadata: { action: "selected", type, item },
    });
  };

  const handleAddRx = (rx: PrescriptionSuggestion) => {
    setSelectedRx(prev => new Set(prev).add(rx.drug_name));
    onAddPrescription(rx);
    logSelection("prescription", rx.drug_name);
  };

  const handleAddLab = (test: LabTestSuggestion) => {
    setSelectedLabs(prev => new Set(prev).add(test.test_name));
    onAddLabTest(test.test_name);
    logSelection("lab_test", test.test_name);
  };

  const handleInsertDoc = (shortcut: DocShortcut) => {
    setSelectedDocs(prev => new Set(prev).add(shortcut.text));
    onInsertText(shortcut.text);
    logSelection("documentation_shortcut", shortcut.text.slice(0, 50));
  };

  const totalSuggestions = suggestions
    ? (suggestions.prescriptions?.length || 0) + (suggestions.lab_tests?.length || 0) + (suggestions.documentation_shortcuts?.length || 0)
    : 0;

  if (!hasTrigger && !suggestions) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06] transition-colors text-left">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground flex-1">Smart Suggestions</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          {totalSuggestions > 0 && (
            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{totalSuggestions}</Badge>
          )}
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-2">
        {/* Disclaimer */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-[9px] text-muted-foreground">
          <Info className="h-2.5 w-2.5 shrink-0" />
          AI-assisted suggestions for clinician review.
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating suggestions…
          </div>
        )}

        {!loading && !suggestions && hasTrigger && (
          <div className="text-center py-4">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={fetchSuggestions}>
              <Sparkles className="h-3 w-3 mr-1" /> Generate Suggestions
            </Button>
          </div>
        )}

        {suggestions && (
          <>
            {/* Prescription Suggestions */}
            {suggestions.prescriptions?.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <Pill className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Medications</span>
                </div>
                <div className="space-y-1 px-1">
                  {suggestions.prescriptions.map((rx, i) => {
                    const isSelected = selectedRx.has(rx.drug_name);
                    return (
                      <button
                        key={i}
                        disabled={isSelected}
                        onClick={() => handleAddRx(rx)}
                        className={`w-full text-left p-2 rounded-md border transition-all text-xs ${
                          isSelected
                            ? "border-primary/30 bg-primary/5 opacity-60"
                            : rx.allergy_conflict
                              ? "border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
                              : "border-border hover:border-primary/30 hover:bg-primary/[0.03]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{rx.drug_name}</span>
                              {rx.allergy_conflict && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[8px] gap-0.5">
                                  <AlertTriangle className="h-2 w-2" /> Allergy
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {rx.dose} · {rx.frequency} · {rx.duration}
                            </div>
                            <div className="text-[9px] text-muted-foreground/70 mt-0.5 italic">{rx.rationale}</div>
                          </div>
                          {!isSelected && (
                            <Plus className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lab Test Suggestions */}
            {suggestions.lab_tests?.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <FlaskConical className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Investigations</span>
                </div>
                <div className="flex flex-wrap gap-1 px-1">
                  {suggestions.lab_tests.map((test, i) => {
                    const isSelected = selectedLabs.has(test.test_name);
                    return (
                      <button
                        key={i}
                        disabled={isSelected}
                        onClick={() => handleAddLab(test)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] transition-all ${
                          isSelected
                            ? "border-primary/30 bg-primary/10 text-primary opacity-60"
                            : "border-border hover:border-primary/30 hover:bg-primary/[0.03] text-foreground"
                        }`}
                        title={test.rationale}
                      >
                        {test.test_name}
                        {test.priority === "urgent" && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[7px] px-1">Urgent</Badge>
                        )}
                        {!isSelected && <Plus className="h-2.5 w-2.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Documentation Shortcuts */}
            {suggestions.documentation_shortcuts?.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <FileText className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Notes</span>
                </div>
                <div className="space-y-1 px-1">
                  {suggestions.documentation_shortcuts.map((doc, i) => {
                    const isSelected = selectedDocs.has(doc.text);
                    return (
                      <button
                        key={i}
                        disabled={isSelected}
                        onClick={() => handleInsertDoc(doc)}
                        className={`w-full text-left px-2 py-1.5 rounded-md border text-[10px] transition-all ${
                          isSelected
                            ? "border-primary/30 bg-primary/5 opacity-60"
                            : "border-border hover:border-primary/30 hover:bg-primary/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[7px] shrink-0 capitalize">{doc.category}</Badge>
                          <span className="text-foreground">{doc.text}</span>
                          {!isSelected && <Plus className="h-2.5 w-2.5 text-primary shrink-0 ml-auto" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Refresh */}
            <div className="flex justify-end px-1">
              <Button variant="ghost" size="sm" className="text-[10px] h-6 gap-1" onClick={fetchSuggestions} disabled={loading}>
                <Sparkles className="h-2.5 w-2.5" /> Refresh
              </Button>
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
