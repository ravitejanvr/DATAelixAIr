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
      ddx_priors = {},       // DDX-computed probabilities keyed by diagnosis_id (0-1 scale)
    } = body;

    if (candidate_diagnosis_ids.length === 0) {
      return new Response(JSON.stringify({
        diagnoses: [],
        execution_ms: Date.now() - start,
        source: "bayesian_engine_v4",
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
        .in("diagnosis_id", candidate_diagnosis_ids),
      symptomIds.length > 0
        ? supabase.from("symptom_likelihoods")
            .select("diagnosis_id, symptom_id, likelihood_value, symptom_specificity")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("symptom_id", symptomIds)
        : Promise.resolve({ data: [] }),
      physiological_state_ids.length > 0
        ? supabase.from("physiology_likelihoods")
            .select("diagnosis_id, physiological_state_id, likelihood_value")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("physiological_state_id", physiological_state_ids)
        : Promise.resolve({ data: [] }),
      normalizedRiskFactors.length > 0
        ? supabase.from("risk_factor_modifiers")
            .select("diagnosis_id, risk_factor, modifier_weight")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("risk_factor", normalizedRiskFactors)
        : Promise.resolve({ data: [] }),
      normalizedHistory.length > 0
        ? supabase.from("medical_history_modifiers")
            .select("diagnosis_id, history_condition, prior_multiplier, confidence")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("history_condition", normalizedHistory)
        : Promise.resolve({ data: [] }),
      supabase.from("dangerous_diagnoses")
        .select("diagnosis_id, diagnosis_name, severity_level, emergency_protocol, must_not_miss")
        .eq("must_not_miss", true)
        .in("diagnosis_id", candidate_diagnosis_ids),
      durationCategory
        ? supabase.from("duration_modifiers")
            .select("diagnosis_id, duration_category, modifier_weight")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .eq("duration_category", durationCategory)
        : Promise.resolve({ data: [] }),
      onsetCategory
        ? supabase.from("onset_modifiers")
            .select("diagnosis_id, onset_pattern, modifier_weight")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .eq("onset_pattern", onsetCategory)
        : Promise.resolve({ data: [] }),
      supabase.from("vital_sign_modifiers")
        .select("diagnosis_id, vital_parameter, condition, threshold_value, modifier_weight")
        .in("diagnosis_id", candidate_diagnosis_ids),
      supabase.from("symptom_cluster_modifiers")
        .select("diagnosis_id, cluster_name, required_symptoms, min_match_count, modifier_weight")
        .in("diagnosis_id", candidate_diagnosis_ids),
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
      log_score: number;
      posterior_probability: number;
      supporting_evidence: string[];
      must_not_miss: boolean;
    }

    const results: BayesianDiagnosis[] = [];
    const DEFAULT_PRIOR = 0.05;

    const diagsWithSymLik = candidate_diagnosis_ids.filter((id: string) => (symLikMap.get(id) || []).length > 0).length;
    const hasAnySymLikData = diagsWithSymLik > 0;
    const totalSymptoms = symptomIds.length;

    for (const diagId of candidate_diagnosis_ids) {
      // ── 1. PRIOR: Use DDX-computed probability if available, else DB prior ──
      const ddxPrior = ddx_priors[diagId];
      const priorData = priorsMap.get(diagId);
      let prior: number;

      if (ddxPrior !== undefined && ddxPrior > 0) {
        // DDX-seeded prior: trust the Intelligence Core's multi-signal score
        prior = Math.max(ddxPrior, 1e-4);
        // Still apply demographic modifiers as refinement (dampened to avoid double-counting)
        if (priorData) {
          const ageMod = resolveAgeModifier(priorData.age_modifier, ageGroup, patient_age);
          const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
          const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
          // Dampened: sqrt of modifier to avoid over-adjusting an already-calibrated prior
          const demoAdj = Math.sqrt(ageMod * sexMod * regMod);
          prior *= demoAdj;
        }
      } else {
        // Fallback: DB-only prior
        prior = priorData?.base_prevalence ?? DEFAULT_PRIOR;
        if (priorData) {
          const ageMod = resolveAgeModifier(priorData.age_modifier, ageGroup, patient_age);
          const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
          const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
          prior *= ageMod * sexMod * regMod;
        }
      }

      // ── 2. HISTORY MULTIPLIER: Apply medical history to prior ──
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

      // ── 4. TEMPORAL MODIFIERS (duration + onset) ──
      const durMod = durationModMap.get(diagId) || 1.0;
      const onMod = onsetModMap.get(diagId) || 1.0;
      if (durMod !== 1.0) logScore += Math.log(durMod);
      if (onMod !== 1.0) logScore += Math.log(onMod);

      // ── 5. VITAL SIGN MODIFIERS (disease-specific from DB) ──
      const vitalMods = vitalModMap.get(diagId) || [];
      let vitalModifier = 1.0;
      if (vitalMods.length > 0) {
        // Use the strongest vital modifier to prevent over-stacking
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
        log_score: logScore,
        posterior_probability: 0,
        supporting_evidence: evidence,
        must_not_miss: dangerousSet.has(diagId),
      });
    }

    // ════════════════════════════════════════════
    // SOFTMAX NORMALIZATION
    // ════════════════════════════════════════════
    const maxLog = Math.max(...results.map(d => d.log_score));
    const expScores = results.map(d => Math.exp(d.log_score - maxLog));
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
        log_score: parseFloat(d.log_score.toFixed(4)),
        supporting_evidence: d.supporting_evidence,
        must_not_miss: d.must_not_miss,
      })),
      total_candidates: candidate_diagnosis_ids.length,
      symptoms_resolved: symptomIds.length,
      physiology_states_used: physiological_state_ids.length,
      risk_factors_applied: normalizedRiskFactors.length,
      history_modifiers_applied: historyModRes.data?.length || 0,
      duration_category: durationCategory,
      onset_pattern: onsetCategory,
      vitals_signals_applied: Array.from(vitalModMap.values()).flat().length,
      cluster_matches: Array.from(clusterModMap.entries()).filter(([, v]) => v > 1).length,
      execution_ms: executionMs,
      source: "bayesian_engine_v4_full_signals",
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
