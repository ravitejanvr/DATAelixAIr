/**
 * Pipeline Execution Trace Runner
 *
 * Runs a single benchmark case through the O1 pipeline (v4 Wave Orchestrator)
 * and captures detailed per-wave input/output logs for debugging.
 */

import { setFeatureFlag } from "@/services/feature_flags";
import { BENCHMARK_CASES_V5, type BenchmarkCase } from "@/services/benchmark_v5";
import { runClinicalPipeline as runO1Pipeline, type PipelineResult, type PipelineInput } from "@/services/clinical_pipeline/orchestrator";
import { fromMergedContext, toClinicalContext, type UnifiedClinicalContext } from "@/types/clinical-context";

// ── Types ──

export interface WaveTrace {
  wave: string;
  label: string;
  started_at: number;
  completed_at: number;
  duration_ms: number;
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  engines_invoked: string[];
  gaps: string[]; // empty or missing outputs
}

export interface PipelineTrace {
  case_id: string;
  case_name: string;
  category: string;
  total_ms: number;
  unified_context_snapshot: UnifiedClinicalContext;
  clinical_context_snapshot: Record<string, unknown>;
  adapter_field_audit: {
    field: string;
    unified_value: unknown;
    clinical_value: unknown;
    status: "mapped" | "dropped" | "empty";
  }[];
  waves: WaveTrace[];
  final_result: PipelineResult;
  all_gaps: string[];
  diagnoses_generated: string[];
  labs_suggested: string[];
  medications_suggested: string[];
  graph_matches: number;
  danger_detected: boolean;
}

// ── Helpers ──

function identifyGaps(label: string, data: Record<string, unknown>): string[] {
  const gaps: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      gaps.push(`${label}.${key} = null`);
    } else if (Array.isArray(value) && value.length === 0) {
      gaps.push(`${label}.${key} = [] (empty)`);
    } else if (typeof value === "string" && value.trim() === "") {
      gaps.push(`${label}.${key} = "" (empty string)`);
    } else if (typeof value === "number" && value === 0) {
      gaps.push(`${label}.${key} = 0`);
    }
  }
  return gaps;
}

// ── Main Trace Runner ──

