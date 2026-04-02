/**
 * Temporal Reasoning Engine
 *
 * Evaluates temporal consistency between patient presentation and candidate diagnoses.
 * Pure function — no side effects, no external calls.
 *
 * Scores:
 *   1.0 = perfect temporal match
 *   0.5 = neutral / insufficient data
 *   < 0.5 = temporal mismatch (penalty)
 */

import { clamp } from "./scoring_utils";

export interface TemporalInput {
  onset_pattern?: string | null;     // "sudden", "gradual", "intermittent"
  duration?: string | null;          // "2 hours", "3 days", "2 weeks"
  severity?: string | null;          // "mild", "moderate", "severe"
  symptoms: string[];
}

export interface TemporalProfile {
  expected_onset: "sudden" | "gradual" | "variable";
  expected_duration: "hours" | "days" | "weeks" | "chronic";
  expected_severity: "mild" | "moderate" | "severe" | "variable";
}

export interface TemporalResult {
  score: number;
  onset_match: boolean;
  duration_match: boolean;
  severity_match: boolean;
  explanation: string;
}

// ── Known temporal profiles for common conditions ──

const TEMPORAL_PROFILES: Record<string, TemporalProfile> = {
  // Acute emergencies
  "myocardial infarction":        { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "acute coronary syndrome":      { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "pulmonary embolism":           { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "stroke":                       { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "aortic dissection":            { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "pneumothorax":                 { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "anaphylaxis":                  { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "ruptured aaa":                 { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "subarachnoid hemorrhage":      { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  "testicular torsion":           { expected_onset: "sudden",  expected_duration: "hours",   expected_severity: "severe" },
  // Subacute
  "pneumonia":                    { expected_onset: "gradual", expected_duration: "days",    expected_severity: "moderate" },
  "appendicitis":                 { expected_onset: "gradual", expected_duration: "days",    expected_severity: "moderate" },
  "meningitis":                   { expected_onset: "gradual", expected_duration: "days",    expected_severity: "severe" },
  "sepsis":                       { expected_onset: "variable",expected_duration: "days",    expected_severity: "severe" },
  "diabetic ketoacidosis":        { expected_onset: "gradual", expected_duration: "days",    expected_severity: "severe" },
  "cholecystitis":                { expected_onset: "gradual", expected_duration: "days",    expected_severity: "moderate" },
  // Chronic
  "copd exacerbation":            { expected_onset: "gradual", expected_duration: "days",    expected_severity: "moderate" },
  "type 2 diabetes mellitus":     { expected_onset: "gradual", expected_duration: "chronic", expected_severity: "mild" },
  "hypothyroidism":               { expected_onset: "gradual", expected_duration: "chronic", expected_severity: "mild" },
  "chronic mesenteric ischemia":  { expected_onset: "gradual", expected_duration: "weeks",   expected_severity: "moderate" },
};

function parseDurationToCategory(duration: string | null | undefined): "hours" | "days" | "weeks" | "chronic" | null {
  if (!duration) return null;
  const lower = duration.toLowerCase();
  if (/hour|minute|min|hr/.test(lower)) return "hours";
  if (/day|overnight/.test(lower)) return "days";
  if (/week/.test(lower)) return "weeks";
  if (/month|year|chronic|long/.test(lower)) return "chronic";
  // Try numeric extraction
  const numMatch = lower.match(/(\d+)\s*(day|week|month|hour|hr)/);
  if (numMatch) {
    const unit = numMatch[2];
    if (unit.startsWith("hour") || unit.startsWith("hr")) return "hours";
    if (unit.startsWith("day")) return "days";
    if (unit.startsWith("week")) return "weeks";
    if (unit.startsWith("month")) return "chronic";
  }
  return null;
}

function parseOnset(onset: string | null | undefined): "sudden" | "gradual" | "variable" | null {
  if (!onset) return null;
  const lower = onset.toLowerCase();
  if (/sudden|acute|abrupt/.test(lower)) return "sudden";
  if (/gradual|progressive|slow|insidious/.test(lower)) return "gradual";
  if (/intermittent|variable|episodic|fluctuat/.test(lower)) return "variable";
  return null;
}

function parseSeverity(severity: string | null | undefined): "mild" | "moderate" | "severe" | null {
  if (!severity) return null;
  const lower = severity.toLowerCase();
  if (/severe|critical|intense|excruciating/.test(lower)) return "severe";
  if (/moderate|significant/.test(lower)) return "moderate";
  if (/mild|slight|minor/.test(lower)) return "mild";
  return null;
}

/**
 * Evaluate temporal consistency for a single diagnosis.
 */
export function evaluateTemporalConsistency(
  diagnosisName: string,
  input: TemporalInput,
): TemporalResult {
  const profile = TEMPORAL_PROFILES[diagnosisName.toLowerCase().trim()];

  // No profile → neutral (don't penalize unknowns)
  if (!profile) {
    return { score: 0.5, onset_match: true, duration_match: true, severity_match: true, explanation: "No temporal profile available" };
  }

  const patientOnset = parseOnset(input.onset_pattern);
  const patientDuration = parseDurationToCategory(input.duration);
  const patientSeverity = parseSeverity(input.severity);

  let factors = 0;
  let matches = 0;
  let penaltySum = 0;

  // Onset check
  let onsetMatch = true;
  if (patientOnset) {
    factors++;
    if (patientOnset === profile.expected_onset || profile.expected_onset === "variable") {
      matches++;
    } else {
      onsetMatch = false;
      // Sudden vs gradual is a strong mismatch
      penaltySum += (patientOnset === "sudden" && profile.expected_onset === "gradual") ? 0.25 : 0.15;
    }
  }

  // Duration check
  let durationMatch = true;
  if (patientDuration) {
    factors++;
    if (patientDuration === profile.expected_duration) {
      matches++;
    } else {
      durationMatch = false;
      // Major mismatch: hours vs chronic
      const durationOrder = { hours: 0, days: 1, weeks: 2, chronic: 3 };
      const diff = Math.abs(durationOrder[patientDuration] - durationOrder[profile.expected_duration]);
      penaltySum += diff >= 2 ? 0.3 : 0.1;
    }
  }

  // Severity check
  let severityMatch = true;
  if (patientSeverity && profile.expected_severity !== "variable") {
    factors++;
    if (patientSeverity === profile.expected_severity) {
      matches++;
    } else {
      severityMatch = false;
      penaltySum += 0.1;
    }
  }

  // Compute score
  let score: number;
  if (factors === 0) {
    score = 0.5; // No data → neutral
  } else {
    const matchRatio = matches / factors;
    score = clamp(0.5 + (matchRatio * 0.5) - penaltySum, 0.1, 1.0);
  }

  const explanation = factors === 0
    ? "Insufficient temporal data"
    : `Temporal: ${matches}/${factors} match (onset=${onsetMatch}, duration=${durationMatch}, severity=${severityMatch})`;

  return { score, onset_match: onsetMatch, duration_match: durationMatch, severity_match: severityMatch, explanation };
}
