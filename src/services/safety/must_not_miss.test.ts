/**
 * Must-not-miss escalation as its own deterministic surface (ROADMAP item 10).
 *
 * Everything here runs the evaluator alone — no DDX, no Bayesian ranking, no
 * network — so must-not-miss detection is measured independently of
 * differential accuracy. The item 6/7 V1-vs-V3 run showed the two move
 * independently; a blended accuracy number hides that.
 */
import { describe, expect, it } from "vitest";
import {
  evaluateMustNotMiss,
  listMustNotMissConcepts,
  listMustNotMissRuleIds,
  MNM_RULESET_VERSION,
  temperatureCelsius,
  toClinicalSafetyShape,
  type MnmInput,
} from "../../../supabase/functions/_shared/must_not_miss.ts";
import { getAllCanonicalIds, getCanonicalEntry } from "@/services/canonical";
import { ALL_NEW_CASES } from "@/services/benchmark_v10";

const escalations = (input: MnmInput) =>
  evaluateMustNotMiss(input).triggers.filter(t => t.tier === "escalation").map(t => t.rule_id);

// ── One or more must-escalate presentations per escalation rule ──
// Free text, Hinglish/Indic phrasings and canonical-ID-only inputs, since the
// three callers send all three.
const MUST_ESCALATE: Array<{ name: string; input: MnmInput; rule: string }> = [
  { name: "ACS: chest pain radiating to arm", rule: "acs", input: { symptoms: ["crushing chest pain radiating to left arm"] } },
  { name: "ACS: chest pain + sweating", rule: "acs", input: { symptoms: ["chest pain", "sweating"] } },
  { name: "ACS: Hinglish chest pain + nausea", rule: "acs", input: { symptoms: ["seene mein dard", "nausea"] } },
  { name: "ACS: chest pain + HR 110", rule: "acs", input: { symptoms: ["chest pain"], vitals: { pulse: 110 } } },
  { name: "ACS: canonical IDs only", rule: "acs", input: { features: ["CHEST_PAIN", "DIAPHORESIS"] } },
  { name: "ACS: diabetic, atypical (fatigue + nausea)", rule: "diabetic_acs_risk", input: { symptoms: ["tired", "mild nausea"], history: ["type 2 diabetes"] } },
  { name: "ACS: elderly, atypical (3 signals)", rule: "elderly_acs_atypical", input: { symptoms: ["fatigue", "breathless", "nausea"], age: 78 } },
  { name: "Meningitis: fever + stiff neck", rule: "meningitis", input: { symptoms: ["fever", "stiff neck"] } },
  { name: "Meningitis: febrile vital + neck rigidity", rule: "meningitis", input: { symptoms: ["neck rigidity"], vitals: { temperature: 39.2 } } },
  { name: "Meningitis: headache + photophobia, Hinglish fever", rule: "meningitis", input: { symptoms: ["bukhar", "sir dard", "light sensitivity"] } },
  { name: "PE: breathless + hemoptysis", rule: "pulmonary_embolism", input: { symptoms: ["shortness of breath", "coughing up blood"] } },
  { name: "PE: dyspnea + pleuritic pain", rule: "pulmonary_embolism", input: { features: ["DYSPNEA", "PLEURITIC_CHEST_PAIN"] } },
  { name: "Stroke: facial droop + arm weakness", rule: "stroke", input: { symptoms: ["facial droop", "left arm weakness"] } },
  { name: "Stroke: slurred speech + weakness", rule: "stroke", input: { symptoms: ["slurred speech", "weakness on right side"] } },
  { name: "Stroke: thunderclap headache", rule: "stroke", input: { symptoms: ["worst headache of my life"] } },
  { name: "Neuro deficit: seizure", rule: "neurological_deficit", input: { symptoms: ["had a seizure this morning"] } },
  { name: "Neuro deficit: dysarthria", rule: "neurological_deficit", input: { symptoms: ["dysarthria"] } },
  { name: "Sepsis: SIRS (°F) + infection", rule: "sepsis", input: { symptoms: ["infected wound on foot"], vitals: { temperature: 101.8, pulse: 112 } } },
  { name: "Sepsis: fever + confusion + tachycardia", rule: "sepsis", input: { symptoms: ["fever", "confused"], vitals: { pulse: 118 } } },
  { name: "Sepsis: neonate with fever", rule: "neonatal_sepsis_risk", input: { symptoms: ["fever"], age: 0.05 } },
  { name: "Anaphylaxis: hives + breathless", rule: "anaphylaxis", input: { symptoms: ["hives all over", "difficulty breathing"] } },
  { name: "Anaphylaxis: rash + dyspnea + lip swelling", rule: "anaphylaxis", input: { features: ["RASH", "DYSPNEA", "SWELLING"] } },
  { name: "Cauda equina: back pain + saddle anaesthesia", rule: "cauda_equina", input: { symptoms: ["low back pain", "saddle numbness"] } },
  { name: "Hypertensive crisis: SBP 190", rule: "hypertensive_crisis", input: { symptoms: ["headache"], vitals: { bp_systolic: 190, bp_diastolic: 110 } } },
  { name: "Hypertensive crisis: DBP 125", rule: "hypertensive_crisis", input: { vitals: { bp_systolic: 170, bp_diastolic: 125 } } },
  { name: "Respiratory distress: SpO₂ 86", rule: "respiratory_distress", input: { symptoms: ["wheezing"], vitals: { spo2: 86 } } },
  { name: "Hypoglycemia: sugar 45", rule: "hypoglycemic_emergency", input: { symptoms: ["drowsy"], vitals: { blood_sugar: 45 } } },
  { name: "Severe dehydration: vomiting + HR 130", rule: "severe_dehydration", input: { symptoms: ["vomiting", "diarrhea"], vitals: { pulse: 130 } } },
  { name: "DKA: diabetic + sugar 350", rule: "vital_dka_confirmed", input: { history: ["diabetic"], vitals: { blood_sugar: 350 } } },
  { name: "Shock: elderly + SBP 85", rule: "elderly_shock_risk", input: { age: 72, vitals: { bp_systolic: 85 } } },
  { name: "Vital: SpO₂ 91", rule: "vital_spo2_low", input: { vitals: { spo2: 91 } } },
  { name: "Vital: SBP 85", rule: "vital_bp_systolic_low", input: { vitals: { bp_systolic: 85 } } },
  { name: "Vital: SBP 180", rule: "vital_bp_systolic_high", input: { vitals: { bp_systolic: 180 } } },
  { name: "Vital: DBP 50", rule: "vital_bp_diastolic_low", input: { vitals: { bp_diastolic: 50 } } },
  { name: "Vital: DBP 120", rule: "vital_bp_diastolic_high", input: { vitals: { bp_diastolic: 120 } } },
  { name: "Vital: HR 40", rule: "vital_pulse_low", input: { vitals: { pulse: 40 } } },
  { name: "Vital: HR 150", rule: "vital_pulse_high", input: { vitals: { pulse: 150 } } },
  { name: "Vital: temp 34.5°C", rule: "vital_temperature_low", input: { vitals: { temperature: 34.5 } } },
  { name: "Vital: temp 104.5°F", rule: "vital_temperature_high", input: { vitals: { temperature: 104.5 } } },
  { name: "Vital: RR 8", rule: "vital_respiratory_rate_low", input: { vitals: { respiratory_rate: 8 } } },
  { name: "Vital: RR 32", rule: "vital_respiratory_rate_high", input: { vitals: { respiratory_rate: 32 } } },
  { name: "Vital: sugar 50", rule: "vital_blood_sugar_low", input: { vitals: { blood_sugar: 50 } } },
  { name: "Vital: sugar 450", rule: "vital_blood_sugar_high", input: { vitals: { blood_sugar: 450 } } },
];

