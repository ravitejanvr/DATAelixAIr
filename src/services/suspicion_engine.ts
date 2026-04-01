/**
 * Phase 6.2 — Clinical Suspicion Engine
 *
 * Generates suspicion signals BEFORE KG expansion by detecting:
 *   1. Risk-based patterns (must-not-miss combinations)
 *   2. Abstract clinical patterns (vague/progressive/systemic)
 *   3. Cross-system triggers (symptoms in one system implying another)
 *   4. Contextual signals (medications, age, history)
 *
 * Output: SuspicionSignal[] → converted to KGActivation for merging.
 *
 * Invariants:
 *   - Pure function (no side effects, no mutation)
 *   - Does NOT inject diagnoses (activates clusters only)
 *   - All signals traced with reason
 */

import type { ClinicalContext } from "@/lib/clinical-context";
import { normalizeSymptom } from "@/services/context_engine/terminology_normalizer";
import { createEmptyActivation, activateNode, type KGActivation } from "@/services/kg/kg_activation";

// ── Types ──

export interface SuspicionSignal {
  cluster: string;
  weight: number;
  reason: string;
  type: "risk" | "pattern" | "context" | "cross_system";
}

export interface SuspicionResult {
  signals: SuspicionSignal[];
  activation: KGActivation;
  signal_count: number;
}

// ── Helpers ──

function syms(ctx: ClinicalContext): Set<string> {
  const raw: string[] = [];
  if (ctx.chief_complaint) raw.push(ctx.chief_complaint);
  if (ctx.symptoms?.length) raw.push(...ctx.symptoms);
  if (ctx.associated_symptoms?.length) raw.push(...ctx.associated_symptoms);
  return new Set(raw.map(s => normalizeSymptom(s).toLowerCase()));
}

function has(set: Set<string>, ...keywords: string[]): boolean {
  return keywords.some(k => [...set].some(s => s.includes(k) || k.includes(s)));
}

function histHas(ctx: ClinicalContext, ...kw: string[]): boolean {
  const all = [...(ctx.medical_history || []), ...(ctx.risk_factors || [])].map(h => h.toLowerCase());
  return kw.some(k => all.some(h => h.includes(k)));
}

function medHas(ctx: ClinicalContext, ...kw: string[]): boolean {
  const meds = (ctx.current_medications || []).map(m => m.toLowerCase());
  return kw.some(k => meds.some(m => m.includes(k)));
}

function bpSys(ctx: ClinicalContext): number | null {
  if (!ctx.blood_pressure) return null;
  const v = parseInt(ctx.blood_pressure.split("/")[0]);
  return isNaN(v) ? null : v;
}

const MAX_SUSPICION_SIGNALS = 6;

// ── Signal Rules ──

interface SuspicionRule {
  id: string;
  type: SuspicionSignal["type"];
  cluster: string;
  weight: number;
  reason: string;
  test: (ctx: ClinicalContext, sym: Set<string>) => boolean;
}

