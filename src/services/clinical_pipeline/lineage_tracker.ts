/**
 * Clinical Data Lineage Tracker
 *
 * Tracks every UnifiedClinicalContext field through each pipeline wave,
 * recording which engines consume it and whether it influences outputs.
 *
 * Produces a FieldLineageMap used by the trace dashboard.
 */

// ── Types ──

export type PipelineStage =
  | "pcie"
  | "context_enrichment"
  | "meta_reasoning"
  | "ddx"
  | "physiology"
  | "evidence"
  | "bayesian"
  | "guideline"
  | "hypothesis"
  | "safety"
  | "uncertainty"
  | "hypothesis_testing"
  | "soap"
  | "cockpit";

export interface FieldLineageEntry {
  field: string;
  /** The original value at pipeline entry */
  origin_value: unknown;
  /** Which stages received the field */
  received_by: PipelineStage[];
  /** Which stages actually used the field in computation */
  consumed_by: PipelineStage[];
  /** Whether the field influenced a reasoning output (DDX score, SOAP text, etc.) */
  influenced_output: boolean;
  /** True if field reaches cockpit without any reasoning engine consuming it */
  unprocessed_passthrough: boolean;
  /** Snapshot values at each wave boundary */
  wave_snapshots: {
    wave: string;
    stage: PipelineStage;
    value: unknown;
    present: boolean;
  }[];
  /** If the field was dropped between waves, record where */
  dropped_at: string | null;
}

export interface ContextSnapshot {
  wave: string;
  stage: PipelineStage;
  timestamp: number;
  fields: Record<string, { value: unknown; present: boolean }>;
}

export interface LineageReport {
  fields: FieldLineageEntry[];
  snapshots: ContextSnapshot[];
  dropped_fields: { field: string; dropped_at: string; last_seen_at: string }[];
  unprocessed_fields: string[];
  total_fields: number;
  fields_consumed_by_reasoning: number;
  coverage_pct: number;
}

// ── Tracked field definitions ──

export const TRACKED_FIELDS = [
  "chief_complaint",
  "symptoms",
  "associated_symptoms",
  "symptom_duration",
  "medical_history",
  "family_history",
  "risk_factors",
  "current_medications",
  "allergies",
  "vitals.bp_systolic",
  "vitals.bp_diastolic",
  "vitals.pulse",
  "vitals.temperature",
  "vitals.spo2",
  "vitals.respiratory_rate",
  "vitals.weight_kg",
  "vitals.height_cm",
  "lab_results",
  "risk_flags",
  "patient_age",
  "patient_sex",
  "context_confidence",
] as const;

// ── Which engines consume which fields ──

const ENGINE_FIELD_CONSUMPTION: Record<PipelineStage, readonly string[]> = {
  pcie: ["chief_complaint", "symptoms", "associated_symptoms", "symptom_duration", "medical_history", "allergies", "current_medications", "risk_factors", "vitals.bp_systolic", "vitals.bp_diastolic", "vitals.pulse", "vitals.temperature", "vitals.spo2", "vitals.respiratory_rate", "vitals.weight_kg", "vitals.height_cm", "lab_results", "risk_flags", "patient_age", "patient_sex", "family_history", "context_confidence"],
  context_enrichment: ["chief_complaint", "symptoms", "symptom_duration", "medical_history", "allergies", "current_medications", "patient_age", "patient_sex", "vitals.pulse", "vitals.temperature", "vitals.spo2", "vitals.bp_systolic", "vitals.bp_diastolic"],
  ddx: ["chief_complaint", "symptoms", "associated_symptoms", "medical_history", "current_medications", "allergies", "patient_age", "patient_sex", "vitals.temperature", "vitals.spo2", "vitals.pulse", "vitals.bp_systolic"],
  physiology: ["symptoms", "vitals.temperature", "vitals.spo2", "vitals.pulse", "vitals.bp_systolic"],
  evidence: ["chief_complaint", "symptoms", "risk_factors", "patient_age", "patient_sex"],
  bayesian: ["symptoms", "patient_age", "patient_sex", "medical_history", "risk_factors", "family_history", "vitals.temperature", "vitals.spo2", "vitals.pulse"],
  guideline: ["chief_complaint", "current_medications", "patient_age", "patient_sex", "medical_history"],
  hypothesis: ["chief_complaint", "symptoms", "associated_symptoms", "symptom_duration", "medical_history", "current_medications", "allergies", "patient_age", "patient_sex", "vitals.temperature", "vitals.spo2", "vitals.pulse", "vitals.bp_systolic", "vitals.bp_diastolic", "vitals.respiratory_rate", "vitals.weight_kg", "vitals.height_cm", "lab_results", "family_history"],
  safety: ["current_medications", "allergies", "risk_flags", "risk_factors", "medical_history"],
  uncertainty: ["symptoms", "medical_history", "current_medications", "allergies", "vitals.temperature", "vitals.spo2", "vitals.pulse", "vitals.bp_systolic", "risk_flags", "lab_results"],
  soap: ["chief_complaint", "symptoms", "associated_symptoms", "symptom_duration", "medical_history", "family_history", "current_medications", "allergies", "vitals.bp_systolic", "vitals.bp_diastolic", "vitals.pulse", "vitals.temperature", "vitals.spo2", "vitals.respiratory_rate", "vitals.weight_kg", "vitals.height_cm", "lab_results", "risk_factors", "risk_flags", "context_confidence"],
  meta_reasoning: ["symptoms", "vitals.temperature", "vitals.spo2", "vitals.pulse", "vitals.bp_systolic", "medical_history", "current_medications", "allergies"],
  hypothesis_testing: ["symptoms", "patient_age", "patient_sex", "allergies", "current_medications"],
  cockpit: TRACKED_FIELDS as unknown as string[],
};

