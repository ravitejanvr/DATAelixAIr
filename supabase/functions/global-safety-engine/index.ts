/**
 * Global Clinical Safety Engine
 * 
 * Continuously monitors consultations and detects potential clinical risks.
 * Operates as a post-finalization safety layer.
 * 
 * Modules:
 * 1. Clinical Risk Detection - dangerous symptom combinations
 * 2. Medication Safety Monitor - drug interactions, allergies, dosing
 * 3. Diagnostic Consistency Checker - symptom-diagnosis-treatment alignment
 * 4. Population Pattern Monitor - outbreak detection
 * 5. Outcome Feedback Monitor - follow-up tracking
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConsultationContext {
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  visit_id?: string;
  chief_complaint?: string;
  symptoms?: string[];
  diagnosis?: string;
  soap_assessment?: string;
  soap_plan?: string;
  tests_ordered?: string[];
  medications?: Array<{
    drug_name: string;
    dosage: string;
    frequency?: string;
    duration?: string;
  }>;
  vitals?: {
    bp_systolic?: number;
    bp_diastolic?: number;
    pulse?: number;
    temperature?: number;
    spo2?: number;
    respiratory_rate?: number;
    blood_sugar?: number;
  };
  patient_age?: number;
  patient_sex?: string;
  allergies?: string[];
  current_medications?: string[];
  follow_up_date?: string;
}

interface RiskPattern {
  id: string;
  pattern_name: string;
  pattern_type: string;
  indicators: string[];
  severity: string;
  description: string;
  action_hint?: string;
  specialty?: string;
}

interface SafetyEngineResult {
  clinical_alerts: ClinicalAlert[];
  medication_alerts: MedicationAlert[];
  diagnostic_flags: DiagnosticFlag[];
  population_signal?: PopulationSignal;
  outcome_tracking: OutcomeTracking;
  summary: {
    critical_count: number;
    high_count: number;
    warning_count: number;
    advisory_count: number;
  };
}

interface ClinicalAlert {
  alert_type: string;
  severity: string;
  category: string;
  title: string;
  message: string;
  matched_indicators: string[];
  action_hint?: string;
}

interface MedicationAlert {
  alert_type: string;
  severity: string;
  drug_a?: string;
  drug_b?: string;
  allergy_conflict?: string;
  dose_issue?: string;
  message: string;
}

interface DiagnosticFlag {
  flag_type: string;
  severity: string;
  inconsistency_detail: string;
  recommendation?: string;
}

interface PopulationSignal {
  signal_type: string;
  signal_name: string;
  severity: string;
  indicators: string[];
}

interface OutcomeTracking {
  follow_up_scheduled_date?: string;
  outcome_status: string;
}

// ============================================================
// Module 1: Clinical Risk Detection
// ============================================================
function detectClinicalRisks(
  context: ConsultationContext,
  riskPatterns: RiskPattern[]
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const symptoms = normalizeSymptoms(context);

  for (const pattern of riskPatterns) {
    if (pattern.pattern_type === "symptom_combination") {
      const matchedIndicators = pattern.indicators.filter((indicator) =>
        symptoms.some((s) => s.includes(indicator.toLowerCase()) || indicator.toLowerCase().includes(s))
      );

      // Require at least 2 matching indicators for a pattern match
      if (matchedIndicators.length >= 2) {
        alerts.push({
          alert_type: "symptom_combination",
          severity: pattern.severity,
          category: "clinical_risk",
          title: pattern.pattern_name,
          message: pattern.description,
          matched_indicators: matchedIndicators,
          action_hint: pattern.action_hint,
        });
      }
    }

    if (pattern.pattern_type === "vitals_pattern" && context.vitals) {
      const vitalsAlerts = checkVitalsPattern(context.vitals, pattern);
      alerts.push(...vitalsAlerts);
    }
  }

  // Additional dangerous combinations
  const dangerousCombos = checkDangerousCombinations(symptoms, context.vitals);
  alerts.push(...dangerousCombos);

  return alerts;
}

function normalizeSymptoms(context: ConsultationContext): string[] {
  const symptoms: string[] = [];

  if (context.symptoms) {
    symptoms.push(...context.symptoms.map((s) => s.toLowerCase().trim()));
  }

  if (context.chief_complaint) {
    symptoms.push(context.chief_complaint.toLowerCase().trim());
  }

  // Extract symptoms from SOAP assessment if available
  if (context.soap_assessment) {
    const assessmentLower = context.soap_assessment.toLowerCase();
    const symptomKeywords = [
      "chest pain", "shortness of breath", "fever", "headache",
      "neck stiffness", "vomiting", "diarrhea", "abdominal pain",
      "weakness", "dizziness", "confusion", "seizure", "syncope",
      "cough", "sore throat", "rash", "swelling", "bleeding"
    ];
    for (const keyword of symptomKeywords) {
      if (assessmentLower.includes(keyword)) {
        symptoms.push(keyword);
      }
    }
  }

  return [...new Set(symptoms)];
}

function checkVitalsPattern(
  vitals: ConsultationContext["vitals"],
  pattern: RiskPattern
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  if (!vitals) return alerts;

  const matchedIndicators: string[] = [];

  // Check for abnormal vitals matching pattern indicators
  if (pattern.indicators.includes("fever") && vitals.temperature && vitals.temperature >= 38.5) {
    matchedIndicators.push("fever");
  }
  if (pattern.indicators.includes("tachycardia") && vitals.pulse && vitals.pulse > 100) {
    matchedIndicators.push("tachycardia");
  }
  if (pattern.indicators.includes("tachypnea") && vitals.respiratory_rate && vitals.respiratory_rate > 20) {
    matchedIndicators.push("tachypnea");
  }
  if (pattern.indicators.includes("low oxygen saturation") && vitals.spo2 && vitals.spo2 < 92) {
    matchedIndicators.push("low oxygen saturation");
  }

  if (matchedIndicators.length >= 2) {
    alerts.push({
      alert_type: "vitals_pattern",
      severity: pattern.severity,
      category: "clinical_risk",
      title: pattern.pattern_name,
      message: pattern.description,
      matched_indicators: matchedIndicators,
      action_hint: pattern.action_hint,
    });
  }

  return alerts;
}

function checkDangerousCombinations(
  symptoms: string[],
  vitals?: ConsultationContext["vitals"]
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];

  // Hypertensive crisis
  if (vitals?.bp_systolic && vitals.bp_systolic >= 180) {
    const hasSymptoms = symptoms.some((s) =>
      ["headache", "chest pain", "vision changes", "confusion"].some((d) => s.includes(d))
    );
    if (hasSymptoms) {
      alerts.push({
        alert_type: "vitals_symptom_combo",
        severity: "critical",
        category: "clinical_risk",
        title: "Hypertensive Emergency",
        message: "Severely elevated blood pressure with target organ symptoms",
        matched_indicators: ["bp_systolic >= 180", ...symptoms.filter((s) =>
          ["headache", "chest pain", "vision", "confusion"].some((d) => s.includes(d))
        )],
        action_hint: "Immediate BP management and organ damage assessment required.",
      });
    }
  }

  // Hypoglycemia
  if (vitals?.blood_sugar && vitals.blood_sugar < 70) {
    alerts.push({
      alert_type: "vitals_critical",
      severity: "critical",
      category: "clinical_risk",
      title: "Hypoglycemia Alert",
      message: `Blood sugar critically low at ${vitals.blood_sugar} mg/dL`,
      matched_indicators: [`blood_sugar: ${vitals.blood_sugar}`],
      action_hint: "Immediate glucose administration required.",
    });
  }

  // Severe hypoxia
  if (vitals?.spo2 && vitals.spo2 < 88) {
    alerts.push({
      alert_type: "vitals_critical",
      severity: "critical",
      category: "clinical_risk",
      title: "Severe Hypoxia",
      message: `Oxygen saturation critically low at ${vitals.spo2}%`,
      matched_indicators: [`spo2: ${vitals.spo2}`],
      action_hint: "Immediate supplemental oxygen and respiratory assessment.",
    });
  }

  return alerts;
}

// ============================================================
// Module 2: Medication Safety Monitor
// ============================================================
async function checkMedicationSafety(
  context: ConsultationContext
): Promise<MedicationAlert[]> {
  const alerts: MedicationAlert[] = [];
  const medications = context.medications || [];
  const allergies = context.allergies || [];
  const currentMeds = context.current_medications || [];

  // Check allergy conflicts
  for (const med of medications) {
    const drugLower = med.drug_name.toLowerCase();
    for (const allergy of allergies) {
      const allergyLower = allergy.toLowerCase();
      if (drugLower.includes(allergyLower) || allergyLower.includes(drugLower)) {
        alerts.push({
          alert_type: "allergy_conflict",
          severity: "critical",
          allergy_conflict: allergy,
          drug_a: med.drug_name,
          message: `ALLERGY ALERT: ${med.drug_name} may conflict with documented allergy to ${allergy}`,
        });
      }
    }

    // Check penicillin cross-reactivity
    if (allergyLower(allergies, "penicillin") && isPenicillinClass(drugLower)) {
      alerts.push({
        alert_type: "allergy_cross_reactivity",
        severity: "high",
        allergy_conflict: "penicillin",
        drug_a: med.drug_name,
        message: `Cross-reactivity warning: ${med.drug_name} may cause reaction in penicillin-allergic patients`,
      });
    }

    // Check sulfa allergy
    if (allergyLower(allergies, "sulfa") && isSulfaClass(drugLower)) {
      alerts.push({
        alert_type: "allergy_cross_reactivity",
        severity: "high",
        allergy_conflict: "sulfa",
        drug_a: med.drug_name,
        message: `Sulfa allergy alert: ${med.drug_name} contains sulfonamide`,
      });
    }
  }

  // Check duplicate therapy
  const drugClasses = new Map<string, string[]>();
  for (const med of medications) {
    const drugClass = getDrugClass(med.drug_name);
    if (drugClass) {
      if (!drugClasses.has(drugClass)) {
        drugClasses.set(drugClass, []);
      }
      drugClasses.get(drugClass)!.push(med.drug_name);
    }
  }

  for (const [drugClass, drugs] of drugClasses) {
    if (drugs.length > 1) {
      alerts.push({
        alert_type: "duplicate_therapy",
        severity: "warning",
        drug_a: drugs[0],
        drug_b: drugs[1],
        message: `Duplicate therapy: Multiple ${drugClass} medications prescribed (${drugs.join(", ")})`,
      });
    }
  }

  // Check common drug-drug interactions
  const interactionAlerts = checkDrugInteractions(medications);
  alerts.push(...interactionAlerts);

  // Pediatric dosing check
  if (context.patient_age && context.patient_age < 12) {
    for (const med of medications) {
      const pediatricIssue = checkPediatricDosing(med, context.patient_age);
      if (pediatricIssue) {
        alerts.push(pediatricIssue);
      }
    }
  }

  return alerts;
}

function allergyLower(allergies: string[], term: string): boolean {
  return allergies.some((a) => a.toLowerCase().includes(term.toLowerCase()));
}

function isPenicillinClass(drug: string): boolean {
  const penicillins = ["amoxicillin", "ampicillin", "penicillin", "piperacillin", "cloxacillin"];
  return penicillins.some((p) => drug.includes(p));
}

function isSulfaClass(drug: string): boolean {
  const sulfas = ["sulfamethoxazole", "sulfasalazine", "sulfadiazine", "cotrimoxazole", "bactrim"];
  return sulfas.some((s) => drug.includes(s));
}

function getDrugClass(drug: string): string | null {
  const drugLower = drug.toLowerCase();
  const classMap: Record<string, string[]> = {
    "ACE Inhibitor": ["lisinopril", "enalapril", "ramipril", "captopril"],
    "ARB": ["losartan", "valsartan", "telmisartan", "olmesartan"],
    "Beta Blocker": ["metoprolol", "atenolol", "propranolol", "carvedilol"],
    "Calcium Channel Blocker": ["amlodipine", "nifedipine", "diltiazem", "verapamil"],
    "Statin": ["atorvastatin", "rosuvastatin", "simvastatin", "pravastatin"],
    "PPI": ["omeprazole", "pantoprazole", "esomeprazole", "rabeprazole"],
    "NSAID": ["ibuprofen", "naproxen", "diclofenac", "indomethacin", "aspirin"],
    "SSRI": ["fluoxetine", "sertraline", "paroxetine", "escitalopram", "citalopram"],
    "Benzodiazepine": ["diazepam", "alprazolam", "lorazepam", "clonazepam"],
    "Anticoagulant": ["warfarin", "heparin", "enoxaparin", "rivaroxaban", "apixaban"],
  };

  for (const [drugClass, drugs] of Object.entries(classMap)) {
    if (drugs.some((d) => drugLower.includes(d))) {
      return drugClass;
    }
  }
  return null;
}

function checkDrugInteractions(
  medications: ConsultationContext["medications"]
): MedicationAlert[] {
  const alerts: MedicationAlert[] = [];
  if (!medications || medications.length < 2) return alerts;

  const drugNames = medications.map((m) => m.drug_name.toLowerCase());

  // Common dangerous interactions
  const interactions = [
    {
      drugs: ["warfarin", "aspirin"],
      severity: "high",
      message: "Increased bleeding risk with warfarin and aspirin combination",
    },
    {
      drugs: ["metformin", "contrast"],
      severity: "high",
      message: "Hold metformin before/after contrast administration",
    },
    {
      drugs: ["ssri", "tramadol"],
      severity: "high",
      message: "Risk of serotonin syndrome with SSRI and tramadol",
    },
    {
      drugs: ["ace inhibitor", "potassium"],
      severity: "warning",
      message: "Monitor potassium levels with ACE inhibitor and potassium supplement",
    },
    {
      drugs: ["digoxin", "amiodarone"],
      severity: "high",
      message: "Amiodarone increases digoxin levels - reduce digoxin dose",
    },
    {
      drugs: ["simvastatin", "clarithromycin"],
      severity: "high",
      message: "Risk of rhabdomyolysis with simvastatin and clarithromycin",
    },
    {
      drugs: ["methotrexate", "nsaid"],
      severity: "critical",
      message: "NSAIDs increase methotrexate toxicity - avoid combination",
    },
  ];

  for (const interaction of interactions) {
    const [drug1, drug2] = interaction.drugs;
    const hasDrug1 = drugNames.some((d) => d.includes(drug1) || getDrugClass(d)?.toLowerCase().includes(drug1));
    const hasDrug2 = drugNames.some((d) => d.includes(drug2) || getDrugClass(d)?.toLowerCase().includes(drug2));

    if (hasDrug1 && hasDrug2) {
      alerts.push({
        alert_type: "drug_interaction",
        severity: interaction.severity,
        drug_a: drug1,
        drug_b: drug2,
        message: interaction.message,
      });
    }
  }

  return alerts;
}

function checkPediatricDosing(
  med: { drug_name: string; dosage: string },
  age: number
): MedicationAlert | null {
  const drugLower = med.drug_name.toLowerCase();
  const dosageLower = med.dosage.toLowerCase();

  // Contraindicated in children
  const contraindicatedDrugs = ["aspirin", "doxycycline", "ciprofloxacin", "levofloxacin"];
  if (contraindicatedDrugs.some((d) => drugLower.includes(d))) {
    return {
      alert_type: "pediatric_contraindication",
      severity: "high",
      drug_a: med.drug_name,
      dose_issue: "contraindicated",
      message: `${med.drug_name} is generally contraindicated in children under ${age < 8 ? "8" : "18"} years`,
    };
  }

  // Check for adult-strength dosing
  const adultDoses = ["500mg", "1000mg", "1g", "750mg"];
  if (age < 6 && adultDoses.some((d) => dosageLower.includes(d))) {
    return {
      alert_type: "pediatric_dose_warning",
      severity: "warning",
      drug_a: med.drug_name,
      dose_issue: `${med.dosage} appears high for age ${age}`,
      message: `Verify pediatric dosing for ${med.drug_name} ${med.dosage} in ${age}-year-old patient`,
    };
  }

  return null;
}

// ============================================================
// Module 3: Diagnostic Consistency Checker
// ============================================================
function checkDiagnosticConsistency(
  context: ConsultationContext
): DiagnosticFlag[] {
  const flags: DiagnosticFlag[] = [];
  const symptoms = normalizeSymptoms(context);
  const diagnosis = (context.diagnosis || context.soap_assessment || "").toLowerCase();
  const tests = (context.tests_ordered || []).map((t) => t.toLowerCase());
  const plan = (context.soap_plan || "").toLowerCase();

  // Check for missing diagnostic tests based on symptoms
  const expectedTests = getExpectedTests(symptoms, diagnosis);
  for (const expected of expectedTests) {
    if (!tests.some((t) => t.includes(expected.test))) {
      flags.push({
        flag_type: "missing_test",
        severity: "advisory",
        inconsistency_detail: `${expected.test} may be indicated for ${expected.indication}`,
        recommendation: `Consider ordering ${expected.test}`,
      });
    }
  }

  // Check symptom-diagnosis alignment
  const diagnosisAlignmentIssues = checkSymptomDiagnosisAlignment(symptoms, diagnosis);
  flags.push(...diagnosisAlignmentIssues);

  // Check treatment alignment
  const treatmentIssues = checkTreatmentAlignment(diagnosis, context.medications || [], plan);
  flags.push(...treatmentIssues);

  return flags;
}

function getExpectedTests(
  symptoms: string[],
  diagnosis: string
): Array<{ test: string; indication: string }> {
  const expected: Array<{ test: string; indication: string }> = [];

  // Fever workup
  if (symptoms.some((s) => s.includes("fever"))) {
    expected.push({ test: "cbc", indication: "fever" });
  }

  // Chest pain workup
  if (symptoms.some((s) => s.includes("chest pain"))) {
    expected.push({ test: "ecg", indication: "chest pain" });
    expected.push({ test: "troponin", indication: "chest pain" });
  }

  // Diabetes suspected
  if (diagnosis.includes("diabetes") || symptoms.some((s) => s.includes("polyuria") || s.includes("polydipsia"))) {
    expected.push({ test: "hba1c", indication: "suspected diabetes" });
    expected.push({ test: "fasting glucose", indication: "suspected diabetes" });
  }

  // Thyroid symptoms
  if (symptoms.some((s) => ["weight change", "fatigue", "hair loss", "cold intolerance"].some((t) => s.includes(t)))) {
    expected.push({ test: "tsh", indication: "thyroid symptoms" });
  }

  // Anemia symptoms
  if (symptoms.some((s) => ["pallor", "fatigue", "weakness", "breathlessness"].some((t) => s.includes(t)))) {
    expected.push({ test: "cbc", indication: "anemia symptoms" });
  }

  return expected;
}

function checkSymptomDiagnosisAlignment(
  symptoms: string[],
  diagnosis: string
): DiagnosticFlag[] {
  const flags: DiagnosticFlag[] = [];

  // Red flag symptoms that should be documented
  const redFlags = ["chest pain", "severe headache", "syncope", "hemoptysis", "melena"];
  for (const redFlag of redFlags) {
    if (symptoms.some((s) => s.includes(redFlag)) && !diagnosis.includes(redFlag.split(" ")[0])) {
      flags.push({
        flag_type: "red_flag_not_addressed",
        severity: "warning",
        inconsistency_detail: `Red flag symptom "${redFlag}" present but may not be addressed in assessment`,
        recommendation: "Ensure red flag symptom is explicitly addressed and ruled out if benign",
      });
    }
  }

  return flags;
}

function checkTreatmentAlignment(
  diagnosis: string,
  medications: ConsultationContext["medications"],
  plan: string
): DiagnosticFlag[] {
  const flags: DiagnosticFlag[] = [];
  if (!medications || medications.length === 0) return flags;

  const medNames = medications.map((m) => m.drug_name.toLowerCase());

  // Antibiotic without infection diagnosis
  const antibiotics = ["amoxicillin", "azithromycin", "ciprofloxacin", "doxycycline", "cephalexin"];
  const hasAntibiotic = medNames.some((m) => antibiotics.some((a) => m.includes(a)));
  const infectionTerms = ["infection", "pneumonia", "bronchitis", "uti", "cellulitis", "sinusitis"];
  const hasInfectionDiagnosis = infectionTerms.some((t) => diagnosis.includes(t));

  if (hasAntibiotic && !hasInfectionDiagnosis) {
    flags.push({
      flag_type: "treatment_diagnosis_mismatch",
      severity: "advisory",
      inconsistency_detail: "Antibiotic prescribed without documented infection diagnosis",
      recommendation: "Document infection diagnosis or indication for antibiotic use",
    });
  }

  // Steroid without documented indication
  const steroids = ["prednisone", "prednisolone", "dexamethasone", "methylprednisolone"];
  const hasSteroid = medNames.some((m) => steroids.some((s) => m.includes(s)));
  const steroidIndications = ["asthma", "copd", "allergy", "inflammation", "arthritis", "rash"];
  const hasSteroidIndication = steroidIndications.some((t) => diagnosis.includes(t) || plan.includes(t));

  if (hasSteroid && !hasSteroidIndication) {
    flags.push({
      flag_type: "treatment_indication_unclear",
      severity: "advisory",
      inconsistency_detail: "Corticosteroid prescribed without documented indication",
      recommendation: "Document indication for steroid use",
    });
  }

  return flags;
}

// ============================================================
// Module 4: Population Pattern Monitor
// ============================================================
async function checkPopulationPatterns(
  supabaseAdmin: any,
  context: ConsultationContext
): Promise<PopulationSignal | undefined> {
  const symptoms = normalizeSymptoms(context);
  
  // Check for potential outbreak indicators
  const outbreakSymptoms = ["fever", "diarrhea", "vomiting", "rash", "cough"];
  const matchedOutbreakSymptoms = symptoms.filter((s) =>
    outbreakSymptoms.some((o) => s.includes(o))
  );

  if (matchedOutbreakSymptoms.length === 0) return undefined;

  // Query recent consultations with similar symptoms
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: recentConsultations, error } = await supabaseAdmin
    .from("consultations")
    .select("id, chief_complaint, extracted_data")
    .eq("clinic_id", context.clinic_id)
    .gte("created_at", twentyFourHoursAgo)
    .limit(100);

  if (error || !recentConsultations) return undefined;

  // Count similar symptom patterns
  let similarCount = 0;
  for (const consultation of recentConsultations) {
    const consultSymptoms = [
      consultation.chief_complaint?.toLowerCase() || "",
      ...(consultation.extracted_data?.symptoms || []).map((s: string) => s.toLowerCase()),
    ];
    
    const hasOverlap = matchedOutbreakSymptoms.some((s) =>
      consultSymptoms.some((cs: string) => cs.includes(s))
    );
    if (hasOverlap) similarCount++;
  }

  // Alert if unusual clustering detected
  if (similarCount >= 5) {
    const signal: PopulationSignal = {
      signal_type: "symptom_cluster",
      signal_name: `${matchedOutbreakSymptoms[0]} cluster detected`,
      severity: similarCount >= 10 ? "high" : "warning",
      indicators: matchedOutbreakSymptoms,
    };

    // Store/update population signal
    await supabaseAdmin.from("population_signals").upsert({
      clinic_id: context.clinic_id,
      signal_type: signal.signal_type,
      signal_name: signal.signal_name,
      severity: signal.severity,
      affected_count: similarCount,
      time_window_hours: 24,
      indicators: signal.indicators,
      last_updated_at: new Date().toISOString(),
    }, {
      onConflict: "clinic_id,signal_type,signal_name",
    });

    return signal;
  }

  return undefined;
}

// ============================================================
// Module 5: Outcome Feedback Monitor
// ============================================================
function createOutcomeTracking(context: ConsultationContext): OutcomeTracking {
  return {
    follow_up_scheduled_date: context.follow_up_date,
    outcome_status: "pending",
  };
}

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const context: ConsultationContext = body;

    if (!context.consultation_id || !context.patient_id || !context.doctor_id || !context.clinic_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: consultation_id, patient_id, doctor_id, clinic_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch risk patterns from database
    const { data: riskPatterns } = await supabaseAdmin
      .from("risk_patterns")
      .select("*")
      .eq("is_active", true);

    // Run all safety modules
    const clinicalAlerts = detectClinicalRisks(context, riskPatterns || []);
    const medicationAlerts = await checkMedicationSafety(context);
    const diagnosticFlags = checkDiagnosticConsistency(context);
    const populationSignal = await checkPopulationPatterns(supabaseAdmin, context);
    const outcomeTracking = createOutcomeTracking(context);

    // Calculate summary
    const allAlerts = [...clinicalAlerts, ...medicationAlerts];
    const summary = {
      critical_count: allAlerts.filter((a) => a.severity === "critical").length,
      high_count: allAlerts.filter((a) => a.severity === "high").length,
      warning_count: allAlerts.filter((a) => a.severity === "warning").length,
      advisory_count: diagnosticFlags.length,
    };

    // Store alerts in database
    const insertPromises: Promise<any>[] = [];

    // Insert clinical alerts
    if (clinicalAlerts.length > 0) {
      insertPromises.push(
        supabaseAdmin.from("clinical_alerts").insert(
          clinicalAlerts.map((alert) => ({
            consultation_id: context.consultation_id,
            visit_id: context.visit_id,
            patient_id: context.patient_id,
            doctor_id: context.doctor_id,
            clinic_id: context.clinic_id,
            alert_type: alert.alert_type,
            severity: alert.severity,
            category: alert.category,
            title: alert.title,
            message: alert.message,
            matched_indicators: alert.matched_indicators,
            action_hint: alert.action_hint,
          }))
        )
      );
    }

    // Insert medication alerts
    if (medicationAlerts.length > 0) {
      insertPromises.push(
        supabaseAdmin.from("medication_alerts").insert(
          medicationAlerts.map((alert) => ({
            consultation_id: context.consultation_id,
            patient_id: context.patient_id,
            doctor_id: context.doctor_id,
            clinic_id: context.clinic_id,
            alert_type: alert.alert_type,
            severity: alert.severity,
            drug_a: alert.drug_a,
            drug_b: alert.drug_b,
            allergy_conflict: alert.allergy_conflict,
            dose_issue: alert.dose_issue,
            message: alert.message,
          }))
        )
      );
    }

    // Insert diagnostic flags
    if (diagnosticFlags.length > 0) {
      insertPromises.push(
        supabaseAdmin.from("diagnostic_flags").insert(
          diagnosticFlags.map((flag) => ({
            consultation_id: context.consultation_id,
            patient_id: context.patient_id,
            doctor_id: context.doctor_id,
            clinic_id: context.clinic_id,
            flag_type: flag.flag_type,
            severity: flag.severity,
            inconsistency_detail: flag.inconsistency_detail,
            recommendation: flag.recommendation,
          }))
        )
      );
    }

    // Insert outcome tracking
    insertPromises.push(
      supabaseAdmin.from("outcome_tracking").insert({
        consultation_id: context.consultation_id,
        patient_id: context.patient_id,
        doctor_id: context.doctor_id,
        clinic_id: context.clinic_id,
        follow_up_scheduled_date: outcomeTracking.follow_up_scheduled_date,
        outcome_status: outcomeTracking.outcome_status,
      })
    );

    // Log to audit
    insertPromises.push(
      supabaseAdmin.from("audit_logs").insert({
        actor_id: context.doctor_id,
        event_type: "safety_engine_executed",
        target_type: "consultation",
        target_id: context.consultation_id,
        clinic_id: context.clinic_id,
        metadata: {
          clinical_alert_count: clinicalAlerts.length,
          medication_alert_count: medicationAlerts.length,
          diagnostic_flag_count: diagnosticFlags.length,
          has_population_signal: !!populationSignal,
          summary,
        },
      })
    );

    await Promise.allSettled(insertPromises);

    const result: SafetyEngineResult = {
      clinical_alerts: clinicalAlerts,
      medication_alerts: medicationAlerts,
      diagnostic_flags: diagnosticFlags,
      population_signal: populationSignal,
      outcome_tracking: outcomeTracking,
      summary,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Global Safety Engine error:", error);
    return new Response(
      JSON.stringify({ error: "Safety engine failed", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
