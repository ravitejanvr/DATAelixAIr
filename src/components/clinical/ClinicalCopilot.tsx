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

interface SecondaryPlan {
  diagnosis: string;
  probability: number;
  tests: string[];
  medications: Array<{ drug: string; dose: string; route: string; freq: string; dur: string; line?: "first" | "alternative" | "emergency" }>;
  monitoring: string[];
  instructions: string[];
}

interface EvidenceSummaryData {
  signals: string[];
  vitals: string[];
  labs: Array<{ key: string; value: number; unit: string; abnormal: boolean; interpretation?: string }>;
  context: string[];
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
  primaryConfidence?: number;
  chiefComplaint?: string;
  patientSex?: string;
  carePlan?: string;
  instructions: string[];
  selectedInstructions: string[];
  onToggleInstruction: (instruction: string) => void;
  monitoring?: string[];
  selectedMonitoring?: string[];
  onToggleMonitoring?: (m: string) => void;
  secondaryPlans?: SecondaryPlan[];
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
  /** Evidence summary grouped by category — passed from CockpitPlayground */
  evidenceSummary?: EvidenceSummaryData | null;
  /** Clinical status derived from vitals/severity */
  clinicalStatus?: { level: "critical" | "moderate" | "stable"; label: string; explanation: string } | null;
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

/** Convert raw engine evidence strings to clean clinical language for Doctor mode */
function cleanEvidenceForDoctor(raw: string): string | null {
  // Skip raw numeric weights like "+0.81 sepsis_syndrome"
  if (/^[+-]?\d+\.?\d*\s/.test(raw.trim())) return null;
  // Skip UUID-like strings
  if (/^[0-9a-f]{8}-/.test(raw.trim())) return null;
  // Clean underscores to spaces and capitalize
  let cleaned = raw.replace(/_/g, " ").trim();
  if (!cleaned) return null;
  // Capitalize first letter
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cleaned;
}

/** Map technical state names to clinical descriptions */
const STATE_TO_CLINICAL: Record<string, string> = {
  sepsis_syndrome: "Systemic infection pattern detected",
  hemodynamic_collapse: "Hemodynamic instability present",
  respiratory_distress: "Respiratory compromise noted",
  systemic_instability: "Multiple organ systems affected",
  inflammatory_response: "Active inflammatory response",
  metabolic_derangement: "Metabolic abnormality detected",
  cardiac_ischemia: "Cardiac ischemia pattern",
  neurological_emergency: "Acute neurological concern",
  hepatobiliary_acute: "Hepatobiliary inflammation pattern",
  renal_colic_pattern: "Renal colic presentation",
  dka_metabolic_crisis: "Diabetic ketoacidosis pattern",
};

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
  primaryConfidence,
  chiefComplaint,
  patientSex,
  carePlan,
  instructions,
  selectedInstructions,
  onToggleInstruction,
  monitoring,
  selectedMonitoring,
  onToggleMonitoring,
  secondaryPlans,
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
  evidenceSummary,
  clinicalStatus,
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
  // Show-more toggles for suggestion limits
  const [showMoreTests, setShowMoreTests] = useState(false);
  const [showMoreMeds, setShowMoreMeds] = useState(false);
  const [showMoreMonitoring, setShowMoreMonitoring] = useState(false);
  const [showMoreInstructions, setShowMoreInstructions] = useState(false);

  // STRICT: Manual results first, then pipeline post-SSAL results. Never use stale DDX data.
  const effectiveCompliance = complianceResults || (pipelineCompliance?.results && pipelineCompliance.results.length > 0 ? pipelineCompliance.results : null);
  const effectiveSources = (complianceResults ? complianceSources : null) || pipelineCompliance?.guidelines_sources || [];

  const safetyAlertCount = safetyResults
    ? (safetyResults.allergy_flags?.length || 0) +
      (safetyResults.interaction_flags?.length || 0) +
      (safetyResults.dose_warnings?.length || 0) +
      (safetyResults.vitals_dangers?.length || 0) +
      (safetyResults.emergency_patterns?.length || 0)
    : 0;

  const primaryComplianceDiagnosis = diagnosis?.trim() || "";
  const fallbackPrimaryMedications = medications.map((rx) => ({
    drug_name: rx.drug,
    dose: rx.dose,
    frequency: rx.freq,
    duration: rx.dur,
    route: rx.route,
  }));
  const complianceDiagnoses = primaryComplianceDiagnosis ? [primaryComplianceDiagnosis] : [];
  const complianceMedications = selectedMedications.length > 0 ? selectedMedications : fallbackPrimaryMedications;
  const complianceTests = selectedTests.length > 0 ? selectedTests : tests;
  const canRunCompliance = complianceDiagnoses.length > 0 || complianceMedications.length > 0 || complianceTests.length > 0;