const MUST_NOT_ESCALATE: Array<{ name: string; input: MnmInput }> = [
  { name: "Common cold, normal vitals", input: { symptoms: ["runny nose", "sore throat", "mild cough"], vitals: { temperature: 37.2, pulse: 78, spo2: 98, bp_systolic: 118, bp_diastolic: 76, respiratory_rate: 16 } } },
  { name: "Tension headache", input: { symptoms: ["headache", "neck muscle tightness"], vitals: { bp_systolic: 124, bp_diastolic: 80 }, age: 34 } },
  { name: "Ankle sprain", input: { symptoms: ["ankle pain", "swelling after twisting"], vitals: { pulse: 82 } } },
  { name: "Mild gastroenteritis, normal HR", input: { symptoms: ["loose stools", "vomiting once"], vitals: { pulse: 88, temperature: 37.6 } } },
  { name: "Viral fever without SIRS", input: { symptoms: ["fever", "body aches"], vitals: { temperature: 38.3, pulse: 88, respiratory_rate: 18 } } },
  { name: "Feeling weak (not focal) — 'weak' is not a motor deficit", input: { symptoms: ["feeling weak and tired"] } },
  { name: "No input", input: {} },
];

describe("must-not-miss escalation surface", () => {
  it.each(MUST_ESCALATE)("escalates: $name", ({ input, rule }) => {
    const result = evaluateMustNotMiss(input);
    expect(result.escalate).toBe(true);
    expect(escalations(input)).toContain(rule);
  });

  it.each(MUST_NOT_ESCALATE)("does not escalate: $name", ({ input }) => {
    expect(escalations(input)).toEqual([]);
    expect(evaluateMustNotMiss(input).escalate).toBe(false);
  });

  it("every rule that can escalate has a must-escalate case above", () => {
    const covered = new Set(MUST_ESCALATE.map(c => c.rule));
    const advisoryOnly = new Set([
      // These rules are advisory by design (see the tier notes in must_not_miss.ts).
      "dka", "appendicitis", "diabetic_sepsis_risk", "diabetic_dka_risk", "htn_stroke_risk",
      "htn_dissection_risk", "smoker_pe_risk", "af_stroke_risk", "thrombo_pe_risk",
      "immuno_infection_risk", "pregnancy_pe_risk", "pregnancy_preeclampsia_risk",
      "elderly_pe_risk", "peds_meningitis_risk", "peds_intussusception",
    ]);
    const uncovered = listMustNotMissRuleIds().filter(id => !covered.has(id) && !advisoryOnly.has(id));
    expect(uncovered).toEqual([]);
  });

  it("records the rule-set version and evidence on every trigger", () => {
    const r = evaluateMustNotMiss({ symptoms: ["chest pain", "sweating"], vitals: { spo2: 90 } });
    expect(r.ruleset_version).toBe(MNM_RULESET_VERSION);
    for (const t of r.triggers) expect(t.evidence.length).toBeGreaterThan(0);
  });
});

