/**
 * Diagnostic Loop Controller — Cognitive Layer
 *
 * Determines whether a second reasoning pass should be triggered
 * based on confidence thresholds and diagnostic uncertainty.
 *
 * This wraps the inline Wave 3.6 logic into a reusable controller
 * with configurable thresholds and learning-informed limits.
 *
 * Constraints:
 *   - Maximum 2 iterations to preserve <5s latency target
 *   - Only triggers when confidence is genuinely low
 *   - Tracks loop outcomes for calibration feedback
 */

// ── Types ──

export interface LoopDecision {
  should_loop: boolean;
  reason: string;
  iteration: number;
  max_iterations: number;
  confidence_gap: number;
  top_probability: number;
  candidates_to_flag: string[];
}

export interface LoopConfig {
  /** Minimum top probability to NOT loop (default: 45) */
  min_top_probability: number;
  /** Minimum gap between #1 and #2 to NOT loop (default: 10) */
  min_probability_gap: number;
  /** Maximum iterations allowed (default: 2) */
  max_iterations: number;
  /** Minimum probability to keep a candidate (default: 8) */
  prune_threshold: number;
}

const DEFAULT_CONFIG: LoopConfig = {
  min_top_probability: 45,
  min_probability_gap: 10,
  max_iterations: 2,
  prune_threshold: 8,
};

// ── Public API ──

/**
 * Evaluate whether a diagnostic loop should be triggered.
 */
export function evaluateLoopCondition(
  candidates: Array<{ diagnosis_name: string; probability: number; must_not_miss?: boolean }>,
  currentIteration = 0,
  config: Partial<LoopConfig> = {},
): LoopDecision {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (candidates.length === 0) {
    return {
      should_loop: false,
      reason: "No candidates available",
      iteration: currentIteration,
      max_iterations: cfg.max_iterations,
      confidence_gap: 0,
      top_probability: 0,
      candidates_to_flag: [],
    };
  }

  if (currentIteration >= cfg.max_iterations) {
    return {
      should_loop: false,
      reason: `Max iterations reached (${cfg.max_iterations})`,
      iteration: currentIteration,
      max_iterations: cfg.max_iterations,
      confidence_gap: 0,
      top_probability: candidates[0]?.probability || 0,
      candidates_to_flag: [],
    };
  }

  const sorted = [...candidates].sort((a, b) => b.probability - a.probability);
  const topProb = sorted[0]?.probability || 0;
  const secondProb = sorted[1]?.probability || 0;
  const gap = topProb - secondProb;

  // Identify low-confidence candidates for flagging only (never removal)
  const toFlag = sorted
    .filter(c => c.probability < cfg.prune_threshold && !c.must_not_miss)
    .map(c => c.diagnosis_name);

  const lowConfidence = topProb < cfg.min_top_probability;
  const narrowGap = gap < cfg.min_probability_gap;
  const shouldLoop = lowConfidence || narrowGap;

  let reason = "Confidence sufficient";
  if (lowConfidence && narrowGap) {
    reason = `Low top probability (${topProb}%) and narrow gap (${gap}%)`;
  } else if (lowConfidence) {
    reason = `Low top probability (${topProb}% < ${cfg.min_top_probability}%)`;
  } else if (narrowGap) {
    reason = `Narrow probability gap (${gap}% < ${cfg.min_probability_gap}%)`;
  }

  return {
    should_loop: shouldLoop,
    reason,
    iteration: currentIteration,
    max_iterations: cfg.max_iterations,
    confidence_gap: gap,
    top_probability: topProb,
    candidates_to_flag: toFlag,
  };
}

/**
 * Prune weak candidates from the DDX list.
 * HIGH-RECALL MODE: No candidates are removed. All are kept and sorted by probability.
 * This function now only partitions candidates into "strong" and "weak" for informational purposes.
 */
export function pruneCandidates<T extends { diagnosis_name: string; probability: number; must_not_miss?: boolean }>(
  candidates: T[],
  threshold = DEFAULT_CONFIG.prune_threshold,
): { kept: T[]; pruned: T[] } {
  // HIGH-RECALL: All candidates are kept — none are removed
  return { kept: [...candidates], pruned: [] };
}
