import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Step 1: Run the innovation agent with summary generation
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const agentResponse = await fetch(`${supabaseUrl}/functions/v1/product-innovation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ generate_summary: true }),
    });

    const agentResult = await agentResponse.json();

    if (!agentResult.success) {
      throw new Error(agentResult.error || "Innovation agent failed");
    }

    // Step 2: Fetch recent pending insights for the digest
    const { data: recentInsights } = await sb
      .from("innovation_insights")
      .select("title, priority, category, evidence_source, suggested_improvement, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    // Step 3: Generate formatted email digest
    const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const criticalCount = (recentInsights || []).filter((i: any) => i.priority === "critical").length;
    const highCount = (recentInsights || []).filter((i: any) => i.priority === "high").length;

    const digestHtml = `
      <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #00608F 0%, #004A6E 100%); padding: 24px 32px;">
          <h1 style="color: #ffffff; font-size: 20px; margin: 0;">🧠 DATAelixAIr Innovation Digest</h1>
          <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 6px 0 0;">${today}</p>
        </div>
        
        <div style="padding: 24px 32px;">
          <div style="display: flex; gap: 16px; margin-bottom: 20px;">
            <div style="background: #FEF3C7; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #92400E; margin: 0;">${agentResult.insights_generated || 0}</p>
              <p style="font-size: 10px; color: #92400E; margin: 4px 0 0;">New Insights</p>
            </div>
            <div style="background: #FEE2E2; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #991B1B; margin: 0;">${criticalCount}</p>
              <p style="font-size: 10px; color: #991B1B; margin: 4px 0 0;">Critical</p>
            </div>
            <div style="background: #DBEAFE; border-radius: 8px; padding: 12px 16px; flex: 1; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #1E40AF; margin: 0;">${Object.values(agentResult.sources || {}).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0)}</p>
              <p style="font-size: 10px; color: #1E40AF; margin: 4px 0 0;">Sources Scanned</p>
            </div>
          </div>

          ${agentResult.daily_summary ? `
          <div style="background: #F0F9FF; border-left: 3px solid #00608F; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
            <p style="font-size: 11px; font-weight: 600; color: #00608F; margin: 0 0 8px; text-transform: uppercase;">AI Summary</p>
            <div style="font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${agentResult.daily_summary}</div>
          </div>
          ` : ""}

          <h2 style="font-size: 14px; color: #1E293B; margin: 0 0 12px;">Pending Review</h2>
          ${(recentInsights || []).slice(0, 6).map((i: any) => `
            <div style="border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="background: ${i.priority === 'critical' ? '#FEE2E2' : i.priority === 'high' ? '#FEF3C7' : '#E0E7FF'}; color: ${i.priority === 'critical' ? '#991B1B' : i.priority === 'high' ? '#92400E' : '#3730A3'}; font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${i.priority.toUpperCase()}</span>
                <span style="font-size: 9px; color: #64748B;">${i.evidence_source}</span>
              </div>
              <p style="font-size: 13px; font-weight: 600; color: #1E293B; margin: 0 0 4px;">${i.title}</p>
              <p style="font-size: 11px; color: #64748B; margin: 0;">${i.suggested_improvement}</p>
            </div>
          `).join("")}

          <div style="margin-top: 24px; text-align: center;">
            <p style="font-size: 10px; color: #94A3B8;">Sources: PubMed · Europe PMC · FDA FAERS · WHO · NHS AI Lab</p>
            <p style="font-size: 9px; color: #CBD5E1; margin-top: 8px;">DATAelixAIr™ Product Innovation Intelligence</p>
          </div>
        </div>
      </div>
    `;

    // Log the digest generation
    await sb.from("audit_logs").insert({
      actor_id: "00000000-0000-0000-0000-000000000000",
      event_type: "daily_innovation_digest",
      target_type: "innovation_insights",
      metadata: {
        insights_generated: agentResult.insights_generated,
        sources: agentResult.sources,
        critical_count: criticalCount,
        high_count: highCount,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      insights_generated: agentResult.insights_generated,
      insights_saved: agentResult.insights_saved,
      sources: agentResult.sources,
      daily_summary: agentResult.daily_summary,
      digest_html: digestHtml,
      pending_count: (recentInsights || []).length,
      critical_count: criticalCount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("daily-innovation-summary error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
