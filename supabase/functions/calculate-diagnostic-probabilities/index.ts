import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Bayesian Diagnostic Probability Engine v2 — Log-Likelihood Scoring
 *
 * Computes:
 *   score(D) = log(prior(D))
 *            + Σ log(P(Sᵢ|D))
 *            + Σ log(P(Φⱼ|D))
 *            + Σ log(R(k))
 *            + coverage_bonus
 *
 * Where coverage_bonus = (matched_symptoms / total_symptoms) * 0.25
 *
 * Scores are converted to probabilities via softmax normalization.
 * This eliminates multiplicative underflow that collapses posteriors
 * when many symptoms are present.
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
      patient_age = null,
      patient_sex = null,
      region = "south_asia",
      vitals = {},
    } = body;

    if (candidate_diagnosis_ids.length === 0) {
      return new Response(JSON.stringify({
        diagnoses: [],
        execution_ms: Date.now() - start,
        source: "bayesian_engine_v1",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve symptom names to IDs if needed
    let symptomIds: string[] = [];
    if (symptoms.length > 0) {
      const normalized = symptoms.map((s: string) => s.toLowerCase().trim());
      const { data: symRows } = await supabase
        .from("symptoms")
        .select("id, symptom_name")
        .in("symptom_name", normalized);
      
      // Also fuzzy match
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

    // ════════════════════════════════════════════
    // PARALLEL: Fetch priors, symptom likelihoods, physiology likelihoods, risk modifiers
    // ════════════════════════════════════════════

    const [priorsRes, symptomLikRes, physioLikRes, riskModRes, dangerousRes] = await Promise.all([
      supabase.from("disease_priors")
        .select("diagnosis_id, base_prevalence, age_modifier, sex_modifier, region_modifier")
        .in("diagnosis_id", candidate_diagnosis_ids),
      symptomIds.length > 0
        ? supabase.from("symptom_likelihoods")
            .select("diagnosis_id, symptom_id, likelihood_value")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("symptom_id", symptomIds)
        : Promise.resolve({ data: [] }),
      physiological_state_ids.length > 0
        ? supabase.from("physiology_likelihoods")
            .select("diagnosis_id, physiological_state_id, likelihood_value")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("physiological_state_id", physiological_state_ids)
        : Promise.resolve({ data: [] }),
      risk_factors.length > 0
        ? supabase.from("risk_factor_modifiers")
            .select("diagnosis_id, risk_factor, modifier_weight")
            .in("diagnosis_id", candidate_diagnosis_ids)
            .in("risk_factor", risk_factors.map((r: string) => r.toLowerCase()))
        : Promise.resolve({ data: [] }),
      // Always fetch dangerous diagnoses
      supabase.from("dangerous_diagnoses")
        .select("diagnosis_id, diagnosis_name, severity_level, emergency_protocol, must_not_miss")
        .eq("must_not_miss", true)
        .in("diagnosis_id", candidate_diagnosis_ids),
    ]);

    // ════════════════════════════════════════════
    // BUILD LOOKUP MAPS
    // ════════════════════════════════════════════

    // Priors map: diagnosis_id → { prevalence, age_mod, sex_mod, region_mod }
    const priorsMap = new Map<string, any>();
    for (const p of priorsRes.data || []) {
      priorsMap.set(p.diagnosis_id, p);
    }

    // Symptom likelihoods: diagnosis_id → [likelihood_values]
    const symLikMap = new Map<string, number[]>();
    const symEvidenceMap = new Map<string, string[]>();
    for (const sl of symptomLikRes.data || []) {
      if (!symLikMap.has(sl.diagnosis_id)) {
        symLikMap.set(sl.diagnosis_id, []);
        symEvidenceMap.set(sl.diagnosis_id, []);
      }
      symLikMap.get(sl.diagnosis_id)!.push(sl.likelihood_value);
    }

    // Physiology likelihoods: diagnosis_id → [likelihood_values]
    const physioLikMap = new Map<string, number[]>();
    for (const pl of physioLikRes.data || []) {
      if (!physioLikMap.has(pl.diagnosis_id)) physioLikMap.set(pl.diagnosis_id, []);
      physioLikMap.get(pl.diagnosis_id)!.push(pl.likelihood_value);
    }

    // Risk modifiers: diagnosis_id → [modifier_weights]
    const riskModMap = new Map<string, number[]>();
    for (const rm of riskModRes.data || []) {
      if (!riskModMap.has(rm.diagnosis_id)) riskModMap.set(rm.diagnosis_id, []);
      riskModMap.get(rm.diagnosis_id)!.push(rm.modifier_weight);
    }

    // Dangerous diagnoses set
    const dangerousSet = new Set((dangerousRes.data || []).map((d: any) => d.diagnosis_id));

    // ════════════════════════════════════════════
    // COMPUTE LOG-LIKELIHOOD SCORES
    // ════════════════════════════════════════════

    // Determine age group
    const ageGroup = patient_age != null
      ? (patient_age < 18 ? "pediatric" : patient_age > 65 ? "elderly" : "adult")
      : "adult";

    const sexKey = (patient_sex || "").toLowerCase() === "female" ? "female" : "male";
    const regionKey = region || "south_asia";

    interface BayesianDiagnosis {
      diagnosis_id: string;
      prior: number;
      log_prior: number;
      symptom_log_likelihood: number;
      physiology_log_likelihood: number;
      risk_log_modifier: number;
      coverage_bonus: number;
      matched_symptoms: number;
      total_symptoms: number;
      raw_score: number;
      posterior_probability: number;
      supporting_evidence: string[];
      must_not_miss: boolean;
    }

    const results: BayesianDiagnosis[] = [];
    const DEFAULT_PRIOR = 0.05;
    const LOG_FLOOR = Math.log(0.01); // floor for missing likelihoods

    // Count total diagnoses that have symptom_likelihoods data
    const diagsWithSymLik = candidate_diagnosis_ids.filter((id: string) => (symLikMap.get(id) || []).length > 0).length;
    const hasAnySymLikData = diagsWithSymLik > 0;

    for (const diagId of candidate_diagnosis_ids) {
      // 1. PRIOR: log P(D)
      const priorData = priorsMap.get(diagId);
      let prior = priorData?.base_prevalence ?? DEFAULT_PRIOR;

      if (priorData) {
        const ageMod = priorData.age_modifier?.[ageGroup] ?? 1.0;
        const sexMod = priorData.sex_modifier?.[sexKey] ?? 1.0;
        const regMod = priorData.region_modifier?.[regionKey] ?? 1.0;
        prior *= ageMod * sexMod * regMod;
      }
      prior = Math.max(0.001, Math.min(0.99, prior));
      const logPrior = Math.log(prior);

      // 2. SYMPTOM LOG-LIKELIHOOD: Σ log P(Sᵢ|D)
      const symLiks = symLikMap.get(diagId) || [];
      let symptomLogLik = 0;
      let matchedSymptoms = symLiks.length;

      if (symLiks.length > 0) {
        for (const l of symLiks) {
          symptomLogLik += Math.log(Math.max(0.01, Math.min(0.99, l)));
        }
      } else if (symptomIds.length > 0) {
        if (hasAnySymLikData) {
          // Penalize: no symptom evidence while others have it
          symptomLogLik = Math.min(symptomIds.length, 3) * Math.log(0.15);
        } else {
          symptomLogLik = Math.max(1, 4 - symptomIds.length) * Math.log(0.3);
        }
      }

      // 3. PHYSIOLOGY LOG-LIKELIHOOD: Σ log P(Φⱼ|D)
      const physLiks = physioLikMap.get(diagId) || [];
      let physioLogLik = 0;
      if (physLiks.length > 0) {
        for (const l of physLiks) {
          physioLogLik += Math.log(Math.max(0.01, Math.min(0.99, l)));
        }
      }

      // 4. RISK LOG-MODIFIER: Σ log R(k)
      const riskMods = riskModMap.get(diagId) || [];
      let riskLogMod = 0;
      for (const w of riskMods) {
        riskLogMod += Math.log(Math.max(0.01, w));
      }

      // Vital sign adjustments
      if (vitals.temperature && vitals.temperature > 38.5) riskLogMod += Math.log(1.2);
      if (vitals.spo2 && vitals.spo2 < 94) riskLogMod += Math.log(1.3);
      if (vitals.pulse && vitals.pulse > 100) riskLogMod += Math.log(1.1);

      // 5. COVERAGE BONUS: (matched / total) * 0.25
      const totalSymptoms = symptomIds.length || 1;
      const coverage = matchedSymptoms / totalSymptoms;
      const coverageBonus = coverage * 0.25;

      // 6. RAW SCORE (log-space)
      const rawScore = logPrior + symptomLogLik + physioLogLik + riskLogMod + coverageBonus;

      // Collect supporting evidence
      const evidence: string[] = [];
      if (symLiks.length > 0) evidence.push(`${symLiks.length} symptom match(es)`);
      if (physLiks.length > 0) evidence.push(`${physLiks.length} physiology match(es)`);
      if (riskMods.length > 0) evidence.push(`${riskMods.length} risk factor(s)`);
      if (priorData) evidence.push(`prior: ${(prior * 100).toFixed(1)}%`);
      evidence.push(`coverage: ${(coverage * 100).toFixed(0)}%`);

      results.push({
        diagnosis_id: diagId,
        prior,
        log_prior: logPrior,
        symptom_log_likelihood: symptomLogLik,
        physiology_log_likelihood: physioLogLik,
        risk_log_modifier: riskLogMod,
        coverage_bonus: coverageBonus,
        matched_symptoms: matchedSymptoms,
        total_symptoms: totalSymptoms,
        raw_score: rawScore,
        posterior_probability: 0, // softmax below
        supporting_evidence: evidence,
        must_not_miss: dangerousSet.has(diagId),
      });
    }

    // ════════════════════════════════════════════
    // SOFTMAX NORMALIZATION (log-scores → probabilities)
    // ════════════════════════════════════════════
    const maxScore = Math.max(...results.map(d => d.raw_score));
    const expScores = results.map(d => Math.exp(d.raw_score - maxScore)); // subtract max for numerical stability
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

    // Re-normalize after must-not-miss floor
    const newTotal = results.reduce((s, d) => s + d.posterior_probability, 0) || 1;
    for (const d of results) {
      d.posterior_probability = parseFloat((d.posterior_probability / newTotal).toFixed(4));
    }

    // Sort by posterior descending
    results.sort((a, b) => b.posterior_probability - a.posterior_probability);

    const executionMs = Date.now() - start;

    return new Response(JSON.stringify({
      diagnoses: results.map(d => ({
        diagnosis_id: d.diagnosis_id,
        posterior_probability: d.posterior_probability,
        prior: parseFloat(d.prior.toFixed(4)),
        symptom_likelihood: parseFloat(d.symptom_likelihood.toFixed(4)),
        physiology_likelihood: parseFloat(d.physiology_likelihood.toFixed(4)),
        risk_modifier: parseFloat(d.risk_modifier.toFixed(4)),
        supporting_evidence: d.supporting_evidence,
        must_not_miss: d.must_not_miss,
      })),
      total_candidates: candidate_diagnosis_ids.length,
      symptoms_resolved: symptomIds.length,
      physiology_states_used: physiological_state_ids.length,
      risk_factors_applied: risk_factors.length,
      execution_ms: executionMs,
      source: "bayesian_engine_v1",
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
