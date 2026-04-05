import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Probabilistic Diagnostic Engine v2 — Latent State Architecture
 *
 * Pure probabilistic. No diagnosis-specific hardcoding.
 * Evidence → Latent States → Diagnoses (via log-odds arithmetic).
 *
 * Architecture:
 *   1. Extract clinical features from vitals/symptoms
 *   2. Compute latent state posteriors: P(state | features)
 *   3. Compute diagnosis posteriors: P(dx | states, prior)
 *   4. All weights from DB (feature_state_likelihoods, diagnosis_state_likelihoods)
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

    // Auth
    const token = authHeader.replace("Bearer ", "").trim();
    let isServiceRole = false;
    try {
      const payloadB64 = token.split(".")[1];
      if (payloadB64) {
        const payload = JSON.parse(atob(payloadB64));
        isServiceRole = payload.role === "service_role";
      }
    } catch (_) { /* not valid JWT */ }

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
      duration = null,
      onset_pattern = null,
    } = body;

    // Filter to valid UUIDs
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validCandidateIds = candidate_diagnosis_ids.filter((id: string) => UUID_RE.test(id));

    if (validCandidateIds.length === 0) {
      return new Response(JSON.stringify({
        diagnoses: [], execution_ms: Date.now() - start,
        source: "probabilistic_engine_v2_latent_state",
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

    const normalizedHistory = medical_history.map((h: string) => h.toLowerCase().trim());
    const normalizedRiskFactors = risk_factors.map((r: string) => r.toLowerCase().trim());
    const durationCategory = classifyDuration(duration);
    const onsetCategory = classifyOnset(onset_pattern);

    // ════════════════════════════════════════════
    // PARALLEL FETCH — DB-driven weights + priors
    // ════════════════════════════════════════════
    const [
      latentStatesRes, featureStateRes, diagStateRes,
      priorsRes, symptomLikRes, physioLikRes, riskModRes, historyModRes,
      dangerousRes, durationModRes, onsetModRes, vitalModRes, clusterModRes,
    ] = await Promise.all([
      supabase.from("latent_clinical_states").select("id, state_name"),
      supabase.from("feature_state_likelihoods").select("latent_state_id, feature_name, log_likelihood_ratio"),
      supabase.from("diagnosis_state_likelihoods")
        .select("diagnosis_id, latent_state_id, log_likelihood_ratio")
        .in("diagnosis_id", validCandidateIds),
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
        .select("diagnosis_id, must_not_miss")
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
    // STEP 1: EXTRACT CLINICAL FEATURES
    // ════════════════════════════════════════════
    const tempC = getVitalValue(vitals, "temperature");
    const hr = getVitalValue(vitals, "heartRate") ?? getVitalValue(vitals, "heart_rate") ?? getVitalValue(vitals, "pulse");
    const rr = getVitalValue(vitals, "respiratoryRate") ?? getVitalValue(vitals, "respiratory_rate");
    const spo2Val = getVitalValue(vitals, "spo2") ?? getVitalValue(vitals, "SpO2");
    let sbpVal: number | null = null;
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

    const allSymptomText = [
      ...normalizedSymptomNames.map(s => s.toLowerCase()),
      ...symptoms.map((s: string) => s.toLowerCase().trim()),
    ];

    // ════════════════════════════════════════════
    // FEATURE EXTRACTION — CONTINUOUS + BINARY
    // Vitals/labs → continuous logLR via sigmoid
    // Symptoms → binary presence flags
    // ════════════════════════════════════════════
    const labResults = body.lab_results || body.labs || {};
    const lactateValue = labResults.lactate ?? vitals?.lactate ?? null;
    const crpValue = labResults.crp ?? vitals?.crp ?? null;
    const wbcValue = labResults.wbc ?? vitals?.wbc ?? null;
    const procalcitoninValue = labResults.procalcitonin ?? vitals?.procalcitonin ?? null;
    const troponinValue = labResults.troponin ?? vitals?.troponin ?? null;

    console.log("[AUDIT_EDGE_INPUT]", {
      lab_results: labResults,
      lactateValue, crpValue, wbcValue, procalcitoninValue, troponinValue,
      vitals_parsed: { tempC, hr, rr, spo2: spo2Val, sbp: sbpVal },
    });

    // ── Continuous logLR functions ──
    // sigmoid(x; L, k, x0) = L / (1 + exp(-k*(x - x0)))
    // Maps continuous value → logLR ∈ [-L, +L]
    // x0 = inflection point (clinical threshold)
    // k = steepness (higher = sharper transition)
    // L = max magnitude (bounds the logLR)
    function continuousLogLR(value: number | null, params: {
      x0: number; k: number; L: number; invert?: boolean; baseline?: number;
    }): number {
      if (value === null || isNaN(value)) return 0; // missing → no evidence
      const { x0, k, L, invert = false, baseline = 0 } = params;
      const raw = L * (2 / (1 + Math.exp(-k * (value - x0))) - 1); // centered sigmoid: [-L, +L]
      return invert ? -(raw - baseline) : (raw - baseline);
    }

    // ── Continuous feature scores (logLR values, not booleans) ──
    // Each maps a raw measurement to a logLR that smoothly increases/decreases
    // These replace the binary thresholds entirely
    const continuousFeatures: Record<string, number> = {};

    // Temperature: x0=38°C, fever grows smoothly, hypothermia also signals
    if (tempC !== null) {
      continuousFeatures["fever"] = continuousLogLR(tempC, { x0: 38.0, k: 1.5, L: 2.0 });
      continuousFeatures["no_fever"] = -continuousFeatures["fever"];
    }

    // Heart rate: x0=100 bpm, tachycardia grows
    if (hr !== null) {
      continuousFeatures["tachycardia"] = continuousLogLR(hr, { x0: 100, k: 0.08, L: 1.8 });
      continuousFeatures["no_tachycardia"] = -continuousFeatures["tachycardia"];
    }

    // Blood pressure (systolic): INVERTED — lower BP = higher logLR for hypotension
    if (sbpVal !== null) {
      continuousFeatures["hypotension"] = continuousLogLR(sbpVal, { x0: 90, k: 0.1, L: 2.5, invert: true });
      continuousFeatures["no_hypotension"] = -continuousFeatures["hypotension"];
    }

    // Respiratory rate: x0=22
    if (rr !== null) {
      continuousFeatures["tachypnea"] = continuousLogLR(rr, { x0: 22, k: 0.15, L: 1.5 });
    }

    // SpO2: INVERTED — lower SpO2 = higher logLR for hypoxia
    if (spo2Val !== null) {
      continuousFeatures["hypoxia"] = continuousLogLR(spo2Val, { x0: 94, k: 0.3, L: 2.0, invert: true });
      continuousFeatures["no_hypoxia"] = -continuousFeatures["hypoxia"];
    }

    // Lactate: x0=2.0 mmol/L, strong signal, steep
    if (lactateValue !== null) {
      const lv = Number(lactateValue);
      if (!isNaN(lv)) {
        continuousFeatures["lactate_high"] = continuousLogLR(lv, { x0: 2.0, k: 0.8, L: 3.0 });
      }
    }

    // CRP: x0=10 mg/L
    if (crpValue !== null) {
      const cv = Number(crpValue);
      if (!isNaN(cv)) {
        continuousFeatures["crp_high"] = continuousLogLR(cv, { x0: 10, k: 0.15, L: 2.0 });
      }
    }

    // WBC: two-sided — both high and low are abnormal
    if (wbcValue !== null) {
      const wv = Number(wbcValue);
      if (!isNaN(wv)) {
        const highLR = continuousLogLR(wv, { x0: 12000, k: 0.0005, L: 1.8 });
        const lowLR = continuousLogLR(wv, { x0: 4000, k: 0.001, L: 1.5, invert: true });
        continuousFeatures["wbc_abnormal"] = Math.max(highLR, lowLR, 0); // take whichever is abnormal
      }
    }

    // Procalcitonin: x0=0.5 ng/mL
    if (procalcitoninValue !== null) {
      const pv = Number(procalcitoninValue);
      if (!isNaN(pv)) {
        continuousFeatures["procalcitonin_high"] = continuousLogLR(pv, { x0: 0.5, k: 3.0, L: 2.5 });
      }
    }

    // Troponin: x0=0.04 ng/mL
    if (troponinValue !== null) {
      const tv = Number(troponinValue);
      if (!isNaN(tv)) {
        continuousFeatures["troponin_high"] = continuousLogLR(tv, { x0: 0.04, k: 50, L: 2.5 });
      }
    }

    // ── Binary symptom features (presence/absence — these remain boolean) ──
    const symptomFeatures: Record<string, boolean> = {
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
      diabetes_history: normalizedHistory.some((h: string) => h.includes("diabetes") || h.includes("diabetic")),
      hypertension_history: normalizedHistory.some((h: string) => h.includes("hypertension") || h.includes("high blood pressure")),
    };

    // ── Negative evidence for symptoms ──
    const negativeSymptomFeatures: Record<string, boolean> = {
      no_chest_pain: !symptomFeatures.chest_pain,
      no_dyspnea: !symptomFeatures.dyspnea,
      no_cough: !symptomFeatures.cough,
      no_altered_mental_status: !symptomFeatures.altered_mental_status,
      no_headache: !symptomFeatures.headache,
      no_sweating: !symptomFeatures.sweating,
      no_joint_pain: !symptomFeatures.joint_pain,
    };

    // ── Unified feature representation ──
    // continuous features: number (logLR value)
    // binary features: converted to logLR (present=DB lookup, absent=0)
    // This is the SINGLE representation consumed by latent state computation
    const allBinaryFeatures: Record<string, boolean> = { ...symptomFeatures, ...negativeSymptomFeatures };
    const activeBinaryNames = Object.entries(allBinaryFeatures).filter(([_, v]) => v).map(([k]) => k);
    const activeContinuousNames = Object.entries(continuousFeatures)
      .filter(([_, v]) => Math.abs(v) > 0.05)
      .map(([k, v]) => `${k}(${v > 0 ? '+' : ''}${v.toFixed(2)})`);

    console.log("[ProbEngineV2] Continuous features:", JSON.stringify(continuousFeatures));
    console.log("[ProbEngineV2] Binary features:", JSON.stringify(activeBinaryNames));
    console.log("[ProbEngineV2] Active features (unified):", JSON.stringify([...activeBinaryNames, ...activeContinuousNames]));

    // ════════════════════════════════════════════
    // STEP 2: COMPUTE LATENT STATE POSTERIORS
    // Evidence → Latent States via DB-driven log-LRs
    // With bounded calibration: clamp posteriors to [0.01, 0.99]
    // ════════════════════════════════════════════
    const latentStates = latentStatesRes.data || [];
    const featureStateLRs = featureStateRes.data || [];

    // Build feature→state log-LR lookup
    const featureStateMap = new Map<string, Map<string, number>>(); // stateId → featureName → logLR
    for (const fsl of featureStateLRs) {
      if (!featureStateMap.has(fsl.latent_state_id)) {
        featureStateMap.set(fsl.latent_state_id, new Map());
      }
      featureStateMap.get(fsl.latent_state_id)!.set(fsl.feature_name, fsl.log_likelihood_ratio);
    }

    // Compute latent state log-odds from uninformative prior (0.5 → logOdds = 0)
    const latentStatePosteriors = new Map<string, number>(); // stateId → posterior prob
    const latentStateLogOdds = new Map<string, number>();
    const LOG_ODDS_CLAMP = 3.5; // tighter clamp → posterior bounded to [0.03, 0.97]

    // Per-state temperature scaling — higher T = softer (less confident)
    // Clinical rationale: infection & inflammation are easy to over-activate;
    // neurological & cardiac require stronger evidence
    const PER_STATE_TEMPERATURE: Record<string, number> = {
      "infection": 1.4,
      "perfusion_deficit": 1.2,
      "inflammation": 1.5,
      "cardiac_compromise": 1.1,
      "respiratory_failure": 1.2,
      "neurological_compromise": 1.1,
      "systemic_infection_shock": 1.0, // Composite discriminative state — keep sharp
    };
    const DEFAULT_STATE_TEMPERATURE = 1.3;

    // Mutual exclusivity groups for state competition
    // States within a group compete: their combined posterior is softmax-normalized
    const STATE_COMPETITION_GROUPS = [
      ["infection", "cardiac_compromise", "metabolic_derangement"],
      ["respiratory_failure", "cardiac_compromise"],
    ];

    const stateNameToId = new Map<string, string>();
    const stateIdToName = new Map<string, string>();
    for (const s of latentStates) {
      stateNameToId.set(s.state_name.toLowerCase().replace(/\s+/g, "_"), s.id);
      stateIdToName.set(s.id, s.state_name.toLowerCase().replace(/\s+/g, "_"));
    }

    // Phase 1: Compute raw log-odds with diminishing returns
    // Now handles BOTH continuous (vitals/labs) and binary (symptoms) features
    for (const state of latentStates) {
      let logOdds = 0;
      const stateFeatures = featureStateMap.get(state.id);

      if (stateFeatures) {
        // Collect contributions from all active features
        const contributions: number[] = [];

        for (const [featureName, dbLogLR] of stateFeatures) {
          // CONTINUOUS features: multiply DB logLR direction by continuous magnitude
          if (featureName in continuousFeatures) {
            const continuousLR = continuousFeatures[featureName];
            if (Math.abs(continuousLR) > 0.01) {
              // Scale: use continuous value magnitude, capped by DB logLR magnitude
              // When continuousLR is near max sigmoid output (~L), use full DB weight
              // When near 0 (threshold region), use proportional weight
              // This preserves DB-driven state mapping while adding continuous gradation
              const maxMagnitude = Math.abs(dbLogLR);
              const normalizedMagnitude = Math.min(Math.abs(continuousLR) / 3.0, 1.0); // 3.0 = max sigmoid L
              const effectiveLR = Math.sign(dbLogLR) * maxMagnitude * normalizedMagnitude;
              contributions.push(effectiveLR);
            }
            continue; // don't also check binary
          }

          // BINARY features: use DB logLR directly when feature is active
          if (allBinaryFeatures[featureName]) {
            contributions.push(dbLogLR);
          }
        }

        // Sort by absolute value descending — strongest evidence first
        contributions.sort((a, b) => Math.abs(b) - Math.abs(a));

        // DIMINISHING RETURNS: 1st=100%, 2nd=71%, 3rd=58%, 4th=50%...
        for (let i = 0; i < contributions.length; i++) {
          const diminishingFactor = 1 / Math.sqrt(1 + i);
          logOdds += contributions[i] * diminishingFactor;
        }
      }

      // Per-state temperature scaling
      const stateName = stateIdToName.get(state.id) || "";
      const stateTemp = PER_STATE_TEMPERATURE[stateName] || DEFAULT_STATE_TEMPERATURE;
      logOdds = logOdds / stateTemp;

      // Tighter clamp
      logOdds = Math.max(-LOG_ODDS_CLAMP, Math.min(LOG_ODDS_CLAMP, logOdds));
      latentStateLogOdds.set(state.id, logOdds);
      const posterior = 1 / (1 + Math.exp(-logOdds));
      latentStatePosteriors.set(state.id, posterior);
    }

    // Phase 2: State competition — normalize mutually exclusive groups
    // For states in a competition group, apply softmax re-normalization
    // so they can't all be high simultaneously
    for (const group of STATE_COMPETITION_GROUPS) {
      const groupIds = group
        .map(name => stateNameToId.get(name))
        .filter(Boolean) as string[];
      if (groupIds.length < 2) continue;

      // Only apply competition if multiple states are active (>0.5)
      const activeInGroup = groupIds.filter(id => (latentStatePosteriors.get(id) || 0.5) > 0.55);
      if (activeInGroup.length < 2) continue;

      // Softmax competition: redistribute posteriors within group
      const groupLogOdds = activeInGroup.map(id => latentStateLogOdds.get(id) || 0);
      const maxLO = Math.max(...groupLogOdds);
      const expScores = groupLogOdds.map(lo => Math.exp(lo - maxLO));
      const sumExp = expScores.reduce((s, e) => s + e, 0);

      for (let i = 0; i < activeInGroup.length; i++) {
        // Blend: 70% original posterior + 30% competitive share
        const competitiveShare = expScores[i] / sumExp;
        const originalPosterior = latentStatePosteriors.get(activeInGroup[i])!;
        const blended = 0.7 * originalPosterior + 0.3 * competitiveShare;
        latentStatePosteriors.set(activeInGroup[i], blended);
        // Update log-odds for consistency
        const newLogOdds = Math.log(blended / (1 - blended + 1e-10));
        latentStateLogOdds.set(activeInGroup[i], Math.max(-LOG_ODDS_CLAMP, Math.min(LOG_ODDS_CLAMP, newLogOdds)));
      }
    }

    console.log("[ProbEngineV2] Latent state posteriors:", JSON.stringify(
      latentStates.map(s => ({
        state: s.state_name,
        posterior: (latentStatePosteriors.get(s.id)! * 100).toFixed(1) + "%",
        logOdds: latentStateLogOdds.get(s.id)!.toFixed(2),
      }))
    ));

    // ════════════════════════════════════════════
    // STEP 3: BUILD LOOKUP MAPS (same as V1)
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

    const durationModMap = new Map<string, number>();
    for (const dm of durationModRes.data || []) durationModMap.set(dm.diagnosis_id, dm.modifier_weight);

    const onsetModMap = new Map<string, number>();
    for (const om of onsetModRes.data || []) onsetModMap.set(om.diagnosis_id, om.modifier_weight);

    const vitalModMap = new Map<string, number[]>();
    for (const vm of vitalModRes.data || []) {
      const vitalValue = getVitalValue(vitals, vm.vital_parameter);
      if (vitalValue === null) continue;
      const applies = vm.condition === "above" ? vitalValue > vm.threshold_value : vitalValue < vm.threshold_value;
      if (applies) {
        if (!vitalModMap.has(vm.diagnosis_id)) vitalModMap.set(vm.diagnosis_id, []);
        vitalModMap.get(vm.diagnosis_id)!.push(vm.modifier_weight);
      }
    }

    const clusterModMap = new Map<string, number>();
    for (const cm of clusterModRes.data || []) {
      const matchCount = (cm.required_symptoms as string[]).filter((rs: string) =>
        normalizedSymptomNames.some((ns: string) => ns === rs || ns.includes(rs) || rs.includes(ns))
      ).length;
      if (matchCount >= cm.min_match_count) {
        const current = clusterModMap.get(cm.diagnosis_id) || 1.0;
        clusterModMap.set(cm.diagnosis_id, Math.max(current, cm.modifier_weight));
      }
    }

    // Diagnosis → latent state log-LR map
    const diagStateMap = new Map<string, Map<string, number>>(); // diagId → stateId → logLR
    for (const ds of diagStateRes.data || []) {
      if (!diagStateMap.has(ds.diagnosis_id)) diagStateMap.set(ds.diagnosis_id, new Map());
      diagStateMap.get(ds.diagnosis_id)!.set(ds.latent_state_id, ds.log_likelihood_ratio);
    }

    // ════════════════════════════════════════════
    // STEP 4: COMPUTE DIAGNOSIS POSTERIORS
    // P(dx) = prior × P(symptoms|dx) × P(dx|latent_states) × modifiers
    // All in log-space
    // ════════════════════════════════════════════
    const ageGroup = getAgeGroup(patient_age);
    const sexKey = (patient_sex || "").toLowerCase() === "female" ? "female" : "male";
    const regionKey = region || "south_asia";
    const DEFAULT_PRIOR = 0.05;
    const totalSymptoms = symptomIds.length;
    const hasAnySymLikData = validCandidateIds.some((id: string) => (symLikMap.get(id) || []).length > 0);

    interface DiagResult {
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
      latent_state_contribution: number;
      log_score: number;
      posterior_probability: number;
      supporting_evidence: string[];
      must_not_miss: boolean;
      latent_state_activations: Array<{ state: string; posterior: number; contribution: number }>;
    }

    const results: DiagResult[] = [];

    for (const diagId of validCandidateIds) {
      // ── 1. PRIOR ──
      const priorData = priorsMap.get(diagId);
      let prior = priorData?.base_prevalence ?? DEFAULT_PRIOR;
      if (priorData) {
        const ageMod = resolveAgeModifier(priorData.age_modifier, ageGroup, patient_age);
        const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
        const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
        prior *= ageMod * sexMod * regMod;
      }

      // ── 2. HISTORY ──
      const historyMult = historyMultiplierMap.get(diagId) || 1.0;
      const adjustedPrior = Math.min(prior * historyMult, 0.95);
      let logScore = Math.log(Math.max(adjustedPrior, 1e-8));

      // ── 3. SYMPTOM LOG-LIKELIHOOD (DB-driven, same as V1) ──
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
        logScore += hasAnySymLikData ? Math.min(totalSymptoms, 3) * Math.log(0.15) : Math.log(0.3);
      }

      // ── 4. TEMPORAL ──
      const durMod = durationModMap.get(diagId) || 1.0;
      const onMod = onsetModMap.get(diagId) || 1.0;
      if (durMod !== 1.0) logScore += Math.log(durMod);
      if (onMod !== 1.0) logScore += Math.log(onMod);

      // ── 5. VITAL SIGN MODIFIERS (DB-driven) ──
      const vitalMods = vitalModMap.get(diagId) || [];
      let vitalModifier = 1.0;
      if (vitalMods.length > 0) {
        vitalModifier = Math.max(...vitalMods);
        logScore += Math.log(vitalModifier);
      }

      // ── 6. CLUSTER ──
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

      // ── 8. RISK FACTORS ──
      const riskMods = riskModMap.get(diagId) || [];
      let riskModifier = 1.0;
      for (const w of riskMods) {
        riskModifier *= w;
        logScore += Math.log(Math.max(w, 1e-4));
      }

      // ════════════════════════════════════════════
      // ── 9. LATENT STATE CONTRIBUTION ──
      // CORRECTED FORMULA: logP(dx) += Σ[ P(state|evidence) × log P(state|dx) ]
      //
      // This is the proper probabilistic update:
      // - P(state|evidence) = latent state posterior from Step 2
      // - log P(state|dx) = stored in diagnosis_state_likelihoods (DB-driven)
      // - When state is active AND diagnosis expects it → strong positive
      // - When state is active AND diagnosis doesn't expect it → negative
      // - Fully generalizable: no diagnosis-specific code
      // ════════════════════════════════════════════
      let latentStateContribution = 0;
      const stateActivations: DiagResult["latent_state_activations"] = [];
      const diagStates = diagStateMap.get(diagId);

      if (diagStates) {
        for (const [stateId, diagLogLR] of diagStates) {
          const statePosterior = latentStatePosteriors.get(stateId) || 0.5;
          // P(state) × log P(state|dx)
          // When state is strongly present (posterior ~1.0), full log-LR applies
          // When state is absent (posterior ~0.0), contribution approaches 0
          // Negative diagLogLR penalizes diagnosis when state IS active
          const contribution = statePosterior * diagLogLR;
          latentStateContribution += contribution;

          const stateName = latentStates.find(s => s.id === stateId)?.state_name || "unknown";
          stateActivations.push({
            state: stateName,
            posterior: statePosterior,
            contribution,
          });
        }
        logScore += latentStateContribution;
      } else {
        // Diagnoses without latent state mappings get no latent contribution
        // This ensures the system gracefully handles unmapped diagnoses
        // (they rely solely on symptom/prior/modifier evidence)
      }

      // Evidence trace
      const evidence: string[] = [];
      if (symLiks.length > 0) evidence.push(`${symLiks.length}/${totalSymptoms} symptoms (${(coverageRatio * 100).toFixed(0)}%)`);
      if (physLiks.length > 0) evidence.push(`${physLiks.length} physiology`);
      if (riskMods.length > 0) evidence.push(`${riskMods.length} risk factor(s)`);
      if (historyMult > 1.0) evidence.push(`history ×${historyMult.toFixed(1)}`);
      if (durMod !== 1.0) evidence.push(`duration(${durationCategory}) ×${durMod.toFixed(1)}`);
      if (onMod !== 1.0) evidence.push(`onset(${onsetCategory}) ×${onMod.toFixed(1)}`);
      if (vitalMods.length > 0) evidence.push(`vitals ×${vitalModifier.toFixed(1)}`);
      if (clusterMod > 1.0) evidence.push(`cluster ×${clusterMod.toFixed(1)}`);
      if (latentStateContribution !== 0) {
        const activeStates = stateActivations.filter(s => Math.abs(s.contribution) > 0.1);
        evidence.push(`latent states: ${activeStates.map(s => `${s.state}(${s.contribution > 0 ? '+' : ''}${s.contribution.toFixed(1)})`).join(', ')}`);
      }

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
        latent_state_contribution: latentStateContribution,
        log_score: logScore,
        posterior_probability: 0,
        supporting_evidence: evidence,
        must_not_miss: dangerousSet.has(diagId),
        latent_state_activations: stateActivations,
      });
    }

    // ════════════════════════════════════════════
    // TEMPERATURE-SCALED SOFTMAX (Diagnosis Level)
    // T=0.7 sharpens distribution for clinical ranking clarity
    // ════════════════════════════════════════════
    const TEMPERATURE = 0.7;
    const scaledScores = results.map(d => d.log_score / TEMPERATURE);
    const maxLog = Math.max(...scaledScores);
    const expScores = scaledScores.map(s => Math.exp(s - maxLog));
    const sumExp = expScores.reduce((s, e) => s + e, 0) || 1;
    for (let i = 0; i < results.length; i++) {
      results[i].posterior_probability = parseFloat((expScores[i] / sumExp).toFixed(4));
    }

    // Must-not-miss floor
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

    // ════════════════════════════════════════════
    // CALIBRATION DIAGNOSTICS
    // ════════════════════════════════════════════
    const topPosterior = results[0]?.posterior_probability || 0;
    const top2Diff = results.length >= 2
      ? results[0].posterior_probability - results[1].posterior_probability
      : 1;
    const flatDistribution = results.length >= 5 &&
      (results[0].posterior_probability - results[4].posterior_probability) < 0.05;
    const overconfident = topPosterior > 0.95;
    const stateOverconfidence = Array.from(latentStatePosteriors.values()).filter(p => p > 0.97).length;
    const mappedDiagCount = results.filter(r => r.latent_state_activations.length > 0).length;

    // Calibration curve: bucket posteriors by decile and compute metrics
    const calibrationBuckets: Array<{ bucket: string; count: number; mean_posterior: number; max_posterior: number }> = [];
    const bucketRanges = [
      [0, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.5], [0.5, 0.7], [0.7, 0.9], [0.9, 1.01],
    ];
    for (const [lo, hi] of bucketRanges) {
      const inBucket = results.filter(r => r.posterior_probability >= lo && r.posterior_probability < hi);
      if (inBucket.length > 0) {
        calibrationBuckets.push({
          bucket: `${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`,
          count: inBucket.length,
          mean_posterior: parseFloat((inBucket.reduce((s, r) => s + r.posterior_probability, 0) / inBucket.length).toFixed(4)),
          max_posterior: parseFloat(Math.max(...inBucket.map(r => r.posterior_probability)).toFixed(4)),
        });
      }
    }

    // State activation summary for calibration
    const stateCalibration = latentStates.map(s => {
      const sName = stateIdToName.get(s.id) || s.state_name;
      const posterior = latentStatePosteriors.get(s.id) || 0.5;
      const logOdds = latentStateLogOdds.get(s.id) || 0;
      return {
        state: sName,
        posterior: parseFloat(posterior.toFixed(4)),
        log_odds: parseFloat(logOdds.toFixed(3)),
        temperature: PER_STATE_TEMPERATURE[sName] || DEFAULT_STATE_TEMPERATURE,
        overconfident: posterior > 0.97,
      };
    });

    const calibration = {
      top1_posterior: parseFloat(topPosterior.toFixed(4)),
      top2_gap: parseFloat(top2Diff.toFixed(4)),
      flat_distribution_warning: flatDistribution,
      overconfidence_warning: overconfident,
      state_overconfidence_count: stateOverconfidence,
      latent_mapped_diagnoses: mappedDiagCount,
      unmapped_diagnoses: results.length - mappedDiagCount,
      per_state_temperatures: PER_STATE_TEMPERATURE,
      diagnosis_temperature: TEMPERATURE,
      calibration_buckets: calibrationBuckets,
      state_calibration: stateCalibration,
      diminishing_returns_applied: true,
      state_competition_applied: true,
    };

    // ════════════════════════════════════════════
    // STATE ACTIVATION TRACE (Phase 7)
    // ════════════════════════════════════════════
    console.log("[STATE_ACTIVATION]", JSON.stringify(
      latentStates.map(s => ({
        state: stateIdToName.get(s.id) || s.state_name,
        posterior: parseFloat((latentStatePosteriors.get(s.id) || 0.5).toFixed(4)),
        log_odds: parseFloat((latentStateLogOdds.get(s.id) || 0).toFixed(3)),
      }))
    ));

    // ════════════════════════════════════════════
    // DX CONTRIBUTION TRACE (Phase 7)
    // ════════════════════════════════════════════
    console.log("[DX_CONTRIBUTION]", JSON.stringify(
      results.slice(0, 8).map(d => ({
        id: d.diagnosis_id,
        posterior: (d.posterior_probability * 100).toFixed(1) + "%",
        latent_contrib: d.latent_state_contribution.toFixed(3),
        state_breakdown: d.latent_state_activations
          .filter(s => Math.abs(s.contribution) > 0.05)
          .map(s => `${s.state}(${s.contribution > 0 ? '+' : ''}${s.contribution.toFixed(2)})`),
      }))
    ));

    // ════════════════════════════════════════════
    // SEPARATION VALIDATION (Phase 4)
    // Verify that high-signal features create non-trivial ΔlogP
    // ════════════════════════════════════════════
    const separationChecks: Array<{ pair: string; delta_logP: number; sufficient: boolean }> = [];
    if (results.length >= 2) {
      for (let i = 0; i < Math.min(results.length - 1, 3); i++) {
        const delta = results[i].log_score - results[i + 1].log_score;
        separationChecks.push({
          pair: `#${i + 1} vs #${i + 2}`,
          delta_logP: parseFloat(delta.toFixed(3)),
          sufficient: Math.abs(delta) > 0.3,
        });
      }
    }
    if (separationChecks.some(s => !s.sufficient)) {
      console.log("[SEPARATION_WARNING] Insufficient ΔlogP between top diagnoses:", JSON.stringify(separationChecks));
    }

    // Score trace
    console.log("[ProbEngineV2] Score trace:", JSON.stringify(
      results.slice(0, 8).map(d => ({
        id: d.diagnosis_id,
        prior: d.prior.toFixed(4),
        latent_contrib: d.latent_state_contribution.toFixed(2),
        log_score: d.log_score.toFixed(2),
        posterior: (d.posterior_probability * 100).toFixed(1) + "%",
        active_states: d.latent_state_activations
          .filter(s => Math.abs(s.contribution) > 0.1)
          .map(s => s.state).join(","),
      }))
    ));

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
        latent_state_contribution: parseFloat(d.latent_state_contribution.toFixed(4)),
        log_score: parseFloat(d.log_score.toFixed(4)),
        supporting_evidence: d.supporting_evidence,
        must_not_miss: d.must_not_miss,
        latent_state_activations: d.latent_state_activations.map(s => ({
          state: s.state,
          posterior: parseFloat(s.posterior.toFixed(4)),
          contribution: parseFloat(s.contribution.toFixed(4)),
        })),
      })),
      latent_state_posteriors: latentStates.map(s => ({
        state: s.state_name,
        posterior: parseFloat((latentStatePosteriors.get(s.id) || 0.5).toFixed(4)),
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
      clinical_features_detected: activeFeatureNames,
      separation_validation: separationChecks,
      calibration,
      execution_ms: Date.now() - start,
      source: "probabilistic_engine_v2_latent_state",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ProbEngineV2] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ════════════════════════════════════════════
// HELPER FUNCTIONS (shared with V1)
// ════════════════════════════════════════════

function getAgeGroup(age: number | null): string {
  if (age === null) return "adult";
  if (age < 5) return "child";
  if (age < 18) return "pediatric";
  if (age < 35) return "young_adult";
  if (age < 55) return "adult";
  if (age < 65) return "middle_aged";
  return "elderly";
}

function resolveAgeModifier(ageModifier: Record<string, number> | null, ageGroup: string, _age: number | null): number {
  if (!ageModifier || Object.keys(ageModifier).length === 0) return 1.0;
  if (ageModifier[ageGroup] !== undefined) return ageModifier[ageGroup];
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

function classifyDuration(duration: string | null): string | null {
  if (!duration) return null;
  const d = duration.toLowerCase().trim();
  if (["acute", "subacute", "chronic"].includes(d)) return d;
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

function getVitalValue(vitals: Record<string, any>, parameter: string): number | null {
  const val = vitals[parameter];
  if (val === null || val === undefined) return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  if (parameter === "temperature") {
    return num > 50 ? (num - 32) * 5 / 9 : num;
  }
  return num;
}
