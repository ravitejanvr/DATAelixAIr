import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { chief_complaint, duration, symptoms, vitals, age, gender, allergies, medications, conditions, clinical_context } = await req.json();

    if (!chief_complaint) {
      return new Response(JSON.stringify({ error: "chief_complaint is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const clinicalContextBlock = clinical_context
      ? `\n\nFull clinical context (demographics, vitals, history):\n${JSON.stringify(clinical_context, null, 2)}`
      : "";

    const systemPrompt = `You are a clinical decision-support assistant for Indian private clinics. Given structured patient context, return JSON suggestions to help doctors during consultations.

RULES:
- Suggestions are recommendations for clinician review, NOT directives
- Include only commonly-used, evidence-based options
- Medications must include generic names, standard Indian-market doses
- Lab tests should be relevant to the presenting complaint
- Documentation shortcuts should be natural clinical English sentences
- Consider patient age, gender, allergies, and existing conditions from clinical context
- Flag if any suggested medication conflicts with known allergies (set allergy_conflict: true)
- Return 3-5 items per category maximum

CONSERVATIVE OUTPUT POLICY:
- ALL suggestions MUST use cautious language: "consider", "possible", "requires clinical evaluation", "may benefit from"
- NEVER use definitive language like "prescribe", "diagnose", or "must take"
- Each recommendation MUST include a brief evidence reference (e.g., "per WHO guidelines", "per PubMed evidence", "per OpenFDA", "per standard clinical practice")
- All outputs are labeled: "AI-assisted suggestions for clinician review"

Return ONLY valid JSON with this exact structure:
{
  "prescriptions": [
    { "drug_name": "string", "dose": "string", "frequency": "string", "duration": "string", "rationale": "string", "evidence_source": "string", "allergy_conflict": false }
  ],
  "lab_tests": [
    { "test_name": "string", "rationale": "string", "priority": "routine|urgent", "evidence_source": "string" }
  ],
  "documentation_shortcuts": [
    { "text": "string", "category": "subjective|objective|plan|advice" }
  ],
  "disclaimer": "AI-assisted suggestions for clinician review. All recommendations require clinical evaluation before implementation."
}`;

    const userPrompt = `Patient context:
- Chief complaint: ${chief_complaint}
- Duration: ${duration || "not specified"}
- Symptoms: ${symptoms || "not specified"}
- Age: ${age || clinical_context?.patient_age || "unknown"}, Gender: ${gender || clinical_context?.patient_sex || "unknown"}
- Known allergies: ${allergies || clinical_context?.allergies?.join(", ") || "none reported"}
- Current medications: ${medications || clinical_context?.current_medications?.join(", ") || "none"}
- Chronic conditions: ${conditions || "none"}
- Vitals: ${vitals || "not recorded"}${clinicalContextBlock}

Generate clinical smart suggestions with conservative language and evidence references.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    let suggestions;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      suggestions = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      suggestions = { prescriptions: [], lab_tests: [], documentation_shortcuts: [] };
    }

    // Enforce disclaimer
    suggestions.disclaimer = suggestions.disclaimer || "AI-assisted suggestions for clinician review. All recommendations require clinical evaluation before implementation.";

    return new Response(JSON.stringify({
      suggestions,
      output_policy: {
        label: "AI Draft — Clinician Review Required",
        conservative_language: true,
        evidence_required: true,
      },
      model: "gemini-3-flash-preview",
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("smart-suggestions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
