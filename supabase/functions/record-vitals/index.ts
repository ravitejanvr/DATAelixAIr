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
    const { patient_id, visit_id, vitals } = body;

    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!vitals || typeof vitals !== "object") return new Response(JSON.stringify({ error: "vitals object required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Get clinic_id from profile
    const { data: profile } = await admin.from("profiles").select("clinic_id").eq("user_id", user.id).maybeSingle();
    const clinic_id = profile?.clinic_id;
    if (!clinic_id) return new Response(JSON.stringify({ error: "No clinic associated" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Validate ranges
    const warnings: string[] = [];
    const parse = (v: any, type: "int" | "float") => {
      if (v === null || v === undefined || v === "") return null;
      const n = type === "int" ? parseInt(String(v)) : parseFloat(String(v));
      return isNaN(n) ? null : n;
    };

    const bp_systolic = parse(vitals.bp_systolic, "int");
    const bp_diastolic = parse(vitals.bp_diastolic, "int");
    const pulse = parse(vitals.pulse, "int");
    const temperature = parse(vitals.temperature, "float");
    const spo2 = parse(vitals.spo2, "int");
    const respiratory_rate = parse(vitals.respiratory_rate, "int");
    const weight_kg = parse(vitals.weight_kg, "float");
    const height_cm = parse(vitals.height_cm, "float");
    const blood_sugar = parse(vitals.blood_sugar, "float");

    // Range warnings (not blocking, informational)
    if (bp_systolic !== null && (bp_systolic < 50 || bp_systolic > 300)) warnings.push("BP systolic out of plausible range");
    if (bp_diastolic !== null && (bp_diastolic < 20 || bp_diastolic > 200)) warnings.push("BP diastolic out of plausible range");
    if (pulse !== null && (pulse < 20 || pulse > 250)) warnings.push("Pulse out of plausible range");
    if (temperature !== null && (temperature < 30 || temperature > 45)) warnings.push("Temperature out of plausible range");
    if (spo2 !== null && (spo2 < 50 || spo2 > 100)) warnings.push("SpO2 out of plausible range");
    if (weight_kg !== null && (weight_kg < 0.5 || weight_kg > 500)) warnings.push("Weight out of plausible range");
    if (height_cm !== null && (height_cm < 20 || height_cm > 300)) warnings.push("Height out of plausible range");

    const { data: vitalsRow, error: insertError } = await admin.from("vitals").insert({
      patient_id,
      clinic_id,
      recorded_by: user.id,
      visit_id: visit_id || null,
      bp_systolic, bp_diastolic, pulse, temperature, spo2,
      respiratory_rate, weight_kg, height_cm, blood_sugar,
      notes: vitals.notes?.substring(0, 1000) || null,
    }).select("id").single();

    if (insertError) throw new Error(insertError.message);

    // ── Clinical alerts for abnormal vitals ──
    const criticalAlerts: { title: string; message: string; severity: string }[] = [];
    if (bp_systolic !== null && (bp_systolic >= 180 || bp_systolic <= 70))
      criticalAlerts.push({ title: "Critical BP Systolic", message: `BP systolic: ${bp_systolic} mmHg`, severity: bp_systolic >= 180 ? "critical" : "warning" });
    if (bp_diastolic !== null && (bp_diastolic >= 120 || bp_diastolic <= 40))
      criticalAlerts.push({ title: "Critical BP Diastolic", message: `BP diastolic: ${bp_diastolic} mmHg`, severity: "critical" });
    if (pulse !== null && (pulse >= 150 || pulse <= 40))
      criticalAlerts.push({ title: "Abnormal Heart Rate", message: `Pulse: ${pulse} bpm`, severity: pulse >= 150 || pulse <= 40 ? "critical" : "warning" });
    if (spo2 !== null && spo2 < 90)
      criticalAlerts.push({ title: "Low SpO2", message: `SpO2: ${spo2}%`, severity: spo2 < 85 ? "critical" : "warning" });
    if (temperature !== null && (temperature >= 40 || temperature <= 34))
      criticalAlerts.push({ title: "Extreme Temperature", message: `Temperature: ${temperature}°C`, severity: "critical" });
    if (blood_sugar !== null && (blood_sugar >= 400 || blood_sugar <= 50))
      criticalAlerts.push({ title: "Critical Blood Sugar", message: `Blood sugar: ${blood_sugar} mg/dL`, severity: "critical" });

    // Find the assigned doctor for this patient
    const { data: patient } = await admin.from("patients").select("doctor_id").eq("id", patient_id).maybeSingle();
    const doctor_id = patient?.doctor_id || user.id;

    if (criticalAlerts.length > 0) {
      const alertInserts = criticalAlerts.map(a => ({
        clinic_id,
        patient_id,
        doctor_id,
        visit_id: visit_id || null,
        alert_type: "vitals_abnormal",
        category: "vitals",
        severity: a.severity,
        title: a.title,
        message: a.message,
        metadata: { vitals_id: vitalsRow.id, recorded_by: user.id },
      }));
      admin.from("clinical_alerts").insert(alertInserts).then(() => {});
    }

    // ── Auto-advance visit status: vitals/triage → with_doctor ──
    if (visit_id) {
      const { data: visit } = await admin.from("patient_visits").select("status").eq("id", visit_id).maybeSingle();
      if (visit && ["triage", "vitals"].includes(visit.status)) {
        await admin.from("patient_visits").update({ status: "with_doctor" }).eq("id", visit_id);
      }
    }

    // Audit log (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "vitals_recorded",
      target_type: "vitals",
      target_id: vitalsRow.id,
      clinic_id,
      metadata: { patient_id, warnings, clinical_alerts_count: criticalAlerts.length },
    }).then(() => {});

    return new Response(JSON.stringify({
      vitals_id: vitalsRow.id,
      warnings,
      clinical_alerts: criticalAlerts.length,
      visit_advanced: visit_id ? true : false,
      status: "saved",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