// ── Lineage Tracker Class ──

export class LineageTracker {
  private snapshots: ContextSnapshot[] = [];
  private engineResults: Map<PipelineStage, boolean> = new Map();

  /** Extract a nested field value from an object */
  private getFieldValue(obj: Record<string, any>, field: string): unknown {
    const parts = field.split(".");
    let current: any = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }

  /** Check if a value is "present" (non-null, non-empty) */
  private isPresent(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  }

  /** Take a context snapshot at a wave boundary */
  captureSnapshot(
    wave: string,
    stage: PipelineStage,
    context: Record<string, any>,
  ): void {
    const fields: Record<string, { value: unknown; present: boolean }> = {};
    for (const field of TRACKED_FIELDS) {
      const value = this.getFieldValue(context, field);
      fields[field] = { value, present: this.isPresent(value) };
    }
    this.snapshots.push({
      wave,
      stage,
      timestamp: performance.now(),
      fields,
    });
  }

  /** Record that an engine produced output (or not) */
  recordEngineResult(stage: PipelineStage, producedOutput: boolean): void {
    this.engineResults.set(stage, producedOutput);
  }

  /** Generate the full lineage report */
  generateReport(): LineageReport {
    const fields: FieldLineageEntry[] = [];
    const droppedFields: { field: string; dropped_at: string; last_seen_at: string }[] = [];
    const reasoningStages: PipelineStage[] = ["ddx", "bayesian", "hypothesis", "safety", "uncertainty", "soap"];

    // Build a set of all engines that produced output — used for consumption checks
    const activeEngines = new Set<PipelineStage>();
    for (const [stage, produced] of this.engineResults) {
      if (produced) activeEngines.add(stage);
    }

    for (const field of TRACKED_FIELDS) {
      const received_by: PipelineStage[] = [];
      const consumed_by: PipelineStage[] = [];
      const wave_snapshots: FieldLineageEntry["wave_snapshots"] = [];

      let lastSeenAt: string | null = null;
      let droppedAt: string | null = null;
      let originValue: unknown = undefined;
      let fieldIsPresent = false;

      for (const snap of this.snapshots) {
        const fieldData = snap.fields[field];
        wave_snapshots.push({
          wave: snap.wave,
          stage: snap.stage,
          value: fieldData?.value,
          present: fieldData?.present ?? false,
        });

        if (fieldData?.present) {
          received_by.push(snap.stage);
          lastSeenAt = snap.wave;
          fieldIsPresent = true;
          if (originValue === undefined) originValue = fieldData.value;
        } else if (lastSeenAt && !droppedAt) {
          droppedAt = snap.wave;
        }
      }

      // Check consumption across ALL active engines (not just snapshot stages)
      // A field is consumed if:
      //   1. The engine declares it in ENGINE_FIELD_CONSUMPTION
      //   2. The field is present in the pipeline (based on any snapshot)
      //   3. The engine produced output (recorded in engineResults)
      if (fieldIsPresent) {
        for (const engine of activeEngines) {
          const engineFields = ENGINE_FIELD_CONSUMPTION[engine];
          if (engineFields?.includes(field)) {
            consumed_by.push(engine);
          }
        }
      }

      const influenced_output = consumed_by.some(s => reasoningStages.includes(s));
      const reachesCockpit = received_by.length > 0;
      const processedByReasoning = consumed_by.some(s => reasoningStages.includes(s));
      const unprocessed_passthrough = reachesCockpit && !processedByReasoning && this.isPresent(originValue);

      fields.push({
        field,
        origin_value: originValue,
        received_by: [...new Set(received_by)],
        consumed_by: [...new Set(consumed_by)],
        influenced_output,
        unprocessed_passthrough,
        wave_snapshots,
        dropped_at: droppedAt,
      });

      if (droppedAt && lastSeenAt) {
        droppedFields.push({ field, dropped_at: droppedAt, last_seen_at: lastSeenAt });
      }
    }

    const unprocessed = fields.filter(f => f.unprocessed_passthrough).map(f => f.field);
    const consumedCount = fields.filter(f => f.consumed_by.length > 0).length;

    return {
      fields,
      snapshots: this.snapshots,
      dropped_fields: droppedFields,
      unprocessed_fields: unprocessed,
      total_fields: fields.length,
      fields_consumed_by_reasoning: consumedCount,
      coverage_pct: fields.length > 0 ? Math.round((consumedCount / fields.length) * 100) : 0,
    };
  }

  /** Reset for a new pipeline run */
  reset(): void {
    this.snapshots = [];
    this.engineResults.clear();
  }
}
