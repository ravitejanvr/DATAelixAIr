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
    const { consultation_id, diagnosis, symptoms, doctor_id, clinic_id, patient_allergies, current_medications, patient_age, patient_gender } = body;

    if (!diagnosis && !symptoms) {
      return new Response(JSON.stringify({ error: "diagnosis or symptoms required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch doctor favorites
    let favorites: any[] = [];
    const { data: favData } = await admin.from("doctor_favorites")
      .select("generic_name, default_dose, frequency, duration, instructions, route")
      .eq("doctor_id", doctor_id || user.id)
      .limit(20);
    if (favData) favorites = favData;

    // Fetch clinic templates
    let templates: any[] = [];
    if (clinic_id) {
      const { data: settingsData } = await admin.from("clinic_settings")
        .select("default_prescription_templates, doctor_templates")
        .eq("clinic_id", clinic_id)
        .maybeSingle();
      if (settingsData) {
        templates = [
          ...(Array.isArray(settingsData.default_prescription_templates) ? settingsData.default_prescription_templates : []),
          ...(Array.isArray(settingsData.doctor_templates) ? settingsData.doctor_templates : []),
        ];
      }
    }

    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a clinical prescription assistant for Indian healthcare. Generate evidence-based medication recommendations.

RULES:
- Only suggest commonly available medications in India
- Include generic names, standard dosages, frequencies, durations
- Flag any potential interactions with patient's current medications or allergies
- Be conservative - suggest standard first-line treatments
- Maximum 5 medications per prescription

Patient context:
- Age: ${patient_age || "unknown"}
- Gender: ${patient_gender || "unknown"}
- Allergies: ${patient_allergies?.join(", ") || "none reported"}
- Current medications: ${current_medications?.join(", ") || "none reported"}

Doctor's favorite medications (prefer these when clinically appropriate):
${favorites.map(f => `- ${f.generic_name} ${f.default_dose || ""} ${f.frequency || ""}`).join("\n") || "None configured"}

Clinic templates available:
${templates.map((t: any) => `- ${t.drug_name || t.name || JSON.stringify(t)}`).join("\n") || "None configured"}`;

    const userPrompt = `Generate a prescription for:
Diagnosis: ${diagnosis || "Not specified"}
Symptoms: ${symptoms || "Not specified"}

Return prescriptions using the suggest_prescriptions tool.`;

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
            name: "suggest_prescriptions",
            description: "Return structured prescription suggestions",
            parameters: {
              type: "object",
              properties: {
                prescriptions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      drug_name: { type: "string" },
                      dosage: { type: "string" },
                      frequency: { type: "string", enum: ["OD", "BD", "TID", "QID", "SOS", "HS", "STAT"] },
                      duration: { type: "string" },
                      route: { type: "string", enum: ["oral", "topical", "injectable", "inhaled", "sublingual"] },
                      instructions: { type: "string" },
                      warnings: { type: "string" },
                    },
                    required: ["drug_name", "dosage", "frequency", "duration"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["prescriptions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest_prescriptions" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    let prescriptions: any[] = [];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      prescriptions = parsed.prescriptions || [];
    }

    // Run safety check on generated prescriptions
    const medications = prescriptions.map((p: any) => `${p.drug_name} ${p.dosage}`);
    const safetyResp = await fetch(`${supabaseUrl}/functions/v1/clinical-safety`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
      body: JSON.stringify({
        medications,
        allergies: patient_allergies || [],
        symptoms: symptoms?.split(",").map((s: string) => s.trim()) || [],
        vitals: {},
      }),
    });
    let safetyWarnings: any = null;
    if (safetyResp.ok) {
      safetyWarnings = await safetyResp.json();
    }

    // Audit log
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "prescription_generated",
      target_type: "consultation",
      target_id: consultation_id || null,
      clinic_id: clinic_id || null,
      metadata: { count: prescriptions.length, ai_generated: true },
    }).then(() => {});

    return new Response(JSON.stringify({
      prescriptions,
      safety_warnings: safetyWarnings,
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
