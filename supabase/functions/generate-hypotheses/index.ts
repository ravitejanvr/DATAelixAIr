import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patient_context, visit_id } = await req.json();
    if (!patient_context || !visit_id) {
      return new Response(
        JSON.stringify({ error: "patient_context and visit_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify visit exists (skip for benchmark runs)
    const isBenchmark = typeof visit_id === "string" && visit_id.startsWith("bench-");
    let visitClinicId: string | null = null;

    if (!isBenchmark) {
      const { data: visit } = await supabase
        .from("patient_visits")
        .select("clinic_id")
        .eq("id", visit_id)
        .single();

      if (!visit) {
        return new Response(JSON.stringify({ error: "Visit not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      visitClinicId = visit.clinic_id;

      const { data: isMember } = await supabase
        .rpc("is_clinic_member", { _user_id: user.id, _clinic_id: visit.clinic_id });
      if (!isMember) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      visitClinicId = "bench-clinic";
      console.log(`[HypothesisEngine] Benchmark mode for visit ${visit_id}`);
    }

    if (!patient_context.chief_complaint) {
      return new Response(
        JSON.stringify({ error: "chief_complaint is required for hypothesis generation" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ══════════════════════════════════════════════
    // STEP 1: Query Clinical Knowledge Graph
    // ══════════════════════════════════════════════
    const symptoms = Array.isArray(patient_context.symptoms)
      ? patient_context.symptoms
      : (patient_context.symptoms || patient_context.chief_complaint || "").split(",").map((s: string) => s.trim()).filter(Boolean);

    let graphDiagnoses: any[] = [];
    let graphDrugs: any[] = [];
    let graphLabs: any[] = [];

    try {
      const graphUrl = `${supabaseUrl}/functions/v1/query-clinical-graph`;
      const graphResp = await fetch(graphUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ symptoms }),
      });

      if (graphResp.ok) {
        const graphData = await graphResp.json();
        graphDiagnoses = graphData.diagnoses || [];
        graphDrugs = graphData.suggested_drugs || [];
        graphLabs = graphData.suggested_labs || [];
        console.log(`[HypothesisEngine] Knowledge graph returned ${graphDiagnoses.length} diagnoses`);
      } else {
        console.warn(`[HypothesisEngine] Knowledge graph returned ${graphResp.status}`);
      }
    } catch (e) {
      console.error("[HypothesisEngine] Knowledge graph query failed:", e);
    }

    // ══════════════════════════════════════════════
    // STEP 2: Fetch Dangerous Diagnoses for trigger symptoms
    // ══════════════════════════════════════════════
    let dangerousDiagnoses: any[] = [];
    try {
      const symptomTerms = symptoms.map((s: string) => s.toLowerCase().trim());
      const { data: dangerousRows } = await supabase
        .from("dangerous_diagnoses")
        .select("*, diagnoses(id, diagnosis_name, icd10_code)")
        .order("priority", { ascending: true });

      if (dangerousRows) {
        for (const row of dangerousRows) {
          const trigger = row.trigger_symptom.toLowerCase();
          const matched = symptomTerms.some((s: string) =>
            s.includes(trigger) || trigger.includes(s)
          );
          if (matched && (row as any).diagnoses) {
            dangerousDiagnoses.push({
              diagnosis_id: (row as any).diagnoses.id,
              diagnosis_name: (row as any).diagnoses.diagnosis_name,
              icd10_code: (row as any).diagnoses.icd10_code,
              trigger_symptom: row.trigger_symptom,
              priority: row.priority,
              notes: row.notes,
              must_not_miss: true,
            });
          }
        }
      }
      console.log(`[HypothesisEngine] Found ${dangerousDiagnoses.length} dangerous diagnoses`);
    } catch (e) {
      console.error("[HypothesisEngine] Dangerous diagnoses lookup failed:", e);
    }

    // ══════════════════════════════════════════════
    // STEP 3: AI-augmented hypothesis generation
    // ══════════════════════════════════════════════
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    let aiHypotheses: any[] = [];

    if (apiKey) {
      const graphContext = graphDiagnoses.length > 0
        ? `\n\nKnowledge Graph Results (use these to inform your ranking):\n${graphDiagnoses.slice(0, 6).map((d: any) =>
            `- ${d.diagnosis_name} (confidence: ${d.confidence}, ICD-10: ${d.icd10_code || "N/A"}, matching symptoms: ${d.matching_symptoms})`
          ).join("\n")}`
        : "";

      const dangerousContext = dangerousDiagnoses.length > 0
        ? `\n\nMust-Not-Miss Diagnoses (MUST include at least one):\n${dangerousDiagnoses.map((d: any) =>
            `- ${d.diagnosis_name} (trigger: ${d.trigger_symptom}, notes: ${d.notes || "N/A"})`
          ).join("\n")}`
        : "";

      const systemPrompt = `You are a clinical reasoning assistant. Given patient context and knowledge graph results, generate a ranked list of differential diagnoses.

RULES:
- Output ONLY valid JSON array, no markdown, no explanation.
- Each item: { "diagnosis": string, "confidence": number (0-1), "supporting_factors": string[], "contradicting_factors": string[], "recommended_tests": string[], "must_not_miss": boolean }
- Maximum 6 diagnoses, ordered by confidence descending.
- Use the knowledge graph results to inform and validate your confidence scores.
- If a knowledge graph diagnosis has high confidence AND symptom coverage, prioritize it.
- Include must-not-miss dangerous diagnoses even at low confidence. Mark them with "must_not_miss": true.
- Be conservative. If data is insufficient, reflect lower confidence.
- NEVER state a definitive diagnosis. These are hypotheses for clinician review.`;

      const userPrompt = `Patient Context:
- Age: ${patient_context.age ?? "unknown"}
- Sex: ${patient_context.sex ?? "unknown"}
- Chief Complaint: ${patient_context.chief_complaint}
- Symptoms: ${symptoms.join(", ") || "not specified"}
- Duration: ${patient_context.duration || "not specified"}
- Vitals: ${patient_context.vitals ? JSON.stringify(patient_context.vitals) : "not recorded"}
- Past Diagnoses: ${(patient_context.past_diagnoses || []).join(", ") || "none"}
- Medications: ${(patient_context.medications || []).join(", ") || "none"}
- Allergies: ${(patient_context.allergies || []).join(", ") || "none"}
- Medical History: ${(patient_context.medical_history || []).join(", ") || "none"}${graphContext}${dangerousContext}

Generate differential diagnoses as JSON array.`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const rawContent = aiData.choices?.[0]?.message?.content || "[]";
          const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            aiHypotheses = Array.isArray(parsed) ? parsed : [];
          } catch {
            console.error("Failed to parse AI hypotheses:", rawContent);
          }
        }
      } catch (e) {
        console.error("[HypothesisEngine] AI call failed:", e);
      }
    }

    // ══════════════════════════════════════════════
    // STEP 4: Merge & ensure dangerous diagnoses are included
    // ══════════════════════════════════════════════
    let hypotheses = aiHypotheses.length > 0 ? aiHypotheses : [];

    // If AI didn't include must-not-miss diagnoses, inject them
    if (dangerousDiagnoses.length > 0) {
      const existingNames = new Set(hypotheses.map((h: any) => h.diagnosis?.toLowerCase()));
      let injected = 0;
      for (const dd of dangerousDiagnoses) {
        if (injected >= 2) break;
        if (!existingNames.has(dd.diagnosis_name.toLowerCase())) {
          hypotheses.push({
            diagnosis: dd.diagnosis_name,
            confidence: 0.15,
            supporting_factors: [`Trigger symptom: ${dd.trigger_symptom}`],
            contradicting_factors: ["Low prior probability but must not miss"],
            recommended_tests: [],
            must_not_miss: true,
          });
          injected++;
        } else {
          // Mark existing entry as must_not_miss
          const existing = hypotheses.find((h: any) =>
            h.diagnosis?.toLowerCase() === dd.diagnosis_name.toLowerCase()
          );
          if (existing) existing.must_not_miss = true;
        }
      }
    }

    // If still no hypotheses but graph returned results, convert graph results
    if (hypotheses.length === 0 && graphDiagnoses.length > 0) {
      hypotheses = graphDiagnoses.slice(0, 6).map((d: any) => ({
        diagnosis: d.diagnosis_name,
        confidence: Math.min(1, d.confidence || 0.5),
        supporting_factors: [`Knowledge graph: ${d.matching_symptoms} matching symptoms`],
        contradicting_factors: [],
        recommended_tests: graphLabs
          .filter((l: any) => l.for_diagnosis === d.diagnosis_name)
          .map((l: any) => l.test_name)
          .slice(0, 3),
        must_not_miss: false,
      }));
    }

    // Limit to top 6
    hypotheses = hypotheses.slice(0, 8).sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0)).slice(0, 6);

    // ══════════════════════════════════════════════
    // STEP 5: Store in diagnostic_hypotheses table
    // ══════════════════════════════════════════════
    if (!isBenchmark) {
      for (const h of hypotheses) {
        await supabase.from("diagnostic_hypotheses").insert({
          visit_id,
          hypothesis: {
            diagnosis: h.diagnosis,
            supporting_factors: h.supporting_factors || [],
            contradicting_factors: h.contradicting_factors || [],
            recommended_tests: h.recommended_tests || [],
            must_not_miss: h.must_not_miss || false,
          },
          confidence_score: Math.min(1, Math.max(0, h.confidence || 0)),
          evidence_sources: h.supporting_factors || [],
        });
      }
    }

    // Log to monitoring
    const duration_ms = Date.now() - start;
    await supabase.from("monitoring_events").insert({
      event_type: "hypothesis_generated",
      agent_name: "generate-hypotheses",
      clinic_id: visitClinicId,
      success: true,
      duration_ms,
      metadata: {
        visit_id,
        hypothesis_count: hypotheses.length,
        graph_diagnoses_count: graphDiagnoses.length,
        dangerous_diagnoses_injected: dangerousDiagnoses.length,
        top_diagnosis: hypotheses[0]?.diagnosis || null,
        top_confidence: hypotheses[0]?.confidence || null,
        source: graphDiagnoses.length > 0 ? "knowledge_graph+ai" : "ai_only",
      },
    });

    return new Response(JSON.stringify({
      hypotheses,
      graph_diagnoses: graphDiagnoses.slice(0, 6),
      dangerous_diagnoses: dangerousDiagnoses,
      source: graphDiagnoses.length > 0 ? "knowledge_graph+ai" : "ai_only",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-hypotheses error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
