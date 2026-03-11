import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Meta Reasoning Orchestrator
 *
 * Coordinates a multi-agent system for clinical reasoning:
 *   1. Determines which agents to invoke based on input completeness
 *   2. Schedules parallel execution where safe
 *   3. Aggregates results into a unified clinical output
 *   4. Supports per-agent model selection
 *
 * Agent Graph (dependency order):
 *   intake_agent ──┐
 *   context_agent ─┤
 *                  ├─→ ddx_agent ──┐
 *                                  ├─→ knowledge_agent ─┐
 *                                  ├─→ safety_agent ────┤
 *                                  ├─→ guideline_agent ─┤
 *                                                       └─→ documentation_agent
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Agent Registry with default models ──
const AGENT_DEFAULTS: Record<string, { model: string; temperature: number; timeout_ms: number }> = {
  intake_agent:     { model: "google/gemini-3-flash-preview", temperature: 0.1, timeout_ms: 4000 },
  context_agent:    { model: "google/gemini-3-flash-preview", temperature: 0.1, timeout_ms: 3000 },
  ddx_agent:        { model: "google/gemini-3-flash-preview", temperature: 0.2, timeout_ms: 5000 },
  knowledge_agent:  { model: "google/gemini-2.5-flash",       temperature: 0.1, timeout_ms: 5000 },
  safety_agent:     { model: "google/gemini-3-flash-preview", temperature: 0.0, timeout_ms: 4000 },
  guideline_agent:  { model: "google/gemini-2.5-flash",       temperature: 0.1, timeout_ms: 5000 },
  documentation_agent: { model: "google/gemini-3-flash-preview", temperature: 0.2, timeout_ms: 6000 },
};

interface AgentResult {
  agent: string;
  status: "success" | "error" | "skipped" | "timeout";
  data: any;
  latency_ms: number;
  model_used: string;
}

interface OrchestratorInput {
  transcript?: string;
  stabilized_transcript?: string;
  clinical_context?: any;
  intake_data?: any;
  patient_id?: string;
  visit_id?: string;
  clinic_id?: string;
  model_overrides?: Record<string, string>;
  skip_agents?: string[];
}

// ── Helper: call AI gateway ──
async function callAI(
  apiKey: string,
  model: string,
  temperature: number,
  systemPrompt: string,
  userPrompt: string,
  tools?: any[],
  toolChoice?: any,
): Promise<any> {
  const body: any = {
    model,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const status = resp.status;
    if (status === 429) throw new Error("rate_limit");
    if (status === 402) throw new Error("payment_required");
    throw new Error(`ai_error_${status}`);
  }
  return resp.json();
}

