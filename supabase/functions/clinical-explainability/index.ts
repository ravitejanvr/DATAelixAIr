import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Clinical Explainability Engine
 * 
 * Generates SHAP-style factor attribution for each diagnosis.
 * Shows which clinical factors contributed positively or negatively
 * to each diagnostic conclusion, making AI reasoning transparent.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const {
      diagnoses = [],
      symptoms = [],
      vitals = {},
      medical_history = [],
      current_medications = [],
      allergies = [],
      lab_results = [],
      risk_factors = [],
      patient_age,
      patient_sex,
      chief_complaint = "",
      paradigm_scores = {},
      guideline_sources = [],
    } = body;

    if (diagnoses.length === 0) {
      return new Response(JSON.stringify({ explanations: [], message: "No diagnoses to explain" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startMs = Date.now();

    // ══════════════════════════════════════════════════════
    // STAGE 1: Deterministic factor extraction
    // Build evidence factors from structured clinical data
    // ══════════════════════════════════════════════════════

    // Resolve symptom → diagnosis relationships from knowledge graph
    const symptomList = [...new Set([...symptoms, ...(chief_complaint ? [chief_complaint] : [])])];
    let graphFactors: Record<string, any[]> = {};

    if (symptomList.length > 0) {
      const { data: symptomRows } = await sb
        .from("symptoms")
        .select("id, symptom_name")
        .or(symptomList.map(s => `symptom_name.ilike.%${s.replace(/'/g, "''")}%`).join(","));

      if (symptomRows && symptomRows.length > 0) {
        const symptomIds = symptomRows.map(s => s.id);

        // Get diagnosis mappings with confidence
        const { data: maps } = await sb
          .from("symptom_diagnosis_map")
          .select("symptom_id, diagnosis_id, confidence, diagnoses(diagnosis_name)")
          .in("symptom_id", symptomIds);

        if (maps) {
          for (const m of maps) {
            const diagName = ((m as any).diagnoses?.diagnosis_name || "").toLowerCase();
            if (!graphFactors[diagName]) graphFactors[diagName] = [];
            const symptomName = symptomRows.find(s => s.id === m.symptom_id)?.symptom_name || "";
            graphFactors[diagName].push({
              factor: symptomName,
              type: "symptom",
              direction: "positive",
              weight: m.confidence || 0.5,
              source: "knowledge_graph",
            });
          }
        }
      }
    }

    // Build vital factors
    const vitalFactors: any[] = [];
    if (vitals.temperature != null) {
      const temp = parseFloat(vitals.temperature);
      if (temp >= 38.5) vitalFactors.push({ factor: `Fever (${temp}°C)`, type: "vital", direction: "positive", weight: 0.7, source: "vitals" });
      else if (temp < 36) vitalFactors.push({ factor: `Hypothermia (${temp}°C)`, type: "vital", direction: "positive", weight: 0.5, source: "vitals" });
    }
    if (vitals.spo2 != null) {
      const spo2 = parseFloat(vitals.spo2);
      if (spo2 < 94) vitalFactors.push({ factor: `Low SpO2 (${spo2}%)`, type: "vital", direction: "positive", weight: 0.8, source: "vitals" });
    }
    if (vitals.pulse != null) {
      const pulse = parseFloat(vitals.pulse);
      if (pulse > 100) vitalFactors.push({ factor: `Tachycardia (${pulse} bpm)`, type: "vital", direction: "positive", weight: 0.6, source: "vitals" });
      if (pulse < 60) vitalFactors.push({ factor: `Bradycardia (${pulse} bpm)`, type: "vital", direction: "positive", weight: 0.5, source: "vitals" });
    }
    const bpSys = vitals.bp_systolic || (vitals.bp ? parseInt(vitals.bp) : null);
    if (bpSys != null) {
      if (bpSys >= 180) vitalFactors.push({ factor: `Hypertensive crisis (${bpSys} mmHg)`, type: "vital", direction: "positive", weight: 0.9, source: "vitals" });
      else if (bpSys < 90) vitalFactors.push({ factor: `Hypotension (${bpSys} mmHg)`, type: "vital", direction: "positive", weight: 0.8, source: "vitals" });
    }

    // Build history/risk factors
    const historyFactors = medical_history.map((h: string) => ({
      factor: h, type: "history", direction: "contextual", weight: 0.4, source: "patient_history",
    }));
    const riskFactorItems = risk_factors.map((r: string) => ({
      factor: r, type: "risk_factor", direction: "positive", weight: 0.5, source: "risk_assessment",
    }));

    // ══════════════════════════════════════════════════════
    // STAGE 2: Neural explanation generation
    // LLM generates SHAP-style attribution per diagnosis
    // ══════════════════════════════════════════════════════

    const diagList = diagnoses.slice(0, 5).map((d: any) => {
      const name = d.diagnosis_name || d.diagnosis || "";
      const prob = d.fused_probability || d.probability || d.confidence || 0;
      const graphSymptoms = graphFactors[name.toLowerCase()] || [];
      return `${name} (${prob}%): Graph symptoms: ${graphSymptoms.map((f: any) => f.factor).join(", ") || "none"}`;
    }).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a clinical explainability engine. For each diagnosis, generate SHAP-style factor attribution showing which clinical evidence supports or contradicts it. Each factor has a direction (positive=supports, negative=contradicts, neutral=contextual) and a normalized weight (0.0-1.0). Be precise, use only data provided.`,
          },
          {
            role: "user",
            content: `Patient: ${patient_age || "?"} yo ${patient_sex || "?"}
Chief complaint: ${chief_complaint}
Symptoms: ${symptomList.join(", ")}
Vitals: temp=${vitals.temperature || "?"}°C, SpO2=${vitals.spo2 || "?"}%, pulse=${vitals.pulse || "?"}, BP=${vitals.bp || vitals.bp_systolic || "?"}
Medical history: ${medical_history.join(", ") || "none"}
Medications: ${current_medications.join(", ") || "none"}
Allergies: ${allergies.join(", ") || "NKDA"}
Lab results: ${lab_results.length > 0 ? JSON.stringify(lab_results) : "none"}
Risk factors: ${risk_factors.join(", ") || "none"}
Guidelines matched: ${guideline_sources.join(", ") || "none"}

Diagnoses to explain:
${diagList}

For each diagnosis, identify the top evidence factors (positive and negative) with weights.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "explain_diagnoses",
            description: "Generate SHAP-style factor attribution for clinical diagnoses",
            parameters: {
              type: "object",
              properties: {
                explanations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      diagnosis: { type: "string" },
                      summary: { type: "string", description: "1-2 sentence plain language explanation" },
                      factors: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            factor: { type: "string", description: "The clinical finding or data point" },
                            type: { type: "string", enum: ["symptom", "vital", "lab", "history", "risk_factor", "medication", "guideline", "absence"] },
                            direction: { type: "string", enum: ["positive", "negative", "neutral"] },
                            weight: { type: "number", description: "Normalized importance 0.0-1.0" },
                          },
                          required: ["factor", "type", "direction", "weight"],
                          additionalProperties: false,
                        },
                      },
                      confidence_rationale: { type: "string", description: "Why confidence is at this level" },
                    },
                    required: ["diagnosis", "summary", "factors", "confidence_rationale"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["explanations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "explain_diagnoses" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) throw new Error("Rate limit exceeded");
      if (response.status === 402) throw new Error("AI credits required");
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("No structured output");

    const parsed = JSON.parse(toolCall.function.arguments);
    const neuralExplanations = parsed.explanations || [];

    // ══════════════════════════════════════════════════════
    // STAGE 3: Merge deterministic + neural factors
    // ══════════════════════════════════════════════════════
    const explanations = neuralExplanations.map((ne: any) => {
      const diagLower = (ne.diagnosis || "").toLowerCase();

      // Get deterministic graph factors for this diagnosis
      const deterministicFactors = [
        ...(graphFactors[diagLower] || []),
        ...vitalFactors,
        ...historyFactors.filter((h: any) => {
          // Only include relevant history
          const factorLower = h.factor.toLowerCase();
          return ne.factors?.some((f: any) => f.factor.toLowerCase().includes(factorLower));
        }),
        ...riskFactorItems,
      ];

      // Merge: neural factors take precedence, add any deterministic-only factors
      const allFactors = [...(ne.factors || [])];
      for (const df of deterministicFactors) {
        const alreadyPresent = allFactors.some(
          (f: any) => f.factor.toLowerCase().includes(df.factor.toLowerCase()) ||
                      df.factor.toLowerCase().includes(f.factor.toLowerCase())
        );
        if (!alreadyPresent) {
          allFactors.push({
            ...df,
            source: df.source || "deterministic",
          });
        }
      }

      // Sort by absolute weight (most impactful first)
      allFactors.sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0));

      return {
        diagnosis: ne.diagnosis,
        summary: ne.summary,
        factors: allFactors.slice(0, 10), // Top 10 factors
        confidence_rationale: ne.confidence_rationale,
        factor_counts: {
          positive: allFactors.filter((f: any) => f.direction === "positive").length,
          negative: allFactors.filter((f: any) => f.direction === "negative").length,
          neutral: allFactors.filter((f: any) => f.direction === "neutral").length,
        },
      };
    });

    const durationMs = Date.now() - startMs;

    // Log to monitoring
    try {
      await sb.from("monitoring_events").insert({
        event_type: "explainability_generated",
        agent_name: "clinical-explainability",
        duration_ms: durationMs,
        success: true,
        metadata: {
          diagnoses_explained: explanations.length,
          total_factors: explanations.reduce((s: number, e: any) => s + e.factors.length, 0),
        },
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      explanations,
      duration_ms: durationMs,
      disclaimer: "Factor attribution is approximate. Clinical judgment required.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("clinical-explainability error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
