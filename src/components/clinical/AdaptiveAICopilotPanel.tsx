import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ClinicalCard } from "@/components/ui/clinical-card";
import { Chip } from "@/components/ui/chip";
import { supabase } from "@/integrations/supabase/client";
import { emitMonitoringEvent } from "@/layers/monitoring/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, FlaskConical, Pill, Shield, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, Plus, Info, BookOpen,
  Scale, Sparkles, Activity, Stethoscope, ClipboardCheck,
  FileText, Heart, Zap, Eye,
} from "lucide-react";
import type { SafetyResults } from "@/layers/safety/api";

/* ── Stage Types ── */
export type ConsultationStage =
  | "intake"
  | "symptoms_selected"
  | "vitals_recorded"
  | "assessment_written"
  | "treatment_planning"
  | "final_review";

/* ── Graph Types ── */
interface GraphDiagnosis {
  diagnosis_name: string;
  category: string;
  icd10_code: string;
  confidence: number;
  matching_symptoms: number;
}

interface GraphDrug {
  generic_name: string;
  line_of_treatment: string;
  for_diagnosis: string;
  drug_class?: string;
  max_daily_dose_mg?: number;
}

interface GraphLab {
  test_name: string;
  category: string;
  priority: string;
  for_diagnosis: string;
}

interface GuidelineRecommendation {
  treatment_generic_name: string;
  recommendation: string;
  evidence_level: string;
  authority: string;
  authority_country: string;
  authority_priority: number;
}

/* ── Props ── */
interface AdaptiveAICopilotPanelProps {
  // Patient context
  selectedSymptoms: string[];
  selectedDuration: string;
  patientAge?: number | null;
  patientGender?: string | null;
  allergies?: string[];
  currentMedications?: string[];

  // Vitals
  vitalsRecorded: boolean;
  vitalsData?: {
    bp_systolic?: number;
    bp_diastolic?: number;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    respiratory_rate?: number;
  } | null;

  // SOAP / Assessment
  soapAssessment?: string;
  soapPlan?: string;

  // Copilot selections (existing)
  diagnoses: string[];
  selectedDiagnoses: string[];
  onToggleDiagnosis: (d: string) => void;
  tests: string[];
  selectedTests: string[];
  onToggleTest: (t: string) => void;
  medications: Array<{ drug: string; dose: string; freq: string; dur: string }>;
  selectedMedications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  onToggleMedication: (rx: { drug: string; dose: string; freq: string; dur: string }) => void;

  // Prescription actions
  onAddPrescription?: (rx: { drug_name: string; dose: string; frequency: string; duration: string }) => void;
  onAddLabTest?: (test: string) => void;
  onInsertIntoSoap?: (text: string) => void;

  // Safety
  safetyResults: SafetyResults | null;

  // Pipeline state
  pipelineComplete?: boolean;
  pendingRxCount?: number;
}

const fadeIn = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.15, ease: "easeOut" as const },
};

const STAGE_CONFIG: Record<ConsultationStage, { label: string; icon: typeof Brain; color: string }> = {
  intake: { label: "Intake", icon: ClipboardCheck, color: "text-muted-foreground" },
  symptoms_selected: { label: "Symptoms", icon: Stethoscope, color: "text-blue-600 dark:text-blue-400" },
  vitals_recorded: { label: "Vitals", icon: Activity, color: "text-emerald-600 dark:text-emerald-400" },
  assessment_written: { label: "Assessment", icon: Brain, color: "text-violet-600 dark:text-violet-400" },
  treatment_planning: { label: "Treatment", icon: Pill, color: "text-amber-600 dark:text-amber-400" },
  final_review: { label: "Review", icon: Eye, color: "text-primary" },
};

