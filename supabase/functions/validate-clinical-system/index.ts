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
    medications: [],
    allergies: [],
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
    medications: [],
    allergies: [],
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
    medications: ["metformin", "amlodipine"],
    allergies: [],
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
    medications: [],
    allergies: [],
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
    medications: ["warfarin", "lisinopril"],
    allergies: [],
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
    medications: ["salbutamol inhaler"],
    allergies: ["aspirin"],
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
    medications: [],
    allergies: ["penicillin"],
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
    medications: [],
    allergies: [],
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

/**
 * Helper to invoke edge functions via fetch (bypasses SDK auth constraints).
 * Uses the user's original auth token to satisfy per-function JWT validation.
 */
async function invokeFunction(
  supabaseUrl: string,
  functionName: string,
  body: Record<string, unknown>,
  authToken: string,
): Promise<{ data: any; error: any }> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") || "",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[${functionName}] HTTP ${resp.status}: ${text}`);
      return { data: null, error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    return { data, error: null };
  } catch (e) {
    console.error(`[${functionName}] Invoke error:`, e);
    return { data: null, error: String(e) };
  }
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

    // Extract the caller's JWT to forward to downstream engines
    const callerAuth = req.headers.get("Authorization")?.replace("Bearer ", "") || "";

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
    // STEP 2: Benchmark Scenario Execution (with correct adapters)
    // ═══════════════════════════════════════════════════════════════════
    const scenarioResults = [];

    for (const scenario of BENCHMARK_SCENARIOS) {
      const scenarioStart = Date.now();
      const waveLatency: Record<string, number> = {};
      const pipelineTrace: Record<string, any> = {};

      // ── Wave 0: Context build ──
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
        medications: scenario.medications,
        allergies: scenario.allergies,
      };
      waveLatency.wave0_context_ms = Date.now() - w0Start;

      // ── Wave 1: Knowledge Graph Retrieval ──
      const w1Start = Date.now();
      let graphResult: any = null;
      try {
        const { data } = await invokeFunction(supabaseUrl, "query-clinical-graph", {
          symptoms: scenario.symptoms,
          patient_age: 45,
          patient_sex: "male",
          patient_allergies: scenario.allergies,
          existing_medications: scenario.medications,
        }, callerAuth);
        graphResult = data;
        pipelineTrace.graph_output_keys = data ? Object.keys(data) : [];
      } catch (e) {
        console.error(`[${scenario.id}] Graph query failed:`, e);
      }
      waveLatency.wave1_graph_ms = Date.now() - w1Start;

      // ── Wave 2: DDX Engine ──
      // Adapter: DDX expects {symptoms, vitals, age, sex, medical_history, current_medications, allergies, risk_factors}
      const w2Start = Date.now();
      let ddxResult: any = null;
      try {
        const { data, error } = await invokeFunction(supabaseUrl, "ddx-engine", {
          symptoms: scenario.symptoms,
          vitals: scenario.vitals,
          age: 45,
          sex: "male",
          medical_history: scenario.history,
          current_medications: scenario.medications,
          allergies: scenario.allergies,
          risk_factors: scenario.history,
        }, callerAuth);
        if (error) {
          console.error(`[${scenario.id}] DDX error:`, error);
          pipelineTrace.ddx_error = error;
        }
        ddxResult = data;
        pipelineTrace.ddx_diagnosis_count = data?.differential_diagnoses?.length ?? 0;
        pipelineTrace.ddx_graph_miss = data?.graph_miss ?? null;
      } catch (e) {
        console.error(`[${scenario.id}] DDX failed:`, e);
        pipelineTrace.ddx_error = String(e);
      }
      waveLatency.wave2_ddx_ms = Date.now() - w2Start;

      // ── Wave 3: Bayesian Engine ──
      // Adapter: Bayesian expects {candidate_diagnosis_ids (UUIDs), symptoms, physiological_state_ids, risk_factors, patient_age, patient_sex, vitals}
      const w3Start = Date.now();
      let bayesianResult: any = null;
      try {
        // Extract diagnosis IDs from DDX output
        const candidateIds = (ddxResult?.differential_diagnoses || [])
          .map((d: any) => d.diagnosis_id)
          .filter(Boolean);
        
        pipelineTrace.bayesian_input_candidate_count = candidateIds.length;

        if (candidateIds.length > 0) {
          const { data, error } = await invokeFunction(supabaseUrl, "calculate-diagnostic-probabilities", {
            candidate_diagnosis_ids: candidateIds,
            symptoms: scenario.symptoms,
            physiological_state_ids: [],
            risk_factors: scenario.history,
            patient_age: 45,
            patient_sex: "male",
            vitals: scenario.vitals,
          }, callerAuth);
          if (error) {
            console.error(`[${scenario.id}] Bayesian error:`, error);
            pipelineTrace.bayesian_error = error;
          }
          bayesianResult = data;
          pipelineTrace.bayesian_diagnosis_count = data?.diagnoses?.length ?? 0;
        } else {
          pipelineTrace.bayesian_skipped = "no candidate_diagnosis_ids from DDX";
        }
      } catch (e) {
        console.error(`[${scenario.id}] Bayesian failed:`, e);
        pipelineTrace.bayesian_error = String(e);
      }
      waveLatency.wave3_bayesian_ms = Date.now() - w3Start;

      // ── Wave 4: Safety Engine ──
      // Adapter: Safety expects {medications (string[]), allergies (string[]), vitals (object), symptoms (string[]), clinical_context (object)}
      const w4Start = Date.now();
      let safetyResult: any = null;
      try {
        // Collect medications from DDX suggested_medications + scenario medications
        const ddxMeds = (ddxResult?.suggested_medications || []).map((m: any) => m.generic_name).filter(Boolean);
        const allMeds = [...new Set([...scenario.medications, ...ddxMeds])];

        const { data, error } = await invokeFunction(supabaseUrl, "clinical-safety", {
          medications: allMeds.length > 0 ? allMeds : ["acetaminophen"], // ensure non-empty
          allergies: scenario.allergies,
          vitals: scenario.vitals,
          symptoms: scenario.symptoms,
          clinical_context: {
            chief_complaint: scenario.chief_complaint,
            patient_age: 45,
            patient_sex: "male",
            allergies: scenario.allergies,
            current_medications: scenario.medications,
          },
        }, callerAuth);
        if (error) {
          console.error(`[${scenario.id}] Safety error:`, error);
          pipelineTrace.safety_error = error;
        }
        safetyResult = data;
        pipelineTrace.safety_flags_count = (data?.interaction_flags?.length ?? 0) +
          (data?.allergy_flags?.length ?? 0) +
          (data?.vitals_dangers?.length ?? 0) +
          (data?.emergency_patterns?.length ?? 0);
      } catch (e) {
        console.error(`[${scenario.id}] Safety failed:`, e);
        pipelineTrace.safety_error = String(e);
      }
      waveLatency.wave4_safety_ms = Date.now() - w4Start;

      // ── Wave 5: SOAP Generator ──
      // Adapter: SOAP expects {transcript, extractedData (object with diagnoses, medications, etc.), clinical_context}
      const w5Start = Date.now();
      let soapResult: any = null;
      try {
        // Build extractedData from pipeline outputs
        const topDiagnoses = (ddxResult?.differential_diagnoses || []).slice(0, 3).map((d: any) => ({
          name: d.diagnosis_name,
          probability: d.probability,
          icd10: d.icd10_code,
        }));
        const topMeds = (ddxResult?.suggested_medications || []).slice(0, 5).map((m: any) => m.generic_name);
        const topLabs = (ddxResult?.recommended_labs || []).slice(0, 5).map((l: any) => l.test_name);

        const extractedData = {
          diagnoses: topDiagnoses,
          medications: topMeds,
          labs: topLabs,
          safety_results: safetyResult || null,
          bayesian_results: bayesianResult?.diagnoses?.slice(0, 3) || [],
        };

        const { data, error } = await invokeFunction(supabaseUrl, "clinical-soap", {
          transcript: `Patient presents with ${scenario.chief_complaint}. Symptoms include ${scenario.symptoms.join(", ")}. Vitals: Temperature ${scenario.vitals.temperature}°C, Pulse ${scenario.vitals.pulse}, BP ${scenario.vitals.bp_systolic}/${scenario.vitals.bp_diastolic}, SpO2 ${scenario.vitals.spo2}%.${scenario.history.length > 0 ? ` History: ${scenario.history.join(", ")}.` : ""}`,
          extractedData,
          clinical_context: {
            chief_complaint: scenario.chief_complaint,
            patient_age: 45,
            patient_sex: "male",
            vitals: scenario.vitals,
            allergies: scenario.allergies,
            current_medications: scenario.medications,
            past_diagnoses: scenario.history,
          },
        }, callerAuth);
        if (error) {
          console.error(`[${scenario.id}] SOAP error:`, error);
          pipelineTrace.soap_error = error;
        }
        soapResult = data;
        pipelineTrace.soap_sections = data?.sections ? Object.keys(data.sections) : [];
      } catch (e) {
        console.error(`[${scenario.id}] SOAP failed:`, e);
        pipelineTrace.soap_error = String(e);
      }
      waveLatency.wave5_soap_ms = Date.now() - w5Start;

      const totalScenarioMs = Date.now() - scenarioStart;

      // ═══════════════════════════════════════════════════════════════════
      // Evaluate results
      // ═══════════════════════════════════════════════════════════════════
      
      // DDX diagnoses
      const ddxDiagnoses = (ddxResult?.differential_diagnoses || []).map((d: any) => d.diagnosis_name || "");
      const matchedDx = fuzzyMatch(ddxDiagnoses, scenario.expected_diagnoses);
      const dxMatchRate = scenario.expected_diagnoses.length > 0
        ? matchedDx.length / scenario.expected_diagnoses.length
        : 0;

      // Graph diagnoses
      const graphDiagnoses = (graphResult?.diagnoses || []).map((d: any) => d.diagnosis_name || "");
      const graphMatchedDx = fuzzyMatch(graphDiagnoses, scenario.expected_diagnoses);
      const graphLabs = (graphResult?.suggested_labs || []).map((l: any) => l.test_name || "");
      const graphDrugs = (graphResult?.suggested_drugs || []).map((d: any) => d.generic_name || "");
      const graphGuidelines = (graphResult?.guideline_references || []).map((g: any) => g.title || "");

      // Bayesian posteriors
      const posteriors = bayesianResult?.diagnoses || [];
      const topPosterior = posteriors[0] || null;

      // Safety alerts
      const safetyAlerts = [
        ...(safetyResult?.interaction_flags || []),
        ...(safetyResult?.allergy_flags || []),
        ...(safetyResult?.vitals_dangers || []),
        ...(safetyResult?.emergency_patterns || []),
      ];
      const dangerDetected = (safetyResult?.emergency_patterns || []).length > 0 ||
        (safetyResult?.vitals_dangers || []).some((v: any) => v.severity === "critical");

      // SOAP valid
      const soapSections = soapResult?.sections || {};
      const soapValid = !!(soapSections["Visit Summary"] || soapSections["Provisional Diagnosis"] || soapResult?.soap_text);

      // Engine status
      const engineStatus = {
        graph_engine: graphResult !== null && graphDiagnoses.length > 0,
        ddx_engine: ddxResult !== null && ddxDiagnoses.length > 0,
        bayesian_engine: bayesianResult !== null && posteriors.length > 0,
        safety_engine: safetyResult !== null && !safetyResult?.error,
        soap_engine: soapValid,
        physiology_detected: (graphResult?.physiology_states || []).length > 0 ||
          graphResult?.node_counts?.symptoms_matched > 0,
      };

      scenarioResults.push({
        scenario_id: scenario.id,
        scenario_name: scenario.name,
        expected_organ_system: scenario.expected_organ_system,
        passed: dxMatchRate >= 0.5 || matchedDx.length >= 1,
        diagnosis_match_rate: Math.round(dxMatchRate * 100) / 100,
        matched_diagnoses: matchedDx,
        actual_diagnoses: ddxDiagnoses.slice(0, 5),
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
        pipeline_trace: pipelineTrace,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // Aggregate Performance Metrics
    // ═══════════════════════════════════════════════════════════════════
    const passedCount = scenarioResults.filter((s) => s.passed).length;
    const avgDxMatch = scenarioResults.reduce((a, s) => a + s.diagnosis_match_rate, 0) / scenarioResults.length;
    const avgLatency = scenarioResults.reduce((a, s) => a + s.total_latency_ms, 0) / scenarioResults.length;

    const waveKeys = ["wave0_context_ms", "wave1_graph_ms", "wave2_ddx_ms", "wave3_bayesian_ms", "wave4_safety_ms", "wave5_soap_ms"];
    const avgWaveLatency: Record<string, number> = {};
    for (const key of waveKeys) {
      avgWaveLatency[key] = Math.round(
        scenarioResults.reduce((a, s) => a + ((s.wave_latency as any)[key] || 0), 0) / scenarioResults.length
      );
    }

    // Engine health
    const engineHealthRaw: Record<string, number> = {
      graph_engine: scenarioResults.filter((s) => s.engine_status.graph_engine).length,
      ddx_engine: scenarioResults.filter((s) => s.engine_status.ddx_engine).length,
      bayesian_engine: scenarioResults.filter((s) => s.engine_status.bayesian_engine).length,
      safety_engine: scenarioResults.filter((s) => s.engine_status.safety_engine).length,
      soap_engine: scenarioResults.filter((s) => s.engine_status.soap_engine).length,
    };

    const totalMs = Date.now() - totalStart;

    // ═══════════════════════════════════════════════════════════════════
    // Full Validation Report
    // ═══════════════════════════════════════════════════════════════════
    const report = {
      validation_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      total_duration_ms: totalMs,

      graph_integrity: graphIntegrity,

      benchmark: {
        total_scenarios: BENCHMARK_SCENARIOS.length,
        passed: passedCount,
        failed: BENCHMARK_SCENARIOS.length - passedCount,
        pass_rate: Math.round((passedCount / BENCHMARK_SCENARIOS.length) * 100),
        avg_diagnosis_match: Math.round(avgDxMatch * 100),
        scenarios: scenarioResults,
      },

      engine_health: Object.fromEntries(
        Object.entries(engineHealthRaw).map(([k, v]) => [
          k,
          { active: v, total: BENCHMARK_SCENARIOS.length, rate: Math.round((v / BENCHMARK_SCENARIOS.length) * 100) },
        ])
      ),

      latency: {
        avg_total_ms: Math.round(avgLatency),
        avg_wave_latency: avgWaveLatency,
        target_ms: 5000,
        meets_target: avgLatency < 5000,
      },

      recommendations: [
        ...(tableCounts.symptom_likelihoods < 5000 ? ["Expand symptom_likelihoods to 10,000+ rows for better Bayesian inference"] : []),
        ...(tableCounts.disease_priors < 300 ? ["Add more disease priors to cover 500+ diseases"] : []),
        ...(tableCounts.clinical_guidelines < 50 ? ["Populate clinical_guidelines and guideline_registry for guideline retrieval"] : []),
        ...(passedCount < BENCHMARK_SCENARIOS.length ? [`${BENCHMARK_SCENARIOS.length - passedCount} benchmark scenarios failed — review DDX coverage`] : []),
        ...(avgLatency > 5000 ? ["Pipeline latency exceeds 5s target — optimize slow wave stages"] : []),
      ],

      repair_log: {
        fixes_applied: [
          "Auth propagation: forwarding caller JWT to DDX, Bayesian, and Safety engines",
          "DDX→Bayesian adapter: extracting diagnosis_id UUIDs from differential_diagnoses",
          "Safety adapter: mapping {medications, allergies, vitals, symptoms, clinical_context} correctly",
          "SOAP adapter: passing {transcript, extractedData, clinical_context} with DDX+Bayesian+Safety outputs",
        ],
        previous_issues: [
          "DDX engine returned 401 — service role key not valid for auth.getUser()",
          "Bayesian received 0 candidate_diagnosis_ids — was receiving string names instead of UUIDs",
          "Safety received undefined medications — was receiving {patient_context, ddx_results, prescriptions}",
          "SOAP received no clinical data — was missing extractedData with pipeline outputs",
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
