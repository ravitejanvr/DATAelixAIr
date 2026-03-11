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

    // Load frequency dictionary for validation
    const { data: freqDict } = await admin.from("dose_frequency_dictionary").select("code, meaning, times_per_day");
    const freqMap = new Map((freqDict || []).map((f: any) => [f.code.toUpperCase(), f]));

    const validDrugs = drugs.filter((d: any) => d.drug_name?.trim()).slice(0, 50);
    if (validDrugs.length === 0) return new Response(JSON.stringify({ error: "No valid drugs provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allergyWarnings: any[] = [];
    const doseWarnings: any[] = [];
    const interactionWarnings: any[] = [];
    const normalizationResults: any[] = [];
    const rows: any[] = [];
    const resolvedGenerics: string[] = [];

    for (const d of validDrugs) {
      // ─── Normalize via normalize-drug-name ───
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

      if (!genericName?.trim()) continue;
      resolvedGenerics.push(genericName.toLowerCase());

      // ─── Parse dose_value ───
      let doseValue = d.dose_value ?? null;
      let doseUnit = d.dose_unit || "mg";
      if (!doseValue && d.dosage) {
        const match = String(d.dosage).match(/(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|%)?/i);
        if (match) {
          doseValue = parseFloat(match[1]);
          if (match[2]) doseUnit = match[2].toLowerCase();
        }
      }

      // ─── Frequency standardization ───
      let frequencyCode = (d.frequency_code || d.frequency || "OD").toUpperCase().trim();
      const freqEntry = freqMap.get(frequencyCode);
      const timesPerDay = freqEntry?.times_per_day ?? 1;
      const frequencyMeaning = freqEntry?.meaning || frequencyCode;

      // ─── Duration parsing ───
      let durationDays: number | null = d.duration_days || null;
      if (!durationDays && d.duration) {
        const durMatch = String(d.duration).match(/(\d+)\s*(day|days|d)/i);
        if (durMatch) durationDays = parseInt(durMatch[1]);
        const weekMatch = String(d.duration).match(/(\d+)\s*(week|weeks|w)/i);
        if (weekMatch) durationDays = parseInt(weekMatch[1]) * 7;
      }

      const frequency = d.frequency || frequencyMeaning;
      const duration = d.duration || (durationDays ? `${durationDays} days` : "5 days");
      const route = d.route || "oral";

      // ─── Allergy check ───
      const allergies: string[] = Array.isArray(patient_allergies) ? patient_allergies.map((a: string) => a.toLowerCase()) : [];
      const nameLower = genericName.toLowerCase();
      for (const a of allergies) {
        if (nameLower.includes(a) || a.includes(nameLower)) {
          allergyWarnings.push({ drug: genericName, allergy: a, severity: "critical" });
        }
      }

      // ─── Dose safety validation ───
      let maxDailyDose: number | null = d.max_daily_dose || null;
      let guidelineReference: string | null = null;

      if (drugCui) {
        try {
          const { data: guidelineData } = await admin
            .from("drug_dose_guidelines")
            .select("adult_standard_dose, adult_max_dose, pediatric_dose, renal_adjustment, hepatic_adjustment, contraindications")
            .eq("ingredient_cui", drugCui)
            .limit(1)
            .maybeSingle();

          if (guidelineData) {
            // Parse max daily dose
            if (guidelineData.adult_max_dose) {
              const maxMatch = String(guidelineData.adult_max_dose).match(/(\d+(?:\.\d+)?)/);
              if (maxMatch) maxDailyDose = parseFloat(maxMatch[1]);
            }

            guidelineReference = `Standard: ${guidelineData.adult_standard_dose}, Max: ${guidelineData.adult_max_dose}`;

            // Check dose limit
            if (doseValue && maxDailyDose && timesPerDay > 0) {
              const dailyTotal = doseValue * timesPerDay;
              if (dailyTotal > maxDailyDose) {
                doseWarnings.push({
                  drug: genericName,
                  dose_per_take: `${doseValue} ${doseUnit}`,
                  frequency: frequencyCode,
                  daily_total: `${dailyTotal} ${doseUnit}`,
                  max_allowed: `${maxDailyDose} ${doseUnit}/day`,
                  severity: dailyTotal > maxDailyDose * 1.5 ? "critical" : "high",
                  message: `Daily dose ${dailyTotal}${doseUnit} exceeds max ${maxDailyDose}${doseUnit}/day for ${genericName}`,
                });
              }
            }

            // Check contraindications
            if (guidelineData.contraindications) {
              const contras = Array.isArray(guidelineData.contraindications)
                ? guidelineData.contraindications
                : [];
              for (const contra of contras) {
                const contraLower = String(contra).toLowerCase();
                // Check against allergies
                if (allergies.some(a => contraLower.includes(a) || a.includes(contraLower))) {
                  doseWarnings.push({
                    drug: genericName,
                    severity: "high",
                    message: `Contraindication: ${contra}`,
                  });
                }
              }
            }
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
        frequency_code: frequencyCode,
        duration: String(duration).substring(0, 100),
        duration_days: durationDays,
        route: String(route).substring(0, 50),
        instructions: String(d.instructions || "").substring(0, 500),
        max_daily_dose: maxDailyDose,
        drug_cui: drugCui,
        guideline_reference: guidelineReference,
      });
    }

    // ─── Drug-drug interaction checks ───
    if (resolvedGenerics.length >= 2) {
      try {
        // Check all pairs
        const { data: interactions } = await admin
          .from("drug_interactions")
          .select("drug_a, drug_b, severity, interaction_description, recommended_action")
          .or(
            resolvedGenerics.map(n => `drug_a.ilike.%${n}%`).join(",") + "," +
            resolvedGenerics.map(n => `drug_b.ilike.%${n}%`).join(",")
          );

        if (interactions) {
          for (const inter of interactions) {
            const aLower = inter.drug_a.toLowerCase();
            const bLower = inter.drug_b.toLowerCase();
            const hasA = resolvedGenerics.some(g => aLower.includes(g) || g.includes(aLower));
            const hasB = resolvedGenerics.some(g => bLower.includes(g) || g.includes(bLower));
            if (hasA && hasB) {
              interactionWarnings.push({
                drug_a: inter.drug_a,
                drug_b: inter.drug_b,
                severity: inter.severity,
                description: inter.interaction_description,
                recommended_action: inter.recommended_action,
              });
            }
          }
        }
      } catch (e) {
        console.warn("Interaction check failed:", e);
      }
    }

    if (rows.length === 0) return new Response(JSON.stringify({ error: "No valid drugs after validation" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: inserted, error: insertError } = await admin.from("prescriptions").insert(rows).select("id");
    if (insertError) throw new Error(insertError.message);

    // Persist medication alerts for critical issues (non-blocking)
    const criticalAlerts = [
      ...allergyWarnings.map(w => ({
        consultation_id,
        patient_id,
        doctor_id: user.id,
        clinic_id: clinic_id || null,
        alert_type: "allergy_conflict",
        severity: w.severity || "critical",
        drug_a: w.drug,
        allergy_conflict: w.allergy,
        message: `Allergy conflict: ${w.drug} vs documented allergy ${w.allergy}`,
      })),
      ...doseWarnings.filter(w => w.severity === "critical").map(w => ({
        consultation_id,
        patient_id,
        doctor_id: user.id,
        clinic_id: clinic_id || null,
        alert_type: "dose_exceeded",
        severity: w.severity,
        drug_a: w.drug,
        dose_issue: w.daily_total,
        message: w.message,
      })),
      ...interactionWarnings.filter(w => w.severity === "severe").map(w => ({
        consultation_id,
        patient_id,
        doctor_id: user.id,
        clinic_id: clinic_id || null,
        alert_type: "drug_interaction",
        severity: "critical",
        drug_a: w.drug_a,
        drug_b: w.drug_b,
        message: w.description,
      })),
    ];

    if (criticalAlerts.length > 0) {
      admin.from("medication_alerts").insert(criticalAlerts).catch(() => {});
    }

    // Audit (non-blocking)
    admin.from("audit_logs").insert({
      actor_id: user.id,
      event_type: "prescriptions_saved",
      target_type: "consultation",
      target_id: consultation_id,
      clinic_id: clinic_id || null,
      metadata: {
        drug_count: inserted?.length || 0,
        allergy_warnings: allergyWarnings.length,
        dose_warnings: doseWarnings.length,
        interaction_warnings: interactionWarnings.length,
        normalized: normalizationResults.length,
      },
    }).then(() => {});

    return new Response(JSON.stringify({
      prescription_ids: inserted?.map((r: any) => r.id) || [],
      allergy_warnings: allergyWarnings,
      dose_warnings: doseWarnings,
      interaction_warnings: interactionWarnings,
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
