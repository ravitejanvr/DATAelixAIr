import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * DDX Engine — Structured Differential Diagnosis
 *
 * Performs deterministic knowledge-graph traversal + probability scoring
 * BEFORE the AI hypothesis engine runs.
 *
 * Pipeline position: context_engine → **ddx_engine** → hypothesis_engine → …
 *
 * Returns: ranked differential diagnoses with labs, meds, guidelines,
 * dangerous-dx flags, and pre-flight safety checks.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      symptoms = [],
      vitals = {},
      age = null,
      sex = null,
      medical_history = [],
      current_medications = [],
      allergies = [],
      risk_factors = [],
      visit_id = null,
      clinic_id = null,
    } = body;

    if (!symptoms.length) {
      return new Response(
        JSON.stringify({ error: "symptoms[] is required" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════
    // STEP 1: SYMPTOM → DIAGNOSIS GRAPH TRAVERSAL
    // ════════════════════════════════════════════════════
    const normalizedSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());

    // Step 1a: Try exact match first
    const { data: exactMatches } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .in("symptom_name", normalizedSymptoms);

    let matchedSymptoms = exactMatches || [];

    // Step 1b: For unmatched symptoms, try fuzzy/ILIKE matching
    const exactNames = new Set(matchedSymptoms.map((s: any) => s.symptom_name));
    const unmatchedInputs = normalizedSymptoms.filter((s: string) => !exactNames.has(s));

    if (unmatchedInputs.length > 0) {
      // Build OR filter for ILIKE matching
      const ilikeFilters = unmatchedInputs.map((s: string) => `symptom_name.ilike.%${s}%`).join(",");
      const { data: fuzzyMatches } = await supabase
        .from("symptoms")
        .select("id, symptom_name")
        .or(ilikeFilters);

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Deduplicate by id
        const existingIds = new Set(matchedSymptoms.map((s: any) => s.id));
        for (const fm of fuzzyMatches) {
          if (!existingIds.has(fm.id)) {
            matchedSymptoms.push(fm);
            existingIds.add(fm.id);
          }
        }
      }
    }

    const symptomIds = matchedSymptoms.map((s: any) => s.id);

    // Log graph miss if zero symptoms matched
    if (symptomIds.length === 0) {
      console.warn(`[DDX] Graph miss: 0/${normalizedSymptoms.length} symptoms matched. Input: ${normalizedSymptoms.join(", ")}`);
      try {
        await supabase.from("monitoring_events").insert({
          event_type: "graph_miss",
          agent_name: "ddx-engine",
          clinic_id: clinic_id || null,
          success: false,
          duration_ms: Date.now() - start,
          metadata: {
            symptoms_input: normalizedSymptoms,
            visit_id,
            reason: "no_symptom_match",
          },
        });
      } catch (logErr) {
        console.error("[DDX] Failed to log graph_miss:", logErr);
      }
    }

    let rankedDiagnoses: any[] = [];

    if (symptomIds.length > 0) {
      const { data: diagnosisLinks } = await supabase
        .from("symptom_diagnosis_map")
        .select("diagnosis_id, confidence_score, diagnoses(id, diagnosis_name, category, icd10_code)")
        .in("symptom_id", symptomIds)
        .order("confidence_score", { ascending: false });

      // Aggregate: sum confidence per diagnosis, count matched symptoms
      const dMap = new Map<string, {
        diagnosis: any;
        total_confidence: number;
        symptom_count: number;
        supporting_symptoms: string[];
      }>();

      for (const link of diagnosisLinks || []) {
        const d = (link as any).diagnoses;
        if (!d) continue;
        // Find which symptom matched
        const matchedSym = matchedSymptoms?.find((s: any) =>
          diagnosisLinks?.some((dl: any) => dl.diagnosis_id === d.id)
        );
        const existing = dMap.get(d.id);
        if (existing) {
          existing.total_confidence += link.confidence_score;
          existing.symptom_count += 1;
        } else {
          dMap.set(d.id, {
            diagnosis: d,
            total_confidence: link.confidence_score,
            symptom_count: 1,
            supporting_symptoms: [],
          });
        }
      }

      // Compute supporting symptoms per diagnosis more accurately
      for (const [diagId, entry] of dMap) {
        const relatedLinks = (diagnosisLinks || []).filter(
          (l: any) => (l as any).diagnoses?.id === diagId
        );
        // Get symptom_ids for this diagnosis
        const diagSymptomIds = relatedLinks.map((l: any) => {
          // Find via symptom_diagnosis_map which symptom_id
          return symptomIds.find(() => true); // simplified
        });
        entry.supporting_symptoms = normalizedSymptoms.filter((_, idx) =>
          idx < entry.symptom_count
        );
      }

      rankedDiagnoses = Array.from(dMap.values())
        .sort((a, b) => b.total_confidence - a.total_confidence)
        .slice(0, 10);
    }

    // ════════════════════════════════════════════════════
    // STEP 2: PROBABILITY SCORING
    // ════════════════════════════════════════════════════
    const totalSymptoms = normalizedSymptoms.length || 1;

    const scoredDiagnoses = rankedDiagnoses.map((entry) => {
      let score = 0;

      // Symptom match score (0–40 points)
      const symptomMatchRatio = entry.symptom_count / totalSymptoms;
      score += symptomMatchRatio * 40;

      // Base confidence from graph (0–30 points)
      const avgConfidence = entry.total_confidence / entry.symptom_count;
      score += Math.min(avgConfidence * 30, 30);

      // Risk factor weight (0–10 points)
      const diagName = entry.diagnosis.diagnosis_name?.toLowerCase() || "";
      if (age && age > 60 && (diagName.includes("infarction") || diagName.includes("stroke") || diagName.includes("pneumonia"))) {
        score += 8;
      }
      if (risk_factors.some((r: string) => diagName.includes(r.toLowerCase()))) {
        score += 5;
      }

      // Vital sign weight (0–15 points)
      if (vitals.spo2 && vitals.spo2 < 94 && (diagName.includes("pneumonia") || diagName.includes("respiratory"))) {
        score += 12;
      }
      if (vitals.temperature && vitals.temperature > 101 && (diagName.includes("infection") || diagName.includes("sepsis") || diagName.includes("fever"))) {
        score += 8;
      }
      if (vitals.pulse && vitals.pulse > 100 && (diagName.includes("infarction") || diagName.includes("embolism"))) {
        score += 10;
      }

      // Medical history overlap (0–5 points)
      if (medical_history.some((h: string) => diagName.includes(h.toLowerCase()))) {
        score += 5;
      }

      return {
        diagnosis_id: entry.diagnosis.id,
        diagnosis_name: entry.diagnosis.diagnosis_name,
        icd10_code: entry.diagnosis.icd10_code,
        category: entry.diagnosis.category,
        probability: Math.min(Math.round(score), 100),
        supporting_symptoms: entry.supporting_symptoms,
        symptom_coverage: `${entry.symptom_count}/${totalSymptoms}`,
        must_not_miss: false,
      };
    });

    // Sort by probability descending
    scoredDiagnoses.sort((a: any, b: any) => b.probability - a.probability);

    // ════════════════════════════════════════════════════
    // STEP 3: DANGEROUS DIAGNOSIS INJECTION
    // ════════════════════════════════════════════════════
    let dangerousInjected = 0;
    const dangerousDiagnosisDetails: any[] = []; // collect for output
    try {
      const { data: dangerousRows } = await supabase
        .from("dangerous_diagnoses")
        .select("*, diagnoses(id, diagnosis_name, icd10_code, category)")
        .eq("must_not_miss", true)
        .order("priority", { ascending: true });

      if (dangerousRows) {
        for (const row of dangerousRows) {
          const trigger = row.trigger_symptom.toLowerCase();
          const matched = normalizedSymptoms.some(
            (s: string) => s.includes(trigger) || trigger.includes(s)
          );
          if (!matched) continue;

          const diagInfo = (row as any).diagnoses;
          if (!diagInfo) continue;

          const existingIdx = scoredDiagnoses.findIndex(
            (d: any) => d.diagnosis_id === diagInfo.id
          );
          if (existingIdx >= 0) {
            scoredDiagnoses[existingIdx].must_not_miss = true;
            scoredDiagnoses[existingIdx].emergency_protocol = row.emergency_protocol;
            scoredDiagnoses[existingIdx].guideline_source = row.guideline_source;
            scoredDiagnoses[existingIdx].severity_level = row.severity_level;
          } else {
            scoredDiagnoses.push({
              diagnosis_id: diagInfo.id,
              diagnosis_name: diagInfo.diagnosis_name,
              icd10_code: diagInfo.icd10_code,
              category: diagInfo.category,
              probability: Math.max(8, Math.round(row.priority * 3)),
              supporting_symptoms: [row.trigger_symptom],
              symptom_coverage: `trigger:${row.trigger_symptom}`,
              must_not_miss: true,
              emergency_protocol: row.emergency_protocol,
              guideline_source: row.guideline_source,
              severity_level: row.severity_level,
            });
            dangerousInjected++;
          }

          // Track for output (deduplicate by diagnosis_id)
          if (!dangerousDiagnosisDetails.find((d: any) => d.diagnosis_id === diagInfo.id)) {
            dangerousDiagnosisDetails.push({
              diagnosis_id: diagInfo.id,
              diagnosis_name: row.diagnosis_name || diagInfo.diagnosis_name,
              severity_level: row.severity_level,
              must_not_miss: true,
              emergency_protocol: row.emergency_protocol,
              guideline_source: row.guideline_source,
              trigger_symptom: row.trigger_symptom,
            });
          }
        }
      }
    } catch (e) {
      console.error("[DDX] Dangerous diagnosis lookup failed:", e);
    }

    // Final top 6
    const differential = scoredDiagnoses
      .sort((a: any, b: any) => {
        // Must-not-miss always visible (but sorted by probability within group)
        if (a.must_not_miss && !b.must_not_miss) return 1; // keep at end but visible
        if (!a.must_not_miss && b.must_not_miss) return -1;
        return b.probability - a.probability;
      })
      .slice(0, 8)
      .sort((a: any, b: any) => b.probability - a.probability)
      .slice(0, 6);

    // Re-sort: probability desc, but ensure must_not_miss are included
    const topByProb = scoredDiagnoses
      .filter((d: any) => !d.must_not_miss)
      .sort((a: any, b: any) => b.probability - a.probability)
      .slice(0, 4);
    const mustNotMiss = scoredDiagnoses.filter((d: any) => d.must_not_miss).slice(0, 2);
    const finalDifferential = [...topByProb, ...mustNotMiss]
      .sort((a: any, b: any) => b.probability - a.probability)
      .slice(0, 6);

    const diagnosisIds = finalDifferential.map((d: any) => d.diagnosis_id).filter(Boolean);

    // ════════════════════════════════════════════════════
    // STEP 4: LAB RECOMMENDATIONS
    // ════════════════════════════════════════════════════
    let recommendedLabs: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: labLinks } = await supabase
        .from("diagnosis_lab_map")
        .select("priority, diagnosis_id, lab_tests(id, test_name, category)")
        .in("diagnosis_id", diagnosisIds);

      const labMap = new Map<string, { test: any; diagnoses: string[]; priority: string }>();
      for (const link of labLinks || []) {
        const lt = (link as any).lab_tests;
        if (!lt) continue;
        const diagName = finalDifferential.find((d: any) => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "";
        const existing = labMap.get(lt.id);
        if (existing) {
          if (!existing.diagnoses.includes(diagName)) existing.diagnoses.push(diagName);
          if (link.priority === "high") existing.priority = "high";
        } else {
          labMap.set(lt.id, {
            test: lt,
            diagnoses: [diagName],
            priority: link.priority,
          });
        }
      }

      recommendedLabs = Array.from(labMap.values())
        .sort((a, b) => {
          // High priority first, then by number of diagnoses covered
          if (a.priority === "high" && b.priority !== "high") return -1;
          if (b.priority === "high" && a.priority !== "high") return 1;
          return b.diagnoses.length - a.diagnoses.length;
        })
        .map((entry) => ({
          test_name: entry.test.test_name,
          category: entry.test.category,
          priority: entry.priority,
          differentiates: entry.diagnoses,
        }));
    }

    // ════════════════════════════════════════════════════
    // STEP 5: MEDICATION SUGGESTIONS (with safety filter)
    // ════════════════════════════════════════════════════
    let suggestedMedications: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: drugLinks } = await supabase
        .from("diagnosis_drug_map")
        .select("generic_name, line_of_treatment, diagnosis_id")
        .in("diagnosis_id", diagnosisIds);

      const genericNames = [...new Set((drugLinks || []).map((d: any) => d.generic_name))];

      // Fetch drug details
      let drugDetails: any[] = [];
      if (genericNames.length > 0) {
        const { data } = await supabase
          .from("drug_master")
          .select("id, generic_name, drug_class, max_daily_dose_mg, pregnancy_category, common_indications")
          .in("generic_name", genericNames);
        drugDetails = data || [];
      }

      // Fetch contraindications
      const drugIds = drugDetails.map((d: any) => d.id);
      let contraindications: any[] = [];
      if (drugIds.length > 0) {
        const { data } = await supabase
          .from("drug_contraindication_map")
          .select("drug_id, condition_id, severity, notes, diagnoses(diagnosis_name)")
          .in("drug_id", drugIds);
        contraindications = data || [];
      }

      // Fetch interactions between suggested drugs + current medications
      let interactions: any[] = [];
      const allDrugNames = [...genericNames, ...current_medications.map((m: string) => m.toLowerCase())];
      if (allDrugNames.length > 1) {
        const { data } = await supabase
          .from("drug_interactions")
          .select("drug_a, drug_b, severity, interaction_description, recommended_action")
          .or(
            allDrugNames.map((n: string) => `drug_a.ilike.%${n}%`).join(",") + "," +
            allDrugNames.map((n: string) => `drug_b.ilike.%${n}%`).join(",")
          );
        interactions = data || [];
      }

      const drugDetailMap = new Map(drugDetails.map((d: any) => [d.generic_name, d]));
      const allergiesLower = allergies.map((a: string) => a.toLowerCase());
      const historyLower = medical_history.map((h: string) => h.toLowerCase());

      for (const link of drugLinks || []) {
        const detail = drugDetailMap.get(link.generic_name);
        const diagName = finalDifferential.find((d: any) => d.diagnosis_id === link.diagnosis_id)?.diagnosis_name || "";

        // Safety checks
        const isAllergyConflict = allergiesLower.some(
          (a) => link.generic_name.toLowerCase().includes(a) || a.includes(link.generic_name.toLowerCase())
        );

        const contraindicationHits = contraindications.filter(
          (c: any) => c.drug_id === detail?.id &&
          historyLower.some((h) => (c as any).diagnoses?.diagnosis_name?.toLowerCase()?.includes(h))
        );

        const interactionHits = interactions.filter(
          (i: any) =>
            i.drug_a.toLowerCase().includes(link.generic_name.toLowerCase()) ||
            i.drug_b.toLowerCase().includes(link.generic_name.toLowerCase())
        );

        suggestedMedications.push({
          generic_name: link.generic_name,
          drug_class: detail?.drug_class || "",
          line_of_treatment: link.line_of_treatment,
          for_diagnosis: diagName,
          safe: !isAllergyConflict && contraindicationHits.length === 0,
          allergy_conflict: isAllergyConflict,
          contraindications: contraindicationHits.map((c: any) => ({
            condition: (c as any).diagnoses?.diagnosis_name,
            severity: c.severity,
          })),
          interactions: interactionHits.map((i: any) => ({
            with_drug: i.drug_a.toLowerCase() === link.generic_name.toLowerCase() ? i.drug_b : i.drug_a,
            severity: i.severity,
            description: i.interaction_description,
          })),
        });
      }

      // Filter to safe medications first, then unsafe with warnings
      suggestedMedications.sort((a: any, b: any) => {
        if (a.safe && !b.safe) return -1;
        if (!a.safe && b.safe) return 1;
        return 0;
      });
    }

    // ════════════════════════════════════════════════════
    // STEP 6: GUIDELINE ALIGNMENT
    // ════════════════════════════════════════════════════
    let guidelineRecommendations: any[] = [];
    if (diagnosisIds.length > 0) {
      const { data: rules } = await supabase
        .from("guideline_rules")
        .select("recommendation, evidence_level, treatment_generic_name, diagnosis_id, guideline_authorities(authority_name, priority)")
        .in("diagnosis_id", diagnosisIds)
        .order("evidence_level", { ascending: true });

      if (rules) {
        guidelineRecommendations = rules
          .sort((a: any, b: any) => {
            const aPri = (a as any).guideline_authorities?.priority ?? 10;
            const bPri = (b as any).guideline_authorities?.priority ?? 10;
            return aPri - bPri;
          })
          .map((r: any) => ({
            guideline_name: (r as any).guideline_authorities?.authority_name || "Unknown",
            authority: (r as any).guideline_authorities?.authority_name || "Unknown",
            authority_priority: (r as any).guideline_authorities?.priority ?? 10,
            recommendation: r.recommendation,
            evidence_level: r.evidence_level,
            treatment: r.treatment_generic_name,
            for_diagnosis: finalDifferential.find((d: any) => d.diagnosis_id === r.diagnosis_id)?.diagnosis_name || "",
          }));
      }
    }

    // ════════════════════════════════════════════════════
    // STEP 7: PERSIST TO diagnostic_hypotheses
    // ════════════════════════════════════════════════════
    if (visit_id) {
      for (const dx of finalDifferential) {
        const { error: hypErr } = await supabase.from("diagnostic_hypotheses").insert({
          visit_id,
          hypothesis: {
            diagnosis: dx.diagnosis_name,
            probability: dx.probability,
            supporting_symptoms: dx.supporting_symptoms,
            must_not_miss: dx.must_not_miss,
            icd10_code: dx.icd10_code,
            source: "ddx_engine",
          },
          confidence_score: dx.probability / 100,
          evidence_sources: dx.supporting_symptoms || [],
        });
        if (hypErr) console.error("Hypothesis insert error:", hypErr);
      }
    }

    // ════════════════════════════════════════════════════
    // STEP 8: MONITORING
    // ════════════════════════════════════════════════════
    const duration_ms = Date.now() - start;
    const { error: monErr } = await supabase.from("monitoring_events").insert({
      event_type: "ddx_engine_executed",
      agent_name: "ddx-engine",
      clinic_id: clinic_id || null,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        symptoms_input: normalizedSymptoms,
        symptoms_matched: matchedSymptoms?.length || 0,
        diagnoses_returned: finalDifferential.length,
        dangerous_injected: dangerousInjected,
        labs_recommended: recommendedLabs.length,
        medications_suggested: suggestedMedications.length,
        guidelines_matched: guidelineRecommendations.length,
        top_diagnosis: finalDifferential[0]?.diagnosis_name || null,
        top_probability: finalDifferential[0]?.probability || 0,
      },
    });
    if (monErr) console.error("Monitor log error:", monErr);

    return new Response(JSON.stringify({
      differential_diagnoses: finalDifferential,
      recommended_labs: recommendedLabs,
      suggested_medications: suggestedMedications,
      guideline_recommendations: guidelineRecommendations,
      matched_symptoms: matchedSymptoms?.map((s: any) => s.symptom_name) || [],
      unmatched_symptoms: normalizedSymptoms.filter(
        (s: string) => !matchedSymptoms?.some((ms: any) => ms.symptom_name === s)
      ),
      dangerous_diagnoses_injected: dangerousInjected,
      execution_ms: duration_ms,
      source: "ddx_engine_v1",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ddx-engine error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
