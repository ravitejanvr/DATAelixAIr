/**
 * Clinical Context Layer
 *
 * Aggregates structured patient data from demographics, vitals, intake,
 * and extracted transcript data into a single clinical_context object
 * that all AI agents receive as input.
 */

export interface ClinicalContext {
  patient_age: number | null;
  patient_sex: string | null;
  height: number | null;
  weight: number | null;
  blood_pressure: string | null;
  pulse: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  chief_complaint: string;
  symptom_duration: string;
  medical_history: string[];
  current_medications: string[];
  allergies: string[];
}

export const EMPTY_CLINICAL_CONTEXT: ClinicalContext = {
  patient_age: null,
  patient_sex: null,
  height: null,
  weight: null,
  blood_pressure: null,
  pulse: null,
  temperature: null,
  respiratory_rate: null,
  oxygen_saturation: null,
  chief_complaint: "",
  symptom_duration: "",
  medical_history: [],
  current_medications: [],
  allergies: [],
};

interface PatientDemographics {
  age: number | null;
  gender: string | null;
  medical_history?: any;
  allergies?: string[] | null;
  current_medications?: string[] | null;
}

interface VitalsData {
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  weight_kg: number | null;
  height_cm: number | null;
}

interface IntakeFields {
  chief_complaint?: string;
  symptom_duration?: string | null;
  allergies_noted?: string | null;
  current_medications?: string;
}

/**
 * Build a ClinicalContext from available data sources.
 * Does NOT duplicate data — references existing vitals/patient/intake tables.
 */
export function buildClinicalContext(
  patient: PatientDemographics | null,
  vitals: VitalsData | null,
  intake: IntakeFields | null,
  extractedChiefComplaint?: string,
  extractedDuration?: string,
  extractedMedications?: string,
  extractedAllergies?: string,
): ClinicalContext {
  const splitCsv = (s?: string | null): string[] =>
    s ? s.split(",").map(v => v.trim()).filter(Boolean) : [];

  // Merge allergies: patient record + intake + extracted (deduplicated)
  const allergySet = new Set<string>();
  patient?.allergies?.forEach(a => allergySet.add(a.toLowerCase()));
  splitCsv(intake?.allergies_noted).forEach(a => allergySet.add(a.toLowerCase()));
  splitCsv(extractedAllergies).forEach(a => allergySet.add(a.toLowerCase()));

  // Merge medications
  const medSet = new Set<string>();
  patient?.current_medications?.forEach(m => medSet.add(m.toLowerCase()));
  splitCsv(intake?.current_medications).forEach(m => medSet.add(m.toLowerCase()));
  splitCsv(extractedMedications).forEach(m => medSet.add(m.toLowerCase()));

  // Medical history
  const history: string[] = [];
  if (patient?.medical_history) {
    if (Array.isArray(patient.medical_history)) {
      patient.medical_history.forEach((h: any) => {
        if (typeof h === "string") history.push(h);
        else if (h?.condition) history.push(h.condition);
      });
    }
  }

  return {
    patient_age: patient?.age ?? null,
    patient_sex: patient?.gender ?? null,
    height: vitals?.height_cm ?? null,
    weight: vitals?.weight_kg ?? null,
    blood_pressure:
      vitals?.bp_systolic != null && vitals?.bp_diastolic != null
        ? `${vitals.bp_systolic}/${vitals.bp_diastolic}`
        : null,
    pulse: vitals?.pulse ?? null,
    temperature: vitals?.temperature ?? null,
    respiratory_rate: vitals?.respiratory_rate ?? null,
    oxygen_saturation: vitals?.spo2 ?? null,
    chief_complaint: intake?.chief_complaint || extractedChiefComplaint || "",
    symptom_duration: intake?.symptom_duration || extractedDuration || "",
    medical_history: history,
    current_medications: Array.from(medSet),
    allergies: Array.from(allergySet),
  };
}
