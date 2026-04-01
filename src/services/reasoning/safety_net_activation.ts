/**
 * Phase 6.6 — SafetyNetActivation Layer
 *
 * Clinical safety layer ensuring minimum diagnostic domain coverage
 * when explicit signals are weak or missing.
 *
 * Pipeline position (MANDATORY):
 *   mergeActivations() → safetyNetActivation() → expandKGDeep()
 *
 * Invariants:
 *   - Only activates TIER 1 critical domains (respiratory, cardiac, abdominal)
 *   - Weight = 0.2 (never dominates ranking)
 *   - Max 4 safetynet activations per run
 *   - Context-aware: only fires when clinical uncertainty is high
 *   - Does NOT mutate input activation (returns new object)
 *   - Does NOT override existing strong/weak activations
 */

import type { KGActivation } from "@/services/kg/kg_activation";
import { createEmptyActivation, activateNode, mergeActivations } from "@/services/kg/kg_activation";
import type { ClinicalContext } from "@/lib/clinical-context";
import { isPhase6SafetyNetEnabled } from "@/services/feature_flags";

// ── Constants ──

const SAFETYNET_WEIGHT = 0.2;
const MAX_SAFETYNET_ACTIVATIONS = 4;
const MAX_TOTAL_ACTIVATIONS_BEFORE_SKIP = 12;

/** Tier 1 domains — the ONLY domains eligible for safetynet */
const TIER1_DOMAINS = ["respiratory", "cardiac", "abdominal"] as const;
type Tier1Domain = typeof TIER1_DOMAINS[number];

/** Maps each Tier 1 domain to its primary KG cluster ID */
const DOMAIN_TO_CLUSTER: Record<Tier1Domain, string> = {
  respiratory: "respiratory",
  cardiac: "atypical_cardiac",
  abdominal: "abdominal",
};

/** Maps cluster IDs back to their domain for domain detection */
const CLUSTER_TO_DOMAIN: Record<string, Tier1Domain> = {
  respiratory: "respiratory",
  atypical_cardiac: "cardiac",
  cardiac_common: "cardiac",
  abdominal: "abdominal",
  gi_functional: "abdominal",
};

// ── Types ──

export type ActivationMode = "strong" | "weak" | "safetynet";

export interface SafetyNetResult {
  /** Merged activation (original + safetynet) */
  activation: KGActivation;
  /** Domains that were activated by safetynet */
  activated_domains: string[];
  /** Total safetynet activations added */
  safetynet_count: number;
  /** Reasons for each activation */
  activation_reasons: Record<string, string>;
  /** Whether safetynet was skipped and why */
  skipped_reason: string | null;
}

// ── Core Function ──

/**
 * Apply SafetyNetActivation to ensure critical domains are explored.
 *
 * ONLY activates missing Tier 1 domains when:
 *   - Presentation is vague or ambiguous
 *   - Multi-system involvement detected
 *   - No high-confidence candidates exist
 *   - Patient age warrants broader coverage (cardiac for >60)
 *
 * Returns a NEW activation object (does not mutate input).
 */
