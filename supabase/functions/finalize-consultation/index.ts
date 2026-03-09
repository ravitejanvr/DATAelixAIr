import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      // AI-generated data from the care plan
      extracted_data,
      soap_sections,
      safety_results,
      // Prescription data
      drugs,
      // Lab order data
      lab_orders,
      // Billing
      billing_enabled,
      // Safety override
      safety_override,
      // Report options
      target_language,
    } = body;

    if (!patient_id || !clinic_id) {
      return new Response(JSON.stringify({ error: "patient_id and clinic_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const results: Record<string, any> = { stages: [] };
    const errors: string[] = [];

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

    // ── Stage 1: Save Prescription ──
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
      try {
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
        if (rxError) throw new Error(rxError.message);
        results.prescriptions = rxData;
        results.stages.push({ stage: "prescriptions", status: "saved", count: rxData?.length || 0 });
      } catch (e: any) {
        errors.push(`Prescription: ${e.message}`);
        results.stages.push({ stage: "prescriptions", status: "error", error: e.message });
      }
    } else {
      results.stages.push({ stage: "prescriptions", status: "skipped" });
    }

    // ── Stage 2: Save Lab Orders ──
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
      try {
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

        console.log(`[finalize-consultation] Inserting ${labRows.length} lab orders for consultation=${consultation_id}, visit=${visit_id}`);

        const { data: labData, error: labError } = await admin.from("lab_orders").insert(labRows).select("id, test_name");
        if (labError) throw new Error(labError.message);
        results.lab_orders = labData;
        results.stages.push({ stage: "lab_orders", status: "saved", count: labData?.length || 0 });
        console.log(`[finalize-consultation] Lab orders saved: ${labData?.length || 0}`);
      } catch (e: any) {
        errors.push(`Lab orders: ${e.message}`);
        results.stages.push({ stage: "lab_orders", status: "error", error: e.message });
      }
    } else {
      const reason = !visit_id ? "no_visit_id" : "no_lab_orders";
      console.log(`[finalize-consultation] Lab orders skipped: ${reason} (effectiveLabOrders=${effectiveLabOrders?.length || 0}, visit_id=${visit_id})`);
      results.stages.push({ stage: "lab_orders", status: "skipped", reason });
    }

    // ── Stage 3: Generate Invoice ──
    try {
      // Get clinic settings for fees
      const { data: settings } = await admin.from("clinic_settings").select("consultation_fee").eq("clinic_id", clinic_id).maybeSingle();
      const { data: wfConfig } = await admin.from("clinic_workflow_config").select("default_consultation_fee, billing_enabled").eq("clinic_id", clinic_id).maybeSingle();
      
      const fee = settings?.consultation_fee || wfConfig?.default_consultation_fee || 0;
      const isBillingEnabled = billing_enabled ?? wfConfig?.billing_enabled ?? true;

      if (isBillingEnabled && fee > 0) {
        // Build lab charges from lab catalog prices
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

        if (invError) throw new Error(invError.message);
        results.invoice = invoice;
        results.stages.push({ stage: "invoice", status: "created", total });
      } else {
        results.stages.push({ stage: "invoice", status: "skipped", reason: "billing_disabled_or_zero_fee" });
      }
    } catch (e: any) {
      errors.push(`Invoice: ${e.message}`);
      results.stages.push({ stage: "invoice", status: "error", error: e.message });
    }

    // ── Stage 4: Generate Report ──
    if (consultation_id) {
      try {
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
          throw new Error(reportData.error || "Report generation failed");
        }
      } catch (e: any) {
        errors.push(`Report: ${e.message}`);
        results.stages.push({ stage: "report", status: "error", error: e.message });
      }
    } else {
      results.stages.push({ stage: "report", status: "skipped" });
    }

    // ── Stage 5: Finalize Visit Status ──
    if (visit_id) {
      try {
        const { error: visitError } = await admin.from("patient_visits")
          .update({ status: "complete", consultation_id: consultation_id || null })
          .eq("id", visit_id);
        if (visitError) throw new Error(visitError.message);
        results.stages.push({ stage: "visit_finalized", status: "complete" });
      } catch (e: any) {
        errors.push(`Visit: ${e.message}`);
        results.stages.push({ stage: "visit_finalized", status: "error", error: e.message });
      }
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
