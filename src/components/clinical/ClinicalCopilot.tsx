import { useState } from "react";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Chip } from "@/components/ui/chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Brain, FlaskConical, Pill, Shield, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, FileText, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SafetyResults } from "@/layers/safety/api";
import type { EvidenceData } from "@/layers/evidence/api";

interface ClinicalCopilotProps {
  // Diagnosis
  diagnoses: string[];
  selectedDiagnoses: string[];
  onToggleDiagnosis: (diagnosis: string) => void;
  
  // Tests
  tests: string[];
  selectedTests: string[];
  onToggleTest: (test: string) => void;
  
  // Medications
  medications: Array<{ drug: string; dose: string; freq: string; dur: string }>;
  selectedMedications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  onToggleMedication: (med: { drug: string; dose: string; freq: string; dur: string }) => void;
  
  // Safety
  safetyResults: SafetyResults | null;
  
  // Evidence retrieval inputs
  patientAge?: number;
  allergies?: string[];
  diagnosis?: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
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
}: ClinicalCopilotProps) {
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  const safetyAlertCount = safetyResults
    ? (safetyResults.allergy_flags?.length || 0) +
      (safetyResults.interaction_flags?.length || 0) +
      (safetyResults.dose_warnings?.length || 0) +
      (safetyResults.vitals_dangers?.length || 0) +
      (safetyResults.emergency_patterns?.length || 0)
    : 0;

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
              {/* Allergy check */}
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

              {/* Dose check */}
              <div className="flex items-center gap-1.5 text-xs">
                {safetyResults.dose_warnings && safetyResults.dose_warnings.length > 0 ? (
                  <>
                    <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-amber-700 dark:text-amber-400">Dose within limits</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-emerald-700 dark:text-emerald-400">Dose within limits</span>
                  </>
                )}
              </div>

              {/* Vitals check */}
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

              {/* Drug interaction check */}
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
                  {/* Summary bar */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">
                      {evidence.total_citations} citations
                    </Badge>
                    <span>•</span>
                    <span>{evidence.sources_queried.join(", ")}</span>
                  </div>

                  {/* Medication evidence */}
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
                                    <a
                                      href={cit.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline ml-1"
                                    >
                                      →
                                    </a>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Guidelines */}
                  {evidence.guidelines.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        Guidelines
                      </p>
                      {evidence.guidelines.map((guide, i) => (
                        <div key={i} className="text-xs">
                          <p className="font-semibold text-foreground">{guide.source}</p>
                          <p className="text-muted-foreground text-[11px]">{guide.guidance}</p>
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