describe("determinism and input handling", () => {
  it("is deterministic and does not mutate its input", () => {
    const vitals = Object.freeze({ temperature: 101.5, pulse: 112, respiratory_rate: 24 });
    const input: MnmInput = Object.freeze({ symptoms: Object.freeze(["fever", "chills"]) as string[], vitals });
    const a = evaluateMustNotMiss(input);
    const b = evaluateMustNotMiss(input);
    expect(a).toEqual(b);
    expect(vitals.temperature).toBe(101.5);
  });

  it("treats °F and °C temperatures identically", () => {
    expect(temperatureCelsius(102.2)).toBe(39);
    const f = evaluateMustNotMiss({ symptoms: ["stiff neck"], vitals: { temperature: 102.2 } });
    const c = evaluateMustNotMiss({ symptoms: ["stiff neck"], vitals: { temperature: 39 } });
    expect(f.triggers.map(t => t.rule_id)).toEqual(c.triggers.map(t => t.rule_id));
  });

  // Regression: clinical-safety converted the shared vitals object to °C in
  // place, then compared it against °F SIRS thresholds (`temp < 96.8`), so the
  // temperature criterion was met for every patient — including ones with no
  // temperature recorded.
  it("does not count a normal or missing temperature as a SIRS criterion", () => {
    expect(escalations({ symptoms: ["fever"], vitals: { temperature: 37.0, pulse: 95 } })).not.toContain("sepsis");
    expect(escalations({ symptoms: ["infected wound"], vitals: { pulse: 95 } })).not.toContain("sepsis");
    expect(escalations({ symptoms: ["infected wound"], vitals: { temperature: 98.6, pulse: 95 } })).not.toContain("sepsis");
    expect(escalations({ symptoms: ["infected wound"], vitals: { temperature: 100.9, pulse: 95 } })).toContain("sepsis");
  });

  it("matches terms at word starts only", () => {
    // "arm" must not match "warm"; "weakness" is required, not "weak".
    expect(escalations({ symptoms: ["chest pain", "feels warm"] })).not.toContain("acs");
    expect(escalations({ symptoms: ["chest pain", "pain goes to my arm"] })).toContain("acs");
  });

  it("matches comorbidity keywords as whole words", () => {
    // Legacy substring matching read "after" as atrial fibrillation and "admitted" as DM.
    const r = evaluateMustNotMiss({ symptoms: ["headache"], history: ["admitted after a fall"] });
    expect(r.triggers.map(t => t.rule_id)).toEqual([]);
  });
});

