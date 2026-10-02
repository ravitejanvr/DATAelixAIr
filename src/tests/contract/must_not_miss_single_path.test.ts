/**
 * Contract Test — One Safety-Detection Path (ROADMAP item 9)
 *
 * WHY THIS EXISTS
 * ---------------
 * Until 2026-10-02 the same must-not-miss presentations were checked by three
 * independent rule sets (clinical-safety edge function, V4 analyzeSafety, O1
 * context-engine risk flags) plus a fourth copy in build-patient-context, with
 * different thresholds and matching. Which one a patient got depended on which
 * screen the doctor used.
 *
 * Per CLAUDE.md, a structural check alone is not enough (the benchmark_v9/v10
 * dead-mode incident passed every naming test). So this file checks both:
 *   1. Behavior — every adapter's escalation output equals the evaluator's on a
 *      real case corpus. An adapter that quietly stops forwarding something to
 *      the evaluator, or starts adding its own rules, fails here.
 *   2. Structure — no other file defines must-not-miss rule tables, and the
 *      edge functions build their safety output from the evaluator.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { evaluateMustNotMiss, toClinicalSafetyShape, type MnmInput } from "../../../supabase/functions/_shared/must_not_miss.ts";
import { analyzeSafety } from "@/services/safety";
import { detectRiskFlags } from "@/services/context_engine/risk_flag_engine";
import { detectContextAwareSafetyFlags } from "@/services/context_engine/context_aware_safety";
import { canonicalize } from "@/services/canonical";
import { ALL_NEW_CASES } from "@/services/benchmark_v10";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const EVALUATOR = "supabase/functions/_shared/must_not_miss.ts";

const CORPUS = ALL_NEW_CASES.map(c => {
  const i = c.input;
  const ageMatch = (i.risk_factors ?? []).map(r => /\bage (\d+)/i.exec(r)).find(Boolean);
  return {
    id: c.case_id,
    chief: i.chief_complaint,
    symptoms: [...i.symptoms, ...(i.associated_symptoms ?? [])],
    vitals: i.vitals,
    age: ageMatch ? Number(ageMatch[1]) : null,
    history: [...i.history, ...(i.risk_factors ?? [])],
  };
});

const escalationIds = (input: MnmInput) =>
  evaluateMustNotMiss(input).triggers.filter(t => t.tier === "escalation").map(t => t.rule_id).sort();

describe("every adapter reports exactly the evaluator's escalations", () => {
  it("V4 analyzeSafety", () => {
    for (const c of CORPUS) {
      const raw = [c.chief, ...c.symptoms];
      const features = canonicalize(raw).features;
      const out = analyzeSafety({ features, vitals: c.vitals, patientAge: c.age, rawSymptoms: raw, medicalHistory: c.history });
      const expected = escalationIds({ symptoms: raw, features: features.map(f => f.feature_id), vitals: c.vitals, age: c.age, history: c.history });
      expect(out.escalation_required, c.id).toBe(expected.length > 0);
      expect(out.safety_alerts.filter(a => a.severity === "critical").map(a => a.alert_id).sort(), c.id).toEqual(expected);
    }
  });

  it("context-engine detectRiskFlags", () => {
    for (const c of CORPUS) {
      const flags = detectRiskFlags({ symptoms: c.symptoms, chief_complaint: c.chief, vitals: c.vitals, age: c.age, medical_history: c.history });
      const expected = escalationIds({ symptoms: [c.chief, ...c.symptoms], vitals: c.vitals, age: c.age, history: c.history });
      expect(flags.filter(f => f.severity === "critical").map(f => f.flag_id).sort(), c.id).toEqual(expected);
    }
  });

  it("O1 detectContextAwareSafetyFlags", () => {
    for (const c of CORPUS) {
      const { flags } = detectContextAwareSafetyFlags(
        { symptoms: c.symptoms, chief_complaint: c.chief, vitals: c.vitals, age: c.age, medical_history: c.history },
        [],
      );
      const expected = escalationIds({ symptoms: [c.chief, ...c.symptoms], vitals: c.vitals, age: c.age, history: c.history });
      expect(flags.filter(f => f.severity === "critical").map(f => f.flag_id).sort(), c.id).toEqual(expected);
    }
  });

  it("clinical-safety response shape (what the cockpit gate and finalize-consultation block on)", () => {
    for (const c of CORPUS) {
      const result = evaluateMustNotMiss({ symptoms: [c.chief, ...c.symptoms], vitals: c.vitals, age: c.age, history: c.history });
      const shape = toClinicalSafetyShape(result);
      const criticalCount =
        shape.vitals_dangers.filter(v => v.severity === "critical").length +
        shape.emergency_patterns.filter(p => p.severity === "critical").length;
      expect(criticalCount, c.id).toBe(result.triggers.filter(t => t.tier === "escalation").length);
      expect(criticalCount > 0, c.id).toBe(result.escalate);
    }
  });
});

// ── Structure ──

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Identifiers the pre-unification rule tables used. Defining any of them again means a second path. */
const RULE_TABLE_DEFINITIONS = [
  /\b(const|let|var)\s+(SAFETY_RULES|RISK_RULES|COMORBIDITY_RULES|AGE_RULES|EMERGENCY_PATTERNS)\b/,
  /\bfunction\s+(checkEmergencyPatterns|checkVitalsDangers)\b/,
];

/**
 * Known separate safety logic outside this path, each with the reason it is
 * not consolidated. Adding to this list is a deliberate decision.
 */
const KNOWN_EXCEPTIONS: Record<string, string> = {
  // Zero callers anywhere in the repo (runSafetyEngine is never imported).
  // Candidate for dead-code deletion, not consolidation.
  "supabase/functions/global-safety-engine/index.ts": "dead: no callers",
};

describe("no second must-not-miss rule set", () => {
  const files = [...walk(join(REPO_ROOT, "src")), ...walk(join(REPO_ROOT, "supabase", "functions"))]
    .map(p => relative(REPO_ROOT, p).replace(/\\/g, "/"));

  it("rule tables are defined only in the shared evaluator", () => {
    const offenders = files.filter(f => {
      if (f === EVALUATOR || f in KNOWN_EXCEPTIONS) return false;
      const src = readFileSync(join(REPO_ROOT, f), "utf8");
      return RULE_TABLE_DEFINITIONS.some(re => re.test(src));
    });
    expect(offenders).toEqual([]);
  });

  it.each(["supabase/functions/clinical-safety/index.ts", "supabase/functions/build-patient-context/index.ts"])(
    "%s builds its safety output from the evaluator",
    (f) => {
      const src = readFileSync(join(REPO_ROOT, f), "utf8");
      expect(src).toMatch(/from "\.\.\/_shared\/must_not_miss\.ts"/);
      expect(src).toMatch(/evaluateMustNotMiss\(/);
    },
  );
});
