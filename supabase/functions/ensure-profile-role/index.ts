import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_ADMIN_EMAILS = ["raviteja@elixair.uk", "raviteja.nvr@elixair.uk", "raviteja.nvr@gmail.com"];

/**
 * ensure-profile-role Edge Function
 *
 * Securely creates/updates profile and user_roles during Auth signup.
 * Prevents client-side role escalation.
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
    const { full_name, phone, email } = await req.json();

    const userEmail = email || user.email || "";
    const isPlatformAdmin = PLATFORM_ADMIN_EMAILS.includes(userEmail.trim().toLowerCase());

    // SECURITY: Never trust client-provided role. Default to 'patient'.
    // Only platform admin emails get elevated. All other role changes happen via admin actions.
    const assignedRole = isPlatformAdmin ? "platform_admin" : "patient";
    const assignedStatus = isPlatformAdmin ? "approved" : "pending";

    // Upsert role
    const { data: existingRole } = await admin.from("user_roles").select("id").eq("user_id", user.id).limit(1);
    if (!existingRole?.length) {
      await admin.from("user_roles").insert({ user_id: user.id, role: assignedRole });
    } else if (isPlatformAdmin) {
      await admin.from("user_roles").update({ role: assignedRole }).eq("user_id", user.id);
    }

    // Upsert profile
    const { data: existingProfile } = await admin.from("profiles").select("id").eq("user_id", user.id).limit(1);
    if (!existingProfile?.length) {
      await admin.from("profiles").insert({
        user_id: user.id,
        full_name: full_name || "",
        phone: phone || "",
        account_status: assignedStatus,
        email: userEmail,
      });
    } else {
      const updateData: Record<string, any> = {
        full_name: full_name || undefined,
        phone: phone || undefined,
      };
      if (isPlatformAdmin) updateData.account_status = "approved";
      await admin.from("profiles").update(updateData).eq("user_id", user.id);
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "user_registered",
      target_type: "profile",
      target_id: user.id,
      metadata: { role: assignedRole, is_platform_admin: isPlatformAdmin },
    });

    return new Response(JSON.stringify({
      success: true,
      role: assignedRole,
      status: assignedStatus,
      is_platform_admin: isPlatformAdmin,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ensure-profile-role error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