export async function runPipelineTrace(
  caseIndex: number = 3, // default to v5-04 Cardiac Emergency
  onWaveComplete?: (wave: WaveTrace) => void,
): Promise<PipelineTrace> {
  const bc = BENCHMARK_CASES_V5[caseIndex];
  if (!bc) throw new Error(`No benchmark case at index ${caseIndex}`);

  // Enable O1 pipeline
  setFeatureFlag("enable_new_clinical_pipeline", true);

  // Convert benchmark context to O1 input
  const unified = fromMergedContext(bc.context);
  const clinicalContext = toClinicalContext(unified);

  const pipelineInput: PipelineInput = {
    clinical_context: clinicalContext,
    visit_id: bc.context.visit_id,
    clinic_id: bc.context.clinic_id,
  };

  // Track wave data via onProgress
  const waves: WaveTrace[] = [];
  const waveTimers: Record<string, number> = {};
  const allGaps: string[] = [];
  let pipelineStart = performance.now();

  // Create wave entries as progress comes in
  const progressCallback = (stage: string, data: Partial<PipelineResult>) => {
    const now = performance.now();

    switch (stage) {
      case "context": {
        const w: WaveTrace = {
          wave: "Wave 0 + Wave 1",
          label: "PCIE Context Hydration + Context Preparation",
          started_at: pipelineStart,
          completed_at: now,
          duration_ms: Math.round(now - pipelineStart),
          input_summary: {
            chief_complaint: clinicalContext.chief_complaint,
            symptoms: (clinicalContext as any).symptoms || [clinicalContext.chief_complaint],
            patient_age: clinicalContext.patient_age,
            patient_sex: clinicalContext.patient_sex,
            medical_history: clinicalContext.medical_history,
            allergies: clinicalContext.allergies,
            current_medications: clinicalContext.current_medications,
            vitals: {
              temperature: clinicalContext.temperature,
              pulse: clinicalContext.pulse,
              bp: clinicalContext.blood_pressure,
              spo2: clinicalContext.oxygen_saturation,
            },
            visit_id: bc.context.visit_id,
          },
          output_summary: {
            enriched_context_built: !!data.enriched_context,
            context_has_visit_id: !!data.enriched_context?.visit_id,
            context_has_clinic_id: !!data.enriched_context?.clinic_id,
            missing_fields: data.enriched_context
              ? Object.entries(data.enriched_context.core || {})
                  .filter(([, v]) => v === null || v === undefined || v === "")
                  .map(([k]) => k)
              : ["entire context missing"],
          },
          engines_invoked: ["PCIE (Wave 0)", "buildEnrichedContext", "validateContextCompleteness"],
          gaps: [],
        };
        w.gaps = identifyGaps("context", w.output_summary);
        allGaps.push(...w.gaps);
        waves.push(w);
        waveTimers.wave2 = now;
        onWaveComplete?.(w);
        break;
      }

      case "ddx": {
        // Wave 2 partial — DDX engine result
        const ddx = data.ddx;
        const w: WaveTrace = {
          wave: "Wave 2",
          label: "Parallel Context Analysis (DDX + Physiology + Evidence + Knowledge)",
          started_at: waveTimers.wave2 || now - 2000,
          completed_at: now,
          duration_ms: Math.round(now - (waveTimers.wave2 || now - 2000)),
          input_summary: {
            symptoms_sent: (clinicalContext as any).symptoms || [clinicalContext.chief_complaint],
            vitals_sent: {
              temperature: clinicalContext.temperature,
              spo2: clinicalContext.oxygen_saturation,
              pulse: clinicalContext.pulse,
              bp: clinicalContext.blood_pressure,
            },
            age: clinicalContext.patient_age,
            sex: clinicalContext.patient_sex,
            medical_history: clinicalContext.medical_history,
            current_medications: clinicalContext.current_medications,
            allergies: clinicalContext.allergies,
          },
          output_summary: {
            ddx_diagnoses_count: ddx?.differential_diagnoses?.length ?? 0,
            ddx_diagnoses: ddx?.differential_diagnoses?.map(d => ({
              name: (d as any).diagnosis_name || (d as any).diagnosis,
              probability: d.probability,
              must_not_miss: (d as any).must_not_miss || false,
            })) ?? [],
            matched_symptoms: ddx?.matched_symptoms?.length ?? 0,
            unmatched_symptoms: ddx?.unmatched_symptoms ?? [],
            recommended_labs: ddx?.recommended_labs ?? [],
            dangerous_injected: ddx?.dangerous_diagnoses_injected ?? 0,
            reasoning_traces_count: ddx?.reasoning_traces?.length ?? 0,
            organ_systems: (ddx as any)?.organ_systems_active ?? [],
            guideline_recommendations: ddx?.guideline_recommendations?.length ?? 0,
            graph_miss: (ddx as any)?.graph_miss ?? true,
          },
          engines_invoked: ["DDX Engine (Bayesian+Graph)", "Physiological State Engine", "Evidence Retrieval", "Pre-indexed Knowledge"],
          gaps: [],
        };
        w.gaps = identifyGaps("wave2_ddx", w.output_summary);
        allGaps.push(...w.gaps);
        // Replace wave2 if it already exists, else push
        const existingW2 = waves.findIndex(x => x.wave === "Wave 2");
        if (existingW2 >= 0) waves[existingW2] = w;
        else waves.push(w);
        waveTimers.wave3 = now;
        onWaveComplete?.(w);
        break;
      }

      case "bayesian":
      case "hypotheses":
      case "guidelines": {
        if (stage === "hypotheses") {
          const bayesian = data.bayesian;
          const hypotheses = data.hypotheses;
          const guidelineAlignment = data.guideline_alignment;
          const guidelineCompliance = data.guideline_compliance;
          const w: WaveTrace = {
            wave: "Wave 3",
            label: "Parallel Clinical Reasoning (Bayesian + Guideline + Hypothesis)",
            started_at: waveTimers.wave3 || now - 3000,
            completed_at: now,
            duration_ms: Math.round(now - (waveTimers.wave3 || now - 3000)),
            input_summary: {
              ddx_candidates_received: "from Wave 2",
              physiological_states_received: "from Wave 2",
              enriched_context_received: "from Wave 1",
            },
            output_summary: {
              bayesian_total_candidates: bayesian?.total_candidates ?? 0,
              bayesian_top_diagnosis: bayesian?.diagnoses?.[0] ?? null,
              bayesian_source: bayesian?.source ?? "not invoked",
              bayesian_scoring_method: bayesian ? "Bayesian posterior" : "not invoked",
              hypothesis_count: hypotheses?.hypotheses?.length ?? 0,
              hypothesis_source: (hypotheses as any)?.source ?? "unknown",
              hypotheses_list: hypotheses?.hypotheses?.map(h => ({
                condition: h.condition,
                confidence: h.confidence,
                supporting_count: h.supporting_evidence?.length ?? 0,
                contradicting_count: h.contradicting_evidence?.length ?? 0,
              })) ?? [],
              guideline_alignment_score: guidelineAlignment?.guideline_compliance_score ?? null,
              guideline_compliance_score: guidelineCompliance?.compliance_score ?? null,
              guideline_sources: guidelineCompliance?.guidelines_sources ?? guidelineAlignment?.guideline_sources_used ?? [],
            },
            engines_invoked: ["Bayesian Probability Engine", "Guideline Compliance Engine", "Hypothesis Engine (Edge Function)"],
            gaps: [],
          };
          w.gaps = identifyGaps("wave3", w.output_summary);
          allGaps.push(...w.gaps);
          waves.push(w);
          waveTimers.wave4 = now;
          onWaveComplete?.(w);
        }
        break;
      }

      case "safety": {
        const oversight = data.oversight;
        const w: WaveTrace = {
          wave: "Wave 4",
          label: "Clinical Safety Evaluation",
          started_at: waveTimers.wave4 || now - 1000,
          completed_at: now,
          duration_ms: Math.round(now - (waveTimers.wave4 || now - 1000)),
          input_summary: {
            ddx_safety_flags: "from Wave 2 DDX",
            drug_interactions_checked: true,
            allergy_conflicts_checked: true,
          },
          output_summary: {
            safety_score: oversight?.safety_score ?? null,
            total_events: oversight?.events?.length ?? 0,
            critical_events: oversight?.events?.filter(e => e.severity === "critical")?.length ?? 0,
            warning_events: oversight?.events?.filter(e => e.severity === "warning")?.length ?? 0,
            events: oversight?.events?.map(e => ({
              type: e.event_type,
              severity: e.severity,
              message: e.message,
            })) ?? [],
          },
          engines_invoked: ["Oversight Engine", "Drug Interaction Checker", "Allergy Conflict Scanner"],
          gaps: [],
        };
        w.gaps = identifyGaps("wave4_safety", w.output_summary);
        allGaps.push(...w.gaps);
        waves.push(w);
        waveTimers.wave5 = now;
        onWaveComplete?.(w);
        break;
      }

      case "uncertainty":
      case "reasoning": {
        if (stage === "reasoning") {
          const w: WaveTrace = {
            wave: "Wave 5",
            label: "Output Generation (Uncertainty + Hybrid Reasoning + SOAP)",
            started_at: waveTimers.wave5 || now - 2000,
            completed_at: now,
            duration_ms: Math.round(now - (waveTimers.wave5 || now - 2000)),
            input_summary: {
              ddx_diagnoses: "from Wave 2",
              bayesian_rankings: "from Wave 3",
              safety_score: "from Wave 4",
              hypothesis_reasoning: "from Wave 3",
            },
             output_summary: {
              confidence_score: data.hybrid_reasoning ? "pending uncertainty" : null,
              confidence_label: null,
              hybrid_reasoning_enabled: !!data.hybrid_reasoning,
              paradigm_agreement: (data.hybrid_reasoning as any)?.paradigm_agreement ?? null,
              soap_subjective: (data.hybrid_reasoning as any)?.soap?.subjective ? "populated" : "empty",
              soap_objective: (data.hybrid_reasoning as any)?.soap?.objective ? "populated" : "empty",
              soap_assessment: (data.hybrid_reasoning as any)?.soap?.assessment ? "populated" : "empty",
              soap_plan: (data.hybrid_reasoning as any)?.soap?.plan ? "populated" : "empty",
              soap_fallback_available: "check final_result.soap_fallback",
            },
            engines_invoked: ["Uncertainty Calibration Engine", "Hybrid Reasoning Engine", "SOAP Generator"],
            gaps: [],
          };
          w.gaps = identifyGaps("wave5_output", w.output_summary);
          allGaps.push(...w.gaps);
          waves.push(w);
          onWaveComplete?.(w);
        }
        break;
      }
    }
  };

  // Run the pipeline
  const result = await runO1Pipeline(pipelineInput, progressCallback);
  const totalMs = Math.round(performance.now() - pipelineStart);

  // Extract final outputs
  const diagnoses = result.ddx?.differential_diagnoses?.map(d => (d as any).diagnosis_name || (d as any).diagnosis || "unknown") ?? [];
  const labs = result.ddx?.recommended_labs?.map((l: any) => l.test_name || l) ?? [];
  const meds: string[] = []; // medications come from separate engine
  const graphMatches = result.ddx?.matched_symptoms?.length ?? 0;
  const dangerDetected = (result.ddx?.dangerous_diagnoses_injected ?? 0) > 0 ||
    (result.oversight?.events?.some(e => e.severity === "critical") ?? false);

  // Add uncertainty data to Wave 5 if we have it
  if (result.uncertainty) {
    const w5 = waves.find(w => w.wave === "Wave 5");
    if (w5) {
      w5.output_summary.confidence_score = result.uncertainty.confidence_score;
      w5.output_summary.confidence_label = result.uncertainty.confidence_label;
      w5.output_summary.missing_evidence = result.uncertainty.missing_evidence ?? [];
    }
  }

  // Build adapter field audit
  const auditFields = [
    "symptoms", "associated_symptoms", "risk_flags", "risk_factors",
    "chief_complaint", "symptom_duration", "medical_history", "allergies", "current_medications",
  ] as const;
  const adapterAudit = auditFields.map(field => {
    const uVal = (unified as any)[field];
    const cVal = (clinicalContext as any)[field];
    let status: "mapped" | "dropped" | "empty" = "mapped";
    if (cVal === undefined || cVal === null) status = "dropped";
    else if (Array.isArray(cVal) && cVal.length === 0) status = "empty";
    else if (typeof cVal === "string" && cVal === "") status = "empty";
    return { field, unified_value: uVal, clinical_value: cVal, status };
  });

  return {
    case_id: bc.id,
    case_name: bc.name,
    category: bc.category,
    total_ms: totalMs,
    unified_context_snapshot: unified,
    clinical_context_snapshot: clinicalContext as unknown as Record<string, unknown>,
    adapter_field_audit: adapterAudit,
    waves,
    final_result: result,
    all_gaps: allGaps,
    diagnoses_generated: diagnoses,
    labs_suggested: labs,
    medications_suggested: meds,
    graph_matches: graphMatches,
    danger_detected: dangerDetected,
  };
}

export { BENCHMARK_CASES_V5 };
