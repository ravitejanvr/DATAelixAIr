import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * submit-intake Edge Function
 *
 * Validates visit_token, then:
 * 1. Inserts triage data
 * 2. Updates visit status
 * 3. Updates patient allergies if provided
 *
 * No JWT required — visit_token is the access credential.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      visit_token,
      chief_complaint,
      symptom_duration,
      pain_score,
      priority,
      allergies_noted,
      notes,
      allergies,
    } = body;

    // ── Validate token ──
    if (!visit_token || typeof visit_token !== "string") {
      return new Response(JSON.stringify({ error: "visit_token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: visit, error: vErr } = await supabase
      .from("patient_visits")
      .select("id, patient_id, clinic_id, status")
      .eq("visit_token", visit_token)
      .maybeSingle();

    if (vErr || !visit) {
      return new Response(JSON.stringify({ error: "Invalid or expired intake link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["registered", "triage"].includes(visit.status)) {
      return new Response(JSON.stringify({ error: "Visit already processed" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Insert triage ──
    const { error: tErr } = await supabase.from("triage").insert({
      visit_id: visit.id,
      patient_id: visit.patient_id,
      clinic_id: visit.clinic_id,
      chief_complaint: typeof chief_complaint === "string" ? chief_complaint.slice(0, 1000) : "",
      symptom_duration: typeof symptom_duration === "string" ? symptom_duration.slice(0, 100) : null,
      pain_score: typeof pain_score === "number" ? Math.min(Math.max(pain_score, 0), 10) : 0,
      allergies_noted: typeof allergies_noted === "string" ? allergies_noted.slice(0, 500) : null,
      pregnancy_status: "not_applicable",
      priority: ["routine", "semi_urgent", "urgent"].includes(priority) ? priority : "routine",
      notes: typeof notes === "string" ? notes.slice(0, 1000) : null,
      recorded_by: visit.patient_id, // self-recorded
    });

    if (tErr) throw new Error(`Triage insert failed: ${tErr.message}`);

    // ── Update visit status ──
    await supabase
      .from("patient_visits")
      .update({ status: "triage" })
      .eq("id", visit.id);

    // ── Update patient allergies if provided ──
    if (Array.isArray(allergies) && allergies.length > 0) {
      const safeAllergies = allergies
        .filter((a: unknown) => typeof a === "string")
        .slice(0, 50);
      if (safeAllergies.length > 0) {
        await supabase
          .from("patients")
          .update({ allergies: safeAllergies })
          .eq("id", visit.patient_id);
      }
    }

    // ── Audit ──
    supabase.from("audit_logs").insert({
      actor_id: visit.patient_id,
      clinic_id: visit.clinic_id,
      event_type: "self_intake_submitted",
      target_type: "patient_visit",
      target_id: visit.id,
      metadata: { source: "visit_token", chief_complaint },
    }).then(() => {});

    return new Response(JSON.stringify({ success: true, visit_id: visit.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-intake error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
