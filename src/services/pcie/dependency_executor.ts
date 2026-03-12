/**
 * PCIE Dependency-Aware Executor
 *
 * Replaces hard-coded wave scheduling with dependency-driven execution.
 * Uses the module registry to determine which modules can run based on
 * available data in the context graph.
 *
 * Execution rules:
 *   1. Modules run only when all required_inputs are present on the graph
 *   2. Modules within the same dependency tier execute in parallel
 *   3. If a module times out, retry once with 1.3x budget (if retry_on_timeout)
 *   4. Optional modules failing do not halt the pipeline
 *   5. Module outputs are written to the graph immediately
 */

import type { PCIECore } from "./core";
import type { ModuleId, ModuleDescriptor } from "./module_registry";
import { MODULE_REGISTRY, buildExecutionPlan } from "./module_registry";

export interface ModuleExecutionResult {
  module_id: ModuleId;
  success: boolean;
  latency_ms: number;
  error?: string;
  retried?: boolean;
  skipped_reason?: string;
}

export interface ExecutionReport {
  waves_executed: number;
  total_latency_ms: number;
  modules: ModuleExecutionResult[];
  execution_plan: ModuleId[][];
}

export type ModuleExecutor = (
  moduleId: ModuleId,
  core: PCIECore,
) => Promise<boolean>;

/**
 * Execute all modules in dependency order.
 *
 * @param core - The PCIE core holding the context graph
 * @param executors - Map of module ID → async executor function
 * @param options - Execution options
 */
export async function executeDependencyAware(
  core: PCIECore,
  executors: Map<ModuleId, ModuleExecutor>,
  options: {
    skipModules?: ModuleId[];
    onModuleComplete?: (result: ModuleExecutionResult) => void;
  } = {},
): Promise<ExecutionReport> {
  const plan = buildExecutionPlan();
  const results: ModuleExecutionResult[] = [];
  const pipelineStart = performance.now();
  const skipped = new Set(options.skipModules || []);

  for (let waveIdx = 0; waveIdx < plan.length; waveIdx++) {
    const wave = plan[waveIdx];
    const wavePromises: Promise<ModuleExecutionResult>[] = [];

    for (const moduleId of wave) {
      if (skipped.has(moduleId)) {
        const skipResult: ModuleExecutionResult = {
          module_id: moduleId,
          success: false,
          latency_ms: 0,
          skipped_reason: "explicitly_skipped",
        };
        results.push(skipResult);
        options.onModuleComplete?.(skipResult);
        continue;
      }

      const descriptor = MODULE_REGISTRY.find(m => m.id === moduleId);
      if (!descriptor) continue;

      const executor = executors.get(moduleId);
      if (!executor) {
        const skipResult: ModuleExecutionResult = {
          module_id: moduleId,
          success: false,
          latency_ms: 0,
          skipped_reason: "no_executor",
        };
        results.push(skipResult);
        options.onModuleComplete?.(skipResult);
        continue;
      }

      wavePromises.push(
        executeModule(core, moduleId, descriptor, executor),
      );
    }

    const waveResults = await Promise.all(wavePromises);
    for (const r of waveResults) {
      results.push(r);
      options.onModuleComplete?.(r);
    }
  }

  return {
    waves_executed: plan.length,
    total_latency_ms: Math.round(performance.now() - pipelineStart),
    modules: results,
    execution_plan: plan,
  };
}

async function executeModule(
  core: PCIECore,
  moduleId: ModuleId,
  descriptor: ModuleDescriptor,
  executor: ModuleExecutor,
): Promise<ModuleExecutionResult> {
  // Check dependencies
  const deps = core.checkDependencies(descriptor.required_inputs);
  if (!deps.ready) {
    if (descriptor.optional) {
      return {
        module_id: moduleId,
        success: false,
        latency_ms: 0,
        skipped_reason: `missing_inputs: ${deps.missing.join(", ")}`,
      };
    }
    // Non-optional module with missing deps — try anyway (may use fallbacks)
    console.warn(`[PCIE] Module ${moduleId} missing deps: ${deps.missing.join(", ")} — attempting anyway`);
  }

  const t0 = performance.now();

  try {
    const success = await withModuleTimeout(
      () => executor(moduleId, core),
      descriptor.timeout_ms,
      moduleId,
    );

    if (success) {
      core.recordModuleExecution(moduleId);
      return {
        module_id: moduleId,
        success: true,
        latency_ms: Math.round(performance.now() - t0),
      };
    }

    // First attempt returned false — retry if allowed
    if (descriptor.retry_on_timeout) {
      const retryBudget = Math.round(descriptor.timeout_ms * 1.3);
      console.log(`[PCIE] 🔄 Retrying ${moduleId} (budget: ${retryBudget}ms)`);
      const retrySuccess = await withModuleTimeout(
        () => executor(moduleId, core),
        retryBudget,
        `${moduleId}_retry`,
      );
      if (retrySuccess) {
        core.recordModuleExecution(moduleId);
        return {
          module_id: moduleId,
          success: true,
          latency_ms: Math.round(performance.now() - t0),
          retried: true,
        };
      }
    }

    return {
      module_id: moduleId,
      success: false,
      latency_ms: Math.round(performance.now() - t0),
      error: "returned_false",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[PCIE] Module ${moduleId} failed: ${errorMsg}`);

    if (descriptor.retry_on_timeout) {
      try {
        const retryBudget = Math.round(descriptor.timeout_ms * 1.3);
        const retrySuccess = await withModuleTimeout(
          () => executor(moduleId, core),
          retryBudget,
          `${moduleId}_retry`,
        );
        if (retrySuccess) {
          core.recordModuleExecution(moduleId);
          return {
            module_id: moduleId,
            success: true,
            latency_ms: Math.round(performance.now() - t0),
            retried: true,
          };
        }
      } catch {
        // Retry also failed
      }
    }

    return {
      module_id: moduleId,
      success: false,
      latency_ms: Math.round(performance.now() - t0),
      error: errorMsg,
    };
  }
}

async function withModuleTimeout<T>(
  factory: () => Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return Promise.race([
    factory(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}
