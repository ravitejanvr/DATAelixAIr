/**
 * Phase 6.7 — Weak Signal Diagnosis Activation
 *
 * Recovers missed diagnoses WITHIN already-activated clusters by detecting
 * atypical, indirect, or weak clinical signal patterns.
 *
 * Pipeline position:
 *   ... → expandKG() → 🆕 weakSignalDiagnosisActivation() → RecallRecovery → DDX
 *
 * Invariants:
 *   - Operates ONLY on diagnoses from activated clusters (no new clusters)
 *   - MAX 5 boosts per case
 *   - Weight range: 0.2–0.4
 *   - Never overpowers strong candidates
 *   - Pure function (no side effects beyond logging)
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import type { CandidateHint } from "@/services/context_candidate_expander";
import type { KGActivation } from "@/services/kg/kg_activation";
import { getClusterDiagnoses } from "@/services/kg/kg_clusters";
import { recordOversightEvent } from "@/services/oversight_engine";

// ── Constants ──

const MAX_WEAK_SIGNAL_BOOSTS = 5;
const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 0.4;

// ── Types ──

export interface WeakSignalBoost {
  diagnosis: string;
  weight: number;
  reason: string;
  cluster: string;
  source: "phase_6_7_weak_signal";
}

export interface WeakSignalActivationResult {
  candidates: CandidateHint[];
  boosts_applied: WeakSignalBoost[];
  total_scanned: number;
}

// ── Symptom Matcher Utility ──

function has(symptoms: string[], targets: string[]): boolean {
  const normalized = symptoms.map(s => s.toLowerCase().trim());
  return targets.every(t =>
    normalized.some(s => s.includes(t.toLowerCase()) || t.toLowerCase().includes(s))
  );
}

function hasAny(symptoms: string[], targets: string[]): boolean {
  const normalized = symptoms.map(s => s.toLowerCase().trim());
  return targets.some(t =>
    normalized.some(s => s.includes(t.toLowerCase()) || t.toLowerCase().includes(s))
  );
}

// ── Weak Signal Detection Rules ──

interface SignalResult {
  shouldBoost: boolean;
  weight: number;
  reason: string;
}

/**
 * Detect weak/atypical signal patterns for a specific diagnosis.
 * Each rule encodes real clinical knowledge about atypical presentations.
 */
