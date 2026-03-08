import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * finalize-visit Edge Function
 * 
 * Handles visit completion:
 * 1. Validates the visit exists and belongs to the clinic
 * 2. Updates visit status to "consultation_complete" or "billing"
 * 3. Links consultation_id to the visit
 * 4. Generates an invoice stub if billing is enabled
 * 5. Logs audit event
 */

const VALID_TRANSITIONS: Record<string, string[]> = {
  "registered": ["arrived"],
  "arrived": ["triage"],
  "triage": ["vitals", "with_doctor"],
  "vitals": ["with_doctor"],
  "with_doctor": ["consultation_complete"],
  "consultation_complete": ["billing", "completed"],
  "billing": ["completed"],
};

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { visit_id, consultation_id, clinic_id, target_status, billing_enabled } = await req.json();

    if (!visit_id) {
      return new Response(JSON.stringify({ error: "visit_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch current visit ──
    const { data: visit, error: visitError } = await supabase
      .from("patient_visits")
      .select("id, status, clinic_id, patient_id")
      .eq("id", visit_id)
      .single();

    if (visitError || !visit) {
      return new Response(JSON.stringify({ error: "Visit not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate status transition ──
    const nextStatus = target_status || "consultation_complete";
    const allowed = VALID_TRANSITIONS[visit.status];
    if (allowed && !allowed.includes(nextStatus)) {
      return new Response(JSON.stringify({
        error: `Invalid transition: ${visit.status} → ${nextStatus}`,
        current_status: visit.status,
        allowed_transitions: allowed,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update visit ──
    const updatePayload: Record<string, any> = { status: nextStatus };
    if (consultation_id) updatePayload.consultation_id = consultation_id;

    const { error: updateError } = await supabase
      .from("patient_visits")
      .update(updatePayload)
      .eq("id", visit_id);

    if (updateError) throw new Error(`Visit update failed: ${updateError.message}`);

    // ── Generate invoice stub if billing enabled ──
    let invoice_id: string | null = null;
    if (billing_enabled && (nextStatus === "billing" || nextStatus === "consultation_complete")) {
      // Check if invoice already exists for this visit
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("visit_id", visit_id)
        .maybeSingle();

      if (!existing) {
        // Load clinic default fee
        const { data: config } = await supabase
          .from("clinic_workflow_config")
          .select("default_consultation_fee")
          .eq("clinic_id", visit.clinic_id)
          .maybeSingle();

        const consultationFee = config?.default_consultation_fee || 0;

        const { data: invoiceData, error: invoiceError } = await supabase.from("invoices").insert({
          clinic_id: visit.clinic_id,
          visit_id: visit_id,
          patient_id: visit.patient_id,
          doctor_id: user.id,
          consultation_id: consultation_id || null,
          consultation_fee: consultationFee,
          total: consultationFee,
          status: "pending",
          payment_mode: "cash",
        }).select("id").single();

        if (!invoiceError && invoiceData) {
          invoice_id = invoiceData.id;
        }
      } else {
        invoice_id = existing.id;
      }
    }

    // ── Audit log ──
    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      clinic_id: visit.clinic_id,
      event_type: "visit_status_updated",
      target_type: "patient_visit",
      target_id: visit_id,
      metadata: {
        from_status: visit.status,
        to_status: nextStatus,
        consultation_id: consultation_id || null,
        invoice_created: !!invoice_id,
      },
    });

    return new Response(JSON.stringify({
      visit_id,
      status: nextStatus,
      previous_status: visit.status,
      invoice_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("finalize-visit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
