/**
 * PCIE — Context Confidence Scoring Module
 * 
 * Computes a 0.0–1.0 confidence score reflecting
 * how complete and consistent the clinical context is.
 */

export interface ConfidenceBreakdown {
  score: number;
  factors: {
    name: string;
    weight: number;
    value: number;
    detail: string;
  }[];
}

interface ConfidenceInput {
  chief_complaint: string;
  symptoms: string[];
  duration: string;
  severity: string;
  vitals: Record<string, unknown> | null;
  allergies: string[];
  medications: string[];
  patient_age: number | null;
  patient_sex: string | null;
  lab_results: unknown[];
  input_sources: string[];
  risk_flags: unknown[];
}

/**
 * Compute context confidence score.
 */
export function computeContextConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const factors: ConfidenceBreakdown["factors"] = [];

  // 1. Chief complaint present (weight: 0.25)
  const ccPresent = input.chief_complaint.trim().length > 0;
  factors.push({
    name: "chief_complaint",
    weight: 0.25,
    value: ccPresent ? 1.0 : 0.0,
    detail: ccPresent ? "Chief complaint provided" : "Missing chief complaint",
  });

  // 2. Demographics (weight: 0.15)
  let demoScore = 0;
  if (input.patient_age != null) demoScore += 0.5;
  if (input.patient_sex) demoScore += 0.5;
  factors.push({
    name: "demographics",
    weight: 0.15,
    value: demoScore,
    detail: `Age: ${input.patient_age != null ? "✓" : "✗"}, Sex: ${input.patient_sex ? "✓" : "✗"}`,
  });

  // 3. Symptom detail (weight: 0.20)
  const symptomCount = input.symptoms.length;
  const symptomScore = Math.min(symptomCount / 3, 1.0); // 3+ symptoms = full score
  const durationBonus = input.duration ? 0.1 : 0;
  const severityBonus = input.severity !== "unknown" ? 0.1 : 0;
  factors.push({
    name: "symptom_detail",
    weight: 0.20,
    value: Math.min(symptomScore + durationBonus + severityBonus, 1.0),
    detail: `${symptomCount} symptoms, duration: ${input.duration || "unknown"}, severity: ${input.severity}`,
  });

  // 4. Vitals present (weight: 0.15)
  const vitalKeys = input.vitals ? Object.values(input.vitals).filter(v => v != null).length : 0;
  const vitalScore = Math.min(vitalKeys / 4, 1.0); // 4+ vitals = full score
  factors.push({
    name: "vitals",
    weight: 0.15,
    value: vitalScore,
    detail: `${vitalKeys} vital measurements recorded`,
  });

  // 5. Medication & allergy documentation (weight: 0.10)
  let medAllergyScore = 0;
  if (input.medications.length > 0) medAllergyScore += 0.5;
  if (input.allergies.length > 0) medAllergyScore += 0.5;
  // If explicitly "NKDA" or similar, that's also complete
  factors.push({
    name: "med_allergy",
    weight: 0.10,
    value: medAllergyScore,
    detail: `Medications: ${input.medications.length}, Allergies: ${input.allergies.length}`,
  });

  // 6. Multiple input sources (weight: 0.10)
  const sourceScore = Math.min(input.input_sources.length / 2, 1.0);
  factors.push({
    name: "source_diversity",
    weight: 0.10,
    value: sourceScore,
    detail: `${input.input_sources.length} input source(s)`,
  });

  // 7. Lab results (weight: 0.05)
  const labScore = input.lab_results.length > 0 ? 1.0 : 0.0;
  factors.push({
    name: "lab_results",
    weight: 0.05,
    value: labScore,
    detail: `${input.lab_results.length} lab result(s)`,
  });

  // Compute weighted sum
  const score = factors.reduce((sum, f) => sum + f.weight * f.value, 0);

  return {
    score: Math.round(score * 100) / 100,
    factors,
  };
}

/**
 * Get human-readable confidence label.
 */
export function getConfidenceLabel(score: number): string {
  if (score >= 0.85) return "High Confidence";
  if (score >= 0.65) return "Moderate Confidence";
  if (score >= 0.45) return "Low Confidence";
  return "Insufficient Context";
}
