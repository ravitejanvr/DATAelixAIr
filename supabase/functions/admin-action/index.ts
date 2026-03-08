import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * admin-action Edge Function
 * 
 * Handles platform admin operations:
 * - update_pilot_status: approve/reject pilot requests (auto-creates clinic on approve)
 * - suspend_clinic: suspend an active clinic
 * 
 * All actions require platform_admin role and write audit logs.
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

    // Verify platform_admin
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "platform_admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: platform_admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action_type, ...params } = await req.json();

    if (action_type === "update_pilot_status") {
      const { pilot_id, status } = params;
      if (!pilot_id || !status) {
        return new Response(JSON.stringify({ error: "pilot_id and status required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.from("pilot_requests").update({ status }).eq("id", pilot_id);
      if (error) throw new Error(`Pilot update failed: ${error.message}`);

      let clinic_id: string | null = null;
      if (status === "approved") {
        const { data: pilot } = await admin.from("pilot_requests").select("*").eq("id", pilot_id).single();
        if (pilot) {
          const { data: clinic, error: clinicErr } = await admin.from("clinics").insert({
            name: pilot.clinic_name,
            location: pilot.location,
            specialty: pilot.speciality,
            email: pilot.contact_email,
            phone: pilot.contact_phone || null,
            status: "active",
          }).select("id").single();
          if (!clinicErr && clinic) clinic_id = clinic.id;
        }
      }

      await admin.from("audit_logs").insert({
        actor_id: user.id,
        event_type: `pilot_${status}`,
        target_type: "pilot_request",
        target_id: pilot_id,
        metadata: { status, clinic_id },
      });

      return new Response(JSON.stringify({ success: true, action: `pilot_${status}`, pilot_id, clinic_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action_type === "suspend_clinic") {
      const { clinic_id } = params;
      if (!clinic_id) {
        return new Response(JSON.stringify({ error: "clinic_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await admin.from("clinics").update({ status: "suspended" }).eq("id", clinic_id);
      if (error) throw new Error(`Clinic suspension failed: ${error.message}`);

      await admin.from("audit_logs").insert({
        actor_id: user.id,
        event_type: "clinic_suspended",
        target_type: "clinic",
        target_id: clinic_id,
      });

      return new Response(JSON.stringify({ success: true, action: "clinic_suspended", clinic_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action_type" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("admin-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