export function safetyNetActivation(
  ctx: ClinicalContext,
  currentActivation: KGActivation,
): SafetyNetResult {
  // Feature flag gate
  if (!isPhase6SafetyNetEnabled()) {
    return {
      activation: currentActivation,
      activated_domains: [],
      safetynet_count: 0,
      activation_reasons: {},
      skipped_reason: "feature_flag_disabled",
    };
  }

  // Guard: don't over-activate if already many clusters active
  if (currentActivation.nodes.size >= MAX_TOTAL_ACTIVATIONS_BEFORE_SKIP) {
    return {
      activation: currentActivation,
      activated_domains: [],
      safetynet_count: 0,
      activation_reasons: {},
      skipped_reason: `already_${currentActivation.nodes.size}_activations`,
    };
  }

  // Detect which Tier 1 domains are already covered
  const activeDomains = new Set<Tier1Domain>();
  for (const nodeId of currentActivation.nodes) {
    const domain = CLUSTER_TO_DOMAIN[nodeId];
    if (domain) activeDomains.add(domain);
  }

  const missingDomains = TIER1_DOMAINS.filter(d => !activeDomains.has(d));
  if (missingDomains.length === 0) {
    return {
      activation: currentActivation,
      activated_domains: [],
      safetynet_count: 0,
      activation_reasons: {},
      skipped_reason: "all_tier1_domains_covered",
    };
  }

  // Build safetynet activations for eligible missing domains
  const safetynetActivation = createEmptyActivation();
  const activatedDomains: string[] = [];
  const activationReasons: Record<string, string> = {};
  let count = 0;

  for (const domain of missingDomains) {
    if (count >= MAX_SAFETYNET_ACTIVATIONS) break;

    const reason = shouldActivateDomain(ctx, domain, currentActivation);
    if (!reason) continue;

    const clusterId = DOMAIN_TO_CLUSTER[domain];
    activateNode(
      safetynetActivation,
      clusterId,
      SAFETYNET_WEIGHT,
      `safetynet_${domain}`,
      "context_expander", // compatible source type
      false, // NOT must-not-miss — safetynet is low priority
    );

    activatedDomains.push(domain);
    activationReasons[domain] = reason;
    count++;

    console.log(
      `[SafetyNet] Activated domain '${domain}' → cluster '${clusterId}' (weight=${SAFETYNET_WEIGHT}, reason=${reason})`
    );
  }

  // Merge: original activations take priority (higher weight wins in mergeActivations)
  const merged = count > 0
    ? mergeActivations(currentActivation, safetynetActivation)
    : currentActivation;

  return {
    activation: merged,
    activated_domains: activatedDomains,
    safetynet_count: count,
    activation_reasons: activationReasons,
    skipped_reason: count === 0 ? "no_domains_met_activation_criteria" : null,
  };
}

// ── Context-Aware Activation Logic ──

/**
 * Determine whether a missing domain should be activated.
 * Returns the reason string if YES, null if NO.
 *
 * Activation criteria (any one sufficient):
 *   1. Vague presentation (≥2 symptoms, no strong signal)
 *   2. Multi-system ambiguity (symptoms span ≥2 systems)
 *   3. Elderly cardiac safety (age >60, cardiac domain missing)
 *   4. Low confidence (no candidate above 0.4 threshold)
 */
function shouldActivateDomain(
  ctx: ClinicalContext,
  domain: Tier1Domain,
  currentActivation: KGActivation,
): string | null {
  const symptoms = ctx.symptoms ?? [];
  const age = ctx.age;

  // 1. Vague presentation: multiple symptoms but weak activation
  if (symptoms.length >= 2 && currentActivation.nodes.size <= 2) {
    return "vague_presentation";
  }

  // 2. Multi-system: symptoms touch different body systems
  const systemKeywords = extractSystemHints(symptoms);
  if (systemKeywords.size >= 2) {
    return "multi_system_ambiguity";
  }

  // 3. Elderly cardiac safety bias
  if (domain === "cardiac" && age != null && age > 60) {
    return "elderly_cardiac_safety";
  }

  // 4. Very few activations overall → broaden search
  if (currentActivation.nodes.size <= 1 && symptoms.length >= 1) {
    return "minimal_activation_coverage";
  }

  return null;
}

// ── Helpers ──

/** Extract broad system hints from symptom strings */
function extractSystemHints(symptoms: string[]): Set<string> {
  const systems = new Set<string>();
  const joined = symptoms.join(" ").toLowerCase();

  const systemMap: Record<string, string[]> = {
    respiratory: ["cough", "breath", "dyspnea", "wheez", "chest", "sputum", "hemoptysis"],
    cardiac: ["palpitat", "chest pain", "syncop", "edema", "orthopnea"],
    abdominal: ["abdom", "nausea", "vomit", "diarr", "pain belly", "epigastr", "bloat"],
    neurological: ["headache", "dizz", "numb", "weakness", "seizure", "confus", "vision"],
    musculoskeletal: ["joint", "back pain", "muscle", "stiff", "swelling"],
  };

  for (const [system, keywords] of Object.entries(systemMap)) {
    if (keywords.some(kw => joined.includes(kw))) {
      systems.add(system);
    }
  }

  return systems;
}
