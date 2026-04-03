/**
 * Canonical Disease Profile Registry
 *
 * ID-based disease identity resolution for Score Fusion.
 * Eliminates string-based matching — diagnosis_id is the ONLY key.
 *
 * ARCHITECTURE:
 *   - Keys are diagnosis_id (UUID from diagnoses table)
 *   - Profiles define systemic/organ classification and weights
 *   - Used by Score Fusion to compute physiology multipliers deterministically
 *   - Fallback registry maps canonical_name → profile for DDX-derived diagnoses
 *     that don't have a stable UUID in the registry
 *
 * INVARIANTS:
 *   - Pure data, no side effects
 *   - Deterministic: same ID → same profile
 *   - Feature-flagged via enable_canonical_mapping
 */

import type { DiseaseType } from "@/services/physiology_engine/systemic_state";

// ── Types ──

export interface CanonicalDiseaseProfile {
  diagnosis_id: string;
  canonical_name: string;
  category: DiseaseType;
  systemic_weight: number;
  organ_weight: number;
  requires_systemic_instability: boolean;
  phenotype_keywords: string[];
  /** Name aliases for reverse-lookup from DDX name → profile */
  aliases: string[];
}

// ── Canonical Registry (keyed by diagnosis_id) ──
// These IDs should match the `diagnoses` table in the database.
// When IDs are unknown, the name-based fallback registry below is used.

export const CANONICAL_PROFILES: Record<string, CanonicalDiseaseProfile> = {};

// ── Name-Based Fallback Registry ──
// Used when diagnosis_id is not in CANONICAL_PROFILES.
// Keyed by lowercase canonical name. Aliases are also indexed.

const NAME_PROFILES: CanonicalDiseaseProfile[] = [
  {
    diagnosis_id: "__canonical_sepsis",
    canonical_name: "sepsis",
    category: "systemic",
    systemic_weight: 1.0,
    organ_weight: 0.1,
    requires_systemic_instability: true,
    phenotype_keywords: ["sepsis", "septic", "septicemia", "septicaemia", "bacteremia", "urosepsis", "systemic infection"],
    aliases: ["sepsis", "septic shock", "septicemia", "septicaemia", "bacteremia", "urosepsis", "systemic infection", "severe sepsis"],
  },
  {
    diagnosis_id: "__canonical_pneumonia",
    canonical_name: "pneumonia",
    category: "organ",
    systemic_weight: 0.4,
    organ_weight: 0.9,
    requires_systemic_instability: false,
    phenotype_keywords: ["pneumonia", "cap", "community acquired pneumonia", "community-acquired pneumonia"],
    aliases: ["pneumonia", "community acquired pneumonia", "community-acquired pneumonia", "cap", "lobar pneumonia", "bronchopneumonia"],
  },
  {
    diagnosis_id: "__canonical_pe",
    canonical_name: "pulmonary embolism",
    category: "vascular",
    systemic_weight: 0.5,
    organ_weight: 0.7,
    requires_systemic_instability: false,
    phenotype_keywords: ["pulmonary embolism", "pe"],
    aliases: ["pulmonary embolism", "pe", "pulmonary thromboembolism"],
  },
  {
    diagnosis_id: "__canonical_acs",
    canonical_name: "acute coronary syndrome",
    category: "vascular",
    systemic_weight: 0.5,
    organ_weight: 0.8,
    requires_systemic_instability: false,
    phenotype_keywords: ["acute coronary syndrome", "acs", "myocardial infarction", "mi", "nstemi", "stemi"],
    aliases: ["acute coronary syndrome", "acs", "myocardial infarction", "mi", "nstemi", "stemi", "heart attack", "unstable angina"],
  },
  {
    diagnosis_id: "__canonical_hypoglycemia",
    canonical_name: "hypoglycemia",
    category: "metabolic",
    systemic_weight: 0.3,
    organ_weight: 0.5,
    requires_systemic_instability: false,
    phenotype_keywords: ["hypoglycemia", "hypoglycemic", "low blood sugar"],
    aliases: ["hypoglycemia", "hypoglycemic", "low blood sugar"],
  },
  {
    diagnosis_id: "__canonical_dka",
    canonical_name: "diabetic ketoacidosis",
    category: "metabolic",
    systemic_weight: 0.3,
    organ_weight: 0.5,
    requires_systemic_instability: false,
    phenotype_keywords: ["dka", "diabetic ketoacidosis"],
    aliases: ["dka", "diabetic ketoacidosis"],
  },
  {
    diagnosis_id: "__canonical_meningitis",
    canonical_name: "meningitis",
    category: "organ",
    systemic_weight: 0.5,
    organ_weight: 0.8,
    requires_systemic_instability: false,
    phenotype_keywords: ["meningitis", "encephalitis"],
    aliases: ["meningitis", "bacterial meningitis", "viral meningitis", "encephalitis", "meningoencephalitis"],
  },
  {
    diagnosis_id: "__canonical_stroke",
    canonical_name: "stroke",
    category: "neurological",
    systemic_weight: 0.2,
    organ_weight: 0.9,
    requires_systemic_instability: false,
    phenotype_keywords: ["stroke", "cerebrovascular", "cva", "tia"],
    aliases: ["stroke", "cerebrovascular accident", "cva", "tia", "transient ischemic attack", "ischemic stroke", "hemorrhagic stroke"],
  },
  {
    diagnosis_id: "__canonical_appendicitis",
    canonical_name: "appendicitis",
    category: "organ",
    systemic_weight: 0.4,
    organ_weight: 0.9,
    requires_systemic_instability: false,
    phenotype_keywords: ["appendicitis"],
    aliases: ["appendicitis", "acute appendicitis"],
  },
  {
    diagnosis_id: "__canonical_thyroid_storm",
    canonical_name: "thyroid storm",
    category: "metabolic",
    systemic_weight: 0.2,
    organ_weight: 0.6,
    requires_systemic_instability: false,
    phenotype_keywords: ["thyroid storm", "thyrotoxicosis"],
    aliases: ["thyroid storm", "thyrotoxicosis", "thyroid crisis"],
  },
  {
    diagnosis_id: "__canonical_uti",
    canonical_name: "urinary tract infection",
    category: "organ",
    systemic_weight: 0.35,
    organ_weight: 0.8,
    requires_systemic_instability: false,
    phenotype_keywords: ["urinary tract infection", "uti", "pyelonephritis"],
    aliases: ["urinary tract infection", "uti", "pyelonephritis", "cystitis"],
  },
];

