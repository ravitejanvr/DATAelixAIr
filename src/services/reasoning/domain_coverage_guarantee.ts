/**
 * Domain Coverage Guarantee — Ensures minimum diagnostic breadth
 *
 * Pipeline position:
 *   ... → WeakSignalActivation → 🆕 domainCoverageGuarantee() → FallbackV2 → DDX
 *
 * Ensures that every major clinical domain has at least 1 representative
 * in the candidate set before ranking. This prevents systematic blind spots
 * where entire disease categories are absent.
 *
 * Invariants:
 *   - Pure function (no side effects beyond logging)
 *   - Only injects domain representatives NOT already present
 *   - All injected candidates get low confidence (0.05–0.15)
 *   - Never removes existing candidates
 *   - Maximum 10 domain-fill injections per case
 */

import type { CandidateHint } from "@/services/context_candidate_expander";

// ── Types ──

export interface DomainRepresentative {
  domain: string;
  diagnosis_name: string;
  confidence: number;
  must_not_miss: boolean;
}

export interface DomainCoverageResult {
  candidates: CandidateHint[];
  domains_filled: string[];
  domains_already_covered: string[];
  injected_count: number;
}

// ── Clinical Domains & Representatives ──

const CLINICAL_DOMAINS: Record<string, DomainRepresentative[]> = {
  infectious: [
    { domain: "infectious", diagnosis_name: "Pneumonia", confidence: 0.1, must_not_miss: false },
    { domain: "infectious", diagnosis_name: "Urinary Tract Infection", confidence: 0.08, must_not_miss: false },
    { domain: "infectious", diagnosis_name: "Sepsis", confidence: 0.08, must_not_miss: true },
  ],
  cardiac: [
    { domain: "cardiac", diagnosis_name: "Acute Coronary Syndrome", confidence: 0.1, must_not_miss: true },
    { domain: "cardiac", diagnosis_name: "Heart Failure", confidence: 0.08, must_not_miss: false },
    { domain: "cardiac", diagnosis_name: "Atrial Fibrillation", confidence: 0.08, must_not_miss: false },
  ],
  respiratory: [
    { domain: "respiratory", diagnosis_name: "Pulmonary Embolism", confidence: 0.1, must_not_miss: true },
    { domain: "respiratory", diagnosis_name: "Pneumonia", confidence: 0.1, must_not_miss: false },
    { domain: "respiratory", diagnosis_name: "COPD Exacerbation", confidence: 0.07, must_not_miss: false },
  ],
  neurological: [
    { domain: "neurological", diagnosis_name: "Stroke", confidence: 0.1, must_not_miss: true },
    { domain: "neurological", diagnosis_name: "Meningitis", confidence: 0.08, must_not_miss: true },
  ],
  autoimmune: [
    { domain: "autoimmune", diagnosis_name: "SLE", confidence: 0.07, must_not_miss: false },
    { domain: "autoimmune", diagnosis_name: "Rheumatoid Arthritis", confidence: 0.06, must_not_miss: false },
  ],
  malignancy: [
    { domain: "malignancy", diagnosis_name: "Lymphoma", confidence: 0.07, must_not_miss: false },
    { domain: "malignancy", diagnosis_name: "Lung Cancer", confidence: 0.06, must_not_miss: false },
  ],
  metabolic: [
    { domain: "metabolic", diagnosis_name: "Acute Kidney Injury", confidence: 0.08, must_not_miss: false },
    { domain: "metabolic", diagnosis_name: "Diabetic Ketoacidosis", confidence: 0.08, must_not_miss: true },
    { domain: "metabolic", diagnosis_name: "Hyperthyroidism", confidence: 0.06, must_not_miss: false },
  ],
  gastrointestinal: [
    { domain: "gastrointestinal", diagnosis_name: "Appendicitis", confidence: 0.08, must_not_miss: true },
    { domain: "gastrointestinal", diagnosis_name: "Cholecystitis", confidence: 0.07, must_not_miss: false },
  ],
  musculoskeletal: [
    { domain: "musculoskeletal", diagnosis_name: "Spinal Stenosis", confidence: 0.06, must_not_miss: false },
    { domain: "musculoskeletal", diagnosis_name: "Septic Arthritis", confidence: 0.08, must_not_miss: true },
  ],
  psychiatric: [
    { domain: "psychiatric", diagnosis_name: "Panic Disorder", confidence: 0.06, must_not_miss: false },
    { domain: "psychiatric", diagnosis_name: "Somatization Disorder", confidence: 0.05, must_not_miss: false },
  ],
};