describe("monotonicity: more evidence never removes an escalation", () => {
  const BASES: MnmInput[] = [
    ...MUST_ESCALATE.map(c => c.input),
    ...MUST_NOT_ESCALATE.map(c => c.input),
  ];
  const ADDED_SYMPTOMS = ["chest pain", "fever", "confusion", "weakness", "rash", "breathless", "vomiting", "headache", "back pain", "sweating"];
  const WORSENED_VITALS: Array<Partial<NonNullable<MnmInput["vitals"]>>> = [
    { spo2: 85 }, { pulse: 160 }, { bp_systolic: 70 }, { temperature: 40.5 }, { respiratory_rate: 34 }, { blood_sugar: 40 },
  ];

  it("adding a symptom keeps every prior escalation", () => {
    for (const base of BASES) {
      const before = escalations(base);
      for (const s of ADDED_SYMPTOMS) {
        const after = escalations({ ...base, symptoms: [...(base.symptoms ?? []), s] });
        for (const id of before) expect(after, `${JSON.stringify(base)} + ${s}`).toContain(id);
      }
    }
  });

  it("recording a new abnormal vital keeps every prior escalation", () => {
    for (const base of BASES) {
      const before = escalations(base);
      for (const w of WORSENED_VITALS) {
        const key = Object.keys(w)[0] as keyof NonNullable<MnmInput["vitals"]>;
        if (base.vitals?.[key] != null) continue; // only add, never replace, a reading
        const after = escalations({ ...base, vitals: { ...(base.vitals ?? {}), ...w } });
        for (const id of before) expect(after, `${JSON.stringify(base)} + ${JSON.stringify(w)}`).toContain(id);
      }
    }
  });

  it("adding history or age keeps every prior escalation", () => {
    for (const base of BASES) {
      const before = escalations(base);
      for (const extra of [{ history: [...(base.history ?? []), "diabetes", "hypertension", "atrial fibrillation"] }, { age: base.age ?? 80 }]) {
        const after = escalations({ ...base, ...extra });
        for (const id of before) expect(after, `${JSON.stringify(base)} + ${JSON.stringify(extra)}`).toContain(id);
      }
    }
  });
});

