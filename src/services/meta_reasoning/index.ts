/**
 * Meta-Reasoning Orchestrator
 *
 * Sits between PCIE and the reasoning engines in the pipeline.
 * Transforms raw clinical context into a ClinicalWorldState and provides:
 *
 * 1. Organ system activation (from DB rules)
 * 2. Physiology inference
 * 3. Disease hypothesis seeding
 * 4. Dangerous diagnosis injection
 * 5. Reasoning conflict resolution
 * 6. Context-aware engine configuration
 * 7. Unified reasoning trace generation
 *
 * Consumed by the v4.1 wave-based pipeline orchestrator.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  buildWorldState,
  type ClinicalWorldState,
  type PatientStateInput,
} from "@/services/world_model";

// ── Types ──

export interface MetaReasoningConfig {
  /** Boost factor for diseases in the dominant organ system */
  organ_system_boost: number;
  /** Minimum probability floor for dangerous diagnoses */
  dangerous_floor: number;
  /** Whether to run multi-system reasoning when >1 organ system detected */
  multi_system_reasoning: boolean;
  /** Engines to prioritize based on world model analysis */
  prioritized_engines: string[];
  /** Engines that can be skipped based on context */
  skippable_engines: string[];
  /** Dynamic timeout adjustments */
  timeout_overrides: Record<string, number>;
}

export interface ConflictResolution {
  ddx_top: string;
  bayesian_top: string;
  resolved_top: string;
  resolution_method: "agreement" | "specificity_override" | "dangerous_priority" | "bayesian_preference";
  confidence: number;
  explanation: string;
}

export interface MetaReasoningOutput {
  world_state: ClinicalWorldState;
  config: MetaReasoningConfig;
  dominant_organ_system: string | null;
  organ_system_weights: Record<string, number>;
  activated_pathways: string[];
  conflict_resolution: ConflictResolution | null;
  reasoning_traces: Array<{ symptom: string; physiology: string; disease: string; chain: string }>;
  latency_ms: number;
}

// ── Cached lookup data (loaded once per session) ──

let _cachedActivationRules: Array<{ symptom: string; organ_system: string; activation_weight: number }> | null = null;
let _cachedSpecificityMap: Record<string, number> | null = null;
let _cachedOrganWeightMap: Record<string, Record<string, number>> | null = null;

async function loadLookupTables(): Promise<{
  activationRules: Array<{ symptom: string; organ_system: string; activation_weight: number }>;
  specificityMap: Record<string, number>;
  organWeightMap: Record<string, Record<string, number>>;
}> {
  if (_cachedActivationRules && _cachedSpecificityMap && _cachedOrganWeightMap) {
    return {
      activationRules: _cachedActivationRules,
      specificityMap: _cachedSpecificityMap,
      organWeightMap: _cachedOrganWeightMap,
    };
  }

  const [activationRes, specRes, organRes] = await Promise.all([
    supabase.from("organ_system_activation_rules").select("symptom, organ_system, activation_weight"),
    supabase.from("symptom_specificity").select("symptom_name, specificity_score"),
    supabase.from("symptom_organ_system_map").select("symptom, organ_system, weight"),
  ]);

  _cachedActivationRules = (activationRes.data || []).map((r: any) => ({
    symptom: r.symptom,
    organ_system: r.organ_system,
    activation_weight: parseFloat(r.activation_weight),
  }));

  _cachedSpecificityMap = {};
  for (const s of (specRes.data || [])) {
    _cachedSpecificityMap[s.symptom_name.toLowerCase()] = parseFloat(s.specificity_score);
  }

  _cachedOrganWeightMap = {};
  for (const o of (organRes.data || [])) {
    if (!_cachedOrganWeightMap[o.symptom.toLowerCase()]) _cachedOrganWeightMap[o.symptom.toLowerCase()] = {};
    _cachedOrganWeightMap[o.symptom.toLowerCase()][o.organ_system] = parseFloat(o.weight);
  }

  return {
    activationRules: _cachedActivationRules,
    specificityMap: _cachedSpecificityMap,
    organWeightMap: _cachedOrganWeightMap,
  };
}

