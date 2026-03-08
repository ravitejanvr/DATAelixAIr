import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { patient_id, visit_id, clinic_id, consultation_id, orders } = body;

    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!visit_id) return new Response(JSON.stringify({ error: "visit_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!clinic_id) return new Response(JSON.stringify({ error: "clinic_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(orders) || orders.length === 0) return new Response(JSON.stringify({ error: "At least one test required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    const validOrders = orders.filter((o: any) => o.test_name?.trim()).slice(0, 30);
    if (validOrders.length === 0) return new Response(JSON.stringify({ error: "No valid tests provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const rows = validOrders.map((o: any) => ({
      test_name: String(o.test_name).substring(0, 200),
      priority: o.priority === "urgent" ? "urgent" : "routine",
      notes: o.notes ? String(o.notes).substring(0, 500) : null,
      patient_id,
      visit_id,
      clinic_id,
      doctor_id: user.id,
      consultation_id: consultation_id || null,
      status: "ordered",
    }));

    const { data: inserted, error: insertError } = await admin.from("lab_orders").insert(rows).select("id");
    if (insertError) throw new Error(insertError.message);

    // Audit (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "lab_orders_created",
      target_type: "visit",
      target_id: visit_id,
      clinic_id,
      metadata: { test_count: inserted?.length || 0, tests: validOrders.map((o: any) => o.test_name) },
    }).then(() => {});

    return new Response(JSON.stringify({
      order_ids: inserted?.map((r: any) => r.id) || [],
      count: inserted?.length || 0,
      status: "saved",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
