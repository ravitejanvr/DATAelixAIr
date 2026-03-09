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
