import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * V3 Probabilistic Diagnostic Engine — Discriminative Competitive Architecture
 *
 * Key differences from V2:
 * 1. 25 diagnosis-selective composite states (not 7 universal)
 * 2. Delta-based contribution: (posterior - prior) × logLR
 * 3. State interaction layer with conflict groups
 * 4. Competitive scoring: relative centering + pairwise amplification
 * 5. Coverage penalty + entropy penalty
 * 6. Anti-correlated state-diagnosis mappings
 *
 * Core invariant: Evidence FOR one diagnosis = evidence AGAINST others
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const start = Date.now();

  try {
    // ═══════════════════════════════════════
    // AUTH (same as V2)
    // ═══════════════════════════════════════
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "").trim();
    let isServiceRole = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        isServiceRole = payload.role === "service_role";
      }
    } catch (_) { /* */ }

    if (!isServiceRole) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ═══════════════════════════════════════
    // INPUT PARSING
    // ═══════════════════════════════════════
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
      duration = null,
      onset_pattern = null,
    } = body;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validCandidateIds = candidate_diagnosis_ids.filter((id: string) => UUID_RE.test(id));

    // Auto-expand from symptoms if no candidates
    if (validCandidateIds.length === 0 && symptoms.length > 0) {
      const normalized = symptoms.map((s: string) => s.toLowerCase().trim());
      const { data: symLookup } = await supabase.from("symptoms").select("id").in("symptom_name", normalized);
      const symIds = (symLookup || []).map((s: any) => s.id);
      if (symIds.length > 0) {
        const { data: slRows } = await supabase.from("symptom_likelihoods").select("diagnosis_id").in("symptom_id", symIds);
        validCandidateIds = [...new Set((slRows || []).map((r: any) => r.diagnosis_id))].filter((id: string) => UUID_RE.test(id));
      }
      if (validCandidateIds.length === 0) {
        const { data: topDx } = await supabase.from("disease_priors").select("diagnosis_id").order("base_prevalence", { ascending: false }).limit(20);
        validCandidateIds = (topDx || []).map((r: any) => r.diagnosis_id).filter((id: string) => UUID_RE.test(id));
      }
    }

    if (validCandidateIds.length === 0) {
      return new Response(JSON.stringify({
        diagnoses: [], execution_ms: Date.now() - start,
        source: "probabilistic_engine_v3_discriminative", note: "no_candidates_resolved",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ═══════════════════════════════════════
    // SYMPTOM RESOLUTION
    // ═══════════════════════════════════════
    let symptomIds: string[] = [];
    const normalizedSymptomNames: string[] = [];
    if (symptoms.length > 0) {
      const normalized = symptoms.map((s: string) => s.toLowerCase().trim());
      const { data: symRows } = await supabase.from("symptoms").select("id, symptom_name").in("symptom_name", normalized);
      const exactIds = new Set((symRows || []).map((s: any) => s.id));
      const exactNames = new Set((symRows || []).map((s: any) => s.symptom_name));
      for (const n of exactNames) normalizedSymptomNames.push(n as string);
      const unmatched = normalized.filter((s: string) => !exactNames.has(s));
      if (unmatched.length > 0) {
        const fuzzyResults = await Promise.all(unmatched.map(s =>
          supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
        ));
        for (const res of fuzzyResults) {
          for (const s of res.data || []) { exactIds.add(s.id); normalizedSymptomNames.push(s.symptom_name); }
        }
      }
      symptomIds = Array.from(exactIds);
    }

    const normalizedHistory = medical_history.map((h: string) => h.toLowerCase().trim());
    const normalizedRiskFactors = risk_factors.map((r: string) => r.toLowerCase().trim());
    const durationCategory = classifyDuration(duration);
    const onsetCategory = classifyOnset(onset_pattern);

    // ═══════════════════════════════════════
    // FEATURE EXTRACTION (continuous logLR + binary)
    // ═══════════════════════════════════════
    const tempC = getVitalValue(vitals, "temperature");
    const hr = getVitalValue(vitals, "heartRate") ?? getVitalValue(vitals, "heart_rate") ?? getVitalValue(vitals, "pulse");
    const rr = getVitalValue(vitals, "respiratoryRate") ?? getVitalValue(vitals, "respiratory_rate");
    const spo2Val = getVitalValue(vitals, "spo2") ?? getVitalValue(vitals, "SpO2") ?? getVitalValue(vitals, "spO2") ?? getVitalValue(vitals, "oxygen_saturation") ?? getVitalValue(vitals, "oxygenSaturation");
    let sbpVal: number | null = null;
    const bpSystolicDirect = getVitalValue(vitals, "bp_systolic") ?? getVitalValue(vitals, "blood_pressure_systolic") ?? getVitalValue(vitals, "systolic") ?? getVitalValue(vitals, "sbp");
    if (bpSystolicDirect !== null) { sbpVal = bpSystolicDirect; }
    else {
      const bpRaw = vitals?.bloodPressure ?? vitals?.blood_pressure ?? vitals?.bp;
      if (typeof bpRaw === "string" && bpRaw.includes("/")) { sbpVal = parseInt(bpRaw.split("/")[0]); if (isNaN(sbpVal)) sbpVal = null; }
      else if (typeof bpRaw === "number") { sbpVal = bpRaw; }
    }

    const allSymptomText = [...normalizedSymptomNames.map(s => s.toLowerCase()), ...symptoms.map((s: string) => s.toLowerCase().trim())];

    const labResults = body.lab_results || body.labs || {};
    const labLower: Record<string, any> = {};
    for (const [k, v] of Object.entries(labResults)) { labLower[k.toLowerCase()] = v; }
    const lactateValue = labLower.lactate ?? vitals?.lactate ?? null;
    const crpValue = labLower.crp ?? vitals?.crp ?? null;
    const wbcValue = labLower.wbc ?? vitals?.wbc ?? null;
    const procalcitoninValue = labLower.procalcitonin ?? vitals?.procalcitonin ?? null;
    const troponinValue = labLower.troponin ?? vitals?.troponin ?? null;

    // Continuous feature logLR
    const continuousFeatures: Record<string, number> = {};
    if (tempC !== null) {
      continuousFeatures["fever"] = continuousLogLR(tempC, { x0: 38.0, k: 1.5, L: 2.0 });
      continuousFeatures["no_fever"] = -continuousFeatures["fever"];
    }
    if (hr !== null) {
      continuousFeatures["tachycardia"] = continuousLogLR(hr, { x0: 100, k: 0.08, L: 1.8 });
      continuousFeatures["no_tachycardia"] = -continuousFeatures["tachycardia"];
    }
    if (sbpVal !== null) {
      continuousFeatures["hypotension"] = continuousLogLR(sbpVal, { x0: 100, k: 0.08, L: 2.5, invert: true });
      continuousFeatures["no_hypotension"] = -continuousFeatures["hypotension"];
    }
    if (rr !== null) { continuousFeatures["tachypnea"] = continuousLogLR(rr, { x0: 22, k: 0.15, L: 1.5 }); }
    if (spo2Val !== null) {
      continuousFeatures["hypoxia"] = continuousLogLR(spo2Val, { x0: 94, k: 0.3, L: 2.0, invert: true });
      continuousFeatures["no_hypoxia"] = -continuousFeatures["hypoxia"];
    }
    if (lactateValue !== null) { const lv = Number(lactateValue); if (!isNaN(lv)) continuousFeatures["lactate_high"] = continuousLogLR(lv, { x0: 2.0, k: 0.8, L: 3.0 }); }
    if (crpValue !== null) { const cv = Number(crpValue); if (!isNaN(cv)) continuousFeatures["crp_high"] = continuousLogLR(cv, { x0: 10, k: 0.15, L: 2.0 }); }
    if (wbcValue !== null) {
      const wv = Number(wbcValue);
      if (!isNaN(wv)) { continuousFeatures["wbc_abnormal"] = Math.max(continuousLogLR(wv, { x0: 12000, k: 0.0005, L: 1.8 }), continuousLogLR(wv, { x0: 4000, k: 0.001, L: 1.5, invert: true }), 0); }
    }
    if (procalcitoninValue !== null) { const pv = Number(procalcitoninValue); if (!isNaN(pv)) continuousFeatures["procalcitonin_high"] = continuousLogLR(pv, { x0: 0.5, k: 3.0, L: 2.5 }); }
    if (troponinValue !== null) { const tv = Number(troponinValue); if (!isNaN(tv)) continuousFeatures["troponin_high"] = continuousLogLR(tv, { x0: 0.04, k: 50, L: 2.5 }); }

    // Binary symptom features
    const symptomFeatures: Record<string, boolean> = {
      altered_mental_status: allSymptomText.some(s => s.includes("confusion") || s.includes("altered") || s.includes("disoriented") || s.includes("drowsy") || s.includes("letharg")),
      infection_source: allSymptomText.some(s => s.includes("infection") || s.includes("abscess") || s.includes("wound") || s.includes("cellulitis")) || normalizedHistory.some((h: string) => h.includes("infection")),
      chest_pain: allSymptomText.some(s => s.includes("chest pain")),
      cough: allSymptomText.some(s => s.includes("cough")),
      dyspnea: allSymptomText.some(s => s.includes("shortness of breath") || s.includes("dyspnea") || s.includes("breathless") || s.includes("difficulty breathing")),
      abdominal_pain: allSymptomText.some(s => s.includes("abdominal pain") || s.includes("stomach pain")),
      diarrhea: allSymptomText.some(s => s.includes("diarrhea") || s.includes("loose stool")),
      vomiting: allSymptomText.some(s => s.includes("vomiting") || s.includes("nausea")),
      headache: allSymptomText.some(s => s.includes("headache")),
      urinary: allSymptomText.some(s => s.includes("urine") || s.includes("urinary") || s.includes("dysuria") || s.includes("reduced urine")),
      sweating: allSymptomText.some(s => s.includes("sweating") || s.includes("diaphoresis")),
      rash: allSymptomText.some(s => s.includes("rash") || s.includes("skin")),
      joint_pain: allSymptomText.some(s => s.includes("joint") || s.includes("arthralgia")),
      sore_throat: allSymptomText.some(s => s.includes("sore throat") || s.includes("pharyngitis")),
      diabetes_history: normalizedHistory.some((h: string) => h.includes("diabetes") || h.includes("diabetic")),
      hypertension_history: normalizedHistory.some((h: string) => h.includes("hypertension") || h.includes("high blood pressure")),
    };

    const negativeSymptomFeatures: Record<string, boolean> = {
      no_chest_pain: !symptomFeatures.chest_pain,
      no_dyspnea: !symptomFeatures.dyspnea,
      no_cough: !symptomFeatures.cough,
      no_altered_mental_status: !symptomFeatures.altered_mental_status,
      no_headache: !symptomFeatures.headache,
      no_sweating: !symptomFeatures.sweating,
      no_joint_pain: !symptomFeatures.joint_pain,
    };

    const allBinaryFeatures: Record<string, boolean> = { ...symptomFeatures, ...negativeSymptomFeatures };

    // ═══════════════════════════════════════
    // PARALLEL FETCH — V3 tables + V1 modifiers
    // ═══════════════════════════════════════
    const [
      v3StatesRes, v3FeatureStateRes, v3StateDiagRes,
      priorsRes, symptomLikRes, riskModRes, historyModRes,
      dangerousRes, durationModRes, onsetModRes, vitalModRes, clusterModRes,
      diagNamesRes,
    ] = await Promise.all([
      supabase.from("v3_composite_states").select("*"),
      supabase.from("v3_feature_state_mappings").select("*"),
      supabase.from("v3_state_diagnosis_mappings").select("*").in("diagnosis_id", validCandidateIds),
      supabase.from("disease_priors").select("diagnosis_id, base_prevalence, age_modifier, sex_modifier, region_modifier").in("diagnosis_id", validCandidateIds),
      symptomIds.length > 0
        ? supabase.from("symptom_likelihoods").select("diagnosis_id, symptom_id, likelihood_value, symptom_specificity").in("diagnosis_id", validCandidateIds).in("symptom_id", symptomIds)
        : Promise.resolve({ data: [] }),
      normalizedRiskFactors.length > 0
        ? supabase.from("risk_factor_modifiers").select("diagnosis_id, risk_factor, modifier_weight").in("diagnosis_id", validCandidateIds).in("risk_factor", normalizedRiskFactors)
        : Promise.resolve({ data: [] }),
      normalizedHistory.length > 0
        ? supabase.from("medical_history_modifiers").select("diagnosis_id, history_condition, prior_multiplier, confidence").in("diagnosis_id", validCandidateIds).in("history_condition", normalizedHistory)
        : Promise.resolve({ data: [] }),
      supabase.from("dangerous_diagnoses").select("diagnosis_id, must_not_miss").eq("must_not_miss", true).in("diagnosis_id", validCandidateIds),
      durationCategory ? supabase.from("duration_modifiers").select("diagnosis_id, duration_category, modifier_weight").in("diagnosis_id", validCandidateIds).eq("duration_category", durationCategory) : Promise.resolve({ data: [] }),
      onsetCategory ? supabase.from("onset_modifiers").select("diagnosis_id, onset_pattern, modifier_weight").in("diagnosis_id", validCandidateIds).eq("onset_pattern", onsetCategory) : Promise.resolve({ data: [] }),
      supabase.from("vital_sign_modifiers").select("diagnosis_id, vital_parameter, condition, threshold_value, modifier_weight").in("diagnosis_id", validCandidateIds),
      supabase.from("symptom_cluster_modifiers").select("diagnosis_id, cluster_name, required_symptoms, min_match_count, modifier_weight").in("diagnosis_id", validCandidateIds),
      supabase.from("diagnoses").select("id, diagnosis_name").in("id", validCandidateIds),
    ]);

    const diagNameMap = new Map<string, string>();
    for (const d of (diagNamesRes.data || [])) diagNameMap.set(d.id, d.diagnosis_name);

    // ═══════════════════════════════════════
    // V3 STEP 1: COMPUTE STATE POSTERIORS
    // Using delta-based: contribution only when evidence shifts state from prior
    // ═══════════════════════════════════════
    const v3States = v3StatesRes.data || [];
    const v3FeatureStateLRs = v3FeatureStateRes.data || [];

    // Build feature→state lookup: stateId → featureName → logLR
    const featureStateMap = new Map<string, Map<string, number>>();
    for (const fsl of v3FeatureStateLRs) {
      if (!featureStateMap.has(fsl.state_id)) featureStateMap.set(fsl.state_id, new Map());
      featureStateMap.get(fsl.state_id)!.set(fsl.feature_name, Number(fsl.log_likelihood_ratio));
    }

    // Data completeness scoring
    const KEY_DATA_FIELDS = [
      { name: "temperature", present: tempC !== null, weight: 0.15 },
      { name: "heart_rate", present: hr !== null, weight: 0.10 },
      { name: "blood_pressure", present: sbpVal !== null, weight: 0.15 },
      { name: "spo2", present: spo2Val !== null, weight: 0.12 },
      { name: "respiratory_rate", present: rr !== null, weight: 0.08 },
      { name: "lactate", present: lactateValue !== null, weight: 0.15 },
      { name: "crp", present: crpValue !== null, weight: 0.10 },
      { name: "wbc", present: wbcValue !== null, weight: 0.08 },
      { name: "troponin", present: troponinValue !== null, weight: 0.07 },
    ];
    const dataCompletenessScore = KEY_DATA_FIELDS.reduce((sum, f) => sum + (f.present ? f.weight : 0), 0);
    const totalPossibleWeight = KEY_DATA_FIELDS.reduce((sum, f) => sum + f.weight, 0);
    const completeness = dataCompletenessScore / totalPossibleWeight;

    const LOG_ODDS_CLAMP = 6.0;
    const statePosteriors = new Map<string, number>();
    const stateLogOdds = new Map<string, number>();
    const statePriors = new Map<string, number>();

    for (const state of v3States) {
      const prior = Number(state.prior_probability) || 0.1;
      statePriors.set(state.id, prior);
      const priorLogOdds = Math.log(prior / (1 - prior));
      let logOdds = priorLogOdds;
      const stateFeatures = featureStateMap.get(state.id);

      if (stateFeatures) {
        const contributions: number[] = [];
        for (const [featureName, dbLogLR] of stateFeatures) {
          if (featureName in continuousFeatures) {
            const continuousLR = continuousFeatures[featureName];
            // CRITICAL: Only activate when the feature condition IS MET (positive continuousLR).
            // When continuousLR < 0 the feature is ABSENT — skip it entirely.
            // This prevents no_fever from canceling fever when patient HAS fever.
            if (continuousLR > 0.01) {
              const normalizedMagnitude = Math.min(continuousLR / 2.0, 1.0);
              contributions.push(dbLogLR * normalizedMagnitude);
            }
          } else if (allBinaryFeatures[featureName]) {
            contributions.push(dbLogLR);
          }
        }
        // Diminishing returns
        contributions.sort((a, b) => Math.abs(b) - Math.abs(a));
        let evidenceUpdate = 0;
        for (let i = 0; i < contributions.length; i++) {
          evidenceUpdate += contributions[i] / Math.sqrt(1 + i);
        }
        // Scale by data completeness
        logOdds += evidenceUpdate * (0.5 + 0.5 * completeness);
      }

      logOdds = Math.max(-LOG_ODDS_CLAMP, Math.min(LOG_ODDS_CLAMP, logOdds));
      stateLogOdds.set(state.id, logOdds);
      statePosteriors.set(state.id, 1 / (1 + Math.exp(-logOdds)));
    }

    // ═══════════════════════════════════════
    // V3 STEP 2: STATE INTERACTION LAYER
    // States in same conflict_group compete via softmax
    // ═══════════════════════════════════════
    const conflictGroups = new Map<string, string[]>();
    for (const state of v3States) {
      if (state.conflict_group) {
        if (!conflictGroups.has(state.conflict_group)) conflictGroups.set(state.conflict_group, []);
        conflictGroups.get(state.conflict_group)!.push(state.id);
      }
    }

    for (const [groupName, groupIds] of conflictGroups) {
      const activeInGroup = groupIds.filter(id => (statePosteriors.get(id) || 0) > 0.3);
      if (activeInGroup.length < 2) continue;

      // Softmax competition within conflict group
      const groupLO = activeInGroup.map(id => stateLogOdds.get(id) || 0);
      const maxLO = Math.max(...groupLO);
      const expScores = groupLO.map(lo => Math.exp(lo - maxLO));
      const sumExp = expScores.reduce((s, e) => s + e, 0);

      for (let i = 0; i < activeInGroup.length; i++) {
        const competitiveShare = expScores[i] / sumExp;
        const original = statePosteriors.get(activeInGroup[i])!;
        // Blend: 60% original + 40% competitive (stronger competition than V2)
        const blended = 0.6 * original + 0.4 * competitiveShare;
        statePosteriors.set(activeInGroup[i], blended);
        const newLO = Math.log(blended / (1 - blended + 1e-10));
        stateLogOdds.set(activeInGroup[i], Math.max(-LOG_ODDS_CLAMP, Math.min(LOG_ODDS_CLAMP, newLO)));
      }
    }

    const stateNameMap = new Map<string, string>();
    for (const s of v3States) stateNameMap.set(s.id, s.state_name);

    console.log("[V3_STATES]", JSON.stringify(v3States.map(s => ({
      state: s.state_name,
      prior: Number(s.prior_probability).toFixed(2),
      posterior: ((statePosteriors.get(s.id) || 0) * 100).toFixed(1) + "%",
      delta: ((statePosteriors.get(s.id) || 0) - Number(s.prior_probability)).toFixed(3),
    }))));

    // ═══════════════════════════════════════
    // V3 STEP 3: COMPETITIVE DIAGNOSIS SCORING
    // Contribution = (statePosterior - statePrior) × stateDiagLogLR
    // Anti-correlated: positive for supported dx, negative for competitors
    // ═══════════════════════════════════════
    const v3StateDiagLRs = v3StateDiagRes.data || [];
    const stateDiagMap = new Map<string, Map<string, { logLR: number; isPrimary: boolean }>>();
    for (const sd of v3StateDiagLRs) {
      if (!stateDiagMap.has(sd.diagnosis_id)) stateDiagMap.set(sd.diagnosis_id, new Map());
      stateDiagMap.get(sd.diagnosis_id)!.set(sd.state_id, {
        logLR: Number(sd.log_likelihood_ratio),
        isPrimary: sd.is_primary,
      });
    }

    // Build V1-style modifier maps
    const priorsMap = new Map<string, any>();
    for (const p of priorsRes.data || []) priorsMap.set(p.diagnosis_id, p);
    const symLikMap = new Map<string, Array<{ symptom_id: string; likelihood_value: number; specificity: number }>>();
    for (const sl of symptomLikRes.data || []) {
      if (!symLikMap.has(sl.diagnosis_id)) symLikMap.set(sl.diagnosis_id, []);
      symLikMap.get(sl.diagnosis_id)!.push({ symptom_id: sl.symptom_id, likelihood_value: sl.likelihood_value, specificity: sl.symptom_specificity ?? 0.5 });
    }
    const riskModMap = new Map<string, number[]>();
    for (const rm of riskModRes.data || []) { if (!riskModMap.has(rm.diagnosis_id)) riskModMap.set(rm.diagnosis_id, []); riskModMap.get(rm.diagnosis_id)!.push(rm.modifier_weight); }
    const historyMultiplierMap = new Map<string, number>();
    for (const hm of historyModRes.data || []) { const c = historyMultiplierMap.get(hm.diagnosis_id) || 1.0; historyMultiplierMap.set(hm.diagnosis_id, Math.max(c, hm.prior_multiplier * hm.confidence)); }
    const dangerousSet = new Set((dangerousRes.data || []).map((d: any) => d.diagnosis_id));
    const durationModMap = new Map<string, number>();
    for (const dm of durationModRes.data || []) durationModMap.set(dm.diagnosis_id, dm.modifier_weight);
    const onsetModMap = new Map<string, number>();
    for (const om of onsetModRes.data || []) onsetModMap.set(om.diagnosis_id, om.modifier_weight);
    const vitalModMap = new Map<string, number[]>();
    for (const vm of vitalModRes.data || []) {
      const vv = getVitalValue(vitals, vm.vital_parameter);
      if (vv === null) continue;
      const applies = vm.condition === "above" ? vv > vm.threshold_value : vv < vm.threshold_value;
      if (applies) { if (!vitalModMap.has(vm.diagnosis_id)) vitalModMap.set(vm.diagnosis_id, []); vitalModMap.get(vm.diagnosis_id)!.push(vm.modifier_weight); }
    }
    const clusterModMap = new Map<string, number>();
    for (const cm of clusterModRes.data || []) {
      const matchCount = (cm.required_symptoms as string[]).filter((rs: string) => normalizedSymptomNames.some((ns: string) => ns === rs || ns.includes(rs) || rs.includes(ns))).length;
      if (matchCount >= cm.min_match_count) { const c = clusterModMap.get(cm.diagnosis_id) || 1.0; clusterModMap.set(cm.diagnosis_id, Math.max(c, cm.modifier_weight)); }
    }

    const ageGroup = getAgeGroup(patient_age);
    const sexKey = (patient_sex || "").toLowerCase() === "female" ? "female" : "male";
    const regionKey = region || "south_asia";
    const PRIOR_WEIGHT = 0.3; // λ — weak prior influence
    const totalSymptoms = symptomIds.length;

    interface V3DiagResult {
      diagnosis_id: string;
      prior: number;
      symptom_score: number;
      v3_state_score: number;
      modifier_score: number;
      log_score: number;
      posterior_probability: number;
      supporting_evidence: string[];
      must_not_miss: boolean;
      state_activations: Array<{ state: string; delta: number; logLR: number; contribution: number }>;
      positive_state_count: number;
      negative_state_count: number;
    }

    const results: V3DiagResult[] = [];

    for (const diagId of validCandidateIds) {
      // Prior (weakly informative, λ-scaled)
      const priorData = priorsMap.get(diagId);
      let prior = priorData?.base_prevalence ?? 0.05;
      if (priorData) {
        const ageMod = resolveAgeModifier(priorData.age_modifier, ageGroup, patient_age);
        const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
        const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
        prior *= ageMod * sexMod * regMod;
      }
      const historyMult = historyMultiplierMap.get(diagId) || 1.0;
      const adjustedPrior = Math.min(prior * historyMult, 0.95);
      // λ-controlled prior: weak influence
      let logScore = PRIOR_WEIGHT * Math.log(Math.max(adjustedPrior, 1e-8));

      // Symptom log-likelihood (DB-driven)
      const symLiks = symLikMap.get(diagId) || [];
      let symptomScore = 0;
      if (symLiks.length > 0) {
        for (const sl of symLiks) {
          const lik = Math.max(0.01, Math.min(0.99, sl.likelihood_value));
          symptomScore += Math.max(0.1, sl.specificity) * Math.log(lik);
        }
        const coverageRatio = totalSymptoms > 0 ? symLiks.length / totalSymptoms : 0;
        symptomScore += Math.log(Math.max(Math.pow(coverageRatio, 1.5), 1e-4));
      } else if (totalSymptoms > 0) {
        symptomScore = Math.min(totalSymptoms, 3) * Math.log(0.15);
      }
      logScore += symptomScore;

      // Temporal modifiers
      const durMod = durationModMap.get(diagId) || 1.0;
      const onMod = onsetModMap.get(diagId) || 1.0;
      let modifierScore = 0;
      if (durMod !== 1.0) modifierScore += Math.log(durMod);
      if (onMod !== 1.0) modifierScore += Math.log(onMod);
      // Vital modifiers
      const vitalMods = vitalModMap.get(diagId) || [];
      if (vitalMods.length > 0) modifierScore += Math.log(Math.max(...vitalMods));
      // Cluster modifiers
      const clusterMod = clusterModMap.get(diagId) || 1.0;
      if (clusterMod > 1.0) modifierScore += Math.log(clusterMod);
      // Risk factors
      for (const w of (riskModMap.get(diagId) || [])) modifierScore += Math.log(Math.max(w, 1e-4));
      logScore += modifierScore;

      // ═══════════════════════════════════════
      // V3 CORE: DISCRIMINATIVE STATE CONTRIBUTION
      // Contribution = (statePosterior - statePrior) × logLR
      // Positive logLR → supports this diagnosis
      // Negative logLR → evidence AGAINST this diagnosis
      // ═══════════════════════════════════════
      let v3StateScore = 0;
      const stateActivations: V3DiagResult["state_activations"] = [];
      let positiveStateCount = 0;
      let negativeStateCount = 0;
      const diagStates = stateDiagMap.get(diagId);

      if (diagStates) {
        for (const [stateId, { logLR }] of diagStates) {
          const posterior = statePosteriors.get(stateId) || 0.1;
          const prior_s = statePriors.get(stateId) || 0.1;
          const delta = posterior - prior_s;
          // CORE V3 FORMULA: delta × logLR
          // When state is activated (delta > 0) and logLR > 0 → supports diagnosis
          // When state is activated (delta > 0) and logLR < 0 → suppresses diagnosis
          const contribution = delta * logLR;
          v3StateScore += contribution;

          if (logLR > 0) positiveStateCount++;
          else negativeStateCount++;

          stateActivations.push({
            state: stateNameMap.get(stateId) || "unknown",
            delta: parseFloat(delta.toFixed(4)),
            logLR,
            contribution: parseFloat(contribution.toFixed(4)),
          });
        }

        // COVERAGE PENALTY: penalize dx activated by too many positive states (diffuse signal)
        if (positiveStateCount > 5) {
          v3StateScore -= (positiveStateCount - 5) * 0.2;
        }
      }

      logScore += v3StateScore;

      const evidence: string[] = [];
      if (symLiks.length > 0) evidence.push(`${symLiks.length}/${totalSymptoms} symptoms`);
      const activeStates = stateActivations.filter(s => Math.abs(s.contribution) > 0.05);
      if (activeStates.length > 0) {
        evidence.push(`v3: ${activeStates.map(s => `${s.state}(${s.contribution > 0 ? '+' : ''}${s.contribution.toFixed(2)})`).join(', ')}`);
      }

      results.push({
        diagnosis_id: diagId,
        prior: adjustedPrior,
        symptom_score: symptomScore,
        v3_state_score: v3StateScore,
        modifier_score: modifierScore,
        log_score: logScore,
        posterior_probability: 0,
        supporting_evidence: evidence,
        must_not_miss: dangerousSet.has(diagId),
        state_activations: stateActivations,
        positive_state_count: positiveStateCount,
        negative_state_count: negativeStateCount,
      });
    }

    // ═══════════════════════════════════════
    // V3 STEP 4: COMPETITION LAYER
    // ═══════════════════════════════════════

    // 4a. Relative log-score centering (force competition)
    const meanLogScore = results.reduce((s, d) => s + d.log_score, 0) / (results.length || 1);
    for (const r of results) r.log_score -= meanLogScore;

    // 4b. Pairwise competition amplification
    results.sort((a, b) => b.log_score - a.log_score);
    if (results.length >= 2) {
      const gap = results[0].log_score - results[1].log_score;
      if (gap > 0.01 && gap < 0.5) {
        // Amplify small gaps proportionally
        results[0].log_score += gap * 0.2;
        results[1].log_score -= gap * 0.1;
      }
    }

    // 4c. Entropy penalty: penalize flat distributions
    const logScoreRange = results.length >= 2
      ? results[0].log_score - results[results.length - 1].log_score
      : 1;
    if (logScoreRange < 1.0 && results.length > 3) {
      // Distribution too flat — boost top candidates with state support
      for (const r of results) {
        if (r.v3_state_score > 0.5) r.log_score += 0.3;
        else if (r.v3_state_score < -0.5) r.log_score -= 0.3;
      }
    }

    // ═══════════════════════════════════════
    // V3 STEP 5: SOFTMAX NORMALIZATION
    // ═══════════════════════════════════════
    const TEMPERATURE = 0.5; // Sharper than V2 for clinical clarity
    const scaledScores = results.map(d => d.log_score / TEMPERATURE);
    const maxLog = Math.max(...scaledScores);
    const expScores = scaledScores.map(s => Math.exp(s - maxLog));
    const sumExp = expScores.reduce((s, e) => s + e, 0) || 1;
    for (let i = 0; i < results.length; i++) {
      results[i].posterior_probability = parseFloat((expScores[i] / sumExp).toFixed(4));
    }

    // Must-not-miss floor
    for (const d of results) {
      if (d.must_not_miss && d.posterior_probability < 0.03) d.posterior_probability = 0.03;
    }
    const newTotal = results.reduce((s, d) => s + d.posterior_probability, 0) || 1;
    for (const d of results) d.posterior_probability = parseFloat((d.posterior_probability / newTotal).toFixed(4));

    results.sort((a, b) => b.posterior_probability - a.posterior_probability);

    // Separation validation
    const separationChecks: Array<{ pair: string; delta_logP: number; sufficient: boolean }> = [];
    if (results.length >= 2) {
      for (let i = 0; i < Math.min(results.length - 1, 3); i++) {
        const delta = results[i].log_score - results[i + 1].log_score;
        separationChecks.push({ pair: `#${i + 1} vs #${i + 2}`, delta_logP: parseFloat(delta.toFixed(3)), sufficient: Math.abs(delta) > 0.3 });
      }
    }

    console.log("[V3_RESULTS]", JSON.stringify(results.slice(0, 8).map(d => ({
      dx: diagNameMap.get(d.diagnosis_id) || d.diagnosis_id.substring(0, 8),
      posterior: (d.posterior_probability * 100).toFixed(1) + "%",
      v3_state: d.v3_state_score.toFixed(3),
      symptom: d.symptom_score.toFixed(2),
      prior: d.prior.toFixed(4),
      pos_states: d.positive_state_count,
      neg_states: d.negative_state_count,
    }))));

    return new Response(JSON.stringify({
      diagnoses: results.map(d => ({
        diagnosis_id: d.diagnosis_id,
        diagnosis_name: diagNameMap.get(d.diagnosis_id) || d.diagnosis_id,
        posterior_probability: d.posterior_probability,
        prior: parseFloat(d.prior.toFixed(4)),
        symptom_score: parseFloat(d.symptom_score.toFixed(4)),
        v3_state_score: parseFloat(d.v3_state_score.toFixed(4)),
        modifier_score: parseFloat(d.modifier_score.toFixed(4)),
        log_score: parseFloat(d.log_score.toFixed(4)),
        supporting_evidence: d.supporting_evidence,
        must_not_miss: d.must_not_miss,
        state_activations: d.state_activations,
        positive_state_count: d.positive_state_count,
        negative_state_count: d.negative_state_count,
      })),
      latent_state_posteriors: v3States.map(s => ({
        state: s.state_name,
        prior: Number(s.prior_probability),
        posterior: parseFloat((statePosteriors.get(s.id) || 0).toFixed(4)),
        delta: parseFloat(((statePosteriors.get(s.id) || 0) - Number(s.prior_probability)).toFixed(4)),
        conflict_group: s.conflict_group,
      })),
      total_candidates: validCandidateIds.length,
      symptoms_resolved: symptomIds.length,
      data_completeness: parseFloat(completeness.toFixed(3)),
      separation_validation: separationChecks,
      architecture: "v3_discriminative_competitive",
      state_count: v3States.length,
      prior_weight_lambda: PRIOR_WEIGHT,
      temperature: TEMPERATURE,
      execution_ms: Date.now() - start,
      source: "probabilistic_engine_v3_discriminative",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[V3] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════

function continuousLogLR(value: number | null, params: { x0: number; k: number; L: number; invert?: boolean; baseline?: number }): number {
  if (value === null || isNaN(value)) return 0;
  const { x0, k, L, invert = false, baseline = 0 } = params;
  const raw = L * (2 / (1 + Math.exp(-k * (value - x0))) - 1);
  return invert ? -(raw - baseline) : (raw - baseline);
}

function getAgeGroup(age: number | null): string {
  if (age === null) return "adult";
  if (age < 5) return "child"; if (age < 18) return "pediatric";
  if (age < 35) return "young_adult"; if (age < 55) return "adult";
  if (age < 65) return "middle_aged"; return "elderly";
}

function resolveAgeModifier(ageModifier: Record<string, number> | null, ageGroup: string, _age: number | null): number {
  if (!ageModifier || Object.keys(ageModifier).length === 0) return 1.0;
  if (ageModifier[ageGroup] !== undefined) return ageModifier[ageGroup];
  const fallbacks: Record<string, string[]> = { child: ["pediatric", "young_adult", "adult"], pediatric: ["child", "young_adult", "adult"], young_adult: ["adult", "middle_aged"], adult: ["middle_aged", "young_adult"], middle_aged: ["adult", "elderly"], elderly: ["middle_aged", "adult"] };
  for (const fb of fallbacks[ageGroup] || []) { if (ageModifier[fb] !== undefined) return ageModifier[fb]; }
  return 1.0;
}

function classifyDuration(duration: string | null): string | null {
  if (!duration) return null;
  const d = duration.toLowerCase().trim();
  if (["acute", "subacute", "chronic"].includes(d)) return d;
  if (d.includes("sudden") || d.includes("minutes") || d.includes("hour") || d.includes("today") || d.includes("yesterday")) return "acute";
  if (d.includes("weeks") || d.includes("fortnight")) return "subacute";
  if (d.includes("months") || d.includes("years") || d.includes("chronic")) return "chronic";
  const dayMatch = d.match(/(\d+)\s*d(ay)?s?/);
  if (dayMatch) { const days = parseInt(dayMatch[1]); return days <= 7 ? "acute" : days <= 30 ? "subacute" : "chronic"; }
  return null;
}

function classifyOnset(onset: string | null): string | null {
  if (!onset) return null;
  const o = onset.toLowerCase().trim();
  if (["sudden", "gradual", "progressive", "intermittent", "episodic"].includes(o)) return o;
  if (o.includes("sudden") || o.includes("abrupt")) return "sudden";
  if (o.includes("gradual") || o.includes("slowly")) return "gradual";
  if (o.includes("progressive") || o.includes("worsening")) return "progressive";
  if (o.includes("comes and goes") || o.includes("intermittent")) return "intermittent";
  return null;
}

function getVitalValue(vitals: Record<string, any>, parameter: string): number | null {
  const val = vitals[parameter];
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  if (parameter === "temperature") return num > 50 ? (num - 32) * 5 / 9 : num;
  return num;
}
