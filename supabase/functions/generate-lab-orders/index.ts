import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { consultation_id, diagnosis, symptoms, clinic_id, patient_age, patient_gender } = body;

    if (!diagnosis && !symptoms) {
      return new Response(JSON.stringify({ error: "diagnosis or symptoms required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch clinic lab catalog for available tests
    let catalogTests: any[] = [];
    if (clinic_id) {
      const { data: catalog } = await admin.from("lab_catalog")
        .select("test_name, test_code, category, price, external_lab_partner")
        .eq("clinic_id", clinic_id)
        .eq("is_active", true)
        .limit(100);
      if (catalog) catalogTests = catalog;
    }

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a clinical diagnostic test advisor for Indian healthcare. Suggest appropriate lab tests based on clinical presentation.

RULES:
- Only suggest tests commonly available in Indian clinical labs
- Prioritize tests by diagnostic relevance
- Include urgency/priority level
- Provide clinical reasoning for each test
- Maximum 8 tests per order
- Prefer tests from the clinic's available catalog when possible

Patient context:
- Age: ${patient_age || "unknown"}
- Gender: ${patient_gender || "unknown"}

Clinic lab catalog (prefer these):
${catalogTests.map(t => `- ${t.test_name} (${t.test_code || "no code"}) - ₹${t.price || 0}`).join("\n") || "No catalog configured - suggest standard tests"}`;

    const userPrompt = `Suggest diagnostic lab tests for:
Diagnosis: ${diagnosis || "Not specified"}
Symptoms: ${symptoms || "Not specified"}

Return test suggestions using the suggest_lab_orders tool.`;

    const aiResp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_lab_orders",
            description: "Return structured lab order suggestions",
            parameters: {
              type: "object",
              properties: {
                lab_orders: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      test_name: { type: "string" },
                      test_code: { type: "string" },
                      category: { type: "string" },
                      priority: { type: "string", enum: ["routine", "urgent", "stat"] },
                      reason: { type: "string" },
                    },
                    required: ["test_name", "priority", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["lab_orders"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_lab_orders" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    let labOrders: any[] = [];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      labOrders = parsed.lab_orders || [];
    }

    // Match with catalog prices
    labOrders = labOrders.map((lo: any) => {
      const catalogMatch = catalogTests.find(
        c => c.test_name.toLowerCase() === lo.test_name.toLowerCase() || c.test_code === lo.test_code
      );
      return {
        ...lo,
        price: catalogMatch?.price || null,
        external_lab_partner: catalogMatch?.external_lab_partner || null,
        in_catalog: !!catalogMatch,
      };
    });

    // Audit log
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "lab_orders_generated",
      target_type: "consultation",
      target_id: consultation_id || null,
      clinic_id: clinic_id || null,
      metadata: { count: labOrders.length, ai_generated: true },
    }).then(() => {});

    return new Response(JSON.stringify({
      lab_orders: labOrders,
      source: "ai_generated",
      status: "suggested",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
