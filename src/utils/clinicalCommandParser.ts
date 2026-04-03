/**
 * Clinical Command Parser
 *
 * SAFE parser that ONLY allows structured lab/investigation inputs.
 * Rejects all unknown or free-text inputs.
 * Deterministic, pure function — no side effects.
 */

import type { InvestigationResults } from "@/lib/clinical-context";

// ── Allowed lab key mappings ──

const LAB_MAP: Record<string, keyof InvestigationResults> = {
  lactate: "lactate",
  troponin: "troponin",
  crp: "CRP",
  "c-reactive protein": "CRP",
  procalcitonin: "procalcitonin",
  pct: "procalcitonin",
  wbc: "WBC",
  "white blood cell": "WBC",
  "d-dimer": "D_dimer",
  ddimer: "D_dimer",
  dimer: "D_dimer",
  creatinine: "creatinine",
  bnp: "BNP",
};

// ── Value guardrails per lab ──

const LAB_RANGES: Record<keyof InvestigationResults, { min: number; max: number }> = {
  lactate: { min: 0, max: 30 },
  troponin: { min: 0, max: 100 },
  CRP: { min: 0, max: 500 },
  procalcitonin: { min: 0, max: 200 },
  WBC: { min: 0, max: 100 },
  D_dimer: { min: 0, max: 50000 },
  creatinine: { min: 0, max: 30 },
  BNP: { min: 0, max: 50000 },
};

export interface ParsedLabCommand {
  type: "investigation";
  key: keyof InvestigationResults;
  value: number;
  displayKey: string;
}

/**
 * Parse a clinical command string into a structured lab result.
 * Returns null if the input doesn't match a known lab format.
 *
 * Accepted formats:
 *   "lactate 5"
 *   "lactate: 5"
 *   "lactate = 5"
 *   "crp 120"
 *   "d-dimer 3000"
 */
export function parseClinicalCommand(input: string): ParsedLabCommand | null {
  const clean = input.toLowerCase().trim();

  // Match: key (with optional hyphen/space) followed by separator and numeric value
  const match = clean.match(/^([a-z][a-z\s-]*[a-z])\s*[:=]?\s*([\d.]+)$/);
  if (!match) return null;

  const [, rawKey, rawValue] = match;
  const normalizedKey = rawKey.trim();
  const mappedKey = LAB_MAP[normalizedKey];
  if (!mappedKey) return null;

  const value = parseFloat(rawValue);
  if (isNaN(value)) return null;

  // Guardrails: reject out-of-range values
  const range = LAB_RANGES[mappedKey];
  if (range && (value < range.min || value > range.max)) return null;

  return {
    type: "investigation",
    key: mappedKey,
    value,
    displayKey: normalizedKey,
  };
}

/**
 * Format lab key for display.
 */
export function formatLabKey(key: keyof InvestigationResults): string {
  const displayNames: Record<keyof InvestigationResults, string> = {
    lactate: "Lactate",
    troponin: "Troponin",
    CRP: "CRP",
    procalcitonin: "Procalcitonin",
    WBC: "WBC",
    D_dimer: "D-dimer",
    creatinine: "Creatinine",
    BNP: "BNP",
  };
  return displayNames[key] || key;
}

/**
 * Format lab value with appropriate units.
 */
export function formatLabValue(key: keyof InvestigationResults, value: number): string {
  const units: Record<keyof InvestigationResults, string> = {
    lactate: "mmol/L",
    troponin: "ng/mL",
    CRP: "mg/L",
    procalcitonin: "ng/mL",
    WBC: "×10³/μL",
    D_dimer: "ng/mL",
    creatinine: "mg/dL",
    BNP: "pg/mL",
  };
  return `${value} ${units[key] || ""}`;
}
