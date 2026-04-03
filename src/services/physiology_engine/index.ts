export {
  generatePhysiologicalContext,
  type PhysiologicalContextResult,
  type PhysiologicalContextInput,
  type PhysiologicalState,
  type AffectedSystem,
} from "./client";

export {
  computeSystemicState,
  matchDiseaseProfile,
  computePhysioMultiplier,
  DISEASE_PROFILES,
  type SystemicState,
  type SystemicSignals,
  type SystemicSeverity,
  type SystemicPhenotype,
  type DiseaseType,
  type DiseaseSystemicProfile,
  type VitalsInput,
} from "./systemic_state";
