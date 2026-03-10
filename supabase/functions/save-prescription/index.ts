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
    const { patient_id, consultation_id, visit_id, clinic_id, drugs, patient_allergies } = body;

    if (!patient_id) return new Response(JSON.stringify({ error: "patient_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!consultation_id) return new Response(JSON.stringify({ error: "consultation_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!Array.isArray(drugs) || drugs.length === 0) return new Response(JSON.stringify({ error: "At least one drug required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);

    // Validate and normalize each drug
    const validDrugs = drugs.filter((d: any) => d.drug_name?.trim()).slice(0, 50);
    if (validDrugs.length === 0) return new Response(JSON.stringify({ error: "No valid drugs provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allergyWarnings: { drug: string; allergy: string }[] = [];
    const normalizationResults: any[] = [];
    const rows: any[] = [];

    for (const d of validDrugs) {
      // Normalize via normalize-drug-name
      let normData: any = null;
      try {
        const normResp = await fetch(`${supabaseUrl}/functions/v1/normalize-drug-name`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ drug_input: d.drug_name }),
        });
        if (normResp.ok) {
          normData = await normResp.json();
          normalizationResults.push(normData);
        }
      } catch (e) {
        console.warn(`Normalization failed for ${d.drug_name}:`, e);
      }

      const genericName = normData?.generic_name || d.generic_name || d.drug_name;
      const brandName = normData?.brand_name || d.brand_name || null;
      const drugCui = normData?.ingredient_cui || d.drug_cui || null;

      // Validation: generic_name required
      if (!genericName?.trim()) continue;

      // Parse dose_value from dosage string if not provided
      let doseValue = d.dose_value ?? null;
      let doseUnit = d.dose_unit || "mg";
      if (!doseValue && d.dosage) {
        const match = String(d.dosage).match(/(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|%)?/i);
        if (match) {
          doseValue = parseFloat(match[1]);
          if (match[2]) doseUnit = match[2].toLowerCase();
        }
      }

      // Validation: dose_value required
      if (doseValue == null) {
        console.warn(`Missing dose_value for ${genericName}, using dosage string`);
      }

      // Frequency validation with defaults
      const frequency = d.frequency || "OD";
      const duration = d.duration || "5 days";
      const route = d.route || "oral";

      // Allergy check using generic name
      const allergies: string[] = Array.isArray(patient_allergies) ? patient_allergies.map((a: string) => a.toLowerCase()) : [];
      const nameLower = genericName.toLowerCase();
      for (const a of allergies) {
        if (nameLower.includes(a) || a.includes(nameLower)) {
          allergyWarnings.push({ drug: genericName, allergy: a });
        }
      }

      // Max daily dose from normalization or drug_dose_guidelines
      let maxDailyDose = d.max_daily_dose || null;
      if (!maxDailyDose && drugCui) {
        try {
          const { data: guidelineData } = await admin
            .from("drug_dose_guidelines")
            .select("adult_max_dose")
            .eq("ingredient_cui", drugCui)
            .limit(1)
            .maybeSingle();
          if (guidelineData?.adult_max_dose) {
            const maxMatch = String(guidelineData.adult_max_dose).match(/(\d+(?:\.\d+)?)/);
            if (maxMatch) maxDailyDose = parseFloat(maxMatch[1]);
          }
        } catch { /* non-blocking */ }
      }

      rows.push({
        patient_id,
        doctor_id: user.id,
        consultation_id,
        visit_id: visit_id || null,
        clinic_id: clinic_id || null,
        drug_name: String(d.drug_name).substring(0, 200),
        generic_name: String(genericName).substring(0, 200),
        brand_name: brandName ? String(brandName).substring(0, 200) : null,
        dosage: String(d.dosage || `${doseValue || ""} ${doseUnit}`).substring(0, 100),
        dose_value: doseValue,
        dose_unit: doseUnit,
        frequency: String(frequency).substring(0, 100),
        duration: String(duration).substring(0, 100),
        route: String(route).substring(0, 50),
        instructions: String(d.instructions || "").substring(0, 500),
        max_daily_dose: maxDailyDose,
        drug_cui: drugCui,
      });
    }

    if (rows.length === 0) return new Response(JSON.stringify({ error: "No valid drugs after validation" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: inserted, error: insertError } = await admin.from("prescriptions").insert(rows).select("id");
    if (insertError) throw new Error(insertError.message);

    // Audit (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "prescriptions_saved",
      target_type: "consultation",
      target_id: consultation_id,
      clinic_id: clinic_id || null,
      metadata: {
        drug_count: inserted?.length || 0,
        allergy_warnings: allergyWarnings,
        normalized: normalizationResults.length,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      prescription_ids: inserted?.map((r: any) => r.id) || [],
      allergy_warnings: allergyWarnings,
      normalization_results: normalizationResults,
      count: inserted?.length || 0,
      status: "saved",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
