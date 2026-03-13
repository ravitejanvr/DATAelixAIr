/**
 * Clinical Cognitive Layer — Module Index
 *
 * Wave 6 of the v4.3 pipeline. Runs asynchronously after the core
 * reasoning pipeline to enable adaptive learning and knowledge discovery.
 *
 * Components:
 *   1. Episodic Memory Engine — case-level similarity retrieval
 *   2. Supervised Learning Engine — outcome recording + correction signals
 *   3. Unsupervised Discovery Engine — symptom cluster detection
 *   4. Counterfactual Engine — fragility analysis
 *   5. Evidence Planner — information gain persistence
 *   6. Meta-Learning Engine — performance monitoring + calibration
 *   7. Diagnostic Loop Controller — iterative refinement logic
 */

// Re-export all cognitive engines
export {
  storeEpisodicCase,
  retrieveSimilarCases,
  buildCasePriors,
  type EpisodicCase,
  type StoreCaseInput,
} from "./episodic_memory_engine";

export {
  recordDiagnosticOutcome,
  recordLearningUpdate,
  getCorrectionRate,
  type OutcomeRecord,
  type LearningUpdateRecord,
} from "./supervised_learning_engine";

export {
  discoverSymptomClusters,
  type SymptomCluster,
  type DiscoveryResult,
} from "./unsupervised_discovery_engine";

export {
  analyzeFragility,
  type CounterfactualSimulation,
  type FragilityReport,
} from "./counterfactual_engine";

export {
  planAndPersistEvidence,
  markTestOrdered,
  getTestEffectiveness,
  type EvidencePlanWithPersistence,
} from "./evidence_planner";

export {
  computeCalibrationMetrics,
  generatePerformanceReport,
  getPerformanceTrend,
  type CalibrationMetrics,
  type PerformanceReport,
} from "./meta_learning_engine";

export {
  evaluateLoopCondition,
  pruneCandidates,
  type LoopDecision,
  type LoopConfig,
} from "./diagnostic_loop_controller";

// ── Cognitive Layer Orchestrator ──

import { storeEpisodicCase, type StoreCaseInput } from "./episodic_memory_engine";
import { recordDiagnosticOutcome, type OutcomeRecord } from "./supervised_learning_engine";
import { discoverSymptomClusters } from "./unsupervised_discovery_engine";

export interface CognitiveLayerInput {
  /** Case data to store in episodic memory */
  case?: StoreCaseInput;
  /** Outcome to record for supervised learning */
  outcome?: OutcomeRecord;
  /** Clinic ID for unsupervised discovery */
  clinic_id?: string;
  /** Whether to run cluster discovery (async, heavier) */
  run_discovery?: boolean;
}

export interface CognitiveLayerResult {
  episodic_stored: boolean;
  outcome_recorded: boolean;
  discovery_triggered: boolean;
  errors: string[];
}

/**
 * Run the full cognitive layer asynchronously after a consultation.
 * Fire-and-forget pattern — does not block the clinical workflow.
 *
 * Safety: No probability updates are applied during this call.
 * All learning signals are recorded for batch calibration only.
 */
export async function runCognitiveLayer(input: CognitiveLayerInput): Promise<CognitiveLayerResult> {
  const result: CognitiveLayerResult = {
    episodic_stored: false,
    outcome_recorded: false,
    discovery_triggered: false,
    errors: [],
  };

  // 1. Store episodic case memory
  if (input.case) {
    try {
      const id = await storeEpisodicCase(input.case);
      result.episodic_stored = !!id;
    } catch (e: any) {
      result.errors.push(`Episodic: ${e.message}`);
    }
  }

  // 2. Record diagnostic outcome
  if (input.outcome) {
    try {
      const id = await recordDiagnosticOutcome(input.outcome);
      result.outcome_recorded = !!id;
    } catch (e: any) {
      result.errors.push(`Outcome: ${e.message}`);
    }
  }

  // 3. Trigger unsupervised discovery (only if requested)
  if (input.run_discovery && input.clinic_id) {
    try {
      discoverSymptomClusters(input.clinic_id).catch(e =>
        console.warn("[CognitiveLayer] Discovery error:", e)
      );
      result.discovery_triggered = true;
    } catch (e: any) {
      result.errors.push(`Discovery: ${e.message}`);
    }
  }

  if (result.errors.length > 0) {
    console.warn("[CognitiveLayer] Completed with errors:", result.errors);
  }

  return result;
}