describe("vocabulary stays in sync with the canonical map", () => {
  // A misspelt canonical ID would silently never match — exactly the kind of
  // quiet failure this suite exists to catch.
  it("every canonical ID a concept relies on exists", () => {
    const known = new Set(getAllCanonicalIds());
    const missing = Object.entries(listMustNotMissConcepts())
      .flatMap(([k, c]) => c.ids.filter(id => !known.has(id)).map(id => `${k}:${id}`));
    expect(missing).toEqual([]);
  });

  // Edge functions can't import the canonical normalizer, so they rely on
  // the concepts' text terms. Every canonical synonym must therefore be
  // matched by the text terms, or the server path would miss what the client
  // path catches.
  it("text terms cover every canonical synonym of their IDs", () => {
    const TOO_GENERIC = new Set(["temperature", "sob", "edema", "fluid retention"]);
    const gaps: string[] = [];
    for (const [k, c] of Object.entries(listMustNotMissConcepts())) {
      for (const id of c.ids) {
        const e = getCanonicalEntry(id);
        if (!e) continue;
        for (const syn of [e.label, ...e.synonyms].map(s => s.toLowerCase())) {
          if (TOO_GENERIC.has(syn)) continue;
          const viaText = evaluateMustNotMissConcept(k, syn);
          if (!viaText) gaps.push(`${k}/${id}: "${syn}"`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });
});

function evaluateMustNotMissConcept(concept: string, text: string): boolean {
  const c = listMustNotMissConcepts()[concept];
  return c.terms.some(t =>
    new RegExp(`(?<![\\p{L}\\p{N}])${t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u").test(text),
  );
}

describe("benchmark v10 cases, evaluator alone (decoupled from DDX)", () => {
  // Ratchet floors measured 2026-10-02 on this rule set (ruleset
  // mnm-2026.10.02-1). The legacy paths, combined, reached 50/90 and 24/30.
  // Raise these when rules improve; never lower them without a recorded reason.
  const SENSITIVITY_FLOOR = 55; // of 90 safety_expected cases
  const SPECIFICITY_FLOOR = 24; // of 30 non-safety cases
  const ADVERSARIAL_FLOOR = 19; // of 30 adversarial cases

  const rows = ALL_NEW_CASES.map(c => {
    const i = c.input;
    const ageMatch = (i.risk_factors ?? []).map(r => /\bage (\d+)/i.exec(r)).find(Boolean);
    const r = evaluateMustNotMiss({
      symptoms: [i.chief_complaint, ...i.symptoms, ...(i.associated_symptoms ?? [])],
      vitals: i.vitals,
      age: ageMatch ? Number(ageMatch[1]) : null,
      history: [...i.history, ...(i.risk_factors ?? [])],
    });
    return { c, escalate: r.escalate };
  });

  it("meets the sensitivity / specificity floors", () => {
    const pos = rows.filter(r => r.c.evaluation.safety_expected);
    const neg = rows.filter(r => !r.c.evaluation.safety_expected);
    expect(pos.length).toBe(90);
    expect(neg.length).toBe(30);
    expect(pos.filter(r => r.escalate).length).toBeGreaterThanOrEqual(SENSITIVITY_FLOOR);
    expect(neg.filter(r => !r.escalate).length).toBeGreaterThanOrEqual(SPECIFICITY_FLOOR);
  });

  it("meets the adversarial-layer floor", () => {
    const adv = rows.filter(r => r.c.layer === "adversarial");
    expect(adv.length).toBe(30);
    expect(adv.filter(r => r.escalate).length).toBeGreaterThanOrEqual(ADVERSARIAL_FLOOR);
  });
});

describe("clinical-safety response adapter", () => {
  it("maps escalations to critical and advisories to warning", () => {
    const shape = toClinicalSafetyShape(
      evaluateMustNotMiss({ symptoms: ["chest pain", "sweating"], vitals: { spo2: 93, pulse: 155 } }),
    );
    expect(shape.emergency_patterns.find(p => p.pattern === "Possible Acute Coronary Syndrome")?.severity).toBe("critical");
    expect(shape.vitals_dangers.find(v => v.parameter === "Heart Rate")?.severity).toBe("critical");
    expect(shape.vitals_dangers.find(v => v.parameter === "SpO₂")?.severity).toBe("warning");
  });
});
