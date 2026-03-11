import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      symptoms = [],
      patient_age,
      patient_sex,
      patient_allergies = [],
      existing_medications = [],
      risk_factors = [],
    }: {
      symptoms: string[];
      patient_age?: number | null;
      patient_sex?: string | null;
      patient_allergies?: string[];
      existing_medications?: string[];
      risk_factors?: string[];
    } = body;

    if (!Array.isArray(symptoms) || symptoms.length === 0) {
      return new Response(JSON.stringify({ error: "symptoms array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const start = Date.now();
    const normalizedSymptoms = symptoms.map((s: string) => s.toLowerCase().trim());
    const allergiesLower = patient_allergies.map((a: string) => a.toLowerCase().trim());

    // ── Stage 1: Symptom Resolution (exact + fuzzy) ──
    const { data: exactMatches } = await supabase
      .from("symptoms")
      .select("id, symptom_name")
      .in("symptom_name", normalizedSymptoms);

    const matchedIds = new Set((exactMatches || []).map((s: any) => s.id));
    const matchedNames = new Set((exactMatches || []).map((s: any) => s.symptom_name));
    const unmatchedSymptoms = normalizedSymptoms.filter(s => !matchedNames.has(s));

    // Fuzzy fallback for unmatched
    let fuzzyMatches: any[] = [];
    if (unmatchedSymptoms.length > 0) {
      const fuzzyPromises = unmatchedSymptoms.map(s =>
        supabase.from("symptoms").select("id, symptom_name").ilike("symptom_name", `%${s}%`).limit(3)
      );
      const fuzzyResults = await Promise.all(fuzzyPromises);
      for (const res of fuzzyResults) {
        for (const s of res.data || []) {
          if (!matchedIds.has(s.id)) {
            matchedIds.add(s.id);
            fuzzyMatches.push(s);
          }
        }
      }
    }

    const allMatchedSymptoms = [...(exactMatches || []), ...fuzzyMatches];
    const symptomIds = Array.from(matchedIds);

    if (symptomIds.length === 0) {
      await logQuery(supabase, symptoms, 0, Date.now() - start, "no_match");
      return respond({
        matched_symptoms: [],
        unmatched_symptoms: normalizedSymptoms,
        diagnoses: [],
        suggested_labs: [],
        suggested_drugs: [],
        guideline_references: [],
        traversal_confidence: 0,
        traversal_ms: Date.now() - start,
        graph_miss: true,
        disclaimer: "No matching symptoms in the knowledge graph. AI fallback recommended.",
      });
    }

    // ── Stage 2: Parallel graph traversal ──
    const [diagLinksRes, symptomLabsRes, symptomDrugsRes] = await Promise.all([
      // Symptom → Diagnosis
      supabase
        .from("symptom_diagnosis_map")
        .select("diagnosis_id, confidence_score, diagnoses(id, diagnosis_name, category, icd10_code)")
        .in("symptom_id", symptomIds)
        .order("confidence_score", { ascending: false }),
      // Symptom → Lab (direct)
      supabase
        .from("symptom_lab_map")
        .select("lab_test_id, priority, clinical_rationale, lab_tests(id, test_name, category)")
        .in("symptom_id", symptomIds),
      // Symptom → Drug (symptomatic)
      supabase
        .from("symptom_drug_map")
        .select("generic_name, treatment_type, priority")
        .in("symptom_id", symptomIds),
    ]);

    // ── Stage 3: Aggregate diagnoses with confidence ──
    const diagMap = new Map<string, {
      diagnosis: any;
      total_confidence: number;
      symptom_count: number;
      max_single: number;
    }>();

    for (const link of diagLinksRes.data || []) {
      const d = (link as any).diagnoses;
      if (!d) continue;
      const existing = diagMap.get(d.id);
      const score = link.confidence_score || 0;
      if (existing) {
        existing.total_confidence += score;
        existing.symptom_count += 1;
        existing.max_single = Math.max(existing.max_single, score);
      } else {
        diagMap.set(d.id, { diagnosis: d, total_confidence: score, symptom_count: 1, max_single: score });
      }
    }

    // Apply modifiers
    const isPediatric = patient_age != null && patient_age < 18;
    const isElderly = patient_age != null && patient_age > 65;

    let rankedDiagnoses = Array.from(diagMap.values())
      .map(entry => {
        let confidence = entry.total_confidence / symptomIds.length;
        // Boost by symptom coverage ratio
        const coverageRatio = entry.symptom_count / symptomIds.length;
        confidence *= (0.7 + 0.3 * coverageRatio);
        // Age modifiers
        if (isPediatric && entry.diagnosis.category === "pediatric") confidence *= 1.15;
        if (isElderly && entry.diagnosis.category === "geriatric") confidence *= 1.1;
        // Cap at 1.0
        confidence = Math.min(1.0, confidence);
        return {
          ...entry.diagnosis,
          confidence: Math.round(confidence * 100) / 100,
          matching_symptoms: entry.symptom_count,
          coverage_ratio: Math.round(coverageRatio * 100) / 100,
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    const diagnosisIds = rankedDiagnoses.map(d => d.id);

    // ── Stage 4: Parallel — diagnosis-based lookups ──
    const [drugLinksRes, labLinksRes, guidelineLinksRes, dangerousRes] = await Promise.all([
      // Diagnosis → Drug
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_drug_map").select("generic_name, line_of_treatment, diagnosis_id").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      // Diagnosis → Lab
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_lab_map").select("priority, diagnosis_id, lab_tests(id, test_name, category)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      // Diagnosis → Guideline
      diagnosisIds.length > 0
        ? supabase.from("diagnosis_guideline_map").select("relevance_score, recommendation_summary, guideline_id, diagnosis_id, guideline_registry(id, title, organization, condition, country, tier, recommendation_text, guideline_url)").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
      // Dangerous diagnoses check
      diagnosisIds.length > 0
        ? supabase.from("dangerous_diagnoses").select("diagnosis_id, severity_level, trigger_symptom, emergency_protocol, must_not_miss").in("diagnosis_id", diagnosisIds)
        : Promise.resolve({ data: [] }),
    ]);

    // Enrich drugs with drug_master
    const genericNames = [...new Set((drugLinksRes.data || []).map((d: any) => d.generic_name))];
    let drugDetails: any[] = [];
    if (genericNames.length > 0) {
      const { data } = await supabase.from("drug_master").select("generic_name, drug_class, max_daily_dose_mg, pregnancy_category").in("generic_name", genericNames);
      drugDetails = data || [];
    }
    const drugDetailMap = new Map(drugDetails.map((d: any) => [d.generic_name, d]));

    // Build suggested drugs (from diagnosis + symptom direct)
    const drugSet = new Map<string, any>();

    for (const link of drugLinksRes.data || []) {
      const detail = drugDetailMap.get(link.generic_name) || {};
      const diagName = rankedDiagnoses.find(d => d.id === link.diagnosis_id)?.diagnosis_name;
      const isAllergyConflict = allergiesLower.some(a => link.generic_name.toLowerCase().includes(a) || a.includes(link.generic_name.toLowerCase()));
      drugSet.set(link.generic_name, {
        generic_name: link.generic_name,
        line_of_treatment: link.line_of_treatment,
        source: "diagnosis_drug_map",
        for_diagnosis: diagName || "unknown",
        allergy_conflict: isAllergyConflict,
        ...(detail as object),
      });
    }

    for (const link of symptomDrugsRes.data || []) {
      if (!drugSet.has(link.generic_name)) {
        const isAllergyConflict = allergiesLower.some(a => link.generic_name.toLowerCase().includes(a));
        drugSet.set(link.generic_name, {
          generic_name: link.generic_name,
          line_of_treatment: link.priority,
          source: "symptom_drug_map",
          treatment_type: link.treatment_type,
          for_diagnosis: "symptomatic",
          allergy_conflict: isAllergyConflict,
        });
      }
    }

    const suggestedDrugs = Array.from(drugSet.values())
      .sort((a, b) => {
        if (a.allergy_conflict !== b.allergy_conflict) return a.allergy_conflict ? 1 : -1;
        const lineOrder: Record<string, number> = { first_line: 0, second_line: 1, third_line: 2, adjunct: 3 };
        return (lineOrder[a.line_of_treatment] ?? 4) - (lineOrder[b.line_of_treatment] ?? 4);
      });

    // Build suggested labs (from diagnosis + symptom direct)
    const labSet = new Map<string, any>();

    for (const link of labLinksRes.data || []) {
      const lab = (link as any).lab_tests;
      if (!lab) continue;
      const diagName = rankedDiagnoses.find(d => d.id === link.diagnosis_id)?.diagnosis_name;
      labSet.set(lab.test_name, {
        test_name: lab.test_name,
        category: lab.category,
        priority: link.priority,
        source: "diagnosis_lab_map",
        for_diagnosis: diagName || "unknown",
      });
    }

    for (const link of symptomLabsRes.data || []) {
      const lab = (link as any).lab_tests;
      if (!lab || labSet.has(lab.test_name)) continue;
      labSet.set(lab.test_name, {
        test_name: lab.test_name,
        category: lab.category,
        priority: link.priority,
        source: "symptom_lab_map",
        clinical_rationale: link.clinical_rationale,
        for_diagnosis: "symptom-direct",
      });
    }

    const suggestedLabs = Array.from(labSet.values())
      .sort((a, b) => {
        const prioOrder: Record<string, number> = { required: 0, recommended: 1, optional: 2 };
        return (prioOrder[a.priority] ?? 3) - (prioOrder[b.priority] ?? 3);
      });

    // Build guideline references
    const guidelineRefs = (guidelineLinksRes.data || []).map((link: any) => {
      const g = link.guideline_registry;
      const diagName = rankedDiagnoses.find(d => d.id === link.diagnosis_id)?.diagnosis_name;
      return {
        title: g?.title,
        organization: g?.organization,
        country: g?.country,
        tier: g?.tier,
        recommendation: link.recommendation_summary || g?.recommendation_text,
        guideline_url: g?.guideline_url,
        relevance_score: link.relevance_score,
        for_diagnosis: diagName,
      };
    }).sort((a: any, b: any) => (a.tier || 5) - (b.tier || 5));

    // Mark dangerous diagnoses
    const dangerousSet = new Set((dangerousRes.data || []).map((d: any) => d.diagnosis_id));
    rankedDiagnoses = rankedDiagnoses.map(d => ({
      ...d,
      is_dangerous: dangerousSet.has(d.id),
      emergency_protocol: (dangerousRes.data || []).find((dd: any) => dd.diagnosis_id === d.id)?.emergency_protocol || null,
    }));

    // ── Confidence scoring ──
    const symptomCoverage = symptomIds.length / normalizedSymptoms.length;
    const topDiagConfidence = rankedDiagnoses[0]?.confidence || 0;
    const traversalConfidence = Math.round(
      (symptomCoverage * 0.4 + topDiagConfidence * 0.4 + Math.min(1, guidelineRefs.length / 3) * 0.2) * 100
    ) / 100;

    const traversalMs = Date.now() - start;
    await logQuery(supabase, symptoms, rankedDiagnoses.length, traversalMs, "success");

    return respond({
      matched_symptoms: allMatchedSymptoms.map((s: any) => s.symptom_name),
      unmatched_symptoms: unmatchedSymptoms.filter(s => !fuzzyMatches.some((f: any) => f.symptom_name.includes(s))),
      diagnoses: rankedDiagnoses,
      suggested_labs: suggestedLabs,
      suggested_drugs: suggestedDrugs,
      guideline_references: guidelineRefs,
      traversal_confidence: traversalConfidence,
      traversal_ms: traversalMs,
      graph_miss: false,
      node_counts: {
        symptoms_matched: symptomIds.length,
        diagnoses_found: rankedDiagnoses.length,
        drugs_found: suggestedDrugs.length,
        labs_found: suggestedLabs.length,
        guidelines_found: guidelineRefs.length,
      },
      disclaimer: "AI-assisted clinical graph traversal. All recommendations require clinical evaluation.",
    });
  } catch (err: any) {
    console.error("query-clinical-graph error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function respond(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logQuery(supabase: any, symptoms: string[], resultCount: number, durationMs: number, status: string) {
  try {
    await supabase.from("monitoring_events").insert({
      event_type: "clinical_graph_query",
      agent_name: "query-clinical-graph",
      duration_ms: durationMs,
      success: status === "success",
      metadata: { symptoms, result_count: resultCount, status },
    });
  } catch { /* non-blocking */ }
}