// ── Helper: race with timeout ──
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// ── Agent: Intake ──
async function runIntakeAgent(
  apiKey: string, input: OrchestratorInput, model: string, temp: number
): Promise<any> {
  if (!input.transcript && !input.stabilized_transcript) return { skipped: true, reason: "no_transcript" };

  const transcript = input.stabilized_transcript || input.transcript || "";
  const result = await callAI(apiKey, model, temp,
    `You are a clinical intake extraction agent. Extract structured intake data from the transcript. Extract ONLY explicitly stated facts. Never infer.`,
    transcript,
    [{
      type: "function",
      function: {
        name: "extract_intake",
        description: "Extract structured intake data",
        parameters: {
          type: "object",
          properties: {
            chief_complaint: { type: "string" },
            duration: { type: "string" },
            associated_symptoms: { type: "array", items: { type: "string" } },
            vitals_mentioned: { type: "string" },
            chronic_conditions: { type: "array", items: { type: "string" } },
            current_medications: { type: "array", items: { type: "string" } },
            allergies: { type: "array", items: { type: "string" } },
            pain_score: { type: "number" },
            pregnancy_status: { type: "string" },
          },
          required: ["chief_complaint"],
          additionalProperties: false,
        },
      },
    }],
    { type: "function", function: { name: "extract_intake" } },
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  return { chief_complaint: "" };
}

// ── Agent: Context ──
async function runContextAgent(
  admin: any, input: OrchestratorInput
): Promise<any> {
  // Pure DB assembly — no AI
  const context: any = {
    patient: null,
    recent_vitals: null,
    visit_history_count: 0,
    intake_data: input.intake_data || null,
  };

  if (input.patient_id) {
    const { data: patient } = await admin.from("patients").select("*").eq("id", input.patient_id).maybeSingle();
    if (patient) {
      context.patient = {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        allergies: patient.allergies || [],
        current_medications: patient.current_medications || [],
        chronic_conditions: patient.chronic_conditions || [],
      };
    }

    const { count } = await admin.from("patient_visits").select("id", { count: "exact", head: true }).eq("patient_id", input.patient_id);
    context.visit_history_count = count || 0;
  }

  if (input.visit_id) {
    const { data: vitals } = await admin.from("patient_visits").select("vitals_data").eq("id", input.visit_id).maybeSingle();
    context.recent_vitals = vitals?.vitals_data || null;
  }

  return context;
}

// ── Agent: DDX ──
async function runDDXAgent(
  apiKey: string, intakeData: any, contextData: any, model: string, temp: number
): Promise<any> {
  const symptoms: string[] = [];
  if (intakeData?.chief_complaint) symptoms.push(intakeData.chief_complaint);
  if (intakeData?.associated_symptoms) symptoms.push(...intakeData.associated_symptoms);

  const prompt = `Patient context:
- Symptoms: ${symptoms.join(", ") || "unknown"}
- Chronic conditions: ${contextData?.patient?.chronic_conditions?.join(", ") || "none"}
- Medications: ${contextData?.patient?.current_medications?.join(", ") || "none"}
- Allergies: ${contextData?.patient?.allergies?.join(", ") || "none"}
- Age: ${contextData?.patient?.age || "unknown"}
- Gender: ${contextData?.patient?.gender || "unknown"}

Generate a differential diagnosis list ranked by probability.`;

  const result = await callAI(apiKey, model, temp,
    `You are a differential diagnosis agent. Rank diagnoses by probability. Include must-not-miss diagnoses even if low probability. Be conservative.`,
    prompt,
    [{
      type: "function",
      function: {
        name: "generate_ddx",
        description: "Generate ranked differential diagnoses",
        parameters: {
          type: "object",
          properties: {
            differential_diagnoses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  diagnosis: { type: "string" },
                  probability: { type: "number" },
                  supporting_evidence: { type: "array", items: { type: "string" } },
                  must_not_miss: { type: "boolean" },
                  recommended_tests: { type: "array", items: { type: "string" } },
                },
                required: ["diagnosis", "probability", "supporting_evidence", "must_not_miss"],
                additionalProperties: false,
              },
            },
            reasoning_summary: { type: "string" },
          },
          required: ["differential_diagnoses", "reasoning_summary"],
          additionalProperties: false,
        },
      },
    }],
    { type: "function", function: { name: "generate_ddx" } },
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
  return { differential_diagnoses: [], reasoning_summary: "" };
}

// ── Agent: Knowledge Retrieval ──
async function runKnowledgeAgent(
  apiKey: string, ddxData: any, model: string, temp: number
): Promise<any> {
  const topDiagnoses = (ddxData?.differential_diagnoses || []).slice(0, 3).map((d: any) => d.diagnosis);
  if (topDiagnoses.length === 0) return { evidence: [], sources_consulted: 0 };

  const result = await callAI(apiKey, model, temp,
    `You are a medical knowledge retrieval agent. For each diagnosis, provide evidence-based treatment recommendations, key clinical references, and recommended investigations. Cite guideline sources (WHO, NICE, ICMR, IDSA, AHA, ESC, ADA) where applicable.`,
    `Retrieve clinical evidence for these diagnoses: ${topDiagnoses.join(", ")}`,
    [{
      type: "function",
      function: {
        name: "retrieve_evidence",
        description: "Retrieve clinical evidence for diagnoses",
        parameters: {
          type: "object",
          properties: {
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  diagnosis: { type: "string" },
                  treatment_options: { type: "array", items: { type: "string" } },
                  recommended_tests: { type: "array", items: { type: "string" } },
                  guideline_sources: { type: "array", items: { type: "string" } },
                  evidence_grade: { type: "string" },
                },
                required: ["diagnosis", "treatment_options", "recommended_tests"],
                additionalProperties: false,
              },
            },
            sources_consulted: { type: "number" },
          },
          required: ["evidence", "sources_consulted"],
          additionalProperties: false,
        },
      },
    }],
    { type: "function", function: { name: "retrieve_evidence" } },
  );

  const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
  return { evidence: [], sources_consulted: 0 };
}

