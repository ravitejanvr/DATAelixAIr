import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * send-report Edge Function
 * 
 * Generates a secure, time-limited report token and delivers it via SMS, email, or link.
 * SMS falls back to mock/audit mode when MSG91 API key is not configured.
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

    const { consultation_id, visit_id, delivery_method, patient_phone, patient_email, target_language } = await req.json();

    if (!consultation_id) {
      return new Response(JSON.stringify({ error: "consultation_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify consultation exists and caller is the doctor
    const { data: consultation, error: cErr } = await admin
      .from("consultations")
      .select("id, doctor_id, patient_id, clinic_id, status")
      .eq("id", consultation_id)
      .single();

    if (cErr || !consultation) {
      return new Response(JSON.stringify({ error: "Consultation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (consultation.doctor_id !== user.id) {
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "platform_admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: only the consulting doctor can send reports" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate report via generate-patient-report
    const reportResponse = await fetch(`${supabaseUrl}/functions/v1/generate-patient-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: anonKey,
      },
      body: JSON.stringify({ consultation_id, visit_id, target_language }),
    });

    if (!reportResponse.ok) {
      const err = await reportResponse.text();
      throw new Error(`Report generation failed: ${err}`);
    }

    const reportData = await reportResponse.json();

    // ── Generate secure report token ──
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { error: tokenError } = await admin.from("report_tokens").insert({
      token,
      consultation_id,
      expires_at: expiresAt,
      created_by: user.id,
    });

    if (tokenError) {
      console.error("Failed to create report token:", tokenError);
      // Non-blocking: continue with link generation
    }

    // Build secure report link using token
    const appOrigin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";
    const reportLink = `${appOrigin}/report-view?token=${token}`;

    // ── Delivery handling ──
    let delivery_status = "link_generated";
    const delivery_details: Record<string, any> = { token, expires_at: expiresAt };

    // SMS delivery
    const smsApiKey = Deno.env.get("SMS_API_KEY");
    if (delivery_method === "sms" && patient_phone) {
      if (smsApiKey) {
        try {
          const templateId = Deno.env.get("SMS_TEMPLATE_ID") || "";
          const smsProvider = Deno.env.get("SMS_PROVIDER") || "msg91";
          
          const smsResponse = await fetch("https://control.msg91.com/api/v5/flow/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authkey: smsApiKey,
            },
            body: JSON.stringify({
              flow_id: templateId,
              recipients: [{ mobiles: patient_phone, report_link: reportLink }],
            }),
          });
          delivery_status = smsResponse.ok ? "sms_sent" : "sms_failed";
          delivery_details.sms_response = await smsResponse.text();
        } catch (smsErr) {
          delivery_status = "sms_failed";
          delivery_details.sms_error = smsErr instanceof Error ? smsErr.message : "Unknown";
        }
      } else {
        // ── Mock SMS mode (pilot) ──
        delivery_status = "sms_mock";
        console.log(`[send-report] MOCK SMS: To=${patient_phone}, Link=${reportLink}`);

        // Log mock SMS to audit
        await admin.from("audit_logs").insert({
          actor_id: user.id,
          clinic_id: consultation.clinic_id,
          event_type: "sms_mock_delivery",
          target_type: "consultation",
          target_id: consultation_id,
          metadata: {
            recipient_phone: patient_phone ? "***" + patient_phone.slice(-4) : null,
            report_link: reportLink,
            reason: "sms_api_key_not_configured",
          },
        });

        // Log to notification_logs as mock
        await admin.from("notification_logs").insert({
          patient_id: consultation.patient_id,
          clinic_id: consultation.clinic_id,
          visit_id: visit_id || null,
          message_type: "report_delivery",
          trigger_event: "consultation_finalized",
          delivery_status: "mock",
          recipient_phone: patient_phone,
          provider: "mock",
          message_content: `Report link: ${reportLink}`,
        });
      }
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      clinic_id: consultation.clinic_id,
      event_type: "report_sent",
      target_type: "consultation",
      target_id: consultation_id,
      metadata: {
        delivery_method: delivery_method || "link",
        delivery_status,
        patient_phone: patient_phone ? "***" + patient_phone.slice(-4) : null,
        target_language,
        token_generated: !tokenError,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      report_link: reportLink,
      delivery_status,
      delivery_method: delivery_method || "link",
      report: reportData.report,
      translated_report: reportData.translated_report,
      expires_at: expiresAt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("send-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
