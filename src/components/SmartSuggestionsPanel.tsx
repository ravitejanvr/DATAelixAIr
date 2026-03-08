import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import type { ClinicalContext } from "@/lib/clinical-context";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent, emitMonitoringEvent } from "@/layers/monitoring/api";
import {
  Sparkles, Pill, FlaskConical, FileText, ChevronDown, ChevronRight,
  Loader2, Plus, AlertTriangle, Info, ExternalLink, BookOpen, Shield,
  CheckCircle,
} from "lucide-react";

/* ── Types ── */
export interface PrescriptionSuggestion {
  drug_name: string;
  dose: string;
  frequency: string;
  duration: string;
  rationale: string;
  allergy_conflict?: boolean;
  evidence_refs?: string[];
  evidence_confidence?: "high" | "moderate" | "low";
}

export interface LabTestSuggestion {
  test_name: string;
  rationale: string;
  priority: "routine" | "urgent";
  evidence_refs?: string[];
  evidence_confidence?: "high" | "moderate" | "low";
}

export interface DocShortcut {
  text: string;
  category: "subjective" | "objective" | "plan" | "advice";
}

export interface GuidelineRef {
  guideline: string;
  source: string;
  summary_points: string[];
}

export interface Citation {
  source: string;
  pmid?: string;
  doi?: string;
  title?: string;
  year?: string;
  url?: string;
  confidence?: "high" | "moderate" | "low";
  relevance_score?: number;
}

export interface DrugSafetyNote {
  drug: string;
  black_box_warning: string | null;
  fda_warnings: string[];
  dailymed_warnings: string[];
}

export interface SmartSuggestions {
  prescriptions: PrescriptionSuggestion[];
  lab_tests: LabTestSuggestion[];
  documentation_shortcuts: DocShortcut[];
  guidelines?: GuidelineRef[];
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
  transcriptExcerpt?: string;
  onAddPrescription: (rx: PrescriptionSuggestion) => void;
  onAddLabTest: (test: string) => void;
  onInsertText: (text: string) => void;
}

const confidenceColor = (c: string) => {
  if (c === "high") return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800";
  if (c === "moderate") return "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800";
  return "text-muted-foreground bg-muted/50 border-border";
};