// ── Agent: Medication Safety ──
async function runSafetyAgent(
  supabaseUrl: string, authHeader: string, anonKey: string,
  intakeData: any, contextData: any, clinicalContext: any,
): Promise<any> {
  // Delegate to existing clinical-safety edge function
  const meds = [
    ...(contextData?.patient?.current_medications || []),
    ...(intakeData?.current_medications || []),
  ];
  const allergies = [
    ...(contextData?.patient?.allergies || []),
    ...(intakeData?.allergies || []),
  ];
  const symptoms = [intakeData?.chief_complaint, ...(intakeData?.associated_symptoms || [])].filter(Boolean);

  const vitals: Record<string, any> = {};
  if (clinicalContext?.blood_pressure) {
    const parts = clinicalContext.blood_pressure.split("/");
    vitals.bp_systolic = parseInt(parts[0]) || null;
    vitals.bp_diastolic = parseInt(parts[1]) || null;
  }
  vitals.pulse = clinicalContext?.pulse || null;
  vitals.temperature = clinicalContext?.temperature || null;
  vitals.spo2 = clinicalContext?.oxygen_saturation || null;

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/clinical-safety`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({ medications: [...new Set(meds)], allergies: [...new Set(allergies)], vitals, symptoms }),
    });
    if (resp.ok) return resp.json();
  } catch (e) {
    console.error("Safety agent error:", e);
  }
  return { interaction_flags: [], allergy_flags: [], dose_warnings: [], vitals_dangers: [], emergency_patterns: [] };
}

// ── Agent: Guideline Compliance ──
async function runGuidelineAgent(
  supabaseUrl: string, authHeader: string, anonKey: string,
  ddxData: any, knowledgeData: any,
): Promise<any> {
  const topDiagnosis = ddxData?.differential_diagnoses?.[0]?.diagnosis;
  if (!topDiagnosis) return { compliance_score: 0, citations: [], conflicts: [] };

  const treatments = knowledgeData?.evidence?.[0]?.treatment_options || [];
  const tests = knowledgeData?.evidence?.[0]?.recommended_tests || [];

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/guideline-compliance`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        diagnosis: topDiagnosis,
        drugs: treatments,
        labs: tests,
      }),
    });
    if (resp.ok) return resp.json();
  } catch (e) {
    console.error("Guideline agent error:", e);
  }
  return { compliance_score: 0, citations: [], conflicts: [] };
}

