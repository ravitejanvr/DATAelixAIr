import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Contraindication database (common high-risk pairs) ---
const CONTRAINDICATIONS: Array<{
  drug: string;
  condition: string;
  severity: "high" | "critical";
  message: string;
}> = [
  { drug: "metformin", condition: "renal failure", severity: "critical", message: "Metformin is contraindicated in renal failure — risk of lactic acidosis." },
  { drug: "metformin", condition: "ckd", severity: "critical", message: "Metformin is contraindicated in CKD — risk of lactic acidosis." },
  { drug: "ibuprofen", condition: "peptic ulcer", severity: "high", message: "NSAIDs contraindicated with peptic ulcer disease — GI bleeding risk." },
  { drug: "diclofenac", condition: "peptic ulcer", severity: "high", message: "NSAIDs contraindicated with peptic ulcer disease — GI bleeding risk." },
  { drug: "aspirin", condition: "peptic ulcer", severity: "high", message: "Aspirin contraindicated with peptic ulcer — GI bleeding risk." },
  { drug: "warfarin", condition: "pregnancy", severity: "critical", message: "Warfarin is teratogenic — contraindicated in pregnancy." },
  { drug: "ace inhibitor", condition: "pregnancy", severity: "critical", message: "ACE inhibitors are contraindicated in pregnancy — fetal toxicity." },
  { drug: "enalapril", condition: "pregnancy", severity: "critical", message: "Enalapril (ACE inhibitor) is contraindicated in pregnancy." },
  { drug: "ramipril", condition: "pregnancy", severity: "critical", message: "Ramipril (ACE inhibitor) is contraindicated in pregnancy." },
  { drug: "lisinopril", condition: "pregnancy", severity: "critical", message: "Lisinopril (ACE inhibitor) is contraindicated in pregnancy." },
  { drug: "atenolol", condition: "asthma", severity: "high", message: "Beta-blockers contraindicated in asthma — risk of bronchospasm." },
  { drug: "propranolol", condition: "asthma", severity: "high", message: "Propranolol contraindicated in asthma — risk of bronchospasm." },
  { drug: "metoprolol", condition: "asthma", severity: "high", message: "Beta-blockers use caution in asthma — risk of bronchospasm." },
  { drug: "ciprofloxacin", condition: "pregnancy", severity: "high", message: "Fluoroquinolones contraindicated in pregnancy — cartilage damage risk." },
  { drug: "statins", condition: "pregnancy", severity: "critical", message: "Statins contraindicated in pregnancy — teratogenic risk." },
  { drug: "atorvastatin", condition: "pregnancy", severity: "critical", message: "Atorvastatin contraindicated in pregnancy — teratogenic risk." },
  { drug: "lithium", condition: "renal failure", severity: "critical", message: "Lithium contraindicated in severe renal impairment — toxicity risk." },
  { drug: "spironolactone", condition: "hyperkalemia", severity: "critical", message: "Spironolactone contraindicated with hyperkalemia." },
];

