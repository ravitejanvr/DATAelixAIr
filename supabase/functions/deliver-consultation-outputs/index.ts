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
    const {
      consultation_id,
      patient_id,
      clinic_id,
      visit_id,
      delivery_targets, // array of: "patient", "pharmacy", "lab", "admin"
      delivery_method, // "sms", "email", "portal", "link"
      target_language,
      prescription_ids,
      lab_order_ids,
    } = body;

    if (!consultation_id || !clinic_id) {
      return new Response(JSON.stringify({ error: "consultation_id and clinic_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const deliveryResults: any[] = [];

    const targets = Array.isArray(delivery_targets) ? delivery_targets : ["patient"];

    // ── Send to Patient ──
    if (targets.includes("patient")) {
      try {
        const reportResp = await fetch(`${supabaseUrl}/functions/v1/send-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            apikey: anonKey,
          },
          body: JSON.stringify({
            consultation_id,
            visit_id,
            delivery_method: delivery_method || "link",
            target_language: target_language || null,
          }),
        });
        const reportData = await reportResp.json();
        deliveryResults.push({
          target: "patient",
          status: reportResp.ok ? "sent" : "failed",
          report_link: reportData.report_link || null,
          error: reportResp.ok ? undefined : reportData.error,
        });
      } catch (e: any) {
        deliveryResults.push({ target: "patient", status: "failed", error: e.message });
      }
    }

    // ── Send to Pharmacy ──
    if (targets.includes("pharmacy") && prescription_ids?.length > 0) {
      try {
        const rxRows = prescription_ids.map((rxId: string) => ({
          prescription_id: rxId,
          clinic_id,
          patient_id,
          status: "pending",
        }));
        const { data: phOrders, error: phError } = await admin.from("pharmacy_orders").insert(rxRows).select("id");
        if (phError) throw new Error(phError.message);
        deliveryResults.push({
          target: "pharmacy",
          status: "forwarded",
          order_count: phOrders?.length || 0,
        });
      } catch (e: any) {
        deliveryResults.push({ target: "pharmacy", status: "failed", error: e.message });
      }
    }

    // ── Send to Lab ──
    if (targets.includes("lab") && lab_order_ids?.length > 0) {
      try {
        const labRows = lab_order_ids.map((loId: string) => ({
          lab_order_id: loId,
          clinic_id,
          patient_id,
          status: "pending",
        }));
        const { data: lpOrders, error: lpError } = await admin.from("lab_partner_orders").insert(labRows).select("id");
        if (lpError) throw new Error(lpError.message);
        deliveryResults.push({
          target: "lab",
          status: "forwarded",
          order_count: lpOrders?.length || 0,
        });
      } catch (e: any) {
        deliveryResults.push({ target: "lab", status: "failed", error: e.message });
      }
    }

    // ── Audit ──
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "consultation_delivered",
      target_type: "consultation",
      target_id: consultation_id,
      clinic_id,
      metadata: {
        patient_id,
        delivery_targets: targets,
        delivery_method,
        results: deliveryResults,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      status: "delivered",
      delivery_results: deliveryResults,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
