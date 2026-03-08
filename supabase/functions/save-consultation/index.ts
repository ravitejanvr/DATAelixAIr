import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * save-consultation Edge Function
 * 
 * Validates and persists a clinical consultation session.
 * Business rules:
 * 1. Review must be confirmed before saving
 * 2. If no patient exists, creates a "Quick Patient" record
 * 3. Links consultation to visit_id if available
 * 4. Logs audit events for session completion and AI edits
 * 5. Captures learning signals for transcript/extraction/SOAP edits
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for writes
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      patient_id,
      clinic_id,
      visit_id,
      transcript,
      stabilized_transcript,
      extracted_data,
      soap_sections,
      safety_results,
      follow_up_date,
      follow_up_notes,
      review_confirmed,
      // Learning baselines
      ai_extracted_baseline,
      ai_soap_baseline,
      session_duration_ms,
    } = body;

    // ── Validation ──
    if (!review_confirmed) {
      return new Response(JSON.stringify({ error: "Review must be confirmed before saving." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!transcript?.trim()) {
      return new Response(JSON.stringify({ error: "Consultation transcript is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Ensure patient exists ──
    let finalPatientId = patient_id;
    if (!finalPatientId) {
      const { data: patientData, error: patientError } = await supabase.from("patients").insert({
        name: extracted_data?.chief_complaint ? "Session Patient" : "Quick Patient",
        doctor_id: user.id,
        clinic_id: clinic_id || null,
        current_medications: extracted_data?.current_medications
          ? extracted_data.current_medications.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
        allergies: extracted_data?.allergies
          ? extracted_data.allergies.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [],
      }).select("id").single();

      if (patientError) throw new Error(`Patient creation failed: ${patientError.message}`);
      finalPatientId = patientData.id;
    }

    // ── Build SOAP text ──
    const soapText = soap_sections
      ? Object.entries(soap_sections).map(([h, c]) => `**${h}**\n${c}`).join("\n\n")
      : "";

    const soapPlan = [
      soap_sections?.["Treatment Plan"] || "",
      soap_sections?.["Advice"] || "",
      follow_up_notes || "",
    ].filter(Boolean).join("\n\n");

    // ── Insert consultation ──
    const { data: consultData, error: consultError } = await supabase.from("consultations").insert({
      patient_id: finalPatientId,
      doctor_id: user.id,
      clinic_id: clinic_id || null,
      visit_id: visit_id || null,
      chief_complaint: extracted_data?.chief_complaint || "",
      raw_transcript: stabilized_transcript || transcript,
      stabilized_transcript: stabilized_transcript || "",
      doctor_final_transcript: transcript,
      edited_transcript: transcript,
      review_confirmed: true,
      extracted_data: extracted_data || {},
      ai_summary: soapText,
      soap_subjective: soap_sections?.["Visit Summary"] || "",
      soap_objective: soap_sections?.["Findings"] || "",
      soap_assessment: soap_sections?.["Provisional Diagnosis"] || "",
      soap_plan: soapPlan,
      follow_up_date: follow_up_date || null,
      status: "completed",
      safety_flags: safety_results
        ? [...(safety_results.interaction_flags || []), ...(safety_results.allergy_flags || []), ...(safety_results.dose_warnings || [])]
        : [],
      normalization_results: safety_results?.normalized_drugs || [],
      confidence_score: safety_results?.confidence_level || "moderate",
    }).select("id").single();

    if (consultError) throw new Error(`Consultation save failed: ${consultError.message}`);

    // ── Detect edits for learning signals ──
    const transcriptEdited = stabilized_transcript && stabilized_transcript !== transcript;
    const extractionCorrected = ai_extracted_baseline && JSON.stringify(ai_extracted_baseline) !== JSON.stringify(extracted_data);
    const soapEdited = ai_soap_baseline && JSON.stringify(ai_soap_baseline) !== JSON.stringify(soap_sections);
    const safetyAlertsCount = safety_results
      ? (safety_results.interaction_flags?.length || 0) + (safety_results.allergy_flags?.length || 0) +
        (safety_results.dose_warnings?.length || 0) + (safety_results.vitals_dangers?.length || 0) +
        (safety_results.emergency_patterns?.length || 0)
      : 0;

    // ── Audit logging (fire-and-forget) ──
    const auditPromises = [];

    auditPromises.push(
      supabase.from("audit_logs").insert({
        actor_id: user.id,
        clinic_id: clinic_id || null,
        event_type: "session_completed",
        target_type: "consultation",
        target_id: consultData.id,
        metadata: {
          transcript_edited: !!transcriptEdited,
          extraction_corrected: !!extractionCorrected,
          soap_edited: !!soapEdited,
          safety_alerts_count: safetyAlertsCount,
          follow_up_date: follow_up_date || null,
          model_version: "gemini-3-flash-preview",
          duration_ms: session_duration_ms || null,
        },
      })
    );

    if (transcriptEdited) {
      auditPromises.push(
        supabase.from("audit_logs").insert({
          actor_id: user.id, clinic_id: clinic_id || null,
          event_type: "ai_output_edited", target_type: "transcript", target_id: consultData.id,
          metadata: { stage: "transcript" },
        })
      );
    }
    if (extractionCorrected) {
      auditPromises.push(
        supabase.from("audit_logs").insert({
          actor_id: user.id, clinic_id: clinic_id || null,
          event_type: "ai_output_edited", target_type: "extraction", target_id: consultData.id,
          metadata: { stage: "extraction" },
        })
      );
    }
    if (soapEdited) {
      auditPromises.push(
        supabase.from("audit_logs").insert({
          actor_id: user.id, clinic_id: clinic_id || null,
          event_type: "ai_output_edited", target_type: "soap", target_id: consultData.id,
          metadata: { stage: "soap" },
        })
      );
    }

    // ── Learning signals (fire-and-forget) ──
    if (transcriptEdited) {
      auditPromises.push(
        supabase.from("doctor_learning_signals").insert({
          doctor_id: user.id, clinic_id: clinic_id || null,
          signal_type: "transcript_edit",
          signal_data: { original: stabilized_transcript, edited: transcript },
        })
      );
    }
    if (extractionCorrected) {
      auditPromises.push(
        supabase.from("doctor_learning_signals").insert({
          doctor_id: user.id, clinic_id: clinic_id || null,
          signal_type: "extraction_correction",
          signal_data: { original: ai_extracted_baseline, corrected: extracted_data },
        })
      );
    }
    if (soapEdited) {
      auditPromises.push(
        supabase.from("doctor_learning_signals").insert({
          doctor_id: user.id, clinic_id: clinic_id || null,
          signal_type: "documentation_style",
          signal_data: { original: ai_soap_baseline, edited: soap_sections },
        })
      );
    }

    // ── Monitoring event ──
    auditPromises.push(
      supabase.from("monitoring_events").insert({
        event_type: "session_completed",
        clinic_id: clinic_id || null,
        agent_name: "save-consultation",
        success: true,
        duration_ms: session_duration_ms || null,
        metadata: {
          transcript_edited: !!transcriptEdited,
          extraction_corrected: !!extractionCorrected,
          soap_edited: !!soapEdited,
          safety_alerts_count: safetyAlertsCount,
        },
      })
    );

    // Fire all audit/learning/monitoring in parallel, don't block response
    Promise.allSettled(auditPromises).catch(() => {});

    return new Response(JSON.stringify({
      consultation_id: consultData.id,
      patient_id: finalPatientId,
      status: "saved",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("save-consultation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
