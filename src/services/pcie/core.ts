/**
 * PCIE Clinical Intelligence Core
 *
 * Central state manager for the clinical reasoning platform.
 * Owns the UnifiedClinicalContextGraph and exposes methods for
 * modules to read/update the graph with reasoning traces.
 *
 * This replaces the pipeline-centric model: instead of data flowing
 * through waves, modules operate on a shared graph managed by PCIE.
 */

import type {
  UnifiedClinicalContextGraph,
  PatientContextLayer,
} from "./context_graph";
import { createEmptyContextGraph } from "./context_graph";
import type { ClinicalContext } from "@/lib/clinical-context";
import type { ModuleId } from "./module_registry";

// ── PCIE Core Class ──

export class PCIECore {
  private graph: UnifiedClinicalContextGraph;

  constructor(
    identity: {
      visit_id?: string | null;
      patient_id?: string | null;
      clinic_id?: string | null;
      consultation_id?: string | null;
    } = {},
  ) {
    this.graph = createEmptyContextGraph(identity);
  }

  /** Get the full context graph (read-only snapshot) */
  getGraph(): Readonly<UnifiedClinicalContextGraph> {
    return this.graph;
  }

  /** Get the patient context layer */
  getPatientContext(): Readonly<PatientContextLayer> {
    return this.graph.patient;
  }

  /** Check if a field path has a non-empty value */
  hasField(fieldPath: string): boolean {
    const value = this.getFieldValue(fieldPath);
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }

  /** Check if all required fields for a module are present */
  checkDependencies(requiredInputs: string[]): { ready: boolean; missing: string[] } {
    const missing = requiredInputs.filter(f => !this.hasField(f));
    return { ready: missing.length === 0, missing };
  }

  // ── Hydration ──

  /** Hydrate from a ClinicalContext (primary entry point) */
  hydrateFromClinicalContext(ctx: ClinicalContext): void {
    this.graph.patient = {
      patient_age: ctx.patient_age ?? null,
      patient_sex: ctx.patient_sex ?? null,
      patient_name: null,
      chief_complaint: ctx.chief_complaint || "",
      symptoms: ctx.symptoms || [],
      associated_symptoms: ctx.associated_symptoms || [],
      symptom_duration: ctx.symptom_duration || "",
      medical_history: ctx.medical_history || [],
      family_history: (ctx as any).family_history || [],
      risk_factors: ctx.risk_factors || [],
      current_medications: ctx.current_medications || [],
      allergies: ctx.allergies || [],
      vitals: {
        temperature: ctx.temperature ?? null,
        spo2: ctx.oxygen_saturation ?? null,
        pulse: ctx.pulse ?? null,
        bp_systolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[0]) || null : null,
        bp_diastolic: ctx.blood_pressure ? parseInt(ctx.blood_pressure.split("/")[1]) || null : null,
        respiratory_rate: ctx.respiratory_rate ?? null,
        weight_kg: ctx.weight ?? null,
        height_cm: ctx.height ?? null,
      },
      lab_results: [],
      risk_flags: ctx.risk_flags || [],
      missing_information: [],
      context_confidence: 0,
    };
    this.graph.last_updated_at = new Date().toISOString();
  }

  /** Merge PCIE-fetched data (fills gaps only, does not overwrite) */
  mergePCIEData(pcieData: Partial<PatientContextLayer>): void {
    const p = this.graph.patient;
    if (!p.chief_complaint && pcieData.chief_complaint) p.chief_complaint = pcieData.chief_complaint;
    if (p.symptoms.length === 0 && pcieData.symptoms?.length) p.symptoms = pcieData.symptoms;
    if (p.medical_history.length === 0 && pcieData.medical_history?.length) p.medical_history = pcieData.medical_history;
    if (p.allergies.length === 0 && pcieData.allergies?.length) p.allergies = pcieData.allergies;
    if (p.current_medications.length === 0 && pcieData.current_medications?.length) p.current_medications = pcieData.current_medications;
    if (p.risk_factors.length === 0 && pcieData.risk_factors?.length) p.risk_factors = pcieData.risk_factors;
    if (p.family_history.length === 0 && pcieData.family_history?.length) p.family_history = pcieData.family_history;
    if (pcieData.context_confidence && pcieData.context_confidence > p.context_confidence) {
      p.context_confidence = pcieData.context_confidence;
    }
    this.graph.source_type = "pcie";
    this.graph.last_updated_at = new Date().toISOString();
  }

  // ── Module Updates ──

  /** Record that a module executed */
  recordModuleExecution(moduleId: ModuleId): void {
    if (!this.graph.modules_executed.includes(moduleId)) {
      this.graph.modules_executed.push(moduleId);
    }
    this.graph.last_updated_at = new Date().toISOString();
  }

  /** Add a reasoning trace entry */
  addReasoningTrace(moduleId: string, summary: string): void {
    this.graph.reasoning.reasoning_traces.push({
      module: moduleId,
      timestamp: performance.now(),
      summary,
    });
  }

  /** Update the reasoning layer (partial merge) */
  updateReasoning(updates: Partial<UnifiedClinicalContextGraph["reasoning"]>): void {
    Object.assign(this.graph.reasoning, updates);
    this.graph.last_updated_at = new Date().toISOString();
  }

  /** Update the decision layer (partial merge) */
  updateDecision(updates: Partial<UnifiedClinicalContextGraph["decision"]>): void {
    Object.assign(this.graph.decision, updates);
    this.graph.last_updated_at = new Date().toISOString();
  }

  /** Update the documentation layer */
  updateDocumentation(updates: Partial<UnifiedClinicalContextGraph["documentation"]>): void {
    Object.assign(this.graph.documentation, updates);
    this.graph.last_updated_at = new Date().toISOString();
  }

  /** Update patient context (for doctor interaction loop) */
  updatePatientContext(updates: Partial<PatientContextLayer>): void {
    Object.assign(this.graph.patient, updates);
    this.graph.last_updated_at = new Date().toISOString();
  }

  /** Get all symptoms (deduplicated) */
  getAllSymptoms(): string[] {
    const p = this.graph.patient;
    const all = [p.chief_complaint, ...p.symptoms, ...p.associated_symptoms].filter(Boolean);
    return [...new Set(all)];
  }

  // ── Helpers ──

  private getFieldValue(fieldPath: string): unknown {
    const parts = fieldPath.split(".");
    let current: any = this.graph;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
}
