import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Structured field with value, source, and confidence.
 */
interface ContextField<T = unknown> {
  value: T;
  source: string;
  confidence: number;
}

function field<T>(value: T, source: string, confidence = 1.0): ContextField<T> {
  return { value, source, confidence };
}

function fieldOrNull<T>(value: T | null | undefined, source: string, confidence = 1.0): ContextField<T | null> {
  if (value === null || value === undefined) return { value: null, source, confidence: 0 };
  return { value, source, confidence };
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

    // Verify clinic membership
    const { data: membership } = await supabase.rpc("is_clinic_member", {
      _user_id: user.id,
      _clinic_id: visit.clinic_id,
    });
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patient = visit.patients;

    // 2. Parallel data fetches
    const [vitalsRes, consultationRes, prescriptionsRes, labResultsRes, triageRes] = await Promise.all([
      supabase.from("vitals").select("*").eq("visit_id", visit_id).order("created_at", { ascending: false }).limit(1),
      supabase.from("consultations").select("chief_complaint, extracted_data, soap_subjective").eq("visit_id", visit_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("prescriptions").select("drug_name, dosage, frequency, duration, generic_name").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("lab_results").select("parameter_name, value, unit, reference_range, is_abnormal, reported_at").eq("patient_id", patient.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("patient_visits").select("triage_level, triage_notes").eq("id", visit_id).single(),
    ]);

    const latestVitals = vitalsRes.data?.[0] ?? null;
    const consultation = consultationRes.data;
    const prescriptions = prescriptionsRes.data ?? [];
    const labResults = labResultsRes.data ?? [];
    const triage = triageRes.data;
    const extracted = (consultation?.extracted_data as Record<string, unknown>) ?? {};

    const evidenceSources: Array<{ field: string; source: string }> = [];
    const missingFields: string[] = [];

    // ── Patient Profile ──
    const patientProfile = {
      patient_id: field(patient.id, "patients"),
      age: fieldOrNull(patient.age, "patients"),
      sex: fieldOrNull(patient.gender, "patients"),
      weight: fieldOrNull(latestVitals?.weight_kg, "vitals"),
      pregnancy_status: fieldOrNull(null, "not_collected", 0),
      risk_factors: field(
        Array.isArray(patient.medical_history)
          ? (patient.medical_history as Array<{ condition?: string }>)
              .filter((h) => typeof h === "object" && h?.condition)
              .map((h) => h.condition!)
          : [],
        "patients.medical_history"
      ),
      family_history: fieldOrNull(null, "not_collected", 0),
    };

    if (!patient.age) missingFields.push("patient_profile.age");
    if (!patient.gender) missingFields.push("patient_profile.sex");

    // ── Episode Context ──
    const chiefComplaint =
      visit.chief_complaint || consultation?.chief_complaint || (extracted?.chief_complaint as string) || "";
    const episodeContext = {
      chief_complaint: field(chiefComplaint, chiefComplaint === visit.chief_complaint ? "patient_visits" : "consultations"),
      symptoms: fieldOrNull(extracted?.associated_symptoms as string | null, "extracted_data"),
      symptom_duration: fieldOrNull((extracted?.duration as string) || null, "extracted_data"),
      associated_symptoms: fieldOrNull(extracted?.associated_symptoms as string | null, "extracted_data"),
      severity: fieldOrNull(triage?.triage_level || null, "triage"),
      onset_type: fieldOrNull(null, "not_collected", 0),
    };

    if (!chiefComplaint) missingFields.push("episode_context.chief_complaint");

    // ── Medical History ──
    const allergyList = patient.allergies || [];
    const medList = [
      ...(patient.current_medications || []),
      ...prescriptions.map((p: Record<string, string>) => p.generic_name || p.drug_name),
    ].filter(Boolean);

    const medHistory = {
      past_conditions: field(
        Array.isArray(patient.medical_history)
          ? (patient.medical_history as Array<string | { condition?: string }>).map((h) =>
              typeof h === "string" ? h : h?.condition ?? ""
            ).filter(Boolean)
          : [],
        "patients.medical_history"
      ),
      current_medications: field(medList, "patients+prescriptions"),
      drug_allergies: field(allergyList, "patients.allergies"),
      previous_antibiotics: field(
        prescriptions
          .filter((p: Record<string, string>) => {
            const name = (p.generic_name || p.drug_name || "").toLowerCase();
            return ["amoxicillin", "azithromycin", "ciprofloxacin", "cephalexin", "doxycycline", "metronidazole", "levofloxacin", "cefixime"].some(
              (ab) => name.includes(ab)
            );
          })
          .map((p: Record<string, string>) => p.generic_name || p.drug_name),
        "prescriptions"
      ),
      vaccination_history: fieldOrNull(null, "not_collected", 0),
    };

    // ── Clinical Observations ──
    const clinicalObservations = {
      vitals: latestVitals
        ? field(
            {
              bp_systolic: latestVitals.bp_systolic,
              bp_diastolic: latestVitals.bp_diastolic,
              pulse: latestVitals.pulse,
              temperature: latestVitals.temperature,
              spo2: latestVitals.spo2,
              respiratory_rate: latestVitals.respiratory_rate,
              weight_kg: latestVitals.weight_kg,
              height_cm: latestVitals.height_cm,
            },
            "vitals"
          )
        : fieldOrNull(null, "vitals", 0),
      recent_labs: field(
        labResults.map((lr: Record<string, unknown>) => ({
          parameter: lr.parameter_name,
          value: lr.value,
          unit: lr.unit,
          reference_range: lr.reference_range,
          is_abnormal: lr.is_abnormal,
          reported_at: lr.reported_at,
        })),
        "lab_results"
      ),
      uploaded_reports: fieldOrNull(null, "not_implemented", 0),
    };

    if (!latestVitals) missingFields.push("clinical_observations.vitals");

    // ── Derived Context ──
    const riskFlags: string[] = [];
    if (latestVitals) {
      if (latestVitals.temperature && latestVitals.temperature >= 39) riskFlags.push("high_fever");
      if (latestVitals.spo2 && latestVitals.spo2 < 92) riskFlags.push("hypoxia");
      if (latestVitals.bp_systolic && latestVitals.bp_systolic >= 180) riskFlags.push("hypertensive_crisis");
      if (latestVitals.pulse && latestVitals.pulse > 120) riskFlags.push("tachycardia");
    }

    // Calculate fields populated
    const totalFields = 18;
    const populated = totalFields - missingFields.length;
    const contextConfidence = populated / totalFields;

    const derivedContext = {
      risk_flags: field(riskFlags, "computed"),
      missing_information: field(missingFields, "computed"),
      context_confidence: field(contextConfidence, "computed"),
      evidence_sources: field(evidenceSources, "computed"),
    };

    // ── Determine version ──
    const { data: existingVersions } = await supabase
      .from("clinical_context_objects")
      .select("version")
      .eq("visit_id", visit_id)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = (existingVersions?.[0]?.version ?? 0) + 1;

    // ── Store CCO ──
    const ccoRow = {
      visit_id,
      patient_id: patient.id,
      clinic_id: visit.clinic_id,
      version: nextVersion,
      patient_profile: patientProfile,
      episode_context: episodeContext,
      medical_history: medHistory,
      clinical_observations: clinicalObservations,
      derived_context: derivedContext,
      context_confidence: contextConfidence,
      fields_populated: populated,
      total_fields: totalFields,
      missing_fields: missingFields,
      evidence_sources: evidenceSources,
      status: "active",
      built_by: user.id,
    };

    const { data: savedCCO, error: insertErr } = await supabase
      .from("clinical_context_objects")
      .insert(ccoRow)
      .select("id, version")
      .single();

    if (insertErr) {
      console.error("Failed to save CCO:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save context object" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Also write legacy snapshot for backward compat ──
    await supabase.from("patient_context_snapshots").insert({
      visit_id,
      context_json: {
        patient_id: patient.id,
        age: patient.age,
        sex: patient.gender,
        chief_complaint: chiefComplaint,
        symptoms: extracted?.associated_symptoms || "",
        duration: extracted?.duration || "",
        vitals: clinicalObservations.vitals?.value ?? null,
        past_diagnoses: medHistory.past_conditions.value,
        medications: medList,
        allergies: allergyList,
        lab_results: clinicalObservations.recent_labs.value,
        lifestyle_factors: patient.lifestyle_factors ?? {},
      },
    });

    // ── Log monitoring event ──
    const duration_ms = Date.now() - start;
    await supabase.from("monitoring_events").insert({
      event_type: "cco_build",
      agent_name: "build-clinical-context",
      clinic_id: visit.clinic_id,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        patient_id: patient.id,
        cco_id: savedCCO.id,
        version: nextVersion,
        fields_populated: populated,
        total_fields: totalFields,
        confidence: contextConfidence,
        risk_flags: riskFlags,
        missing: missingFields,
      },
    });

    return new Response(
      JSON.stringify({
        cco_id: savedCCO.id,
        version: nextVersion,
        context_confidence: contextConfidence,
        fields_populated: populated,
        total_fields: totalFields,
        missing_fields: missingFields,
        risk_flags: riskFlags,
        patient_profile: patientProfile,
        episode_context: episodeContext,
        medical_history: medHistory,
        clinical_observations: clinicalObservations,
        derived_context: derivedContext,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("build-clinical-context error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