// ── Agent: Documentation ──
async function runDocumentationAgent(
  supabaseUrl: string, authHeader: string, anonKey: string,
  transcript: string, intakeData: any, safetyData: any, clinicalContext: any,
): Promise<any> {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/clinical-soap`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        transcript,
        extractedData: { ...intakeData, safety_results: safetyData },
        clinical_context: clinicalContext,
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.sections || {};
    }
  } catch (e) {
    console.error("Documentation agent error:", e);
  }
  return {};
}

// ═══════════════════════════════════════
// MAIN ORCHESTRATOR
// ═══════════════════════════════════════

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

    // Validate clinical role
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!["doctor", "nurse", "allied_health", "clinic_admin", "platform_admin"].some(r => userRoles.includes(r))) {
      return new Response(JSON.stringify({ error: "Insufficient role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input: OrchestratorInput = await req.json();
    const skipAgents = new Set(input.skip_agents || []);
    const modelOverrides = input.model_overrides || {};
    const startTime = Date.now();
    const agentResults: AgentResult[] = [];

    function getModel(agent: string): string {
      return modelOverrides[agent] || AGENT_DEFAULTS[agent]?.model || "google/gemini-3-flash-preview";
    }
    function getTemp(agent: string): number {
      return AGENT_DEFAULTS[agent]?.temperature ?? 0.2;
    }
    function getTimeout(agent: string): number {
      return AGENT_DEFAULTS[agent]?.timeout_ms ?? 5000;
    }

    async function runAgent(name: string, fn: () => Promise<any>): Promise<any> {
      if (skipAgents.has(name)) {
        agentResults.push({ agent: name, status: "skipped", data: null, latency_ms: 0, model_used: "" });
        return null;
      }
      const start = Date.now();
      try {
        const data = await withTimeout(fn(), getTimeout(name));
        const latency = Date.now() - start;
        agentResults.push({ agent: name, status: "success", data, latency_ms: latency, model_used: getModel(name) });
        return data;
      } catch (e: any) {
        const latency = Date.now() - start;
        const status = e.message === "timeout" ? "timeout" : "error";
        agentResults.push({ agent: name, status, data: { error: e.message }, latency_ms: latency, model_used: getModel(name) });

        // Propagate rate limit / payment errors
        if (e.message === "rate_limit") throw new Error("rate_limit");
        if (e.message === "payment_required") throw new Error("payment_required");
        return null;
      }
    }

    // ═════════════════════════════════════
    // PHASE 1: Parallel — Intake + Context
    // ═════════════════════════════════════
    const [intakeData, contextData] = await Promise.all([
      runAgent("intake_agent", () =>
        runIntakeAgent(LOVABLE_API_KEY, input, getModel("intake_agent"), getTemp("intake_agent"))
      ),
      runAgent("context_agent", () =>
        runContextAgent(admin, input)
      ),
    ]);

    // ═════════════════════════════════════
    // PHASE 2: DDX Agent (needs intake + context)
    // ═════════════════════════════════════
    const ddxData = await runAgent("ddx_agent", () =>
      runDDXAgent(LOVABLE_API_KEY, intakeData, contextData, getModel("ddx_agent"), getTemp("ddx_agent"))
    );

    // ═════════════════════════════════════
    // PHASE 3: Parallel — Knowledge + Safety + Guideline
    // ═════════════════════════════════════
    const [knowledgeData, safetyData, guidelineData] = await Promise.all([
      runAgent("knowledge_agent", () =>
        runKnowledgeAgent(LOVABLE_API_KEY, ddxData, getModel("knowledge_agent"), getTemp("knowledge_agent"))
      ),
      runAgent("safety_agent", () =>
        runSafetyAgent(supabaseUrl, authHeader, anonKey, intakeData, contextData, input.clinical_context)
      ),
      runAgent("guideline_agent", () =>
        runGuidelineAgent(supabaseUrl, authHeader, anonKey, ddxData, null)
      ),
    ]);

    // Re-run guideline with knowledge if both succeeded
    let finalGuidelineData = guidelineData;
    if (knowledgeData && ddxData && !skipAgents.has("guideline_agent")) {
      try {
        finalGuidelineData = await runGuidelineAgent(supabaseUrl, authHeader, anonKey, ddxData, knowledgeData);
      } catch { /* keep first result */ }
    }

    // ═════════════════════════════════════
    // PHASE 4: Documentation Agent (needs all prior)
    // ═════════════════════════════════════
    const transcript = input.stabilized_transcript || input.transcript || "";
    const soapData = await runAgent("documentation_agent", () =>
      runDocumentationAgent(supabaseUrl, authHeader, anonKey, transcript, intakeData, safetyData, input.clinical_context)
    );

    const totalMs = Date.now() - startTime;

    // ── Aggregate results ──
    const aggregated = {
      intake: intakeData,
      context: contextData,
      differential_diagnosis: ddxData,
      knowledge: knowledgeData,
      safety: safetyData,
      guideline_compliance: finalGuidelineData,
      documentation: soapData,
    };

    // ── Audit log (non-blocking) ──
    admin.from("audit_logs").insert({
      actor_id: user.id,
      clinic_id: input.clinic_id || null,
      event_type: "meta_orchestrator_completed",
      target_type: "pipeline",
      metadata: {
        total_ms: totalMs,
        agents: agentResults.map(a => ({
          agent: a.agent, status: a.status, latency_ms: a.latency_ms, model: a.model_used,
        })),
        model_overrides: Object.keys(modelOverrides).length > 0 ? modelOverrides : undefined,
        skipped: Array.from(skipAgents),
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      aggregated,
      agent_results: agentResults,
      total_ms: totalMs,
      orchestration_version: "1.0",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Meta orchestrator error:", e);
    if (e.message === "rate_limit") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (e.message === "payment_required") {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
