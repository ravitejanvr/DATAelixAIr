/**
 * PCIE Clinical Intelligence Core — Public API
 *
 * Re-exports the context graph, module registry, core, and executor
 * for clean external consumption.
 */

// Context Graph
export { createEmptyContextGraph } from "./context_graph";
export type {
  UnifiedClinicalContextGraph,
  PatientContextLayer,
  ReasoningLayer,
  DecisionLayer,
  DocumentationLayer,
} from "./context_graph";

// Module Registry
export { MODULE_REGISTRY, buildExecutionPlan, getModule } from "./module_registry";
export type { ModuleId, ModuleDescriptor } from "./module_registry";

// Core
export { PCIECore } from "./core";

// Dependency Executor
export { executeDependencyAware } from "./dependency_executor";
export type {
  ModuleExecutionResult,
  ExecutionReport,
  ModuleExecutor,
} from "./dependency_executor";