export default function SmartSuggestionsPanel({
  chiefComplaint, duration, symptoms, vitals,
  patientAge, patientGender, allergies, medications, conditions,
  userId, transcriptExcerpt, onAddPrescription, onAddLabTest, onInsertText,
}: SmartSuggestionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartSuggestions | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [drugSafety, setDrugSafety] = useState<DrugSafetyNote[]>([]);
  const [retrievalConfidence, setRetrievalConfidence] = useState<string>("");
  const [sourcesQueried, setSourcesQueried] = useState<string[]>([]);
  const [aiModel, setAiModel] = useState("");
  const [selectedRx, setSelectedRx] = useState<Set<string>>(new Set());
  const [selectedLabs, setSelectedLabs] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [showEvidence, setShowEvidence] = useState(false);

  const hasTrigger = chiefComplaint.trim().length > 2;

  const fetchSuggestions = useCallback(async () => {
    if (!hasTrigger) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clinical-knowledge", {
        body: {
          chief_complaint: chiefComplaint,
          duration, symptoms, vitals,
          age: patientAge, gender: patientGender,
          allergies, medications, conditions,
          transcript_excerpt: transcriptExcerpt?.slice(0, 500),
        },
      });
      if (error) throw new Error(error.message);

      setSuggestions(data.suggestions);
      setCitations(data.citations || []);
      setDrugSafety(data.drug_safety || []);
      setRetrievalConfidence(data.retrieval_confidence || "");
      setSourcesQueried(data.sources_queried || []);
      setAiModel(data.model || "");
      setOpen(true);
      setSelectedRx(new Set());
      setSelectedLabs(new Set());
      setSelectedDocs(new Set());

      // Log suggestion display
      emitMonitoringEvent({
        event_type: "pipeline_step_completed",
        agent_name: "clinical_knowledge",
        success: true,
        duration_ms: data.duration_ms,
        metadata: {
          rx_count: data.suggestions?.prescriptions?.length || 0,
          lab_count: data.suggestions?.lab_tests?.length || 0,
          citation_count: data.total_citations || 0,
          retrieval_confidence: data.retrieval_confidence,
          sources: data.sources_queried,
        },
      });
      logAuditEvent({
        actor_id: userId,
        event_type: "knowledge_layer_invoked",
        target_type: "clinical_knowledge",
        metadata: {
          chief_complaint: chiefComplaint,
          model: data.model,
          citation_count: data.total_citations || 0,
          retrieval_confidence: data.retrieval_confidence,
          rx_count: data.suggestions?.prescriptions?.length || 0,
          lab_count: data.suggestions?.lab_tests?.length || 0,
        },
      });
    } catch (err: any) {
      console.error("Clinical knowledge error:", err);
      emitMonitoringEvent({
        event_type: "pipeline_step_failed",
        agent_name: "clinical_knowledge",
        success: false,
        metadata: { error: err.message },
      });
    } finally {
      setLoading(false);
    }
  }, [chiefComplaint, duration, symptoms, vitals, patientAge, patientGender, allergies, medications, conditions, userId, hasTrigger, transcriptExcerpt]);

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
      target_type: "clinical_knowledge",
      metadata: { suggestion_type: type, item, model: aiModel, retrieval_confidence: retrievalConfidence },
    });
    emitMonitoringEvent({
      event_type: "pipeline_step_completed",
      agent_name: "clinical_knowledge",
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
          {retrievalConfidence && (
            <Badge variant="outline" className={`text-[8px] ${confidenceColor(retrievalConfidence)}`}>
              {retrievalConfidence === "high" ? <CheckCircle className="h-2 w-2 mr-0.5" /> : null}
              {retrievalConfidence}
            </Badge>
          )}
          {totalSuggestions > 0 && (
            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{totalSuggestions}</Badge>
          )}
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-2">
        {/* Disclaimer + Evidence Sources */}
        <div className="flex items-center justify-between px-2 py-1 rounded-md bg-muted/50">
          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <Info className="h-2.5 w-2.5 shrink-0" />
            AI-assisted suggestions for clinician review.
          </div>
          {sourcesQueried.length > 0 && (
            <div className="flex items-center gap-1">
              {sourcesQueried.map(s => (
                <Badge key={s} variant="outline" className="text-[7px] px-1">{s}</Badge>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Retrieving evidence & generating suggestions…
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
            {/* Prescription Suggestions with evidence refs */}
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground">{rx.drug_name}</span>
                              {rx.allergy_conflict && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-[8px] gap-0.5">
                                  <AlertTriangle className="h-2 w-2" /> Allergy
                                </Badge>
                              )}
                              {rx.evidence_confidence && (
                                <Badge variant="outline" className={`text-[7px] ${confidenceColor(rx.evidence_confidence)}`}>
                                  {rx.evidence_confidence}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {rx.dose} · {rx.frequency} · {rx.duration}
                            </div>
                            <div className="text-[9px] text-muted-foreground/70 mt-0.5 italic">{rx.rationale}</div>
                            {rx.evidence_refs && rx.evidence_refs.length > 0 && (
                              <div className="flex items-center gap-1 mt-0.5 text-[8px] text-primary/70">
                                <BookOpen className="h-2 w-2" />
                                {rx.evidence_refs.join(", ")}
                              </div>
                            )}
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

            {/* Lab Test Suggestions with evidence refs */}
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
                        title={`${test.rationale}${test.evidence_refs?.length ? ` | Evidence: ${test.evidence_refs.join(", ")}` : ""}`}
                      >
                        {test.test_name}
                        {test.priority === "urgent" && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[7px] px-1">Urgent</Badge>
                        )}
                        {test.evidence_confidence && (
                          <Badge variant="outline" className={`text-[6px] px-0.5 ${confidenceColor(test.evidence_confidence)}`}>
                            {test.evidence_confidence.charAt(0).toUpperCase()}
                          </Badge>
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

            {/* Clinical Guidelines */}
            {suggestions.guidelines && suggestions.guidelines.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1">
                  <BookOpen className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Guidelines</span>
                </div>
                <div className="space-y-1 px-1">
                  {suggestions.guidelines.map((g, i) => (
                    <div key={i} className="p-2 rounded-md border border-border text-[10px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-foreground">{g.guideline}</span>
                        <Badge variant="outline" className="text-[7px]">{g.source}</Badge>
                      </div>
                      <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pl-1">
                        {g.summary_points.map((p, j) => <li key={j}>{p}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Citations (collapsible) */}
            {citations.length > 0 && (
              <Collapsible open={showEvidence} onOpenChange={setShowEvidence}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 px-1 text-[10px] font-semibold text-muted-foreground hover:text-primary transition-colors">
                    {showEvidence ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                    <BookOpen className="h-3 w-3" />
                    Evidence Sources ({citations.length} citations)
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1 px-1">
                  {citations.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[9px] text-muted-foreground p-1.5 rounded border border-border/50">
                      <span className="text-primary font-bold shrink-0">[{i + 1}]</span>
                      <div className="flex-1 min-w-0">
                        <span className="line-clamp-1 text-foreground">{c.title || "Untitled"}</span>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[7px] px-1">{c.source}</Badge>
                          {c.year && <span>({c.year})</span>}
                          {c.confidence && (
                            <Badge variant="outline" className={`text-[6px] ${confidenceColor(c.confidence)}`}>{c.confidence}</Badge>
                          )}
                          {c.pmid && <span className="text-muted-foreground/60">PMID: {c.pmid}</span>}
                        </div>
                      </div>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Drug Safety Highlights */}
            {drugSafety.some(d => d.black_box_warning) && (
              <div className="space-y-1 px-1">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-destructive" />
                  <span className="text-[10px] font-semibold text-destructive uppercase tracking-wider">Safety Alerts</span>
                </div>
                {drugSafety.filter(d => d.black_box_warning).map((d, i) => (
                  <div key={i} className="p-1.5 rounded border border-destructive/30 bg-destructive/5 text-[9px]">
                    <span className="font-semibold text-destructive">{d.drug}</span>
                    <span className="text-destructive/80 ml-1">⚠ {d.black_box_warning}</span>
                  </div>
                ))}
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
