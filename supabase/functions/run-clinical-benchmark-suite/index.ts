import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Test Cases ─────────────────────────────────────────────
const TEST_CASES = [
  {
    name: "Viral Fever",
    context: {
      age: 32, gender: "male",
      symptoms: ["fever", "body ache", "headache"],
      duration: "2 days",
      vitals: { temperature: 101, bp: "118/78", pulse: 92, spo2: 98 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["viral infection", "dengue", "malaria", "bacterial infection"],
      labs: ["CBC", "CRP", "Dengue NS1", "Malaria smear"],
      medications: ["paracetamol"],
      dangerous_diagnosis: false,
      safety_alert: false,
    },
  },
  {
    name: "Gastroenteritis",
    context: {
      age: 24, gender: "female",
      symptoms: ["vomiting", "diarrhea", "abdominal pain"],
      duration: "1 day",
      vitals: { temperature: 99, bp: "110/70", pulse: 96, spo2: 99 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["acute gastroenteritis", "food poisoning", "appendicitis"],
      labs: ["stool culture", "electrolytes"],
      medications: ["ORS", "ondansetron"],
      dangerous_diagnosis: false,
      safety_alert: false,
    },
  },
  {
    name: "Respiratory Infection",
    context: {
      age: 45, gender: "male",
      symptoms: ["fever", "cough", "breathlessness"],
      duration: "3 days",
      vitals: { temperature: 100, bp: "122/80", pulse: 100, spo2: 94 },
      allergies: [], conditions: ["smoker"], current_medications: [],
    },
    expected: {
      diagnoses: ["community acquired pneumonia", "acute bronchitis", "influenza"],
      labs: ["CBC", "chest X-ray", "CRP"],
      medications: ["paracetamol"],
      dangerous_diagnosis: false,
      safety_alert: false,
    },
  },
  {
    name: "Chest Pain Emergency",
    context: {
      age: 65, gender: "male",
      symptoms: ["chest pain", "breathlessness", "sweating"],
      duration: "1 hour",
      vitals: { bp: "150/95", pulse: 110, spo2: 93 },
      allergies: [], conditions: ["diabetes", "hypertension"],
      current_medications: ["metformin", "amlodipine"],
    },
    expected: {
      diagnoses: ["myocardial infarction", "pulmonary embolism", "aortic dissection"],
      labs: ["ECG", "troponin", "CT angiography"],
      medications: ["aspirin", "nitroglycerin", "statin"],
      dangerous_diagnosis: true,
      safety_alert: false,
    },
  },
  {
    name: "Drug Allergy Conflict",
    context: {
      age: 40, gender: "female",
      symptoms: ["sore throat", "fever"],
      duration: "3 days",
      vitals: { temperature: 100, bp: "118/74", pulse: 88, spo2: 98 },
      allergies: ["penicillin"],
      conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["viral pharyngitis", "strep throat"],
      labs: [],
      medications: ["azithromycin"],
      dangerous_diagnosis: false,
      safety_alert: true,
    },
  },
  {
    name: "Conflicting Symptoms",
    context: {
      age: 38, gender: "male",
      symptoms: ["fever", "cough", "abdominal pain"],
      duration: "2 days",
      vitals: { temperature: 101, bp: "120/80", pulse: 94, spo2: 97 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["viral infection", "pneumonia", "appendicitis"],
      labs: ["CBC", "CRP", "chest X-ray", "ultrasound abdomen"],
      medications: ["paracetamol"],
      dangerous_diagnosis: false,
      safety_alert: false,
    },
  },
  {
    name: "Missing Evidence Scenario",
    context: {
      age: 28, gender: "female",
      symptoms: ["fever", "headache"],
      duration: "1 day",
      vitals: {},
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["viral infection"],
      labs: ["CBC"],
      medications: ["paracetamol"],
      dangerous_diagnosis: false,
      safety_alert: false,
      expect_low_confidence: true,
    },
  },
  {
    name: "Dangerous Diagnosis Detection",
    context: {
      age: 22, gender: "male",
      symptoms: ["severe headache", "fever", "neck stiffness"],
      duration: "6 hours",
      vitals: { temperature: 103, bp: "130/85", pulse: 110, spo2: 97 },
      allergies: [], conditions: [], current_medications: [],
    },
    expected: {
      diagnoses: ["meningitis"],
      labs: ["CSF analysis", "blood culture", "CBC"],
      medications: [],
      dangerous_diagnosis: true,
      safety_alert: true,
    },
  },
];

// ─── Semantic Matching Helpers ──────────────────────────────

interface ConditionMapEntry { canonical_condition: string; synonyms: string[]; }
interface LabEquivEntry { canonical_name: string; aliases: string[]; }

function resolveCanonical(name: string, map: ConditionMapEntry[]): string {
  const lower = name.toLowerCase().trim();
  for (const entry of map) {
    if (entry.canonical_condition.toLowerCase() === lower) return entry.canonical_condition.toLowerCase();
    for (const syn of entry.synonyms) {
      if (lower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(lower))
        return entry.canonical_condition.toLowerCase();
    }
  }
  return lower;
}

function resolveLabCanonical(name: string, map: LabEquivEntry[]): string {
  const lower = name.toLowerCase().trim();
  for (const entry of map) {
    if (entry.canonical_name.toLowerCase() === lower) return entry.canonical_name.toLowerCase();
    for (const alias of entry.aliases) {
      if (lower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lower))
        return entry.canonical_name.toLowerCase();
    }
  }
  return lower;
}

function resolveMedGeneric(name: string, brandMap: Array<{ brand_name: string; generic_name: string }>): string {
  const lower = name.toLowerCase().trim();
  const mapped = brandMap.find(m => m.brand_name.toLowerCase() === lower);
  return mapped ? mapped.generic_name.toLowerCase() : lower.split(/\s+\d/)[0].toLowerCase().trim();
}

function computeSemanticOverlap(actual: string[], expected: string[], resolver: (s: string) => string): number {
  if (actual.length === 0 && expected.length === 0) return 100;
  if (actual.length === 0 || expected.length === 0) return 0;
  const setA = new Set(actual.map(resolver));
  const setB = new Set(expected.map(resolver));
  let matches = 0;
  for (const item of setB) {
    if (setA.has(item)) matches++;
  }
  return Math.round((matches / setB.size) * 100);
}

// ─── Pass Criteria ──────────────────────────────────────────
const PASS_THRESHOLDS = {
  diagnosis_agreement: 60,
  lab_agreement: 50,
  medication_agreement: 40,
  guideline_citations_min: 2,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Role check
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("platform_admin") && !userRoles.includes("doctor")) {
      return new Response(JSON.stringify({ error: "Requires platform_admin or doctor role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const benchmarkVersion = body.benchmark_version || "benchmark_v4_full_reasoning";
    const selectedTests: number[] | undefined = body.test_indices;
    const runGroupId = crypto.randomUUID();

    // Load ontology tables
    const [conditionRes, labRes, brandRes] = await Promise.all([
      admin.from("clinical_condition_map").select("canonical_condition, synonyms"),
      admin.from("lab_test_equivalence").select("canonical_name, aliases"),
      admin.from("drug_brand_generic_map").select("brand_name, generic_name").limit(500),
    ]);
    const conditionMap: ConditionMapEntry[] = conditionRes.data || [];
    const labEquiv: LabEquivEntry[] = labRes.data || [];
    const brandMap = brandRes.data || [];

    const testsToRun = selectedTests
      ? TEST_CASES.filter((_, i) => selectedTests.includes(i))
      : TEST_CASES;

    const results: any[] = [];

    for (let i = 0; i < testsToRun.length; i++) {
      const tc = testsToRun[i];
      const tcIndex = selectedTests ? selectedTests[i] : i;
      const tcStart = Date.now();

      let pipelineOutput: any = {
        diagnoses: [], labs: [], medications: [], guidelines: [],
        safety_flags: [], safety_score: 100, ddx: null, uncertainty: null,
        error: null,
      };

      try {
        // Run the compare-ai-pipelines function (which runs both legacy + modular)
        const compareUrl = `${supabaseUrl}/functions/v1/compare-ai-pipelines`;
        const compareResp = await fetch(compareUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({ patient_context: tc.context }),
        });

        if (compareResp.ok) {
          const data = await compareResp.json();
          const modular = data.modular_pipeline || {};
          pipelineOutput = {
            diagnoses: modular.diagnoses || [],
            labs: modular.labs || [],
            medications: modular.medications || [],
            guidelines: modular.guidelines || [],
            safety_flags: modular.safety_flags || [],
            safety_score: modular.safety_score ?? 100,
            ddx: modular.ddx || null,
            uncertainty: modular.uncertainty || null,
            hypotheses: modular.hypotheses || [],
            evidence: modular.evidence || null,
            compliance: modular.compliance || null,
            oversight: modular.oversight || null,
            legacy: {
              diagnoses: data.legacy_pipeline?.diagnoses || [],
              labs: data.legacy_pipeline?.labs || [],
              medications: data.legacy_pipeline?.medications || [],
              latency_ms: data.legacy_pipeline?.latency_ms || 0,
            },
            comparison: data.comparison || {},
            module_logs: data.module_execution_logs || [],
          };
        } else {
          const errText = await compareResp.text();
          pipelineOutput.error = `Pipeline failed: ${compareResp.status} - ${errText.substring(0, 300)}`;
        }
      } catch (e) {
        pipelineOutput.error = `Pipeline error: ${e instanceof Error ? e.message : "Unknown"}`;
      }

      const latencyMs = Date.now() - tcStart;

      // Compute semantic agreement
      const diagResolver = (s: string) => resolveCanonical(s, conditionMap);
      const labResolver = (s: string) => resolveLabCanonical(s, labEquiv);
      const medResolver = (s: string) => resolveMedGeneric(s, brandMap);

      const diagAgreement = computeSemanticOverlap(pipelineOutput.diagnoses, tc.expected.diagnoses, diagResolver);
      const labAgreement = computeSemanticOverlap(pipelineOutput.labs, tc.expected.labs, labResolver);
      const medAgreement = computeSemanticOverlap(pipelineOutput.medications, tc.expected.medications, medResolver);

      const guidelineCitations = (pipelineOutput.guidelines || []).length;

      const safetyAlerts = (pipelineOutput.safety_flags || []).length;

      const confidenceScore = pipelineOutput.uncertainty?.confidence_score ?? null;
      const confidenceLabel = pipelineOutput.uncertainty?.confidence_label ?? null;

      const ddxLatency = pipelineOutput.ddx?.execution_ms ?? null;
      const uncertaintyLatency = pipelineOutput.uncertainty?.execution_ms ?? null;

      // Determine pass/fail
      const failureReasons: string[] = [];
      if (diagAgreement < PASS_THRESHOLDS.diagnosis_agreement)
        failureReasons.push(`Diagnosis agreement ${diagAgreement}% < ${PASS_THRESHOLDS.diagnosis_agreement}%`);
      if (tc.expected.labs.length > 0 && labAgreement < PASS_THRESHOLDS.lab_agreement)
        failureReasons.push(`Lab agreement ${labAgreement}% < ${PASS_THRESHOLDS.lab_agreement}%`);
      if (tc.expected.medications.length > 0 && medAgreement < PASS_THRESHOLDS.medication_agreement)
        failureReasons.push(`Medication agreement ${medAgreement}% < ${PASS_THRESHOLDS.medication_agreement}%`);
      if (guidelineCitations < PASS_THRESHOLDS.guideline_citations_min)
        failureReasons.push(`Guideline citations ${guidelineCitations} < ${PASS_THRESHOLDS.guideline_citations_min}`);
      if (tc.expected.dangerous_diagnosis) {
        const hasMustNotMiss = (pipelineOutput.ddx?.differential_diagnoses || pipelineOutput.hypotheses || [])
          .some((d: any) => d.must_not_miss === true);
        if (!hasMustNotMiss) failureReasons.push("Dangerous diagnosis not flagged as must_not_miss");
      }
      if (tc.expected.safety_alert && safetyAlerts === 0)
        failureReasons.push("Expected safety alert not triggered");
      if ((tc.expected as any).expect_low_confidence && confidenceScore !== null && confidenceScore > 0.75)
        failureReasons.push(`Expected low confidence but got ${confidenceScore}`);

      const passed = failureReasons.length === 0;

      const runResult = {
        benchmark_version: benchmarkVersion,
        pipeline_type: "modular_pipeline",
        test_case: tc.name,
        test_case_index: tcIndex,
        patient_context: tc.context,
        diagnosis_agreement: diagAgreement,
        lab_agreement: labAgreement,
        medication_agreement: medAgreement,
        guideline_citations: guidelineCitations,
        safety_alerts: safetyAlerts,
        confidence_score: confidenceScore,
        confidence_label: confidenceLabel,
        latency_ms: latencyMs,
        ddx_latency_ms: ddxLatency,
        uncertainty_latency_ms: uncertaintyLatency,
        pipeline_output: pipelineOutput,
        expected_output: tc.expected,
        comparison_details: {
          diagnosis_overlap_detail: { actual: pipelineOutput.diagnoses, expected: tc.expected.diagnoses },
          lab_overlap_detail: { actual: pipelineOutput.labs, expected: tc.expected.labs },
          med_overlap_detail: { actual: pipelineOutput.medications, expected: tc.expected.medications },
          legacy_comparison: pipelineOutput.comparison || {},
        },
        passed,
        failure_reasons: failureReasons,
        run_group_id: runGroupId,
        triggered_by: user.id,
      };

      // Store in benchmark_runs
      const { error: insertErr } = await admin.from("benchmark_runs").insert(runResult);
      if (insertErr) {
        console.error("Failed to store benchmark run:", insertErr);
      }

      results.push({
        test_case: tc.name,
        index: tcIndex,
        diagnosis_agreement: diagAgreement,
        lab_agreement: labAgreement,
        medication_agreement: medAgreement,
        guideline_citations: guidelineCitations,
        safety_alerts: safetyAlerts,
        confidence_score: confidenceScore,
        confidence_label: confidenceLabel,
        latency_ms: latencyMs,
        ddx_latency_ms: ddxLatency,
        uncertainty_latency_ms: uncertaintyLatency,
        passed,
        failure_reasons: failureReasons,
        pipeline_diagnoses: pipelineOutput.diagnoses,
        pipeline_labs: pipelineOutput.labs,
        pipeline_medications: pipelineOutput.medications,
        expected_diagnoses: tc.expected.diagnoses,
        expected_labs: tc.expected.labs,
        expected_medications: tc.expected.medications,
        module_logs: pipelineOutput.module_logs || [],
        error: pipelineOutput.error,
      });
    }

    // Compute aggregate summary
    const successfulResults = results.filter(r => !r.error);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const avgFloat = (arr: number[]) => arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;

    const summary = {
      benchmark_version: benchmarkVersion,
      run_group_id: runGroupId,
      total_tests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      errors: results.filter(r => r.error).length,
      avg_diagnosis_agreement: avg(successfulResults.map(r => r.diagnosis_agreement)),
      avg_lab_agreement: avg(successfulResults.map(r => r.lab_agreement)),
      avg_medication_agreement: avg(successfulResults.map(r => r.medication_agreement)),
      avg_guideline_citations: avgFloat(successfulResults.map(r => r.guideline_citations)),
      avg_safety_alerts: avgFloat(successfulResults.map(r => r.safety_alerts)),
      avg_confidence_score: avgFloat(successfulResults.map(r => r.confidence_score).filter((v: any) => v !== null) as number[]),
      avg_latency_ms: avg(successfulResults.map(r => r.latency_ms)),
      avg_ddx_latency_ms: avg(successfulResults.map(r => r.ddx_latency_ms).filter((v: any) => v !== null) as number[]),
      avg_uncertainty_latency_ms: avg(successfulResults.map(r => r.uncertainty_latency_ms).filter((v: any) => v !== null) as number[]),
      pass_thresholds: PASS_THRESHOLDS,
    };

    // Log to monitoring_events
    const { error: monitorErr } = await admin.from("monitoring_events").insert({
      event_type: "benchmark_suite_completed",
      agent_name: "clinical-benchmark-suite",
      duration_ms: results.reduce((s, r) => s + r.latency_ms, 0),
      success: summary.errors === 0,
      metadata: {
        ...summary,
        user_id: user.id,
      },
    });
    if (monitorErr) console.error("Monitor log error:", monitorErr);

    return new Response(JSON.stringify({ summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("benchmark-suite error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