/** Clear cached lookup tables (for testing/refresh) */
export function clearMetaReasoningCache(): void {
  _cachedActivationRules = null;
  _cachedSpecificityMap = null;
  _cachedOrganWeightMap = null;
}

// ── Core Meta-Reasoning ──

/**
 * Run meta-reasoning to produce a ClinicalWorldState and engine configuration.
 * This should be called after PCIE context hydration and before Wave 2.
 */
export async function runMetaReasoning(
  input: PatientStateInput,
): Promise<MetaReasoningOutput> {
  const start = performance.now();

  // Load lookup tables (cached after first call)
  const { activationRules, specificityMap, organWeightMap } = await loadLookupTables();

  // Build world state using the world model engine
  // Note: physiologyMap and physiologyDiagMap are empty here since we don't
  // have direct DB access to joined tables from client side.
  // The world model will use activation rules and specificity data for organ
  // system detection and dangerous diagnosis injection. The full physiology
  // chain runs server-side in the validation pipeline.
  const worldState = buildWorldState(
    input,
    organWeightMap,
    specificityMap,
    [], // physiologyMap — server-side only
    [], // physiologyDiagMap — server-side only
  );

  // Determine dominant organ system
  const dominantSystem = worldState.organ_systems[0] || null;
  const organSystemWeights = worldState.organ_system_weights;

  // Generate engine configuration based on world state
  const config = generateEngineConfig(worldState, input);

  // Determine activated pathways
  const activatedPathways = determinePathways(worldState, input);

  const latencyMs = Math.round(performance.now() - start);

  return {
    world_state: worldState,
    config,
    dominant_organ_system: dominantSystem,
    organ_system_weights: organSystemWeights,
    activated_pathways: activatedPathways,
    conflict_resolution: null, // Set after DDX + Bayesian run
    reasoning_traces: worldState.reasoning_traces,
    latency_ms: latencyMs,
  };
}

/**
 * Resolve conflicts between DDX and Bayesian rankings.
 * Called after both engines complete.
 */
export function resolveReasoningConflict(
  ddxTopDiagnosis: string,
  ddxTopProbability: number,
  bayesianTopDiagnosis: string,
  bayesianTopProbability: number,
  worldState: ClinicalWorldState,
): ConflictResolution {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ddxNorm = normalize(ddxTopDiagnosis);
  const bayesNorm = normalize(bayesianTopDiagnosis);

  // Case 1: Agreement
  if (ddxNorm === bayesNorm || ddxNorm.includes(bayesNorm) || bayesNorm.includes(ddxNorm)) {
    return {
      ddx_top: ddxTopDiagnosis,
      bayesian_top: bayesianTopDiagnosis,
      resolved_top: ddxTopDiagnosis,
      resolution_method: "agreement",
      confidence: Math.max(ddxTopProbability, bayesianTopProbability),
      explanation: `DDX and Bayesian agree: ${ddxTopDiagnosis}`,
    };
  }

  // Case 2: Dangerous diagnosis takes priority
  const ddxIsDangerous = worldState.dangerous_conditions.some(d =>
    normalize(d) === ddxNorm || ddxNorm.includes(normalize(d))
  );
  const bayesIsDangerous = worldState.dangerous_conditions.some(d =>
    normalize(d) === bayesNorm || bayesNorm.includes(normalize(d))
  );

  if (bayesIsDangerous && !ddxIsDangerous) {
    return {
      ddx_top: ddxTopDiagnosis,
      bayesian_top: bayesianTopDiagnosis,
      resolved_top: bayesianTopDiagnosis,
      resolution_method: "dangerous_priority",
      confidence: bayesianTopProbability,
      explanation: `Bayesian top (${bayesianTopDiagnosis}) is a dangerous condition — prioritized over DDX (${ddxTopDiagnosis})`,
    };
  }
  if (ddxIsDangerous && !bayesIsDangerous) {
    return {
      ddx_top: ddxTopDiagnosis,
      bayesian_top: bayesianTopDiagnosis,
      resolved_top: ddxTopDiagnosis,
      resolution_method: "dangerous_priority",
      confidence: ddxTopProbability,
      explanation: `DDX top (${ddxTopDiagnosis}) is a dangerous condition — prioritized over Bayesian (${bayesianTopDiagnosis})`,
    };
  }

  // Case 3: Bayesian probability is significantly higher → use Bayesian
  if (bayesianTopProbability > ddxTopProbability * 1.5) {
    return {
      ddx_top: ddxTopDiagnosis,
      bayesian_top: bayesianTopDiagnosis,
      resolved_top: bayesianTopDiagnosis,
      resolution_method: "bayesian_preference",
      confidence: bayesianTopProbability,
      explanation: `Bayesian posterior (${bayesianTopProbability}%) significantly exceeds DDX (${ddxTopProbability}%) — using Bayesian ranking`,
    };
  }

  // Case 4: Use DDX ranking (weighted by graph specificity)
  return {
    ddx_top: ddxTopDiagnosis,
    bayesian_top: bayesianTopDiagnosis,
    resolved_top: ddxTopDiagnosis,
    resolution_method: "specificity_override",
    confidence: ddxTopProbability,
    explanation: `DDX and Bayesian disagree (${ddxTopDiagnosis} vs ${bayesianTopDiagnosis}) — defaulting to graph-based DDX ranking`,
  };
}

