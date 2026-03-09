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

  const start = Date.now();

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

    // Verify caller
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

    const { patient_context, visit_id } = await req.json();
    if (!patient_context || !visit_id) {
      return new Response(
        JSON.stringify({ error: "patient_context and visit_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify clinic membership
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

    // Validate minimum context
    if (!patient_context.chief_complaint) {
      return new Response(
        JSON.stringify({ error: "chief_complaint is required for hypothesis generation" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI to generate hypotheses
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a clinical reasoning assistant. Given patient context, generate a ranked list of differential diagnoses.

RULES:
- Output ONLY valid JSON array, no markdown, no explanation.
- Each item: { "diagnosis": string, "confidence": number (0-1), "supporting_factors": string[], "contradicting_factors": string[], "recommended_tests": string[] }
- Maximum 6 diagnoses, ordered by confidence descending.
- Base confidence on symptom-diagnosis correlation, age/sex epidemiology, and vitals.
- Be conservative. If data is insufficient, reflect lower confidence.
- NEVER state a definitive diagnosis. These are hypotheses for clinician review.
- Include at least one "must-not-miss" dangerous diagnosis if clinically relevant.`;

    const userPrompt = `Patient Context:
- Age: ${patient_context.age ?? "unknown"}
- Sex: ${patient_context.sex ?? "unknown"}
- Chief Complaint: ${patient_context.chief_complaint}
- Symptoms: ${patient_context.symptoms || "not specified"}
- Duration: ${patient_context.duration || "not specified"}
- Vitals: ${patient_context.vitals ? JSON.stringify(patient_context.vitals) : "not recorded"}
- Past Diagnoses: ${(patient_context.past_diagnoses || []).join(", ") || "none"}
- Medications: ${(patient_context.medications || []).join(", ") || "none"}
- Allergies: ${(patient_context.allergies || []).join(", ") || "none"}
- Lab Results: ${(patient_context.lab_results || []).map((l: any) => `${l.parameter}: ${l.value} ${l.unit || ""}`).join(", ") || "none"}

Generate differential diagnoses as JSON array.`;

    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      return new Response(JSON.stringify({ error: "AI reasoning failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "[]";

    // Parse JSON from AI response (strip markdown fences if present)
    let hypotheses: any[];
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      hypotheses = JSON.parse(cleaned);
      if (!Array.isArray(hypotheses)) hypotheses = [];
    } catch {
      console.error("Failed to parse AI hypotheses:", rawContent);
      hypotheses = [];
    }

    // Store each hypothesis row
    for (const h of hypotheses) {
      await supabase.from("diagnostic_hypotheses").insert({
        visit_id,
        hypothesis: { diagnosis: h.diagnosis, supporting_factors: h.supporting_factors || [], contradicting_factors: h.contradicting_factors || [], recommended_tests: h.recommended_tests || [] },
        confidence_score: Math.min(1, Math.max(0, h.confidence || 0)),
        evidence_sources: h.supporting_factors || [],
      });
    }

    // Log to monitoring
    const duration_ms = Date.now() - start;
    await supabase.from("monitoring_events").insert({
      event_type: "hypothesis_generated",
      agent_name: "generate-hypotheses",
      clinic_id: visit.clinic_id,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        hypothesis_count: hypotheses.length,
        top_diagnosis: hypotheses[0]?.diagnosis || null,
        top_confidence: hypotheses[0]?.confidence || null,
      },
    });

    return new Response(JSON.stringify({ hypotheses }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-hypotheses error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
