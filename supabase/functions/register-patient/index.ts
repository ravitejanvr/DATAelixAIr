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
 * 3. Allows walk-ins without phone (generates TEMP placeholder)
 * 4. Returns patient_id and whether this is a returning patient
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

    // ── Phone handling: allow walk-ins without phone ──
    const hasPhone = phone && typeof phone === "string" && phone.trim().length >= 10;
    const effectivePhone = hasPhone
      ? phone.trim().slice(0, 15)
      : `TEMP-${clinic_id.slice(0, 8)}-${Date.now()}`;
    const phoneVerified = hasPhone;

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

    // ── Find a clinic doctor (REQUIRED) ──
    const { data: clinicDoctor } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("clinic_id", clinic_id)
      .limit(1);

    const assignedDoctorId = clinicDoctor?.[0]?.user_id;
    if (!assignedDoctorId) {
      return new Response(JSON.stringify({ error: "Clinic has no assigned doctors. Please contact clinic administration." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check for returning patient (phone OR name+age+clinic) ──
    let patientId: string;
    let isReturning = false;
    let possibleDuplicates: { id: string; name: string; phone: string }[] = [];

    const safeAllergies = Array.isArray(allergies) ? allergies.filter((a: any) => typeof a === "string").slice(0, 50) : [];
    const safeConditions = Array.isArray(conditions) ? conditions.filter((c: any) => typeof c === "string").slice(0, 50) : [];

    if (hasPhone) {
      const { data: existingPatients } = await supabase
        .from("patients")
        .select("id, doctor_id")
        .eq("phone", effectivePhone)
        .eq("clinic_id", clinic_id)
        .limit(1);

      if (existingPatients && existingPatients.length > 0) {
        patientId = existingPatients[0].id;
        isReturning = true;
        await supabase.from("patients").update({
          age: parsedAge,
          gender: gender.toLowerCase(),
          ...(safeAllergies.length > 0 ? { allergies: safeAllergies } : {}),
        }).eq("id", patientId);
      } else {
        // Check name+age+clinic duplicate before creating
        const { data: nameMatches } = await supabase
          .from("patients")
          .select("id, name, phone")
          .eq("clinic_id", clinic_id)
          .ilike("name", name.trim())
          .eq("age", parsedAge)
          .limit(5);

        if (nameMatches && nameMatches.length > 0) {
          possibleDuplicates = nameMatches.map((m: any) => ({ id: m.id, name: m.name, phone: m.phone || "" }));
        }

        const { data: newPatient, error: pErr } = await supabase
          .from("patients")
          .insert({
            name: name.trim().slice(0, 200),
            age: parsedAge,
            gender: gender.toLowerCase(),
            phone: effectivePhone,
            doctor_id: assignedDoctorId,
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
    } else {
      // Walk-in without phone — check name+age+clinic duplicate
      const { data: nameMatches } = await supabase
        .from("patients")
        .select("id, name, phone")
        .eq("clinic_id", clinic_id)
        .ilike("name", name.trim())
        .eq("age", parsedAge)
        .limit(5);

      if (nameMatches && nameMatches.length > 0) {
        possibleDuplicates = nameMatches.map((m: any) => ({ id: m.id, name: m.name, phone: m.phone || "" }));
      }

      const { data: newPatient, error: pErr } = await supabase
        .from("patients")
        .insert({
          name: name.trim().slice(0, 200),
          age: parsedAge,
          gender: gender.toLowerCase(),
          phone: effectivePhone,
          doctor_id: assignedDoctorId,
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

    // ── Audit log (use assignedDoctorId as system proxy for self-registered patients) ──
    supabase.from("audit_logs").insert({
      actor_id: assignedDoctorId,
      clinic_id,
      event_type: isReturning ? "returning_patient_detected" : "patient_created",
      target_type: "patient",
      target_id: patientId,
      metadata: {
        source: "qr_registration",
        is_returning: isReturning,
        phone_verified: phoneVerified,
        self_registered: true,
        possible_duplicates: possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
      },
    }).then(() => {});

    // ── Flag duplicates in risk_flags for admin review ──
    if (possibleDuplicates.length > 0) {
      supabase.from("risk_flags").insert({
        user_id: assignedDoctorId,
        flag_type: "duplicate_patient",
        severity: "low",
        description: `Possible duplicate patient: "${name.trim()}" age ${parsedAge} at clinic. Matches: ${possibleDuplicates.map(d => `${d.name} (${d.phone || "no phone"})`).join(", ")}`,
        metadata: { patient_id: patientId, duplicates: possibleDuplicates },
      }).then(() => {});
    }

    return new Response(JSON.stringify({
      patient_id: patientId,
      is_returning: isReturning,
      clinic_name: clinic.name,
      phone_verified: phoneVerified,
      possible_duplicates: possibleDuplicates.length > 0 ? possibleDuplicates : undefined,
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
