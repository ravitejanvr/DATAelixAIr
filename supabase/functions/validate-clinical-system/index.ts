import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Benchmark Scenarios ──
const BENCHMARK_SCENARIOS = [
  {
    id: "viral_fever", name: "Viral Fever",
    chief_complaint: "fever and body aches for 3 days",
    symptoms: ["fever", "body aches", "headache", "fatigue", "sore throat"],
    vitals: { temperature: 38.5, pulse: 95, bp_systolic: 118, bp_diastolic: 76, spo2: 97 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["influenza", "viral infection", "dengue fever", "COVID-19"],
    expected_organ_system: "infectious",
  },
  {
    id: "bacterial_pneumonia", name: "Bacterial Pneumonia",
    chief_complaint: "productive cough with fever and chest pain",
    symptoms: ["cough", "fever", "chest pain", "shortness of breath", "sputum production", "fatigue"],
    vitals: { temperature: 39.2, pulse: 110, bp_systolic: 125, bp_diastolic: 80, spo2: 92, respiratory_rate: 28 },
    history: ["smoking"], medications: [], allergies: [],
    expected_diagnoses: ["community-acquired pneumonia", "pneumonia", "bronchitis"],
    expected_organ_system: "respiratory",
  },
  {
    id: "myocardial_infarction", name: "Myocardial Infarction",
    chief_complaint: "severe crushing chest pain radiating to left arm",
    symptoms: ["chest pain", "left arm pain", "shortness of breath", "diaphoresis", "nausea"],
    vitals: { temperature: 37.0, pulse: 120, bp_systolic: 160, bp_diastolic: 95, spo2: 94 },
    history: ["hypertension", "diabetes", "smoking"],
    medications: ["metformin", "amlodipine"], allergies: [],
    expected_diagnoses: ["acute myocardial infarction", "myocardial infarction", "acute coronary syndrome"],
    expected_organ_system: "cardiovascular",
  },
  {
    id: "appendicitis", name: "Appendicitis",
    chief_complaint: "severe right lower abdominal pain with nausea",
    symptoms: ["abdominal pain", "nausea", "vomiting", "fever", "loss of appetite"],
    vitals: { temperature: 38.3, pulse: 100, bp_systolic: 130, bp_diastolic: 80, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["appendicitis", "acute appendicitis"],
    expected_organ_system: "gastrointestinal",
  },
  {
    id: "stroke", name: "Acute Ischemic Stroke",
    chief_complaint: "sudden weakness on right side with speech difficulty",
    symptoms: ["weakness", "speech difficulty", "facial drooping", "confusion", "headache"],
    vitals: { temperature: 37.1, pulse: 88, bp_systolic: 180, bp_diastolic: 100, spo2: 96 },
    history: ["hypertension", "atrial fibrillation"],
    medications: ["warfarin", "lisinopril"], allergies: [],
    expected_diagnoses: ["acute ischemic stroke", "stroke", "transient ischemic attack"],
    expected_organ_system: "neurological",
  },
  {
    id: "asthma_exacerbation", name: "Asthma Exacerbation",
    chief_complaint: "wheezing and difficulty breathing",
    symptoms: ["wheezing", "shortness of breath", "cough", "chest tightness"],
    vitals: { temperature: 37.0, pulse: 105, bp_systolic: 120, bp_diastolic: 78, spo2: 91, respiratory_rate: 30 },
    history: ["asthma"], medications: ["salbutamol inhaler"], allergies: ["aspirin"],
    expected_diagnoses: ["asthma", "asthma exacerbation", "bronchospasm"],
    expected_organ_system: "respiratory",
  },
  {
    id: "meningitis", name: "Meningitis",
    chief_complaint: "severe headache with neck stiffness and fever",
    symptoms: ["headache", "neck stiffness", "fever", "photophobia", "nausea", "confusion"],
    vitals: { temperature: 39.5, pulse: 115, bp_systolic: 130, bp_diastolic: 85, spo2: 96 },
    history: [], medications: [], allergies: ["penicillin"],
    expected_diagnoses: ["meningitis", "bacterial meningitis", "viral meningitis"],
    expected_organ_system: "neurological",
  },
  {
    id: "gastroenteritis", name: "Gastroenteritis",
    chief_complaint: "diarrhea and vomiting for 2 days",
    symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea", "fever", "dehydration"],
    vitals: { temperature: 38.0, pulse: 100, bp_systolic: 105, bp_diastolic: 65, spo2: 98 },
    history: [], medications: [], allergies: [],
    expected_diagnoses: ["gastroenteritis", "viral gastroenteritis", "food poisoning"],
    expected_organ_system: "gastrointestinal",
  },
];

// ── Dangerous diagnosis triggers ──
const DANGEROUS_TRIGGERS: Record<string, string[]> = {
  "chest pain": ["myocardial infarction", "pulmonary embolism", "aortic dissection", "pneumothorax"],
  "headache": ["subarachnoid hemorrhage", "meningitis"],
  "neck stiffness": ["meningitis", "subarachnoid hemorrhage"],
  "abdominal pain": ["appendicitis", "ectopic pregnancy", "bowel perforation"],
  "shortness of breath": ["pulmonary embolism", "pneumothorax", "acute heart failure"],
  "weakness": ["stroke", "transient ischemic attack"],
  "speech difficulty": ["stroke"],
  "facial drooping": ["stroke"],
  "hemoptysis": ["pulmonary embolism"],
  "syncope": ["cardiac arrhythmia", "aortic dissection"],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function fuzzyMatch(actual: string[], expected: string[]): string[] {
  const normExpected = expected.map(normalize);
  return actual.filter((a) => {
    const na = normalize(a);
    return normExpected.some((e) => na.includes(e) || e.includes(na));
  });
}

// ════════════════════════════════════════════════════════════════════
// WORLD MODEL — Builds ClinicalWorldState from symptoms + lookup data
// ════════════════════════════════════════════════════════════════════
interface WorldModelState {
  organ_systems: string[];
  organ_system_weights: Record<string, number>;
  physiological_states: Array<{ process: string; organ_system: string; confidence: number }>;
  hypotheses: Array<{ disease: string; confidence: number; organ_system: string; source: string }>;
  dangerous_conditions: string[];
  risk_level: string;
  state_confidence: number;
  reasoning_traces: Array<{ symptom: string; physiology: string; disease: string; chain: string }>;
  latency_ms: number;
}

function buildWorldModel(
  symptoms: string[],
  vitals: any,
  activationRules: Array<{ symptom: string; organ_system: string; activation_weight: number }>,
  physiologyMap: Array<{ symptom: string; physiology_process: string; organ_system: string }>,
  physiologyDiagMap: Array<{ physiology_process: string; disease_name: string; confidence_score: number }>,
  specificityMap: Record<string, number>,
): WorldModelState {
  const start = Date.now();
  const syms = symptoms.map(s => s.toLowerCase());

  // 1. Organ System Activation using activation rules
  const systemScores: Record<string, number> = {};
  for (const s of syms) {
    const rules = activationRules.filter(r => r.symptom.toLowerCase() === s);
    for (const r of rules) {
      systemScores[r.organ_system] = (systemScores[r.organ_system] || 0) + r.activation_weight;
    }
  }
  const sortedSystems = Object.entries(systemScores).sort(([, a], [, b]) => b - a);
  const activeOrganSystems = sortedSystems.filter(([, w]) => w >= 1.0).map(([s]) => s);

  // 2. Physiology Inference
  const physiologicalStates: WorldModelState["physiological_states"] = [];
  const seenProcesses = new Set<string>();
  for (const s of syms) {
    const matches = physiologyMap.filter(p => p.symptom.toLowerCase() === s);
    for (const m of matches) {
      if (!seenProcesses.has(m.physiology_process)) {
        seenProcesses.add(m.physiology_process);
        const spec = specificityMap[s] || 0.35;
        physiologicalStates.push({
          process: m.physiology_process,
          organ_system: m.organ_system,
          confidence: Math.round(Math.min(1.0, spec * 1.2) * 100) / 100,
        });
      }
    }
  }

  // 3. Physiology → Disease Hypotheses
  const hypotheses: WorldModelState["hypotheses"] = [];
  const seenDiseases = new Set<string>();
  for (const ps of physiologicalStates) {
    const matches = physiologyDiagMap.filter(
      pd => pd.physiology_process.toLowerCase() === ps.process.toLowerCase()
    );
    for (const m of matches) {
      const key = m.disease_name.toLowerCase();
      if (!seenDiseases.has(key)) {
        seenDiseases.add(key);
        hypotheses.push({
          disease: m.disease_name,
          confidence: Math.round(ps.confidence * (m.confidence_score || 0.5) * 100) / 100,
          organ_system: ps.organ_system,
          source: "physiology",
        });
      }
    }
  }

  // 4. Dangerous Diagnosis Injection
  const dangerousConditions: string[] = [];
  for (const s of syms) {
    const dangers = DANGEROUS_TRIGGERS[s];
    if (dangers) {
      for (const d of dangers) {
        const key = d.toLowerCase();
        if (!seenDiseases.has(key)) {
          seenDiseases.add(key);
          dangerousConditions.push(d);
          hypotheses.push({ disease: d, confidence: 0.05, organ_system: activeOrganSystems[0] || "general", source: "dangerous" });
        } else if (!dangerousConditions.includes(d)) {
          dangerousConditions.push(d);
        }
      }
    }
  }

  // 5. Reasoning Traces
  const traces: WorldModelState["reasoning_traces"] = [];
  for (const ps of physiologicalStates) {
    const matchedDiseases = physiologyDiagMap.filter(
      pd => pd.physiology_process.toLowerCase() === ps.process.toLowerCase()
    );
    const originSymptom = physiologyMap.find(p => p.physiology_process === ps.process)?.symptom || "unknown";
    for (const md of matchedDiseases.slice(0, 2)) {
      traces.push({
        symptom: originSymptom,
        physiology: ps.process,
        disease: md.disease_name,
        chain: `${originSymptom} → ${ps.process} → ${md.disease_name}`,
      });
    }
  }

  // 6. Risk Level
  let riskLevel = "low";
  if (dangerousConditions.length > 0) riskLevel = "high";
  if (dangerousConditions.length >= 3) riskLevel = "critical";
  else if (hypotheses.length >= 3 && riskLevel === "low") riskLevel = "moderate";

  if (vitals) {
    if ((vitals.spo2 && vitals.spo2 < 92) || (vitals.bp_systolic && vitals.bp_systolic >= 180) || (vitals.bp_systolic && vitals.bp_systolic < 90)) {
      if (riskLevel !== "critical") riskLevel = "high";
    }
  }

  // 7. State Confidence
  const avgSpec = syms.length > 0
    ? syms.reduce((a, s) => a + (specificityMap[s] || 0.35), 0) / syms.length : 0.3;
  const stateConfidence = Math.round(Math.min(0.95, avgSpec + (activeOrganSystems.length > 0 ? 0.15 : 0) + (physiologicalStates.length > 0 ? 0.1 : 0)) * 100) / 100;

  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return {
    organ_systems: activeOrganSystems,
    organ_system_weights: systemScores,
    physiological_states: physiologicalStates,
    hypotheses,
    dangerous_conditions: dangerousConditions,
    risk_level: riskLevel,
    state_confidence: stateConfidence,
    reasoning_traces: traces,
    latency_ms: Date.now() - start,
  };
}

// ── Wave 1: Graph Retrieval (boosted by world model) ──
async function queryGraph(supabase: any, symptoms: string[], worldModel: WorldModelState) {
  const start = Date.now();
  try {
    const { data: symptomRows } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .or(symptoms.map(s => `symptom_name.ilike.%${s}%`).join(","));
    const symptomIds = (symptomRows || []).map((s: any) => s.id);
    const matchedSymptoms = (symptomRows || []).map((s: any) => s.symptom_name);

    if (symptomIds.length === 0) {
      return { diagnoses: [], suggested_labs: [], suggested_drugs: [], physiology_states: [], matched_symptoms: matchedSymptoms, guidelines: [], latency_ms: Date.now() - start };
    }

    const [lkRes, sdmRes] = await Promise.all([
      supabase.from("symptom_likelihoods").select("diagnosis_id, symptom_id, likelihood_value").in("symptom_id", symptomIds),
      supabase.from("symptom_diagnosis_map").select("diagnosis_id").in("symptom_id", symptomIds),
    ]);

    const diagnosisIdSet = new Set<string>();
    const scoreMap: Record<string, number> = {};
    for (const lk of (lkRes.data || [])) {
      diagnosisIdSet.add(lk.diagnosis_id);
      scoreMap[lk.diagnosis_id] = (scoreMap[lk.diagnosis_id] || 0) + (lk.likelihood_value || 0.5);
    }
    for (const sdm of (sdmRes.data || [])) {
      diagnosisIdSet.add(sdm.diagnosis_id);
      if (!scoreMap[sdm.diagnosis_id]) scoreMap[sdm.diagnosis_id] = 0.3;
    }
    const diagnosisIds = [...diagnosisIdSet];

    let diagnoses: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: dxRows } = await supabase
        .from("diagnoses").select("id, diagnosis_name, icd10_code, category")
        .in("id", diagnosisIds.slice(0, 30));

      // Apply world model organ-system boost
      const dominantSystem = worldModel.organ_systems[0] || "";
      diagnoses = (dxRows || []).map((d: any) => {
        let score = scoreMap[d.id] || 0.1;
        // Boost diseases matching world model's dominant organ system
        if (dominantSystem && d.category?.toLowerCase().includes(dominantSystem.toLowerCase())) {
          score *= 1.3;
        }
        // Boost diseases that appear in world model hypotheses
        const wmHypothesis = worldModel.hypotheses.find(
          h => normalize(h.disease) === normalize(d.diagnosis_name)
        );
        if (wmHypothesis) {
          score *= (1.0 + wmHypothesis.confidence);
        }
        return { ...d, score };
      }).sort((a: any, b: any) => b.score - a.score);
    }

    const topDxIds = diagnoses.slice(0, 5).map((d: any) => d.id);
    const topDxNames = diagnoses.slice(0, 5).map((d: any) => d.diagnosis_name);

    const [labResult, drugResult, physResult, guidelineResult] = await Promise.all([
      topDxIds.length > 0
        ? supabase.from("diagnosis_lab_map").select("lab_test_id, priority").in("diagnosis_id", topDxIds)
            .then(async (r: any) => {
              const labIds = [...new Set((r.data || []).map((x: any) => x.lab_test_id))];
              if (labIds.length === 0) return [];
              const { data } = await supabase.from("lab_tests").select("id, test_name, category").in("id", labIds.slice(0, 10));
              return data || [];
            })
        : Promise.resolve([]),
      topDxIds.length > 0
        ? supabase.from("diagnosis_drug_map").select("generic_name, line_of_treatment").in("diagnosis_id", topDxIds)
            .then((r: any) => (r.data || []).map((x: any) => ({ generic_name: x.generic_name, line: x.line_of_treatment })))
        : Promise.resolve([]),
      symptomIds.length > 0
        ? supabase.from("symptom_physiology_map").select("physiology_process, organ_system").in("symptom_id", symptomIds)
            .then((r: any) => r.data || [])
        : Promise.resolve([]),
      topDxIds.length > 0
        ? (async () => {
            const [grRes, cgRes] = await Promise.all([
              supabase.from("guideline_registry")
                .select("id, organization, title, condition, recommendation_text, applicable_drugs, applicable_tests")
                .or(topDxNames.map((n: string) => `condition.ilike.%${n}%`).join(",")).limit(5),
              supabase.from("clinical_guidelines")
                .select("id, source_organization, title, condition, recommendation_text")
                .or(topDxNames.map((n: string) => `condition.ilike.%${n}%`).join(",")).limit(5),
            ]);
            return [...(grRes.data || []), ...(cgRes.data || [])];
          })()
        : Promise.resolve([]),
    ]);

    return { diagnoses, suggested_labs: labResult, suggested_drugs: drugResult, physiology_states: physResult, matched_symptoms: matchedSymptoms, guidelines: guidelineResult, latency_ms: Date.now() - start };
  } catch (e) {
    console.error("[Graph] Error:", e);
    return { diagnoses: [], suggested_labs: [], suggested_drugs: [], physiology_states: [], matched_symptoms: [], guidelines: [], latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 2: DDX Engine ──
async function runDDX(supabase: any, graphResult: any, scenario: any, worldModel: WorldModelState) {
  const start = Date.now();
  try {
    const diagnoses = (graphResult.diagnoses || []).slice(0, 10);
    if (diagnoses.length === 0) {
      return { differential_diagnoses: [], suggested_medications: [], recommended_labs: [], latency_ms: Date.now() - start };
    }

    const dominantSystem = worldModel.organ_systems[0] || "";

    // Check dangerous diagnoses
    const dxIds = diagnoses.map((d: any) => d.id);
    const { data: dangerousRows } = await supabase
      .from("dangerous_diagnoses").select("diagnosis_id, severity_level, must_not_miss")
      .in("diagnosis_id", dxIds);
    const dangerousSet = new Set((dangerousRows || []).map((d: any) => d.diagnosis_id));

    // Also mark world model dangerous conditions
    const wmDangerousNames = new Set(worldModel.dangerous_conditions.map(normalize));

    const ranked = diagnoses.map((d: any, idx: number) => {
      let prob = Math.max(5, 95 - idx * 12) * (d.score || 0.5);
      // World model organ system boost
      if (dominantSystem && d.category?.toLowerCase().includes(dominantSystem)) {
        prob *= 1.3;
      }
      const isDangerous = dangerousSet.has(d.id) || wmDangerousNames.has(normalize(d.diagnosis_name));
      if (isDangerous) prob = Math.max(prob, 15);
      return {
        diagnosis_id: d.id, diagnosis_name: d.diagnosis_name,
        icd10_code: d.icd10_code || "", probability: Math.min(95, Math.round(prob)),
        category: d.category || "", is_dangerous: isDangerous,
      };
    }).sort((a: any, b: any) => b.probability - a.probability);

    return {
      differential_diagnoses: ranked, suggested_medications: graphResult.suggested_drugs || [],
      recommended_labs: graphResult.suggested_labs || [], dominant_organ_system: dominantSystem,
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    console.error("[DDX] Error:", e);
    return { differential_diagnoses: [], suggested_medications: [], recommended_labs: [], latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 3: Bayesian Engine ──
async function runBayesian(
  supabase: any, ddxResult: any, scenario: any,
  specificityMap: Record<string, number>,
  worldModel: WorldModelState,
) {
  const start = Date.now();
  try {
    const candidates = (ddxResult.differential_diagnoses || []).slice(0, 8);
    if (candidates.length === 0) return { diagnoses: [], signal_strength: 0, latency_ms: Date.now() - start };

    const dxIds = candidates.map((c: any) => c.diagnosis_id).filter(Boolean);
    const symptomNames = scenario.symptoms;
    const [priorRes, symptomRes] = await Promise.all([
      supabase.from("disease_priors").select("diagnosis_id, base_prevalence, age_modifier, sex_modifier").in("diagnosis_id", dxIds),
      supabase.from("symptoms").select("id, symptom_name").or(symptomNames.map((s: string) => `symptom_name.ilike.%${s}%`).join(",")),
    ]);

    const priorMap: Record<string, number> = {};
    for (const p of (priorRes.data || [])) {
      let prior = p.base_prevalence || 0.01;
      if (p.age_modifier && typeof p.age_modifier === "object") {
        const ageKey = scenario.age || 45;
        if (ageKey >= 60) prior *= (p.age_modifier["elderly"] || 1);
        else if (ageKey >= 40) prior *= (p.age_modifier["middle_aged"] || 1);
        else prior *= (p.age_modifier["young_adult"] || 1);
      }
      priorMap[p.diagnosis_id] = prior;
    }

    const symptomIds = (symptomRes.data || []).map((s: any) => s.id);
    const symptomNameById: Record<string, string> = {};
    for (const s of (symptomRes.data || [])) symptomNameById[s.id] = s.symptom_name;

    let likelihoodMap: Record<string, Record<string, number>> = {};
    if (symptomIds.length > 0 && dxIds.length > 0) {
      const { data: lkRows } = await supabase
        .from("symptom_likelihoods").select("diagnosis_id, symptom_id, likelihood_value")
        .in("diagnosis_id", dxIds).in("symptom_id", symptomIds);
      for (const lk of (lkRows || [])) {
        if (!likelihoodMap[lk.diagnosis_id]) likelihoodMap[lk.diagnosis_id] = {};
        likelihoodMap[lk.diagnosis_id][lk.symptom_id] = lk.likelihood_value;
      }
    }

    // World model organ system data
    const dominantSystem = worldModel.organ_systems[0] || "";
    const systemWeight = Math.min(2.0, 1.0 + ((worldModel.organ_system_weights[dominantSystem] || 1.0) - 1.0) * 0.3);

    let totalSignalStrength = 0;
    const posteriors = candidates.map((c: any) => {
      const prior = priorMap[c.diagnosis_id] || 0.01;
      const likelihoods = likelihoodMap[c.diagnosis_id] || {};
      let logPosterior = Math.log(prior);
      let symptomSignal = 0;

      for (const sId of symptomIds) {
        const lk = likelihoods[sId] || 0.3;
        const sName = symptomNameById[sId] || "";
        const specificity = specificityMap[sName.toLowerCase()] || 0.35;
        const weightedLk = lk * (0.5 + specificity * 0.5);
        logPosterior += Math.log(weightedLk);
        symptomSignal += specificity;
      }

      // World model organ system boost
      const categoryLower = (c.category || "").toLowerCase();
      if (dominantSystem && categoryLower.includes(dominantSystem.toLowerCase())) {
        logPosterior += Math.log(systemWeight);
      }

      // World model hypothesis confidence boost
      const wmH = worldModel.hypotheses.find(h => normalize(h.disease) === normalize(c.diagnosis_name));
      if (wmH && wmH.confidence > 0.1) {
        logPosterior += Math.log(1.0 + wmH.confidence * 0.5);
      }

      totalSignalStrength += symptomSignal;

      return {
        diagnosis_id: c.diagnosis_id, diagnosis_name: c.diagnosis_name,
        prior, posterior: Math.exp(logPosterior), is_dangerous: c.is_dangerous || false,
      };
    });

    const totalPosterior = posteriors.reduce((a, p) => a + p.posterior, 0);
    const normalized = posteriors.map(p => ({
      ...p,
      posterior_probability: totalPosterior > 0 ? Math.round((p.posterior / totalPosterior) * 10000) / 100 : 0,
    })).sort((a, b) => b.posterior_probability - a.posterior_probability);

    for (const n of normalized) {
      if (n.is_dangerous && n.posterior_probability < 3) n.posterior_probability = 3;
    }

    const avgSignal = symptomIds.length > 0 ? totalSignalStrength / (symptomIds.length * candidates.length) : 0;

    return { diagnoses: normalized, signal_strength: Math.round(avgSignal * 100) / 100, latency_ms: Date.now() - start };
  } catch (e) {
    console.error("[Bayesian] Error:", e);
    return { diagnoses: [], signal_strength: 0, latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 4: Safety Engine ──
async function runSafety(supabase: any, scenario: any, ddxResult: any, worldModel: WorldModelState) {
  const start = Date.now();
  try {
    const allMeds = [...new Set([
      ...scenario.medications,
      ...(ddxResult.suggested_medications || []).map((m: any) => m.generic_name).filter(Boolean),
    ])];

    let interactionFlags: any[] = [];
    if (allMeds.length >= 2) {
      const { data: interactions } = await supabase
        .from("drug_interactions").select("drug_a, drug_b, severity, interaction_description, recommended_action")
        .or(allMeds.map(m => `drug_a.ilike.%${m}%,drug_b.ilike.%${m}%`).join(","));
      interactionFlags = (interactions || []).map((i: any) => ({
        drugs: [i.drug_a, i.drug_b], severity: i.severity,
        description: i.interaction_description, action: i.recommended_action,
      }));
    }

    let allergyFlags: any[] = [];
    if (scenario.allergies.length > 0 && allMeds.length > 0) {
      for (const allergy of scenario.allergies) {
        for (const med of allMeds) {
          if (normalize(allergy) === normalize(med)) {
            allergyFlags.push({ drug: med, allergy, severity: "critical", description: `Patient allergic to ${allergy}` });
          }
        }
      }
    }

    const vitalsDangers: any[] = [];
    const v = scenario.vitals;
    if (v.spo2 && v.spo2 < 92) vitalsDangers.push({ parameter: "SpO2", value: v.spo2, threshold: 92, severity: "critical", message: "Hypoxemia detected" });
    if (v.temperature && v.temperature >= 39.5) vitalsDangers.push({ parameter: "Temperature", value: v.temperature, threshold: 39.5, severity: "warning", message: "High fever" });
    if (v.pulse && v.pulse >= 120) vitalsDangers.push({ parameter: "Heart Rate", value: v.pulse, threshold: 120, severity: "warning", message: "Tachycardia" });
    if (v.bp_systolic && v.bp_systolic >= 180) vitalsDangers.push({ parameter: "Systolic BP", value: v.bp_systolic, threshold: 180, severity: "critical", message: "Hypertensive crisis" });
    if (v.bp_systolic && v.bp_systolic < 90) vitalsDangers.push({ parameter: "Systolic BP", value: v.bp_systolic, threshold: 90, severity: "critical", message: "Hypotension" });
    if (v.respiratory_rate && v.respiratory_rate >= 28) vitalsDangers.push({ parameter: "Respiratory Rate", value: v.respiratory_rate, threshold: 28, severity: "warning", message: "Tachypnea" });

    const emergencyPatterns: any[] = [];
    // Include world model dangerous conditions
    for (const dc of worldModel.dangerous_conditions) {
      emergencyPatterns.push({ diagnosis: dc, probability: 0, message: `Must-not-miss: ${dc}`, source: "world_model" });
    }
    for (const dd of (ddxResult.differential_diagnoses || []).filter((d: any) => d.is_dangerous)) {
      if (!emergencyPatterns.find(e => normalize(e.diagnosis) === normalize(dd.diagnosis_name))) {
        emergencyPatterns.push({ diagnosis: dd.diagnosis_name, probability: dd.probability, message: `Must-not-miss: ${dd.diagnosis_name}` });
      }
    }

    return {
      interaction_flags: interactionFlags, allergy_flags: allergyFlags,
      vitals_dangers: vitalsDangers, emergency_patterns: emergencyPatterns,
      safety_score: Math.max(0, 100 - interactionFlags.length * 15 - allergyFlags.length * 25 - vitalsDangers.length * 10 - emergencyPatterns.length * 5),
      world_model_risk_level: worldModel.risk_level,
      latency_ms: Date.now() - start,
    };
  } catch (e) {
    console.error("[Safety] Error:", e);
    return { interaction_flags: [], allergy_flags: [], vitals_dangers: [], emergency_patterns: [], safety_score: 50, world_model_risk_level: "unknown", latency_ms: Date.now() - start, error: String(e) };
  }
}

// ── Wave 5: SOAP Builder ──
function buildSOAP(scenario: any, ddxResult: any, bayesianResult: any, safetyResult: any, worldModel: WorldModelState) {
  const start = Date.now();
  const subjParts: string[] = [];
  subjParts.push(`Chief complaint: ${scenario.chief_complaint}.`);
  if (scenario.symptoms.length > 0) subjParts.push(`Symptoms: ${scenario.symptoms.join(", ")}.`);
  if (scenario.history.length > 0) subjParts.push(`Past medical history: ${scenario.history.join(", ")}.`);
  if (scenario.medications.length > 0) subjParts.push(`Current medications: ${scenario.medications.join(", ")}.`);
  if (scenario.allergies.length > 0) subjParts.push(`Allergies: ${scenario.allergies.join(", ")}.`);

  const objParts: string[] = [];
  const v = scenario.vitals;
  const vitalsStr: string[] = [];
  if (v.bp_systolic && v.bp_diastolic) vitalsStr.push(`BP: ${v.bp_systolic}/${v.bp_diastolic} mmHg`);
  if (v.pulse) vitalsStr.push(`HR: ${v.pulse} bpm`);
  if (v.temperature) vitalsStr.push(`Temp: ${v.temperature}°C`);
  if (v.spo2) vitalsStr.push(`SpO2: ${v.spo2}%`);
  if (v.respiratory_rate) vitalsStr.push(`RR: ${v.respiratory_rate}/min`);
  if (vitalsStr.length > 0) objParts.push(`Vitals: ${vitalsStr.join(", ")}.`);
  // Include world model physiological states in objective
  if (worldModel.physiological_states.length > 0) {
    objParts.push(`Inferred physiology: ${worldModel.physiological_states.map(p => `${p.process} (${Math.round(p.confidence * 100)}%)`).join(", ")}.`);
  }

  const assessParts: string[] = [];
  // World model organ systems
  if (worldModel.organ_systems.length > 0) {
    assessParts.push(`Active organ systems: ${worldModel.organ_systems.join(", ")}.`);
  }
  const topDx = (ddxResult.differential_diagnoses || []).slice(0, 5);
  if (topDx.length > 0) {
    const dxList = topDx.map((d: any, i: number) => `${i + 1}. ${d.diagnosis_name} (${d.probability}%)`).join("\n");
    assessParts.push(`Differential diagnosis:\n${dxList}`);
  }
  const bayesTop = (bayesianResult.diagnoses || [])[0];
  if (bayesTop) assessParts.push(`Bayesian confidence: ${bayesTop.diagnosis_name} (${bayesTop.posterior_probability}%).`);
  if ((safetyResult.emergency_patterns || []).length > 0) {
    assessParts.push(`⚠️ Emergency: ${safetyResult.emergency_patterns.map((e: any) => e.message).join("; ")}`);
  }
  assessParts.push(`Risk level: ${worldModel.risk_level.toUpperCase()}.`);

  const planParts: string[] = [];
  const recLabs = (ddxResult.recommended_labs || []).slice(0, 5);
  if (recLabs.length > 0) planParts.push(`Investigations: ${recLabs.map((l: any) => l.test_name).join(", ")}.`);
  const recMeds = (ddxResult.suggested_medications || []).slice(0, 5);
  if (recMeds.length > 0) planParts.push(`Medications: ${recMeds.map((m: any) => m.generic_name).join(", ")}.`);
  if ((safetyResult.vitals_dangers || []).length > 0) {
    planParts.push(`Vitals monitoring: ${safetyResult.vitals_dangers.map((v: any) => v.message).join("; ")}.`);
  }

  return {
    sections: {
      subjective: subjParts.join(" ") || "No subjective data.",
      objective: objParts.join(" ") || "No objective findings.",
      assessment: assessParts.join("\n") || "Insufficient data.",
      plan: planParts.join("\n") || "Further evaluation recommended.",
    },
    soap_valid: true, latency_ms: Date.now() - start,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStart = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const validationRunId = crypto.randomUUID();

    // ═══════════════════════════════════════════════════════════════════
    // STEP 0: Load all lookup tables in parallel
    // ═══════════════════════════════════════════════════════════════════
    const [specRes, organRes, activationRes, physMapRes, physDiagRes] = await Promise.all([
      supabase.from("symptom_specificity").select("symptom_name, specificity_score, organ_system"),
      supabase.from("symptom_organ_system_map").select("symptom, organ_system, weight"),
      supabase.from("organ_system_activation_rules").select("symptom, organ_system, activation_weight"),
      supabase.from("symptom_physiology_map").select("symptom:symptoms!inner(symptom_name), physiology_process, organ_system"),
      supabase.from("physiology_diagnosis_map").select("physiology_process:physiological_states!inner(state_name), disease_name:diagnoses!inner(diagnosis_name), confidence_score"),
    ]);

    const specificityMap: Record<string, number> = {};
    const specificityOrganMap: Record<string, string> = {};
    for (const s of (specRes.data || [])) {
      specificityMap[s.symptom_name.toLowerCase()] = parseFloat(s.specificity_score);
      specificityOrganMap[s.symptom_name.toLowerCase()] = s.organ_system;
    }

    const organWeightMap: Record<string, Record<string, number>> = {};
    for (const o of (organRes.data || [])) {
      if (!organWeightMap[o.symptom.toLowerCase()]) organWeightMap[o.symptom.toLowerCase()] = {};
      organWeightMap[o.symptom.toLowerCase()][o.organ_system] = parseFloat(o.weight);
    }

    const activationRules = (activationRes.data || []).map((r: any) => ({
      symptom: r.symptom, organ_system: r.organ_system, activation_weight: parseFloat(r.activation_weight),
    }));

    // Flatten joined physiology map
    const physiologyMap = (physMapRes.data || []).map((r: any) => ({
      symptom: r.symptom?.symptom_name || "",
      physiology_process: r.physiology_process || "",
      organ_system: r.organ_system || "",
    })).filter((r: any) => r.symptom && r.physiology_process);

    const physiologyDiagMap = (physDiagRes.data || []).map((r: any) => ({
      physiology_process: r.physiology_process?.state_name || "",
      disease_name: r.disease_name?.diagnosis_name || "",
      confidence_score: r.confidence_score || 0.5,
    })).filter((r: any) => r.physiology_process && r.disease_name);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Knowledge Graph Integrity Check
    // ═══════════════════════════════════════════════════════════════════
    const step1Start = Date.now();
    const tableNames = [
      "diagnoses", "symptoms", "symptom_diagnosis_map", "disease_priors",
      "symptom_likelihoods", "disease_tests", "disease_treatments",
      "physiological_states", "symptom_physiology_map", "physiology_diagnosis_map",
      "drug_master", "clinical_guidelines", "dangerous_diagnoses",
      "diagnosis_drug_map", "diagnosis_lab_map", "guideline_registry",
      "symptom_specificity", "symptom_organ_system_map",
      "organ_system_activation_rules", "clinical_reasoning_traces",
    ];

    const countResults = await Promise.all(
      tableNames.map(name => supabase.from(name).select("id", { count: "exact", head: true }))
    );
    const tableCounts: Record<string, number> = {};
    tableNames.forEach((name, i) => { tableCounts[name] = countResults[i].count ?? 0; });

    const totalDiseases = tableCounts.diagnoses;
    const totalSymptoms = tableCounts.symptoms;
    const totalRelationships = tableCounts.symptom_diagnosis_map + tableCounts.symptom_likelihoods +
      tableCounts.symptom_physiology_map + tableCounts.physiology_diagnosis_map +
      tableCounts.diagnosis_drug_map + tableCounts.diagnosis_lab_map;
    const avgEdgesPerDisease = totalDiseases > 0 ? Math.round((totalRelationships / totalDiseases) * 10) / 10 : 0;

    const specCoverage = tableCounts.symptom_specificity;
    const organCoverage = tableCounts.symptom_organ_system_map;
    const highSpecCount = (specRes.data || []).filter((s: any) => parseFloat(s.specificity_score) >= 0.7).length;
    const lowSpecCount = (specRes.data || []).filter((s: any) => parseFloat(s.specificity_score) < 0.35).length;

    const graphGaps: string[] = [];
    if (tableCounts.symptom_likelihoods < 2000) graphGaps.push(`symptom_likelihoods: ${tableCounts.symptom_likelihoods}/10000`);
    if (tableCounts.disease_priors < 200) graphGaps.push(`disease_priors: ${tableCounts.disease_priors}/500`);
    if (tableCounts.physiological_states < 100) graphGaps.push(`physiological_states: ${tableCounts.physiological_states}/200`);
    if (tableCounts.clinical_guidelines < 50) graphGaps.push(`clinical_guidelines: ${tableCounts.clinical_guidelines}/50`);

    const graphIntegrity = {
      table_counts: tableCounts,
      total_diseases: totalDiseases, total_symptoms: totalSymptoms,
      total_relationships: totalRelationships, avg_edges_per_disease: avgEdgesPerDisease,
      signal_optimization: {
        specificity_entries: specCoverage,
        organ_system_entries: organCoverage,
        high_specificity_symptoms: highSpecCount,
        low_specificity_symptoms: lowSpecCount,
        avg_specificity: (specRes.data || []).length > 0
          ? Math.round((specRes.data || []).reduce((a: number, s: any) => a + parseFloat(s.specificity_score), 0) / (specRes.data || []).length * 100) / 100
          : 0,
        activation_rules_count: activationRules.length,
      },
      world_model: {
        activation_rules: activationRules.length,
        physiology_map_entries: physiologyMap.length,
        physiology_diag_entries: physiologyDiagMap.length,
        reasoning_traces_stored: tableCounts.clinical_reasoning_traces,
      },
      gaps: graphGaps,
      status: graphGaps.length === 0 ? "healthy" : graphGaps.length <= 2 ? "partial" : "degraded",
      latency_ms: Date.now() - step1Start,
    };

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Benchmark Scenarios with World Model
    // ═══════════════════════════════════════════════════════════════════
    const scenarioResults = [];
    const engineLogs: any[] = [];
    const allReasoningTraces: any[] = [];

    for (const scenario of BENCHMARK_SCENARIOS) {
      const scenarioStart = Date.now();
      const waveLatency: Record<string, number> = {};
      const pipelineTrace: Record<string, any> = {};

      // Wave 0: PCIE context
      const w0Start = Date.now();
      const pcieFields = [
        "chief_complaint", "symptoms", "associated_symptoms", "medical_history",
        "current_medications", "allergies", "family_history", "risk_factors",
        "vitals", "lab_results", "risk_flags", "context_confidence",
      ];
      const context = {
        chief_complaint: scenario.chief_complaint, symptoms: scenario.symptoms,
        associated_symptoms: [], vitals: scenario.vitals,
        medical_history: scenario.history, current_medications: scenario.medications,
        allergies: scenario.allergies, family_history: [], risk_factors: scenario.history,
        lab_results: [], risk_flags: [], context_confidence: 0.85,
        patient_age: 45, patient_sex: "male",
      };
      const populatedFields = pcieFields.filter(f => {
        const v = (context as any)[f];
        return v !== undefined && v !== null && (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0) || typeof v === 'number');
      });
      waveLatency.wave0_pcie_ms = Date.now() - w0Start;
      pipelineTrace.pcie_total_fields = pcieFields.length;
      pipelineTrace.pcie_populated_fields = populatedFields.length;
      pipelineTrace.pcie_confidence = context.context_confidence;

      // ═══ NEW: Wave 0.5 — Clinical World Model ═══
      const wmStart = Date.now();
      const worldModel = buildWorldModel(
        scenario.symptoms, scenario.vitals,
        activationRules, physiologyMap, physiologyDiagMap, specificityMap,
      );
      waveLatency.wave05_world_model_ms = worldModel.latency_ms;
      pipelineTrace.world_model = {
        organ_systems: worldModel.organ_systems,
        organ_system_weights: worldModel.organ_system_weights,
        physiological_states: worldModel.physiological_states.length,
        hypotheses_count: worldModel.hypotheses.length,
        top_hypotheses: worldModel.hypotheses.slice(0, 3).map(h => `${h.disease} (${h.confidence})`),
        dangerous_conditions: worldModel.dangerous_conditions,
        risk_level: worldModel.risk_level,
        state_confidence: worldModel.state_confidence,
        reasoning_traces_count: worldModel.reasoning_traces.length,
      };
      engineLogs.push({
        engine_name: "world_model", validation_run_id: validationRunId,
        execution_time_ms: worldModel.latency_ms, status: worldModel.organ_systems.length > 0 ? "ok" : "degraded",
        output_summary: {
          organ_systems: worldModel.organ_systems.length,
          physiological_states: worldModel.physiological_states.length,
          hypotheses: worldModel.hypotheses.length,
          dangerous: worldModel.dangerous_conditions.length,
          risk_level: worldModel.risk_level,
        },
      });

      // Store reasoning traces
      for (const trace of worldModel.reasoning_traces) {
        allReasoningTraces.push({
          validation_run_id: validationRunId,
          scenario_id: scenario.id,
          symptom: trace.symptom,
          physiology_process: trace.physiology,
          disease: trace.disease,
          evidence_chain: trace.chain,
          organ_system: worldModel.organ_systems[0] || "general",
          source: "world_model",
        });
      }

      // Compute avg specificity for this scenario's symptoms
      const scenarioSpecificities = scenario.symptoms.map(s => specificityMap[s.toLowerCase()] || 0.35);
      const avgSpecificity = scenarioSpecificities.length > 0
        ? scenarioSpecificities.reduce((a, b) => a + b, 0) / scenarioSpecificities.length : 0;
      pipelineTrace.avg_symptom_specificity = Math.round(avgSpecificity * 100) / 100;

      // Wave 1: Graph (boosted by world model)
      const w1Start = Date.now();
      const graphResult = await queryGraph(supabase, scenario.symptoms, worldModel);
      waveLatency.wave1_graph_ms = Date.now() - w1Start;
      pipelineTrace.graph_diagnoses_count = graphResult.diagnoses.length;
      pipelineTrace.graph_matched_symptoms = graphResult.matched_symptoms.length;
      pipelineTrace.graph_physiology_count = graphResult.physiology_states.length;
      engineLogs.push({ engine_name: "graph_engine", validation_run_id: validationRunId, execution_time_ms: waveLatency.wave1_graph_ms, status: graphResult.diagnoses.length > 0 ? "ok" : "empty", output_summary: { diagnoses: graphResult.diagnoses.length, labs: graphResult.suggested_labs.length } });

      // Wave 2: DDX (uses world model)
      const w2Start = Date.now();
      const ddxResult = await runDDX(supabase, graphResult, scenario, worldModel);
      waveLatency.wave2_ddx_ms = Date.now() - w2Start;
      pipelineTrace.ddx_count = ddxResult.differential_diagnoses.length;
      pipelineTrace.ddx_dominant_system = ddxResult.dominant_organ_system;
      engineLogs.push({ engine_name: "ddx_engine", validation_run_id: validationRunId, execution_time_ms: waveLatency.wave2_ddx_ms, status: ddxResult.differential_diagnoses.length > 0 ? "ok" : "empty", output_summary: { diagnoses: ddxResult.differential_diagnoses.length } });

      // Wave 3: Bayesian (uses world model)
      const w3Start = Date.now();
      const bayesianResult = await runBayesian(supabase, ddxResult, scenario, specificityMap, worldModel);
      waveLatency.wave3_bayesian_ms = Date.now() - w3Start;
      pipelineTrace.bayesian_count = bayesianResult.diagnoses.length;
      pipelineTrace.bayesian_top = bayesianResult.diagnoses[0]?.diagnosis_name || null;
      pipelineTrace.bayesian_signal_strength = bayesianResult.signal_strength || 0;
      engineLogs.push({ engine_name: "bayesian_engine", validation_run_id: validationRunId, execution_time_ms: waveLatency.wave3_bayesian_ms, status: bayesianResult.diagnoses.length > 0 ? "ok" : "empty", output_summary: { diagnoses: bayesianResult.diagnoses.length, signal: bayesianResult.signal_strength } });

      // Wave 4: Safety (uses world model)
      const w4Start = Date.now();
      const safetyResult = await runSafety(supabase, scenario, ddxResult, worldModel);
      waveLatency.wave4_safety_ms = Date.now() - w4Start;
      const safetyAlertCount = safetyResult.interaction_flags.length + safetyResult.allergy_flags.length + safetyResult.vitals_dangers.length + safetyResult.emergency_patterns.length;
      pipelineTrace.safety_alerts = safetyAlertCount;
      pipelineTrace.safety_score = safetyResult.safety_score;
      pipelineTrace.world_model_risk_level = safetyResult.world_model_risk_level;
      engineLogs.push({ engine_name: "safety_engine", validation_run_id: validationRunId, execution_time_ms: waveLatency.wave4_safety_ms, status: "ok", output_summary: { alerts: safetyAlertCount, score: safetyResult.safety_score } });

      // Wave 5: SOAP (uses world model)
      const w5Start = Date.now();
      const soapResult = buildSOAP(scenario, ddxResult, bayesianResult, safetyResult, worldModel);
      waveLatency.wave5_soap_ms = Date.now() - w5Start;
      pipelineTrace.soap_sections = Object.keys(soapResult.sections);
      engineLogs.push({ engine_name: "soap_engine", validation_run_id: validationRunId, execution_time_ms: waveLatency.wave5_soap_ms, status: "ok", output_summary: { sections: Object.keys(soapResult.sections).length } });

      const totalScenarioMs = Date.now() - scenarioStart;

      // Evaluate
      const ddxDiagnoses = ddxResult.differential_diagnoses.map((d: any) => d.diagnosis_name);
      const matchedDx = fuzzyMatch(ddxDiagnoses, scenario.expected_diagnoses);
      const dxMatchRate = scenario.expected_diagnoses.length > 0 ? matchedDx.length / scenario.expected_diagnoses.length : 0;
      const graphDiagnoses = graphResult.diagnoses.map((d: any) => d.diagnosis_name);
      const graphLabs = graphResult.suggested_labs.map((l: any) => l.test_name || "");
      const graphDrugs = graphResult.suggested_drugs.map((d: any) => d.generic_name || "");

      scenarioResults.push({
        scenario_id: scenario.id, scenario_name: scenario.name,
        expected_organ_system: scenario.expected_organ_system,
        passed: dxMatchRate >= 0.5 || matchedDx.length >= 1,
        diagnosis_match_rate: Math.round(dxMatchRate * 100) / 100,
        matched_diagnoses: matchedDx, actual_diagnoses: ddxDiagnoses.slice(0, 5),
        graph_diagnoses: graphDiagnoses.slice(0, 5), graph_labs: graphLabs.slice(0, 5),
        graph_drugs: graphDrugs.slice(0, 5),
        graph_guidelines: (graphResult.guidelines || []).map((g: any) => g.title || g.organization || "").slice(0, 5),
        bayesian_top: bayesianResult.diagnoses[0] || null,
        bayesian_count: bayesianResult.diagnoses.length,
        safety_alert_count: safetyAlertCount,
        danger_detected: safetyResult.emergency_patterns.length > 0,
        soap_generated: soapResult.soap_valid,
        world_model: {
          organ_systems: worldModel.organ_systems,
          risk_level: worldModel.risk_level,
          state_confidence: worldModel.state_confidence,
          hypotheses_count: worldModel.hypotheses.length,
          top_hypotheses: worldModel.hypotheses.slice(0, 3),
          dangerous_conditions: worldModel.dangerous_conditions,
          physiological_states: worldModel.physiological_states.slice(0, 5),
          reasoning_traces: worldModel.reasoning_traces.slice(0, 5),
        },
        engine_status: {
          world_model: worldModel.organ_systems.length > 0 || worldModel.hypotheses.length > 0,
          graph_engine: graphResult.diagnoses.length > 0,
          ddx_engine: ddxResult.differential_diagnoses.length > 0,
          bayesian_engine: bayesianResult.diagnoses.length > 0,
          safety_engine: true, soap_engine: soapResult.soap_valid,
        },
        wave_latency: waveLatency,
        total_latency_ms: totalScenarioMs,
        pipeline_trace: pipelineTrace,
      });
    }

    // Write engine logs + reasoning traces
    await Promise.all([
      supabase.from("clinical_engine_logs").insert(engineLogs),
      allReasoningTraces.length > 0 ? supabase.from("clinical_reasoning_traces").insert(allReasoningTraces) : Promise.resolve(),
    ]);

    // ═══════════════════════════════════════════════════════════════════
    // Aggregate
    // ═══════════════════════════════════════════════════════════════════
    const passedCount = scenarioResults.filter(s => s.passed).length;
    const avgDxMatch = scenarioResults.reduce((a, s) => a + s.diagnosis_match_rate, 0) / scenarioResults.length;
    const avgLatency = scenarioResults.reduce((a, s) => a + s.total_latency_ms, 0) / scenarioResults.length;

    const waveKeys = ["wave0_pcie_ms", "wave05_world_model_ms", "wave1_graph_ms", "wave2_ddx_ms", "wave3_bayesian_ms", "wave4_safety_ms", "wave5_soap_ms"];
    const avgWaveLatency: Record<string, number> = {};
    for (const key of waveKeys) {
      avgWaveLatency[key] = Math.round(scenarioResults.reduce((a, s) => a + (s.wave_latency[key] || 0), 0) / scenarioResults.length);
    }

    const engineHealthRaw: Record<string, number> = {
      world_model: scenarioResults.filter(s => s.engine_status.world_model).length,
      graph_engine: scenarioResults.filter(s => s.engine_status.graph_engine).length,
      ddx_engine: scenarioResults.filter(s => s.engine_status.ddx_engine).length,
      bayesian_engine: scenarioResults.filter(s => s.engine_status.bayesian_engine).length,
      safety_engine: scenarioResults.filter(s => s.engine_status.safety_engine).length,
      soap_engine: scenarioResults.filter(s => s.engine_status.soap_engine).length,
    };

    const totalMs = Date.now() - totalStart;

    const report = {
      validation_id: validationRunId,
      timestamp: new Date().toISOString(),
      total_duration_ms: totalMs,
      graph_integrity: graphIntegrity,
      benchmark: {
        total_scenarios: BENCHMARK_SCENARIOS.length,
        passed: passedCount, failed: BENCHMARK_SCENARIOS.length - passedCount,
        pass_rate: Math.round((passedCount / BENCHMARK_SCENARIOS.length) * 100),
        avg_diagnosis_match: Math.round(avgDxMatch * 100),
        scenarios: scenarioResults,
      },
      engine_health: Object.fromEntries(
        Object.entries(engineHealthRaw).map(([k, v]) => [
          k, { active: v, total: BENCHMARK_SCENARIOS.length, rate: Math.round((v / BENCHMARK_SCENARIOS.length) * 100) },
        ])
      ),
      latency: {
        avg_total_ms: Math.round(avgLatency),
        avg_wave_latency: avgWaveLatency,
        target_ms: 5000, meets_target: avgLatency < 5000,
      },
      recommendations: [
        ...(tableCounts.symptom_likelihoods < 5000 ? ["Expand symptom_likelihoods to 10,000+ for better Bayesian inference"] : []),
        ...(tableCounts.disease_priors < 300 ? ["Add more disease priors to cover 500+ diseases"] : []),
        ...(tableCounts.clinical_guidelines < 50 ? ["Populate clinical_guidelines for guideline retrieval"] : []),
        ...(passedCount < BENCHMARK_SCENARIOS.length ? [`${BENCHMARK_SCENARIOS.length - passedCount} scenarios failed — review DDX coverage`] : []),
        ...(avgLatency > 5000 ? ["Pipeline latency exceeds 5s target"] : []),
      ],
      repair_log: {
        fixes_applied: [
          "World Model layer inserted between PCIE and Graph Retrieval (Wave 0.5)",
          "Organ system activation via organ_system_activation_rules (75+ rules)",
          "Physiology inference: symptom → physiological process → disease hypothesis",
          "Dangerous diagnosis injection with minimum probability floor",
          "Reasoning traces stored in clinical_reasoning_traces table",
          "World model boosts graph retrieval and Bayesian scoring",
          "SOAP notes enriched with physiological states and risk levels",
        ],
        previous_fixes: [
          "Phase 1–7: Signal-optimized Bayesian with specificity × organ-system weighting",
          "Graph retrieval uses symptom_likelihoods as primary source",
          "SOAP uses deterministic template assembly (<1ms)",
          "Direct DB queries replaced sequential edge function calls",
        ],
      },
    };

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("validate-clinical-system error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Validation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