const SUSPICION_RULES: SuspicionRule[] = [
  // ═══ 1. RISK-BASED (Must-not-miss combos) ═══

  {
    id: "risk_chest_syncope",
    type: "risk",
    cluster: "hemodynamic_instability",
    weight: 0.7,
    reason: "Chest pain + syncope → PE / arrhythmia / tamponade",
    test: (ctx, sym) =>
      has(sym, "chest pain", "chest pressure", "chest tightness") &&
      has(sym, "syncope", "faint", "collapse", "presyncope"),
  },
  {
    id: "risk_abdo_hypotension",
    type: "risk",
    cluster: "hemodynamic_instability",
    weight: 0.8,
    reason: "Abdominal pain + hypotension → rupture / bleed",
    test: (ctx, sym) =>
      has(sym, "abdominal pain") &&
      (bpSys(ctx) !== null && bpSys(ctx)! < 100),
  },
  {
    id: "risk_headache_neuro_deficit",
    type: "risk",
    cluster: "atypical_neuro",
    weight: 0.7,
    reason: "Severe headache + focal neuro deficit → stroke / SAH",
    test: (ctx, sym) =>
      has(sym, "headache", "thunderclap") &&
      has(sym, "weakness", "facial droop", "speech difficulty", "visual field", "hemiparesis"),
  },
  {
    id: "risk_dyspnea_tachycardia_hypoxia",
    type: "risk",
    cluster: "respiratory",
    weight: 0.7,
    reason: "Dyspnea + tachycardia + hypoxia → PE / pneumothorax",
    test: (ctx, sym) =>
      has(sym, "dyspnea", "breathless", "shortness of breath") &&
      (ctx.pulse != null && ctx.pulse > 100) &&
      (ctx.oxygen_saturation != null && ctx.oxygen_saturation < 94),
  },
  {
    id: "risk_fever_rash_shock",
    type: "risk",
    cluster: "rare_infectious",
    weight: 0.8,
    reason: "Fever + rash + hemodynamic compromise → meningococcemia / TSS",
    test: (ctx, sym) =>
      has(sym, "fever") &&
      has(sym, "rash", "petechial", "purpur") &&
      ((ctx.pulse != null && ctx.pulse > 110) || (bpSys(ctx) !== null && bpSys(ctx)! < 100)),
  },
  {
    id: "risk_back_pain_neuro",
    type: "risk",
    cluster: "spinal",
    weight: 0.7,
    reason: "Back pain + bladder/bowel symptoms → cauda equina",
    test: (ctx, sym) =>
      has(sym, "back pain", "lumbar") &&
      has(sym, "urinary incontinence", "urinary retention", "saddle", "bowel incontinence", "bilateral leg weakness"),
  },

  // ═══ 2. PATTERN-BASED (Abstract clinical patterns) ═══

  {
    id: "pattern_vague_progressive_systemic",
    type: "pattern",
    cluster: "chronic_subacute",
    weight: 0.4,
    reason: "Vague + progressive + systemic symptoms → malignancy / autoimmune",
    test: (ctx, sym) => {
      const vague = has(sym, "fatigue", "malaise", "weakness", "weight loss");
      const progressive = has(sym, "progressive", "worsening", "gradual");
      const systemic = has(sym, "night sweats", "fever", "loss of appetite");
      return vague && (progressive || systemic);
    },
  },
  {
    id: "pattern_neuro_fluctuating",
    type: "pattern",
    cluster: "atypical_neuro",
    weight: 0.5,
    reason: "Neurological symptoms + fluctuating course → seizure / metabolic encephalopathy",
    test: (ctx, sym) =>
      has(sym, "confusion", "altered consciousness", "disorientation") &&
      has(sym, "fluctuating", "waxing", "intermittent", "episodic"),
  },
  {
    id: "pattern_acute_bilateral",
    type: "pattern",
    cluster: "atypical_neuro",
    weight: 0.5,
    reason: "Acute bilateral weakness → GBS / spinal cord / metabolic",
    test: (ctx, sym) =>
      has(sym, "bilateral", "ascending weakness", "bilateral leg weakness") &&
      has(sym, "acute", "rapid", "sudden"),
  },
  {
    id: "pattern_recurrent_colicky",
    type: "pattern",
    cluster: "abdominal",
    weight: 0.4,
    reason: "Recurrent colicky pain → obstruction / renal / biliary",
    test: (ctx, sym) =>
      has(sym, "colicky", "cramping", "intermittent") &&
      has(sym, "abdominal pain", "flank pain"),
  },

  // ═══ 3. CROSS-SYSTEM TRIGGERS ═══

  {
    id: "cross_gi_cardiac",
    type: "cross_system",
    cluster: "atypical_cardiac",
    weight: 0.5,
    reason: "GI symptoms + cardiac risk factors → atypical MI",
    test: (ctx, sym) =>
      has(sym, "epigastric", "nausea", "indigestion") &&
      (histHas(ctx, "diabetes", "hypertension", "cardiac", "smoking") || (ctx.patient_age != null && ctx.patient_age > 50)) &&
      !has(sym, "chest pain"),
  },
  {
    id: "cross_neuro_infection",
    type: "cross_system",
    cluster: "rare_infectious",
    weight: 0.6,
    reason: "Neurological symptoms + fever/infection signs → meningitis / encephalitis",
    test: (ctx, sym) =>
      has(sym, "confusion", "headache", "neck stiffness", "photophobia", "altered consciousness") &&
      has(sym, "fever"),
  },
  {
    id: "cross_resp_cardiac",
    type: "cross_system",
    cluster: "atypical_cardiac",
    weight: 0.4,
    reason: "Respiratory distress + edema → heart failure",
    test: (ctx, sym) =>
      has(sym, "dyspnea", "orthopnea", "paroxysmal nocturnal dyspnea") &&
      has(sym, "peripheral edema", "edema", "swollen legs"),
  },
  {
    id: "cross_skin_systemic",
    type: "cross_system",
    cluster: "allergic",
    weight: 0.6,
    reason: "Rash + systemic instability → anaphylaxis / drug reaction / vasculitis",
    test: (ctx, sym) =>
      has(sym, "rash", "urticaria", "angioedema") &&
      (has(sym, "dyspnea", "wheezing", "hypotension") || (bpSys(ctx) !== null && bpSys(ctx)! < 100)),
  },

  // ═══ 4. CONTEXTUAL SIGNALS ═══

  {
    id: "ctx_medication_toxicity",
    type: "context",
    cluster: "toxicological",
    weight: 0.5,
    reason: "Medication history suggests toxicological risk",
    test: (ctx, sym) =>
      medHas(ctx, "lithium", "digoxin", "warfarin", "metformin", "ssri", "maoi", "antipsychotic", "neuroleptic") &&
      has(sym, "confusion", "nausea", "tremor", "seizure", "palpitations", "blurred vision"),
  },
  {
    id: "ctx_elderly_fall",
    type: "context",
    cluster: "atypical_neuro",
    weight: 0.4,
    reason: "Elderly + fall / altered consciousness → subdural / stroke / metabolic",
    test: (ctx, sym) =>
      (ctx.patient_age != null && ctx.patient_age >= 65) &&
      has(sym, "fall", "found on floor", "confusion", "altered consciousness", "drowsy"),
  },
  {
    id: "ctx_pediatric_distress",
    type: "context",
    cluster: "pediatric_surgical",
    weight: 0.5,
    reason: "Pediatric age + acute abdomen / bilious vomiting",
    test: (ctx, sym) =>
      (ctx.patient_age != null && ctx.patient_age < 5) &&
      has(sym, "vomiting", "abdominal pain", "bilious", "distension", "irritable"),
  },
  {
    id: "ctx_immunocompromised",
    type: "context",
    cluster: "sepsis",
    weight: 0.5,
    reason: "Immunocompromised + any infection sign → opportunistic / sepsis",
    test: (ctx, sym) =>
      (histHas(ctx, "hiv", "transplant", "chemotherapy", "immunosuppressed") || medHas(ctx, "methotrexate", "cyclosporine", "tacrolimus")) &&
      has(sym, "fever", "cough", "diarrhea", "rash"),
  },
  {
    id: "ctx_pregnancy_complications",
    type: "context",
    cluster: "obstetric",
    weight: 0.6,
    reason: "Pregnant + concerning symptoms → eclampsia / ectopic / HELLP",
    test: (ctx, sym) =>
      histHas(ctx, "pregnant", "pregnancy", "gravida") &&
      has(sym, "headache", "seizure", "abdominal pain", "blurred vision", "edema"),
  },
];

