/**
 * Authority Layer — V4
 *
 * FINAL DECISION MAKER.
 * Combines V3 output + Cognitive signals + Confidence + Safety.
 *
 * REPLACES ALL OLD:
 * - score fusion
 * - systemic override
 * - shadow engines
 *
 * Output → SSAL (freeze) → no further mutation.
 */

import type {
  AuthorityOutput,
  AuthorityDiagnosis,
  SafetyOutput,
  ConfidenceOutput,
  CognitiveSignals,
  CompletenessOutput,
} from "../pipeline/types";

interface V3Diagnosis {
  diagnosis_id: string;
  diagnosis_name: string;
  probability: number;
  rank: number;
  source?: string;
}

/**
 * Resolve the final diagnostic ranking.
 *
 * Priority order:
 * 1. Safety-promoted must-not-miss conditions
 * 2. V3 scored output (untouched logic)
 * 3. Confidence-adjusted ordering
 * 4. Cognitive expansions (additive only, never override)
 */
export function resolveAuthority(params: {
  v3Diagnoses: V3Diagnosis[];
  safety: SafetyOutput;
  confidence: ConfidenceOutput;
  cognitive: CognitiveSignals;
  completeness: CompletenessOutput;
}): AuthorityOutput {
  const trace: string[] = [];
  const ranked: AuthorityDiagnosis[] = [];

  // Step 1: Start with V3 ranked output (PRESERVED — no modification)
  for (const dx of params.v3Diagnoses) {
    ranked.push({
      diagnosis_id: dx.diagnosis_id,
      diagnosis_name: dx.diagnosis_name,
      rank: dx.rank,
      final_probability: dx.probability,
      v3_probability: dx.probability,
      confidence_adjusted: false,
      safety_promoted: false,
      source: dx.source || "v3_engine",
    });
  }
  trace.push(`V3 output loaded: ${ranked.length} diagnoses`);

  // Step 2: Safety promotion — must-not-miss conditions
  if (params.safety.escalation_required) {
    for (const alert of params.safety.safety_alerts) {
      if (alert.severity === "critical") {
        const existing = ranked.find(d =>
          d.diagnosis_name.toLowerCase().includes(alert.condition.toLowerCase())
        );
        if (existing && existing.rank > 3) {
          trace.push(`SAFETY PROMOTION: ${existing.diagnosis_name} promoted from rank ${existing.rank}`);
          existing.safety_promoted = true;
          existing.rank = Math.min(existing.rank, 3);
        }
      }
    }
  }

  // Step 3: Confidence adjustment — flag low-confidence top diagnoses
  if (params.confidence.overall_confidence < 0.45 && ranked.length > 0) {
    for (const dx of ranked) {
      if (dx.rank <= 3) {
        dx.confidence_adjusted = true;
        trace.push(`LOW CONFIDENCE FLAG on ${dx.diagnosis_name}: confidence=${params.confidence.overall_confidence}`);
      }
    }
  }

  // Step 4: Re-sort by effective rank
  ranked.sort((a, b) => a.rank - b.rank);

  // Re-assign ranks after sort
  ranked.forEach((dx, i) => { dx.rank = i + 1; });

  trace.push(`Final ranking resolved: ${ranked.length} diagnoses`);
  trace.push(`Resolution method: V3 → Safety → Confidence → Rank`);

  return {
    ranked_diagnoses: ranked,
    primary_diagnosis: ranked.length > 0 ? ranked[0] : null,
    resolution_method: "v3_safety_confidence",
    authority_trace: trace,
  };
}

/**
 * Freeze the authority output into an immutable SSAL object.
 * NO MUTATION BEYOND THIS POINT.
 */
export function freezeToSSAL(authority: AuthorityOutput): {
  readonly diagnoses: ReadonlyArray<AuthorityDiagnosis>;
  readonly primary: AuthorityDiagnosis | null;
  readonly frozen_at: string;
  readonly pipeline_version: string;
} {
  const frozen = {
    diagnoses: Object.freeze([...authority.ranked_diagnoses]),
    primary: authority.primary_diagnosis ? Object.freeze({ ...authority.primary_diagnosis }) : null,
    frozen_at: new Date().toISOString(),
    pipeline_version: "v4",
  };
  return Object.freeze(frozen);
}
