import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * validate-intake Edge Function
 *
 * Validates a visit_token and returns visit + patient info for self-intake.
 * No JWT required — token is the access credential.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { visit_token } = await req.json();

    if (!visit_token || typeof visit_token !== "string") {
      return new Response(JSON.stringify({ error: "visit_token is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up visit by token
    const { data: visit, error } = await supabase
      .from("patient_visits")
      .select("id, patient_id, clinic_id, status, patients(name)")
      .eq("visit_token", visit_token)
      .maybeSingle();

    if (error || !visit) {
      return new Response(JSON.stringify({ error: "Invalid or expired intake link" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only allow intake for visits in valid states
    if (!["registered", "triage"].includes(visit.status)) {
      return new Response(JSON.stringify({
        error: "This visit has already been processed",
        status: visit.status,
      }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      visit_id: visit.id,
      patient_id: visit.patient_id,
      clinic_id: visit.clinic_id,
      patient_name: (visit.patients as any)?.name || "",
      status: visit.status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("validate-intake error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
