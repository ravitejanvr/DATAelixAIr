import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * run-ai-pipeline Edge Function
 *
 * Orchestrates the full clinical AI pipeline server-side:
 * 1. Transcript Stabilization (regional lexicon + AI cleanup)
 * 2. Structured Symptom Extraction
 * 3. Clinical Safety Checks (interactions, allergies, vitals, emergencies)
 * 4. SOAP Note Generation
 *
 * Returns all AI outputs for doctor review — nothing is written to DB.
 * The doctor must approve outputs before save-consultation persists them.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
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

    // ── Validate role ──
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    const clinicalRoles = ["doctor", "nurse", "allied_health", "clinic_admin", "platform_admin"];
    if (!userRoles.some((r: string) => clinicalRoles.includes(r))) {
      return new Response(JSON.stringify({ error: "Insufficient role for AI pipeline" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Input ──
    const {
      transcript,
      clinic_id,
      clinical_context,
      intake_data,
    } = await req.json();

    if (!transcript?.trim()) {
      return new Response(JSON.stringify({ error: "transcript is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validate clinic membership ──
    if (clinic_id) {
      const { data: membership } = await admin.rpc("is_clinic_member", {
        _user_id: user.id, _clinic_id: clinic_id,
      });
      if (!membership) {
        return new Response(JSON.stringify({ error: "Not a member of this clinic" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const startTime = Date.now();
    const stageTimings: Record<string, number> = {};

    // ═══════════════════════════════════════
    // STAGE 1: Transcript Stabilization
    // ═══════════════════════════════════════
    let stabilized_transcript = transcript.trim();
    let normalization_results: any[] = [];
    let detected_languages: string[] = [];
    let match_count = 0;

    const s1Start = Date.now();
    try {
      // Load regional lexicon
      const { data: lexicon } = await admin
        .from("regional_lexicon")
        .select("id, regional_phrase, clinical_term, category, language")
        .order("regional_phrase", { ascending: false });

      const entries = lexicon || [];
      const matches: any[] = [];
      let workingText = stabilized_transcript;

      // Regex-based normalization
      for (const entry of entries) {
        const escaped = entry.regional_phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        if (regex.test(workingText)) {
          matches.push({
            regional_phrase: entry.regional_phrase,
            clinical_term: entry.clinical_term,
            category: entry.category,
            language: entry.language,
          });
          workingText = workingText.replace(regex, entry.clinical_term);
        }
      }

      // AI stabilization
      const stabilizeResponse = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `You are a medical transcript stabilizer. Fix obvious medical term misspellings (e.g., "Meta form in" → "Metformin"). Remove repeated words/phrases. Preserve negations ("no fever", "denies pain"). Do NOT summarize, translate, or add interpretation. Mark uncertain words with [?]. Return ONLY the cleaned transcript.`,
            },
            { role: "user", content: workingText },
          ],
        }),
      });

      if (stabilizeResponse.ok) {
        const stabilizeData = await stabilizeResponse.json();
        const content = stabilizeData.choices?.[0]?.message?.content;
        if (content) stabilized_transcript = content.trim();
      }

      normalization_results = matches;
      detected_languages = [...new Set(matches.map((m: any) => m.language))];
      match_count = matches.length;

      // Increment lexicon usage
      if (matches.length > 0) {
        const matchedIds = entries
          .filter((e: any) => matches.some((m: any) => m.regional_phrase === e.regional_phrase))
          .map((e: any) => e.id);
        if (matchedIds.length > 0) {
          await admin.rpc("increment_lexicon_usage", { ids: matchedIds });
        }
      }
    } catch (e) {
      console.error("Stabilization error:", e);
    }
    stageTimings.stabilization_ms = Date.now() - s1Start;

    // ═══════════════════════════════════════
    // STAGE 2: Structured Extraction
    // ═══════════════════════════════════════
    let extracted_data: Record<string, string> = {
      chief_complaint: "", duration: "", associated_symptoms: "",
      vitals: "", chronic_conditions: "", current_medications: "", allergies: "",
    };

    const s2Start = Date.now();
    try {
      const extractResponse = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a conservative clinical data extractor. Extract ONLY explicitly stated information from the transcript. Never infer, assume, or add information not directly present. If a field is not mentioned, leave it empty.`,
            },
            { role: "user", content: stabilized_transcript },
          ],
          tools: [{
            type: "function",
            function: {
              name: "extract_clinical_data",
              description: "Extract structured clinical data from transcript",
              parameters: {
                type: "object",
                properties: {
                  chief_complaint: { type: "string" },
                  duration: { type: "string" },
                  associated_symptoms: { type: "string" },
                  vitals: { type: "string" },
                  chronic_conditions: { type: "string" },
                  current_medications: { type: "string" },
                  allergies: { type: "string" },
                },
                required: ["chief_complaint", "duration", "associated_symptoms", "vitals", "chronic_conditions", "current_medications", "allergies"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "extract_clinical_data" } },
        }),
      });

      if (!extractResponse.ok) {
        const status = extractResponse.status;
        if (status === 429) throw new Error("AI rate limit exceeded. Please try again shortly.");
        if (status === 402) throw new Error("AI credits exhausted. Please add funds.");
        throw new Error(`Extraction failed (${status})`);
      }

      const extractData = await extractResponse.json();
      const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        extracted_data = {
          chief_complaint: parsed.chief_complaint || "",
          duration: parsed.duration || "",
          associated_symptoms: parsed.associated_symptoms || "",
          vitals: parsed.vitals || "",
          chronic_conditions: parsed.chronic_conditions || "",
          current_medications: parsed.current_medications || "",
          allergies: parsed.allergies || "",
        };
      }
    } catch (e: any) {
      console.error("Extraction error:", e);
      // Return partial results with error flag
      stageTimings.extraction_ms = Date.now() - s2Start;
      return new Response(JSON.stringify({
        error: e.message,
        stage: "extraction",
        partial: { stabilized_transcript, normalization_results, detected_languages, match_count },
      }), {
        status: e.message.includes("rate limit") ? 429 : e.message.includes("credits") ? 402 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    stageTimings.extraction_ms = Date.now() - s2Start;

    // ═══════════════════════════════════════
    // STAGE 3: Clinical Safety Checks
    // ═══════════════════════════════════════
    let safety_results: any = {
      interaction_flags: [], allergy_flags: [], dose_warnings: [],
      vitals_dangers: [], emergency_patterns: [],
      confidence_level: "moderate", requires_manual_review: false,
      ai_suggestions_blocked: false,
    };

    const s3Start = Date.now();
    try {
      // Build medications and allergies from context + extraction
      const contextMeds = clinical_context?.current_medications || [];
      const extractedMeds = extracted_data.current_medications?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];
      const allMedications = [...new Set([...contextMeds, ...extractedMeds])];

      const contextAllergies = clinical_context?.allergies || [];
      const extractedAllergies = extracted_data.allergies?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];
      const allAllergies = [...new Set([...contextAllergies, ...extractedAllergies])];

      // Parse vitals from context
      const vitalsObj: Record<string, number | null> = {};
      if (clinical_context?.blood_pressure) {
        const parts = clinical_context.blood_pressure.split("/");
        vitalsObj.bp_systolic = parseInt(parts[0]) || null;
        vitalsObj.bp_diastolic = parseInt(parts[1]) || null;
      }
      vitalsObj.pulse = clinical_context?.pulse || null;
      vitalsObj.temperature = clinical_context?.temperature || null;
      vitalsObj.spo2 = clinical_context?.oxygen_saturation || null;
      vitalsObj.respiratory_rate = clinical_context?.respiratory_rate || null;

      const symptoms = [
        clinical_context?.chief_complaint || extracted_data.chief_complaint,
        extracted_data.associated_symptoms,
      ].filter(Boolean).join(", ").split(",").map((s: string) => s.trim()).filter(Boolean);

      // Call the existing clinical-safety function internally
      const safetyUrl = `${supabaseUrl}/functions/v1/clinical-safety`;
      const safetyResp = await fetch(safetyUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          medications: allMedications,
          allergies: allAllergies,
          vitals: vitalsObj,
          symptoms,
          clinical_context,
          actor_id: user.id,
        }),
      });

      if (safetyResp.ok) {
        safety_results = await safetyResp.json();
      }
    } catch (e) {
      console.error("Safety check error:", e);
      safety_results.requires_manual_review = true;
    }
    stageTimings.safety_ms = Date.now() - s3Start;

    // If safety blocks AI suggestions, return early with what we have
    if (safety_results.ai_suggestions_blocked) {
      // Log audit for blocked pipeline
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        clinic_id: clinic_id || null,
        event_type: "ai_pipeline_blocked",
        target_type: "pipeline",
        metadata: {
          reason: "incomplete_clinical_context",
          context_issues: safety_results.context_completeness_issues || [],
          stages_completed: ["stabilization", "extraction", "safety"],
        },
      });

      return new Response(JSON.stringify({
        stabilized_transcript,
        normalization_results,
        detected_languages,
        match_count,
        extracted_data,
        safety_results,
        soap_sections: null,
        ai_suggestions_blocked: true,
        stage_timings: stageTimings,
        pipeline_complete: false,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════
    // STAGE 4: SOAP Generation
    // ═══════════════════════════════════════
    let soap_sections: Record<string, string> = {
      "Visit Summary": "", "Findings": "", "Provisional Diagnosis": "",
      "Safety Warnings": "No safety concerns identified.",
      "Treatment Plan": "", "Advice": "", "Follow-up": "",
    };

    const s4Start = Date.now();
    try {
      // Build intake context
      const intakeContext: Record<string, string> = {};
      if (intake_data) {
        intakeContext.chief_complaint = intake_data.chief_complaint || "";
        intakeContext.symptom_duration = intake_data.symptom_duration || "";
        intakeContext.pain_score = intake_data.pain_score != null ? `${intake_data.pain_score}/10` : "";
        intakeContext.allergies = intake_data.allergies_noted || "";
        intakeContext.medications = intake_data.current_medications || "";
        intakeContext.pregnancy_status = intake_data.pregnancy_status || "";
      }

      // Add safety results to extraction context
      const enrichedExtracted = { ...intakeContext, safety_results };

      const soapUrl = `${supabaseUrl}/functions/v1/clinical-soap`;
      const soapResp = await fetch(soapUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          transcript: stabilized_transcript,
          extractedData: enrichedExtracted,
          clinical_context,
        }),
      });

      if (soapResp.ok) {
        const soapData = await soapResp.json();
        soap_sections = {
          "Visit Summary": soapData.sections?.["Visit Summary"] || "",
          "Findings": soapData.sections?.["Findings"] || "",
          "Provisional Diagnosis": soapData.sections?.["Provisional Diagnosis"] || "",
          "Safety Warnings": soapData.sections?.["Safety Warnings"] || "No safety concerns identified.",
          "Treatment Plan": soapData.sections?.["Treatment Plan"] || "",
          "Advice": soapData.sections?.["Advice"] || "",
          "Follow-up": soapData.sections?.["Follow-up"] || "",
        };
      }
    } catch (e) {
      console.error("SOAP generation error:", e);
    }
    stageTimings.soap_ms = Date.now() - s4Start;

    const totalMs = Date.now() - startTime;

    // ── Audit log ──
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      clinic_id: clinic_id || null,
      event_type: "ai_pipeline_completed",
      target_type: "pipeline",
      metadata: {
        total_duration_ms: totalMs,
        stage_timings: stageTimings,
        safety_alerts: {
          interactions: safety_results.interaction_flags?.length || 0,
          allergies: safety_results.allergy_flags?.length || 0,
          dose_warnings: safety_results.dose_warnings?.length || 0,
          vitals_dangers: safety_results.vitals_dangers?.length || 0,
          emergency_patterns: safety_results.emergency_patterns?.length || 0,
        },
        normalization_matches: match_count,
        confidence_level: safety_results.confidence_level,
      },
    });

    // ── Monitoring event ──
    await admin.from("monitoring_events").insert({
      event_type: "ai_pipeline_run",
      agent_name: "run-ai-pipeline",
      clinic_id: clinic_id || null,
      duration_ms: totalMs,
      success: true,
      metadata: { stage_timings: stageTimings, user_id: user.id },
    });

    // Return ALL AI outputs for doctor review — nothing written to DB
    return new Response(JSON.stringify({
      stabilized_transcript,
      normalization_results,
      detected_languages,
      match_count,
      extracted_data,
      safety_results,
      soap_sections,
      ai_suggestions_blocked: false,
      stage_timings: stageTimings,
      total_duration_ms: totalMs,
      pipeline_complete: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("run-ai-pipeline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
