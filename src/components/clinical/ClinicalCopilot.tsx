import { useState } from "react";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Brain, FlaskConical, Pill, Shield, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, FileText, Loader2, Scale, BookOpen, ExternalLink,
  MessageSquare, Zap, Target, Eye, TrendingUp, TrendingDown, Minus, Activity, Heart,
  Bug, Info, Lock
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SafetyResults } from "@/layers/safety/api";
import type { PhysiologicalContextResult } from "@/services/physiology_engine";
import type { BayesianResult, BayesianDiagnosis } from "@/services/bayesian_engine";
import type { EvidenceData } from "@/layers/evidence/api";
import type { MedicationValidationResult, MedicationWarning } from "@/services/medication_intelligence/client";
import { sortWarnings, safetyScoreColor } from "@/services/medication_intelligence/client";
import type { DiagnosisExplanation, ExplanationFactor } from "@/services/explainability/client";
import { factorDirectionColor, factorBarWidth } from "@/services/explainability/client";

interface GuidelineMatch {
  guideline_id: string;
  title: string;
  source: string;
  source_organization: string;
  year: number;
  evidence_grade: string;
  recommendation_text: string;
  guideline_url: string;
}

interface ComplianceResult {
  item: string;
  item_type: "diagnosis" | "medication" | "test" | "care_plan";
  compliance_status: "guideline_aligned" | "evidence_supported" | "review_suggested";
  explanation: string;
  matching_guidelines: GuidelineMatch[];
}

export interface HypothesisEntry {
  diagnosis: string;
  confidence: number;
  supporting_factors: string[];
  contradicting_factors: string[];
  recommended_tests: string[];
}

export interface PipelineEvidence {
  citations: Array<{ title: string; source: string; year: number; url?: string }>;
  sources_queried: string[];
  retrieval_confidence: string;
}

export interface PipelineCompliance {
  results: ComplianceResult[];
  guidelines_matched: number;
  guidelines_sources: string[];
  guideline_sources_used?: string[];
  guideline_compliance_score?: number;
  conflicts_detected?: Array<{ recommendation: string; conflicting_guideline: string; organization: string; severity: string; explanation: string }>;
}

interface ClinicalCopilotProps {
  diagnoses: string[];
  selectedDiagnoses: string[];
  onToggleDiagnosis: (diagnosis: string) => void;
  tests: string[];
  selectedTests: string[];
  onToggleTest: (test: string) => void;
  medications: Array<{ drug: string; dose: string; route?: string; freq: string; dur: string; line?: "first" | "alternative" | "emergency" }>;
  selectedMedications: Array<{ drug_name: string; dose: string; frequency: string; duration: string; route?: string }>;
  onToggleMedication: (med: { drug: string; dose: string; freq: string; dur: string }) => void;
  safetyResults: SafetyResults | null;
  patientAge?: number;
  allergies?: string[];
  diagnosis?: string;
  chiefComplaint?: string;
  patientSex?: string;
  carePlan?: string;
  instructions: string[];
  selectedInstructions: string[];
  onToggleInstruction: (instruction: string) => void;
  hypotheses?: HypothesisEntry[];
  pipelineEvidence?: PipelineEvidence | null;
  pipelineCompliance?: PipelineCompliance | null;
  visitId?: string | null;
  consultationId?: string | null;
  clinicId?: string | null;
  pipelineStage?: string | null;
  stageLatencies?: Record<string, number>;
  medicationValidation?: MedicationValidationResult | null;
  explainability?: DiagnosisExplanation[] | null;
  physiologicalContext?: PhysiologicalContextResult | null;
  bayesianResult?: BayesianResult | null;
  /** Whether user is a platform admin (enables debug mode) */
  isAdmin?: boolean;
}

const fadeIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

const COMPLIANCE_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  guideline_aligned: {
    label: "Guideline Aligned",
    color: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    icon: CheckCircle,
  },
  evidence_supported: {
    label: "Evidence Supported",
    color: "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
    icon: BookOpen,
  },
  review_suggested: {
    label: "Review Suggested",
    color: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    icon: AlertTriangle,
  },
};

// ── Helpers ──

