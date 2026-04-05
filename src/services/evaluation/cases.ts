/**
 * Evaluation test cases for V2 probabilistic engine validation.
 * Aggregates all category files into a single export.
 */

export interface EvalCase {
  id: string;
  name: string;
  category: "core" | "ambiguous" | "missing_data" | "noisy" | "adversarial";
  expected_top1: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  input: {
    symptoms: string[];
    vitals?: Record<string, string | number>;
    lab_results?: Record<string, number>;
    risk_factors?: string[];
    medical_history?: string[];
    age?: number;
    sex?: string;
  };
}

import { CORE_CASES } from "./cases_core";
import { AMBIGUOUS_CASES } from "./cases_ambiguous";
import { MISSING_DATA_CASES } from "./cases_missing";
import { NOISY_CASES } from "./cases_noisy";
import { ADVERSARIAL_CASES } from "./cases_adversarial";

export const EVAL_CASES: EvalCase[] = [
  ...CORE_CASES,
  ...AMBIGUOUS_CASES,
  ...MISSING_DATA_CASES,
  ...NOISY_CASES,
  ...ADVERSARIAL_CASES,
];