function detectWeakSignal(
  symptoms: string[],
  age: number | undefined,
  medicalHistory: string[],
  riskFactors: string[],
  diagnosis: string,
  _cluster: string,
  isVague: boolean,
  systemsInvolved: number,
): SignalResult {
  const noResult: SignalResult = { shouldBoost: false, weight: 0, reason: "" };
  const dxLower = diagnosis.toLowerCase();

  // ── RESPIRATORY ──

  // Pneumonia: elderly atypical (confusion, fatigue instead of cough/fever)
  if (dxLower === "pneumonia") {
    if (age && age > 60 && hasAny(symptoms, ["fatigue", "confusion", "malaise", "weakness"])) {
      return { shouldBoost: true, weight: 0.4, reason: "elderly atypical pneumonia (confusion/fatigue without classic respiratory signs)" };
    }
    if (hasAny(symptoms, ["chest pain", "abdominal pain"]) && hasAny(symptoms, ["fever", "cough"])) {
      return { shouldBoost: true, weight: 0.35, reason: "atypical pneumonia with chest/abdominal pain" };
    }
    // Vague respiratory: cough + chest symptoms + systemic signs (no age required)
    if (hasAny(symptoms, ["cough", "mild cough", "productive cough"]) && hasAny(symptoms, ["chest heaviness", "chest tightness", "chest discomfort"]) && hasAny(symptoms, ["fatigue", "night sweats", "loss of appetite", "malaise"])) {
      return { shouldBoost: true, weight: 0.35, reason: "vague respiratory infection pattern (cough + chest symptoms + systemic signs)" };
    }
  }

  // Pleural Effusion: vague dyspnea + positional
  if (dxLower === "pleural effusion") {
    if (hasAny(symptoms, ["dyspnea", "shortness of breath", "breathlessness"]) && hasAny(symptoms, ["lying down", "orthopnea", "chest heaviness"])) {
      return { shouldBoost: true, weight: 0.35, reason: "positional dyspnea suggesting fluid collection" };
    }
  }

  // COPD Exacerbation: smoker with worsening baseline
  if (dxLower === "copd exacerbation") {
    if (hasAny(medicalHistory, ["copd", "chronic bronchitis", "emphysema"]) && hasAny(symptoms, ["worsening", "increased sputum"])) {
      return { shouldBoost: true, weight: 0.35, reason: "COPD history with symptom exacerbation" };
    }
  }

  // ── CARDIAC ──

  // Atrial Fibrillation: vague fatigue/weakness without palpitations
  if (dxLower === "atrial fibrillation") {
    if (age && age > 50 && hasAny(symptoms, ["fatigue", "weakness", "exercise intolerance", "dizziness"]) && !hasAny(symptoms, ["palpitations"])) {
      return { shouldBoost: true, weight: 0.35, reason: "atypical AF (fatigue/weakness without palpitations)" };
    }
  }

  // Stable Angina: exertional symptoms in cardiac risk profile
  if (dxLower === "stable angina") {
    if (hasAny(symptoms, ["exertional", "chest tightness", "chest discomfort"]) && hasAny(riskFactors, ["hypertension", "diabetes", "smoking", "hyperlipidemia"])) {
      return { shouldBoost: true, weight: 0.3, reason: "exertional chest symptoms with cardiac risk factors" };
    }
  }

  // Infective Endocarditis: subacute vague fever + fatigue
  if (dxLower === "infective endocarditis") {
    if (hasAny(symptoms, ["fatigue", "malaise"]) && hasAny(symptoms, ["fever"]) && hasAny(medicalHistory, ["valve", "prosthetic", "iv drug", "dental"])) {
      return { shouldBoost: true, weight: 0.35, reason: "subacute infection pattern with predisposing history" };
    }
  }

  // Heart Failure: non-classic presentation
  if (dxLower === "heart failure") {
    if (age && age > 55 && hasAny(symptoms, ["fatigue", "ankle swelling", "nocturnal cough", "weight gain"]) && !hasAny(symptoms, ["dyspnea"])) {
      return { shouldBoost: true, weight: 0.35, reason: "atypical HF without dyspnea" };
    }
  }

  // ── ABDOMINAL ──

  // Cholecystitis: referred shoulder pain
  if (dxLower === "cholecystitis") {
    if (hasAny(symptoms, ["shoulder pain", "right shoulder"]) && hasAny(symptoms, ["nausea", "vomiting", "abdominal pain"])) {
      return { shouldBoost: true, weight: 0.35, reason: "referred biliary pain pattern (Kehr's sign)" };
    }
  }

  // Pancreatitis: back pain + vomiting
  if (dxLower === "pancreatitis" || dxLower === "acute pancreatitis") {
    if (hasAny(symptoms, ["back pain", "epigastric"]) && hasAny(symptoms, ["vomiting", "nausea"])) {
      return { shouldBoost: true, weight: 0.35, reason: "epigastric-to-back radiation with vomiting" };
    }
  }

  // Bowel Obstruction: constipation + distension
  if (dxLower === "bowel obstruction") {
    if (hasAny(symptoms, ["constipation", "no stool"]) && hasAny(symptoms, ["distension", "bloating", "vomiting"])) {
      return { shouldBoost: true, weight: 0.3, reason: "obstipation with distension pattern" };
    }
  }

  // ── NEUROLOGICAL ──

  // Stroke: subtle unilateral signs
  if (dxLower === "stroke" || dxLower === "posterior circulation stroke") {
    if (hasAny(symptoms, ["dizziness", "vertigo", "visual"]) && hasAny(symptoms, ["weakness", "numbness", "unsteady"])) {
      return { shouldBoost: true, weight: 0.35, reason: "posterior circulation stroke pattern (vertigo + neuro deficit)" };
    }
  }

  // Meningitis: subtle presentation
  if (dxLower === "meningitis") {
    if (hasAny(symptoms, ["headache"]) && hasAny(symptoms, ["fever", "photophobia", "neck stiffness", "neck pain"]) && age && age < 30) {
      return { shouldBoost: true, weight: 0.35, reason: "young patient with headache + meningeal features" };
    }
  }

  // ── ENDOCRINE ──

  // DKA: polyuria/polydipsia + malaise
  if (dxLower === "diabetic ketoacidosis") {
    if (hasAny(symptoms, ["thirst", "polyuria", "nausea", "abdominal pain"]) && hasAny(medicalHistory, ["diabetes", "type 1"])) {
      return { shouldBoost: true, weight: 0.35, reason: "DKA prodrome in known diabetic" };
    }
  }

  // ── INFECTIOUS ──

  // Sepsis: subtle systemic signs in elderly/immunocompromised
  if (dxLower === "sepsis") {
    if (age && age > 65 && hasAny(symptoms, ["confusion", "lethargy", "weakness"]) && hasAny(symptoms, ["fever", "chills", "tachycardia"])) {
      return { shouldBoost: true, weight: 0.4, reason: "elderly sepsis with altered mental status" };
    }
  }

  // ── RENAL ──

  // AKI: subtle renal compromise
  if (dxLower === "acute kidney injury") {
    if (hasAny(symptoms, ["fatigue", "nausea", "decreased urine", "edema", "confusion"]) && (age && age > 50 || hasAny(medicalHistory, ["diabetes", "hypertension", "ckd", "kidney"]))) {
      return { shouldBoost: true, weight: 0.35, reason: "AKI risk with nephrotoxic history + nonspecific symptoms" };
    }
    if (hasAny(symptoms, ["oliguria", "anuria", "leg swelling", "edema"]) && hasAny(symptoms, ["fatigue", "nausea"])) {
      return { shouldBoost: true, weight: 0.3, reason: "fluid retention pattern suggesting renal compromise" };
    }
  }

  // ── AUTOIMMUNE ──

  // SLE: multi-system vague pattern
  if (dxLower === "sle") {
    if (hasAny(symptoms, ["joint pain", "fatigue", "rash", "photosensitivity", "oral ulcers", "arthralgia"])) {
      if (age && age < 50 && hasAny(symptoms, ["fatigue", "joint pain"])) {
        return { shouldBoost: true, weight: 0.3, reason: "young patient with multi-system inflammatory signals (fatigue + joints)" };
      }
    }
  }

  // ── ONCOLOGICAL ──

  // Lymphoma: constitutional symptoms
  if (dxLower === "lymphoma") {
    if (hasAny(symptoms, ["night sweats", "weight loss", "fatigue"]) && hasAny(symptoms, ["lymphadenopathy", "fever", "pruritus"])) {
      return { shouldBoost: true, weight: 0.3, reason: "B-symptoms pattern (night sweats + weight loss + lymphadenopathy)" };
    }
    if (hasAny(symptoms, ["weight loss", "fatigue", "night sweats"]) && age && age > 40) {
      return { shouldBoost: true, weight: 0.25, reason: "constitutional weight loss pattern in older patient" };
    }
  }

  // ── PSYCHIATRIC ──

  // Panic Attack/Disorder: somatic mimicry
  if (dxLower === "panic disorder" || dxLower === "panic attack") {
    if (hasAny(symptoms, ["palpitations", "chest tightness", "shortness of breath", "trembling"]) && hasAny(symptoms, ["anxiety", "fear", "dread", "numbness", "tingling"])) {
      return { shouldBoost: true, weight: 0.3, reason: "somatic panic presentation (palpitations + anxiety/fear)" };
    }
    if (hasAny(symptoms, ["chest pain", "dyspnea", "dizziness"]) && !hasAny(riskFactors, ["hypertension", "diabetes", "smoking"]) && age && age < 45) {
      return { shouldBoost: true, weight: 0.25, reason: "young patient with cardio-respiratory symptoms and low cardiac risk" };
    }
  }

  // ── MUSCULOSKELETAL ──

  // Spinal Stenosis: chronic neuro-MSK pattern
  if (dxLower === "spinal stenosis") {
    if (hasAny(symptoms, ["back pain", "leg pain", "claudication", "numbness"]) && age && age > 50) {
      return { shouldBoost: true, weight: 0.3, reason: "neurogenic claudication pattern in older patient" };
    }
    if (hasAny(symptoms, ["back pain", "walking difficulty"]) && hasAny(symptoms, ["leg weakness", "numbness"])) {
      return { shouldBoost: true, weight: 0.25, reason: "progressive spinal compression pattern" };
    }
  }

  // ── HEMATOLOGICAL ──

  // Anemia: subtle fatigue + pallor
  if (dxLower === "iron deficiency anemia" || dxLower === "anemia") {
    if (hasAny(symptoms, ["fatigue", "pallor", "weakness", "dizziness"]) && hasAny(symptoms, ["shortness of breath", "palpitations", "exercise intolerance"])) {
      return { shouldBoost: true, weight: 0.3, reason: "anemia symptom complex (fatigue + exertional symptoms)" };
    }
  }

  // ── CROSS-SYSTEM VAGUE PATTERN ──
  if (isVague && systemsInvolved >= 2) {
    // Only boost must-not-miss diagnoses for vague multi-system presentations
    return { shouldBoost: true, weight: MIN_WEIGHT, reason: "multi-system weak signal pattern (vague presentation)" };
  }

  return noResult;
}