// ── Pre-built Index: lowercase alias → profile ──

const ALIAS_INDEX = new Map<string, CanonicalDiseaseProfile>();

function buildAliasIndex(): void {
  for (const profile of NAME_PROFILES) {
    for (const alias of profile.aliases) {
      ALIAS_INDEX.set(alias.toLowerCase(), profile);
    }
    // Also index canonical_name
    ALIAS_INDEX.set(profile.canonical_name.toLowerCase(), profile);
  }
}

// Build on module load (deterministic, no side effects)
buildAliasIndex();

// ── Public API ──

/**
 * Resolve a disease profile by diagnosis_id (primary) or resolved name (fallback).
 *
 * Resolution order:
 *   1. CANONICAL_PROFILES[diagnosis_id] — exact UUID match
 *   2. ALIAS_INDEX[resolvedName] — exact name match from aliases
 *   3. Substring scan of ALIAS_INDEX keys — partial match
 *   4. null — no match found
 *
 * @returns CanonicalDiseaseProfile or null
 */
export function resolveCanonicalProfile(
  diagnosis_id: string,
  resolvedName?: string | null,
): CanonicalDiseaseProfile | null {
  // 1. Direct ID lookup
  const byId = CANONICAL_PROFILES[diagnosis_id];
  if (byId) return byId;

  // 2. Exact name match via alias index
  if (resolvedName) {
    const lower = resolvedName.toLowerCase().trim();
    const byName = ALIAS_INDEX.get(lower);
    if (byName) return byName;

    // 3. Substring match (handles "community-acquired pneumonia" vs "pneumonia")
    for (const [alias, profile] of ALIAS_INDEX) {
      if (lower.includes(alias) || alias.includes(lower)) {
        return profile;
      }
    }
  }

  // 4. No match
  return null;
}

/**
 * Check if a profile was found via ID (primary) or name (fallback).
 * Used for logging and diagnostics.
 */
export function getResolutionMethod(
  diagnosis_id: string,
  resolvedName?: string | null,
): "ID_MATCH" | "NAME_EXACT" | "NAME_SUBSTRING" | "NO_MATCH" {
  if (CANONICAL_PROFILES[diagnosis_id]) return "ID_MATCH";

  if (resolvedName) {
    const lower = resolvedName.toLowerCase().trim();
    if (ALIAS_INDEX.has(lower)) return "NAME_EXACT";
    for (const [alias] of ALIAS_INDEX) {
      if (lower.includes(alias) || alias.includes(lower)) return "NAME_SUBSTRING";
    }
  }

  return "NO_MATCH";
}

/**
 * Register a runtime diagnosis_id → profile mapping.
 * Used when database IDs become known during pipeline execution.
 */
export function registerCanonicalProfile(
  diagnosis_id: string,
  profile: CanonicalDiseaseProfile,
): void {
  CANONICAL_PROFILES[diagnosis_id] = profile;
}
