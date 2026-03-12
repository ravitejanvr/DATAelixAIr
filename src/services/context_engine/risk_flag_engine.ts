/**
 * PCIE — Risk Flag Detection Module
 * 
 * Detects early warning conditions from symptoms, vitals,
 * and patient history. Flags are surfaced in the Clinical Cockpit.
 */

export interface RiskFlag {
  flag_id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  trigger_symptoms: string[];
  action: string;
  matched_at: string;
}

interface RiskRule {
  id: string;
  condition: string;
  severity: "critical" | "high" | "moderate";
  triggers: string[][];  // Array of symptom combinations (any combo match = flag)
  action: string;
}

const RISK_RULES: RiskRule[] = [
  {
    id: "acs_risk",
    condition: "Possible Acute Coronary Syndrome",
    severity: "critical",
    triggers: [
      ["chest pain", "sweating"],
      ["chest pain", "diaphoresis"],
      ["chest pain", "shortness of breath"],
      ["chest pain", "arm pain"],
      ["chest pain", "jaw pain"],
      ["chest pain", "nausea"],
    ],
    action: "Immediate ECG and troponin. Consider emergency referral.",
  },
  {
    id: "meningitis_risk",
    condition: "Possible Meningitis",
    severity: "critical",
    triggers: [
      ["fever", "stiff neck"],
      ["fever", "headache", "photophobia"],
      ["fever", "neck stiffness"],
      ["headache", "stiff neck", "confusion"],
    ],
    action: "Urgent lumbar puncture consideration. Start empirical antibiotics.",
  },
  {
    id: "pe_risk",
    condition: "Possible Pulmonary Embolism",
    severity: "critical",
    triggers: [
      ["dyspnea", "chest pain"],
      ["shortness of breath", "chest pain", "leg pain"],
      ["shortness of breath", "hemoptysis"],
    ],
    action: "Consider CT pulmonary angiogram. D-dimer if low clinical probability.",
  },
  {
    id: "stroke_risk",
    condition: "Possible Stroke",
    severity: "critical",
    triggers: [
      ["sudden headache", "weakness"],
      ["confusion", "weakness", "numbness"],
      ["slurred speech", "weakness"],
      ["facial droop", "arm weakness"],
    ],
    action: "FAST assessment. Urgent CT head. Neurology referral.",
  },
  {
    id: "anaphylaxis_risk",
    condition: "Possible Anaphylaxis",
    severity: "critical",
    triggers: [
      ["rash", "shortness of breath", "swelling"],
      ["urticaria", "dyspnea"],
      ["rash", "difficulty breathing"],
    ],
    action: "Administer epinephrine. Secure airway. Monitor closely.",
  },
  {
    id: "dka_risk",
    condition: "Possible Diabetic Ketoacidosis",
    severity: "high",
    triggers: [
      ["nausea", "vomiting", "abdominal pain"],
      ["fatigue", "vomiting", "confusion"],
    ],
    action: "Check blood glucose and ketones urgently. IV fluids.",
  },
  {
    id: "sepsis_risk",
    condition: "Possible Sepsis",
    severity: "critical",
    triggers: [
      ["fever", "confusion", "weakness"],
      ["fever", "chills", "fatigue"],
    ],
    action: "Blood cultures, lactate. Consider Sepsis-3 criteria.",
  },
  {
    id: "appendicitis_risk",
    condition: "Possible Appendicitis",
    severity: "high",
    triggers: [
      ["abdominal pain", "nausea", "fever"],
      ["abdominal pain", "vomiting", "loss of appetite"],
    ],
    action: "Clinical exam. Consider ultrasound or CT abdomen.",
  },
];

/**
 * Detect risk flags from symptoms and patient context.
 */
export function detectRiskFlags(params: {
  symptoms: string[];
  chief_complaint: string;
  vitals?: {
    temperature?: number | null;
    pulse?: number | null;
    bp_systolic?: number | null;
    bp_diastolic?: number | null;
    spo2?: number | null;
  } | null;
  age?: number | null;
  medications?: string[];
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const allSymptoms = new Set(
    [params.chief_complaint, ...params.symptoms]
      .filter(Boolean)
      .map(s => s.toLowerCase().trim())
  );

  // Check symptom-based rules
  for (const rule of RISK_RULES) {
    for (const triggerCombo of rule.triggers) {
      const allPresent = triggerCombo.every(t => allSymptoms.has(t));
      if (allPresent) {
        flags.push({
          flag_id: rule.id,
          condition: rule.condition,
          severity: rule.severity,
          trigger_symptoms: triggerCombo,
          action: rule.action,
          matched_at: new Date().toISOString(),
        });
        break; // Only flag once per rule
      }
    }
  }

  // Vital-sign based flags
  if (params.vitals) {
    const v = params.vitals;
    if (v.temperature != null && v.temperature >= 39.5) {
      flags.push({
        flag_id: "high_fever",
        condition: "High Fever (≥39.5°C)",
        severity: "high",
        trigger_symptoms: [`temperature: ${v.temperature}°C`],
        action: "Investigate source. Consider blood cultures if >40°C.",
        matched_at: new Date().toISOString(),
      });
    }
    if (v.spo2 != null && v.spo2 < 92) {
      flags.push({
        flag_id: "hypoxia",
        condition: "Hypoxia (SpO₂ < 92%)",
        severity: "critical",
        trigger_symptoms: [`SpO₂: ${v.spo2}%`],
        action: "Supplemental oxygen. Investigate cause urgently.",
        matched_at: new Date().toISOString(),
      });
    }
    if (v.pulse != null && v.pulse > 120) {
      flags.push({
        flag_id: "tachycardia",
        condition: "Tachycardia (HR > 120)",
        severity: "high",
        trigger_symptoms: [`pulse: ${v.pulse} bpm`],
        action: "ECG. Assess for dehydration, infection, or cardiac cause.",
        matched_at: new Date().toISOString(),
      });
    }
    if (v.bp_systolic != null && v.bp_systolic >= 180) {
      flags.push({
        flag_id: "hypertensive_urgency",
        condition: "Hypertensive Urgency (SBP ≥ 180)",
        severity: "high",
        trigger_symptoms: [`BP: ${v.bp_systolic}/${v.bp_diastolic}`],
        action: "Assess for target organ damage. Oral antihypertensive.",
        matched_at: new Date().toISOString(),
      });
    }
  }

  return flags;
}
