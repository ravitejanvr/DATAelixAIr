/**
 * Session Context Manager — V4 Stateful SSOT
 *
 * Maintains a SINGLE source of truth for clinical context
 * across multiple scribe chunks, question answers, and file uploads.
 *
 * Rules:
 * - Deterministic: same sequence of updates → same state
 * - No raw strings stored after canonicalization
 * - Merges intelligently (deduplicates features by canonical_id)
 * - Tracks provenance (source + turn index)
 *
 * 🚫 RAW STRING USAGE FORBIDDEN IN STORED STATE
 */

import type { CanonicalFeature, CanonicalizationResult } from "../canonical/types";
import type { PipelineVitals, PipelineLabResult, PipelineInput, ClinicalContext } from "../pipeline/types";
import type { ExtractedSymptom } from "../scribe_adapter/types";
import type { TrackedFeature, UploadedFile, SessionSnapshot, DataSource } from "./types";
import { canonicalize } from "../canonical/normalizer";

export type { SessionSnapshot, UploadedFile, TrackedFeature, DataSource } from "./types";

export class SessionContextManager {
  private features: Map<string, TrackedFeature> = new Map();
  private vitals: PipelineVitals | null = null;
  private medications: string[] = [];
  private allergies: string[] = [];
  private medicalHistory: string[] = [];
  private familyHistory: string[] = [];
  private labResults: PipelineLabResult[] = [];
  private patientAge: number | null = null;
  private patientSex: string | null = null;
  private patientName: string | null = null;
  private files: UploadedFile[] = [];
  private answeredQuestionIds = new Set<string>();
  private turnCount = 0;
  private startedAt: string;
  private lastUpdated: string;

  constructor() {
    const now = new Date().toISOString();
    this.startedAt = now;
    this.lastUpdated = now;
  }

  // ══════════════════════════════════════════════
  // UPDATE METHODS
  // ══════════════════════════════════════════════

  /**
   * Update from scribe adapter extraction.
   * Canonicalizes extracted symptoms and merges into feature set.
   */
  updateFromExtraction(extracted: ExtractedSymptom[], source: DataSource = "patient_voice"): void {
    this.turnCount++;
    const now = new Date().toISOString();

    // Only process non-negated symptoms
    const positiveSymptoms = extracted.filter(s => !s.negated);
    const rawInputs = positiveSymptoms.map(s => s.raw_text);

    if (rawInputs.length === 0) {
      this.lastUpdated = now;
      return;
    }

    // 🚫 RAW STRING USAGE FORBIDDEN BEYOND THIS POINT
    const canonResult = canonicalize(rawInputs, "patient");

    // Merge features — enriched with extraction modifiers
    for (const feature of canonResult.features) {
      const matchingExtraction = positiveSymptoms.find(es => {
        const normalized = es.raw_text.toLowerCase().trim();
        return canonResult.features.some(f =>
          f.feature_id === feature.feature_id
        );
      });

      const enrichedFeature: CanonicalFeature = {
        ...feature,
        intensity: matchingExtraction
          ? this.mapSeverity(matchingExtraction.severity)
          : feature.intensity,
        duration: matchingExtraction?.duration || feature.duration,
      };

      this.mergeFeature(enrichedFeature, source);
    }

    // Also extract global duration/severity from the extraction set
    for (const es of positiveSymptoms) {
      if (es.duration) {
        // Update duration on features that don't have one yet
        for (const [, tracked] of this.features) {
          if (!tracked.feature.duration || tracked.feature.duration === "") {
            tracked.feature = { ...tracked.feature, duration: es.duration };
          }
        }
      }
    }

    this.lastUpdated = now;
  }

