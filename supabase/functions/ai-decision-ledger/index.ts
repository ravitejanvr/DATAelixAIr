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

    const { action, visit_id, entries, ledger_id, doctor_action, override_reason } = await req.json();

    // --- ACTION: record ---
    // Record one or more AI decision ledger entries
    if (action === "record") {
      if (!visit_id || !entries || !Array.isArray(entries) || entries.length === 0) {
        return new Response(
          JSON.stringify({ error: "visit_id and entries[] are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: visit } = await supabase
        .from("patient_visits")
        .select("clinic_id")
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

      const rows = entries.map((e: any) => ({
        visit_id,
        doctor_id: user.id,
        clinic_id: visit.clinic_id,
        consultation_id: e.consultation_id || null,
        ai_output: e.ai_output,
        ai_output_type: e.ai_output_type || "suggestion",
        guideline_source: e.guideline_source || null,
        evidence_reference: e.evidence_reference || null,
        model_version: e.model_version || null,
        confidence: e.confidence ?? null,
        safety_status: e.safety_status || "safe",
        doctor_action: e.doctor_action || "pending",
        override_reason: e.override_reason || null,
        metadata: e.metadata || {},
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from("ai_decision_ledger")
        .insert(rows)
        .select("id");

      if (insertErr) {
        console.error("Ledger insert error:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to record decisions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Log to monitoring
      await supabase.from("monitoring_events").insert({
        event_type: "ai_decision_recorded",
        agent_name: "ai-decision-ledger",
        clinic_id: visit.clinic_id,
        success: true,
        metadata: { visit_id, entries_recorded: rows.length },
      });

      return new Response(JSON.stringify({ recorded: inserted?.length || 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ACTION: trace ---
    // Get full AI decision trace for a visit
    if (action === "trace") {
      if (!visit_id) {
        return new Response(
          JSON.stringify({ error: "visit_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify access: doctor or platform admin
      const { data: visit } = await supabase
        .from("patient_visits")
        .select("clinic_id")
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
      const { data: isAdmin } = await supabase
        .rpc("has_role", { _user_id: user.id, _role: "platform_admin" });

      if (!isMember && !isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ledger, error: queryErr } = await supabase
        .from("ai_decision_ledger")
        .select("*")
        .eq("visit_id", visit_id)
        .order("created_at", { ascending: true });

      if (queryErr) {
        return new Response(JSON.stringify({ error: "Query failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const summary = {
        total_decisions: ledger?.length || 0,
        accepted: ledger?.filter((l: any) => l.doctor_action === "accepted").length || 0,
        rejected: ledger?.filter((l: any) => l.doctor_action === "rejected").length || 0,
        modified: ledger?.filter((l: any) => l.doctor_action === "modified").length || 0,
        pending: ledger?.filter((l: any) => l.doctor_action === "pending").length || 0,
        overridden: ledger?.filter((l: any) => l.doctor_action === "overridden").length || 0,
        safety_flags: ledger?.filter((l: any) => l.safety_status !== "safe").length || 0,
      };

      return new Response(JSON.stringify({ trace: ledger || [], summary }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- ACTION: update ---
    // Update doctor_action on a ledger entry
    if (action === "update") {
      if (!ledger_id || !doctor_action) {
        return new Response(
          JSON.stringify({ error: "ledger_id and doctor_action are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validActions = ["accepted", "rejected", "modified", "overridden"];
      if (!validActions.includes(doctor_action)) {
        return new Response(
          JSON.stringify({ error: `doctor_action must be one of: ${validActions.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateErr } = await supabase
        .from("ai_decision_ledger")
        .update({
          doctor_action,
          override_reason: override_reason || null,
        })
        .eq("id", ledger_id)
        .eq("doctor_id", user.id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: "Update failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ updated: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: record, trace, update" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-decision-ledger error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
