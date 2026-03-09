import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * record-triage Edge Function
 * 
 * Validates and saves triage/intake data:
 * 1. Validates visit exists and belongs to clinic
 * 2. Validates triage fields (chief complaint required)
 * 3. Inserts triage record
 * 4. Updates visit status to "triage" if still "registered"
 * 
 * Public endpoint for QR self-intake
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      visit_id, patient_id, clinic_id,
      chief_complaint, symptom_duration, pain_score,
      priority, allergies_noted, notes, recorded_by,
    } = body;

    // ── Validation ──
    if (!visit_id || !patient_id || !clinic_id) {
      return new Response(JSON.stringify({ error: "visit_id, patient_id, and clinic_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!chief_complaint || typeof chief_complaint !== "string" || chief_complaint.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Chief complaint is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify visit exists ──
    const { data: visit, error: vErr } = await supabase
      .from("patient_visits")
      .select("id, status, clinic_id")
      .eq("id", visit_id)
      .eq("clinic_id", clinic_id)
      .single();

    if (vErr || !visit) {
      return new Response(JSON.stringify({ error: "Visit not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate pain score ──
    let safePainScore: number | null = null;
    if (pain_score !== undefined && pain_score !== null) {
      const parsed = parseInt(pain_score);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
        safePainScore = parsed;
      }
    }

    // ── Determine priority from symptoms ──
    const safePriority = ["routine", "urgent", "emergent"].includes(priority) ? priority : "routine";

    // ── Insert triage ──
    const { data: triage, error: tErr } = await supabase.from("triage").insert({
      visit_id,
      patient_id,
      clinic_id,
      chief_complaint: chief_complaint.trim().slice(0, 1000),
      symptom_duration: typeof symptom_duration === "string" ? symptom_duration.slice(0, 100) : null,
      pain_score: safePainScore,
      priority: safePriority,
      allergies_noted: typeof allergies_noted === "string" ? allergies_noted.slice(0, 500) : null,
      notes: typeof notes === "string" ? notes.slice(0, 2000) : null,
      recorded_by: recorded_by || patient_id, // self-recorded if no staff
    }).select("id").single();

    if (tErr) throw new Error(`Triage record failed: ${tErr.message}`);

    // ── Update visit status if registered or arrived ──
    if (["registered", "arrived"].includes(visit.status)) {
      await supabase
        .from("patient_visits")
        .update({ status: "triage" })
        .eq("id", visit_id);
    }

    return new Response(JSON.stringify({
      triage_id: triage.id,
      visit_status: visit.status === "registered" ? "triage" : visit.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("record-triage error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
