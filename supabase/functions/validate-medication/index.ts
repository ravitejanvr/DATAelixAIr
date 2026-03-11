import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MedicationOrder {
  drug_input: string;
  drug_generic?: string;
  drug_brand?: string;
  ingredient_id?: string;
  dose_value?: number;
  dose_unit?: string;
  frequency?: string;
  route?: string;
  duration_days?: number;
  indication?: string;
}

interface ValidationWarning {
  type: "allergy" | "interaction" | "dose_exceeded" | "pediatric_dose" | "contraindication" | "indication_mismatch" | "duplicate_ingredient";
  severity: "critical" | "high" | "moderate" | "low";
  drug: string;
  message: string;
  details?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      medications,
      patient_allergies = [],
      patient_weight_kg,
      patient_age,
      patient_diagnoses = [],
      existing_medications = [],
    }: {
      medications: MedicationOrder[];
      patient_allergies: string[];
      patient_weight_kg?: number | null;
      patient_age?: number | null;
      patient_diagnoses: string[];
      existing_medications: string[];
    } = body;

    if (!Array.isArray(medications) || medications.length === 0) {
      return new Response(JSON.stringify({ error: "medications array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = Date.now();
    const warnings: ValidationWarning[] = [];
    const normalizedMeds: Array<{
      original: string;
      generic_name: string | null;
      brand_name: string | null;
      ingredient_cui: string | null;
      dose_value: number | null;
      dose_unit: string;
      frequency_code: string;
      times_per_day: number;
      route: string;
      duration_days: number | null;
      max_daily_dose: number | null;
      pediatric_dose: string | null;
      mg_per_kg: number | null;
      renal_adjustment: string | null;
      hepatic_adjustment: string | null;
      pregnancy_category: string | null;
      contraindications: string[];
      indication: string | null;
      guideline_reference: string | null;
      safety_score: number;
    }> = [];

    // Load frequency dictionary
    const { data: freqDict } = await admin.from("dose_frequency_dictionary").select("code, meaning, times_per_day");
    const freqMap = new Map((freqDict || []).map((f: any) => [f.code.toUpperCase(), f]));

    const isPediatric = patient_age != null && patient_age < 18;
    const allergiesLower = patient_allergies.map((a: string) => a.toLowerCase().trim());
    const resolvedIngredients: Array<{ generic: string; cui: string | null; original: string }> = [];

    // ── Process each medication ──
    for (const med of medications) {
      const drugInput = (med.drug_input || med.drug_generic || med.drug_brand || "").trim();
      if (!drugInput) continue;

      let safetyScore = 100;

      // 1. NORMALIZATION — Brand → Generic → Ingredient
      let normData: any = null;
      try {
        const normResp = await fetch(`${supabaseUrl}/functions/v1/normalize-drug-name`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ drug_input: drugInput }),
        });
        if (normResp.ok) normData = await normResp.json();
      } catch { /* fallback below */ }

      const genericName = normData?.generic_name || med.drug_generic || drugInput;
      const brandName = normData?.brand_name || med.drug_brand || null;
      const ingredientCui = normData?.ingredient_cui || med.ingredient_id || null;

      // 2. DUPLICATE INGREDIENT CHECK
      if (ingredientCui) {
        const existing = resolvedIngredients.find(r => r.cui === ingredientCui);
        if (existing) {
          warnings.push({
            type: "duplicate_ingredient",
            severity: "high",
            drug: genericName,
            message: `Duplicate ingredient: ${genericName} shares the same active ingredient as ${existing.original}`,
            details: { existing_drug: existing.original, ingredient_cui: ingredientCui },
          });
          safetyScore -= 20;
        }
      }
      // Also check existing_medications
      const existingLower = existing_medications.map(m => m.toLowerCase());
      if (existingLower.includes(genericName.toLowerCase())) {
        warnings.push({
          type: "duplicate_ingredient",
          severity: "moderate",
          drug: genericName,
          message: `${genericName} is already in the patient's current medications`,
        });
        safetyScore -= 10;
      }

      resolvedIngredients.push({ generic: genericName, cui: ingredientCui, original: drugInput });

      // Parse dose
      let doseValue = med.dose_value ?? null;
      let doseUnit = med.dose_unit || "mg";
      if (!doseValue && med.drug_input) {
        const match = drugInput.match(/(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|%)?/i);
        if (match) { doseValue = parseFloat(match[1]); if (match[2]) doseUnit = match[2].toLowerCase(); }
      }

      // Frequency
      const freqCode = (med.frequency || "OD").toUpperCase().trim();
      const freqEntry = freqMap.get(freqCode);
      const timesPerDay = freqEntry?.times_per_day ?? 1;
      const route = med.route || "oral";
      const durationDays = med.duration_days || null;

      // 3. ALLERGY CONFLICT DETECTION
      const nameLower = genericName.toLowerCase();
      for (const allergy of allergiesLower) {
        if (nameLower.includes(allergy) || allergy.includes(nameLower)) {
          warnings.push({
            type: "allergy",
            severity: "critical",
            drug: genericName,
            message: `ALLERGY CONFLICT: ${genericName} matches documented allergy "${allergy}"`,
            details: { allergy, drug: genericName },
          });
          safetyScore -= 40;
        }
      }

      // Also check cross-reactivity classes
      const penicillinClass = ["amoxicillin", "ampicillin", "penicillin", "piperacillin", "flucloxacillin"];
      const cephalosporinClass = ["cephalexin", "cefixime", "ceftriaxone", "cefuroxime"];
      if (allergiesLower.some(a => penicillinClass.includes(a)) && penicillinClass.includes(nameLower)) {
        if (!warnings.some(w => w.type === "allergy" && w.drug === genericName)) {
          warnings.push({
            type: "allergy",
            severity: "critical",
            drug: genericName,
            message: `Cross-reactivity risk: ${genericName} is a penicillin-class drug and patient has penicillin allergy`,
          });
          safetyScore -= 30;
        }
      }
      if (allergiesLower.some(a => penicillinClass.includes(a)) && cephalosporinClass.includes(nameLower)) {
        warnings.push({
          type: "allergy",
          severity: "high",
          drug: genericName,
          message: `Possible cross-reactivity: ${genericName} (cephalosporin) with penicillin allergy (2-5% risk)`,
        });
        safetyScore -= 15;
      }

      // 4. DOSE SAFETY & GUIDELINE LOOKUP
      let maxDailyDose: number | null = null;
      let pediatricDose: string | null = null;
      let mgPerKg: number | null = null;
      let renalAdj: string | null = null;
      let hepaticAdj: string | null = null;
      let pregnancyCat: string | null = null;
      let contraindications: string[] = [];
      let guidelineRef: string | null = null;

      if (ingredientCui) {
        const { data: guidelines } = await admin
          .from("drug_dose_guidelines")
          .select("*")
          .eq("ingredient_cui", ingredientCui)
          .limit(1)
          .maybeSingle();

        if (guidelines) {
          // Parse max daily dose
          if (guidelines.adult_max_dose) {
            const maxMatch = String(guidelines.adult_max_dose).match(/(\d+(?:\.\d+)?)/);
            if (maxMatch) maxDailyDose = parseFloat(maxMatch[1]);
          }
          pediatricDose = guidelines.pediatric_dose || null;
          renalAdj = guidelines.renal_adjustment || null;
          hepaticAdj = guidelines.hepatic_adjustment || null;
          guidelineRef = `Standard: ${guidelines.adult_standard_dose}, Max: ${guidelines.adult_max_dose}`;

          // Parse mg/kg from pediatric dose
          if (pediatricDose) {
            const mgKgMatch = pediatricDose.match(/(\d+(?:\.\d+)?)\s*mg\/kg/i);
            if (mgKgMatch) mgPerKg = parseFloat(mgKgMatch[1]);
          }

          // Contraindications
          if (Array.isArray(guidelines.contraindications)) {
            contraindications = guidelines.contraindications.map(String);
          }

          // Check dose limit (adult)
          if (doseValue && maxDailyDose && timesPerDay > 0) {
            const dailyTotal = doseValue * timesPerDay;
            if (dailyTotal > maxDailyDose) {
              warnings.push({
                type: "dose_exceeded",
                severity: dailyTotal > maxDailyDose * 1.5 ? "critical" : "high",
                drug: genericName,
                message: `Daily dose ${dailyTotal}${doseUnit} exceeds max ${maxDailyDose}${doseUnit}/day`,
                details: { dose_per_take: doseValue, frequency: freqCode, daily_total: dailyTotal, max_allowed: maxDailyDose },
              });
              safetyScore -= dailyTotal > maxDailyDose * 1.5 ? 30 : 15;
            }
          }
        }

        // Get pregnancy category from drug_master
        const { data: masterData } = await admin
          .from("drug_master")
          .select("pregnancy_category, max_daily_dose_mg")
          .ilike("generic_name", genericName)
          .limit(1)
          .maybeSingle();

        if (masterData) {
          pregnancyCat = masterData.pregnancy_category || null;
          if (!maxDailyDose && masterData.max_daily_dose_mg) {
            maxDailyDose = masterData.max_daily_dose_mg;
          }
        }
      }

      // 5. PEDIATRIC DOSE VALIDATION
      if (isPediatric && doseValue && patient_weight_kg && mgPerKg) {
        const recommendedDose = mgPerKg * patient_weight_kg;
        if (doseValue > recommendedDose * 1.2) {
          warnings.push({
            type: "pediatric_dose",
            severity: doseValue > recommendedDose * 1.5 ? "critical" : "high",
            drug: genericName,
            message: `Pediatric dose ${doseValue}${doseUnit} exceeds recommended ${recommendedDose.toFixed(1)}${doseUnit} (${mgPerKg}mg/kg × ${patient_weight_kg}kg)`,
            details: { mg_per_kg: mgPerKg, weight_kg: patient_weight_kg, recommended: recommendedDose, actual: doseValue },
          });
          safetyScore -= 25;
        }
      } else if (isPediatric && !patient_weight_kg && mgPerKg) {
        warnings.push({
          type: "pediatric_dose",
          severity: "moderate",
          drug: genericName,
          message: `Weight required for pediatric dose calculation of ${genericName} (${mgPerKg}mg/kg)`,
        });
        safetyScore -= 5;
      }

      // 6. CONTRAINDICATION CHECK against diagnoses
      for (const contra of contraindications) {
        const contraLower = contra.toLowerCase();
        for (const dx of patient_diagnoses) {
          if (contraLower.includes(dx.toLowerCase()) || dx.toLowerCase().includes(contraLower)) {
            warnings.push({
              type: "contraindication",
              severity: "high",
              drug: genericName,
              message: `Contraindication: ${genericName} contraindicated in ${dx} (${contra})`,
              details: { contraindication: contra, diagnosis: dx },
            });
            safetyScore -= 20;
          }
        }
      }

      // 7. INDICATION VALIDATION
      let indicationValid = false;
      if (ingredientCui || genericName) {
        const { data: indications } = await admin
          .from("diagnosis_drug_map")
          .select("diagnosis_id, diagnoses!inner(diagnosis_name), line_of_treatment")
          .ilike("generic_name", genericName)
          .limit(10);

        if (indications && indications.length > 0) {
          const indicationNames = indications.map((ind: any) => (ind.diagnoses?.diagnosis_name || "").toLowerCase());
          indicationValid = patient_diagnoses.some(dx => 
            indicationNames.some(ind => ind.includes(dx.toLowerCase()) || dx.toLowerCase().includes(ind))
          );
          if (!indicationValid && patient_diagnoses.length > 0) {
            warnings.push({
              type: "indication_mismatch",
              severity: "low",
              drug: genericName,
              message: `${genericName} is not a standard treatment for: ${patient_diagnoses.join(", ")}`,
              details: { known_indications: indicationNames, patient_diagnoses },
            });
            safetyScore -= 5;
          }
        }
      }

      normalizedMeds.push({
        original: drugInput,
        generic_name: genericName,
        brand_name: brandName,
        ingredient_cui: ingredientCui,
        dose_value: doseValue,
        dose_unit: doseUnit,
        frequency_code: freqCode,
        times_per_day: timesPerDay,
        route,
        duration_days: durationDays,
        max_daily_dose: maxDailyDose,
        pediatric_dose: pediatricDose,
        mg_per_kg: mgPerKg,
        renal_adjustment: renalAdj,
        hepatic_adjustment: hepaticAdj,
        pregnancy_category: pregnancyCat,
        contraindications,
        indication: med.indication || null,
        guideline_reference: guidelineRef,
        safety_score: Math.max(0, safetyScore),
      });
    }

    // 8. DRUG-DRUG INTERACTION CHECK (all pairs)
    const allGenerics = [
      ...resolvedIngredients.map(r => r.generic.toLowerCase()),
      ...existing_medications.map(m => m.toLowerCase()),
    ];

    if (allGenerics.length >= 2) {
      const { data: interactions } = await admin
        .from("drug_interactions")
        .select("drug_a, drug_b, severity, interaction_description, recommended_action")
        .or(
          allGenerics.map(n => `drug_a.ilike.%${n}%`).join(",") + "," +
          allGenerics.map(n => `drug_b.ilike.%${n}%`).join(",")
        );

      if (interactions) {
        for (const inter of interactions) {
          const aLower = inter.drug_a.toLowerCase();
          const bLower = inter.drug_b.toLowerCase();
          const hasA = allGenerics.some(g => aLower.includes(g) || g.includes(aLower));
          const hasB = allGenerics.some(g => bLower.includes(g) || g.includes(bLower));
          if (hasA && hasB) {
            warnings.push({
              type: "interaction",
              severity: inter.severity === "severe" ? "critical" : inter.severity === "moderate" ? "high" : "moderate",
              drug: `${inter.drug_a} ↔ ${inter.drug_b}`,
              message: inter.interaction_description || `Interaction between ${inter.drug_a} and ${inter.drug_b}`,
              details: {
                drug_a: inter.drug_a,
                drug_b: inter.drug_b,
                severity: inter.severity,
                mechanism: inter.interaction_description,
                recommended_action: inter.recommended_action,
              },
            });
            // Reduce safety score of both drugs
            for (const nm of normalizedMeds) {
              if (nm.generic_name?.toLowerCase() === aLower || nm.generic_name?.toLowerCase() === bLower) {
                nm.safety_score = Math.max(0, nm.safety_score - 15);
              }
            }
          }
        }
      }
    }

    // Calculate aggregate safety score
    const avgSafetyScore = normalizedMeds.length > 0
      ? Math.round(normalizedMeds.reduce((s, m) => s + m.safety_score, 0) / normalizedMeds.length)
      : 100;

    const criticalCount = warnings.filter(w => w.severity === "critical").length;
    const highCount = warnings.filter(w => w.severity === "high").length;

    const duration_ms = Date.now() - start;

    return new Response(JSON.stringify({
      medications: normalizedMeds,
      warnings,
      summary: {
        total_medications: normalizedMeds.length,
        total_warnings: warnings.length,
        critical_warnings: criticalCount,
        high_warnings: highCount,
        safety_score: avgSafetyScore,
        is_pediatric: isPediatric,
        validation_ms: duration_ms,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("validate-medication error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