export default function AdaptiveAICopilotPanel(props: AdaptiveAICopilotPanelProps) {
  const {
    selectedSymptoms, selectedDuration, patientAge, patientGender, allergies, currentMedications,
    vitalsRecorded, vitalsData, soapAssessment, soapPlan,
    diagnoses, selectedDiagnoses, onToggleDiagnosis,
    tests, selectedTests, onToggleTest,
    medications, selectedMedications, onToggleMedication,
    onAddPrescription, onAddLabTest, onInsertIntoSoap,
    safetyResults, pipelineComplete, pendingRxCount,
  } = props;

  // Graph state
  const [graphDiagnoses, setGraphDiagnoses] = useState<GraphDiagnosis[]>([]);
  const [graphDrugs, setGraphDrugs] = useState<GraphDrug[]>([]);
  const [graphLabs, setGraphLabs] = useState<GraphLab[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphQueried, setGraphQueried] = useState(false);

  // Guideline state
  const [guidelineRecs, setGuidelineRecs] = useState<GuidelineRecommendation[]>([]);
  const [guidelineAuthority, setGuidelineAuthority] = useState<string | null>(null);
  const [guidelineLoading, setGuidelineLoading] = useState(false);
  const [guidelineQueried, setGuidelineQueried] = useState(false);

  // Section collapse state
  const [sections, setSections] = useState<Record<string, boolean>>({
    patient_snapshot: true,
    graph_diagnoses: true,
    vital_interpretation: true,
    guidelines: true,
    medications: true,
    safety: true,
    final_summary: true,
  });

  const toggleSection = (key: string) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Stage Detection ──
  const stage: ConsultationStage = useMemo(() => {
    const hasSelectedRx = (selectedMedications?.length || 0) > 0 || (pendingRxCount || 0) > 0;
    const hasAssessment = (soapAssessment?.trim().length || 0) > 10;
    const hasPlan = (soapPlan?.trim().length || 0) > 5;

    if (pipelineComplete && hasSelectedRx && hasAssessment) return "final_review";
    if (hasSelectedRx || hasPlan) return "treatment_planning";
    if (hasAssessment) return "assessment_written";
    if (vitalsRecorded) return "vitals_recorded";
    if (selectedSymptoms.length > 0) return "symptoms_selected";
    return "intake";
  }, [selectedSymptoms, vitalsRecorded, soapAssessment, soapPlan, selectedMedications, pipelineComplete, pendingRxCount]);

  const stageConfig = STAGE_CONFIG[stage];
  const StageIcon = stageConfig.icon;

  // ── Graph Query (symptoms_selected stage) ──
  useEffect(() => {
    if (stage !== "symptoms_selected" || graphQueried || selectedSymptoms.length === 0) return;
    const queryGraph = async () => {
      setGraphLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("query-clinical-graph", {
          body: { symptoms: selectedSymptoms.map(s => s.toLowerCase()) },
        });
        if (error) throw error;
        setGraphDiagnoses(data?.diagnoses || []);
        setGraphDrugs(data?.suggested_drugs || []);
        setGraphLabs(data?.suggested_labs || []);
        setGraphQueried(true);
        emitMonitoringEvent({
          event_type: "copilot_graph_query",
          agent_name: "adaptive_copilot",
          success: true,
          metadata: { symptoms: selectedSymptoms, diagnoses_found: data?.diagnoses?.length || 0, stage },
        });
      } catch (e) {
        console.error("Graph query failed:", e);
      } finally {
        setGraphLoading(false);
      }
    };
    const timer = setTimeout(queryGraph, 600);
    return () => clearTimeout(timer);
  }, [stage, selectedSymptoms, graphQueried]);

  // Reset graph when symptoms change
  useEffect(() => {
    setGraphQueried(false);
  }, [selectedSymptoms.join(",")]);

  // ── Guideline Query (assessment_written stage) ──
  useEffect(() => {
    if (stage !== "assessment_written" || guidelineQueried || selectedDiagnoses.length === 0) return;
    const queryGuidelines = async () => {
      setGuidelineLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("retrieve-guideline-recommendation", {
          body: { diagnosis: selectedDiagnoses[0] },
        });
        if (error) throw error;
        setGuidelineRecs(data?.all_recommendations || []);
        setGuidelineAuthority(data?.authority || null);
        setGuidelineQueried(true);
        emitMonitoringEvent({
          event_type: "copilot_guideline_query",
          agent_name: "adaptive_copilot",
          success: true,
          metadata: { diagnosis: selectedDiagnoses[0], recs_found: data?.all_recommendations?.length || 0, stage },
        });
      } catch (e) {
        console.error("Guideline query failed:", e);
      } finally {
        setGuidelineLoading(false);
      }
    };
    const timer = setTimeout(queryGuidelines, 600);
    return () => clearTimeout(timer);
  }, [stage, selectedDiagnoses, guidelineQueried]);

  useEffect(() => {
    setGuidelineQueried(false);
  }, [selectedDiagnoses.join(",")]);

  // ── Safety summary ──
  const safetyAlertCount = safetyResults
    ? (safetyResults.allergy_flags?.length || 0) +
      (safetyResults.interaction_flags?.length || 0) +
      (safetyResults.dose_warnings?.length || 0) +
      (safetyResults.vitals_dangers?.length || 0) +
      (safetyResults.emergency_patterns?.length || 0)
    : 0;

  // ── Vital Interpretation ──
  const vitalAlerts = useMemo(() => {
    if (!vitalsData) return [];
    const alerts: { param: string; value: string; severity: "warning" | "danger" | "normal"; message: string }[] = [];
    if (vitalsData.temperature && vitalsData.temperature > 100.4) {
      alerts.push({ param: "Temperature", value: `${vitalsData.temperature}°F`, severity: vitalsData.temperature > 103 ? "danger" : "warning", message: vitalsData.temperature > 103 ? "High fever — consider urgent evaluation" : "Fever present" });
    }
    if (vitalsData.bp_systolic && vitalsData.bp_systolic > 140) {
      alerts.push({ param: "BP", value: `${vitalsData.bp_systolic}/${vitalsData.bp_diastolic}`, severity: vitalsData.bp_systolic > 180 ? "danger" : "warning", message: vitalsData.bp_systolic > 180 ? "Hypertensive urgency" : "Elevated blood pressure" });
    }
    if (vitalsData.spo2 && vitalsData.spo2 < 94) {
      alerts.push({ param: "SpO₂", value: `${vitalsData.spo2}%`, severity: vitalsData.spo2 < 90 ? "danger" : "warning", message: vitalsData.spo2 < 90 ? "Severe hypoxia — immediate attention" : "Low oxygen saturation" });
    }
    if (vitalsData.pulse && (vitalsData.pulse > 100 || vitalsData.pulse < 50)) {
      const msg = vitalsData.pulse > 100 ? "Tachycardia" : "Bradycardia";
      alerts.push({ param: "Pulse", value: `${vitalsData.pulse} bpm`, severity: "warning", message: msg });
    }
    return alerts;
  }, [vitalsData]);

  const logCopilotAction = (action: string, item: string) => {
    emitMonitoringEvent({
      event_type: "copilot_action",
      agent_name: "adaptive_copilot",
      success: true,
      metadata: { action, item, stage },
    });
  };

  return (
    <div className="space-y-2">
      {/* Stage Indicator */}
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50 border border-border">
        <StageIcon className={`h-3.5 w-3.5 ${stageConfig.color}`} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">
          {stageConfig.label} Stage
        </span>
        <Badge variant="outline" className="text-[8px]">{stage.replace(/_/g, " ")}</Badge>
      </div>

      {/* AI Disclaimer */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 text-[9px] text-muted-foreground">
        <Info className="h-2.5 w-2.5 shrink-0" />
        AI-assisted suggestions for clinician review
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ INTAKE STAGE ═══ */}
        {stage === "intake" && (
          <motion.div key="intake" {...fadeIn} className="space-y-2">
            <CollapsibleSection
              title="Patient Snapshot"
              icon={<ClipboardCheck className="h-3 w-3 text-muted-foreground" />}
              open={sections.patient_snapshot}
              onToggle={() => toggleSection("patient_snapshot")}
            >
              <div className="space-y-1 text-xs text-muted-foreground">
                {patientAge && <p>Age: {patientAge}y {patientGender || ""}</p>}
                {allergies && allergies.length > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-2.5 w-2.5 inline mr-1" />
                    Allergies: {allergies.join(", ")}
                  </p>
                )}
                {currentMedications && currentMedications.length > 0 && (
                  <p>Current meds: {currentMedications.join(", ")}</p>
                )}
                {!patientAge && !allergies?.length && (
                  <p className="italic">Select a patient to see snapshot</p>
                )}
              </div>
            </CollapsibleSection>

            <div className="text-center py-2 text-[10px] text-muted-foreground italic">
              Select symptoms to activate AI graph lookup
            </div>
          </motion.div>
        )}

        {/* ═══ SYMPTOMS SELECTED STAGE ═══ */}
        {stage === "symptoms_selected" && (
          <motion.div key="symptoms" {...fadeIn} className="space-y-2">
            {/* Graph Diagnoses */}
            <CollapsibleSection
              title="Possible Diagnoses"
              icon={<Brain className="h-3 w-3 text-blue-500" />}
              open={sections.graph_diagnoses}
              onToggle={() => toggleSection("graph_diagnoses")}
              badge={graphDiagnoses.length > 0 ? `${graphDiagnoses.length}` : undefined}
              loading={graphLoading}
            >
              {graphDiagnoses.length > 0 ? (
                <div className="space-y-1">
                  {graphDiagnoses.slice(0, 3).map((d, i) => (
                    <button
                      key={i}
                      onClick={() => { onToggleDiagnosis(d.diagnosis_name); logCopilotAction("add_diagnosis_graph", d.diagnosis_name); }}
                      className={`w-full text-left p-2 rounded-md border text-xs transition-all ${
                        selectedDiagnoses.includes(d.diagnosis_name)
                          ? "border-primary/30 bg-primary/5 opacity-60"
                          : "border-border hover:border-primary/30 hover:bg-primary/[0.03]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{d.diagnosis_name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[7px]">{d.icd10_code || d.category}</Badge>
                          <Badge variant="outline" className="text-[7px] text-emerald-600 border-emerald-200 dark:border-emerald-800">
                            {Math.round(d.confidence * 100)}%
                          </Badge>
                          {!selectedDiagnoses.includes(d.diagnosis_name) && <Plus className="h-3 w-3 text-primary" />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : !graphLoading ? (
                <p className="text-[10px] text-muted-foreground italic px-1">No graph matches found</p>
              ) : null}
            </CollapsibleSection>

            {/* Static diagnoses from symptom maps */}
            {diagnoses.length > 0 && (
              <ClinicalCard className="p-2.5 border-primary/10">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Brain className="h-3 w-3 text-primary" /> Suggested Diagnoses
                </p>
                <div className="flex flex-wrap gap-1">
                  {diagnoses.slice(0, 3).map(d => (
                    <Chip key={d} variant="diagnosis" size="sm" selected={selectedDiagnoses.includes(d)} onClick={() => onToggleDiagnosis(d)}>
                      {d}
                    </Chip>
                  ))}
                </div>
              </ClinicalCard>
            )}

            {/* Tests from symptom maps */}
            {tests.length > 0 && (
              <ClinicalCard className="p-2.5 border-primary/10">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <FlaskConical className="h-3 w-3 text-chip-lab-text" /> Suggested Tests
                </p>
                <div className="flex flex-wrap gap-1">
                  {tests.slice(0, 3).map(t => (
                    <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)} onClick={() => onToggleTest(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </ClinicalCard>
            )}
          </motion.div>
        )}

        {/* ═══ VITALS RECORDED STAGE ═══ */}
        {stage === "vitals_recorded" && (
          <motion.div key="vitals" {...fadeIn} className="space-y-2">
            <CollapsibleSection
              title="Vital Interpretation"
              icon={<Activity className="h-3 w-3 text-emerald-500" />}
              open={sections.vital_interpretation}
              onToggle={() => toggleSection("vital_interpretation")}
              badge={vitalAlerts.length > 0 ? `${vitalAlerts.length} alerts` : undefined}
            >
              {vitalAlerts.length > 0 ? (
                <div className="space-y-1">
                  {vitalAlerts.slice(0, 3).map((a, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-2 rounded-md border text-xs ${
                        a.severity === "danger"
                          ? "border-destructive/30 bg-destructive/5"
                          : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                      }`}
                    >
                      <AlertTriangle className={`h-3 w-3 shrink-0 mt-0.5 ${a.severity === "danger" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{a.param}: {a.value}</span>
                          <Badge variant="outline" className={`text-[7px] ${a.severity === "danger" ? "text-destructive border-destructive/30" : "text-amber-600 border-amber-200 dark:border-amber-800"}`}>{a.severity}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{a.message}</p>
                      </div>
                      {onInsertIntoSoap && (
                        <Button variant="ghost" size="sm" className="h-6 text-[9px] shrink-0" onClick={() => { onInsertIntoSoap(`${a.param} ${a.value} — ${a.message}`); logCopilotAction("insert_vital_alert", a.param); }}>
                          <FileText className="h-2.5 w-2.5 mr-0.5" /> SOAP
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 px-1">
                  <CheckCircle className="h-3 w-3" /> All vitals within normal range
                </div>
              )}
            </CollapsibleSection>

            {/* Still show diagnoses and tests */}
            {diagnoses.length > 0 && (
              <ClinicalCard className="p-2.5 border-primary/10">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Brain className="h-3 w-3 text-primary" /> Diagnosis
                </p>
                <div className="flex flex-wrap gap-1">
                  {diagnoses.slice(0, 3).map(d => (
                    <Chip key={d} variant="diagnosis" size="sm" selected={selectedDiagnoses.includes(d)} onClick={() => onToggleDiagnosis(d)}>{d}</Chip>
                  ))}
                </div>
              </ClinicalCard>
            )}
          </motion.div>
        )}

        {/* ═══ ASSESSMENT WRITTEN STAGE ═══ */}
        {stage === "assessment_written" && (
          <motion.div key="assessment" {...fadeIn} className="space-y-2">
            {/* Guideline Recommendations */}
            <CollapsibleSection
              title="Guideline Recommendations"
              icon={<Scale className="h-3 w-3 text-violet-500" />}
              open={sections.guidelines}
              onToggle={() => toggleSection("guidelines")}
              badge={guidelineAuthority || undefined}
              loading={guidelineLoading}
            >
              {guidelineRecs.length > 0 ? (
                <div className="space-y-1">
                  {guidelineRecs.slice(0, 3).map((r, i) => (
                    <div key={i} className="p-2 rounded-md border border-border text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-foreground">{r.treatment_generic_name}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-[7px]">{r.authority}</Badge>
                          <Badge variant="outline" className="text-[7px] text-emerald-600 border-emerald-200 dark:border-emerald-800">{r.evidence_level}</Badge>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{r.recommendation}</p>
                      <div className="flex gap-1 mt-1.5">
                        {onAddPrescription && (
                          <Button variant="ghost" size="sm" className="h-5 text-[8px] gap-0.5" onClick={() => { onAddPrescription({ drug_name: r.treatment_generic_name, dose: "", frequency: "", duration: "" }); logCopilotAction("add_rx_guideline", r.treatment_generic_name); }}>
                            <Pill className="h-2 w-2" /> Add Rx
                          </Button>
                        )}
                        {onInsertIntoSoap && (
                          <Button variant="ghost" size="sm" className="h-5 text-[8px] gap-0.5" onClick={() => { onInsertIntoSoap(`Per ${r.authority}: ${r.treatment_generic_name} — ${r.recommendation}`); logCopilotAction("insert_guideline", r.treatment_generic_name); }}>
                            <FileText className="h-2 w-2" /> SOAP
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : !guidelineLoading ? (
                <p className="text-[10px] text-muted-foreground italic px-1">No guideline matches for current diagnosis</p>
              ) : null}
            </CollapsibleSection>

            {/* Suggested Labs from graph */}
            {(graphLabs.length > 0 || tests.length > 0) && (
              <CollapsibleSection
                title="Suggested Labs"
                icon={<FlaskConical className="h-3 w-3 text-chip-lab-text" />}
                open={true}
                onToggle={() => {}}
              >
                <div className="flex flex-wrap gap-1">
                  {graphLabs.slice(0, 3).map((l, i) => (
                    <button
                      key={`g-${i}`}
                      onClick={() => { onToggleTest(l.test_name); logCopilotAction("add_lab_graph", l.test_name); }}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] transition-all ${
                        selectedTests.includes(l.test_name)
                          ? "border-primary/30 bg-primary/10 opacity-60"
                          : "border-border hover:border-primary/30 hover:bg-primary/[0.03]"
                      }`}
                    >
                      {l.test_name}
                      {l.priority === "urgent" && <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[7px] px-1">Urgent</Badge>}
                      {!selectedTests.includes(l.test_name) && <Plus className="h-2.5 w-2.5" />}
                    </button>
                  ))}
                  {tests.filter(t => !graphLabs.some(l => l.test_name === t)).slice(0, 3).map(t => (
                    <Chip key={t} variant="lab" size="sm" selected={selectedTests.includes(t)} onClick={() => onToggleTest(t)}>{t}</Chip>
                  ))}
                </div>
              </CollapsibleSection>
            )}
          </motion.div>
        )}

        {/* ═══ TREATMENT PLANNING STAGE ═══ */}
        {stage === "treatment_planning" && (
          <motion.div key="treatment" {...fadeIn} className="space-y-2">
            {/* Medication Suggestions */}
            <CollapsibleSection
              title="Medication Suggestions"
              icon={<Pill className="h-3 w-3 text-chip-medication-text" />}
              open={sections.medications}
              onToggle={() => toggleSection("medications")}
            >
              <div className="flex flex-wrap gap-1">
                {medications.slice(0, 3).map((rx, i) => (
                  <Chip
                    key={i}
                    variant="medication"
                    size="sm"
                    addable
                    selected={selectedMedications.some(p => p.drug_name === rx.drug)}
                    onClick={() => { onToggleMedication(rx); logCopilotAction("toggle_medication", rx.drug); }}
                  >
                    {rx.drug} {rx.dose}
                  </Chip>
                ))}
              </div>
              {graphDrugs.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">From Knowledge Graph</p>
                  {graphDrugs.slice(0, 3).map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded border border-border text-[10px]">
                      <div>
                        <span className="font-semibold text-foreground">{d.generic_name}</span>
                        <span className="text-muted-foreground ml-1">({d.line_of_treatment})</span>
                      </div>
                      <div className="flex gap-1">
                        {onAddPrescription && (
                          <Button variant="ghost" size="sm" className="h-5 text-[8px]" onClick={() => { onAddPrescription({ drug_name: d.generic_name, dose: "", frequency: "", duration: "" }); logCopilotAction("add_rx_graph", d.generic_name); }}>
                            <Plus className="h-2 w-2" /> Add
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            {/* Drug Safety */}
            <SafetySection safetyResults={safetyResults} safetyAlertCount={safetyAlertCount} />
          </motion.div>
        )}

        {/* ═══ FINAL REVIEW STAGE ═══ */}
        {stage === "final_review" && (
          <motion.div key="final" {...fadeIn} className="space-y-2">
            {/* Diagnosis Summary */}
            <CollapsibleSection
              title="Diagnosis Summary"
              icon={<Brain className="h-3 w-3 text-primary" />}
              open={sections.final_summary}
              onToggle={() => toggleSection("final_summary")}
            >
              {selectedDiagnoses.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedDiagnoses.map(d => (
                    <Badge key={d} className="bg-primary/10 text-primary border-primary/20 text-[10px]">{d}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground italic">No diagnoses selected</p>
              )}
            </CollapsibleSection>

            {/* Prescription Summary */}
            {selectedMedications.length > 0 && (
              <ClinicalCard className="p-2.5 border-primary/10">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  <Pill className="h-3 w-3 text-chip-medication-text" /> Prescription ({selectedMedications.length})
                </p>
                <div className="space-y-1">
                  {selectedMedications.map((rx, i) => (
                    <div key={i} className="text-[10px] text-foreground">
                      {rx.drug_name} {rx.dose} · {rx.frequency} · {rx.duration}
                    </div>
                  ))}
                </div>
              </ClinicalCard>
            )}

            {/* Safety Check */}
            <SafetySection safetyResults={safetyResults} safetyAlertCount={safetyAlertCount} />

            {/* Guideline Compliance indicator */}
            {guidelineRecs.length > 0 && (
              <ClinicalCard className="p-2.5 border-emerald-500/20">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Scale className="h-3 w-3 text-emerald-500" /> Guideline Compliance
                </p>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  {guidelineRecs.length} guideline-based recommendations applied
                </div>
              </ClinicalCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Collapsible Section Helper ── */
function CollapsibleSection({ title, icon, open, onToggle, children, badge, loading }: {
  title: string; icon: React.ReactNode; open: boolean; onToggle: () => void;
  children: React.ReactNode; badge?: string; loading?: boolean;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-left">
          {icon}
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex-1">{title}</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          {badge && <Badge variant="outline" className="text-[8px]">{badge}</Badge>}
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 px-1">
        <ClinicalCard className="p-2.5">
          {children}
        </ClinicalCard>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Safety Section ── */
function SafetySection({ safetyResults, safetyAlertCount }: { safetyResults: SafetyResults | null; safetyAlertCount: number }) {
  if (!safetyResults) return null;
  return (
    <ClinicalCard className={`p-2.5 ${safetyAlertCount === 0 ? "border-emerald-500/20" : "border-amber-500/20"}`}>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
        <Shield className="h-3 w-3 text-primary" /> Safety Check
        {safetyAlertCount > 0 && <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 text-[8px]">{safetyAlertCount}</Badge>}
      </p>
      <div className="space-y-1">
        <SafetyRow ok={!safetyResults.allergy_flags?.length} label="Allergy conflicts" />
        <SafetyRow ok={!safetyResults.dose_warnings?.length} label="Dose limits" />
        <SafetyRow ok={!safetyResults.interaction_flags?.length} label="Drug interactions" />
        <SafetyRow ok={!safetyResults.vitals_dangers?.length} label="Dangerous vitals" />
      </div>
    </ClinicalCard>
  );
}

function SafetyRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <>
          <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-emerald-700 dark:text-emerald-400">No {label.toLowerCase()}</span>
        </>
      ) : (
        <>
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-amber-700 dark:text-amber-400">{label} detected</span>
        </>
      )}
    </div>
  );
}
