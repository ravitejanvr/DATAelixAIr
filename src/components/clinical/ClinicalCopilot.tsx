import { useState } from "react";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Brain, FlaskConical, Pill, Shield, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, FileText, Loader2, Scale, BookOpen, ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SafetyResults } from "@/layers/safety/api";
import type { EvidenceData } from "@/layers/evidence/api";

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

interface ClinicalCopilotProps {
  diagnoses: string[];
  selectedDiagnoses: string[];
  onToggleDiagnosis: (diagnosis: string) => void;
  tests: string[];
  selectedTests: string[];
  onToggleTest: (test: string) => void;
  medications: Array<{ drug: string; dose: string; freq: string; dur: string }>;
  selectedMedications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  onToggleMedication: (med: { drug: string; dose: string; freq: string; dur: string }) => void;
  safetyResults: SafetyResults | null;
  patientAge?: number;
  allergies?: string[];
  diagnosis?: string;
  chiefComplaint?: string;
  patientSex?: string;
  carePlan?: string;
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
}: ClinicalCopilotProps) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [complianceExpanded, setComplianceExpanded] = useState(false);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[] | null>(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);
  const [complianceSources, setComplianceSources] = useState<string[]>([]);

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

  const logComplianceOverride = async (result: ComplianceResult) => {
    try {
      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id || "",
        event_type: "guideline_compliance_override",
        target_type: "compliance_check",
        metadata: {
          item: result.item,
          item_type: result.item_type,
          compliance_status: result.compliance_status,
          explanation: result.explanation,
          guidelines: result.matching_guidelines.map(g => g.title),
          override_timestamp: new Date().toISOString(),
        },
      });
      toast.success("Override logged to audit trail");
    } catch {
      toast.error("Failed to log override");
    }
  };

  const alignedCount = complianceResults?.filter(r => r.compliance_status === "guideline_aligned").length || 0;
  const reviewCount = complianceResults?.filter(r => r.compliance_status === "review_suggested").length || 0;

  return (
    <div className="space-y-2.5">
      {/* Diagnosis */}
      {diagnoses.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Brain className="h-3 w-3 text-primary" /> Diagnosis
            </p>
            <div className="flex flex-wrap gap-1">
              {diagnoses.slice(0, 3).map(d => (
                <Chip
                  key={d}
                  variant="diagnosis"
                  size="sm"
                  selected={selectedDiagnoses.includes(d)}
                  onClick={() => onToggleDiagnosis(d)}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Tests */}
      {tests.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <FlaskConical className="h-3 w-3 text-chip-lab-text" /> Tests
            </p>
            <div className="flex flex-wrap gap-1">
              {tests.map(t => (
                <Chip
                  key={t}
                  variant="lab"
                  size="sm"
                  selected={selectedTests.includes(t)}
                  onClick={() => onToggleTest(t)}
                >
                  {t}
                </Chip>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Medications */}
      {medications.length > 0 && (
        <motion.div {...fadeIn}>
          <ClinicalCard className="p-2.5 border-primary/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Pill className="h-3 w-3 text-chip-medication-text" /> Medications
            </p>
            <div className="flex flex-wrap gap-1">
              {medications.map((rx, i) => (
                <Chip
                  key={i}
                  variant="medication"
                  size="sm"
                  addable
                  selected={selectedMedications.some(p => p.drug_name === rx.drug)}
                  onClick={() => onToggleMedication(rx)}
                >
                  {rx.drug} {rx.dose}
                </Chip>
              ))}
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Safety */}
      {safetyResults && (
        <motion.div {...fadeIn}>
          <ClinicalCard className={`p-2.5 ${safetyAlertCount === 0 ? "border-emerald-500/20" : "border-amber-500/20"}`}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary" /> Safety
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs">
                {safetyResults.allergy_flags && safetyResults.allergy_flags.length > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-400">Allergy conflict detected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-400">No allergy conflicts</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {safetyResults.dose_warnings && safetyResults.dose_warnings.length > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-400">Dose concern flagged</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-400">Dose within limits</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {safetyResults.vitals_dangers && safetyResults.vitals_dangers.length > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                    <span className="text-destructive font-semibold">Dangerous vitals</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-400">No dangerous vitals</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {safetyResults.interaction_flags && safetyResults.interaction_flags.length > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-400">Drug interaction detected</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-400">No drug interactions</span>
                  </>
                )}
              </div>
            </div>
          </ClinicalCard>
        </motion.div>
      )}

      {/* Guideline Compliance */}
      <motion.div {...fadeIn}>
        <Collapsible open={complianceExpanded} onOpenChange={setComplianceExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
              <Scale className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">
                Guideline Compliance
              </span>
              {complianceResults && (
                <div className="flex gap-1">
                  {alignedCount > 0 && (
                    <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-200 dark:border-emerald-800">{alignedCount} aligned</Badge>
                  )}
                  {reviewCount > 0 && (
                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200 dark:border-amber-800">{reviewCount} review</Badge>
                  )}
                </div>
              )}
              {complianceExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <ClinicalCard className="p-2.5 space-y-2">
              {!complianceResults ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={runComplianceCheck}
                  disabled={loadingCompliance || (selectedDiagnoses.length === 0 && selectedMedications.length === 0 && selectedTests.length === 0)}
                >
                  {loadingCompliance && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <Scale className="h-3 w-3 mr-1" />
                  Check Guideline Compliance
                </Button>
              ) : (
                <div className="space-y-2">
                  {/* Sources summary */}
                  {complianceSources.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                      <span className="font-semibold">Sources:</span>
                      {complianceSources.map((src, i) => (
                        <Badge key={i} variant="outline" className="text-[8px]">{src}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Results */}
                  {complianceResults.map((result, i) => {
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

                            {/* Matching guidelines */}
                            {result.matching_guidelines.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {result.matching_guidelines.map((g, j) => (
                                  <div key={j} className="text-[9px] flex items-start gap-1">
                                    <BookOpen className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                                    <div>
                                      <span className="font-semibold">{g.source_organization}</span>
                                      <span className="mx-1">·</span>
                                      <span>{g.title}</span>
                                      <span className="mx-1">·</span>
                                      <span>{g.year}</span>
                                      <span className="mx-1">·</span>
                                      <span>Grade: {g.evidence_grade}</span>
                                      {g.guideline_url && (
                                        <a href={g.guideline_url} target="_blank" rel="noopener noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-primary hover:underline">
                                          <ExternalLink className="h-2 w-2" /> View
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Override button for review_suggested items */}
                          {result.compliance_status === "review_suggested" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-[9px] px-2 shrink-0"
                              onClick={() => logComplianceOverride(result)}
                            >
                              Override
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Re-check button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs h-6"
                    onClick={() => { setComplianceResults(null); setComplianceSources([]); }}
                  >
                    Reset & Re-check
                  </Button>

                  <p className="text-[9px] text-muted-foreground italic pt-1 border-t border-border">
                    Guideline compliance is advisory. Clinical judgment required for all decisions.
                  </p>
                </div>
              )}
            </ClinicalCard>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>

      {/* Evidence (collapsed by default) */}
      <motion.div {...fadeIn}>
        <Collapsible open={evidenceExpanded} onOpenChange={setEvidenceExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">
                Evidence
              </span>
              {evidence && (
                <Badge variant="outline" className="text-[10px]">{evidence.total_citations}</Badge>
              )}
              {evidenceExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1">
            <ClinicalCard className="p-2.5 space-y-2">
              {!evidence ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7"
                  onClick={async () => {
                    if (selectedMedications.length === 0) {
                      toast.error("Add medications first");
                      return;
                    }
                    setLoadingEvidence(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("evidence-agents", {
                        body: {
                          medications: selectedMedications.map(m => m.drug_name),
                          diagnosis: diagnosis || selectedDiagnoses[0] || "",
                          patient_age: patientAge,
                          allergies: allergies,
                        },
                      });
                      if (error) throw error;
                      setEvidence(data);
                      toast.success("Evidence retrieved");
                    } catch (err) {
                      console.error(err);
                      toast.error("Failed to retrieve evidence");
                    } finally {
                      setLoadingEvidence(false);
                    }
                  }}
                  disabled={loadingEvidence || selectedMedications.length === 0}
                >
                  {loadingEvidence && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Retrieve Evidence
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">
                      {evidence.total_citations} citations
                    </Badge>
                    <span>•</span>
                    <span>{evidence.sources_queried.join(", ")}</span>
                  </div>

                  {evidence.medication_evidence.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        Medication Evidence
                      </p>
                      {evidence.medication_evidence.map((med, i) => (
                        <div key={i} className="text-xs space-y-0.5">
                          <p className="font-semibold text-foreground">{med.drug}</p>
                          <p className="text-muted-foreground text-[11px]">{med.summary}</p>
                          {med.citations.map((cit, j) => (
                            <div key={j} className="text-[10px] text-muted-foreground">
                              {cit.title && (
                                <>
                                  <span>{cit.title}</span>
                                  {cit.url && (
                                    <a href={cit.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">→</a>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {evidence.guidelines.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Guidelines</p>
                      {evidence.guidelines.map((guide, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold text-foreground">{guide.source}</p>
                          <p className="text-muted-foreground text-[11px]">{guide.guidance}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {(evidence as any).platform_evidence?.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Platform Research</p>
                      {(evidence as any).platform_evidence.map((pe: any, i: number) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold text-foreground">{pe.title}</p>
                          <p className="text-muted-foreground text-[11px]">{pe.journal} · {pe.year}</p>
                          <p className="text-muted-foreground text-[10px] mt-0.5">{pe.summary}</p>
                          {pe.source_link && (
                            <a href={pe.source_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-[10px]">View source →</a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[9px] text-muted-foreground italic pt-1 border-t border-border">
                    Evidence is advisory only. Clinical judgment required.
                  </p>
                </div>
              )}
            </ClinicalCard>
          </CollapsibleContent>
        </Collapsible>
      </motion.div>
    </div>
  );
}
