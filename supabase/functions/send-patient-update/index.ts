import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * send-patient-update Edge Function
 * 
 * Sends SMS/WhatsApp notifications to patients at key workflow stages.
 * Uses MSG91 as the default provider.
 * 
 * Input: patient_id, visit_id, clinic_id, trigger_event, extra_vars
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, supabaseKey);
    const { patient_id, visit_id, clinic_id, trigger_event, extra_vars = {} } = await req.json();

    if (!patient_id || !trigger_event) {
      return new Response(JSON.stringify({ error: "patient_id and trigger_event required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch patient, clinic, visit data in parallel
    const [patientRes, clinicRes, visitRes, templateRes, settingsRes] = await Promise.all([
      admin.from("patients").select("name, phone").eq("id", patient_id).single(),
      clinic_id ? admin.from("clinics").select("name, phone").eq("id", clinic_id).single() : Promise.resolve({ data: null }),
      visit_id ? admin.from("patient_visits").select("token_number, status").eq("id", visit_id).single() : Promise.resolve({ data: null }),
      // Try clinic-specific template first, then global
      admin.from("notification_templates").select("message_template, template_name")
        .eq("trigger_event", trigger_event)
        .eq("is_active", true)
        .or(`clinic_id.eq.${clinic_id || "00000000-0000-0000-0000-000000000000"},clinic_id.is.null`)
        .order("clinic_id", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      clinic_id ? admin.from("clinic_settings").select("sms_enabled, whatsapp_enabled, notification_provider, notification_api_key").eq("clinic_id", clinic_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const patient = patientRes.data;
    const clinic = clinicRes.data;
    const visit = visitRes.data;
    const template = templateRes.data;
    const settings = settingsRes.data;

    if (!patient?.phone) {
      // Log attempt but no phone number
      await admin.from("notification_logs").insert({
        patient_id, visit_id, clinic_id, message_type: "sms",
        trigger_event, delivery_status: "no_phone",
        message_content: template?.message_template || trigger_event,
      });
      return new Response(JSON.stringify({ status: "skipped", reason: "no_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message from template
    let message = template?.message_template || `Update from ${clinic?.name || "your clinic"}: ${trigger_event.replace(/_/g, " ")}`;

    // Replace template variables
    const vars: Record<string, string> = {
      patient_name: patient.name || "Patient",
      clinic_name: clinic?.name || "Clinic",
      token: String(visit?.token_number || ""),
      visit_link: `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/visit-journey/${visit_id || ""}`,
      doctor_name: extra_vars.doctor_name || "Doctor",
      amount: extra_vars.amount || "0",
      report_link: extra_vars.report_link || "",
      pharmacy_name: extra_vars.pharmacy_name || "Pharmacy",
      ...extra_vars,
    };

    for (const [key, value] of Object.entries(vars)) {
      message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    let deliveryStatus = "pending";
    let providerResponse: Record<string, unknown> = {};

    // Send via MSG91 if enabled
    const smsEnabled = settings?.sms_enabled ?? false;
    const apiKey = settings?.notification_api_key;

    if (smsEnabled && apiKey) {
      try {
        // MSG91 Quick Send API
        const msg91Res = await fetch("https://control.msg91.com/api/v5/flow/", {
          method: "POST",
          headers: {
            "authkey": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            flow_id: "default", // Clinic can configure their MSG91 flow ID
            recipients: [
              {
                mobiles: patient.phone.replace(/[^0-9]/g, ""),
                var1: message,
              },
            ],
          }),
        });

        if (msg91Res.ok) {
          const result = await msg91Res.json();
          deliveryStatus = "sent";
          providerResponse = result;
        } else {
          deliveryStatus = "failed";
          providerResponse = { status: msg91Res.status, error: await msg91Res.text() };
        }
      } catch (smsErr) {
        deliveryStatus = "failed";
        providerResponse = { error: smsErr instanceof Error ? smsErr.message : "SMS send error" };
      }
    } else {
      deliveryStatus = "queued"; // SMS not enabled, but logged for later
    }

    // Log notification
    await admin.from("notification_logs").insert({
      patient_id,
      visit_id,
      clinic_id,
      message_type: "sms",
      trigger_event,
      message_content: message,
      recipient_phone: patient.phone,
      provider: settings?.notification_provider || "msg91",
      delivery_status: deliveryStatus,
      provider_response: providerResponse,
    });

    return new Response(JSON.stringify({
      status: deliveryStatus,
      message_sent: message,
      trigger_event,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-patient-update error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
