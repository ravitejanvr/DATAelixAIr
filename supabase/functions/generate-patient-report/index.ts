import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * generate-patient-report Edge Function
 * 
 * Builds a complete visit report payload:
 * 1. Fetches consultation, prescriptions, lab orders, invoice for a visit
 * 2. Optionally translates to a target language (hindi, telugu, urdu)
 * 3. Returns structured report data ready for PDF rendering
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

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { consultation_id, visit_id, target_language, bilingual } = await req.json();

    if (!consultation_id && !visit_id) {
      return new Response(JSON.stringify({ error: "consultation_id or visit_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch consultation ──
    let consultQuery = supabase.from("consultations").select("*");
    if (consultation_id) consultQuery = consultQuery.eq("id", consultation_id);
    else consultQuery = consultQuery.eq("visit_id", visit_id);
    
    const { data: consultation, error: consultError } = await consultQuery.maybeSingle();
    if (consultError || !consultation) {
      return new Response(JSON.stringify({ error: "Consultation not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch related data in parallel ──
    const vId = consultation.visit_id || visit_id;

    const [patientRes, prescriptionsRes, labOrdersRes, invoiceRes, clinicRes] = await Promise.all([
      supabase.from("patients").select("name, age, gender, phone, blood_group, date_of_birth, allergies, current_medications").eq("id", consultation.patient_id).single(),
      supabase.from("prescriptions").select("drug_name, dosage, frequency, duration, route, instructions").eq("consultation_id", consultation.id),
      vId ? supabase.from("lab_orders").select("test_name, priority, status, notes").eq("visit_id", vId) : Promise.resolve({ data: [], error: null }),
      vId ? supabase.from("invoices").select("total, status, payment_mode, consultation_fee, discount").eq("visit_id", vId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      consultation.clinic_id ? supabase.from("clinics").select("name, phone, email, location").eq("id", consultation.clinic_id).single() : Promise.resolve({ data: null, error: null }),
    ]);

    // ── Build report payload ──
    const report = {
      clinic: clinicRes.data || { name: "DATAelixAIr Clinic" },
      patient: patientRes.data || { name: "Unknown" },
      consultation: {
        date: consultation.created_at,
        chief_complaint: consultation.chief_complaint,
        visit_summary: consultation.soap_subjective,
        findings: consultation.soap_objective,
        diagnosis: consultation.soap_assessment,
        treatment_plan: consultation.soap_plan,
        confidence: consultation.confidence_score,
        follow_up_date: consultation.follow_up_date,
      },
      prescriptions: prescriptionsRes.data || [],
      lab_orders: labOrdersRes.data || [],
      invoice: invoiceRes.data || null,
      safety_flags: consultation.safety_flags || [],
      disclaimer: "AI-assisted clinical report. For reference only. Final clinical judgement rests with the treating physician.",
    };

    // ── Translation (optional) ──
    let translated_report: any = null;
    if (target_language && target_language !== "english") {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (apiKey) {
        const reportText = buildReportText(report);
        const langLabel = target_language.charAt(0).toUpperCase() + target_language.slice(1);

        const translateRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are a medical translator. Translate the following clinical report into ${langLabel}. Preserve medical terminology in English parentheses where appropriate. Keep formatting intact. Output ONLY the translated text.`,
              },
              { role: "user", content: reportText },
            ],
            temperature: 0.2,
          }),
        });

        if (translateRes.ok) {
          const translateData = await translateRes.json();
          translated_report = translateData.choices?.[0]?.message?.content || null;
        }
      }
    }

    // ── Audit ──
    supabase.from("audit_logs").insert({
      actor_id: user.id,
      clinic_id: consultation.clinic_id,
      event_type: "report_generated",
      target_type: "consultation",
      target_id: consultation.id,
      metadata: {
        target_language: target_language || "english",
        bilingual: !!bilingual,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      report,
      translated_report,
      bilingual: !!bilingual && !!translated_report,
      language: target_language || "english",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-patient-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildReportText(report: any): string {
  const lines: string[] = [];
  lines.push(`CLINICAL CONSULTATION REPORT`);
  lines.push(`Clinic: ${report.clinic?.name || ""}`);
  lines.push(`Patient: ${report.patient?.name || ""}`);
  lines.push(`Date: ${new Date(report.consultation?.date).toLocaleDateString()}`);
  lines.push(`---`);

  if (report.consultation?.chief_complaint) lines.push(`\nChief Complaint: ${report.consultation.chief_complaint}`);
  if (report.consultation?.visit_summary) lines.push(`\nVisit Summary:\n${report.consultation.visit_summary}`);
  if (report.consultation?.findings) lines.push(`\nFindings:\n${report.consultation.findings}`);
  if (report.consultation?.diagnosis) lines.push(`\nDiagnosis:\n${report.consultation.diagnosis}`);
  if (report.consultation?.treatment_plan) lines.push(`\nTreatment Plan:\n${report.consultation.treatment_plan}`);

  if (report.prescriptions?.length) {
    lines.push(`\nPrescriptions:`);
    report.prescriptions.forEach((rx: any) => {
      lines.push(`• ${rx.drug_name} — ${rx.dosage}, ${rx.frequency}${rx.duration ? `, for ${rx.duration}` : ""}`);
      if (rx.instructions) lines.push(`  Instructions: ${rx.instructions}`);
    });
  }

  if (report.lab_orders?.length) {
    lines.push(`\nLab Orders:`);
    report.lab_orders.forEach((l: any) => lines.push(`• ${l.test_name} (${l.priority})`));
  }

  if (report.consultation?.follow_up_date) lines.push(`\nFollow-up: ${report.consultation.follow_up_date}`);

  lines.push(`\n---`);
  lines.push(`⚕️ ${report.disclaimer}`);
  return lines.join("\n");
}
