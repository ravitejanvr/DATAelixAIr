import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Verify caller is platform_admin
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "platform_admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: platform_admin required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, action, clinic_id, role } = await req.json();

    if (!target_user_id || !action || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "target_user_id and action (approve|reject) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve") {
      if (!clinic_id) {
        return new Response(JSON.stringify({ error: "clinic_id required for approval" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const { error: profileErr } = await admin
        .from("profiles")
        .update({ account_status: "approved", clinic_id })
        .eq("user_id", target_user_id);
      if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

      // Add to clinic_members
      const memberRole = role || "staff";
      await admin.from("clinic_members").upsert(
        { user_id: target_user_id, clinic_id, role: memberRole, is_primary: true },
        { onConflict: "user_id,clinic_id" }
      );

      // Audit log
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        event_type: "user_approved",
        target_type: "profile",
        target_id: target_user_id,
        metadata: { clinic_id, role: memberRole },
      });

      return new Response(JSON.stringify({ success: true, action: "approved", target_user_id, clinic_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Reject
      const { error: profileErr } = await admin
        .from("profiles")
        .update({ account_status: "rejected" })
        .eq("user_id", target_user_id);
      if (profileErr) throw new Error(`Profile update failed: ${profileErr.message}`);

      await admin.from("audit_logs").insert({
        actor_id: user.id,
        event_type: "user_rejected",
        target_type: "profile",
        target_id: target_user_id,
      });

      return new Response(JSON.stringify({ success: true, action: "rejected", target_user_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("approve-user error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
