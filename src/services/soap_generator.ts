/**
 * SOAP Generator Service
 *
 * Generates structured SOAP notes from the context object
 * and pipeline outputs.
 */

import type { MergedContextObject } from "@/services/context_service";

// ── Inlined types (previously from deprecated services) ──

interface DDXOutput {
  diagnoses: Array<{
    diagnosis: string;
    probability_score: number;
    supporting_symptoms?: string[];
    must_not_miss?: boolean;
  }>;
  recommended_labs: Array<{ test_name: string; priority: string; differentiates: string[] }>;
}

interface GuidelineResult {
  recommendations: Array<{
    recommendation: string;
    organization: string;
  }>;
  sources_used: string[];
  compliance_score: number;
}

interface MedicationEngineResult {
  suggestions: Array<{
    generic_name: string;
    dose: string;
    frequency: string;
    safe: boolean;
  }>;
  safety_score: number;
  critical_warnings: number;
}

interface SafetyEngineResult {
  alerts: Array<{
    severity: string;
    description: string;
  }>;
  safety_score: number;
  critical_count: number;
  high_count: number;
  passed: boolean;
}

interface UncertaintyOutput {
  confidence_score: number;
  confidence_label: string;
  missing_evidence: string[];
  follow_up_questions: string[];
}

// ── Public types ──

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SOAPGeneratorResult {
  soap: SOAPNote;
  generated_at: string;
  confidence_label: string;
}

/**
 * Generate SOAP notes from context and pipeline outputs.
 */
export function generateSOAP(params: {
  context: MergedContextObject;
  ddx: DDXOutput;
  guidelines?: GuidelineResult;
  medications?: MedicationEngineResult;
  safety?: SafetyEngineResult;
  uncertainty?: UncertaintyOutput;
}): SOAPGeneratorResult {
  const { context: ctx, ddx, guidelines, medications, safety, uncertainty } = params;

  // ── Subjective ──
  const subjParts: string[] = [];
  if (ctx.chief_complaint) subjParts.push(`Chief complaint: ${ctx.chief_complaint}.`);
  if (ctx.symptoms.length > 0) subjParts.push(`Symptoms: ${ctx.symptoms.join(", ")}.`);
  if (ctx.symptom_duration) subjParts.push(`Duration: ${ctx.symptom_duration}.`);
  if (ctx.associated_symptoms.length > 0) subjParts.push(`Associated symptoms: ${ctx.associated_symptoms.join(", ")}.`);
  if (ctx.medical_history.length > 0) subjParts.push(`Past medical history: ${ctx.medical_history.join(", ")}.`);
  if (ctx.family_history.length > 0) subjParts.push(`Family history: ${ctx.family_history.join(", ")}.`);
  if (ctx.medications.length > 0) subjParts.push(`Current medications: ${ctx.medications.join(", ")}.`);
  if (ctx.allergies.length > 0) subjParts.push(`Allergies: ${ctx.allergies.join(", ")}.`);

  // ── Objective ──
  const objParts: string[] = [];
  if (ctx.vitals) {
    const v = ctx.vitals;
    const vitalsStr: string[] = [];
    if (v.bp_systolic && v.bp_diastolic) vitalsStr.push(`BP: ${v.bp_systolic}/${v.bp_diastolic} mmHg`);
    if (v.pulse) vitalsStr.push(`HR: ${v.pulse} bpm`);
    if (v.temperature) vitalsStr.push(`Temp: ${v.temperature}°C`);
    if (v.spo2) vitalsStr.push(`SpO2: ${v.spo2}%`);
    if (v.respiratory_rate) vitalsStr.push(`RR: ${v.respiratory_rate}/min`);
    if (v.weight_kg) vitalsStr.push(`Weight: ${v.weight_kg} kg`);
    if (v.height_cm) vitalsStr.push(`Height: ${v.height_cm} cm`);
    if (vitalsStr.length > 0) objParts.push(`Vitals: ${vitalsStr.join(", ")}.`);
  }
  if (ctx.lab_results && ctx.lab_results.length > 0) {
    const labStr = ctx.lab_results.map(l => `${l.parameter}: ${l.value}${l.unit ? ` ${l.unit}` : ""}`).join("; ");
    objParts.push(`Labs: ${labStr}.`);
  }

  // ── Assessment ──
  const assessParts: string[] = [];
  if (ddx.diagnoses.length > 0) {
    const dxList = ddx.diagnoses
      .slice(0, 5)
      .map((d, i) => `${i + 1}. ${d.diagnosis} (${Math.round(d.probability_score)}%)`)
      .join("\n");
    assessParts.push(`Differential diagnosis:\n${dxList}`);
  }
  if (uncertainty) {
    assessParts.push(`Diagnostic confidence: ${uncertainty.confidence_label} (${Math.round(uncertainty.confidence_score * 100)}%).`);
  }
  if (safety && safety.alerts.length > 0) {
    const criticals = safety.alerts.filter(a => a.severity === "critical");
    if (criticals.length > 0) {
      assessParts.push(`⚠️ Safety alerts: ${criticals.map(a => a.description).join("; ")}`);
    }
  }

  // ── Plan ──
  const planParts: string[] = [];
  if (ddx.recommended_labs.length > 0) {
    planParts.push(`Investigations: ${ddx.recommended_labs.map(l => l.test_name).join(", ")}.`);
  }
  if (medications && medications.suggestions.length > 0) {
    const medList = medications.suggestions
      .filter(m => m.safe)
      .slice(0, 5)
      .map(m => `${m.generic_name} ${m.dose} ${m.frequency}`)
      .join("; ");
    if (medList) planParts.push(`Medications: ${medList}.`);
  }
  if (guidelines && guidelines.recommendations.length > 0) {
    const guideStr = guidelines.recommendations
      .slice(0, 3)
      .map(g => `${g.recommendation} (${g.organization})`)
      .join("; ");
    planParts.push(`Guideline recommendations: ${guideStr}.`);
  }
  if (uncertainty && uncertainty.follow_up_questions.length > 0) {
    planParts.push(`Follow-up needed: ${uncertainty.follow_up_questions.join("; ")}`);
  }

  return {
    soap: {
      subjective: subjParts.join(" ") || "No subjective data recorded.",
      objective: objParts.join(" ") || "No objective findings recorded.",
      assessment: assessParts.join("\n") || "Insufficient data for assessment.",
      plan: planParts.join("\n") || "Further evaluation recommended.",
    },
    generated_at: new Date().toISOString(),
    confidence_label: uncertainty?.confidence_label || "Unknown",
  };
}