// Map diagnosis names to their broad domain for existing candidate classification
const DIAGNOSIS_TO_DOMAIN: Record<string, string> = {};
for (const [domain, reps] of Object.entries(CLINICAL_DOMAINS)) {
  for (const rep of reps) {
    DIAGNOSIS_TO_DOMAIN[rep.diagnosis_name.toLowerCase()] = domain;
  }
}

// Additional mappings for diagnoses not in the domain representatives
const CATEGORY_TO_DOMAIN: Record<string, string> = {
  cardiovascular: "cardiac",
  respiratory: "respiratory",
  neurological: "neurological",
  gastrointestinal: "gastrointestinal",
  infectious: "infectious",
  endocrine: "metabolic",
  renal: "metabolic",
  oncological: "malignancy",
  immunological: "autoimmune",
  rheumatological: "autoimmune",
  musculoskeletal: "musculoskeletal",
  psychiatric: "psychiatric",
  dermatological: "autoimmune",
  surgical: "gastrointestinal",
  urological: "metabolic",
  vascular: "cardiac",
  obstetric: "gastrointestinal",
  toxicological: "metabolic",
  hepatological: "gastrointestinal",
};

const MAX_DOMAIN_INJECTIONS = 10;
const MIN_CANDIDATES_BEFORE_FILL = 15;

/**
 * Ensure broad clinical domain coverage in the candidate set.
 *
 * For each major domain not already represented, inject 1 representative
 * diagnosis at low confidence. This guarantees the ranker has visibility
 * into all major disease categories.
 */
export function domainCoverageGuarantee(
  candidates: CandidateHint[],
): DomainCoverageResult {
  // Build set of existing diagnosis names
  const existingNames = new Set(
    candidates.map(c => c.diagnosis_name.toLowerCase().trim())
  );

  // Determine which domains are already covered
  const coveredDomains = new Set<string>();
  for (const c of candidates) {
    const name = c.diagnosis_name.toLowerCase().trim();
    // Check direct mapping
    if (DIAGNOSIS_TO_DOMAIN[name]) {
      coveredDomains.add(DIAGNOSIS_TO_DOMAIN[name]);
    }
    // Check source/category-based mapping
    if (c.source && CATEGORY_TO_DOMAIN[c.source]) {
      coveredDomains.add(CATEGORY_TO_DOMAIN[c.source]);
    }
  }

  const domainsFilled: string[] = [];
  const domainsAlreadyCovered = [...coveredDomains];
  const injected: CandidateHint[] = [];

  // Only fill domains if candidate count is below minimum
  const shouldFillAll = candidates.length < MIN_CANDIDATES_BEFORE_FILL;

  for (const [domain, representatives] of Object.entries(CLINICAL_DOMAINS)) {
    if (injected.length >= MAX_DOMAIN_INJECTIONS) break;
    if (coveredDomains.has(domain) && !shouldFillAll) continue;

    // Find first representative not already in set
    for (const rep of representatives) {
      if (injected.length >= MAX_DOMAIN_INJECTIONS) break;
      const nameKey = rep.diagnosis_name.toLowerCase().trim();
      if (existingNames.has(nameKey)) continue;

      injected.push({
        diagnosis_name: rep.diagnosis_name,
        source: "context_signal",
        confidence: rep.confidence,
        reasoning: `DomainCoverage[${domain}]: ensuring ${domain} domain representation`,
      });

      existingNames.add(nameKey);
      if (!coveredDomains.has(domain)) {
        domainsFilled.push(domain);
        coveredDomains.add(domain);
      }
      break; // One per domain is sufficient
    }
  }

  const result = [...candidates, ...injected];

  if (injected.length > 0) {
    console.log(
      `[DomainCoverage] Injected ${injected.length} domain representatives. ` +
      `Filled: [${domainsFilled.join(", ")}]. ` +
      `Already covered: [${domainsAlreadyCovered.join(", ")}]. ` +
      `Total candidates: ${result.length}`
    );
  }

  return {
    candidates: result,
    domains_filled: domainsFilled,
    domains_already_covered: domainsAlreadyCovered,
    injected_count: injected.length,
  };
}
