export type ProgressiveConsultationStage =
  | "intake"
  | "symptoms_selected"
  | "diagnosis_selected"
  | "labs_selected"
  | "treatment_selected"
  | "final_review";

export interface ProgressiveEngineInput {
  symptomsCount: number;
  diagnosisCount: number;
  labsCount: number;
  medicationCount: number;
  hasAssessment: boolean;
  hasPlan: boolean;
  pipelineComplete: boolean;
}

export interface ProgressiveAction {
  stage: ProgressiveConsultationStage;
  label: string;
  description: string;
}

export function getConsultationStage(input: ProgressiveEngineInput): ProgressiveConsultationStage {
  if (input.pipelineComplete || (input.hasAssessment && input.hasPlan && input.medicationCount > 0)) {
    return "final_review";
  }

  if (input.medicationCount > 0) {
    return "treatment_selected";
  }

  if (input.labsCount > 0) {
    return "labs_selected";
  }

  if (input.diagnosisCount > 0) {
    return "diagnosis_selected";
  }

  if (input.symptomsCount > 0) {
    return "symptoms_selected";
  }

  return "intake";
}

export function getNextProgressiveAction(stage: ProgressiveConsultationStage): ProgressiveAction {
  switch (stage) {
    case "symptoms_selected":
      return {
        stage,
        label: "Confirm Diagnosis",
        description: "Select one diagnosis to continue.",
      };
    case "diagnosis_selected":
      return {
        stage,
        label: "Add Suggested Labs",
        description: "Confirm at least one lab order.",
      };
    case "labs_selected":
      return {
        stage,
        label: "Add Suggested Medication",
        description: "Add at least one treatment item.",
      };
    case "treatment_selected":
      return {
        stage,
        label: "Generate Care Plan",
        description: "Build prescription, labs, summary, and safety review.",
      };
    case "final_review":
      return {
        stage,
        label: "Finalize Consultation",
        description: "Complete validation and save outputs.",
      };
    case "intake":
    default:
      return {
        stage: "intake",
        label: "Select Symptoms",
        description: "Start by selecting the presenting symptoms.",
      };
  }
}
