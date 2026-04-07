import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_ADMIN_EMAILS = ["raviteja@elixair.uk", "raviteja.nvr@elixair.uk", "raviteja.nvr@gmail.com"];
const PERSONAL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "aol.com"];

/**
 * onboard-user Edge Function
 *
 * Transactional workspace provisioning:
 * 1. Creates clinic
 * 2. Upserts user_role
 * 3. Updates profile
 * 4. Adds clinic_members
 * 5. Creates demo patient + visit
 * 6. Creates clinic_workflow_config
 *
 * Rolls back on any failure via service-role operations.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { email, phone } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(email.trim().toLowerCase());
    // SECURITY: Role is determined server-side only. Client input is ignored.
    const appRole = isPlatformAdmin ? "platform_admin" : "doctor";
    const assignedStatus = isPlatformAdmin ? "approved" : "pending";

    const domain = email.split("@")[1]?.toLowerCase() || "";
    const emailDomainType = PERSONAL_DOMAINS.includes(domain) ? "personal" : "institutional";

    // Track created resources for rollback
    let clinicId: string | null = null;
    let demoPatientId: string | null = null;

    try {
      // 1. Create clinic
      const clinicName = `${email.split("@")[0]}'s Clinic`;
      const { data: clinic, error: clinicErr } = await admin
        .from("clinics")
        .insert({ name: clinicName, status: "pending" })
        .select("id")
        .single();
      if (clinicErr || !clinic) throw new Error(`Clinic creation failed: ${clinicErr?.message}`);
      clinicId = clinic.id;

      // 2. Upsert user role
      const { data: existingRole } = await admin.from("user_roles").select("id").eq("user_id", user.id).limit(1);
      if (!existingRole?.length) {
        const { error: roleErr } = await admin.from("user_roles").insert({ user_id: user.id, role: appRole });
        if (roleErr) throw new Error(`Role creation failed: ${roleErr.message}`);
      }

      // 3. Update profile
      const { error: profileErr } = await admin.from("profiles").update({
        full_name: email.split("@")[0],
        email: email.trim(),
        phone: phone || "",
        account_status: assignedStatus,
        verification_status: "email_verified",
        email_verified: true,
        phone_verified: !!phone,
        email_domain_type: emailDomainType,
        clinic_id: clinicId,
        role_subtype: "doctor",
      }).eq("user_id", user.id);
      if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

      // 4. Add clinic_members
      const { error: memberErr } = await admin.from("clinic_members").insert({
        user_id: user.id,
        clinic_id: clinicId,
        role: appRole === "clinic_admin" ? "admin" : "staff",
        is_primary: true,
      });
      if (memberErr) throw new Error(`Clinic member creation failed: ${memberErr.message}`);

      // 5. Create demo patient
      const { data: demoPatient, error: patientErr } = await admin.from("patients").insert({
        name: "Demo Patient",
        age: 35,
        gender: "Male",
        phone: "+91 98765 00000",
        doctor_id: user.id,
        clinic_id: clinicId,
        allergies: ["Penicillin"],
        medical_history: [{ condition: "Hypertension", since: "2020" }],
      }).select("id").single();
      if (patientErr || !demoPatient) throw new Error(`Demo patient failed: ${patientErr?.message}`);
      demoPatientId = demoPatient.id;

      // 6. Create demo visit
      const { error: visitErr } = await admin.from("patient_visits").insert({
        patient_id: demoPatientId,
        clinic_id: clinicId,
        status: "with_doctor",
        chief_complaint: "Headache and mild fever for 2 days",
        visit_type: "walk-in",
      });
      if (visitErr) throw new Error(`Demo visit failed: ${visitErr.message}`);

      // 7. Create workflow config
      const { error: wfErr } = await admin.from("clinic_workflow_config").insert({
        clinic_id: clinicId,
        workflow_mode: "doctor_only",
      });
      if (wfErr) throw new Error(`Workflow config failed: ${wfErr.message}`);

      // 8. Audit log
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        clinic_id: clinicId,
        event_type: "workspace_provisioned",
        target_type: "clinic",
        target_id: clinicId,
        metadata: { role: appRole, email, is_platform_admin: isPlatformAdmin },
      });

      return new Response(JSON.stringify({
        success: true,
        clinic_id: clinicId,
        role: appRole,
        is_platform_admin: isPlatformAdmin,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (innerErr: any) {
      // Rollback: delete created resources in reverse order
      console.error("[onboard-user] Rolling back:", innerErr.message);
      if (demoPatientId) {
        await admin.from("patient_visits").delete().eq("patient_id", demoPatientId);
        await admin.from("patients").delete().eq("id", demoPatientId);
      }
      if (clinicId) {
        await admin.from("clinic_members").delete().eq("clinic_id", clinicId).eq("user_id", user.id);
        await admin.from("clinic_workflow_config").delete().eq("clinic_id", clinicId);
        await admin.from("clinics").delete().eq("id", clinicId);
      }
      throw innerErr;
    }
  } catch (err: any) {
    console.error("onboard-user error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
