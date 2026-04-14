/**
 * Clinical Question Engine — V4
 *
 * Detects missing required fields and generates dynamic
 * follow-up questions driven by symptom protocols and
 * clinical guidelines.
 *
 * Operates ONLY on canonical IDs — no string logic.
 */

export { type ClinicalQuestion, type QuestionEngineOutput } from "../pipeline/types";

import type { CanonicalFeature } from "../canonical/types";
import type { ClinicalQuestion, QuestionEngineOutput, PipelineVitals } from "../pipeline/types";
import { getCanonicalEntry } from "../canonical/normalizer";

// ══════════════════════════════════════════════
// SYMPTOM PROTOCOLS — Canonical ID → Questions
// ══════════════════════════════════════════════

interface SymptomProtocol {
  trigger_id: string;
  questions: Omit<ClinicalQuestion, "question_id" | "triggered_by">[];
}

const PROTOCOLS: SymptomProtocol[] = [
  {
    trigger_id: "FEVER",
    questions: [
      { text: "How high is the fever?", category: "severity", priority: "high", options: ["Mild (37.5–38°C)", "Moderate (38–39°C)", "High (>39°C)"] },
      { text: "How long have you had the fever?", category: "duration", priority: "high" },
      { text: "Any chills or rigors?", category: "symptom_detail", priority: "medium" },
      { text: "Any recent travel history?", category: "risk_factor", priority: "medium" },
    ],
  },
  {
    trigger_id: "CHEST_PAIN",
    questions: [
      { text: "Is the pain radiating to your left arm or jaw?", category: "symptom_detail", priority: "critical" },
      { text: "Are you experiencing sweating or breathlessness?", category: "symptom_detail", priority: "critical" },
      { text: "Does the pain worsen with exertion?", category: "symptom_detail", priority: "high" },
      { text: "Have you had similar episodes before?", category: "history", priority: "high" },
    ],
  },
  {
    trigger_id: "HEADACHE",
    questions: [
      { text: "Any nausea or vomiting?", category: "symptom_detail", priority: "high" },
      { text: "Any sensitivity to light?", category: "symptom_detail", priority: "high" },
      { text: "Any neck stiffness?", category: "symptom_detail", priority: "critical" },
      { text: "Is the headache throbbing or constant?", category: "symptom_detail", priority: "medium" },
    ],
  },
  {
    trigger_id: "ABDOMINAL_PAIN",
    questions: [
      { text: "Where exactly is the pain located?", category: "symptom_detail", priority: "high" },
      { text: "Any nausea, vomiting, or diarrhea?", category: "symptom_detail", priority: "high" },
      { text: "Any blood in stool?", category: "symptom_detail", priority: "critical" },
      { text: "Is the pain related to meals?", category: "symptom_detail", priority: "medium" },
    ],
  },
  {
    trigger_id: "DYSPNEA",
    questions: [
      { text: "Does it occur at rest or with exertion?", category: "symptom_detail", priority: "high" },
      { text: "Any wheezing or chest tightness?", category: "symptom_detail", priority: "high" },
      { text: "Can you lie flat comfortably?", category: "symptom_detail", priority: "high" },
      { text: "Any leg swelling?", category: "symptom_detail", priority: "medium" },
    ],
  },
  {
    trigger_id: "DIZZINESS",
    questions: [
      { text: "Do you feel the room is spinning?", category: "symptom_detail", priority: "high" },
      { text: "Any hearing loss or ringing in ears?", category: "symptom_detail", priority: "medium" },
      { text: "Any recent falls or fainting?", category: "symptom_detail", priority: "high" },
    ],
  },
  {
    trigger_id: "COUGH",
    questions: [
      { text: "Is the cough dry or productive?", category: "symptom_detail", priority: "high" },
      { text: "Any blood in sputum?", category: "symptom_detail", priority: "critical" },
      { text: "Any associated fever or chest pain?", category: "symptom_detail", priority: "high" },
    ],
  },
];

const PROTOCOL_MAP = new Map(PROTOCOLS.map(p => [p.trigger_id, p]));

// ══════════════════════════════════════════════
// MINIMUM VIABLE CONTEXT
// ══════════════════════════════════════════════

interface ContextCheckInput {
  features: CanonicalFeature[];
  patient_age: number | null;
  patient_sex: string | null;
  vitals: PipelineVitals | null;
  allergies: string[];
  medications: string[];
  chief_complaint: CanonicalFeature | null;
}

/**
 * Generate clinical follow-up questions based on canonical features.
 */
export function generateQuestions(input: ContextCheckInput): QuestionEngineOutput {
  const questions: ClinicalQuestion[] = [];
  const missingCritical: string[] = [];
  let questionIndex = 0;

  // 1. Check critical demographics
  if (input.patient_age == null) {
    missingCritical.push("patient_age");
    questions.push({
      question_id: `q_${questionIndex++}`,
      text: "What is the patient's age?",
      category: "vital",
      priority: "critical",
      triggered_by: "DEMOGRAPHICS",
    });
  }
  if (!input.patient_sex) {
    missingCritical.push("patient_sex");
    questions.push({
      question_id: `q_${questionIndex++}`,
      text: "What is the patient's sex?",
      category: "vital",
      priority: "critical",
      triggered_by: "DEMOGRAPHICS",
      options: ["Male", "Female", "Other"],
    });
  }

  // 2. Check chief complaint
  if (!input.chief_complaint) {
    missingCritical.push("chief_complaint");
    questions.push({
      question_id: `q_${questionIndex++}`,
      text: "What is the primary reason for this visit?",
      category: "symptom_detail",
      priority: "critical",
      triggered_by: "INTAKE",
    });
  }

  // 3. Check allergy status
  if (input.allergies.length === 0) {
    questions.push({
      question_id: `q_${questionIndex++}`,
      text: "Does the patient have any known allergies?",
      category: "allergy",
      priority: "high",
      triggered_by: "SAFETY",
    });
  }

  // 4. Symptom-protocol-driven questions
  for (const feature of input.features) {
    const protocol = PROTOCOL_MAP.get(feature.feature_id);
    if (!protocol) continue;

    for (const q of protocol.questions) {
      questions.push({
        question_id: `q_${questionIndex++}`,
        text: q.text,
        category: q.category,
        priority: q.priority,
        triggered_by: feature.feature_id,
        options: q.options,
      });
    }
  }

  // 5. Minimum viable context check
  const hasCriticalData = input.chief_complaint != null
    && input.patient_age != null
    && input.patient_sex != null
    && input.features.length >= 1;

  return {
    questions,
    minimum_context_met: hasCriticalData,
    missing_critical_fields: missingCritical,
  };
}
