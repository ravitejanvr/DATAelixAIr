import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Bayesian Diagnostic Probability Engine v4 — Full Tier-1 Signal Integration
 *
 * Computes log P(D|E) using:
 *   P(D)   = disease prior × age/sex/region modifiers × medical history multiplier
 *   P(S|D) = specificity-weighted symptom likelihoods + coverage bonus
 *   Φ(D)   = physiology likelihoods
 *   R(D)   = risk factor modifiers
 *   T(D)   = duration + onset temporal modifiers
 *   V(D)   = vital sign modifiers (disease-specific from DB)
 *   C(D)   = symptom cluster modifiers
 *
 * Signal application order (prevents double-counting):
 *   1. Base prior P(D)
 *   2. Demographics (age, sex, region) → prior adjustment
 *   3. Medical history → prior multiplier
 *   4. Symptom likelihoods → log-likelihood
 *   5. Duration/onset modifiers → likelihood adjustment
 *   6. Vital sign modifiers → likelihood adjustment
 *   7. Symptom cluster modifiers → likelihood adjustment
 *   8. Physiology likelihoods → additive
 *   9. Risk factor modifiers → additive
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth — accept both user tokens and service role key (for inter-function calls)
    const token = authHeader.replace("Bearer ", "").trim();
    let isServiceRole = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        isServiceRole = payload.role === "service_role";
      }
    } catch (_) { /* not a valid JWT */ }
    
    if (!isServiceRole) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const {
      candidate_diagnosis_ids = [],
      symptoms = [],
      physiological_state_ids = [],
      risk_factors = [],
      medical_history = [],
      patient_age = null,
      patient_sex = null,
      region = "south_asia",
      vitals = {},
      duration = null,       // "acute" | "subacute" | "chronic"
      onset_pattern = null,  // "sudden" | "gradual" | "progressive" | "intermittent" | "episodic"
    } = body;

    // Filter to valid UUIDs only — non-UUID hint IDs (e.g. "hint-phenotype_inference-...")
    // cause PostgreSQL type errors that fail entire queries silently
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validCandidateIds = candidate_diagnosis_ids.filter((id: string) => UUID_RE.test(id));
    const skippedIds = candidate_diagnosis_ids.length - validCandidateIds.length;
    if (skippedIds > 0) {
      console.warn(`[BayesianEngine] Skipped ${skippedIds} non-UUID candidate IDs`);
    }

    if (validCandidateIds.length === 0) {
      return new Response(JSON.stringify({
        diagnoses: [],
        execution_ms: Date.now() - start,
        source: "bayesian_engine_v5_clinical_weights",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ════════════════════════════════════════════
    // RESOLVE SYMPTOM NAMES → IDs
    // ════════════════════════════════════════════
    let symptomIds: string[] = [];
    const normalizedSymptomNames: string[] = [];
    if (symptoms.length > 0) {
      const normalized = symptoms.map((s: string) => s.toLowerCase().trim());
      const { data: symRows } = await supabase
        .from("symptoms")
        .select("id, symptom_name")
        .in("symptom_name", normalized);
      
      const exactIds = new Set((symRows || []).map((s: any) => s.id));
      const exactNames = new Set((symRows || []).map((s: any) => s.symptom_name));
      for (const n of exactNames) normalizedSymptomNames.push(n as string);
      const unmatched = normalized.filter((s: string) => !exactNames.has(s));
      
      if (unmatched.length > 0) {
        const fuzzyPromises = unmatched.map(s =>
          supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
        );
        const fuzzyResults = await Promise.all(fuzzyPromises);
        for (const res of fuzzyResults) {
          for (const s of res.data || []) {
            exactIds.add(s.id);
            normalizedSymptomNames.push(s.symptom_name);
          }
        }
      }
      symptomIds = Array.from(exactIds);
    }

    // Normalize input signals
    const normalizedHistory = medical_history.map((h: string) => h.toLowerCase().trim());
    const normalizedRiskFactors = risk_factors.map((r: string) => r.toLowerCase().trim());

    // Classify duration from free text if not already categorized
    const durationCategory = classifyDuration(duration);
    const onsetCategory = classifyOnset(onset_pattern);

    // ════════════════════════════════════════════
    // PARALLEL FETCH — All modifier tables
    // ════════════════════════════════════════════

    const [
      priorsRes, symptomLikRes, physioLikRes, riskModRes, historyModRes,
      dangerousRes, durationModRes, onsetModRes, vitalModRes, clusterModRes,
    ] = await Promise.all([
      supabase.from("disease_priors")
        .select("diagnosis_id, base_prevalence, age_modifier, sex_modifier, region_modifier")
        .in("diagnosis_id", validCandidateIds),
      symptomIds.length > 0
        ? supabase.from("symptom_likelihoods")
            .select("diagnosis_id, symptom_id, likelihood_value, symptom_specificity")
            .in("diagnosis_id", validCandidateIds)
            .in("symptom_id", symptomIds)
        : Promise.resolve({ data: [] }),
      physiological_state_ids.length > 0
        ? supabase.from("physiology_likelihoods")
            .select("diagnosis_id, physiological_state_id, likelihood_value")
            .in("diagnosis_id", validCandidateIds)
            .in("physiological_state_id", physiological_state_ids)
        : Promise.resolve({ data: [] }),
      normalizedRiskFactors.length > 0
        ? supabase.from("risk_factor_modifiers")
            .select("diagnosis_id, risk_factor, modifier_weight")
            .in("diagnosis_id", validCandidateIds)
            .in("risk_factor", normalizedRiskFactors)
        : Promise.resolve({ data: [] }),
      normalizedHistory.length > 0
        ? supabase.from("medical_history_modifiers")
            .select("diagnosis_id, history_condition, prior_multiplier, confidence")
            .in("diagnosis_id", validCandidateIds)
            .in("history_condition", normalizedHistory)
        : Promise.resolve({ data: [] }),
      supabase.from("dangerous_diagnoses")
        .select("diagnosis_id, diagnosis_name, severity_level, emergency_protocol, must_not_miss")
        .eq("must_not_miss", true)
        .in("diagnosis_id", validCandidateIds),
      durationCategory
        ? supabase.from("duration_modifiers")
            .select("diagnosis_id, duration_category, modifier_weight")
            .in("diagnosis_id", validCandidateIds)
            .eq("duration_category", durationCategory)
        : Promise.resolve({ data: [] }),
      onsetCategory
        ? supabase.from("onset_modifiers")
            .select("diagnosis_id, onset_pattern, modifier_weight")
            .in("diagnosis_id", validCandidateIds)
            .eq("onset_pattern", onsetCategory)
        : Promise.resolve({ data: [] }),
      supabase.from("vital_sign_modifiers")
        .select("diagnosis_id, vital_parameter, condition, threshold_value, modifier_weight")
        .in("diagnosis_id", validCandidateIds),
      supabase.from("symptom_cluster_modifiers")
        .select("diagnosis_id, cluster_name, required_symptoms, min_match_count, modifier_weight")
        .in("diagnosis_id", validCandidateIds),
    ]);

    // ════════════════════════════════════════════
    // BUILD LOOKUP MAPS
    // ════════════════════════════════════════════

    const priorsMap = new Map<string, any>();
    for (const p of priorsRes.data || []) priorsMap.set(p.diagnosis_id, p);

    const symLikMap = new Map<string, Array<{ symptom_id: string; likelihood_value: number; specificity: number }>>();
    for (const sl of symptomLikRes.data || []) {
      if (!symLikMap.has(sl.diagnosis_id)) symLikMap.set(sl.diagnosis_id, []);
      symLikMap.get(sl.diagnosis_id)!.push({
        symptom_id: sl.symptom_id,
        likelihood_value: sl.likelihood_value,
        specificity: sl.symptom_specificity ?? 0.5,
      });
    }

    const physioLikMap = new Map<string, number[]>();
    for (const pl of physioLikRes.data || []) {
      if (!physioLikMap.has(pl.diagnosis_id)) physioLikMap.set(pl.diagnosis_id, []);
      physioLikMap.get(pl.diagnosis_id)!.push(pl.likelihood_value);
    }

    const riskModMap = new Map<string, number[]>();
    for (const rm of riskModRes.data || []) {
      if (!riskModMap.has(rm.diagnosis_id)) riskModMap.set(rm.diagnosis_id, []);
      riskModMap.get(rm.diagnosis_id)!.push(rm.modifier_weight);
    }

    const historyMultiplierMap = new Map<string, number>();
    for (const hm of historyModRes.data || []) {
      const current = historyMultiplierMap.get(hm.diagnosis_id) || 1.0;
      historyMultiplierMap.set(hm.diagnosis_id, Math.max(current, hm.prior_multiplier * hm.confidence));
    }

    const dangerousSet = new Set((dangerousRes.data || []).map((d: any) => d.diagnosis_id));

    // Duration modifiers map
    const durationModMap = new Map<string, number>();
    for (const dm of durationModRes.data || []) {
      durationModMap.set(dm.diagnosis_id, dm.modifier_weight);
    }

    // Onset modifiers map
    const onsetModMap = new Map<string, number>();
    for (const om of onsetModRes.data || []) {
      onsetModMap.set(om.diagnosis_id, om.modifier_weight);
    }

    // Vital sign modifiers map: diagnosis_id → array of applicable modifiers
    const vitalModMap = new Map<string, number[]>();
    for (const vm of vitalModRes.data || []) {
      const vitalValue = getVitalValue(vitals, vm.vital_parameter);
      if (vitalValue === null) continue;
      const applies = vm.condition === "above"
        ? vitalValue > vm.threshold_value
        : vitalValue < vm.threshold_value;
      if (applies) {
        if (!vitalModMap.has(vm.diagnosis_id)) vitalModMap.set(vm.diagnosis_id, []);
        vitalModMap.get(vm.diagnosis_id)!.push(vm.modifier_weight);
      }
    }

    // Symptom cluster modifiers
    const clusterModMap = new Map<string, number>();
    for (const cm of clusterModRes.data || []) {
      const matchCount = (cm.required_symptoms as string[]).filter((rs: string) =>
        normalizedSymptomNames.some((ns: string) => ns === rs || ns.includes(rs) || rs.includes(ns))
      ).length;
      if (matchCount >= cm.min_match_count) {
        const current = clusterModMap.get(cm.diagnosis_id) || 1.0;
        // Use max cluster modifier (don't stack multiple clusters multiplicatively)
        clusterModMap.set(cm.diagnosis_id, Math.max(current, cm.modifier_weight));
      }
    }

    // ════════════════════════════════════════════
    // EXTRACT CLINICAL FEATURES FROM VITALS/SYMPTOMS
    // ════════════════════════════════════════════
    const tempC = getVitalValue(vitals, "temperature");
    const hr = getVitalValue(vitals, "heartRate") ?? getVitalValue(vitals, "heart_rate") ?? getVitalValue(vitals, "pulse");
    const rr = getVitalValue(vitals, "respiratoryRate") ?? getVitalValue(vitals, "respiratory_rate");
    const spo2Val = getVitalValue(vitals, "spo2") ?? getVitalValue(vitals, "SpO2");
    let sbpVal: number | null = null;
    // Accept bp_systolic (from orchestrator) or bloodPressure string (from direct calls)
    const bpSystolicDirect = getVitalValue(vitals, "bp_systolic");
    if (bpSystolicDirect !== null) {
      sbpVal = bpSystolicDirect;
    } else {
      const bpRaw = vitals?.bloodPressure ?? vitals?.blood_pressure ?? vitals?.bp;
      if (typeof bpRaw === "string" && bpRaw.includes("/")) {
        sbpVal = parseInt(bpRaw.split("/")[0]);
        if (isNaN(sbpVal)) sbpVal = null;
      } else if (typeof bpRaw === "number") {
        sbpVal = bpRaw;
      }
    }
    
    console.log("[BayesianEngine] VITALS PARSED:", JSON.stringify({ tempC, hr, rr, spo2: spo2Val, sbp: sbpVal }));

    const normalizedSymptomsLower = normalizedSymptomNames.map(s => s.toLowerCase());
    const allInputSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());
    const allSymptomText = [...normalizedSymptomsLower, ...allInputSymptoms];

    const clinicalFeatures = {
      fever: (tempC !== null && tempC >= 38) || allSymptomText.some(s => s.includes("fever")),
      hypotension: sbpVal !== null && sbpVal < 90,
      tachycardia: hr !== null && hr > 100,
      tachypnea: rr !== null && rr > 22,
      hypoxia: spo2Val !== null && spo2Val < 94,
      altered_mental_status: allSymptomText.some(s =>
        s.includes("confusion") || s.includes("altered") || s.includes("disoriented") || s.includes("drowsy") || s.includes("letharg")),
      infection_source: allSymptomText.some(s =>
        s.includes("infection") || s.includes("abscess") || s.includes("wound") || s.includes("cellulitis")) ||
        normalizedHistory.some((h: string) => h.includes("infection")),
      chest_pain: allSymptomText.some(s => s.includes("chest pain")),
      cough: allSymptomText.some(s => s.includes("cough")),
      dyspnea: allSymptomText.some(s =>
        s.includes("shortness of breath") || s.includes("dyspnea") || s.includes("breathless") || s.includes("difficulty breathing")),
      abdominal_pain: allSymptomText.some(s => s.includes("abdominal pain") || s.includes("stomach pain")),
      diarrhea: allSymptomText.some(s => s.includes("diarrhea") || s.includes("loose stool")),
      vomiting: allSymptomText.some(s => s.includes("vomiting") || s.includes("nausea")),
      headache: allSymptomText.some(s => s.includes("headache")),
      urinary: allSymptomText.some(s =>
        s.includes("urine") || s.includes("urinary") || s.includes("dysuria") || s.includes("reduced urine")),
      sweating: allSymptomText.some(s => s.includes("sweating") || s.includes("diaphoresis")),
      rash: allSymptomText.some(s => s.includes("rash") || s.includes("skin")),
      joint_pain: allSymptomText.some(s => s.includes("joint") || s.includes("arthralgia")),
      sore_throat: allSymptomText.some(s => s.includes("sore throat") || s.includes("pharyngitis")),
      diabetes_history: normalizedHistory.some((h: string) =>
        h.includes("diabetes") || h.includes("diabetic")),
      hypertension_history: normalizedHistory.some((h: string) =>
        h.includes("hypertension") || h.includes("high blood pressure")),
    };

    // Log active features for debugging
    const activeFeatures = Object.entries(clinicalFeatures).filter(([_, v]) => v).map(([k]) => k);
    console.log("[BayesianEngine] ACTIVE FEATURES:", JSON.stringify(activeFeatures));

    // ════════════════════════════════════════════
    // DISEASE-SPECIFIC CLINICAL WEIGHT PROFILES
    // ════════════════════════════════════════════
    // Keys are lowercase disease name fragments matched against diagnosis names
    interface DiseaseWeightProfile {
      features: Record<string, number>;
      interactions: Array<{ conditions: string[]; bonus: number }>;
      age_boost?: { min_age: number; boost: number };
    }

    const DISEASE_WEIGHT_PROFILES: Record<string, DiseaseWeightProfile> = {
      "sepsis": {
        features: {
          hypotension: 2.5, altered_mental_status: 2.0, tachycardia: 1.2,
          tachypnea: 1.2, fever: 1.0, hypoxia: 1.0, infection_source: 1.5,
          urinary: 0.5, diabetes_history: 0.8,
        },
        interactions: [
          { conditions: ["fever", "hypotension"], bonus: 2.5 },
          { conditions: ["hypotension", "tachycardia"], bonus: 1.5 },
          { conditions: ["fever", "altered_mental_status"], bonus: 2.0 },
          { conditions: ["tachycardia", "tachypnea", "fever"], bonus: 1.8 },
        ],
        age_boost: { min_age: 50, boost: 0.8 },
      },
      "pneumonia": {
        features: {
          cough: 2.0, fever: 1.5, dyspnea: 1.8, tachypnea: 1.5,
          hypoxia: 2.0, chest_pain: 0.8, tachycardia: 0.5,
        },
        interactions: [
          { conditions: ["cough", "fever"], bonus: 1.5 },
          { conditions: ["hypoxia", "tachypnea"], bonus: 2.0 },
          { conditions: ["cough", "dyspnea", "fever"], bonus: 2.0 },
        ],
        age_boost: { min_age: 60, boost: 0.6 },
      },
      "myocardial infarction": {
        features: {
          chest_pain: 3.0, sweating: 2.0, dyspnea: 1.5,
          hypotension: 1.5, tachycardia: 1.0, hypertension_history: 1.2,
          diabetes_history: 0.8,
        },
        interactions: [
          { conditions: ["chest_pain", "sweating"], bonus: 2.5 },
          { conditions: ["chest_pain", "dyspnea"], bonus: 1.5 },
          { conditions: ["chest_pain", "hypotension"], bonus: 2.0 },
        ],
        age_boost: { min_age: 45, boost: 1.0 },
      },
      "acute coronary": {
        features: {
          chest_pain: 3.0, sweating: 2.0, dyspnea: 1.5,
          tachycardia: 1.0, hypertension_history: 1.0,
        },
        interactions: [
          { conditions: ["chest_pain", "sweating"], bonus: 2.5 },
        ],
        age_boost: { min_age: 45, boost: 0.8 },
      },
      "urinary tract infection": {
        features: {
          urinary: 2.5, fever: 1.0, abdominal_pain: 0.8,
        },
        interactions: [
          { conditions: ["urinary", "fever"], bonus: 1.5 },
        ],
      },
      "pyelonephritis": {
        features: {
          urinary: 2.0, fever: 1.8, abdominal_pain: 1.0,
          tachycardia: 0.8, hypotension: 1.0,
        },
        interactions: [
          { conditions: ["urinary", "fever", "tachycardia"], bonus: 1.5 },
        ],
      },
      "gastroenteritis": {
        features: {
          diarrhea: 2.5, vomiting: 2.0, abdominal_pain: 1.5,
          fever: 0.8,
        },
        interactions: [
          { conditions: ["diarrhea", "vomiting"], bonus: 1.5 },
          { conditions: ["diarrhea", "abdominal_pain", "fever"], bonus: 1.0 },
        ],
      },
      "meningitis": {
        features: {
          headache: 2.0, fever: 2.0, altered_mental_status: 2.5,
          vomiting: 1.0, rash: 1.0,
        },
        interactions: [
          { conditions: ["headache", "fever", "altered_mental_status"], bonus: 3.0 },
        ],
      },
      "asthma": {
        features: {
          dyspnea: 2.0, cough: 1.5, tachypnea: 1.0, hypoxia: 1.0,
        },
        interactions: [
          { conditions: ["dyspnea", "cough"], bonus: 1.0 },
        ],
      },
      "copd": {
        features: {
          dyspnea: 2.0, cough: 1.5, tachypnea: 1.2, hypoxia: 1.5,
        },
        interactions: [
          { conditions: ["dyspnea", "hypoxia"], bonus: 1.5 },
        ],
        age_boost: { min_age: 50, boost: 0.6 },
      },
      "pulmonary embolism": {
        features: {
          dyspnea: 2.5, chest_pain: 2.0, tachycardia: 1.5,
          hypoxia: 2.0, hypotension: 1.5,
        },
        interactions: [
          { conditions: ["dyspnea", "tachycardia", "hypoxia"], bonus: 2.5 },
          { conditions: ["chest_pain", "dyspnea"], bonus: 1.5 },
        ],
      },
      "dengue": {
        features: {
          fever: 2.0, headache: 1.5, joint_pain: 1.5, rash: 1.5,
        },
        interactions: [
          { conditions: ["fever", "joint_pain", "rash"], bonus: 2.0 },
        ],
      },
      "malaria": {
        features: {
          fever: 2.5, chills: 2.0, headache: 1.0, sweating: 1.0,
        },
        interactions: [
          { conditions: ["fever", "chills"], bonus: 1.5 },
        ],
      },
      "pharyngitis": {
        features: {
          sore_throat: 3.0, fever: 1.5,
        },
        interactions: [],
      },
      "diabetic ketoacidosis": {
        features: {
          vomiting: 1.5, abdominal_pain: 1.5, altered_mental_status: 2.0,
          tachypnea: 2.0, diabetes_history: 3.0,
        },
        interactions: [
          { conditions: ["diabetes_history", "vomiting", "tachypnea"], bonus: 2.5 },
        ],
      },
      "migraine": {
        features: {
          headache: 3.0, vomiting: 1.0,
        },
        interactions: [],
      },
      "tension headache": {
        features: {
          headache: 2.5,
        },
        interactions: [],
      },
      "cluster headache": {
        features: {
          headache: 2.8,
        },
        interactions: [],
      },
    };

    // ════════════════════════════════════════════
    // FETCH DIAGNOSIS NAMES FOR WEIGHT MATCHING
    // ════════════════════════════════════════════
    const { data: diagNameRows } = await supabase
      .from("diagnoses")
      .select("id, diagnosis_name")
      .in("id", validCandidateIds);

    const diagNameMap = new Map<string, string>();
    for (const row of diagNameRows || []) {
      diagNameMap.set(row.id, row.diagnosis_name.toLowerCase());
    }

    // ════════════════════════════════════════════
    // COMPUTE POSTERIORS
    // ════════════════════════════════════════════

    // Granular age group mapping matching disease_priors keys
    const ageGroup = getAgeGroup(patient_age);
    const sexKey = (patient_sex || "").toLowerCase() === "female" ? "female" : "male";
    const regionKey = region || "south_asia";

    interface BayesianDiagnosis {
      diagnosis_id: string;
      prior: number;
      history_multiplier: number;
      symptom_likelihood: number;
      coverage_ratio: number;
      physiology_likelihood: number;
      risk_modifier: number;
      duration_modifier: number;
      onset_modifier: number;
      vital_modifier: number;
      cluster_modifier: number;
      clinical_feature_score: number;
      interaction_bonus: number;
      log_score: number;
      posterior_probability: number;
      supporting_evidence: string[];
      must_not_miss: boolean;
    }

    const results: BayesianDiagnosis[] = [];
    const DEFAULT_PRIOR = 0.05;

    const diagsWithSymLik = validCandidateIds.filter((id: string) => (symLikMap.get(id) || []).length > 0).length;
    const hasAnySymLikData = diagsWithSymLik > 0;
    const totalSymptoms = symptomIds.length;

    for (const diagId of validCandidateIds) {
      // ── 1. PRIOR: P(D) with demographic modifiers ──
      const priorData = priorsMap.get(diagId);
      let prior = priorData?.base_prevalence ?? DEFAULT_PRIOR;

      if (priorData) {
        const ageMod = resolveAgeModifier(priorData.age_modifier, ageGroup, patient_age);
        const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
        const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
        prior *= ageMod * sexMod * regMod;
      }

      // ── 2. HISTORY MULTIPLIER ──
      const historyMult = historyMultiplierMap.get(diagId) || 1.0;
      const adjustedPrior = Math.min(prior * historyMult, 0.95);

      let logScore = Math.log(Math.max(adjustedPrior, 1e-8));

      // ── 3. SPECIFICITY-WEIGHTED SYMPTOM LOG-LIKELIHOOD ──
      const symLiks = symLikMap.get(diagId) || [];
      let weightedSymLogLik = 0;
      let coverageRatio = 0;

      if (symLiks.length > 0) {
        for (const sl of symLiks) {
          const lik = Math.max(0.01, Math.min(0.99, sl.likelihood_value));
          const w = Math.max(0.1, sl.specificity);
          weightedSymLogLik += w * Math.log(lik);
        }
        coverageRatio = totalSymptoms > 0 ? symLiks.length / totalSymptoms : 0;
        const coverageBonus = Math.pow(coverageRatio, 1.5);
        logScore += weightedSymLogLik + Math.log(Math.max(coverageBonus, 1e-4));
      } else if (totalSymptoms > 0) {
        if (hasAnySymLikData) {
          logScore += Math.min(totalSymptoms, 3) * Math.log(0.15);
        } else {
          logScore += Math.log(0.3);
        }
      }

      // ── 4. TEMPORAL MODIFIERS ──
      const durMod = durationModMap.get(diagId) || 1.0;
      const onMod = onsetModMap.get(diagId) || 1.0;
      if (durMod !== 1.0) logScore += Math.log(durMod);
      if (onMod !== 1.0) logScore += Math.log(onMod);

      // ── 5. VITAL SIGN MODIFIERS (DB-driven) ──
      const vitalMods = vitalModMap.get(diagId) || [];
      let vitalModifier = 1.0;
      if (vitalMods.length > 0) {
        const maxVitalMod = Math.max(...vitalMods);
        vitalModifier = maxVitalMod;
        logScore += Math.log(maxVitalMod);
      }

      // ── 6. SYMPTOM CLUSTER MODIFIER ──
      const clusterMod = clusterModMap.get(diagId) || 1.0;
      if (clusterMod > 1.0) logScore += Math.log(clusterMod);

      // ── 7. PHYSIOLOGY LIKELIHOOD ──
      const physLiks = physioLikMap.get(diagId) || [];
      let physioLogLik = 0;
      if (physLiks.length > 0) {
        for (const l of physLiks) {
          physioLogLik += Math.log(Math.max(0.01, Math.min(0.99, l)));
        }
        logScore += physioLogLik;
      }

      // ── 8. RISK FACTOR MODIFIERS ──
      const riskMods = riskModMap.get(diagId) || [];
      let riskModifier = 1.0;
      for (const w of riskMods) {
        riskModifier *= w;
        logScore += Math.log(Math.max(w, 1e-4));
      }

      // ════════════════════════════════════════════
      // ── 9. CLINICAL FEATURE WEIGHTS (NEW — breaks uniformity) ──
      // ════════════════════════════════════════════
      let clinicalFeatureScore = 0;
      let interactionBonus = 0;

      const diagName = diagNameMap.get(diagId) || "";

      // Find matching weight profile
      let matchedProfile: DiseaseWeightProfile | null = null;
      for (const [pattern, profile] of Object.entries(DISEASE_WEIGHT_PROFILES)) {
        if (diagName.includes(pattern)) {
          matchedProfile = profile;
          break;
        }
      }

      if (matchedProfile) {
        // Apply feature weights
        for (const [featureKey, weight] of Object.entries(matchedProfile.features)) {
          if ((clinicalFeatures as any)[featureKey]) {
            clinicalFeatureScore += weight;
          }
        }

        // Apply interaction terms (non-linear separation)
        for (const interaction of matchedProfile.interactions) {
          const allMet = interaction.conditions.every(c => (clinicalFeatures as any)[c]);
          if (allMet) {
            interactionBonus += interaction.bonus;
          }
        }

        // Age-conditional boost
        if (matchedProfile.age_boost && patient_age !== null && patient_age >= matchedProfile.age_boost.min_age) {
          clinicalFeatureScore += matchedProfile.age_boost.boost;
        }
      }

      // Add clinical feature score directly to log_score
      // This is the key differentiator — diseases with matching features
      // get strong positive boosts while others don't
      logScore += clinicalFeatureScore + interactionBonus;

      // Collect supporting evidence
      const evidence: string[] = [];
      if (symLiks.length > 0) evidence.push(`${symLiks.length}/${totalSymptoms} symptoms (coverage ${(coverageRatio * 100).toFixed(0)}%)`);
      if (physLiks.length > 0) evidence.push(`${physLiks.length} physiology match(es)`);
      if (riskMods.length > 0) evidence.push(`${riskMods.length} risk factor(s)`);
      if (historyMult > 1.0) evidence.push(`history boost ×${historyMult.toFixed(1)}`);
      if (durMod !== 1.0) evidence.push(`duration(${durationCategory}) ×${durMod.toFixed(1)}`);
      if (onMod !== 1.0) evidence.push(`onset(${onsetCategory}) ×${onMod.toFixed(1)}`);
      if (vitalMods.length > 0) evidence.push(`vitals boost ×${vitalModifier.toFixed(1)}`);
      if (clusterMod > 1.0) evidence.push(`cluster match ×${clusterMod.toFixed(1)}`);
      if (clinicalFeatureScore > 0) evidence.push(`clinical features +${clinicalFeatureScore.toFixed(1)}`);
      if (interactionBonus > 0) evidence.push(`interactions +${interactionBonus.toFixed(1)}`);
      if (priorData) evidence.push(`prior: ${(adjustedPrior * 100).toFixed(1)}%`);

      results.push({
        diagnosis_id: diagId,
        prior: adjustedPrior,
        history_multiplier: historyMult,
        symptom_likelihood: symLiks.length > 0 ? Math.exp(weightedSymLogLik) : 0,
        coverage_ratio: coverageRatio,
        physiology_likelihood: physLiks.length > 0 ? Math.exp(physioLogLik) : 1,
        risk_modifier: riskModifier,
        duration_modifier: durMod,
        onset_modifier: onMod,
        vital_modifier: vitalModifier,
        cluster_modifier: clusterMod,
        clinical_feature_score: clinicalFeatureScore,
        interaction_bonus: interactionBonus,
        log_score: logScore,
        posterior_probability: 0,
        supporting_evidence: evidence,
        must_not_miss: dangerousSet.has(diagId),
      });
    }

    // ════════════════════════════════════════════
    // TEMPERATURE-SCALED SOFTMAX NORMALIZATION
    // ════════════════════════════════════════════
    // T < 1.0 sharpens distribution; T = 0.7 provides strong clinical differentiation
    const TEMPERATURE = 0.7;
    const scaledScores = results.map(d => d.log_score / TEMPERATURE);
    const maxLog = Math.max(...scaledScores);
    const expScores = scaledScores.map(s => Math.exp(s - maxLog));
    const sumExp = expScores.reduce((s, e) => s + e, 0) || 1;
    for (let i = 0; i < results.length; i++) {
      results[i].posterior_probability = parseFloat((expScores[i] / sumExp).toFixed(4));
    }

    // Ensure must-not-miss have minimum 3% visibility
    for (const d of results) {
      if (d.must_not_miss && d.posterior_probability < 0.03) {
        d.posterior_probability = 0.03;
      }
    }

    const newTotal = results.reduce((s, d) => s + d.posterior_probability, 0) || 1;
    for (const d of results) {
      d.posterior_probability = parseFloat((d.posterior_probability / newTotal).toFixed(4));
    }

    results.sort((a, b) => b.posterior_probability - a.posterior_probability);

    // ── SCORE TRACE (for debugging) ──
    console.log("[BayesianEngine] Score trace:", JSON.stringify(
      results.slice(0, 8).map(d => ({
        id: d.diagnosis_id,
        name: diagNameMap.get(d.diagnosis_id) || "?",
        prior: d.prior.toFixed(4),
        feature_score: d.clinical_feature_score.toFixed(1),
        interaction: d.interaction_bonus.toFixed(1),
        log_score: d.log_score.toFixed(2),
        posterior: (d.posterior_probability * 100).toFixed(1) + "%",
      }))
    ));

    // ── FLAT DISTRIBUTION WARNING ──
    if (results.length >= 3) {
      const top = results[0]?.posterior_probability || 0;
      const bottom = results[Math.min(results.length - 1, 4)]?.posterior_probability || 0;
      if (top > 0 && bottom > 0 && (top - bottom) < 0.05) {
        console.warn(`[BayesianEngine] ⚠️ FLAT DISTRIBUTION DETECTED — top=${(top*100).toFixed(1)}%, bottom=${(bottom*100).toFixed(1)}%. Feature weights may not be applying.`);
      }
    }

    // Log clinical features for verification
    const activeFeatures = Object.entries(clinicalFeatures).filter(([, v]) => v).map(([k]) => k);
    console.log(`[BayesianEngine] Clinical features active: [${activeFeatures.join(", ")}]`);

    const executionMs = Date.now() - start;

    return new Response(JSON.stringify({
      diagnoses: results.map(d => ({
        diagnosis_id: d.diagnosis_id,
        posterior_probability: d.posterior_probability,
        prior: parseFloat(d.prior.toFixed(4)),
        history_multiplier: parseFloat(d.history_multiplier.toFixed(2)),
        symptom_likelihood: parseFloat(d.symptom_likelihood.toFixed(6)),
        coverage_ratio: parseFloat(d.coverage_ratio.toFixed(4)),
        physiology_likelihood: parseFloat(d.physiology_likelihood.toFixed(4)),
        risk_modifier: parseFloat(d.risk_modifier.toFixed(4)),
        duration_modifier: parseFloat(d.duration_modifier.toFixed(2)),
        onset_modifier: parseFloat(d.onset_modifier.toFixed(2)),
        vital_modifier: parseFloat(d.vital_modifier.toFixed(2)),
        cluster_modifier: parseFloat(d.cluster_modifier.toFixed(2)),
        clinical_feature_score: parseFloat(d.clinical_feature_score.toFixed(2)),
        interaction_bonus: parseFloat(d.interaction_bonus.toFixed(2)),
        log_score: parseFloat(d.log_score.toFixed(4)),
        supporting_evidence: d.supporting_evidence,
        must_not_miss: d.must_not_miss,
      })),
      total_candidates: validCandidateIds.length,
      symptoms_resolved: symptomIds.length,
      physiology_states_used: physiological_state_ids.length,
      risk_factors_applied: normalizedRiskFactors.length,
      history_modifiers_applied: historyModRes.data?.length || 0,
      duration_category: durationCategory,
      onset_pattern: onsetCategory,
      vitals_signals_applied: Array.from(vitalModMap.values()).flat().length,
      cluster_matches: Array.from(clusterModMap.entries()).filter(([, v]) => v > 1).length,
      clinical_features_detected: Object.entries(clinicalFeatures).filter(([, v]) => v).map(([k]) => k),
      execution_ms: executionMs,
      source: "bayesian_engine_v5_clinical_weights",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[BayesianEngine] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════

/**
 * Map patient age to granular age group matching disease_priors keys.
 * Supports: child, pediatric, young_adult, adult, middle_aged, elderly
 */
function getAgeGroup(age: number | null): string {
  if (age === null) return "adult";
  if (age < 5) return "child";
  if (age < 18) return "pediatric";
  if (age < 35) return "young_adult";
  if (age < 55) return "adult";
  if (age < 65) return "middle_aged";
  return "elderly";
}

/**
 * Resolve age modifier from disease_priors JSON, with fallback hierarchy.
 * E.g., if ageGroup is "young_adult" but only "adult" key exists, fall back.
 */
function resolveAgeModifier(ageModifier: Record<string, number> | null, ageGroup: string, age: number | null): number {
  if (!ageModifier || Object.keys(ageModifier).length === 0) return 1.0;

  // Direct match
  if (ageModifier[ageGroup] !== undefined) return ageModifier[ageGroup];

  // Fallback hierarchy
  const fallbacks: Record<string, string[]> = {
    child: ["pediatric", "young_adult", "adult"],
    pediatric: ["child", "young_adult", "adult"],
    young_adult: ["adult", "middle_aged"],
    adult: ["middle_aged", "young_adult"],
    middle_aged: ["adult", "elderly"],
    elderly: ["middle_aged", "adult"],
  };

  for (const fallback of fallbacks[ageGroup] || []) {
    if (ageModifier[fallback] !== undefined) return ageModifier[fallback];
  }

  return 1.0;
}

/**
 * Classify free-text duration into categories.
 */
function classifyDuration(duration: string | null): string | null {
  if (!duration) return null;
  const d = duration.toLowerCase().trim();

  // Direct categories
  if (["acute", "subacute", "chronic"].includes(d)) return d;

  // Parse temporal expressions
  const hourMatch = d.match(/(\d+)\s*h(our)?s?/);
  const dayMatch = d.match(/(\d+)\s*d(ay)?s?/);
  const weekMatch = d.match(/(\d+)\s*w(eek)?s?/);
  const monthMatch = d.match(/(\d+)\s*m(onth)?s?/);
  const yearMatch = d.match(/(\d+)\s*y(ear)?s?/);

  let totalDays = 0;
  if (hourMatch) totalDays = parseInt(hourMatch[1]) / 24;
  else if (dayMatch) totalDays = parseInt(dayMatch[1]);
  else if (weekMatch) totalDays = parseInt(weekMatch[1]) * 7;
  else if (monthMatch) totalDays = parseInt(monthMatch[1]) * 30;
  else if (yearMatch) totalDays = parseInt(yearMatch[1]) * 365;

  // Keyword-based
  if (d.includes("sudden") || d.includes("minutes") || d.includes("hour")) return "acute";
  if (d.includes("today") || d.includes("yesterday") || d.includes("since morning")) return "acute";
  if (d.includes("few days") || d.includes("couple of days")) return "acute";
  if (d.includes("weeks") || d.includes("fortnight")) return "subacute";
  if (d.includes("months") || d.includes("years") || d.includes("long time") || d.includes("chronic")) return "chronic";

  if (totalDays > 0) {
    if (totalDays <= 7) return "acute";
    if (totalDays <= 30) return "subacute";
    return "chronic";
  }

  return null;
}

/**
 * Classify onset pattern from free text.
 */
function classifyOnset(onset: string | null): string | null {
  if (!onset) return null;
  const o = onset.toLowerCase().trim();

  if (["sudden", "gradual", "progressive", "intermittent", "episodic"].includes(o)) return o;

  if (o.includes("sudden") || o.includes("abrupt") || o.includes("all at once") || o.includes("acute")) return "sudden";
  if (o.includes("gradual") || o.includes("slowly") || o.includes("over time") || o.includes("insidious")) return "gradual";
  if (o.includes("progressive") || o.includes("getting worse") || o.includes("worsening")) return "progressive";
  if (o.includes("comes and goes") || o.includes("intermittent") || o.includes("on and off")) return "intermittent";
  if (o.includes("episodic") || o.includes("attacks") || o.includes("episodes")) return "episodic";

  return null;
}

/**
 * Extract vital sign value, handling unit normalization.
 */
function getVitalValue(vitals: Record<string, any>, parameter: string): number | null {
  const val = vitals[parameter];
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (isNaN(num)) return null;

  // Temperature: auto-detect Fahrenheit vs Celsius
  if (parameter === "temperature") {
    return num > 50 ? (num - 32) * 5 / 9 : num;
  }

  return num;
}
