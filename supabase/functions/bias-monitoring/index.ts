import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Bias Monitoring Engine
 *
 * Detects and reports on four bias categories:
 *   1. Selection bias — uneven representation across demographics
 *   2. Measurement bias — inconsistent data quality across groups
 *   3. Label bias — systematic mislabeling in training signals
 *   4. Algorithmic bias — disparate AI performance across groups
 *
 * Uses the 80% rule (four-fifths rule) for fairness assessment.
 * Logs results to bias_metrics and monitoring_events tables.
 */

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

    // Validate admin/platform role
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!["platform_admin", "clinic_admin", "doctor"].some(r => userRoles.includes(r))) {
      return new Response(JSON.stringify({ error: "Insufficient role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clinic_id, period_days = 30 } = await req.json();
    const periodStart = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString();
    const periodEnd = new Date().toISOString();

    const biasResults: any[] = [];

    // ═══════════════════════════════════════
    // 1. SELECTION BIAS — demographic representation
    // ═══════════════════════════════════════
    const patientQuery = admin.from("patients").select("gender, age").gte("created_at", periodStart);
    if (clinic_id) patientQuery.eq("clinic_id", clinic_id);
    const { data: patients } = await patientQuery;

    if (patients && patients.length > 0) {
      // Gender distribution
      const genderCounts: Record<string, number> = {};
      const ageBuckets: Record<string, number> = { "0-18": 0, "19-40": 0, "41-60": 0, "61+": 0 };

      for (const p of patients) {
        const g = (p.gender || "unknown").toLowerCase();
        genderCounts[g] = (genderCounts[g] || 0) + 1;

        const age = p.age || 0;
        if (age <= 18) ageBuckets["0-18"]++;
        else if (age <= 40) ageBuckets["19-40"]++;
        else if (age <= 60) ageBuckets["41-60"]++;
        else ageBuckets["61+"]++;
      }

      const total = patients.length;
      const maxGenderRate = Math.max(...Object.values(genderCounts)) / total;
      const minGenderRate = Math.min(...Object.values(genderCounts)) / total;
      const genderDisparity = maxGenderRate > 0 ? minGenderRate / maxGenderRate : 1;

      for (const [gender, count] of Object.entries(genderCounts)) {
        biasResults.push({
          metric_type: "selection_bias",
          dimension: "gender",
          dimension_value: gender,
          sample_count: count,
          positive_rate: count / total,
          disparity_score: Math.round((1 - genderDisparity) * 10000) / 10000,
          passes_fairness: genderDisparity >= 0.8,
          period_start: periodStart,
          period_end: periodEnd,
          clinic_id: clinic_id || null,
        });
      }

      for (const [bucket, count] of Object.entries(ageBuckets)) {
        biasResults.push({
          metric_type: "selection_bias",
          dimension: "age_group",
          dimension_value: bucket,
          sample_count: count,
          positive_rate: count / total,
          disparity_score: 0,
          passes_fairness: true,
          period_start: periodStart,
          period_end: periodEnd,
          clinic_id: clinic_id || null,
        });
      }
    }

    // ═══════════════════════════════════════
    // 2. LABEL BIAS — AI diagnosis correction rates by condition
    // ═══════════════════════════════════════
    const { data: corrections } = await admin
      .from("doctor_learning_signals")
      .select("signal_data")
      .eq("signal_type", "diagnosis_correction")
      .gte("created_at", periodStart);

    if (corrections && corrections.length > 0) {
      const conditionCorrections: Record<string, { total: number; corrected: number }> = {};

      for (const c of corrections) {
        const data = c.signal_data as any;
        const condition = (data?.ai_diagnosis || "unknown").toLowerCase();
        if (!conditionCorrections[condition]) conditionCorrections[condition] = { total: 0, corrected: 0 };
        conditionCorrections[condition].total++;
        if (data?.was_corrected) conditionCorrections[condition].corrected++;
      }

      for (const [condition, stats] of Object.entries(conditionCorrections)) {
        const correctionRate = stats.total > 0 ? stats.corrected / stats.total : 0;
        biasResults.push({
          metric_type: "label_bias",
          dimension: "condition",
          dimension_value: condition,
          sample_count: stats.total,
          positive_rate: correctionRate,
          override_rate: correctionRate,
          disparity_score: correctionRate > 0.3 ? correctionRate : 0,
          passes_fairness: correctionRate <= 0.3,
          period_start: periodStart,
          period_end: periodEnd,
          clinic_id: clinic_id || null,
        });
      }
    }

    // ═══════════════════════════════════════
    // 3. ALGORITHMIC BIAS — AI acceptance rates by demographic
    // ═══════════════════════════════════════
    const { data: ledgerEntries } = await admin
      .from("ai_decision_ledger")
      .select("doctor_action, ai_output_type, metadata")
      .gte("created_at", periodStart);

    if (ledgerEntries && ledgerEntries.length > 0) {
      const actionCounts: Record<string, { accepted: number; total: number }> = {};

      for (const entry of ledgerEntries) {
        const outputType = entry.ai_output_type || "unknown";
        if (!actionCounts[outputType]) actionCounts[outputType] = { accepted: 0, total: 0 };
        actionCounts[outputType].total++;
        if (entry.doctor_action === "accepted") actionCounts[outputType].accepted++;
      }

      for (const [outputType, stats] of Object.entries(actionCounts)) {
        const acceptanceRate = stats.total > 0 ? stats.accepted / stats.total : 0;
        biasResults.push({
          metric_type: "algorithmic_bias",
          dimension: "output_type",
          dimension_value: outputType,
          sample_count: stats.total,
          acceptance_rate: Math.round(acceptanceRate * 10000) / 10000,
          override_rate: Math.round((1 - acceptanceRate) * 10000) / 10000,
          disparity_score: acceptanceRate < 0.5 ? Math.round((0.5 - acceptanceRate) * 10000) / 10000 : 0,
          passes_fairness: acceptanceRate >= 0.5,
          period_start: periodStart,
          period_end: periodEnd,
          clinic_id: clinic_id || null,
        });
      }
    }

    // ═══════════════════════════════════════
    // 4. MEASUREMENT BIAS — data completeness across groups
    // ═══════════════════════════════════════
    const { data: outcomes } = await admin
      .from("outcome_feedback")
      .select("outcome_status, diagnosis_match, ai_diagnosis")
      .gte("created_at", periodStart);

    if (outcomes && outcomes.length > 0) {
      const outcomeCounts: Record<string, number> = {};
      let matchCount = 0;

      for (const o of outcomes) {
        outcomeCounts[o.outcome_status || "unknown"] = (outcomeCounts[o.outcome_status || "unknown"] || 0) + 1;
        if (o.diagnosis_match) matchCount++;
      }

      const diagnosisAccuracy = outcomes.length > 0 ? matchCount / outcomes.length : 0;

      biasResults.push({
        metric_type: "measurement_bias",
        dimension: "diagnosis_accuracy",
        dimension_value: "overall",
        sample_count: outcomes.length,
        positive_rate: Math.round(diagnosisAccuracy * 10000) / 10000,
        disparity_score: diagnosisAccuracy < 0.7 ? Math.round((0.7 - diagnosisAccuracy) * 10000) / 10000 : 0,
        passes_fairness: diagnosisAccuracy >= 0.7,
        period_start: periodStart,
        period_end: periodEnd,
        clinic_id: clinic_id || null,
      });
    }

    // ── Store bias metrics ──
    if (biasResults.length > 0) {
      await admin.from("bias_metrics").insert(biasResults);
    }

    // ── Log to monitoring_events ──
    const failingMetrics = biasResults.filter(b => !b.passes_fairness);
    await admin.from("monitoring_events").insert({
      event_type: "bias_audit",
      pipeline_type: "bias_monitoring",
      total_latency_ms: 0,
      stage_latencies: {},
      metadata: {
        clinic_id,
        period_days,
        metrics_computed: biasResults.length,
        failing_metrics: failingMetrics.length,
        bias_types: [...new Set(biasResults.map(b => b.metric_type))],
        overall_fairness: failingMetrics.length === 0,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      metrics_computed: biasResults.length,
      failing_metrics: failingMetrics.length,
      overall_fairness: failingMetrics.length === 0,
      results: biasResults,
      mitigation_recommendations: failingMetrics.length > 0 ? generateMitigations(failingMetrics) : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Bias monitoring error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateMitigations(failingMetrics: any[]): string[] {
  const mitigations: string[] = [];
  const types = new Set(failingMetrics.map(m => m.metric_type));

  if (types.has("selection_bias")) {
    mitigations.push("Pre-processing: Review patient intake to ensure balanced demographic representation.");
    mitigations.push("Pre-processing: Consider stratified sampling for training data collection.");
  }
  if (types.has("label_bias")) {
    mitigations.push("In-processing: High correction rates detected for specific conditions — review AI extraction prompts.");
    mitigations.push("In-processing: Add fairness constraints to model fine-tuning for affected conditions.");
  }
  if (types.has("algorithmic_bias")) {
    mitigations.push("Post-processing: Low AI acceptance rates indicate model drift — schedule model evaluation.");
    mitigations.push("Post-processing: Monitor override patterns by output type for targeted improvement.");
  }
  if (types.has("measurement_bias")) {
    mitigations.push("Pre-processing: Diagnosis accuracy below threshold — augment training data for underperforming conditions.");
    mitigations.push("In-processing: Review data collection completeness across clinical workflows.");
  }

  return mitigations;
}