  /**
   * Update from canonical features directly (e.g., from file extraction).
   */
  updateFromCanonicalFeatures(features: CanonicalFeature[], source: DataSource): void {
    this.turnCount++;
    for (const feature of features) {
      this.mergeFeature(feature, source);
    }
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Update from question answers.
   * Canonicalizes any symptom-like answers and stores structured data.
   */
  updateFromAnswers(questionId: string, answer: string | string[] | number): void {
    this.turnCount++;
    this.answeredQuestionIds.add(questionId);
    const now = new Date().toISOString();

    if (typeof answer === "number") {
      // Numeric answer — likely vitals
      this.lastUpdated = now;
      return;
    }

    // String answers may contain symptom references
    const answerTexts = Array.isArray(answer) ? answer : [answer];
    const canonResult = canonicalize(answerTexts, "patient");

    // 🚫 RAW STRING USAGE FORBIDDEN BEYOND THIS POINT
    for (const feature of canonResult.features) {
      this.mergeFeature(feature, "question_answer");
    }

    this.lastUpdated = now;
  }

  /**
   * Attach vitals — merges with existing (does not overwrite non-null values).
   */
  attachVitals(vitals: PipelineVitals): void {
    if (!this.vitals) {
      this.vitals = { ...vitals };
    } else {
      this.vitals = {
        bp_systolic: vitals.bp_systolic ?? this.vitals.bp_systolic,
        bp_diastolic: vitals.bp_diastolic ?? this.vitals.bp_diastolic,
        pulse: vitals.pulse ?? this.vitals.pulse,
        temperature: vitals.temperature ?? this.vitals.temperature,
        spo2: vitals.spo2 ?? this.vitals.spo2,
        respiratory_rate: vitals.respiratory_rate ?? this.vitals.respiratory_rate,
        weight_kg: vitals.weight_kg ?? this.vitals.weight_kg,
        height_cm: vitals.height_cm ?? this.vitals.height_cm,
      };
    }
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Attach files and extract structured data from them.
   */
  attachFiles(files: UploadedFile[]): void {
    for (const file of files) {
      // Deduplicate by file_id
      if (!this.files.some(f => f.file_id === file.file_id)) {
        this.files.push(file);

        // Merge extracted labs into lab results
        if (file.extracted_labs) {
          for (const lab of file.extracted_labs) {
            if (!this.labResults.some(l => l.parameter === lab.parameter)) {
              this.labResults.push(lab);
            }
          }
        }
      }
    }
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Set patient demographics.
   */
  setDemographics(data: { age?: number; sex?: string; name?: string }): void {
    if (data.age != null) this.patientAge = data.age;
    if (data.sex) this.patientSex = data.sex;
    if (data.name) this.patientName = data.name;
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Set medications.
   */
  setMedications(meds: string[]): void {
    this.medications = [...new Set([...this.medications, ...meds])];
    this.lastUpdated = new Date().toISOString();
  }

  /**
   * Set allergies.
   */
  setAllergies(allergies: string[]): void {
    this.allergies = [...new Set([...this.allergies, ...allergies])];
    this.lastUpdated = new Date().toISOString();
  }

  // ══════════════════════════════════════════════
  // READ METHODS
  // ══════════════════════════════════════════════

  /**
   * Get the current context as a PipelineInput for runClinicalPipelineV4.
   */
  toPipelineInput(): PipelineInput {
    const features = this.getCanonicalFeatures();
    return {
      input_type: "chat",
      symptoms: features.map(f => f.feature_id),
      patient_age: this.patientAge,
      patient_sex: this.patientSex,
      patient_name: this.patientName,
      vitals: this.vitals,
      medical_history: this.medicalHistory,
      family_history: this.familyHistory,
      current_medications: this.medications,
      allergies: this.allergies,
      lab_results: this.labResults,
    };
  }

  /**
   * Get all canonical features (deduplicated).
   */
  getCanonicalFeatures(): CanonicalFeature[] {
    return Array.from(this.features.values()).map(t => t.feature);
  }

  /**
   * Get set of answered question IDs.
   */
  getAnsweredQuestionIds(): Set<string> {
    return new Set(this.answeredQuestionIds);
  }

  /**
   * Get full session snapshot.
   */
  getSnapshot(): SessionSnapshot {
    return {
      features: Array.from(this.features.values()),
      vitals: this.vitals ? { ...this.vitals } : null,
      medications: [...this.medications],
      allergies: [...this.allergies],
      medical_history: [...this.medicalHistory],
      family_history: [...this.familyHistory],
      lab_results: [...this.labResults],
      patient_age: this.patientAge,
      patient_sex: this.patientSex,
      patient_name: this.patientName,
      files: [...this.files],
      answered_question_ids: new Set(this.answeredQuestionIds),
      turn_count: this.turnCount,
      started_at: this.startedAt,
      last_updated: this.lastUpdated,
    };
  }

  /**
   * Reset the entire session.
   */
  reset(): void {
    this.features.clear();
    this.vitals = null;
    this.medications = [];
    this.allergies = [];
    this.medicalHistory = [];
    this.familyHistory = [];
    this.labResults = [];
    this.patientAge = null;
    this.patientSex = null;
    this.patientName = null;
    this.files = [];
    this.answeredQuestionIds.clear();
    this.turnCount = 0;
    const now = new Date().toISOString();
    this.startedAt = now;
    this.lastUpdated = now;
  }

  // ══════════════════════════════════════════════
  // INTERNAL HELPERS
  // ══════════════════════════════════════════════

  /**
   * Merge a feature into the feature map.
   * If already present, upgrade intensity/duration if the new data is more specific.
   */
  private mergeFeature(feature: CanonicalFeature, source: DataSource): void {
    const existing = this.features.get(feature.feature_id);

    if (!existing) {
      this.features.set(feature.feature_id, {
        feature,
        source,
        added_at: new Date().toISOString(),
        turn_index: this.turnCount,
      });
      return;
    }

    // Upgrade logic: prefer more specific data
    const merged: CanonicalFeature = { ...existing.feature };

    // Upgrade intensity if new is more specific than "unknown"
    if (feature.intensity !== "unknown" && existing.feature.intensity === "unknown") {
      merged.intensity = feature.intensity;
    }

    // Upgrade duration if new is more specific
    if (feature.duration && (!existing.feature.duration || existing.feature.duration === "")) {
      merged.duration = feature.duration;
    }

    existing.feature = merged;
    existing.turn_index = this.turnCount;
  }

  private mapSeverity(severity: string): CanonicalFeature["intensity"] {
    switch (severity) {
      case "mild": return "mild";
      case "moderate": return "moderate";
      case "severe": return "severe";
      default: return "unknown";
    }
  }
}
