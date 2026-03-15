import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Bayesian Diagnostic Probability Engine v3 — With History & Risk Factor Integration
 *
 * Computes log P(D|E) ∝ log P(D) × H(D) + Σ wᵢ·log P(Sᵢ|D) + coverage_bonus + Σ log P(Φⱼ|D) + Σ log R(k)
 *
 * Where:
 *   P(D) = disease prior (base_prevalence × age/sex/region modifiers)
 *   H(D) = medical history prior multiplier (from medical_history_modifiers)
 *   P(Sᵢ|D) = symptom likelihood from symptom_likelihoods table
 *   wᵢ = specificity weight = 1 / log₂(disease_count_i + 1)
 *   coverage_bonus = (matched/total)^1.5
 *   P(Φⱼ|D) = physiology likelihood
 *   R(k) = risk factor modifier weights
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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    } = body;

    if (candidate_diagnosis_ids.length === 0) {
      return new Response(JSON.stringify({
        diagnoses: [],
        execution_ms: Date.now() - start,
        source: "bayesian_engine_v3",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve symptom names to IDs
    let symptomIds: string[] = [];
    if (symptoms.length > 0) {
      const normalized = symptoms.map((s: string) => s.toLowerCase().trim());
      const { data: symRows } = await supabase
        .from("symptoms")
        .select("id, symptom_name")
        .in("symptom_name", normalized);
      
      const exactIds = new Set((symRows || []).map((s: any) => s.id));
      const exactNames = new Set((symRows || []).map((s: any) => s.symptom_name));
      const unmatched = normalized.filter((s: string) => !exactNames.has(s));
      
      if (unmatched.length > 0) {
        const fuzzyPromises = unmatched.map(s =>
          supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
        );
        const fuzzyResults = await Promise.all(fuzzyPromises);
        for (const res of fuzzyResults) {
          for (const s of res.data || []) {
            exactIds.add(s.id);
          }
        }
      }
      symptomIds = Array.from(exactIds);
    }

    // Normalize medical history for lookup
    const normalizedHistory = medical_history.map((h: string) => h.toLowerCase().trim());
    const normalizedRiskFactors = risk_factors.map((r: string) => r.toLowerCase().trim());
    // Risk factors and medical history are scored SEPARATELY to prevent double-counting
    const allRiskSignals = normalizedRiskFactors;

    // ════════════════════════════════════════════
    // PARALLEL FETCH
    // ════════════════════════════════════════════

    const [priorsRes, symptomLikRes, physioLikRes, riskModRes, historyModRes, dangerousRes] = await Promise.all([
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
      allRiskSignals.length > 0
        ? supabase.from("risk_factor_modifiers")
            .select("diagnosis_id, risk_factor, modifier_weight")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("risk_factor", allRiskSignals)
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
    ]);

    // ════════════════════════════════════════════
    // BUILD LOOKUP MAPS
    // ════════════════════════════════════════════

    const priorsMap = new Map<string, any>();
    for (const p of priorsRes.data || []) {
      priorsMap.set(p.diagnosis_id, p);
    }

    // Symptom likelihoods map with DB-stored specificity
    const symLikMap = new Map<string, Array<{ symptom_id: string; likelihood_value: number; specificity: number }>>();
    for (const sl of symptomLikRes.data || []) {
      if (!symLikMap.has(sl.diagnosis_id)) symLikMap.set(sl.diagnosis_id, []);
      symLikMap.get(sl.diagnosis_id)!.push({
        symptom_id: sl.symptom_id,
        likelihood_value: sl.likelihood_value,
        specificity: sl.symptom_specificity ?? 0.5,
      });
    }

    // Physiology likelihoods
    const physioLikMap = new Map<string, number[]>();
    for (const pl of physioLikRes.data || []) {
      if (!physioLikMap.has(pl.diagnosis_id)) physioLikMap.set(pl.diagnosis_id, []);
      physioLikMap.get(pl.diagnosis_id)!.push(pl.likelihood_value);
    }

    // Risk modifiers
    const riskModMap = new Map<string, number[]>();
    for (const rm of riskModRes.data || []) {
      if (!riskModMap.has(rm.diagnosis_id)) riskModMap.set(rm.diagnosis_id, []);
      riskModMap.get(rm.diagnosis_id)!.push(rm.modifier_weight);
    }

    // Medical history prior multipliers: diagnosis_id → max multiplier
    const historyMultiplierMap = new Map<string, number>();
    for (const hm of historyModRes.data || []) {
      const current = historyMultiplierMap.get(hm.diagnosis_id) || 1.0;
      // Use the highest applicable multiplier (don't multiply multiple history conditions)
      historyMultiplierMap.set(hm.diagnosis_id, Math.max(current, hm.prior_multiplier * hm.confidence));
    }

    // Dangerous diagnoses set
    const dangerousSet = new Set((dangerousRes.data || []).map((d: any) => d.diagnosis_id));

    // ════════════════════════════════════════════
    // COMPUTE POSTERIORS
    // ════════════════════════════════════════════

    const ageGroup = patient_age != null
      ? (patient_age < 18 ? "pediatric" : patient_age > 65 ? "elderly" : "adult")
      : "adult";

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
      // 1. PRIOR: P(D) with demographic modifiers
      const priorData = priorsMap.get(diagId);
      let prior = priorData?.base_prevalence ?? DEFAULT_PRIOR;

      if (priorData) {
        const ageMod = priorData.age_modifier?.[ageGroup] ?? 1.0;
        const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
        const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
        prior *= ageMod * sexMod * regMod;
      }

      // 2. HISTORY MULTIPLIER: Apply medical history to prior
      const historyMult = historyMultiplierMap.get(diagId) || 1.0;
      const adjustedPrior = Math.min(prior * historyMult, 0.95); // Cap at 0.95

      let logScore = Math.log(Math.max(adjustedPrior, 1e-8));

      // 3. SPECIFICITY-WEIGHTED SYMPTOM LOG-LIKELIHOOD
      const symLiks = symLikMap.get(diagId) || [];
      let weightedSymLogLik = 0;
      let coverageRatio = 0;

      if (symLiks.length > 0) {
        for (const sl of symLiks) {
          const lik = Math.max(0.01, Math.min(0.99, sl.likelihood_value));
          // Use DB-stored specificity as exponent weight (higher specificity = more discriminating)
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

      // 4. PHYSIOLOGY LIKELIHOOD
      const physLiks = physioLikMap.get(diagId) || [];
      let physioLogLik = 0;
      if (physLiks.length > 0) {
        for (const l of physLiks) {
          physioLogLik += Math.log(Math.max(0.01, Math.min(0.99, l)));
        }
        logScore += physioLogLik;
      }

      // 5. RISK MODIFIER
      const riskMods = riskModMap.get(diagId) || [];
      let riskModifier = 1.0;
      for (const w of riskMods) {
        riskModifier *= w;
        logScore += Math.log(Math.max(w, 1e-4));
      }

      // Vital sign adjustments
      if (vitals.temperature && vitals.temperature > 38.5) { riskModifier *= 1.2; logScore += Math.log(1.2); }
      if (vitals.spo2 && vitals.spo2 < 94) { riskModifier *= 1.3; logScore += Math.log(1.3); }
      if (vitals.pulse && vitals.pulse > 100) { riskModifier *= 1.1; logScore += Math.log(1.1); }

      // Collect supporting evidence
      const evidence: string[] = [];
      if (symLiks.length > 0) evidence.push(`${symLiks.length}/${totalSymptoms} symptoms (coverage ${(coverageRatio * 100).toFixed(0)}%)`);
      if (physLiks.length > 0) evidence.push(`${physLiks.length} physiology match(es)`);
      if (riskMods.length > 0) evidence.push(`${riskMods.length} risk factor(s)`);
      if (historyMult > 1.0) evidence.push(`history boost ×${historyMult.toFixed(1)}`);
      if (priorData) evidence.push(`prior: ${(adjustedPrior * 100).toFixed(1)}%`);

      results.push({
        diagnosis_id: diagId,
        prior: adjustedPrior,
        history_multiplier: historyMult,
        symptom_likelihood: symLiks.length > 0 ? Math.exp(weightedSymLogLik) : 0,
        coverage_ratio: coverageRatio,
        physiology_likelihood: physLiks.length > 0 ? Math.exp(physioLogLik) : 1,
        risk_modifier: riskModifier,
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
        log_score: parseFloat(d.log_score.toFixed(4)),
        supporting_evidence: d.supporting_evidence,
        must_not_miss: d.must_not_miss,
      })),
      total_candidates: candidate_diagnosis_ids.length,
      symptoms_resolved: symptomIds.length,
      physiology_states_used: physiological_state_ids.length,
      risk_factors_applied: allRiskSignals.length,
      history_modifiers_applied: historyModRes.data?.length || 0,
      execution_ms: executionMs,
      source: "bayesian_engine_v3_history_integrated",
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
