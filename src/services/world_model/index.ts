/**
 * Clinical World Model — Patient State Engine
 *
 * Transforms raw clinical context into a structured ClinicalWorldState
 * representing the AI's internal understanding of the patient's condition.
 *
 * Pipeline position: PCIE → [World Model] → Graph → DDX → Bayesian → Safety → SOAP
 */

// ── Types ──

export interface PhysiologyState {
  process: string;
  organ_system: string;
  confidence: number;
}

export interface DiseaseHypothesis {
  disease: string;
  confidence: number;
  organ_system: string;
  source: "physiology" | "dangerous" | "direct";
}

export interface ReasoningTrace {
  symptom: string;
  physiology: string;
  disease: string;
  chain: string; // human-readable evidence chain
}

export interface ClinicalWorldState {
  organ_systems: string[];
  organ_system_weights: Record<string, number>;
  physiological_states: PhysiologyState[];
  hypotheses: DiseaseHypothesis[];
  dangerous_conditions: string[];
  risk_level: "low" | "moderate" | "high" | "critical";
  state_confidence: number;
  reasoning_traces: ReasoningTrace[];
  activated_at: string;
}

export interface PatientStateInput {
  symptoms: string[];
  vitals?: Record<string, any>;
  history?: string[];
  medications?: string[];
  allergies?: string[];
  chief_complaint?: string;
}

// ── Dangerous diagnosis trigger rules (client-side fast path) ──

const DANGEROUS_TRIGGERS: Record<string, string[]> = {
  "chest pain": ["myocardial infarction", "pulmonary embolism", "aortic dissection", "pneumothorax"],
  "headache": ["subarachnoid hemorrhage", "meningitis"],
  "neck stiffness": ["meningitis", "subarachnoid hemorrhage"],
  "abdominal pain": ["appendicitis", "ectopic pregnancy", "bowel perforation"],
  "shortness of breath": ["pulmonary embolism", "pneumothorax", "acute heart failure"],
  "weakness": ["stroke", "transient ischemic attack"],
  "speech difficulty": ["stroke"],
  "facial drooping": ["stroke"],
  "hemoptysis": ["pulmonary embolism"],
  "syncope": ["cardiac arrhythmia", "aortic dissection"],
};

/**
 * Build a ClinicalWorldState from patient input.
 * This is a client-side fast-path used for local pre-computation.
 * The full world model runs server-side in the validation pipeline.
 */
export function buildWorldState(
  input: PatientStateInput,
  organSystemMap: Record<string, Record<string, number>>,
  specificityMap: Record<string, number>,
  physiologyMap: Array<{ symptom: string; physiology_process: string; organ_system: string }>,
  physiologyDiagnosisMap: Array<{ physiology_process: string; disease_name: string; confidence_score: number }>,
): ClinicalWorldState {
  const symptoms = input.symptoms.map(s => s.toLowerCase());

  // 1. Organ System Activation
  const systemScores: Record<string, number> = {};
  for (const s of symptoms) {
    const weights = organSystemMap[s];
    if (weights) {
      for (const [sys, w] of Object.entries(weights)) {
        systemScores[sys] = (systemScores[sys] || 0) + w;
      }
    }
  }
  const sortedSystems = Object.entries(systemScores).sort(([, a], [, b]) => b - a);
  const activeOrganSystems = sortedSystems.filter(([, w]) => w >= 1.0).map(([s]) => s);

  // 2. Physiology Inference
  const physiologicalStates: PhysiologyState[] = [];
  const physProcesses = new Set<string>();
  for (const s of symptoms) {
    const matches = physiologyMap.filter(p => p.symptom.toLowerCase() === s);
    for (const m of matches) {
      if (!physProcesses.has(m.physiology_process)) {
        physProcesses.add(m.physiology_process);
        const spec = specificityMap[s] || 0.35;
        physiologicalStates.push({
          process: m.physiology_process,
          organ_system: m.organ_system,
          confidence: Math.round(Math.min(1.0, spec * 1.2) * 100) / 100,
        });
      }
    }
  }

  // 3. Physiology → Disease Hypotheses
  const hypotheses: DiseaseHypothesis[] = [];
  const seenDiseases = new Set<string>();
  for (const ps of physiologicalStates) {
    const matches = physiologyDiagnosisMap.filter(
      pd => pd.physiology_process.toLowerCase() === ps.process.toLowerCase()
    );
    for (const m of matches) {
      if (!seenDiseases.has(m.disease_name.toLowerCase())) {
        seenDiseases.add(m.disease_name.toLowerCase());
        hypotheses.push({
          disease: m.disease_name,
          confidence: Math.round(ps.confidence * (m.confidence_score || 0.5) * 100) / 100,
          organ_system: ps.organ_system,
          source: "physiology",
        });
      }
    }
  }

  // 4. Dangerous Diagnosis Injection
  const dangerousConditions: string[] = [];
  for (const s of symptoms) {
    const dangers = DANGEROUS_TRIGGERS[s];
    if (dangers) {
      for (const d of dangers) {
        if (!seenDiseases.has(d.toLowerCase())) {
          seenDiseases.add(d.toLowerCase());
          dangerousConditions.push(d);
          hypotheses.push({
            disease: d,
            confidence: 0.05,
            organ_system: activeOrganSystems[0] || "general",
            source: "dangerous",
          });
        } else if (!dangerousConditions.includes(d)) {
          dangerousConditions.push(d);
        }
      }
    }
  }

  // 5. Reasoning Traces
  const traces: ReasoningTrace[] = [];
  for (const ps of physiologicalStates) {
    const matchedDiseases = physiologyDiagnosisMap.filter(
      pd => pd.physiology_process.toLowerCase() === ps.process.toLowerCase()
    );
    // Find the originating symptom
    const originSymptom = physiologyMap.find(
      p => p.physiology_process === ps.process
    )?.symptom || "unknown";

    for (const md of matchedDiseases.slice(0, 2)) {
      traces.push({
        symptom: originSymptom,
        physiology: ps.process,
        disease: md.disease_name,
        chain: `${originSymptom} → ${ps.process} → ${md.disease_name}`,
      });
    }
  }

  // 6. Risk Level
  let riskLevel: ClinicalWorldState["risk_level"] = "low";
  if (dangerousConditions.length > 0) riskLevel = "high";
  if (dangerousConditions.length >= 3) riskLevel = "critical";
  else if (hypotheses.length >= 3) riskLevel = "moderate";

  // Vitals-based risk escalation
  if (input.vitals) {
    const v = input.vitals;
    if ((v.spo2 && v.spo2 < 92) || (v.bp_systolic && v.bp_systolic >= 180) || (v.bp_systolic && v.bp_systolic < 90)) {
      riskLevel = riskLevel === "critical" ? "critical" : "high";
    }
  }

  // 7. State Confidence
  const avgSpec = symptoms.length > 0
    ? symptoms.reduce((a, s) => a + (specificityMap[s] || 0.35), 0) / symptoms.length
    : 0.3;
  const stateConfidence = Math.round(Math.min(0.95, avgSpec + (activeOrganSystems.length > 0 ? 0.15 : 0) + (physiologicalStates.length > 0 ? 0.1 : 0)) * 100) / 100;

  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return {
    organ_systems: activeOrganSystems,
    organ_system_weights: systemScores,
    physiological_states: physiologicalStates,
    hypotheses,
    dangerous_conditions: dangerousConditions,
    risk_level: riskLevel,
    state_confidence: stateConfidence,
    reasoning_traces: traces,
    activated_at: new Date().toISOString(),
  };
}
