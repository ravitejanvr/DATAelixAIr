/**
 * System Execution Mode — Single Source of Truth
 *
 * Tracks the current execution path to guarantee visibility
 * and prevent hidden/silent mode switching.
 *
 * INVARIANT: Every pipeline execution MUST set the mode before running
 * and the UI MUST read from this module to display the current state.
 */

export type ExecutionType = "LIVE_PIPELINE" | "BENCHMARK" | "VALIDATION";
export type ExecutionSource = "pipeline" | "cache" | "fallback" | "benchmark_optimized";

export interface SystemMode {
  type: ExecutionType;
  source: ExecutionSource;
  /** ISO timestamp of last mode change */
  updatedAt: string;
  /** Human-readable label for UI */
  label: string;
}

const DEFAULT_MODE: SystemMode = {
  type: "LIVE_PIPELINE",
  source: "pipeline",
  updatedAt: new Date().toISOString(),
  label: "Live Pipeline",
};

let currentMode: SystemMode = { ...DEFAULT_MODE };
const listeners: Set<(mode: SystemMode) => void> = new Set();

/** Get current system execution mode (read-only snapshot). */
export function getSystemMode(): Readonly<SystemMode> {
  return currentMode;
}

/** Set system execution mode. Logs transition and notifies subscribers. */
export function setSystemMode(type: ExecutionType, source: ExecutionSource): void {
  const label =
    type === "LIVE_PIPELINE" && source === "pipeline"
      ? "Live Pipeline"
      : type === "LIVE_PIPELINE" && source === "fallback"
        ? "Live Pipeline (Fallback)"
        : type === "BENCHMARK" && source === "benchmark_optimized"
          ? "Benchmark Mode"
          : type === "BENCHMARK" && source === "pipeline"
            ? "Benchmark (Full Pipeline)"
            : type === "VALIDATION"
              ? "Validation Suite"
              : `${type} / ${source}`;

  const prev = currentMode;
  currentMode = {
    type,
    source,
    updatedAt: new Date().toISOString(),
    label,
  };

  console.log(
    `[SYSTEM_MODE] ${prev.type}/${prev.source} → ${type}/${source} (${label})`,
  );

  listeners.forEach((fn) => {
    try { fn(currentMode); } catch { /* non-blocking */ }
  });
}

/** Subscribe to mode changes. Returns unsubscribe function. */
export function onSystemModeChange(fn: (mode: SystemMode) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reset to default LIVE_PIPELINE mode. */
export function resetSystemMode(): void {
  setSystemMode("LIVE_PIPELINE", "pipeline");
}
