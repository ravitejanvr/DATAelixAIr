import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Benchmark Scenarios ──
const BENCHMARK_SCENARIOS = [
  {
    id: "viral_fever",
    name: "Viral Fever",
    chief_complaint: "fever and body aches for 3 days",
    symptoms: ["fever", "body aches", "headache", "fatigue", "sore throat"],
    vitals: { temperature: 38.5, pulse: 95, bp_systolic: 118, bp_diastolic: 76, spo2: 97 },
    history: [],
    expected_diagnoses: ["influenza", "viral infection", "dengue fever", "COVID-19"],
    expected_organ_system: "infectious",
  },
  {
    id: "bacterial_pneumonia",
    name: "Bacterial Pneumonia",
    chief_complaint: "productive cough with fever and chest pain",
    symptoms: ["cough", "fever", "chest pain", "shortness of breath", "sputum production", "fatigue"],
    vitals: { temperature: 39.2, pulse: 110, bp_systolic: 125, bp_diastolic: 80, spo2: 92, respiratory_rate: 28 },
    history: ["smoking"],
    expected_diagnoses: ["community-acquired pneumonia", "pneumonia", "bronchitis"],
    expected_organ_system: "respiratory",
  },
  {
    id: "myocardial_infarction",
    name: "Myocardial Infarction",
    chief_complaint: "severe crushing chest pain radiating to left arm",
    symptoms: ["chest pain", "left arm pain", "shortness of breath", "diaphoresis", "nausea"],
    vitals: { temperature: 37.0, pulse: 120, bp_systolic: 160, bp_diastolic: 95, spo2: 94 },
    history: ["hypertension", "diabetes", "smoking"],
    expected_diagnoses: ["acute myocardial infarction", "myocardial infarction", "acute coronary syndrome"],
    expected_organ_system: "cardiovascular",
  },
  {
    id: "appendicitis",
    name: "Appendicitis",
    chief_complaint: "severe right lower abdominal pain with nausea",
    symptoms: ["abdominal pain", "nausea", "vomiting", "fever", "loss of appetite"],
    vitals: { temperature: 38.3, pulse: 100, bp_systolic: 130, bp_diastolic: 80, spo2: 98 },
    history: [],
    expected_diagnoses: ["appendicitis", "acute appendicitis"],
    expected_organ_system: "gastrointestinal",
  },
  {
    id: "stroke",
    name: "Acute Ischemic Stroke",
    chief_complaint: "sudden weakness on right side with speech difficulty",
    symptoms: ["weakness", "speech difficulty", "facial drooping", "confusion", "headache"],
    vitals: { temperature: 37.1, pulse: 88, bp_systolic: 180, bp_diastolic: 100, spo2: 96 },
    history: ["hypertension", "atrial fibrillation"],
    expected_diagnoses: ["acute ischemic stroke", "stroke", "transient ischemic attack"],
    expected_organ_system: "neurological",
  },
  {
    id: "asthma_exacerbation",
    name: "Asthma Exacerbation",
    chief_complaint: "wheezing and difficulty breathing",
    symptoms: ["wheezing", "shortness of breath", "cough", "chest tightness"],
    vitals: { temperature: 37.0, pulse: 105, bp_systolic: 120, bp_diastolic: 78, spo2: 91, respiratory_rate: 30 },
    history: ["asthma"],
    expected_diagnoses: ["asthma", "asthma exacerbation", "bronchospasm"],
    expected_organ_system: "respiratory",
  },
  {
    id: "meningitis",
    name: "Meningitis",
    chief_complaint: "severe headache with neck stiffness and fever",
    symptoms: ["headache", "neck stiffness", "fever", "photophobia", "nausea", "confusion"],
    vitals: { temperature: 39.5, pulse: 115, bp_systolic: 130, bp_diastolic: 85, spo2: 96 },
    history: [],
    expected_diagnoses: ["meningitis", "bacterial meningitis", "viral meningitis"],
    expected_organ_system: "neurological",
  },
  {
    id: "gastroenteritis",
    name: "Gastroenteritis",
    chief_complaint: "diarrhea and vomiting for 2 days",
    symptoms: ["diarrhea", "vomiting", "abdominal pain", "nausea", "fever", "dehydration"],
    vitals: { temperature: 38.0, pulse: 100, bp_systolic: 105, bp_diastolic: 65, spo2: 98 },
    history: [],
    expected_diagnoses: ["gastroenteritis", "viral gastroenteritis", "food poisoning"],
    expected_organ_system: "gastrointestinal",
  },
];

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStart = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Knowledge Graph Integrity Check
    // ═══════════════════════════════════════════════════════════════════
    const step1Start = Date.now();

    const tableQueries = [
      { name: "diagnoses", query: supabase.from("diagnoses").select("id", { count: "exact", head: true }) },
      { name: "symptoms", query: supabase.from("symptoms").select("id", { count: "exact", head: true }) },
      { name: "symptom_diagnosis_map", query: supabase.from("symptom_diagnosis_map").select("id", { count: "exact", head: true }) },
      { name: "disease_priors", query: supabase.from("disease_priors").select("id", { count: "exact", head: true }) },
      { name: "symptom_likelihoods", query: supabase.from("symptom_likelihoods").select("id", { count: "exact", head: true }) },
      { name: "disease_tests", query: supabase.from("disease_tests").select("id", { count: "exact", head: true }) },
      { name: "disease_treatments", query: supabase.from("disease_treatments").select("id", { count: "exact", head: true }) },
      { name: "physiological_states", query: supabase.from("physiological_states").select("id", { count: "exact", head: true }) },
      { name: "symptom_physiology_map", query: supabase.from("symptom_physiology_map").select("id", { count: "exact", head: true }) },
      { name: "physiology_diagnosis_map", query: supabase.from("physiology_diagnosis_map").select("id", { count: "exact", head: true }) },
      { name: "drug_master", query: supabase.from("drug_master").select("id", { count: "exact", head: true }) },
      { name: "clinical_guidelines", query: supabase.from("clinical_guidelines").select("id", { count: "exact", head: true }) },
      { name: "dangerous_diagnoses", query: supabase.from("dangerous_diagnoses").select("id", { count: "exact", head: true }) },
      { name: "diagnosis_drug_map", query: supabase.from("diagnosis_drug_map").select("id", { count: "exact", head: true }) },
      { name: "diagnosis_lab_map", query: supabase.from("diagnosis_lab_map").select("id", { count: "exact", head: true }) },
    ];

    const tableCounts: Record<string, number> = {};
    const results = await Promise.all(tableQueries.map((t) => t.query));
    tableQueries.forEach((t, i) => {
      tableCounts[t.name] = results[i].count ?? 0;
    });

    // Compute connectivity stats
    const { data: avgEdges } = await supabase.rpc("exec_terminology_sql", {
      sql_text: "SELECT 1", // placeholder
    }).then(() => ({ data: null })).catch(() => ({ data: null }));

    // Get orphaned diagnoses count (diagnoses with no symptom_likelihoods)
    const { count: orphanedCount } = await supabase
      .from("diagnoses")
      .select("id", { count: "exact", head: true });

    const totalDiseases = tableCounts.diagnoses;
    const totalSymptoms = tableCounts.symptoms;
    const totalRelationships =
      tableCounts.symptom_diagnosis_map +
      tableCounts.symptom_likelihoods +
      tableCounts.symptom_physiology_map +
      tableCounts.physiology_diagnosis_map +
      tableCounts.diagnosis_drug_map +
      tableCounts.diagnosis_lab_map;
    const avgEdgesPerDisease = totalDiseases > 0
      ? Math.round((totalRelationships / totalDiseases) * 10) / 10
      : 0;

    // Identify gaps
    const graphGaps: string[] = [];
    if (tableCounts.symptom_likelihoods < 2000) graphGaps.push(`symptom_likelihoods: ${tableCounts.symptom_likelihoods}/10000 — below target`);
    if (tableCounts.disease_priors < 200) graphGaps.push(`disease_priors: ${tableCounts.disease_priors}/500 — below target`);
    if (tableCounts.physiological_states < 100) graphGaps.push(`physiological_states: ${tableCounts.physiological_states}/200 — below target`);
    if (tableCounts.clinical_guidelines < 50) graphGaps.push(`clinical_guidelines: ${tableCounts.clinical_guidelines} — insufficient guideline coverage`);

    const step1Ms = Date.now() - step1Start;

    const graphIntegrity = {
      table_counts: tableCounts,
      total_diseases: totalDiseases,
      total_symptoms: totalSymptoms,
      total_relationships: totalRelationships,
      avg_edges_per_disease: avgEdgesPerDisease,
      gaps: graphGaps,
      status: graphGaps.length === 0 ? "healthy" : graphGaps.length <= 2 ? "partial" : "degraded",
      latency_ms: step1Ms,
    };

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2 & 3: Benchmark Scenario Execution
    // ═══════════════════════════════════════════════════════════════════
    const scenarioResults = [];

    for (const scenario of BENCHMARK_SCENARIOS) {
      const scenarioStart = Date.now();
      const waveLatency: Record<string, number> = {};

      // Wave 0 — Context build
      const w0Start = Date.now();
      const patientContext = {
        chief_complaint: scenario.chief_complaint,
        symptoms: scenario.symptoms.join(", "),
        associated_symptoms: scenario.symptoms.slice(2).join(", "),
        duration: "3 days",
        age: 45,
        sex: "male",
        vitals: scenario.vitals,
        past_diagnoses: scenario.history,
        medications: [],
        allergies: [],
      };
      waveLatency.wave0_context_ms = Date.now() - w0Start;

      // Wave 1 — Knowledge Graph Retrieval
      const w1Start = Date.now();
      let graphResult = null;
      try {
        const { data } = await supabase.functions.invoke("query-clinical-graph", {
          body: {
            symptoms: scenario.symptoms,
            patient_age: 45,
            patient_sex: "male",
            patient_allergies: [],
            existing_medications: [],
          },
        });
        graphResult = data;
      } catch (e) {
        console.error(`[${scenario.id}] Graph query failed:`, e);
      }
      waveLatency.wave1_graph_ms = Date.now() - w1Start;

      // Wave 2 — DDX Engine
      const w2Start = Date.now();
      let ddxResult = null;
      try {
        const { data } = await supabase.functions.invoke("ddx-engine", {
          body: {
            symptoms: scenario.symptoms,
            chief_complaint: scenario.chief_complaint,
            age: 45,
            sex: "male",
            medical_history: scenario.history,
            vitals: scenario.vitals,
            skip_cache: true,
          },
        });
        ddxResult = data;
      } catch (e) {
        console.error(`[${scenario.id}] DDX failed:`, e);
      }
      waveLatency.wave2_ddx_ms = Date.now() - w2Start;

      // Wave 3 — Bayesian Inference
      const w3Start = Date.now();
      let bayesianResult = null;
      try {
        const topDx = ddxResult?.diagnoses?.slice(0, 5)?.map((d: any) => d.name || d.diagnosis) || [];
        const { data } = await supabase.functions.invoke("calculate-diagnostic-probabilities", {
          body: {
            symptoms: scenario.symptoms,
            differential_diagnoses: topDx,
            age: 45,
            sex: "male",
          },
        });
        bayesianResult = data;
      } catch (e) {
        console.error(`[${scenario.id}] Bayesian failed:`, e);
      }
      waveLatency.wave3_bayesian_ms = Date.now() - w3Start;

      // Wave 4 — Safety
      const w4Start = Date.now();
      let safetyResult = null;
      try {
        const { data } = await supabase.functions.invoke("clinical-safety", {
          body: {
            patient_context: patientContext,
            ddx_results: ddxResult?.diagnoses || [],
            prescriptions: [],
          },
        });
        safetyResult = data;
      } catch (e) {
        console.error(`[${scenario.id}] Safety failed:`, e);
      }
      waveLatency.wave4_safety_ms = Date.now() - w4Start;

      // Wave 5 — SOAP
      const w5Start = Date.now();
      let soapResult = null;
      try {
        const { data } = await supabase.functions.invoke("clinical-soap", {
          body: {
            transcript: `Patient presents with ${scenario.chief_complaint}. Symptoms: ${scenario.symptoms.join(", ")}.`,
            patient_context: patientContext,
            ddx_results: ddxResult?.diagnoses?.slice(0, 3) || [],
          },
        });
        soapResult = data;
      } catch (e) {
        console.error(`[${scenario.id}] SOAP failed:`, e);
      }
      waveLatency.wave5_soap_ms = Date.now() - w5Start;

      const totalScenarioMs = Date.now() - scenarioStart;

      // Evaluate results
      const actualDiagnoses = (ddxResult?.diagnoses || []).map((d: any) => d.name || d.diagnosis || "");
      const matchedDx = fuzzyMatch(actualDiagnoses, scenario.expected_diagnoses);
      const dxMatchRate = scenario.expected_diagnoses.length > 0
        ? matchedDx.length / scenario.expected_diagnoses.length
        : 0;

      // Evaluate graph results
      const graphDiagnoses = (graphResult?.diagnoses || []).map((d: any) => d.diagnosis_name || "");
      const graphMatchedDx = fuzzyMatch(graphDiagnoses, scenario.expected_diagnoses);

      const graphLabs = (graphResult?.suggested_labs || []).map((l: any) => l.test_name || "");
      const graphDrugs = (graphResult?.suggested_drugs || []).map((d: any) => d.generic_name || "");
      const graphGuidelines = (graphResult?.guideline_references || []).map((g: any) => g.title || "");

      // Bayesian posteriors
      const posteriors = bayesianResult?.posteriors || bayesianResult?.probabilities || [];
      const topPosterior = posteriors[0] || null;

      // Safety alerts
      const safetyAlerts = safetyResult?.alerts || safetyResult?.safety_alerts || [];
      const dangerDetected = safetyAlerts.some((a: any) =>
        a.severity === "critical" || a.severity === "high"
      );

      // SOAP valid
      const soapValid = !!(soapResult?.subjective || soapResult?.soap?.subjective);

      // Engine status
      const engineStatus = {
        graph_engine: graphResult !== null,
        ddx_engine: ddxResult !== null && actualDiagnoses.length > 0,
        bayesian_engine: bayesianResult !== null && posteriors.length > 0,
        safety_engine: safetyResult !== null,
        soap_engine: soapValid,
        physiology_detected: graphResult?.node_counts?.symptoms_matched > 0,
      };

      scenarioResults.push({
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        expected_organ_system: scenario.expected_organ_system,
        passed: dxMatchRate >= 0.5,
        diagnosis_match_rate: Math.round(dxMatchRate * 100) / 100,
        matched_diagnoses: matchedDx,
        actual_diagnoses: actualDiagnoses.slice(0, 5),
        graph_diagnoses: graphDiagnoses.slice(0, 5),
        graph_matched: graphMatchedDx,
        graph_labs: graphLabs.slice(0, 5),
        graph_drugs: graphDrugs.slice(0, 5),
        graph_guidelines: graphGuidelines.slice(0, 3),
        bayesian_top: topPosterior,
        bayesian_count: posteriors.length,
        safety_alert_count: safetyAlerts.length,
        danger_detected: dangerDetected,
        soap_generated: soapValid,
        engine_status: engineStatus,
        wave_latency: waveLatency,
        total_latency_ms: totalScenarioMs,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4 & 5: Aggregate Performance Metrics
    // ═══════════════════════════════════════════════════════════════════
    const passedCount = scenarioResults.filter((s) => s.passed).length;
    const avgDxMatch = scenarioResults.reduce((a, s) => a + s.diagnosis_match_rate, 0) / scenarioResults.length;
    const avgLatency = scenarioResults.reduce((a, s) => a + s.total_latency_ms, 0) / scenarioResults.length;

    // Average wave latencies
    const waveKeys = ["wave0_context_ms", "wave1_graph_ms", "wave2_ddx_ms", "wave3_bayesian_ms", "wave4_safety_ms", "wave5_soap_ms"];
    const avgWaveLatency: Record<string, number> = {};
    for (const key of waveKeys) {
      avgWaveLatency[key] = Math.round(
        scenarioResults.reduce((a, s) => a + ((s.wave_latency as any)[key] || 0), 0) / scenarioResults.length
      );
    }

    // Engine health
    const engineHealth: Record<string, number> = {
      graph_engine: scenarioResults.filter((s) => s.engine_status.graph_engine).length,
      ddx_engine: scenarioResults.filter((s) => s.engine_status.ddx_engine).length,
      bayesian_engine: scenarioResults.filter((s) => s.engine_status.bayesian_engine).length,
      safety_engine: scenarioResults.filter((s) => s.engine_status.safety_engine).length,
      soap_engine: scenarioResults.filter((s) => s.engine_status.soap_engine).length,
    };

    const totalMs = Date.now() - totalStart;

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Full Validation Report
    // ═══════════════════════════════════════════════════════════════════
    const report = {
      validation_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      total_duration_ms: totalMs,

      // 1. Knowledge Graph Integrity
      graph_integrity: graphIntegrity,

      // 2. Benchmark Results
      benchmark: {
        total_scenarios: BENCHMARK_SCENARIOS.length,
        passed: passedCount,
        failed: BENCHMARK_SCENARIOS.length - passedCount,
        pass_rate: Math.round((passedCount / BENCHMARK_SCENARIOS.length) * 100),
        avg_diagnosis_match: Math.round(avgDxMatch * 100),
        scenarios: scenarioResults,
      },

      // 3. Engine Health
      engine_health: Object.fromEntries(
        Object.entries(engineHealth).map(([k, v]) => [
          k,
          { active: v, total: BENCHMARK_SCENARIOS.length, rate: Math.round((v / BENCHMARK_SCENARIOS.length) * 100) },
        ])
      ),

      // 4. Latency Analysis
      latency: {
        avg_total_ms: Math.round(avgLatency),
        avg_wave_latency: avgWaveLatency,
        target_ms: 5000,
        meets_target: avgLatency < 5000,
      },

      // 5. Recommendations
      recommendations: [
        ...(tableCounts.symptom_likelihoods < 5000 ? ["Expand symptom_likelihoods to 10,000+ rows for better Bayesian inference"] : []),
        ...(tableCounts.disease_priors < 300 ? ["Add more disease priors to cover 500+ diseases"] : []),
        ...(tableCounts.clinical_guidelines < 50 ? ["Populate clinical_guidelines and guideline_registry for guideline retrieval"] : []),
        ...(passedCount < BENCHMARK_SCENARIOS.length ? [`${BENCHMARK_SCENARIOS.length - passedCount} benchmark scenarios failed — review DDX coverage`] : []),
        ...(avgLatency > 5000 ? ["Pipeline latency exceeds 5s target — optimize slow wave stages"] : []),
      ],
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
