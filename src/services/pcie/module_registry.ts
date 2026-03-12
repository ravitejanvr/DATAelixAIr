/**
 * PCIE Module Registry
 *
 * Declares every reasoning module with its required inputs (fields that must
 * be present on the context graph) and produced outputs (fields it writes).
 *
 * The dependency-aware executor uses this registry to determine execution
 * order at runtime rather than relying on hard-coded wave numbers.
 */

export type ModuleId =
  | "pcie_context"
  | "context_enrichment"
  | "physiology"
  | "ddx"
  | "evidence"
  | "bayesian"
  | "guideline"
  | "hypothesis"
  | "safety"
  | "uncertainty"
  | "hybrid_reasoning"
  | "soap";

export interface ModuleDescriptor {
  id: ModuleId;
  label: string;
  /** Fields on the context graph that must be non-empty before this module runs */
  required_inputs: string[];
  /** Fields on the context graph this module populates */
  produced_outputs: string[];
  /** Maximum execution budget in ms */
  timeout_ms: number;
  /** Whether to retry once on timeout */
  retry_on_timeout: boolean;
  /** If true, pipeline continues even if this module fails */
  optional: boolean;
}

export const MODULE_REGISTRY: ModuleDescriptor[] = [
  {
    id: "pcie_context",
    label: "PCIE Context Extraction",
    required_inputs: [],
    produced_outputs: [
      "patient.chief_complaint",
      "patient.symptoms",
      "patient.associated_symptoms",
      "patient.medical_history",
      "patient.allergies",
      "patient.current_medications",
      "patient.risk_factors",
      "patient.family_history",
      "patient.vitals",
      "patient.risk_flags",
      "patient.context_confidence",
    ],
    timeout_ms: 1500,
    retry_on_timeout: true,
    optional: true,
  },
  {
    id: "context_enrichment",
    label: "Context Enrichment",
    required_inputs: ["patient.chief_complaint"],
    produced_outputs: ["patient.missing_information"],
    timeout_ms: 500,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "physiology",
    label: "Physiology Engine",
    required_inputs: ["patient.symptoms"],
    produced_outputs: ["reasoning.physiology_models"],
    timeout_ms: 6000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "ddx",
    label: "DDX Engine",
    required_inputs: ["patient.symptoms"],
    produced_outputs: [
      "reasoning.differential_diagnoses",
      "reasoning.organ_systems_detected",
      "decision.recommended_investigations",
      "decision.treatment_suggestions",
    ],
    timeout_ms: 8000,
    retry_on_timeout: true,
    optional: false,
  },
  {
    id: "evidence",
    label: "Evidence Retrieval",
    required_inputs: ["patient.symptoms", "reasoning.differential_diagnoses"],
    produced_outputs: ["reasoning.evidence_sources"],
    timeout_ms: 7000,
    retry_on_timeout: true,
    optional: true,
  },
  {
    id: "bayesian",
    label: "Bayesian Inference",
    required_inputs: [
      "patient.symptoms",
      "reasoning.differential_diagnoses",
    ],
    produced_outputs: ["reasoning.bayesian_probabilities"],
    timeout_ms: 4000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "guideline",
    label: "Guideline Engine",
    required_inputs: ["reasoning.differential_diagnoses"],
    produced_outputs: ["reasoning.guideline_references"],
    timeout_ms: 9000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "hypothesis",
    label: "Hypothesis Reasoning",
    required_inputs: ["patient.chief_complaint", "patient.symptoms"],
    produced_outputs: ["reasoning.hypotheses"],
    timeout_ms: 8000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "safety",
    label: "Safety Engine",
    required_inputs: ["patient.current_medications", "patient.allergies"],
    produced_outputs: ["decision.safety_alerts", "decision.safety_score"],
    timeout_ms: 4000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "uncertainty",
    label: "Uncertainty Calibration",
    required_inputs: ["patient.symptoms", "reasoning.differential_diagnoses"],
    produced_outputs: [
      "decision.uncertainty_score",
      "decision.confidence_score",
      "decision.confidence_label",
    ],
    timeout_ms: 4000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "hybrid_reasoning",
    label: "Hybrid Reasoning",
    required_inputs: ["patient.chief_complaint", "patient.symptoms"],
    produced_outputs: [
      "documentation.soap_note",
      "decision.paradigm_agreement",
    ],
    timeout_ms: 6000,
    retry_on_timeout: false,
    optional: true,
  },
  {
    id: "soap",
    label: "SOAP Generator (Fallback)",
    required_inputs: ["patient.chief_complaint"],
    produced_outputs: ["documentation.soap_note", "documentation.clinical_summary"],
    timeout_ms: 3000,
    retry_on_timeout: false,
    optional: true,
  },
];

/** Get a module descriptor by ID */
export function getModule(id: ModuleId): ModuleDescriptor | undefined {
  return MODULE_REGISTRY.find(m => m.id === id);
}

/** Build the dependency-ordered execution plan */
export function buildExecutionPlan(): ModuleId[][] {
  // Topological sort into waves based on produced_outputs → required_inputs
  const produced = new Map<string, ModuleId>();
  for (const mod of MODULE_REGISTRY) {
    for (const field of mod.produced_outputs) {
      produced.set(field, mod.id);
    }
  }

  const resolved = new Set<ModuleId>();
  const waves: ModuleId[][] = [];
  const remaining = new Set<ModuleId>(MODULE_REGISTRY.map(m => m.id));

  while (remaining.size > 0) {
    const wave: ModuleId[] = [];
    for (const id of remaining) {
      const mod = MODULE_REGISTRY.find(m => m.id === id)!;
      const depsResolved = mod.required_inputs.every(field => {
        const producer = produced.get(field);
        return !producer || resolved.has(producer);
      });
      if (depsResolved) wave.push(id);
    }
    if (wave.length === 0) {
      // Break cycles — schedule all remaining
      wave.push(...remaining);
      remaining.clear();
    }
    for (const id of wave) {
      resolved.add(id);
      remaining.delete(id);
    }
    waves.push(wave);
  }

  return waves;
}
