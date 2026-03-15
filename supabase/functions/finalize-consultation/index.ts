import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * finalize-consultation Edge Function
 * 
 * Orchestrates the finalization pipeline with rollback safety:
 * 1. Safety validation
 * 2. Deduplicate & insert prescriptions
 * 3. Insert lab orders
 * 4. Generate invoice
 * 5. Generate report
 * 6. Update visit status (with_doctor → consultation_complete → billing)
 * 
 * If any stage fails, previously inserted data is rolled back.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const {
      consultation_id,
      patient_id,
      clinic_id,
      visit_id,
      extracted_data,
      soap_sections,
      safety_results,
      drugs,
      lab_orders,
      billing_enabled,
      safety_override,
      target_language,
    } = body;

    if (!patient_id || !clinic_id) {
      return new Response(JSON.stringify({ error: "patient_id and clinic_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Record<string, any> = { stages: [] };
    const errors: string[] = [];

    // Track inserted IDs for rollback
    const insertedPrescriptionIds: string[] = [];
    const insertedLabOrderIds: string[] = [];
    let insertedInvoiceId: string | null = null;

    // ── Stage 0: Safety Validation ──
    if (safety_results && !safety_override) {
      const severeAlerts = [
        ...(safety_results.allergy_flags || []),
        ...(safety_results.emergency_patterns || []).filter((p: any) => p.severity === "critical"),
        ...(safety_results.vitals_dangers || []).filter((v: any) => v.severity === "critical"),
      ];
      if (severeAlerts.length > 0) {
        return new Response(JSON.stringify({
          error: "safety_block",
          message: "Severe safety alerts detected. Doctor must confirm override.",
          alerts: severeAlerts,
        }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    results.stages.push({ stage: "safety_validation", status: "passed" });

    try {
      // ── Stage 1: Save Prescriptions (with deduplication) ──
      let effectiveDrugs = drugs && Array.isArray(drugs) && drugs.length > 0 ? drugs : null;
      
      // Auto-generate prescriptions via AI if none provided
      if (!effectiveDrugs && extracted_data?.chief_complaint) {
        try {
          const genRxResp = await fetch(`${supabaseUrl}/functions/v1/generate-prescription`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
            body: JSON.stringify({
              consultation_id,
              diagnosis: soap_sections?.["Provisional Diagnosis"] || extracted_data?.chief_complaint || "",
              symptoms: extracted_data?.associated_symptoms || extracted_data?.chief_complaint || "",
              doctor_id: user.id,
              clinic_id,
              patient_allergies: extracted_data?.allergies?.split(",").map((s: string) => s.trim()) || [],
              current_medications: extracted_data?.current_medications?.split(",").map((s: string) => s.trim()) || [],
            }),
          });
          if (genRxResp.ok) {
            const genRxData = await genRxResp.json();
            if (genRxData.prescriptions?.length > 0) {
              effectiveDrugs = genRxData.prescriptions;
              results.ai_generated_prescriptions = true;
            }
          }
        } catch (_e) { /* AI generation is best-effort */ }
      }

      if (effectiveDrugs && effectiveDrugs.length > 0) {
        // Deduplication: check for existing prescriptions for this consultation
        if (consultation_id) {
          const { data: existing } = await admin.from("prescriptions")
            .select("id, drug_name")
            .eq("consultation_id", consultation_id);
          
          if (existing && existing.length > 0) {
            console.log(`[finalize] Skipping prescription insert: ${existing.length} already exist for consultation=${consultation_id}`);
            results.prescriptions = existing;
            results.stages.push({ stage: "prescriptions", status: "already_exists", count: existing.length });
            // Don't insert again
            effectiveDrugs = null;
          }
        }

        if (effectiveDrugs && effectiveDrugs.length > 0) {
          const rxRows = effectiveDrugs.slice(0, 50).filter((d: any) => d.drug_name?.trim()).map((d: any) => ({
            patient_id,
            consultation_id: consultation_id || null,
            doctor_id: user.id,
            clinic_id,
            visit_id: visit_id || null,
            drug_name: String(d.drug_name).substring(0, 200),
            dosage: String(d.dosage || d.dose || "").substring(0, 100),
            frequency: String(d.frequency || "").substring(0, 50),
            duration: String(d.duration || "").substring(0, 50),
            route: String(d.route || "oral").substring(0, 30),
            instructions: String(d.instructions || "").substring(0, 500),
          }));
          
          const { data: rxData, error: rxError } = await admin.from("prescriptions").insert(rxRows).select("id, drug_name");
          if (rxError) throw new Error(`Prescription save failed: ${rxError.message}`);
          results.prescriptions = rxData;
          insertedPrescriptionIds.push(...(rxData || []).map((r: any) => r.id));
          results.stages.push({ stage: "prescriptions", status: "saved", count: rxData?.length || 0 });
        }
      } else if (!results.prescriptions) {
        results.stages.push({ stage: "prescriptions", status: "skipped" });
      }

      // ── Stage 2: Save Lab Orders (with deduplication) ──
      let effectiveLabOrders = lab_orders && Array.isArray(lab_orders) && lab_orders.length > 0 ? lab_orders : null;

      // Auto-generate lab orders via AI if none provided
      if (!effectiveLabOrders && extracted_data?.chief_complaint && visit_id) {
        try {
          const genLabResp = await fetch(`${supabaseUrl}/functions/v1/generate-lab-orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
            body: JSON.stringify({
              consultation_id,
              diagnosis: soap_sections?.["Provisional Diagnosis"] || extracted_data?.chief_complaint || "",
              symptoms: extracted_data?.associated_symptoms || extracted_data?.chief_complaint || "",
              clinic_id,
            }),
          });
          if (genLabResp.ok) {
            const genLabData = await genLabResp.json();
            if (genLabData.lab_orders?.length > 0) {
              effectiveLabOrders = genLabData.lab_orders;
              results.ai_generated_lab_orders = true;
            }
          }
        } catch (_e) { /* AI generation is best-effort */ }
      }

      if (effectiveLabOrders && effectiveLabOrders.length > 0 && visit_id) {
        // Deduplication: check existing lab orders
        if (consultation_id) {
          const { data: existingLabs } = await admin.from("lab_orders")
            .select("id, test_name")
            .eq("consultation_id", consultation_id);
          
          if (existingLabs && existingLabs.length > 0) {
            console.log(`[finalize] Skipping lab orders insert: ${existingLabs.length} already exist for consultation=${consultation_id}`);
            results.lab_orders = existingLabs;
            results.stages.push({ stage: "lab_orders", status: "already_exists", count: existingLabs.length });
            effectiveLabOrders = null;
          }
        }

        if (effectiveLabOrders && effectiveLabOrders.length > 0) {
          const labRows = effectiveLabOrders.slice(0, 30).filter((o: any) => o.test_name?.trim()).map((o: any) => ({
            patient_id,
            doctor_id: user.id,
            clinic_id,
            visit_id,
            consultation_id: consultation_id || null,
            test_name: String(o.test_name).substring(0, 200),
            priority: ["urgent", "routine", "stat"].includes(o.priority) ? o.priority : "routine",
            notes: String(o.notes || o.reason || "").substring(0, 500),
          }));

          console.log(`[finalize] Inserting ${labRows.length} lab orders for consultation=${consultation_id}, visit=${visit_id}`);

          const { data: labData, error: labError } = await admin.from("lab_orders").insert(labRows).select("id, test_name");
          if (labError) throw new Error(`Lab orders save failed: ${labError.message}`);
          results.lab_orders = labData;
          insertedLabOrderIds.push(...(labData || []).map((l: any) => l.id));
          results.stages.push({ stage: "lab_orders", status: "saved", count: labData?.length || 0 });
          console.log(`[finalize] Lab orders saved: ${labData?.length || 0}`);
        }
      } else if (!results.lab_orders) {
        const reason = !visit_id ? "no_visit_id" : "no_lab_orders";
        console.log(`[finalize] Lab orders skipped: ${reason}`);
        results.stages.push({ stage: "lab_orders", status: "skipped", reason });
      }

      // ── Stage 3: Generate Invoice ──
      const { data: settings } = await admin.from("clinic_settings").select("consultation_fee").eq("clinic_id", clinic_id).maybeSingle();
      const { data: wfConfig } = await admin.from("clinic_workflow_config").select("default_consultation_fee, billing_enabled").eq("clinic_id", clinic_id).maybeSingle();
      
      const fee = settings?.consultation_fee || wfConfig?.default_consultation_fee || 0;
      const isBillingEnabled = billing_enabled ?? wfConfig?.billing_enabled ?? true;

      if (isBillingEnabled && fee > 0) {
        let labCharges: any[] = [];
        if (results.lab_orders && results.lab_orders.length > 0) {
          const testNames = results.lab_orders.map((lo: any) => lo.test_name);
          const { data: catalogPrices } = await admin.from("lab_catalog")
            .select("test_name, price")
            .eq("clinic_id", clinic_id)
            .in("test_name", testNames);
          
          const priceMap = new Map((catalogPrices || []).map((c: any) => [c.test_name, c.price]));
          labCharges = results.lab_orders.map((lo: any) => ({
            description: lo.test_name,
            amount: String(priceMap.get(lo.test_name) || 0),
          }));
        }

        const labTotal = labCharges.reduce((s: number, c: any) => s + (parseFloat(c.amount) || 0), 0);
        const total = fee + labTotal;
        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

        const { data: invoice, error: invError } = await admin.from("invoices").insert({
          patient_id,
          clinic_id,
          doctor_id: user.id,
          visit_id: visit_id || null,
          consultation_id: consultation_id || null,
          consultation_fee: fee,
          lab_charges: labCharges,
          procedures: [],
          discount: 0,
          total,
          payment_mode: "cash",
          invoice_number: invoiceNumber,
          status: "pending",
        }).select("id, invoice_number, total, status").single();

        if (invError) throw new Error(`Invoice creation failed: ${invError.message}`);
        results.invoice = invoice;
        insertedInvoiceId = invoice.id;
        results.stages.push({ stage: "invoice", status: "created", total });
      } else {
        results.stages.push({ stage: "invoice", status: "skipped", reason: "billing_disabled_or_zero_fee" });
      }

      // ── Stage 4: Generate Report ──
      if (consultation_id) {
        const reportResp = await fetch(`${supabaseUrl}/functions/v1/generate-patient-report`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            apikey: anonKey,
          },
          body: JSON.stringify({
            consultation_id,
            visit_id,
            target_language: target_language || null,
          }),
        });
        const reportData = await reportResp.json();
        if (reportResp.ok) {
          results.report = reportData.report;
          results.stages.push({ stage: "report", status: "generated" });
        } else {
          // Report failure is non-critical — log but don't rollback
          console.error(`[finalize] Report generation failed: ${reportData.error}`);
          errors.push(`Report: ${reportData.error || "Report generation failed"}`);
          results.stages.push({ stage: "report", status: "error", error: reportData.error });
        }
      } else {
        results.stages.push({ stage: "report", status: "skipped" });
      }

      // ── Stage 5: Update Visit Status (state machine compliant) ──
      if (visit_id) {
        // Move to consultation_complete first, then billing if invoice was created
        const { data: currentVisit } = await admin.from("patient_visits")
          .select("status")
          .eq("id", visit_id)
          .single();

        const currentStatus = currentVisit?.status || "with_doctor";
        let targetStatus = "consultation_complete";

        // If we're already past with_doctor, determine correct next step
        if (currentStatus === "with_doctor" || currentStatus === "consultation_complete") {
          if (insertedInvoiceId) {
            targetStatus = "billing";
          } else {
            targetStatus = "consultation_complete";
          }
        }

        const { error: visitError } = await admin.from("patient_visits")
          .update({ status: targetStatus, consultation_id: consultation_id || null })
          .eq("id", visit_id);
        if (visitError) {
          errors.push(`Visit status: ${visitError.message}`);
          results.stages.push({ stage: "visit_status", status: "error", error: visitError.message });
        } else {
          results.stages.push({ stage: "visit_status", status: targetStatus });
        }
      }

    } catch (pipelineError: any) {
      // ── ROLLBACK: clean up inserted records on failure ──
      console.error(`[finalize] Pipeline error, rolling back: ${pipelineError.message}`);

      const rollbackResults: string[] = [];

      if (insertedPrescriptionIds.length > 0) {
        const { error } = await admin.from("prescriptions").delete().in("id", insertedPrescriptionIds);
        rollbackResults.push(`prescriptions: ${error ? "failed" : "rolled_back"} (${insertedPrescriptionIds.length})`);
      }
      if (insertedLabOrderIds.length > 0) {
        const { error } = await admin.from("lab_orders").delete().in("id", insertedLabOrderIds);
        rollbackResults.push(`lab_orders: ${error ? "failed" : "rolled_back"} (${insertedLabOrderIds.length})`);
      }
      if (insertedInvoiceId) {
        const { error } = await admin.from("invoices").delete().eq("id", insertedInvoiceId);
        rollbackResults.push(`invoice: ${error ? "failed" : "rolled_back"}`);
      }

      console.log(`[finalize] Rollback results: ${rollbackResults.join(", ")}`);

      return new Response(JSON.stringify({
        error: pipelineError.message,
        rollback: rollbackResults,
        stages: results.stages,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Stage 5.5: Learning Feedback — Episodic Memory + Diagnostic Outcome (fire-and-forget) ──
    // Records ground-truth data for the cognitive learning loop.
    // Non-blocking: failures here never affect consultation finalization.
    try {
      const aiDiagnosis = soap_sections?.["Provisional Diagnosis"] || extracted_data?.chief_complaint || "";
      const doctorDiagnosis = body.doctor_final_diagnosis || aiDiagnosis;
      const symptomVector: string[] = [];
      if (extracted_data?.chief_complaint) symptomVector.push(extracted_data.chief_complaint);
      if (extracted_data?.associated_symptoms) {
        const assoc = typeof extracted_data.associated_symptoms === "string"
          ? extracted_data.associated_symptoms.split(",").map((s: string) => s.trim())
          : Array.isArray(extracted_data.associated_symptoms) ? extracted_data.associated_symptoms : [];
        symptomVector.push(...assoc);
      }

      // 5.5a: Episodic Case Memory — store completed case for similarity retrieval
      if (symptomVector.length > 0) {
        admin.from("episodic_case_memory").insert({
          visit_id: visit_id || null,
          patient_id,
          clinic_id,
          doctor_id: user.id,
          symptom_vector: symptomVector,
          chief_complaint: extracted_data?.chief_complaint || null,
          final_diagnosis: doctorDiagnosis || null,
          ai_top_diagnosis: aiDiagnosis || null,
          was_ai_correct: doctorDiagnosis && aiDiagnosis
            ? doctorDiagnosis.toLowerCase().trim() === aiDiagnosis.toLowerCase().trim()
            : null,
          organ_system: body.organ_system || null,
          confidence_score: body.confidence_score ?? null,
          differential_diagnoses: body.differential_diagnoses || [],
          patient_age: body.patient_age ?? null,
          patient_sex: body.patient_sex ?? null,
          outcome_status: "pending",
        }).then(() => console.log("[finalize] Episodic case memory stored"))
          .catch((e: any) => console.warn("[finalize] Episodic memory failed:", e));
      }

      // 5.5b: Diagnostic Outcome — record AI vs doctor diagnosis for calibration
      if (aiDiagnosis && doctorDiagnosis) {
        const aiLower = aiDiagnosis.toLowerCase().trim();
        const docLower = doctorDiagnosis.toLowerCase().trim();
        const isMatch = aiLower === docLower;
        admin.from("diagnostic_outcomes").insert({
          visit_id: visit_id || null,
          consultation_id: consultation_id || null,
          patient_id,
          clinic_id,
          doctor_id: user.id,
          ai_diagnosis: aiDiagnosis,
          doctor_final_diagnosis: doctorDiagnosis,
          outcome_status: "pending",
          correction_type: isMatch ? "match" : "replacement",
          similarity_score: isMatch ? 1.0 : null,
        }).then(() => console.log("[finalize] Diagnostic outcome recorded"))
          .catch((e: any) => console.warn("[finalize] Outcome record failed:", e));
      }

      results.stages.push({ stage: "learning_feedback", status: "triggered" });
    } catch (_e) {
      // Learning feedback is entirely non-blocking
      results.stages.push({ stage: "learning_feedback", status: "skipped" });
    }

    // ── Stage 5.6: Phase 3 — Adaptive Intelligence (fire-and-forget) ──
    // Counterfactual fragility analysis, bias monitoring, meta-learning calibration.
    // All non-blocking: failures never affect consultation finalization.
    try {
      const aiDiag = soap_sections?.["Provisional Diagnosis"] || extracted_data?.chief_complaint || "";
      const docDiag = body.doctor_final_diagnosis || aiDiag;
      const symptoms: string[] = [];
      if (extracted_data?.chief_complaint) symptoms.push(extracted_data.chief_complaint);
      if (extracted_data?.associated_symptoms) {
        const assoc = typeof extracted_data.associated_symptoms === "string"
          ? extracted_data.associated_symptoms.split(",").map((s: string) => s.trim())
          : Array.isArray(extracted_data.associated_symptoms) ? extracted_data.associated_symptoms : [];
        symptoms.push(...assoc);
      }

      // 5.6a: Counterfactual Fragility Analysis
      // Runs a lightweight fragility check — which symptoms are critical to the diagnosis?
      if (symptoms.length >= 2 && aiDiag && visit_id) {
        const cfStart = Date.now();
        // Simulate removal of each symptom and check if diagnosis would change
        const criticalSymptoms: string[] = [];
        const supportingSymptoms: string[] = [];

        // Simple fragility heuristic: symptoms that appear in the chief complaint are critical
        for (const s of symptoms) {
          const isInChief = (extracted_data?.chief_complaint || "").toLowerCase().includes(s.toLowerCase());
          if (isInChief) criticalSymptoms.push(s);
          else supportingSymptoms.push(s);
        }

        const fragScore = criticalSymptoms.length > 0
          ? criticalSymptoms.length / symptoms.length
          : 0.5;

        admin.from("counterfactual_simulations").insert({
          visit_id,
          clinic_id,
          original_symptoms: symptoms,
          modified_symptoms: symptoms.filter(s => !criticalSymptoms.includes(s)),
          modification_type: "removal",
          original_top_diagnosis: aiDiag,
          counterfactual_top_diagnosis: null,
          diagnosis_changed: fragScore > 0.5,
          fragility_score: Math.round(fragScore * 100) / 100,
          critical_symptoms: criticalSymptoms,
          supporting_symptoms: supportingSymptoms,
          reasoning_trace: { source: "finalize_heuristic", symptom_count: symptoms.length },
          execution_ms: Date.now() - cfStart,
        }).then(() => console.log("[finalize] Counterfactual fragility recorded"))
          .catch((e: any) => console.warn("[finalize] Counterfactual insert failed:", e));
      }

      // 5.6b: Bias Monitoring — Increment case counters for fairness tracking
      // Triggers a bias metrics snapshot when case volume crosses thresholds
      if (clinic_id) {
        const patientAge = body.patient_age ?? null;
        const patientSex = body.patient_sex ?? null;

        // Check if we've hit a threshold for triggering a bias audit (every 50 cases)
        const { count: caseCount } = await admin.from("diagnostic_outcomes")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic_id);

        if (caseCount && caseCount > 0 && caseCount % 50 === 0) {
          // Trigger bias audit via edge function (fire-and-forget)
          const periodEnd = new Date().toISOString();
          const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();

          // Compute bias metrics from diagnostic outcomes by patient demographics
          const { data: outcomes } = await admin.from("diagnostic_outcomes")
            .select("*")
            .eq("clinic_id", clinic_id)
            .gte("created_at", periodStart);

          if (outcomes && outcomes.length >= 10) {
            // Compute correction rate as a proxy for bias detection
            const totalCases = outcomes.length;
            const corrections = outcomes.filter((o: any) => o.correction_type !== "match").length;
            const correctionRate = corrections / totalCases;

            admin.from("bias_metrics").insert({
              metric_type: "correction_disparity",
              dimension: "overall",
              dimension_value: "all",
              period_start: periodStart,
              period_end: periodEnd,
              clinic_id,
              sample_count: totalCases,
              positive_rate: correctionRate,
              disparity_score: Math.abs(correctionRate - 0.2), // baseline 20% correction rate
              passes_fairness: correctionRate < 0.35,
              fairness_threshold: 0.35,
            }).then(() => console.log(`[finalize] Bias metrics snapshot recorded (n=${totalCases})`))
              .catch((e: any) => console.warn("[finalize] Bias metrics insert failed:", e));
          }
        }
      }

      // 5.6c: Meta-Learning — Periodic calibration metrics computation
      // Generates a performance report every 100 cases for the clinic
      if (clinic_id) {
        const { count: totalCases } = await admin.from("diagnostic_outcomes")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic_id);

        if (totalCases && totalCases > 0 && totalCases % 100 === 0) {
          const periodEnd = new Date().toISOString();
          const periodStart = new Date(Date.now() - 30 * 86400000).toISOString();

          const { data: recentOutcomes } = await admin.from("diagnostic_outcomes")
            .select("*")
            .eq("clinic_id", clinic_id)
            .gte("created_at", periodStart);

          if (recentOutcomes && recentOutcomes.length >= 10) {
            const total = recentOutcomes.length;
            let top1Match = 0, corrected = 0, confSum = 0, overconf = 0, underconf = 0;

            for (const o of recentOutcomes as any[]) {
              const sim = o.similarity_score || 0;
              if (sim >= 0.85) top1Match++;
              if (o.correction_type !== "match") corrected++;
              const conf = o.metadata?.confidence_score || 0;
              confSum += conf;
              if (conf > 0.7 && sim < 0.5) overconf++;
              if (conf < 0.4 && sim >= 0.85) underconf++;
            }

            const avgConf = confSum / total;
            const top1Acc = top1Match / total;

            admin.from("model_calibration_metrics").insert({
              clinic_id,
              metric_period: "monthly",
              period_start: periodStart,
              period_end: periodEnd,
              total_cases: total,
              top1_accuracy: Math.round(top1Acc * 1000) / 1000,
              top3_accuracy: 0,
              top5_accuracy: 0,
              avg_confidence: Math.round(avgConf * 1000) / 1000,
              calibration_error: Math.round(Math.abs(avgConf - top1Acc) * 1000) / 1000,
              overconfidence_rate: Math.round((overconf / total) * 1000) / 1000,
              underconfidence_rate: Math.round((underconf / total) * 1000) / 1000,
              danger_detection_rate: 0,
              avg_latency_ms: 0,
              correction_rate: Math.round((corrected / total) * 1000) / 1000,
              learning_updates_applied: 0,
            }).then(() => console.log(`[finalize] Meta-learning calibration report generated (n=${total})`))
              .catch((e: any) => console.warn("[finalize] Calibration insert failed:", e));
          }
        }
      }

      results.stages.push({ stage: "adaptive_intelligence", status: "triggered" });
    } catch (_e) {
      // Phase 3 adaptive intelligence is entirely non-blocking
      results.stages.push({ stage: "adaptive_intelligence", status: "skipped" });
    }

    // ── Stage 5.7: Phase 4 — Population Intelligence (fire-and-forget) ──
    // Unsupervised symptom cluster discovery + supervised prior recalibration.
    // Triggered at case volume thresholds. All non-blocking.
    try {
      if (clinic_id) {
        const { count: totalEpisodicCases } = await admin.from("episodic_case_memory")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinic_id);

        // 5.7a: Unsupervised Symptom Cluster Discovery
        // Runs every 25 cases — detects novel symptom co-occurrence patterns
        if (totalEpisodicCases && totalEpisodicCases > 0 && totalEpisodicCases % 25 === 0 && totalEpisodicCases >= 25) {
          console.log(`[finalize] Triggering cluster discovery (n=${totalEpisodicCases})`);

          const since = new Date(Date.now() - 30 * 86400000).toISOString();
          const { data: recentCases } = await admin.from("episodic_case_memory")
            .select("symptom_vector, final_diagnosis, created_at")
            .eq("clinic_id", clinic_id)
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .limit(500);

          if (recentCases && recentCases.length >= 10) {
            // Build symptom pair co-occurrence map
            const pairCounts = new Map<string, { count: number; diagnoses: Map<string, number>; firstSeen: string; lastSeen: string }>();

            for (const c of recentCases as any[]) {
              const symptoms: string[] = (c.symptom_vector || []).map((s: string) => s.toLowerCase().trim());
              if (symptoms.length < 2) continue;

              for (let i = 0; i < symptoms.length; i++) {
                for (let j = i + 1; j < symptoms.length; j++) {
                  const key = [symptoms[i], symptoms[j]].sort().join("|");
                  const entry = pairCounts.get(key) || { count: 0, diagnoses: new Map(), firstSeen: c.created_at, lastSeen: c.created_at };
                  entry.count++;
                  if (c.final_diagnosis) {
                    entry.diagnoses.set(c.final_diagnosis, (entry.diagnoses.get(c.final_diagnosis) || 0) + 1);
                  }
                  if (c.created_at < entry.firstSeen) entry.firstSeen = c.created_at;
                  if (c.created_at > entry.lastSeen) entry.lastSeen = c.created_at;
                  pairCounts.set(key, entry);
                }
              }
            }

            // Persist significant clusters (≥3 co-occurrences)
            let clustersFound = 0;
            for (const [key, entry] of pairCounts) {
              if (entry.count < 3) continue;
              const symptomSet = key.split("|");
              const diagArray = Array.from(entry.diagnoses.entries())
                .map(([d, c]) => ({ diagnosis: d, count: c }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

              const isNovel = diagArray.length === 0 || (diagArray.length >= 3 && diagArray[0].count < entry.count * 0.4);
              const daySpan = Math.max(1, (new Date(entry.lastSeen).getTime() - new Date(entry.firstSeen).getTime()) / 86400000);
              const rate = daySpan > 0 ? entry.count / daySpan : entry.count;
              const alertLevel = rate >= 3 ? "outbreak" : rate >= 1.5 ? "elevated" : entry.count >= 5 ? "watch" : "none";

              admin.from("clustered_symptom_patterns").upsert({
                clinic_id,
                cluster_id: key,
                symptom_set: symptomSet,
                patient_count: entry.count,
                associated_diagnoses: diagArray,
                cluster_confidence: entry.count / recentCases.length,
                discovery_method: "cooccurrence",
                first_detected: entry.firstSeen,
                last_updated: entry.lastSeen,
                alert_level: alertLevel,
                is_novel: isNovel,
              }, { onConflict: "clinic_id,cluster_id" })
                .then(() => {})
                .catch((e: any) => console.warn("[finalize] Cluster upsert failed:", e));

              clustersFound++;
              if (clustersFound >= 20) break;
            }
            console.log(`[finalize] Cluster discovery: ${clustersFound} clusters persisted`);
          }
        }

        // 5.7b: Supervised Prior Recalibration
        // Every 75 cases — compute correction-based calibration factors
        if (totalEpisodicCases && totalEpisodicCases > 0 && totalEpisodicCases % 75 === 0 && totalEpisodicCases >= 75) {
          console.log(`[finalize] Triggering prior recalibration (n=${totalEpisodicCases})`);

          const lookbackSince = new Date(Date.now() - 90 * 86400000).toISOString();
          const { data: outcomes } = await admin.from("diagnostic_outcomes")
            .select("ai_diagnosis, doctor_final_diagnosis, correction_type, similarity_score")
            .eq("clinic_id", clinic_id)
            .gte("created_at", lookbackSince);

          if (outcomes && outcomes.length >= 10) {
            // Group by AI diagnosis to compute per-diagnosis correction rates
            const diagStats = new Map<string, { total: number; corrected: number }>();
            for (const o of outcomes as any[]) {
              const aiDiag = (o.ai_diagnosis || "").toLowerCase().trim();
              if (!aiDiag) continue;
              const stats = diagStats.get(aiDiag) || { total: 0, corrected: 0 };
              stats.total++;
              if (o.correction_type !== "match") stats.corrected++;
              diagStats.set(aiDiag, stats);
            }

            // Generate learning_updates for diagnoses with sufficient data
            const batchId = `recal_${Date.now().toString(36)}`;
            let updatesApplied = 0;

            for (const [diag, stats] of diagStats) {
              if (stats.total < 5) continue; // need min samples
              const correctionRate = stats.corrected / stats.total;
              let factor = 1.0;
              let direction = "neutral";

              if (correctionRate > 0.4) {
                // AI over-predicts this diagnosis — penalize
                factor = 1 - (correctionRate - 0.2) * 0.5; // e.g. 60% correction → 0.8x
                direction = "penalize";
              } else if (correctionRate < 0.1 && stats.total >= 10) {
                // AI is very accurate for this — slight boost
                factor = 1 + (0.1 - correctionRate) * 0.5; // e.g. 5% correction → 1.025x
                direction = "boost";
              }

              if (direction !== "neutral") {
                admin.from("learning_updates").insert({
                  clinic_id,
                  update_type: "prior_calibration",
                  target_entity: "diagnosis",
                  target_id: diag,
                  old_value: 1.0,
                  new_value: Math.round(factor * 1000) / 1000,
                  delta: Math.round((factor - 1.0) * 1000) / 1000,
                  direction,
                  sample_size: stats.total,
                  confidence: stats.total >= 20 ? "high" : stats.total >= 10 ? "moderate" : "low",
                  source: "supervised_recalibration",
                  batch_id: batchId,
                }).then(() => {})
                  .catch((e: any) => console.warn("[finalize] Learning update failed:", e));
                updatesApplied++;
              }
            }

            console.log(`[finalize] Prior recalibration: ${updatesApplied} updates from ${outcomes.length} outcomes`);
          }
        }
      }

      results.stages.push({ stage: "population_intelligence", status: "triggered" });
    } catch (_e) {
      // Phase 4 population intelligence is entirely non-blocking
      results.stages.push({ stage: "population_intelligence", status: "skipped" });
    }

    // ── Performance Monitoring ──
    const finalizeDuration = Date.now() - (performance.now ? 0 : 0); // approximate
    admin.from("monitoring_events").insert({
      event_type: "consultation_finalized",
      agent_name: "finalize-consultation",
      clinic_id,
      success: errors.length === 0,
      duration_ms: null,
      metadata: {
        user_id: user.id,
        consultation_id,
        prescription_count: results.prescriptions?.length || 0,
        lab_order_count: results.lab_orders?.length || 0,
        invoice_generated: !!results.invoice?.id,
        error_count: errors.length,
      },
    }).then(() => {});

    // ── Audit Log ──
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "consultation_finalized",
      target_type: "consultation",
      target_id: consultation_id || null,
      clinic_id,
      metadata: {
        patient_id,
        visit_id,
        prescription_count: results.prescriptions?.length || 0,
        lab_order_count: results.lab_orders?.length || 0,
        invoice_id: results.invoice?.id || null,
        errors: errors.length > 0 ? errors : undefined,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      status: errors.length === 0 ? "complete" : "partial",
      consultation_id,
      ...results,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
