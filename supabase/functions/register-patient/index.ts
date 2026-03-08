import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * register-patient Edge Function
 * 
 * Handles patient registration for QR walk-ins and admin intake:
 * 1. Detects returning patients by phone + clinic_id
 * 2. Creates or updates patient record
 * 3. Returns patient_id and whether this is a returning patient
 * 
 * Public endpoint (no JWT required) for QR self-intake
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { name, age, gender, phone, clinic_id, allergies, conditions } = body;

    // ── Validation ──
    if (!clinic_id) {
      return new Response(JSON.stringify({ error: "clinic_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Name must be at least 2 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phone || typeof phone !== "string" || phone.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Valid phone number is required (10+ digits)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedAge = parseInt(age);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
      return new Response(JSON.stringify({ error: "Valid age is required (0-150)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!gender || !["male", "female", "other"].includes(gender.toLowerCase())) {
      return new Response(JSON.stringify({ error: "Gender must be male, female, or other" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Verify clinic exists ──
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(JSON.stringify({ error: "Invalid clinic" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check for returning patient ──
    const { data: existingPatients } = await supabase
      .from("patients")
      .select("id, doctor_id")
      .eq("phone", phone.trim())
      .eq("clinic_id", clinic_id)
      .limit(1);

    let patientId: string;
    let doctorId: string;
    let isReturning = false;

    const safeAllergies = Array.isArray(allergies) ? allergies.filter((a: any) => typeof a === "string").slice(0, 50) : [];
    const safeConditions = Array.isArray(conditions) ? conditions.filter((c: any) => typeof c === "string").slice(0, 50) : [];

    if (existingPatients && existingPatients.length > 0) {
      // Returning patient — update demographics
      patientId = existingPatients[0].id;
      doctorId = existingPatients[0].doctor_id;
      isReturning = true;

      await supabase.from("patients").update({
        age: parsedAge,
        gender: gender.toLowerCase(),
        ...(safeAllergies.length > 0 ? { allergies: safeAllergies } : {}),
      }).eq("id", patientId);
    } else {
      // New patient — find a clinic doctor for the required doctor_id
      const { data: clinicDoctor } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("clinic_id", clinic_id)
        .limit(1);

      doctorId = clinicDoctor?.[0]?.user_id || clinic_id;

      const { data: newPatient, error: pErr } = await supabase
        .from("patients")
        .insert({
          name: name.trim().slice(0, 200),
          age: parsedAge,
          gender: gender.toLowerCase(),
          phone: phone.trim().slice(0, 15),
          doctor_id: doctorId,
          clinic_id,
          allergies: safeAllergies,
          medical_history: safeConditions.length > 0
            ? safeConditions.map((c: string) => ({ condition: c }))
            : [],
        })
        .select("id")
        .single();

      if (pErr) throw new Error(`Patient creation failed: ${pErr.message}`);
      patientId = newPatient.id;
    }

    // ── Audit log ──
    supabase.from("audit_logs").insert({
      actor_id: doctorId,
      clinic_id,
      event_type: isReturning ? "returning_patient_detected" : "patient_created",
      target_type: "patient",
      target_id: patientId,
      metadata: { source: "qr_registration", is_returning: isReturning },
    }).then(() => {});

    return new Response(JSON.stringify({
      patient_id: patientId,
      is_returning: isReturning,
      clinic_name: clinic.name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("register-patient error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
