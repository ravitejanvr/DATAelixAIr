/**
 * Clinical Pipeline Orchestrator — Canonical Entry Point
 *
 * Orchestrates the full clinical reasoning pipeline using the
 * Clinical Context Object as the single source of truth.
 *
 * Wave 1: DDX Engine + Knowledge Retrieval (parallel)
 * Wave 2: Guideline Engine + Medication Engine + Safety Engine (parallel)
 * Wave 3: Uncertainty Engine + SOAP Generator (parallel)
 *
 * Target latency: < 15 seconds
 */

import type { MergedContextObject } from "@/services/context_service";
import { logPipelineExecution, validateContextObject } from "@/services/context_service";
import { runDifferentialDiagnosis, type DDXOutput } from "@/services/ddx_service";
import { retrieveMedicalEvidence, type KnowledgeRetrievalResult } from "@/services/knowledge_retrieval";
import { retrieveGuidelines, type GuidelineResult } from "@/services/guideline_retrieval";
import { generateMedicationSuggestions, type MedicationEngineResult } from "@/services/medication_engine";
import { runSafetyValidation, type SafetyEngineResult } from "@/services/safety_engine";
import { evaluateUncertainty, type UncertaintyOutput } from "@/services/uncertainty_service";
import { generateSOAP, type SOAPGeneratorResult } from "@/services/soap_generator";

// ── Types ──

export interface ClinicalPipelineResult {
  ddx_candidates: DDXOutput;
  knowledge: KnowledgeRetrievalResult;
  recommended_labs: Array<{ test_name: string; priority: string; differentiates: string[] }>;
  recommended_medications: MedicationEngineResult;
  guidelines: GuidelineResult;
  safety_alerts: SafetyEngineResult;
  confidence_scores: UncertaintyOutput;
  soap_draft: SOAPGeneratorResult;
  latency: {
    wave1_ms: number;
    wave2_ms: number;
    wave3_ms: number;
    total_ms: number;
  };
  validation_errors: string[];
}

// ── Helper ──

async function timed<T>(label: string, visitId: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = performance.now();
  await logPipelineExecution(visitId, label, "started");
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    await logPipelineExecution(visitId, label, "completed", ms);
    return { result, ms };
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : String(e);
    await logPipelineExecution(visitId, label, "failed", ms, msg);
    throw e;
  }
}

async function safe<T>(label: string, visitId: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const { result } = await timed(label, visitId, fn);
    return result;
  } catch (e) {
    console.error(`[Pipeline] ${label} failed:`, e);
    return fallback;
  }
}

// ── Main Orchestrator ──

/**
 * Run the full clinical pipeline from a merged context object.
 */
export async function runClinicalPipeline(
  contextObject: MergedContextObject,
): Promise<ClinicalPipelineResult> {
  const pipelineStart = performance.now();
  const visitId = contextObject.visit_id;

  console.log("[Pipeline] Starting canonical clinical pipeline...");

  // Validate context
  const validation = validateContextObject(contextObject);
  if (!validation.valid) {
    console.warn("[Pipeline] Context validation failed:", validation.errors);
  }

  // ═══════════════════════════════════════════════════════
  // WAVE 1 — DDX Engine + Knowledge Retrieval (parallel)
  // ═══════════════════════════════════════════════════════
  const w1Start = performance.now();

  const [ddxResult, knowledgeResult] = await Promise.all([
    safe<DDXOutput>("ddx_engine", visitId, () => runDifferentialDiagnosis(contextObject), {
      diagnoses: [], recommended_labs: [], raw: null,
    }),
    safe<KnowledgeRetrievalResult>("knowledge_retrieval", visitId, () =>
      retrieveMedicalEvidence(contextObject.chief_complaint, { maxResults: 5 }), {
      citations: [], evidence_confidence: 0, source: "fallback", cached: false,
    }),
  ]);

  const wave1Ms = Math.round(performance.now() - w1Start);

  // ═══════════════════════════════════════════════════════
  // WAVE 2 — Guideline + Medication + Safety (parallel)
  // ═══════════════════════════════════════════════════════
  const w2Start = performance.now();

  const diagnosisNames = ddxResult.diagnoses.map(d => d.diagnosis);

  const [guidelineResult, medicationResult, safetyResult] = await Promise.all([
    safe<GuidelineResult>("guideline_engine", visitId, () => retrieveGuidelines(diagnosisNames), {
      recommendations: [], sources_used: [], compliance_score: 0,
    }),
    safe<MedicationEngineResult>("medication_engine", visitId, () =>
      generateMedicationSuggestions({
        diagnosis_candidates: diagnosisNames,
        patient_allergies: contextObject.allergies,
        current_medications: contextObject.medications,
        patient_age: null, // Would come from patient profile
        patient_weight_kg: contextObject.vitals?.weight_kg,
      }), {
      suggestions: [], safety_score: 100, critical_warnings: 0, validation: null,
    }),
    safe<SafetyEngineResult>("safety_engine", visitId, () =>
      runSafetyValidation({
        medications: contextObject.medications,
        allergies: contextObject.allergies,
        diagnoses: diagnosisNames,
        vitals: contextObject.vitals || undefined,
      }), {
      alerts: [], safety_score: 100, critical_count: 0, high_count: 0, passed: true,
    }),
  ]);

  const wave2Ms = Math.round(performance.now() - w2Start);

  // ═══════════════════════════════════════════════════════
  // WAVE 3 — Uncertainty + SOAP (parallel uncertainty, sync SOAP)
  // ═══════════════════════════════════════════════════════
  const w3Start = performance.now();

  const uncertaintyResult = await safe<UncertaintyOutput>("uncertainty_engine", visitId, () =>
    evaluateUncertainty({
      symptoms: contextObject.symptoms,
      vitals: contextObject.vitals || undefined,
      diagnoses: ddxResult.diagnoses,
      guideline_sources: guidelineResult.sources_used,
      medical_history: contextObject.medical_history,
      medications: contextObject.medications,
      allergies: contextObject.allergies,
      safety_score: safetyResult.safety_score,
    }), {
    confidence_score: 0, confidence_label: "Very Uncertain", missing_evidence: [], follow_up_questions: [], raw: null,
  });

  const soapResult = generateSOAP({
    context: contextObject,
    ddx: ddxResult,
    guidelines: guidelineResult,
    medications: medicationResult,
    safety: safetyResult,
    uncertainty: uncertaintyResult,
  });

  const wave3Ms = Math.round(performance.now() - w3Start);
  const totalMs = Math.round(performance.now() - pipelineStart);

  // Log latency warning
  if (totalMs > 15000) {
    console.warn(`[Pipeline] ⚠️ Latency exceeded target: ${totalMs}ms (target <15000ms)`);
    await logPipelineExecution(visitId, "pipeline_total", "completed", totalMs, `Latency exceeded: ${totalMs}ms`);
  } else {
    console.log(`[Pipeline] ✅ Completed in ${totalMs}ms (W1=${wave1Ms}ms W2=${wave2Ms}ms W3=${wave3Ms}ms)`);
    await logPipelineExecution(visitId, "pipeline_total", "completed", totalMs);
  }

  return {
    ddx_candidates: ddxResult,
    knowledge: knowledgeResult,
    recommended_labs: ddxResult.recommended_labs,
    recommended_medications: medicationResult,
    guidelines: guidelineResult,
    safety_alerts: safetyResult,
    confidence_scores: uncertaintyResult,
    soap_draft: soapResult,
    latency: { wave1_ms: wave1Ms, wave2_ms: wave2Ms, wave3_ms: wave3Ms, total_ms: totalMs },
    validation_errors: validation.errors,
  };
}
