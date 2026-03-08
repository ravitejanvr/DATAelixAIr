import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  registered: ["arrived", "triage"],
  arrived: ["triage", "vitals", "with_doctor"],
  triage: ["vitals", "with_doctor"],
  vitals: ["with_doctor"],
  with_doctor: ["consultation_complete", "lab", "pharmacy"],
  consultation_complete: ["billing", "lab", "pharmacy", "complete"],
  lab: ["with_doctor", "consultation_complete", "pharmacy", "billing", "complete"],
  pharmacy: ["billing", "complete"],
  billing: ["complete"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { visit_id, target_status } = body;

    if (!visit_id) return new Response(JSON.stringify({ error: "visit_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!target_status) return new Response(JSON.stringify({ error: "target_status required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Get current visit
    const { data: visit, error: visitError } = await admin.from("patient_visits").select("id, status, clinic_id, patient_id").eq("id", visit_id).single();
    if (visitError || !visit) return new Response(JSON.stringify({ error: "Visit not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate transition
    const allowed = VALID_TRANSITIONS[visit.status] || [];
    if (!allowed.includes(target_status)) {
      return new Response(JSON.stringify({
        error: `Invalid transition: ${visit.status} → ${target_status}`,
        allowed_transitions: allowed,
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update visit status
    const { error: updateError } = await admin.from("patient_visits").update({ status: target_status }).eq("id", visit_id);
    if (updateError) throw new Error(updateError.message);

    // Audit (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "visit_status_updated",
      target_type: "visit",
      target_id: visit_id,
      clinic_id: visit.clinic_id,
      metadata: { previous_status: visit.status, new_status: target_status },
    }).then(() => {});

    return new Response(JSON.stringify({
      visit_id,
      previous_status: visit.status,
      status: target_status,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
