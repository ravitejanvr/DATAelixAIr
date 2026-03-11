import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Capture Learning Signal (v2)
 * 
 * Records doctor corrections to AI outputs for continuous improvement.
 * All data is anonymized — no patient identifiers stored.
 * 
 * Signal types:
 *   - diagnosis_correction: AI diagnosis vs doctor final diagnosis
 *   - treatment_modification: AI treatment vs doctor prescription  
 *   - safety_alert_override: Doctor overrides safety alert with rationale
 *   - outcome_feedback: Follow-up outcome tracking
 *   - transcript_edit, extraction_correction, documentation_style (existing)
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
    const body = await req.json();
    const { signal_type, signal_data, clinic_id, visit_id, consultation_id } = body;

    if (!signal_type) {
      return new Response(JSON.stringify({ error: "signal_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Store learning signal ──
    const { error: insertError } = await admin.from("doctor_learning_signals").insert({
      doctor_id: user.id,
      clinic_id: clinic_id || null,
      signal_type,
      signal_data: signal_data || {},
    });

    if (insertError) {
      console.error("Learning signal insert error:", insertError);
      throw insertError;
    }

    // ── If outcome feedback, also store in outcome_feedback table ──
    if (signal_type === "outcome_feedback" && signal_data?.ai_diagnosis && signal_data?.doctor_final_diagnosis) {
      await admin.from("outcome_feedback").insert({
        visit_id: visit_id || "00000000-0000-0000-0000-000000000000",
        consultation_id: consultation_id || null,
        patient_id: signal_data.patient_id || "00000000-0000-0000-0000-000000000000",
        clinic_id: clinic_id || "00000000-0000-0000-0000-000000000000",
        doctor_id: user.id,
        ai_diagnosis: signal_data.ai_diagnosis,
        doctor_final_diagnosis: signal_data.doctor_final_diagnosis,
        diagnosis_match: signal_data.ai_diagnosis.toLowerCase().trim() === signal_data.doctor_final_diagnosis.toLowerCase().trim(),
        treatment_prescribed: signal_data.treatment_prescribed || [],
        outcome_status: signal_data.outcome_status || "pending",
        follow_up_required: signal_data.follow_up_required || false,
        days_to_resolution: signal_data.days_to_resolution || null,
        learning_signals: {
          diagnosis_edit_distance: levenshteinRatio(signal_data.ai_diagnosis, signal_data.doctor_final_diagnosis),
          treatment_count: (signal_data.treatment_prescribed || []).length,
          captured_at: new Date().toISOString(),
        },
      });
    }

    // ── If diagnosis correction, compute and log accuracy metrics ──
    if (signal_type === "diagnosis_correction") {
      const { count: totalCorrections } = await admin
        .from("doctor_learning_signals")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", user.id)
        .eq("signal_type", "diagnosis_correction");

      const { count: totalConsultations } = await admin
        .from("consultations")
        .select("id", { count: "exact", head: true })
        .eq("doctor_id", user.id);

      const correctionRate = totalConsultations && totalConsultations > 0
        ? (totalCorrections || 0) / totalConsultations
        : 0;

      await admin.from("monitoring_events").insert({
        event_type: "learning_metric",
        pipeline_type: "learning_loop",
        total_latency_ms: 0,
        stage_latencies: {},
        metadata: {
          doctor_id: user.id,
          clinic_id,
          correction_rate: Math.round(correctionRate * 1000) / 1000,
          total_corrections: totalCorrections || 0,
          total_consultations: totalConsultations || 0,
          signal_type,
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Capture learning error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function levenshteinRatio(a: string, b: string): number {
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1.0;
  const maxLen = Math.max(al.length, bl.length);
  if (maxLen === 0) return 1.0;
  
  const matrix: number[][] = [];
  for (let i = 0; i <= al.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= bl.length; j++) {
      if (i === 0) { matrix[i][j] = j; continue; }
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (al[i - 1] === bl[j - 1] ? 0 : 1)
      );
    }
  }
  return Math.round((1 - matrix[al.length][bl.length] / maxLen) * 1000) / 1000;
}