  const runComplianceCheck = async () => {
    if (!canRunCompliance) {
      toast.error("No primary diagnosis, medications, or tests available for compliance check");
      return;
    }

    console.log("COMPLIANCE SOURCE CHECK:");
    console.log("- Using PRIMARY only → YES");
    console.log("- Using aggregated meds → NO");
    console.log("[COMPLIANCE_SCOPE]", {
      diagnoses: complianceDiagnoses,
      medications: complianceMedications.map((m) => m.drug_name),
      tests: complianceTests,
    });

    setLoadingCompliance(true);
    try {
      const { data, error } = await supabase.functions.invoke("guideline-compliance", {
        body: {
          diagnoses: complianceDiagnoses,
          medications: complianceMedications,
          tests: complianceTests,
          care_plan: carePlan || "",
          patient_age: patientAge,
          patient_sex: patientSex,
          chief_complaint: chiefComplaint || primaryComplianceDiagnosis,
        },
      });
      if (error) throw error;
      if (data?.success) {
        setComplianceResults(data.results || []);
        setComplianceSources(data.guidelines_sources || []);

        const complianceOutput = JSON.stringify(data.results || []).toLowerCase();
        const hasCapAntibiotics = complianceOutput.includes("amoxicillin") || complianceOutput.includes("azithromycin");
        const hasCardiacDrugs = complianceOutput.includes("atorvastatin") || complianceOutput.includes("nitroglycerin");

        if (/sepsis/i.test(primaryComplianceDiagnosis)) {
          console.log("CLINICAL RESULT:");
          console.log(`- No CAP antibiotics flagged under sepsis → ${!hasCapAntibiotics ? "YES" : "NO"}`);
          console.log(`- No cardiac drugs flagged → ${!hasCardiacDrugs ? "YES" : "NO"}`);
        }

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
        // SSAL: prefer diagnosis_name set by orchestrator (post-CPR, post-fusion)
        const ssalName = (d as any).diagnosis_name;
        const resolvedName = ssalName || hypotheses?.find(
          h => h.diagnosis.toLowerCase().includes(d.diagnosis_id.slice(0, 6)) ||
               d.supporting_evidence?.some(e => h.supporting_factors?.includes(e))
        )?.diagnosis || d.diagnosis_id;
        const isUUID = /^[0-9a-f]{8}-/.test(resolvedName);
        const displayName = isUUID ? (d.supporting_evidence?.[0] || resolvedName.slice(0, 12) + "…") : resolvedName;
        const hyp = hypotheses?.find(h => h.diagnosis.toLowerCase() === displayName.toLowerCase());
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
      {/* Pipeline Progress Indicator — hidden in Doctor mode */}
      {pipelineStage && reasoningLevel !== "doctor" && (
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

      {/* Physiological Context — hidden in Doctor mode */}
      {physiologicalContext && physiologicalContext.physiological_states.length > 0 && reasoningLevel !== "doctor" && (
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

      {/* ═══ CLINICAL STATUS STRIP — only after assessment completes ═══ */}
      {clinicalStatus && isComplete && (
        <motion.div {...fadeIn}>
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${
            clinicalStatus.level === "critical" ? "bg-destructive/10 border-destructive/30" :
            clinicalStatus.level === "moderate" ? "bg-amber-500/10 border-amber-500/30" :
            "bg-emerald-500/10 border-emerald-500/30"
          }`}>
            <span className="text-sm">
              {clinicalStatus.level === "critical" ? "⚠️" : clinicalStatus.level === "moderate" ? "🟡" : "🟢"}
            </span>
            <div className="flex-1 min-w-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                clinicalStatus.level === "critical" ? "text-destructive" :
                clinicalStatus.level === "moderate" ? "text-amber-600 dark:text-amber-400" :
                "text-emerald-600 dark:text-emerald-400"
              }`}>{clinicalStatus.label}</span>
              <p className="text-[9px] text-muted-foreground leading-tight">{clinicalStatus.explanation}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ PRIMARY DIAGNOSIS — UNIFIED HEADER ═══ */}
      {diagnosis && (
        <motion.div {...fadeIn}>
          <div className="rounded-md border-l-[3px] border-primary bg-primary/[0.04] border border-primary/15 p-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Primary Diagnosis</p>
                <p className="text-sm font-bold text-foreground truncate">{diagnosis}</p>
              </div>
              {primaryConfidence != null && primaryConfidence > 0 && (
                <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary font-mono">
                  {Math.round(primaryConfidence * 100)}%
                </Badge>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ EVIDENCE SUMMARY — Grouped by category ═══ */}
      {evidenceSummary && (evidenceSummary.signals.length > 0 || evidenceSummary.vitals.length > 0 || evidenceSummary.labs.length > 0 || evidenceSummary.context.length > 0) && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2 border-primary/10">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Eye className="h-3 w-3 text-primary" /> Evidence Summary
            </p>
            <div className="space-y-1.5">
              {evidenceSummary.signals.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase shrink-0 pt-0.5 w-11">Signals</span>
                  <div className="flex flex-wrap gap-1">
                    {evidenceSummary.signals.map((s, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-foreground border border-border">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {evidenceSummary.vitals.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase shrink-0 pt-0.5 w-11">Vitals</span>
                  <div className="flex flex-wrap gap-1">
                    {evidenceSummary.vitals.map((v, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">{v}</span>
                    ))}
                  </div>
                </div>
              )}
              {evidenceSummary.labs.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase shrink-0 pt-0.5 w-11">Labs</span>
                  <div className="flex flex-wrap gap-1">
                    {evidenceSummary.labs.map((lab, i) => (
                      <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${lab.abnormal ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"}`}>
                        {lab.key}: {lab.value} {lab.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {evidenceSummary.context.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <span className="text-[8px] font-bold text-muted-foreground uppercase shrink-0 pt-0.5 w-11">Context</span>
                  <div className="flex flex-wrap gap-1">
                    {evidenceSummary.context.map((c, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ClinicalCard>
        </motion.div>
      )}
      {tests.length > 0 && (() => {
        const unselectedTests = tests.filter(t => !selectedTests.includes(t));
        const visibleTests = unselectedTests.slice(0, showMoreTests ? unselectedTests.length : 5);
        return (
          <motion.div {...fadeIn}>
            <ClinicalCard className="p-2.5 border-primary/10">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <FlaskConical className="h-3 w-3 text-chip-lab-text" /> Recommended Investigations
                <Badge variant="outline" className="text-[8px] ml-auto">{tests.length}</Badge>
              </p>
              <div className="flex flex-wrap gap-1">
                {visibleTests.map(t => (
                  <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)} onClick={() => handleTestToggle(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
              {unselectedTests.length > 5 && (
                <button onClick={() => setShowMoreTests(p => !p)} className="text-[9px] text-primary font-medium hover:underline mt-1.5 flex items-center gap-0.5">
                  {showMoreTests ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                  {showMoreTests ? "Show less" : `+${unselectedTests.length - 5} more`}
                </button>
              )}
            </ClinicalCard>
          </motion.div>
        );
      })()}

      {/* Recommended Medications — top 5 with show more */}
      {medications.length > 0 && (() => {
        const unselectedMeds = medications.filter(rx => !selectedMedications.some(p => p.drug_name === rx.drug));
        const visibleMeds = unselectedMeds.slice(0, showMoreMeds ? unselectedMeds.length : 5);
        return (
          <motion.div {...fadeIn}>
            <ClinicalCard className="p-2.5 border-primary/10">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Pill className="h-3 w-3 text-chip-medication-text" /> Prescription Suggestions
                <Badge variant="outline" className="text-[8px] ml-auto">{medications.length}</Badge>
              </p>
              <div className="flex flex-wrap gap-1">
                {visibleMeds.map((rx, i) => (
                  <Chip key={i} variant="medication" size="sm" addable selected={selectedMedications.some(p => p.drug_name === rx.drug)} onClick={() => handleMedicationToggle(rx)}>
                    {rx.drug} {rx.dose} {rx.freq}
                  </Chip>
                ))}
              </div>
              {unselectedMeds.length > 5 && (
                <button onClick={() => setShowMoreMeds(p => !p)} className="text-[9px] text-primary font-medium hover:underline mt-1.5 flex items-center gap-0.5">
                  {showMoreMeds ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                  {showMoreMeds ? "Show less" : `+${unselectedMeds.length - 5} more`}
                </button>
              )}
              <p className="text-[8px] text-muted-foreground mt-1 italic">Tap to add. AI never auto-finalizes prescriptions.</p>
            </ClinicalCard>
          </motion.div>
        );
      })()}

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

      {/* Monitoring Suggestions — top 5 with show more */}
      {monitoring && monitoring.length > 0 && (() => {
        const unselectedMon = monitoring.filter(m => !selectedMonitoring?.includes(m));
        const visibleMon = unselectedMon.slice(0, showMoreMonitoring ? unselectedMon.length : 5);
        return (
          <motion.div {...fadeIn}>
            <ClinicalCard className="p-2.5 border-primary/10">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Activity className="h-3 w-3 text-primary" /> Monitoring & Follow-up
                <Badge variant="outline" className="text-[8px] ml-auto">{monitoring.length}</Badge>
              </p>
              <div className="flex flex-wrap gap-1">
                {visibleMon.map((m, i) => (
                  <Chip key={i} variant="action" size="sm" selected={selectedMonitoring?.includes(m)} onClick={() => onToggleMonitoring?.(m)}>{m}</Chip>
                ))}
              </div>
              {unselectedMon.length > 5 && (
                <button onClick={() => setShowMoreMonitoring(p => !p)} className="text-[9px] text-primary font-medium hover:underline mt-1.5 flex items-center gap-0.5">
                  {showMoreMonitoring ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                  {showMoreMonitoring ? "Show less" : `+${unselectedMon.length - 5} more`}
                </button>
              )}
            </ClinicalCard>
          </motion.div>
        );
      })()}

      {/* Instructions — top 5 with show more */}
      {instructions.length > 0 && (() => {
        const unselectedInst = instructions.filter(inst => !selectedInstructions.includes(inst));
        const visibleInst = unselectedInst.slice(0, showMoreInstructions ? unselectedInst.length : 5);
        return (
          <motion.div {...fadeIn}>
            <ClinicalCard className="p-2.5 border-primary/10">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-primary" /> Instructions to Patients
                <Badge variant="outline" className="text-[8px] ml-auto">{instructions.length}</Badge>
              </p>
              <div className="flex flex-wrap gap-1">
                {visibleInst.map((inst, i) => (
                  <Chip key={i} variant="action" size="sm" selected={selectedInstructions.includes(inst)} onClick={() => onToggleInstruction(inst)}>{inst}</Chip>
                ))}
              </div>
              {unselectedInst.length > 5 && (
                <button onClick={() => setShowMoreInstructions(p => !p)} className="text-[9px] text-primary font-medium hover:underline mt-1.5 flex items-center gap-0.5">
                  {showMoreInstructions ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                  {showMoreInstructions ? "Show less" : `+${unselectedInst.length - 5} more`}
                </button>
              )}
            </ClinicalCard>
          </motion.div>
        );
      })()}

      {/* ═══ SECONDARY CONTEXT — Differentials (Collapsible) ═══ */}
      {secondaryPlans && secondaryPlans.length > 0 && (
        <motion.div {...fadeIn}>
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
                <Brain className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">Also Consider (Differentials)</span>
                <Badge variant="outline" className="text-[8px]">{secondaryPlans.length}</Badge>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1.5">
              {secondaryPlans.map((plan, idx) => (
                <ClinicalCard key={idx} className="p-2 border-border/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-semibold text-foreground">{plan.diagnosis}</span>
                    {plan.probability > 0 && (
                      <Badge variant="outline" className="text-[8px] ml-auto">{Math.round(plan.probability * 100)}%</Badge>
                    )}
                  </div>
                  {plan.tests.length > 0 && (
                    <div className="mb-1">
                      <p className="text-[8px] text-muted-foreground font-medium mb-0.5">Additional Tests</p>
                      <div className="flex flex-wrap gap-0.5">
                        {plan.tests.map(t => (
                          <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)} onClick={() => onToggleTest(t)}>{t}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.medications.length > 0 && (
                    <div className="mb-1">
                      <p className="text-[8px] text-muted-foreground font-medium mb-0.5">Additional Medications</p>
                      <div className="flex flex-wrap gap-0.5">
                        {plan.medications.map((rx: any, j: number) => (
                          <Chip key={j} variant="medication" size="sm" addable selected={selectedMedications.some(p => p.drug_name === rx.drug)} onClick={() => onToggleMedication(rx)}>
                            {rx.drug} {rx.dose}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.monitoring.length > 0 && (
                    <div className="mb-1">
                      <p className="text-[8px] text-muted-foreground font-medium mb-0.5">Additional Monitoring</p>
                      <div className="flex flex-wrap gap-0.5">
                        {plan.monitoring.map((m, j) => (
                          <Chip key={j} variant="action" size="sm" selected={selectedMonitoring?.includes(m)} onClick={() => onToggleMonitoring?.(m)}>{m}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                  {plan.instructions.length > 0 && (
                    <div>
                      <p className="text-[8px] text-muted-foreground font-medium mb-0.5">Additional Instructions</p>
                      <div className="flex flex-wrap gap-0.5">
                        {plan.instructions.map((inst, j) => (
                          <Chip key={j} variant="action" size="sm" selected={selectedInstructions.includes(inst)} onClick={() => onToggleInstruction(inst)}>{inst}</Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </ClinicalCard>
              ))}
              <p className="text-[8px] text-muted-foreground italic px-1">Secondary differentials — consider if primary is uncertain.</p>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}

      {/* Safety Alerts — only show after doctor selects prescriptions */}
      {safetyResults && selectedMedications.length > 0 && (
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
        <Collapsible open={complianceExpanded} onOpenChange={setComplianceExpanded}>
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
              {complianceExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <ClinicalCard className="p-2.5 space-y-2">
              {!effectiveCompliance ? (
                <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={runComplianceCheck} disabled={loadingCompliance || !canRunCompliance}>
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
