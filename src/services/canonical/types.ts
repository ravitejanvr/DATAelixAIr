/**
 * Canonical Types — V4 Foundation
 *
 * Every clinical input is reduced to these types before
 * entering the reasoning pipeline. NO raw strings beyond
 * this boundary.
 */

/** Language-agnostic canonical feature */
export interface CanonicalFeature {
  feature_id: string;       // e.g. "FEVER", "CHEST_PAIN"
  presence: boolean;
  intensity: "absent" | "mild" | "moderate" | "severe" | "critical" | "unknown";
  duration: string;          // normalized: "2 days", "1 week", etc.
  snomed_id: string | null;
  source: "patient" | "clinician" | "vitals" | "lab" | "history";
}

/** Result of canonicalization with trace */
export interface CanonicalizationResult {
  features: CanonicalFeature[];
  unmapped: string[];
  language_detected: SupportedLanguage;
  trace: CanonicalizationTrace[];
}

export interface CanonicalizationTrace {
  raw_input: string;
  normalized: string;
  canonical_id: string | null;
  mapping_source: "synonym_map" | "snomed_lookup" | "passthrough";
  confidence: number;
}

export type SupportedLanguage = "en" | "hi" | "te" | "ta" | "unknown";

/** Canonical entry in the unified synonym map */
export interface CanonicalEntry {
  canonical_id: string;
  label: string;
  snomed_id: string | null;
  synonyms: string[];
  category: FeatureCategory;
}

export type FeatureCategory =
  | "respiratory"
  | "cardiovascular"
  | "gastrointestinal"
  | "neurological"
  | "musculoskeletal"
  | "genitourinary"
  | "dermatological"
  | "constitutional"
  | "psychiatric"
  | "ent"
  | "ophthalmological"
  | "pediatric"
  | "surgical"
  | "endocrine"
  | "hematological"
  | "unknown";