// ── Engine Configuration ──

function generateEngineConfig(
  worldState: ClinicalWorldState,
  input: PatientStateInput,
): MetaReasoningConfig {
  const config: MetaReasoningConfig = {
    organ_system_boost: 1.3,
    dangerous_floor: 0.05,
    multi_system_reasoning: worldState.organ_systems.length > 1,
    prioritized_engines: ["ddx_engine", "bayesian_engine"],
    skippable_engines: [],
    timeout_overrides: {},
  };

  // Adjust based on risk level
  if (worldState.risk_level === "critical" || worldState.risk_level === "high") {
    config.organ_system_boost = 1.5;
    config.dangerous_floor = 0.1;
    config.prioritized_engines.unshift("safety_engine");
    // Extend safety engine timeout for high-risk patients
    config.timeout_overrides.safety_engine = 8000;
  }

  // Multi-system adjustments
  if (worldState.organ_systems.length > 2) {
    config.multi_system_reasoning = true;
    config.organ_system_boost = 1.2; // Reduce boost when multiple systems are active
    config.timeout_overrides.ddx_engine = 12000; // More time for complex cases
  }

  // If few hypotheses, prioritize hypothesis engine
  if (worldState.hypotheses.length < 2) {
    config.prioritized_engines.push("hypothesis_engine");
    config.timeout_overrides.hypothesis_engine = 15000;
  }

  return config;
}

function determinePathways(
  worldState: ClinicalWorldState,
  input: PatientStateInput,
): string[] {
  const pathways: string[] = [];

  for (const sys of worldState.organ_systems) {
    switch (sys) {
      case "cardiovascular":
        pathways.push("cardiac_diagnostic_pathway");
        if (worldState.dangerous_conditions.some(d => d.toLowerCase().includes("myocardial"))) {
          pathways.push("acute_coronary_syndrome_protocol");
        }
        break;
      case "neurological":
        pathways.push("neurological_diagnostic_pathway");
        if (worldState.dangerous_conditions.some(d =>
          d.toLowerCase().includes("stroke") || d.toLowerCase().includes("meningitis")
        )) {
          pathways.push("acute_neurological_emergency_protocol");
        }
        break;
      case "respiratory":
        pathways.push("respiratory_diagnostic_pathway");
        break;
      case "gastrointestinal":
        pathways.push("gastrointestinal_diagnostic_pathway");
        if (worldState.dangerous_conditions.some(d => d.toLowerCase().includes("appendicitis"))) {
          pathways.push("acute_abdomen_protocol");
        }
        break;
      case "infectious":
        pathways.push("infectious_disease_pathway");
        break;
      case "endocrine":
        pathways.push("endocrine_diagnostic_pathway");
        break;
      case "renal":
        pathways.push("renal_diagnostic_pathway");
        break;
      default:
        pathways.push(`${sys}_pathway`);
    }
  }

  if (worldState.risk_level === "critical" || worldState.risk_level === "high") {
    pathways.push("emergency_triage_pathway");
  }

  return [...new Set(pathways)];
}
