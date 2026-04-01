/**
 * Scoring Utilities — Reusable math primitives for clinical reasoning
 *
 * Pure functions. No side effects. No external dependencies.
 */

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Normalize a value from [inMin, inMax] → [0, 1] */
export function normalize(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 0.5;
  return clamp((value - inMin) / (inMax - inMin), 0, 1);
}

/** Apply exponential decay: weight * decay^depth */
export function decayWeight(weight: number, decay: number, depth: number): number {
  return weight * Math.pow(decay, depth);
}

/** Weighted geometric mean of factors (all > 0) */
export function geometricMean(factors: number[]): number {
  if (factors.length === 0) return 0;
  const product = factors.reduce((acc, f) => acc * Math.max(f, 0.001), 1);
  return Math.pow(product, 1 / factors.length);
}

/** Softmax normalization of scores → probabilities */
export function softmax(scores: number[], temperature = 1.0): number[] {
  if (scores.length === 0) return [];
  const t = Math.max(temperature, 0.01);
  const maxScore = Math.max(...scores);
  const exps = scores.map(s => Math.exp((s - maxScore) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

/** Cap array to max length, preserving order */
export function capArray<T>(arr: T[], maxLen: number): T[] {
  return arr.slice(0, maxLen);
}

/** Round to N decimal places */
export function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

/** Compute Jaccard similarity between two string sets */
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Partial overlap score: |intersection| / |smaller set| */
export function partialOverlap(a: string[], b: string[]): number {
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const minSize = Math.min(setA.size, setB.size);
  return minSize === 0 ? 0 : intersection / minSize;
}
