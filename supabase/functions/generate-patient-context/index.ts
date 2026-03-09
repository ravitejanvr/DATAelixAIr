import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify caller
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

    const { visit_id } = await req.json();
    if (!visit_id) {
      return new Response(JSON.stringify({ error: "visit_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch visit + patient
    const { data: visit, error: visitErr } = await supabase
      .from("patient_visits")
      .select("*, patients(*)")
      .eq("id", visit_id)
      .single();

    if (visitErr || !visit) {
      return new Response(JSON.stringify({ error: "Visit not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is clinic member
    const { data: membership } = await supabase
      .rpc("is_clinic_member", { _user_id: user.id, _clinic_id: visit.clinic_id });
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patient = visit.patients;

    // 2. Fetch vitals for this visit
    const { data: vitals } = await supabase
      .from("vitals")
      .select("*")
      .eq("visit_id", visit_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const latestVitals = vitals?.[0] ?? null;

    // 3. Fetch consultation if exists
    const { data: consultation } = await supabase
      .from("consultations")
      .select("chief_complaint, extracted_data, soap_subjective")
      .eq("visit_id", visit_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Fetch recent prescriptions for this patient
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("drug_name, dosage, frequency, duration")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // 5. Fetch recent lab results
    const { data: labResults } = await supabase
      .from("lab_results")
      .select("parameter_name, value, unit, reference_range, is_abnormal, reported_at")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build the context object
    const extracted = consultation?.extracted_data as Record<string, any> ?? {};

    const context = {
      patient_id: patient.id,
      age: patient.age,
      sex: patient.gender,
      chief_complaint: visit.chief_complaint || consultation?.chief_complaint || extracted?.chief_complaint || "",
      symptoms: extracted?.associated_symptoms || "",
      duration: extracted?.duration || "",
      vitals: latestVitals
        ? {
            bp_systolic: latestVitals.bp_systolic,
            bp_diastolic: latestVitals.bp_diastolic,
            pulse: latestVitals.pulse,
            temperature: latestVitals.temperature,
            spo2: latestVitals.spo2,
            respiratory_rate: latestVitals.respiratory_rate,
            weight_kg: latestVitals.weight_kg,
            height_cm: latestVitals.height_cm,
          }
        : null,
      past_diagnoses: Array.isArray(patient.medical_history)
        ? patient.medical_history.map((h: any) =>
            typeof h === "string" ? h : h?.condition ?? ""
          ).filter(Boolean)
        : [],
      medications: [
        ...(patient.current_medications || []),
        ...(prescriptions || []).map((p: any) => `${p.drug_name} ${p.dosage}`),
      ],
      allergies: patient.allergies || [],
      lab_results: (labResults || []).map((lr: any) => ({
        parameter: lr.parameter_name,
        value: lr.value,
        unit: lr.unit,
        reference_range: lr.reference_range,
        is_abnormal: lr.is_abnormal,
        reported_at: lr.reported_at,
      })),
      lifestyle_factors: patient.lifestyle_factors ?? {},
    };

    // 6. Store snapshot
    const { error: snapErr } = await supabase
      .from("patient_context_snapshots")
      .insert({
        visit_id,
        context_json: context,
      });

    if (snapErr) {
      console.error("Failed to save context snapshot:", snapErr);
    }

    // 7. Log to monitoring_events
    const duration_ms = Date.now() - start;
    await supabase.from("monitoring_events").insert({
      event_type: "context_engine_run",
      agent_name: "generate-patient-context",
      clinic_id: visit.clinic_id,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        patient_id: patient.id,
        fields_populated: Object.entries(context).filter(
          ([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
        ).length,
      },
    });

    return new Response(JSON.stringify({ context }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-patient-context error:", err);

    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