// ── Core Function ──

/**
 * Scan activated clusters for diagnoses that match weak/atypical signal patterns
 * and inject or boost them in the candidate list.
 */
export function weakSignalDiagnosisActivation(
  ctx: ClinicalContext,
  candidates: CandidateHint[],
  activation: KGActivation,
): WeakSignalActivationResult {
  const symptoms = [
    ...(ctx.symptoms || []),
    ...(ctx.chief_complaint ? [ctx.chief_complaint] : []),
  ];
  const age = ctx.patient_age;
  const medicalHistory = ctx.medical_history || [];
  const riskFactors = ctx.risk_factors || [];
  const isVague = symptoms.length <= 3 || (ctx as any).is_vague_presentation === true;
  const systemsInvolved = new Set(Array.from(activation.nodes).map(n => n.split("_")[0])).size;

  const boosts: WeakSignalBoost[] = [];
  let totalScanned = 0;

  // Iterate only over activated clusters
  for (const nodeId of activation.nodes) {
    const clusterDiagnoses = getClusterDiagnoses(nodeId);
    if (clusterDiagnoses.length === 0) continue;

    for (const dx of clusterDiagnoses) {
      totalScanned++;

      const signal = detectWeakSignal(
        symptoms, age, medicalHistory, riskFactors,
        dx.diagnosis_name, nodeId, isVague, systemsInvolved,
      );

      if (!signal.shouldBoost) continue;

      // Clamp weight
      const clampedWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, signal.weight));

      boosts.push({
        diagnosis: dx.diagnosis_name,
        weight: clampedWeight,
        reason: signal.reason,
        cluster: nodeId,
        source: "phase_6_7_weak_signal",
      });
    }
  }

  // Deduplicate: keep highest-weight boost per diagnosis
  const dedupMap = new Map<string, WeakSignalBoost>();
  for (const boost of boosts) {
    const key = boost.diagnosis.toLowerCase().trim();
    const existing = dedupMap.get(key);
    if (!existing || boost.weight > existing.weight) {
      dedupMap.set(key, boost);
    }
  }

  // Sort by weight desc, cap at MAX_WEAK_SIGNAL_BOOSTS
  const sortedBoosts = [...dedupMap.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_WEAK_SIGNAL_BOOSTS);

  // Merge into candidates
  const updatedCandidates = [...candidates];
  for (const boost of sortedBoosts) {
    const existingIdx = updatedCandidates.findIndex(
      c => c.diagnosis_name.toLowerCase().trim() === boost.diagnosis.toLowerCase().trim()
    );

    if (existingIdx >= 0) {
      // Boost existing candidate score (additive, capped)
      const existing = updatedCandidates[existingIdx];
      const boostedConfidence = Math.min(existing.confidence + boost.weight * 0.5, 0.95);
      updatedCandidates[existingIdx] = {
        ...existing,
        confidence: Math.round(boostedConfidence * 100) / 100,
        reasoning: `${existing.reasoning} | WSA: ${boost.reason}`,
      };
    } else {
      // Add new candidate from weak signal
      updatedCandidates.push({
        diagnosis_name: boost.diagnosis,
        source: "context_signal",
        confidence: Math.round(boost.weight * 100) / 100,
        reasoning: `WeakSignal[${boost.cluster}]: ${boost.reason}`,
      });
    }

    // Log each boost as oversight event
    recordOversightEvent({
      event_type: "phase6_safetynet" as any,
      severity: "info",
      stage: "weak_signal_activation",
      message: `WSA boost: ${boost.diagnosis} (+${boost.weight}) — ${boost.reason}`,
      metadata: {
        diagnosis: boost.diagnosis,
        weight: boost.weight,
        cluster: boost.cluster,
        reason: boost.reason,
        was_existing: existingIdx >= 0,
      } as any,
    });
  }

  if (sortedBoosts.length > 0) {
    console.log(
      `[Phase6.7] WeakSignalActivation: ${sortedBoosts.length} boosts applied ` +
      `(${totalScanned} scanned). Diagnoses: [${sortedBoosts.map(b => b.diagnosis).join(", ")}]`
    );
  }

  return {
    candidates: updatedCandidates,
    boosts_applied: sortedBoosts,
    total_scanned: totalScanned,
  };
}
