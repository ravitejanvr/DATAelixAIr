import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function computeOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  let matches = 0;
  for (const item of setA) {
    if (setB.has(item)) matches++;
  }
  const union = new Set([...setA, ...setB]).size;
  return Math.round((matches / union) * 100);
}

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Only platform_admin or doctor roles
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("platform_admin") && !userRoles.includes("doctor")) {
      return new Response(JSON.stringify({ error: "Requires platform_admin or doctor role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patient_context } = await req.json();
    if (!patient_context) {
      return new Response(JSON.stringify({ error: "patient_context is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = patient_context;

    // Build a synthetic transcript from patient_context
    const transcriptParts = [];
    if (ctx.symptoms?.length) transcriptParts.push(`Patient presents with ${ctx.symptoms.join(", ")}.`);
    if (ctx.duration) transcriptParts.push(`Duration: ${ctx.duration}.`);
    if (ctx.vitals) {
      const v = ctx.vitals;
      if (v.temperature) transcriptParts.push(`Temperature ${v.temperature}°F.`);
      if (v.bp) transcriptParts.push(`Blood pressure ${v.bp}.`);
      if (v.pulse) transcriptParts.push(`Pulse ${v.pulse} bpm.`);
      if (v.spo2) transcriptParts.push(`SpO2 ${v.spo2}%.`);
    }
    if (ctx.allergies?.length) transcriptParts.push(`Allergies: ${ctx.allergies.join(", ")}.`);
    if (ctx.conditions?.length) transcriptParts.push(`Known conditions: ${ctx.conditions.join(", ")}.`);
    if (ctx.current_medications?.length) transcriptParts.push(`Current medications: ${ctx.current_medications.join(", ")}.`);
    transcriptParts.push(`${ctx.age || 35} year old ${ctx.gender || "patient"}.`);
    const syntheticTranscript = transcriptParts.join(" ");

    // Build clinical_context for legacy pipeline
    const bpParts = ctx.vitals?.bp?.split("/") || [];
    const clinicalContext = {
      chief_complaint: ctx.symptoms?.[0] || "",
      age: ctx.age,
      gender: ctx.gender,
      blood_pressure: ctx.vitals?.bp || "",
      pulse: ctx.vitals?.pulse || null,
      temperature: ctx.vitals?.temperature || null,
      oxygen_saturation: ctx.vitals?.spo2 || null,
      allergies: ctx.allergies || [],
      current_medications: ctx.current_medications || [],
      chronic_conditions: ctx.conditions || [],
    };

    // ══════════════════════════════════════
    // STEP 1: RUN LEGACY PIPELINE
    // ══════════════════════════════════════
    const legacyStart = Date.now();
    let legacyOutput: any = { diagnoses: [], labs: [], medications: [], error: null };

    try {
      const legacyUrl = `${supabaseUrl}/functions/v1/run-ai-pipeline`;
      const legacyResp = await fetch(legacyUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          transcript: syntheticTranscript,
          clinical_context: clinicalContext,
        }),
      });

      if (legacyResp.ok) {
        const data = await legacyResp.json();
        // Extract diagnoses from SOAP
        const diagSection = data.soap_sections?.["Provisional Diagnosis"] || "";
        legacyOutput.diagnoses = diagSection.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
        // Extract medications from Treatment Plan
        const planSection = data.soap_sections?.["Treatment Plan"] || "";
        legacyOutput.medications = planSection.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
        legacyOutput.soap_sections = data.soap_sections;
        legacyOutput.safety_results = data.safety_results;
        legacyOutput.extracted_data = data.extracted_data;
      } else {
        const errText = await legacyResp.text();
        legacyOutput.error = `Legacy pipeline failed: ${legacyResp.status} - ${errText}`;
      }
    } catch (e) {
      legacyOutput.error = `Legacy pipeline error: ${e instanceof Error ? e.message : "Unknown"}`;
    }
    legacyOutput.latency_ms = Date.now() - legacyStart;

    // ══════════════════════════════════════
    // STEP 2: RUN MODULAR PIPELINE
    // ══════════════════════════════════════
    const modularStart = Date.now();
    let modularOutput: any = { diagnoses: [], labs: [], medications: [], guidelines: [], safety_score: 0, error: null };

    try {
      // Stage A: Hypothesis Generation via AI
      const hypothesisResp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are a clinical reasoning engine. Given patient context, generate differential diagnoses, recommended lab tests, and medication suggestions. Return ONLY valid JSON with this exact structure:
{"diagnoses":["..."],"labs":["..."],"medications":["..."],"reasoning":"brief clinical reasoning"}`,
            },
            {
              role: "user",
              content: JSON.stringify(ctx),
            },
          ],
        }),
      });

      if (hypothesisResp.ok) {
        const hData = await hypothesisResp.json();
        const content = hData.choices?.[0]?.message?.content || "";
        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            modularOutput.diagnoses = parsed.diagnoses || [];
            modularOutput.labs = parsed.labs || [];
            modularOutput.medications = parsed.medications || [];
            modularOutput.reasoning = parsed.reasoning || "";
          }
        } catch {
          modularOutput.raw_response = content;
        }
      }

      // Stage B: Guideline Retrieval
      const symptoms = ctx.symptoms || [];
      const conditions = [...(ctx.conditions || []), ...modularOutput.diagnoses];
      const keywords = [...symptoms, ...conditions].map((s: string) => s.toLowerCase());

      if (keywords.length > 0) {
        const { data: guidelines } = await admin
          .from("guideline_registry")
          .select("title, organization, condition, recommendation_text, tier")
          .eq("is_active", true)
          .order("tier", { ascending: true })
          .limit(10);

        if (guidelines && guidelines.length > 0) {
          // Filter by keyword relevance
          const relevant = guidelines.filter((g: any) => {
            const gText = `${g.condition} ${g.title}`.toLowerCase();
            return keywords.some(k => gText.includes(k));
          });
          modularOutput.guidelines = relevant.length > 0 ? relevant : guidelines.slice(0, 3);
        }
      }

      // Stage C: Safety Score
      const safetyFlags: string[] = [];
      if (ctx.allergies?.length && modularOutput.medications?.length) {
        // Simple allergy-medication cross check
        for (const allergy of ctx.allergies) {
          for (const med of modularOutput.medications) {
            if (med.toLowerCase().includes(allergy.toLowerCase())) {
              safetyFlags.push(`Allergy conflict: ${allergy} vs ${med}`);
            }
          }
        }
      }
      // Check drug interactions from DB
      if (modularOutput.medications?.length >= 2) {
        const { data: interactions } = await admin
          .from("drug_interactions")
          .select("drug_a, drug_b, severity, interaction_description")
          .limit(50);

        if (interactions) {
          const meds = modularOutput.medications.map((m: string) => m.toLowerCase());
          for (const ix of interactions) {
            const a = ix.drug_a.toLowerCase();
            const b = ix.drug_b.toLowerCase();
            if (meds.some((m: string) => m.includes(a)) && meds.some((m: string) => m.includes(b))) {
              safetyFlags.push(`Interaction: ${ix.drug_a}+${ix.drug_b} (${ix.severity})`);
            }
          }
        }
      }
      modularOutput.safety_flags = safetyFlags;
      modularOutput.safety_score = safetyFlags.length === 0 ? 100 : Math.max(0, 100 - safetyFlags.length * 20);

    } catch (e) {
      modularOutput.error = `Modular pipeline error: ${e instanceof Error ? e.message : "Unknown"}`;
    }
    modularOutput.latency_ms = Date.now() - modularStart;

    // ══════════════════════════════════════
    // STEP 3: COMPARISON
    // ══════════════════════════════════════
    const comparison = {
      diagnosis_overlap: computeOverlap(legacyOutput.diagnoses, modularOutput.diagnoses),
      lab_overlap: computeOverlap(legacyOutput.labs || [], modularOutput.labs),
      medication_overlap: computeOverlap(legacyOutput.medications, modularOutput.medications),
      latency_difference_ms: legacyOutput.latency_ms - modularOutput.latency_ms,
      legacy_faster: legacyOutput.latency_ms < modularOutput.latency_ms,
    };

    // ══════════════════════════════════════
    // STEP 4: STORE TEST RESULTS
    // ══════════════════════════════════════
    await admin.from("ai_pipeline_tests").insert({
      patient_context: ctx,
      legacy_output: legacyOutput,
      modular_output: modularOutput,
      comparison_metrics: comparison,
      triggered_by: user.id,
    });

    // ══════════════════════════════════════
    // STEP 5: MONITORING EVENT
    // ══════════════════════════════════════
    await admin.from("monitoring_events").insert({
      event_type: "ai_pipeline_comparison",
      agent_name: "compare-ai-pipelines",
      duration_ms: legacyOutput.latency_ms + modularOutput.latency_ms,
      success: true,
      metadata: {
        user_id: user.id,
        comparison,
        legacy_latency: legacyOutput.latency_ms,
        modular_latency: modularOutput.latency_ms,
      },
    });

    return new Response(JSON.stringify({
      legacy_pipeline: {
        diagnoses: legacyOutput.diagnoses,
        labs: legacyOutput.labs || [],
        medications: legacyOutput.medications,
        latency_ms: legacyOutput.latency_ms,
        error: legacyOutput.error,
      },
      modular_pipeline: {
        diagnoses: modularOutput.diagnoses,
        labs: modularOutput.labs,
        medications: modularOutput.medications,
        guidelines: modularOutput.guidelines,
        safety_score: modularOutput.safety_score,
        safety_flags: modularOutput.safety_flags,
        reasoning: modularOutput.reasoning,
        latency_ms: modularOutput.latency_ms,
        error: modularOutput.error,
      },
      comparison,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("compare-ai-pipelines error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