// ── Main Function ──

/**
 * Generate clinical suspicion signals from context.
 * Returns both signals (for audit) and KGActivation (for pipeline merge).
 */
export function generateSuspicionSignals(ctx: ClinicalContext): SuspicionResult {
  const symptomSet = syms(ctx);
  const signals: SuspicionSignal[] = [];
  const activation = createEmptyActivation();

  for (const rule of SUSPICION_RULES) {
    if (signals.length >= MAX_SUSPICION_SIGNALS) break;

    try {
      if (rule.test(ctx, symptomSet)) {
        signals.push({
          cluster: rule.cluster,
          weight: rule.weight,
          reason: rule.reason,
          type: rule.type,
        });
        // Risk-based signals that target MNM clusters get the MNM flag
        const isMNM = rule.type === "risk" && rule.weight >= 0.7;
        activateNode(activation, rule.cluster, rule.weight, `suspicion_${rule.id}`, "context_expander", isMNM);
      }
    } catch (e) {
      console.warn(`[SuspicionEngine] Rule ${rule.id} threw:`, e);
    }
  }

  if (signals.length > 0) {
    console.log(
      `[SuspicionEngine] Generated ${signals.length} suspicion signals: ` +
      `[${signals.map(s => `${s.type}:${s.cluster}(${s.weight})`).join(", ")}]`
    );
  }

  return { signals, activation, signal_count: signals.length };
}
