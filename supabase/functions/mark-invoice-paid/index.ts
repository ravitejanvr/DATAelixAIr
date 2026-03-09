import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * mark-invoice-paid Edge Function
 * 
 * Marks an invoice as paid and transitions the visit to complete.
 * Input: invoice_id, payment_method, payment_reference
 */
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

    const { invoice_id, payment_method, payment_reference } = await req.json();

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validMethods = ["cash", "upi", "card", "online", "bank_transfer"];
    const method = validMethods.includes(payment_method) ? payment_method : "cash";

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch invoice
    const { data: invoice, error: invErr } = await admin
      .from("invoices")
      .select("id, status, visit_id, clinic_id, patient_id")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (invoice.status === "paid") {
      return new Response(JSON.stringify({ error: "Invoice is already paid" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update invoice to paid
    const { error: updateErr } = await admin.from("invoices").update({
      status: "paid",
      payment_mode: method,
    }).eq("id", invoice_id);

    if (updateErr) throw new Error(`Invoice update failed: ${updateErr.message}`);

    // Update visit status to complete
    let visitUpdated = false;
    if (invoice.visit_id) {
      const { error: visitErr } = await admin.from("patient_visits")
        .update({ status: "complete" })
        .eq("id", invoice.visit_id);
      
      visitUpdated = !visitErr;
      if (visitErr) console.error(`[mark-invoice-paid] Visit update failed: ${visitErr.message}`);
    }

    // Audit log
    admin.from("audit_logs").insert({
      actor_id: user.id,
      clinic_id: invoice.clinic_id,
      event_type: "invoice_paid",
      target_type: "invoice",
      target_id: invoice_id,
      metadata: {
        payment_method: method,
        payment_reference: payment_reference || null,
        visit_completed: visitUpdated,
        visit_id: invoice.visit_id,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      success: true,
      invoice_id,
      status: "paid",
      payment_method: method,
      visit_completed: visitUpdated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("mark-invoice-paid error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
