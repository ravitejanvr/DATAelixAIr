/**
 * Pipeline Stage Logger
 * 
 * Structured logging for each pipeline stage execution.
 * Captures timing, success/failure, and metadata for observability.
 */

export interface PipelineLog {
  stage: string;
  status: "started" | "completed" | "failed" | "skipped";
  duration_ms?: number;
  metadata?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

const logs: PipelineLog[] = [];

export function logPipelineStage(
  stage: string,
  status: PipelineLog["status"],
  opts?: { duration_ms?: number; metadata?: Record<string, unknown>; error?: string }
): void {
  const entry: PipelineLog = {
    stage,
    status,
    timestamp: new Date().toISOString(),
    ...opts,
  };
  logs.push(entry);
  
  const prefix = status === "failed" ? "❌" : status === "completed" ? "✅" : status === "skipped" ? "⏭️" : "▶️";
  const duration = opts?.duration_ms ? ` (${opts.duration_ms}ms)` : "";
  console.log(`[Pipeline] ${prefix} ${stage} → ${status}${duration}`);
}

export function getPipelineLogs(): readonly PipelineLog[] {
  return logs;
}

export function clearPipelineLogs(): void {
  logs.length = 0;
}

export async function withStageLogging<T>(
  stage: string,
  fn: () => Promise<T>
): Promise<T> {
  logPipelineStage(stage, "started");
  const start = performance.now();
  try {
    const result = await fn();
    logPipelineStage(stage, "completed", { duration_ms: Math.round(performance.now() - start) });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logPipelineStage(stage, "failed", {
      duration_ms: Math.round(performance.now() - start),
      error: message,
    });
    throw err;
  }
}
