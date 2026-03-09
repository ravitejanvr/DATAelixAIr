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
    const { patient_id, visit_id, consultation_id, consultation_fee, procedures, lab_charges, discount, payment_mode } = body;

    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Get clinic_id
    const { data: profile } = await admin.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle();
    const clinic_id = profile?.clinic_id;
    if (!clinic_id) return new Response(JSON.stringify({ error: "No clinic associated" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Sanitize line items
    const cleanItems = (items: any[]) =>
      Array.isArray(items)
        ? items.filter((i: any) => i?.description?.trim()).slice(0, 50).map((i: any) => ({
            description: String(i.description).substring(0, 200),
            amount: String(i.amount || "0"),
          }))
        : [];

    const cleanProcedures = cleanItems(procedures);
    const cleanLabCharges = cleanItems(lab_charges);
    const fee = Math.max(0, parseFloat(consultation_fee) || 0);
    const disc = Math.max(0, parseFloat(discount) || 0);

    const procTotal = cleanProcedures.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0);
    const labTotal = cleanLabCharges.reduce((s: number, l: any) => s + (parseFloat(l.amount) || 0), 0);
    const total = Math.max(0, fee + procTotal + labTotal - disc);

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

    const validModes = ["cash", "upi", "card", "netbanking", "online_link"];
    const mode = validModes.includes(payment_mode) ? payment_mode : "cash";

    const { data: invoice, error: insertError } = await admin.from("invoices").insert({
      patient_id,
      clinic_id,
      doctor_id: user.id,
      visit_id: visit_id || null,
      consultation_id: consultation_id || null,
      consultation_fee: fee,
      procedures: cleanProcedures,
      lab_charges: cleanLabCharges,
      discount: disc,
      total,
      payment_mode: mode,
      invoice_number: invoiceNumber,
      status: "pending",
    }).select("id, invoice_number, total").single();

    if (insertError) throw new Error(insertError.message);

    // Audit (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "invoice_created",
      target_type: "invoice",
      target_id: invoice.id,
      clinic_id,
      metadata: { patient_id, total, payment_mode: mode },
    }).then(() => {});

    return new Response(JSON.stringify({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      total: invoice.total,
      status: "saved",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
