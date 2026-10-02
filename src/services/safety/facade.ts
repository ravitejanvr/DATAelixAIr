/**
 * Safety Facade — Architecture Freeze v1.0, Contract #6
 *
 * The SINGLE import surface for all safety-relevant capabilities.
 * Downstream code (O1 Trust Layer, UI safety panels, guardrail checks,
 * oversight aggregation) should import from `@/services/safety` — never
 * from `guardrail_engine` or `oversight_engine` directly.
 *
 * Historically three modules coexisted:
 *   - safety/            — synchronous rule engine on canonical features
 *   - guardrail_engine/  — pre-finalization edge-function guardrails
 *   - oversight_engine/  — event bus + safety score aggregation
 *
 * Under the freeze they are unified into ONE facade. The individual
 * client files remain in-tree as `@deprecated` shims for legacy imports
 * only; new call sites MUST use this facade.
 *
 * See: architecture/ARCHITECTURE_FREEZE_v1.md §3
 *      .lovable/execution-backlog-v1.md A3
 */

// ── Must-not-miss escalation — the single detection path (ROADMAP 9/10) ──
export {
  evaluateMustNotMiss,
  MNM_RULESET_VERSION,
  type MnmInput,
  type MnmResult,
  type MnmTrigger,
} from "../../../supabase/functions/_shared/must_not_miss.ts";

// ── Rule-based safety analysis (L7 Trust Layer) — adapter over the above ──
export { analyzeSafety } from "./index";

// ── Edge-function guardrails (pre-finalization) ──
export {
  runClinicalGuardrails,
  type GuardrailAlert,
  type GuardrailResult,
} from "../guardrail_engine/client";

// ── Oversight event bus + safety score aggregation ──
export {
  recordOversightEvent,
  generateOversightReport,
  clearOversightEvents,
  type OversightEvent,
  type OversightReport,
} from "../oversight_engine";
