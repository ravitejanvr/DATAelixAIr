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
  // Added in migration — previously dropped by adapter
  symptoms?: string[];
  associated_symptoms?: string[];
  risk_flags?: string[];
  risk_factors?: string[];
  // Structured clinical signals for reasoning engine
  onset_pattern?: string;
  severity?: string;
  body_location?: string;
  blood_sugar?: number | null;
  family_history?: string[];
  exam_findings?: string[];
  // Identity fields — used by episodic memory and pipeline tracing
  patient_id?: string | null;
  doctor_id?: string | null;
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
  symptoms: [],
  associated_symptoms: [],
  risk_flags: [],
  risk_factors: [],
  family_history: [],
  exam_findings: [],
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

// ── UI State Interface for Full Context Builder ──

export interface UIContextOverrides {
  chiefComplaint?: string;
  symptoms?: string[];
  duration?: string;
  onset_pattern?: string;
  severity?: string;
  body_location?: string;
  risk_factors?: string[];
  family_history?: string[];
  exam_findings?: string[];
  medical_history?: string[];
  blood_sugar?: number | null;
}

/**
 * Build a complete ClinicalContext from base context + UI overrides.
 * This is the CANONICAL way to produce a ClinicalContext for the pipeline,
 * eliminating all monkey-patching via `as any`.
 */
export function buildFullClinicalContext(
  base: ClinicalContext,
  overrides: UIContextOverrides,
): ClinicalContext {
  const ctx = { ...base };

  if (overrides.chiefComplaint) ctx.chief_complaint = overrides.chiefComplaint;
  if (overrides.duration) ctx.symptom_duration = overrides.duration;
  if (overrides.symptoms && overrides.symptoms.length > 0) ctx.symptoms = overrides.symptoms;
  if (overrides.onset_pattern) ctx.onset_pattern = overrides.onset_pattern;
  if (overrides.severity) ctx.severity = overrides.severity;
  if (overrides.body_location) ctx.body_location = overrides.body_location;
  if (overrides.risk_factors && overrides.risk_factors.length > 0) ctx.risk_factors = overrides.risk_factors;
  if (overrides.family_history && overrides.family_history.length > 0) ctx.family_history = overrides.family_history;
  if (overrides.blood_sugar != null) ctx.blood_sugar = overrides.blood_sugar;

  // Exam findings merge into symptoms (for reasoning) and into exam_findings
  if (overrides.exam_findings && overrides.exam_findings.length > 0) {
    const existingSymptoms = ctx.symptoms || [];
    ctx.symptoms = [...new Set([...existingSymptoms, ...overrides.exam_findings])];
    ctx.exam_findings = overrides.exam_findings;
  }

  // Medical history merge (deduplicated)
  if (overrides.medical_history && overrides.medical_history.length > 0) {
    const existing = ctx.medical_history || [];
    ctx.medical_history = [
      ...existing,
      ...overrides.medical_history.filter(mh => !existing.includes(mh)),
    ];
  }

  return ctx;
}