function likelihoodCategory(pct: number): { label: string; color: string } {
  if (pct >= 30) return { label: "High", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" };
  if (pct >= 15) return { label: "Moderate", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" };
  return { label: "Low", color: "text-muted-foreground bg-muted border-border" };
}

type ReasoningLevel = "doctor" | "explanation" | "debug";

export default function ClinicalCopilot({
  diagnoses,
  selectedDiagnoses,
  onToggleDiagnosis,
  tests,
  selectedTests,
  onToggleTest,
  medications,
  selectedMedications,
  onToggleMedication,
  safetyResults,
  patientAge,
  allergies,
  diagnosis,
  chiefComplaint,
  patientSex,
  carePlan,
  instructions,
  selectedInstructions,
  onToggleInstruction,
  hypotheses,
  pipelineEvidence,
  pipelineCompliance,
  visitId,
  consultationId,
  clinicId,
  pipelineStage,
  stageLatencies,
  medicationValidation,
  explainability,
  physiologicalContext,
  bayesianResult,
  isAdmin = false,
}: ClinicalCopilotProps) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [complianceExpanded, setComplianceExpanded] = useState(false);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[] | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [complianceSources, setComplianceSources] = useState<string[]>([]);
  // Three-level reasoning state
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>("doctor");
  // Per-diagnosis "Why?" expansion
  const [expandedDiagnoses, setExpandedDiagnoses] = useState<Set<string>>(new Set());

  const effectiveCompliance = pipelineCompliance?.results || complianceResults;
  const effectiveSources = pipelineCompliance?.guidelines_sources || complianceSources;

  const safetyAlertCount = safetyResults
    ? (safetyResults.allergy_flags?.length || 0) +
      (safetyResults.interaction_flags?.length || 0) +
      (safetyResults.dose_warnings?.length || 0) +
      (safetyResults.vitals_dangers?.length || 0) +
      (safetyResults.emergency_patterns?.length || 0)
    : 0;

  const runComplianceCheck = async () => {
    if (selectedDiagnoses.length === 0 && selectedMedications.length === 0 && selectedTests.length === 0) {
      toast.error("Select diagnoses, medications, or tests first");
      return;
    }
    setLoadingCompliance(true);
    try {
      const { data, error } = await supabase.functions.invoke("guideline-compliance", {
        body: {
          diagnoses: selectedDiagnoses,
          medications: selectedMedications,
          tests: selectedTests,
          care_plan: carePlan || "",
          patient_age: patientAge,
          patient_sex: patientSex,
          chief_complaint: chiefComplaint || diagnosis || selectedDiagnoses[0] || "",
        },
      });
      if (error) throw error;
      if (data?.success) {
        setComplianceResults(data.results || []);
        setComplianceSources(data.guidelines_sources || []);
        toast.success(`Checked against ${data.guidelines_matched} guidelines`);
      } else {
        throw new Error(data?.error || "Compliance check failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to run compliance check");
    } finally {
      setLoadingCompliance(false);
    }
  };

  const logOverrideToLedger = async (
    aiOutput: string,
    aiOutputType: string,
    doctorAction: "accepted" | "rejected" | "modified" | "overridden",
    overrideReason?: string,
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("ai_decision_ledger").insert({
        doctor_id: user.id,
        visit_id: visitId || "00000000-0000-0000-0000-000000000000",
        consultation_id: consultationId || null,
        clinic_id: clinicId || "00000000-0000-0000-0000-000000000000",
        ai_output: aiOutput,
        ai_output_type: aiOutputType,
        doctor_action: doctorAction,
        override_reason: overrideReason || null,
        safety_status: safetyAlertCount > 0 ? "alerts_present" : "safe",
        metadata: { override_timestamp: new Date().toISOString(), pipeline: "modular" },
      });
    } catch { /* non-blocking */ }
  };

  const logComplianceOverride = async (result: ComplianceResult) => {
    await logOverrideToLedger(
      `${result.item} — ${result.compliance_status}: ${result.explanation}`,
      "guideline_compliance",
      "overridden",
      `Doctor overrode ${result.compliance_status} for ${result.item_type}: ${result.item}`,
    );
    toast.success("Override logged to audit trail");
  };

  const handleDiagnosisToggle = (d: string) => {
    const isRemoving = selectedDiagnoses.includes(d);
    onToggleDiagnosis(d);
    logOverrideToLedger(d, "diagnosis", isRemoving ? "rejected" : "accepted");
  };

  const handleTestToggle = (t: string) => {
    const isRemoving = selectedTests.includes(t);
    onToggleTest(t);
    logOverrideToLedger(t, "lab_test", isRemoving ? "rejected" : "accepted");
  };

  const handleMedicationToggle = (rx: { drug: string; dose: string; freq: string; dur: string }) => {
    const isRemoving = selectedMedications.some(p => p.drug_name === rx.drug);
    onToggleMedication(rx);
    logOverrideToLedger(`${rx.drug} ${rx.dose} ${rx.freq}`, "medication", isRemoving ? "rejected" : "accepted");
  };

  const toggleDiagnosisExpanded = (id: string) => {
    setExpandedDiagnoses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const alignedCount = effectiveCompliance?.filter(r => r.compliance_status === "guideline_aligned").length || 0;
  const reviewCount = effectiveCompliance?.filter(r => r.compliance_status === "review_suggested").length || 0;

  const hasHypotheses = hypotheses && hypotheses.length > 0;
  const hasBayesian = bayesianResult && bayesianResult.diagnoses.length > 0;

  const PIPELINE_STAGES = [
    { key: "context", label: "W1: Context", icon: Target },
    { key: "physiology", label: "W2: Physiology", icon: Activity },
    { key: "ddx", label: "W2: DDX", icon: Brain },
    { key: "evidence", label: "W2: Evidence", icon: BookOpen },
    { key: "bayesian", label: "W3: Bayesian", icon: TrendingUp },
    { key: "guidelines", label: "W3: Guidelines", icon: Scale },
    { key: "hypotheses", label: "W3: Diagnoses", icon: Brain },
    { key: "safety", label: "W4: Safety", icon: Shield },
    { key: "uncertainty", label: "W5: Confidence", icon: Target },
    { key: "reasoning", label: "W5: Reasoning", icon: Zap },
  ];

  const stageIndex = pipelineStage ? PIPELINE_STAGES.findIndex(s => s.key === pipelineStage) : -1;
  const isComplete = pipelineStage === "complete";

  const latencyKeyMap: Record<string, string> = {
    context: "build_context", physiology: "physiological_engine", ddx: "ddx_engine",
    bayesian: "bayesian_engine", evidence: "retrieve_evidence", hypotheses: "generate_hypotheses",
    guidelines: "retrieve_guidelines", safety: "oversight_report", uncertainty: "uncertainty_engine",
    reasoning: "hybrid_reasoning",
  };

  // Build merged diagnosis list for the three-level view
  // Combine Bayesian results with hypothesis names for best resolution
  const mergedDiagnoses: Array<{
    id: string;
    name: string;
    pct: number;
    bayesian?: BayesianDiagnosis;
    hypothesis?: HypothesisEntry;
    explanation?: DiagnosisExplanation;
    supportingEvidence: string[];
    contradictingEvidence: string[];
    recommendedTests: string[];
  }> = (() => {
    if (!hasBayesian && !hasHypotheses) return [];

    if (hasBayesian) {
      return bayesianResult!.diagnoses.slice(0, 6).map((d) => {
        const resolvedName = hypotheses?.find(
          h => h.diagnosis.toLowerCase().includes(d.diagnosis_id.slice(0, 6)) ||
               d.supporting_evidence?.some(e => h.supporting_factors?.includes(e))
        )?.diagnosis || d.diagnosis_id;
        const isUUID = /^[0-9a-f]{8}-/.test(resolvedName);
        const displayName = isUUID ? (d.supporting_evidence?.[0] || resolvedName.slice(0, 12) + "…") : resolvedName;
        const hyp = hypotheses?.find(h => h.diagnosis === displayName);
        const exp = explainability?.find(e => e.diagnosis.toLowerCase() === displayName.toLowerCase());
        return {
          id: d.diagnosis_id,
          name: displayName,
          pct: Math.round(d.posterior_probability * 100),
          bayesian: d,
          hypothesis: hyp,
          explanation: exp,
          supportingEvidence: [...(d.supporting_evidence || []), ...(hyp?.supporting_factors || [])].filter((v, i, a) => a.indexOf(v) === i),
          contradictingEvidence: hyp?.contradicting_factors || [],
          recommendedTests: hyp?.recommended_tests || [],
        };
      });
    }

    return hypotheses!.slice(0, 5).map(h => ({
      id: h.diagnosis,
      name: h.diagnosis,
      pct: Math.round((h.confidence || 0) * 100),
      hypothesis: h,
      explanation: explainability?.find(e => e.diagnosis.toLowerCase() === h.diagnosis.toLowerCase()),
      supportingEvidence: h.supporting_factors || [],
      contradictingEvidence: h.contradicting_factors || [],
      recommendedTests: h.recommended_tests || [],
    }));
  })();

  return (
    <div className="space-y-3">
      {/* Pipeline Progress Indicator */}
      {pipelineStage && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/20">
            <div className="flex items-center gap-1.5 mb-1.5">
              {isComplete ? (
                <CheckCircle className="h-3 w-3 text-primary" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
              )}
              <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">
                {isComplete ? "Pipeline Complete" : "AI Pipeline"}
              </span>
              {stageLatencies?.total && (
                <Badge variant="outline" className={`text-[8px] ml-auto ${(stageLatencies.total || 0) < 10000 ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}`}>
                  {stageLatencies.total}ms
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-0.5">
              {PIPELINE_STAGES.map((stage, i) => {
                const isDone = stageIndex > i || isComplete;
                const isActive = stageIndex === i && !isComplete;
                const Icon = stage.icon;
                const latencyKey = latencyKeyMap[stage.key];
                const latency = latencyKey && stageLatencies?.[latencyKey];
                return (
                  <div key={stage.key} className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] transition-all ${isDone ? "bg-primary/10 text-primary" : isActive ? "bg-primary/20 text-primary font-semibold animate-pulse" : "bg-muted/50 text-muted-foreground"}`}>
                    {isDone ? <CheckCircle className="h-2 w-2" /> : isActive ? <Loader2 className="h-2 w-2 animate-spin" /> : <Icon className="h-2 w-2 opacity-50" />}
                    {stage.label}
                    {isDone && latency && <span className="text-[7px] text-muted-foreground ml-0.5">{latency}ms</span>}
                  </div>
                );
              })}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Physiological Context */}
      {physiologicalContext && physiologicalContext.physiological_states.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Activity className="h-3 w-3 text-primary" /> Physiological Context
              <Badge variant="outline" className="text-[8px] ml-auto">{physiologicalContext.execution_ms}ms</Badge>
            </p>
            <div className="mb-1.5">
              <span className="text-[9px] font-medium text-muted-foreground">Affected Systems:</span>
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {physiologicalContext.affected_systems.map((sys) => (
                  <span key={sys.system_name} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 capitalize">
                    <Heart className="h-2 w-2 inline mr-0.5" />{sys.system_name}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-medium text-muted-foreground">Physiological Signals:</span>
              <div className="space-y-0.5 mt-0.5">
                {physiologicalContext.physiological_states.slice(0, 5).map((ps) => (
                  <div key={ps.state_id} className="flex items-center gap-1">
                    <span className="text-[9px] text-foreground capitalize flex-1">{ps.state.replace(/_/g, " ")}</span>
                    <Badge variant="outline" className={`text-[8px] shrink-0 ${ps.confidence >= 0.7 ? "text-emerald-600 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800" : ps.confidence >= 0.4 ? "text-amber-600 border-amber-200 dark:text-amber-400 dark:border-amber-800" : "text-muted-foreground"}`}>
                      {Math.round(ps.confidence * 100)}%
                    </Badge>
                    <span className="text-[7px] text-muted-foreground capitalize">{ps.system}</span>
                  </div>
                ))}
              </div>
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* ── THREE-LEVEL DIFFERENTIAL DIAGNOSIS PANEL ── */}
      {mergedDiagnoses.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-3 border-primary/10">
            {/* Header with level switcher */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex-1">
                Differential Diagnosis
              </span>
              {/* Reasoning Level Tabs */}
              <div className="flex items-center gap-0.5 bg-muted rounded-full p-0.5">
                <button
                  onClick={() => setReasoningLevel("doctor")}
                  className={`text-[8px] px-2 py-0.5 rounded-full transition-all font-medium ${reasoningLevel === "doctor" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Doctor
                </button>
                <button
                  onClick={() => setReasoningLevel("explanation")}
                  className={`text-[8px] px-2 py-0.5 rounded-full transition-all font-medium ${reasoningLevel === "explanation" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Info className="h-2.5 w-2.5 inline mr-0.5" />Why?
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setReasoningLevel("debug")}
                    className={`text-[8px] px-2 py-0.5 rounded-full transition-all font-medium ${reasoningLevel === "debug" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Bug className="h-2.5 w-2.5 inline mr-0.5" />Debug
                  </button>
                )}
              </div>
              {hasBayesian && (
                <Badge variant="outline" className="text-[8px]">{bayesianResult!.execution_ms}ms</Badge>
              )}
            </div>

            <div className="space-y-2">
              {mergedDiagnoses.map((dx, i) => {
                const likelihood = likelihoodCategory(dx.pct);
                const isSelected = selectedDiagnoses.includes(dx.name);
                const isExpanded = expandedDiagnoses.has(dx.id);
                const b = dx.bayesian;

                return (
                  <div key={dx.id} className={`rounded-lg border transition-all ${isExpanded ? "border-primary/20 bg-primary/[0.02]" : "border-transparent"}`}>
                    {/* ── LEVEL 1: Doctor View ── */}
                    <div className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Chip variant="diagnosis" size="sm" selected={isSelected} onClick={() => handleDiagnosisToggle(dx.name)}>
                              {dx.name}
                            </Chip>
                            <Badge variant="outline" className={`text-[9px] ${likelihood.color}`}>
                              {likelihood.label}
                            </Badge>
                            {b?.must_not_miss && (
                              <Badge variant="destructive" className="text-[8px]">⚠ Must not miss</Badge>
                            )}
                          </div>
                          {/* Supporting findings - always visible */}
                          {dx.supportingEvidence.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {dx.supportingEvidence.slice(0, 4).map((e, j) => (
                                <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                  ✓ {e}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Against findings */}
                          {dx.contradictingEvidence.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {dx.contradictingEvidence.slice(0, 3).map((e, j) => (
                                <span key={j} className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                  ✗ {e}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className={`text-sm font-bold tabular-nums ${dx.pct >= 30 ? "text-emerald-600 dark:text-emerald-400" : dx.pct >= 15 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                            {dx.pct}%
                          </span>
                          {reasoningLevel === "doctor" && (dx.explanation || (b && b.onset_modifier !== 1)) && (
                            <button
                              onClick={() => toggleDiagnosisExpanded(dx.id)}
                              className="text-[8px] text-primary hover:underline"
                            >
                              {isExpanded ? "Hide" : "Why?"}
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Probability bar */}
                      <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden ml-5">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.max(dx.pct, 2)}%` }} />
                      </div>
                    </div>

                    {/* ── LEVEL 2: Explanation View ── */}
                    {(reasoningLevel === "explanation" || (reasoningLevel === "doctor" && isExpanded)) && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-2 pb-2 ml-5 border-t border-border/50 mt-1 pt-1.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3 text-primary shrink-0" />
                            <span className="text-[10px] font-semibold text-foreground">Probability: {dx.pct}%</span>
                          </div>
                          {/* Supporting signals */}
                          {dx.supportingEvidence.length > 0 && (
                            <div>
                              <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">Supporting signals:</span>
                              <ul className="mt-0.5 space-y-0.5">
                                {dx.supportingEvidence.slice(0, 5).map((e, j) => (
                                  <li key={j} className="text-[9px] text-muted-foreground flex items-center gap-1">
                                    <TrendingUp className="h-2.5 w-2.5 text-emerald-500 shrink-0" /> {e}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Contradicting signals */}
                          {dx.contradictingEvidence.length > 0 && (
                            <div>
                              <span className="text-[9px] font-medium text-destructive">Contradicting signals:</span>
                              <ul className="mt-0.5 space-y-0.5">
                                {dx.contradictingEvidence.slice(0, 3).map((e, j) => (
                                  <li key={j} className="text-[9px] text-muted-foreground flex items-center gap-1">
                                    <TrendingDown className="h-2.5 w-2.5 text-destructive shrink-0" /> {e}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {/* Active modifiers */}
                          {b && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {b.onset_modifier && b.onset_modifier !== 1 && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${b.onset_modifier > 1 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`}>
                                  Onset ×{b.onset_modifier.toFixed(1)}
                                </span>
                              )}
                              {b.duration_modifier && b.duration_modifier !== 1 && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${b.duration_modifier > 1 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`}>
                                  Duration ×{b.duration_modifier.toFixed(1)}
                                </span>
                              )}
                              {b.vital_modifier && b.vital_modifier !== 1 && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${b.vital_modifier > 1 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`}>
                                  Vitals ×{b.vital_modifier.toFixed(1)}
                                </span>
                              )}
                              {b.risk_modifier && b.risk_modifier !== 1 && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${b.risk_modifier > 1 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`}>
                                  Risk ×{b.risk_modifier.toFixed(1)}
                                </span>
                              )}
                              {b.cluster_modifier && b.cluster_modifier !== 1 && (
                                <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${b.cluster_modifier > 1 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"}`}>
                                  Cluster ×{b.cluster_modifier.toFixed(1)}
                                </span>
                              )}
                            </div>
                          )}
                          {/* Explainability factors */}
                          {dx.explanation && (
                            <div className="mt-1 border-t border-border/50 pt-1">
                              <p className="text-[9px] text-muted-foreground italic">{dx.explanation.summary}</p>
                              {dx.explanation.confidence_rationale && (
                                <p className="text-[8px] text-muted-foreground mt-0.5">{dx.explanation.confidence_rationale}</p>
                              )}
                            </div>
                          )}
                          {/* Recommended tests for this Dx */}
                          {dx.recommendedTests.length > 0 && (
                            <div className="mt-1">
                              <span className="text-[9px] font-medium text-muted-foreground">Recommended tests:</span>
                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                {dx.recommendedTests.slice(0, 4).map((t, j) => (
                                  <button
                                    key={j}
                                    className="text-[8px] px-1.5 py-0.5 rounded-full bg-chip-lab/50 text-chip-lab-text border border-chip-lab-border hover:bg-chip-lab transition-colors"
                                    onClick={() => { if (!selectedTests.includes(t)) handleTestToggle(t); }}
                                  >
                                    + {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* ── LEVEL 3: Debug View (Admin Only) ── */}
                    {reasoningLevel === "debug" && isAdmin && b && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="px-2 pb-2 ml-5 border-t border-border/50 mt-1 pt-1.5">
                        <div className="bg-muted/50 rounded-lg p-2 space-y-1 font-mono text-[9px]">
                          <div className="flex items-center gap-1 mb-1">
                            <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                            <span className="text-[8px] font-semibold text-muted-foreground uppercase">Internal Score Breakdown</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                            <span className="text-muted-foreground">ID:</span>
                            <span className="text-foreground truncate">{b.diagnosis_id}</span>
                            <span className="text-muted-foreground">Prior:</span>
                            <span className="text-foreground">{b.prior?.toFixed(6) || "—"}</span>
                            <span className="text-muted-foreground">Symptom LH:</span>
                            <span className="text-foreground">{b.symptom_likelihood?.toFixed(4) || "—"}</span>
                            {b.coverage_ratio != null && (
                              <>
                                <span className="text-muted-foreground">Coverage:</span>
                                <span className="text-foreground">{b.coverage_ratio?.toFixed(3)}</span>
                              </>
                            )}
                            <span className="text-muted-foreground">Physio LH:</span>
                            <span className="text-foreground">{b.physiology_likelihood?.toFixed(4) || "—"}</span>
                            <span className="text-muted-foreground">Risk mod:</span>
                            <span className={b.risk_modifier !== 1 ? "text-primary font-semibold" : "text-foreground"}>×{b.risk_modifier?.toFixed(2)}</span>
                            {b.onset_modifier != null && (
                              <>
                                <span className="text-muted-foreground">Onset mod:</span>
                                <span className={b.onset_modifier !== 1 ? "text-primary font-semibold" : "text-foreground"}>×{b.onset_modifier?.toFixed(2)}</span>
                              </>
                            )}
                            {b.duration_modifier != null && (
                              <>
                                <span className="text-muted-foreground">Duration mod:</span>
                                <span className={b.duration_modifier !== 1 ? "text-primary font-semibold" : "text-foreground"}>×{b.duration_modifier?.toFixed(2)}</span>
                              </>
                            )}
                            {b.vital_modifier != null && (
                              <>
                                <span className="text-muted-foreground">Vital mod:</span>
                                <span className={b.vital_modifier !== 1 ? "text-primary font-semibold" : "text-foreground"}>×{b.vital_modifier?.toFixed(2)}</span>
                              </>
                            )}
                            {b.cluster_modifier != null && (
                              <>
                                <span className="text-muted-foreground">Cluster mod:</span>
                                <span className={b.cluster_modifier !== 1 ? "text-primary font-semibold" : "text-foreground"}>×{b.cluster_modifier?.toFixed(2)}</span>
                              </>
                            )}
                            {b.history_multiplier != null && (
                              <>
                                <span className="text-muted-foreground">History mult:</span>
                                <span className={b.history_multiplier !== 1 ? "text-primary font-semibold" : "text-foreground"}>×{b.history_multiplier?.toFixed(2)}</span>
                              </>
                            )}
                            <span className="text-muted-foreground font-bold border-t border-border pt-0.5">Posterior:</span>
                            <span className="text-primary font-bold border-t border-border pt-0.5">{b.posterior_probability?.toFixed(6)}</span>
                          </div>
                          {b.supporting_evidence && b.supporting_evidence.length > 0 && (
                            <div className="mt-1 border-t border-border pt-1">
                              <span className="text-muted-foreground">Evidence nodes:</span>
                              <p className="text-foreground">{b.supporting_evidence.join(", ")}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bayesian summary footer */}
            {hasBayesian && (
              <p className="text-[8px] text-muted-foreground mt-2 pt-1.5 border-t border-border">
                {bayesianResult!.symptoms_resolved} symptoms · {bayesianResult!.physiology_states_used} physio · {bayesianResult!.risk_factors_applied} risk factors
                {bayesianResult!.onset_pattern && <> · onset: {bayesianResult!.onset_pattern}</>}
                {bayesianResult!.duration_category && <> · duration: {bayesianResult!.duration_category}</>}
                {bayesianResult!.cluster_matches && bayesianResult!.cluster_matches > 0 && <> · {bayesianResult!.cluster_matches} clusters</>}
              </p>
            )}
          </ClinicalCard>
        </motion.div>
      )}

      {/* Fallback: simple diagnoses if no pipeline data */}
      {mergedDiagnoses.length === 0 && diagnoses.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Brain className="h-3 w-3 text-primary" /> Possible Diagnosis
            </p>
            <div className="flex flex-wrap gap-1">
              {diagnoses.slice(0, 3).map(d => (
                <Chip key={d} variant="diagnosis" size="sm" selected={selectedDiagnoses.includes(d)} onClick={() => handleDiagnosisToggle(d)}>
                  {d}
                </Chip>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Recommended Tests */}
      {tests.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-chip-lab-text" /> Recommended Tests
            </p>
            <div className="flex flex-wrap gap-1">
              {tests.map(t => (
                <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)} onClick={() => handleTestToggle(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Recommended Medications */}
      {medications.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Pill className="h-3 w-3 text-chip-medication-text" /> Medication Suggestions
            </p>
            <div className="flex flex-wrap gap-1">
              {medications.map((rx, i) => (
                <Chip key={i} variant="medication" size="sm" addable selected={selectedMedications.some(p => p.drug_name === rx.drug)} onClick={() => handleMedicationToggle(rx)}>
                  {rx.drug} {rx.dose} {rx.freq}
                </Chip>
              ))}
            </div>
            <p className="text-[8px] text-muted-foreground mt-1 italic">Tap to add. AI never auto-finalizes prescriptions.</p>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Medication Intelligence Panel */}
      {medicationValidation && medicationValidation.warnings.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className={`p-2.5 ${medicationValidation.summary.critical_warnings > 0 ? "border-destructive/40" : "border-amber-400/30"}`}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Pill className="h-3 w-3 text-chip-medication-text" /> Medication Intelligence
              <Badge variant={medicationValidation.summary.critical_warnings > 0 ? "destructive" : "outline"} className="text-[9px] ml-auto">
                {medicationValidation.summary.total_warnings} alert{medicationValidation.summary.total_warnings !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="outline" className={`text-[9px] ${safetyScoreColor(medicationValidation.summary.safety_score)}`}>
                Safety: {medicationValidation.summary.safety_score}%
              </Badge>
            </p>
            <div className="space-y-1">
              {sortWarnings(medicationValidation.warnings).map((w, i) => {
                const isAllergy = w.type === "allergy";
                const isCritical = w.severity === "critical";
                const isInteraction = w.type === "interaction";
                const isPediatric = w.type === "pediatric_dose";
                const bgClass = isCritical ? "bg-destructive/10 border-destructive/30" : w.severity === "high" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" : "bg-muted border-border";
                const textClass = isCritical ? "text-destructive" : w.severity === "high" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";
                return (
                  <div key={i} className={`flex items-start gap-1.5 text-xs p-1.5 rounded border ${bgClass}`}>
                    {isAllergy ? <AlertTriangle className={`h-3 w-3 shrink-0 mt-0.5 ${textClass}`} /> : isInteraction ? <Shield className={`h-3 w-3 shrink-0 mt-0.5 ${textClass}`} /> : isPediatric ? <Target className={`h-3 w-3 shrink-0 mt-0.5 ${textClass}`} /> : <AlertTriangle className={`h-3 w-3 shrink-0 mt-0.5 ${textClass}`} />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[8px]">{w.type.replace(/_/g, " ")}</Badge>
                        <Badge variant="outline" className={`text-[8px] ${isCritical ? "border-destructive/50 text-destructive" : ""}`}>{w.severity}</Badge>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${textClass}`}>{w.message}</p>
                      {w.details?.recommended_action && <p className="text-[9px] mt-0.5 text-muted-foreground italic">Action: {String(w.details.recommended_action)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            {medicationValidation.summary.is_pediatric && (
              <p className="text-[8px] text-muted-foreground mt-1 italic flex items-center gap-1"><Target className="h-2.5 w-2.5" /> Pediatric dose validation active</p>
            )}
            <p className="text-[8px] text-muted-foreground mt-1 italic">Validated in {medicationValidation.summary.validation_ms}ms. Clinical judgment required.</p>
          </ClinicalCard>
        </motion.div>
      )}

      {instructions.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-primary" /> Instructions to Patients
            </p>
            <div className="flex flex-wrap gap-1">
              {instructions.map((inst, i) => (
                <Chip key={i} variant="action" size="sm" selected={selectedInstructions.includes(inst)} onClick={() => onToggleInstruction(inst)}>{inst}</Chip>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Safety Alerts */}
      {safetyResults && (
        <motion.div {...fadeIn}>
          <ClinicalCard className={`p-2.5 ${safetyAlertCount === 0 ? "border-emerald-500/20" : "border-destructive/30"}`}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary" /> Safety Alerts
              {safetyAlertCount > 0 && <Badge variant="destructive" className="text-[9px] ml-auto">{safetyAlertCount}</Badge>}
            </p>
            <div className="space-y-1">
              {safetyResults.interaction_flags?.length > 0 ? (
                safetyResults.interaction_flags.map((f, i) => (
                  <div key={`int-${i}`} className="flex items-start gap-1.5 text-xs p-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <Shield className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" />
                    <div><span className="font-semibold text-amber-700 dark:text-amber-400">{f.drug_a} ↔ {f.drug_b}</span><span className="text-amber-600 dark:text-amber-400 ml-1">({f.severity})</span>{f.description && <p className="text-[10px] text-amber-600 dark:text-amber-400">{f.description}</p>}</div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-1.5 text-xs"><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No drug interactions</span></div>
              )}
              {safetyResults.allergy_flags?.length > 0 ? (
                safetyResults.allergy_flags.map((f, i) => (
                  <div key={`allergy-${i}`} className="flex items-start gap-1.5 text-xs p-1 rounded bg-chip-alert border border-chip-alert-border"><AlertTriangle className="h-3 w-3 text-chip-alert-text shrink-0 mt-0.5" /><span className="text-chip-alert-text font-medium">{f.message}</span></div>
                ))
              ) : (
                <div className="flex items-center gap-1.5 text-xs"><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No allergy conflicts</span></div>
              )}
              {safetyResults.dose_warnings?.length > 0 ? (
                safetyResults.dose_warnings.map((w, i) => (
                  <div key={`dose-${i}`} className="flex items-start gap-1.5 text-xs p-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"><AlertTriangle className="h-3 w-3 text-amber-600 shrink-0 mt-0.5" /><span className="text-amber-700 dark:text-amber-400">{w.message}</span></div>
                ))
              ) : (
                <div className="flex items-center gap-1.5 text-xs"><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">Dose within limits</span></div>
              )}
              {(safetyResults.vitals_dangers?.length || 0) > 0 ? (
                safetyResults.vitals_dangers!.map((v, i) => (
                  <div key={`vital-${i}`} className="flex items-start gap-1.5 text-xs p-1 rounded bg-destructive/10 border border-destructive/30"><AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" /><span className="text-destructive font-semibold">{v.message}</span></div>
                ))
              ) : (
                <div className="flex items-center gap-1.5 text-xs"><CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" /><span className="text-emerald-700 dark:text-emerald-400">No dangerous vitals</span></div>
              )}
              {(safetyResults.emergency_patterns?.length || 0) > 0 && (
                safetyResults.emergency_patterns!.map((ep, i) => (
                  <div key={`em-${i}`} className="flex items-start gap-1.5 text-xs p-1 rounded bg-destructive/10 border border-destructive/30"><Zap className="h-3 w-3 text-destructive shrink-0 mt-0.5" /><div><span className="text-destructive font-bold">{ep.pattern}</span><p className="text-[10px] text-destructive">{ep.message}</p></div></div>
                ))
              )}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Explainability Panel — SHAP-style factor attribution */}
      {explainability && explainability.length > 0 && reasoningLevel !== "explanation" && (
        <motion.div {...fadeIn}>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
                <Eye className="h-3 w-3 text-primary shrink-0" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">AI Reasoning Explained</span>
                <Badge variant="outline" className="text-[9px]">{explainability.length} diagnos{explainability.length === 1 ? "is" : "es"}</Badge>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <ClinicalCard className="p-2.5 space-y-3">
                {explainability.map((exp, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground">{exp.diagnosis}</span>
                      <div className="flex gap-1 ml-auto">
                        <Badge variant="outline" className="text-[8px] text-emerald-600 border-emerald-200">+{exp.factor_counts.positive}</Badge>
                        {exp.factor_counts.negative > 0 && <Badge variant="outline" className="text-[8px] text-destructive border-destructive/30">−{exp.factor_counts.negative}</Badge>}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">{exp.summary}</p>
                    <div className="space-y-0.5">
                      {exp.factors.slice(0, 6).map((f, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[10px]">
                          {f.direction === "positive" ? <TrendingUp className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" /> : f.direction === "negative" ? <TrendingDown className="h-2.5 w-2.5 text-destructive shrink-0" /> : <Minus className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                          <span className={`flex-1 ${factorDirectionColor(f.direction)}`}>{f.factor}</span>
                          <Badge variant="outline" className="text-[7px]">{f.type}</Badge>
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${f.direction === "positive" ? "bg-emerald-500" : f.direction === "negative" ? "bg-destructive" : "bg-muted-foreground"}`} style={{ width: factorBarWidth(f.weight) }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {exp.confidence_rationale && <p className="text-[9px] text-muted-foreground border-t border-border pt-1 mt-1">{exp.confidence_rationale}</p>}
                    {i < explainability.length - 1 && <div className="border-b border-border" />}
                  </div>
                ))}
                <p className="text-[8px] text-muted-foreground italic pt-1 border-t border-border">Factor weights are approximate. All reasoning requires clinical validation.</p>
              </ClinicalCard>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}

      {/* Guideline Compliance */}
      <motion.div {...fadeIn}>
        <Collapsible open={complianceExpanded || !!pipelineCompliance} onOpenChange={setComplianceExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
              <Scale className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">Guideline Compliance</span>
              {pipelineCompliance?.guideline_compliance_score != null && (
                <Badge variant="outline" className={`text-[9px] ${pipelineCompliance.guideline_compliance_score >= 75 ? "text-emerald-600 border-emerald-200" : pipelineCompliance.guideline_compliance_score >= 40 ? "text-amber-600 border-amber-200" : "text-destructive"}`}>
                  {pipelineCompliance.guideline_compliance_score}%
                </Badge>
              )}
              {effectiveCompliance && (
                <div className="flex gap-1">
                  {alignedCount > 0 && <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 dark:border-emerald-800">{alignedCount} aligned</Badge>}
                  {reviewCount > 0 && <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200 dark:border-amber-800">{reviewCount} review</Badge>}
                </div>
              )}
              {complianceExpanded || pipelineCompliance ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <ClinicalCard className="p-2.5 space-y-2">
              {!effectiveCompliance ? (
                <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={runComplianceCheck} disabled={loadingCompliance || (selectedDiagnoses.length === 0 && selectedMedications.length === 0 && selectedTests.length === 0)}>
                  {loadingCompliance && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <Scale className="h-3 w-3 mr-1" />Check Guideline Compliance
                </Button>
              ) : (
                <div className="space-y-2">
                  {effectiveSources.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                      <span className="font-semibold">Sources:</span>
                      {effectiveSources.map((src, i) => <Badge key={i} variant="outline" className="text-[8px]">{src}</Badge>)}
                    </div>
                  )}
                  {pipelineCompliance?.conflicts_detected && pipelineCompliance.conflicts_detected.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-semibold text-destructive uppercase">Conflicts Detected</p>
                      {pipelineCompliance.conflicts_detected.map((c, i) => (
                        <div key={i} className="text-[10px] p-1.5 rounded border border-destructive/30 bg-destructive/5 text-destructive">
                          <span className="font-semibold">{c.organization}</span>: {c.explanation.substring(0, 150)}
                        </div>
                      ))}
                    </div>
                  )}
                  {effectiveCompliance.map((result, i) => {
                    const config = COMPLIANCE_CONFIG[result.compliance_status] || COMPLIANCE_CONFIG.review_suggested;
                    const StatusIcon = config.icon;
                    return (
                      <div key={i} className={`rounded-lg border p-2 ${config.color}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <StatusIcon className="h-3 w-3 shrink-0" />
                              <span className="text-[9px] font-semibold uppercase">{config.label}</span>
                              <Badge variant="outline" className="text-[8px]">{result.item_type}</Badge>
                            </div>
                            <p className="text-xs font-medium truncate">{result.item}</p>
                            <p className="text-[10px] mt-0.5 opacity-80">{result.explanation}</p>
                            {result.matching_guidelines.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {result.matching_guidelines.map((g, j) => (
                                  <div key={j} className="text-[9px] flex items-start gap-1">
                                    <BookOpen className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-semibold">{g.source_organization}</span> · <span>{g.title}</span> · <span>{g.year}</span> · Grade: {g.evidence_grade}
                                      {g.guideline_url && <a href={g.guideline_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline"><ExternalLink className="h-2 w-2" /> View</a>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {result.compliance_status === "review_suggested" && (
                            <Button size="sm" variant="ghost" className="h-6 text-[9px] px-2 shrink-0" onClick={() => logComplianceOverride(result)}>Override</Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!pipelineCompliance && (
                    <Button size="sm" variant="ghost" className="w-full text-xs h-6" onClick={() => { setComplianceResults(null); setComplianceSources([]); }}>Reset & Re-check</Button>
                  )}
                  <p className="text-[9px] text-muted-foreground italic pt-1 border-t border-border">Guideline compliance is advisory. Clinical judgment required for all decisions.</p>
                </div>
              )}
            </ClinicalCard>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Evidence Sources */}
      <motion.div {...fadeIn}>
        <Collapsible open={evidenceExpanded || !!pipelineEvidence} onOpenChange={setEvidenceExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">Evidence Sources</span>
              {(pipelineEvidence || evidence) && <Badge variant="outline" className="text-[10px]">{pipelineEvidence ? pipelineEvidence.citations.length : evidence?.total_citations}</Badge>}
              {evidenceExpanded || pipelineEvidence ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <ClinicalCard className="p-2.5 space-y-2">
              {pipelineEvidence && pipelineEvidence.citations.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">{pipelineEvidence.citations.length} citations</Badge>
                    <span>•</span><span>{pipelineEvidence.sources_queried.join(", ")}</span>
                    <Badge variant="outline" className={`text-[8px] ml-auto ${pipelineEvidence.retrieval_confidence === "high" ? "text-emerald-600" : pipelineEvidence.retrieval_confidence === "moderate" ? "text-amber-600" : "text-muted-foreground"}`}>{pipelineEvidence.retrieval_confidence}</Badge>
                  </div>
                  {pipelineEvidence.citations.slice(0, 5).map((cit, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground">{cit.title}</span>
                      <span className="ml-1">({cit.source}, {cit.year})</span>
                      {cit.url && <a href={cit.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">→</a>}
                    </div>
                  ))}
                  <p className="text-[9px] text-muted-foreground italic pt-1 border-t border-border">Evidence is advisory only. Clinical judgment required.</p>
                </div>
              ) : !evidence ? (
                <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={async () => {
                  const hasDiagnosis = !!(diagnosis || selectedDiagnoses[0] || chiefComplaint);
                  const hasMeds = selectedMedications.length > 0;
                  if (!hasDiagnosis && !hasMeds) { toast.error("Select a diagnosis or medication first"); return; }
                  setLoadingEvidence(true);
                  try {
                    const { data, error } = await supabase.functions.invoke("evidence-agents", { body: { medications: selectedMedications.map(m => m.drug_name), diagnosis: diagnosis || selectedDiagnoses[0] || chiefComplaint || "", patient_age: patientAge, allergies: allergies } });
                    if (error) throw error;
                    setEvidence(data);
                    toast.success("Evidence retrieved");
                  } catch (err) { console.error(err); toast.error("Failed to retrieve evidence"); } finally { setLoadingEvidence(false); }
                }} disabled={loadingEvidence || (selectedMedications.length === 0 && !diagnosis && selectedDiagnoses.length === 0 && !chiefComplaint)}>
                  {loadingEvidence && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Retrieve Evidence
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">{evidence.total_citations} citations</Badge>
                    <span>•</span><span>{evidence.sources_queried.join(", ")}</span>
                  </div>
                  {evidence.medication_evidence.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Medication Evidence</p>
                      {evidence.medication_evidence.map((med, i) => (
                        <div key={i} className="text-xs space-y-0.5"><p className="font-semibold text-foreground">{med.drug}</p><p className="text-muted-foreground text-[11px]">{med.summary}</p></div>
                      ))}
                    </div>
                  )}
                  {evidence.guidelines.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Guidelines</p>
                      {evidence.guidelines.map((guide, i) => (
                        <div key={i} className="text-xs"><p className="font-semibold text-foreground">{guide.source}</p><p className="text-muted-foreground text-[11px]">{guide.guidance}</p></div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground italic pt-1 border-t border-border">Evidence is advisory only. Clinical judgment required.</p>
                </div>
              )}
            </ClinicalCard>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    </div>
  );
}
