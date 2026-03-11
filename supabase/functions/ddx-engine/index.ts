import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * DDX Engine v3 — Bayesian Differential Diagnosis
 *
 * Pipeline: CCO → symptom resolution → graph traversal → Bayesian scoring
 *           → dangerous dx injection → labs/meds/guidelines → output
 *
 * P(D|S) ∝ P(S|D) × P(D) × modifiers(age, vitals, history, risk)
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
      symptoms = [],
      vitals = {},
      age = null,
      sex = null,
      weight_kg = null,
      medical_history = [],
      current_medications = [],
      allergies = [],
      risk_factors = [],
      visit_id = null,
      clinic_id = null,
      // CCO fields (Phase 1 integration)
      cco_id = null,
    } = body;

    if (!symptoms.length) {
      return new Response(JSON.stringify({ error: "symptoms[] is required" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());
    const allergiesLower = allergies.map((a: string) => a.toLowerCase());
    const historyLower = medical_history.map((h: string) => h.toLowerCase());

    // ═══════════════════════════════════════════════════
    // STAGE 1: SYMPTOM RESOLUTION (exact + fuzzy)
    // ═══════════════════════════════════════════════════
    const stageStart1 = Date.now();

    const { data: exactMatches } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .in("symptom_name", normalizedSymptoms);

    const matchedIds = new Set((exactMatches || []).map((s: any) => s.id));
    const matchedNames = new Set((exactMatches || []).map((s: any) => s.symptom_name));
    const unmatched = normalizedSymptoms.filter((s: string) => !matchedNames.has(s));

    // Fuzzy for unmatched
    let fuzzyMatches: any[] = [];
    if (unmatched.length > 0) {
      const fuzzyPromises = unmatched.map(s =>
        supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
      );
      const fuzzyResults = await Promise.all(fuzzyPromises);
      for (const res of fuzzyResults) {
        for (const s of res.data || []) {
          if (!matchedIds.has(s.id)) { matchedIds.add(s.id); fuzzyMatches.push(s); }
        }
      }
    }

    const allMatchedSymptoms = [...(exactMatches || []), ...fuzzyMatches];
    const symptomIds = Array.from(matchedIds);
    const stage1Ms = Date.now() - stageStart1;

    // Graph miss
    if (symptomIds.length === 0) {
      await logEvent(supabase, "graph_miss", clinic_id, visit_id, normalizedSymptoms, Date.now() - start);
      return respond({
        differential_diagnoses: [],
        recommended_labs: [],
        suggested_medications: [],
        guideline_recommendations: [],
        dangerous_diagnoses: [],
        matched_symptoms: [],
        unmatched_symptoms: normalizedSymptoms,
        dangerous_diagnoses_injected: 0,
        must_not_miss_count: 0,
        execution_ms: Date.now() - start,
        stage_latencies: { symptom_resolution: stage1Ms },
        bayesian_model: true,
        source: "ddx_engine_v3",
        graph_miss: true,
      });
    }

    // ═══════════════════════════════════════════════════
    // STAGE 2: GRAPH TRAVERSAL + BAYESIAN SCORING
    // ═══════════════════════════════════════════════════
    const stageStart2 = Date.now();

    // Parallel: symptom→diagnosis links + base prevalence + dangerous diagnoses
    const [diagLinksRes, dangerousRes] = await Promise.all([
      supabase
        .from("symptom_diagnosis_map")
        .select("symptom_id, diagnosis_id, confidence_score, diagnoses(id, diagnosis_name, category, icd10_code)")
        .in("symptom_id", symptomIds)
        .order("confidence_score", { ascending: false }),
      supabase
        .from("dangerous_diagnoses")
        .select("*, diagnoses(id, diagnosis_name, icd10_code, category)")
        .eq("must_not_miss", true)
        .order("priority", { ascending: true }),
    ]);

    // Build symptom-to-diagnosis association matrix
    // For each diagnosis, track which symptoms mapped and their individual confidence
    interface DiagEntry {
      diagnosis: any;
      symptom_scores: Map<string, number>;  // symptom_id → confidence_score
      symptom_names: string[];
    }

    const diagMap = new Map<string, DiagEntry>();

    for (const link of diagLinksRes.data || []) {
      const d = (link as any).diagnoses;
      if (!d) continue;
      const existing = diagMap.get(d.id);
      const symName = allMatchedSymptoms.find((s: any) => s.id === link.symptom_id)?.symptom_name || "";
      if (existing) {
        if (!existing.symptom_scores.has(link.symptom_id)) {
          existing.symptom_scores.set(link.symptom_id, link.confidence_score);
          if (symName) existing.symptom_names.push(symName);
        }
      } else {
        const scores = new Map<string, number>();
        scores.set(link.symptom_id, link.confidence_score);
        diagMap.set(d.id, {
          diagnosis: d,
          symptom_scores: scores,
          symptom_names: symName ? [symName] : [],
        });
      }
    }

    // ── Bayesian Probability Computation ──
    // P(D|S₁,S₂,...Sₙ) ∝ P(D) × ∏ P(Sᵢ|D)
    //
    // P(Sᵢ|D) = confidence_score from symptom_diagnosis_map (0-1)
    // P(D) = prior probability, estimated from category + prevalence
    //
    // Modifiers applied post-hoc for age, vitals, risk factors

    const CATEGORY_PRIORS: Record<string, number> = {
      infectious: 0.25,
      respiratory: 0.20,
      gastrointestinal: 0.12,
      cardiovascular: 0.08,
      neurological: 0.06,
      endocrine: 0.05,
      musculoskeletal: 0.05,
      dermatological: 0.04,
      psychiatric: 0.03,
      pediatric: 0.03,
      geriatric: 0.03,
      oncological: 0.02,
      hematological: 0.02,
      autoimmune: 0.02,
    };

    const DEFAULT_PRIOR = 0.05;
    const totalSymptomCount = normalizedSymptoms.length;
    const isPediatric = age != null && age < 18;
    const isElderly = age != null && age > 65;

    const bayesianScores: Array<{
      diagnosis_id: string;
      diagnosis_name: string;
      icd10_code: string | null;
      category: string;
      probability: number;
      posterior: number;
      prior: number;
      likelihood: number;
      symptom_coverage: number;
      supporting_symptoms: string[];
      contradicting_factors: string[];
      must_not_miss: boolean;
      emergency_protocol?: string;
      guideline_source?: string;
      severity_level?: string;
    }> = [];

    for (const [diagId, entry] of diagMap) {
      const d = entry.diagnosis;
      const diagName = (d.diagnosis_name || "").toLowerCase();
      const category = (d.category || "").toLowerCase();

      // P(D) — prior
      let prior = CATEGORY_PRIORS[category] || DEFAULT_PRIOR;

      // Age-adjusted priors
      if (isPediatric && category === "pediatric") prior *= 2.0;
      if (isElderly && (diagName.includes("infarction") || diagName.includes("stroke") || diagName.includes("pneumonia"))) prior *= 1.8;
      if (isPediatric && (diagName.includes("infarction") || diagName.includes("stroke"))) prior *= 0.1;

      // Sex-adjusted priors
      if (sex === "male" && diagName.includes("ectopic pregnancy")) prior = 0;
      if (sex === "female" && diagName.includes("prostate")) prior = 0;

      // History-adjusted priors
      if (historyLower.some(h => diagName.includes(h))) prior *= 1.5;

      // ∏ P(Sᵢ|D) — likelihood
      let logLikelihood = 0;
      for (const [, score] of entry.symptom_scores) {
        // Clamp to avoid log(0)
        const p = Math.max(0.01, Math.min(0.99, score));
        logLikelihood += Math.log(p);
      }
      const likelihood = Math.exp(logLikelihood);

      // Symptom coverage bonus: reward diagnoses that explain more symptoms
      const coverage = entry.symptom_scores.size / totalSymptomCount;
      const coverageMultiplier = 0.5 + 0.5 * coverage; // range [0.5, 1.0]

      // Vital sign modifiers
      let vitalModifier = 1.0;
      if (vitals.spo2 && vitals.spo2 < 94 && (diagName.includes("pneumonia") || diagName.includes("embolism") || diagName.includes("respiratory"))) {
        vitalModifier *= 1.6;
      }
      if (vitals.temperature && vitals.temperature > 38.5 && (diagName.includes("infection") || diagName.includes("sepsis") || diagName.includes("dengue") || diagName.includes("malaria"))) {
        vitalModifier *= 1.4;
      }
      if (vitals.pulse && vitals.pulse > 100 && (diagName.includes("infarction") || diagName.includes("embolism") || diagName.includes("sepsis"))) {
        vitalModifier *= 1.3;
      }
      if (vitals.bp_systolic && vitals.bp_systolic > 180 && diagName.includes("hypertensive")) {
        vitalModifier *= 1.5;
      }

      // Risk factor modifier
      let riskModifier = 1.0;
      for (const rf of risk_factors) {
        if (diagName.includes(rf.toLowerCase())) riskModifier *= 1.3;
      }

      // Posterior ∝ prior × likelihood × modifiers
      const rawPosterior = prior * likelihood * coverageMultiplier * vitalModifier * riskModifier;

      // Contradicting factors
      const contradicting: string[] = [];
      if (isPediatric && (diagName.includes("infarction") || diagName.includes("copd"))) contradicting.push("unlikely in pediatric age");
      if (sex === "male" && diagName.includes("ectopic")) contradicting.push("not applicable to male patients");

      bayesianScores.push({
        diagnosis_id: diagId,
        diagnosis_name: d.diagnosis_name,
        icd10_code: d.icd10_code,
        category: d.category,
        probability: 0, // will be normalized
        posterior: rawPosterior,
        prior,
        likelihood,
        symptom_coverage: coverage,
        supporting_symptoms: entry.symptom_names,
        contradicting_factors: contradicting,
        must_not_miss: false,
      });
    }

    // Normalize posteriors to sum to ~1
    const totalPosterior = bayesianScores.reduce((s, d) => s + d.posterior, 0) || 1;
    for (const d of bayesianScores) {
      d.probability = Math.round((d.posterior / totalPosterior) * 100);
    }

    // Sort by probability
    bayesianScores.sort((a, b) => b.probability - a.probability);

    const stage2Ms = Date.now() - stageStart2;

    // ═══════════════════════════════════════════════════
    // STAGE 3: DANGEROUS DIAGNOSIS INJECTION
    // ═══════════════════════════════════════════════════
    const stageStart3 = Date.now();
    let dangerousInjected = 0;
    const dangerousDiagnosisDetails: any[] = [];

    for (const row of dangerousRes.data || []) {
      const trigger = row.trigger_symptom.toLowerCase();
      const matched = normalizedSymptoms.some((s: string) => s.includes(trigger) || trigger.includes(s));
      if (!matched) continue;

      const diagInfo = (row as any).diagnoses;
      if (!diagInfo) continue;

      const existingIdx = bayesianScores.findIndex(d => d.diagnosis_id === diagInfo.id);
      if (existingIdx >= 0) {
        bayesianScores[existingIdx].must_not_miss = true;
        bayesianScores[existingIdx].emergency_protocol = row.emergency_protocol;
        bayesianScores[existingIdx].guideline_source = row.guideline_source;
        bayesianScores[existingIdx].severity_level = row.severity_level;
        // Ensure minimum visibility: at least 5%
        if (bayesianScores[existingIdx].probability < 5) {
          bayesianScores[existingIdx].probability = 5;
        }
      } else {
        bayesianScores.push({
          diagnosis_id: diagInfo.id,
          diagnosis_name: diagInfo.diagnosis_name,
          icd10_code: diagInfo.icd10_code,
          category: diagInfo.category,
          probability: 5,
          posterior: 0,
          prior: 0,
          likelihood: 0,
          symptom_coverage: 0,
          supporting_symptoms: [row.trigger_symptom],
          contradicting_factors: [],
          must_not_miss: true,
          emergency_protocol: row.emergency_protocol,
          guideline_source: row.guideline_source,
          severity_level: row.severity_level,
        });
        dangerousInjected++;
      }

      if (!dangerousDiagnosisDetails.find((d: any) => d.diagnosis_id === diagInfo.id)) {
        dangerousDiagnosisDetails.push({
          diagnosis_id: diagInfo.id,
          diagnosis_name: row.diagnosis_name || diagInfo.diagnosis_name,
          severity_level: row.severity_level,
          must_not_miss: true,
          emergency_protocol: row.emergency_protocol,
          guideline_source: row.guideline_source,
          trigger_symptom: row.trigger_symptom,
        });
      }
    }

    // Final selection: top 4 by probability + up to 2 must-not-miss
    const topByProb = bayesianScores.filter(d => !d.must_not_miss).slice(0, 4);
    const mustNotMiss = bayesianScores.filter(d => d.must_not_miss).slice(0, 3);
    const finalDifferential = [...topByProb, ...mustNotMiss]
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 6);

    const diagnosisIds = finalDifferential.map(d => d.diagnosis_id);
    const stage3Ms = Date.now() - stageStart3;

    // ═══════════════════════════════════════════════════
    // STAGE 4: PARALLEL — labs, meds, guidelines
    // ═══════════════════════════════════════════════════
    const stageStart4 = Date.now();

    const [labLinksRes, drugLinksRes, guidelineRulesRes, guidelineMapRes] = await Promise.all([
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_lab_map").select("priority, diagnosis_id, lab_tests(id, test_name, category)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_drug_map").select("generic_name, line_of_treatment, diagnosis_id").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      diagnosisIds.length > 0
        ? supabase.from("guideline_rules").select("recommendation, evidence_level, treatment_generic_name, diagnosis_id, guideline_authorities(authority_name, priority)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_guideline_map").select("relevance_score, recommendation_summary, diagnosis_id, guideline_registry(id, title, organization, tier, guideline_url)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
    ]);

    // ── Labs ──
    const labMap = new Map<string, { test: any; diagnoses: string[]; priority: string }>();
    for (const link of labLinksRes.data || []) {
      const lt = (link as any).lab_tests;
      if (!lt) continue;
      const diagName = finalDifferential.find(d => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "";
      const existing = labMap.get(lt.id);
      if (existing) {
        if (!existing.diagnoses.includes(diagName)) existing.diagnoses.push(diagName);
        if (link.priority === "high" || link.priority === "required") existing.priority = link.priority;
      } else {
        labMap.set(lt.id, { test: lt, diagnoses: [diagName], priority: link.priority });
      }
    }
    const recommendedLabs = Array.from(labMap.values())
      .sort((a, b) => {
        const prio: Record<string, number> = { required: 0, high: 1, recommended: 2, optional: 3 };
        if ((prio[a.priority] ?? 4) !== (prio[b.priority] ?? 4)) return (prio[a.priority] ?? 4) - (prio[b.priority] ?? 4);
        return b.diagnoses.length - a.diagnoses.length;
      })
      .map(e => ({ test_name: e.test.test_name, category: e.test.category, priority: e.priority, differentiates: e.diagnoses }));

    // ── Medications ──
    const genericNames = [...new Set((drugLinksRes.data || []).map((d: any) => d.generic_name))];
    let drugDetails: any[] = [];
    let contraindications: any[] = [];
    let interactions: any[] = [];

    if (genericNames.length > 0) {
      const [detailRes, interRes] = await Promise.all([
        supabase.from("drug_master").select("id, generic_name, drug_class, max_daily_dose_mg, pregnancy_category").in("generic_name", genericNames),
        (() => {
          const allDrugs = [...genericNames, ...current_medications.map((m: string) => m.toLowerCase())];
          if (allDrugs.length < 2) return Promise.resolve({ data: [] });
          return supabase.from("drug_interactions").select("drug_a, drug_b, severity, interaction_description, recommended_action")
            .or(allDrugs.map(n => `drug_a.ilike.%${n}%`).join(",") + "," + allDrugs.map(n => `drug_b.ilike.%${n}%`).join(","));
        })(),
      ]);
      drugDetails = detailRes.data || [];
      interactions = interRes.data || [];

      const drugIds = drugDetails.map((d: any) => d.id);
      if (drugIds.length > 0) {
        const { data } = await supabase.from("drug_contraindication_map")
          .select("drug_id, condition_id, severity, notes, diagnoses(diagnosis_name)")
          .in("drug_id", drugIds);
        contraindications = data || [];
      }
    }

    const drugDetailMap = new Map(drugDetails.map((d: any) => [d.generic_name, d]));

    const suggestedMedications = (drugLinksRes.data || []).map((link: any) => {
      const detail = drugDetailMap.get(link.generic_name);
      const diagName = finalDifferential.find(d => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "";
      const isAllergyConflict = allergiesLower.some(a => link.generic_name.toLowerCase().includes(a) || a.includes(link.generic_name.toLowerCase()));
      const contraHits = contraindications.filter((c: any) => c.drug_id === detail?.id && historyLower.some(h => (c as any).diagnoses?.diagnosis_name?.toLowerCase()?.includes(h)));
      const interHits = interactions.filter((i: any) => i.drug_a.toLowerCase().includes(link.generic_name.toLowerCase()) || i.drug_b.toLowerCase().includes(link.generic_name.toLowerCase()));

      return {
        generic_name: link.generic_name,
        drug_class: detail?.drug_class || "",
        line_of_treatment: link.line_of_treatment,
        for_diagnosis: diagName,
        safe: !isAllergyConflict && contraHits.length === 0,
        allergy_conflict: isAllergyConflict,
        contraindications: contraHits.map((c: any) => ({ condition: (c as any).diagnoses?.diagnosis_name, severity: c.severity })),
        interactions: interHits.map((i: any) => ({
          with_drug: i.drug_a.toLowerCase() === link.generic_name.toLowerCase() ? i.drug_b : i.drug_a,
          severity: i.severity,
          description: i.interaction_description,
        })),
      };
    }).sort((a: any, b: any) => (a.safe === b.safe ? 0 : a.safe ? -1 : 1));

    // ── Guidelines (merged from guideline_rules + diagnosis_guideline_map) ──
    const guidelineRecommendations: any[] = [];

    for (const r of guidelineRulesRes.data || []) {
      const auth = (r as any).guideline_authorities;
      guidelineRecommendations.push({
        guideline_name: auth?.authority_name || "Unknown",
        authority: auth?.authority_name || "Unknown",
        authority_priority: auth?.priority ?? 10,
        recommendation: r.recommendation,
        evidence_level: r.evidence_level,
        treatment: r.treatment_generic_name,
        source: "guideline_rules",
        for_diagnosis: finalDifferential.find(d => d.diagnosis_id === r.diagnosis_id)?.diagnosis_name || "",
      });
    }

    for (const link of guidelineMapRes.data || []) {
      const g = (link as any).guideline_registry;
      if (!g) continue;
      guidelineRecommendations.push({
        guideline_name: g.title,
        authority: g.organization,
        authority_priority: g.tier ?? 5,
        recommendation: link.recommendation_summary || "",
        evidence_level: "",
        treatment: "",
        source: "diagnosis_guideline_map",
        guideline_url: g.guideline_url,
        for_diagnosis: finalDifferential.find(d => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "",
      });
    }

    guidelineRecommendations.sort((a, b) => a.authority_priority - b.authority_priority);

    const stage4Ms = Date.now() - stageStart4;

    // ═══════════════════════════════════════════════════
    // STAGE 5: PERSIST + MONITOR
    // ═══════════════════════════════════════════════════
    if (visit_id) {
      const inserts = finalDifferential.map(dx => ({
        visit_id,
        hypothesis: {
          diagnosis: dx.diagnosis_name,
          probability: dx.probability,
          prior: dx.prior,
          likelihood: dx.likelihood,
          supporting_symptoms: dx.supporting_symptoms,
          contradicting_factors: dx.contradicting_factors,
          must_not_miss: dx.must_not_miss,
          icd10_code: dx.icd10_code,
          source: "ddx_engine_v3",
          bayesian: true,
        },
        confidence_score: dx.probability / 100,
        evidence_sources: dx.supporting_symptoms || [],
      }));
      supabase.from("diagnostic_hypotheses").insert(inserts).then(() => {}).catch(() => {});
    }

    const totalMs = Date.now() - start;

    // Monitor (non-blocking)
    supabase.from("monitoring_events").insert({
      event_type: "ddx_engine_executed",
      agent_name: "ddx-engine",
      clinic_id: clinic_id || null,
      success: true,
      duration_ms: totalMs,
      metadata: {
        version: "v3_bayesian",
        visit_id,
        cco_id,
        symptoms_input: normalizedSymptoms,
        symptoms_matched: symptomIds.length,
        diagnoses_returned: finalDifferential.length,
        dangerous_injected: dangerousInjected,
        labs_recommended: recommendedLabs.length,
        medications_suggested: suggestedMedications.length,
        guidelines_matched: guidelineRecommendations.length,
        top_diagnosis: finalDifferential[0]?.diagnosis_name || null,
        top_probability: finalDifferential[0]?.probability || 0,
        stage_latencies: {
          symptom_resolution: stage1Ms,
          bayesian_scoring: stage2Ms,
          dangerous_injection: stage3Ms,
          enrichment: stage4Ms,
        },
      },
    }).then(() => {}).catch(() => {});

    // Clean output (remove internal fields)
    const outputDiagnoses = finalDifferential.map(d => ({
      diagnosis_id: d.diagnosis_id,
      diagnosis_name: d.diagnosis_name,
      icd10_code: d.icd10_code,
      category: d.category,
      probability: d.probability,
      supporting_symptoms: d.supporting_symptoms,
      contradicting_factors: d.contradicting_factors,
      symptom_coverage: `${Math.round(d.symptom_coverage * 100)}%`,
      must_not_miss: d.must_not_miss,
      ...(d.emergency_protocol ? { emergency_protocol: d.emergency_protocol } : {}),
      ...(d.severity_level ? { severity_level: d.severity_level } : {}),
      ...(d.guideline_source ? { guideline_source: d.guideline_source } : {}),
    }));

    return respond({
      differential_diagnoses: outputDiagnoses,
      recommended_labs: recommendedLabs,
      suggested_medications: suggestedMedications,
      guideline_recommendations: guidelineRecommendations,
      dangerous_diagnoses: dangerousDiagnosisDetails,
      matched_symptoms: allMatchedSymptoms.map((s: any) => s.symptom_name),
      unmatched_symptoms: normalizedSymptoms.filter(s => !allMatchedSymptoms.some((ms: any) => ms.symptom_name === s || ms.symptom_name.includes(s))),
      dangerous_diagnoses_injected: dangerousInjected,
      must_not_miss_count: dangerousDiagnosisDetails.length,
      execution_ms: totalMs,
      stage_latencies: {
        symptom_resolution: stage1Ms,
        bayesian_scoring: stage2Ms,
        dangerous_injection: stage3Ms,
        enrichment: stage4Ms,
      },
      bayesian_model: true,
      source: "ddx_engine_v3",
      graph_miss: false,
    });
  } catch (err: any) {
    console.error("ddx-engine error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logEvent(supabase: any, eventType: string, clinicId: string | null, visitId: string | null, symptoms: string[], durationMs: number) {
  try {
    await supabase.from("monitoring_events").insert({
      event_type: eventType,
      agent_name: "ddx-engine",
      clinic_id: clinicId || null,
      success: false,
      duration_ms: durationMs,
      metadata: { symptoms_input: symptoms, visit_id: visitId, reason: "no_symptom_match" },
    });
  } catch { /* non-blocking */ }
}