function checkContraindications(
  medications: string[],
  conditions: string[]
): Array<{ alert_type: string; severity: string; drug: string; condition: string; message: string }> {
  const alerts: Array<{ alert_type: string; severity: string; drug: string; condition: string; message: string }> = [];
  const medsLower = medications.map(m => m.toLowerCase().trim());
  const condsLower = conditions.map(c => c.toLowerCase().trim());

  for (const contra of CONTRAINDICATIONS) {
    const drugMatch = medsLower.some(m => m.includes(contra.drug));
    const condMatch = condsLower.some(c => c.includes(contra.condition));
    if (drugMatch && condMatch) {
      alerts.push({
        alert_type: "contraindication",
        severity: contra.severity,
        drug: contra.drug,
        condition: contra.condition,
        message: contra.message,
      });
    }
  }
  return alerts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { visit_id, patient_context, suggested_treatments } = await req.json();
    if (!visit_id || !patient_context) {
      return new Response(
        JSON.stringify({ error: "visit_id and patient_context are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get visit
    const { data: visit } = await supabase
      .from("patient_visits")
      .select("clinic_id, patient_id")
      .eq("id", visit_id)
      .single();

    if (!visit) {
      return new Response(JSON.stringify({ error: "Visit not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase
      .rpc("is_clinic_member", { _user_id: user.id, _clinic_id: visit.clinic_id });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run existing clinical-safety function for drug interactions, allergies, dose checks
    const { data: safetyResult } = await supabase.functions.invoke("clinical-safety", {
      body: {
        medications: suggested_treatments?.drugs || patient_context.medications || [],
        allergies: patient_context.allergies || [],
        clinical_context: {
          patient_age: patient_context.age,
          patient_sex: patient_context.sex,
          chief_complaint: patient_context.chief_complaint,
          symptoms: patient_context.symptoms,
        },
        vitals: patient_context.vitals || {},
      },
    });

    const allAlerts: Array<{
      alert_type: string;
      severity: string;
      message: string;
      category: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // Map existing safety results to unified alert format
    if (safetyResult) {
      // Drug interactions
      for (const i of safetyResult.interactions || []) {
        allAlerts.push({
          alert_type: "drug_interaction",
          severity: i.severity === "severe" ? "critical" : i.severity,
          message: `${i.drug_a} ↔ ${i.drug_b}: ${i.description}`,
          category: "medication_safety",
          metadata: { drug_a: i.drug_a, drug_b: i.drug_b },
        });
      }

      // Allergy conflicts
      for (const a of safetyResult.allergy_flags || []) {
        allAlerts.push({
          alert_type: "allergy_conflict",
          severity: "critical",
          message: a.message,
          category: "medication_safety",
          metadata: { medication: a.medication, allergy: a.allergy },
        });
      }

      // Dose warnings
      for (const d of safetyResult.dose_warnings || []) {
        allAlerts.push({
          alert_type: "dose_limit",
          severity: d.issue === "high_dosage" ? "high" : "warning",
          message: d.message,
          category: "medication_safety",
          metadata: { medication: d.medication, issue: d.issue },
        });
      }

      // Vital dangers
      for (const v of safetyResult.vitals_dangers || []) {
        allAlerts.push({
          alert_type: "vital_danger",
          severity: v.severity,
          message: v.message,
          category: "vital_signs",
          metadata: { parameter: v.parameter, value: v.value, action_hint: v.action_hint },
        });
      }

      // Emergency patterns
      for (const e of safetyResult.emergency_patterns || []) {
        allAlerts.push({
          alert_type: "emergency_pattern",
          severity: e.severity,
          message: e.message,
          category: "clinical_risk",
          metadata: { pattern: e.pattern, matched_indicators: e.matched_indicators, action_hint: e.action_hint },
        });
      }
    }

    // Contraindication checks (new)
    const allMeds = [
      ...(suggested_treatments?.drugs || []),
      ...(patient_context.medications || []),
    ];
    const allConditions = [
      ...(patient_context.past_diagnoses || []),
      ...(patient_context.chief_complaint ? [patient_context.chief_complaint] : []),
    ];
    const contraAlerts = checkContraindications(allMeds, allConditions);
    for (const c of contraAlerts) {
      allAlerts.push({
        alert_type: "contraindication",
        severity: c.severity,
        message: c.message,
        category: "medication_safety",
        metadata: { drug: c.drug, condition: c.condition },
      });
    }

    // Determine if finalization should be blocked
    const hasCritical = allAlerts.some(a => a.severity === "critical");
    const hasHigh = allAlerts.some(a => a.severity === "high" || a.severity === "critical");

    // Persist alerts to respective tables
    for (const alert of allAlerts) {
      if (alert.category === "vital_signs") {
        await supabase.from("vital_alerts").insert({
          visit_id,
          patient_id: visit.patient_id,
          doctor_id: user.id,
          clinic_id: visit.clinic_id,
          parameter: (alert.metadata as any)?.parameter || "unknown",
          value: (alert.metadata as any)?.value || 0,
          severity: alert.severity,
          message: alert.message,
          action_hint: (alert.metadata as any)?.action_hint || null,
        });
      } else if (alert.alert_type === "drug_interaction" || alert.alert_type === "allergy_conflict" || alert.alert_type === "dose_limit" || alert.alert_type === "contraindication") {
        await supabase.from("medication_alerts").insert({
          clinic_id: visit.clinic_id,
          patient_id: visit.patient_id,
          doctor_id: user.id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          message: alert.message,
          drug_a: (alert.metadata as any)?.drug_a || (alert.metadata as any)?.drug || (alert.metadata as any)?.medication || null,
          drug_b: (alert.metadata as any)?.drug_b || null,
          allergy_conflict: (alert.metadata as any)?.allergy || null,
          dose_issue: (alert.metadata as any)?.issue || null,
          metadata: alert.metadata || {},
        });
      } else {
        await supabase.from("clinical_alerts").insert({
          clinic_id: visit.clinic_id,
          patient_id: visit.patient_id,
          doctor_id: user.id,
          visit_id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          category: alert.category,
          title: alert.alert_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          message: alert.message,
          action_hint: (alert.metadata as any)?.action_hint || null,
          matched_indicators: (alert.metadata as any)?.matched_indicators || [],
        });
      }
    }

    // Log to monitoring
    const duration_ms = Date.now() - start;
    await supabase.from("monitoring_events").insert({
      event_type: "guardrail_check",
      agent_name: "run-clinical-guardrails",
      clinic_id: visit.clinic_id,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        total_alerts: allAlerts.length,
        critical_count: allAlerts.filter(a => a.severity === "critical").length,
        high_count: allAlerts.filter(a => a.severity === "high").length,
        blocks_finalization: hasCritical,
      },
    });

    return new Response(JSON.stringify({
      alerts: allAlerts,
      summary: {
        total: allAlerts.length,
        critical: allAlerts.filter(a => a.severity === "critical").length,
        high: allAlerts.filter(a => a.severity === "high").length,
        warning: allAlerts.filter(a => a.severity === "warning").length,
      },
      blocks_finalization: hasCritical,
      requires_override: hasHigh,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("run-clinical-guardrails error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
