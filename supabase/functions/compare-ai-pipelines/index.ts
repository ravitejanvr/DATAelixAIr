import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function computeOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map(s => s.toLowerCase().trim()));
  const setB = new Set(b.map(s => s.toLowerCase().trim()));
  let matches = 0;
  for (const item of setA) {
    if (setB.has(item)) matches++;
  }
  const union = new Set([...setA, ...setB]).size;
  return Math.round((matches / union) * 100);
}

// Extract generic name from a medication string (first word before dose)
function extractGenericName(med: string): string {
  return med.trim().split(/\s+\d/)[0].toLowerCase().trim();
}

function computeMedicationOverlap(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map(extractGenericName));
  const setB = new Set(b.map(extractGenericName));
  let matches = 0;
  for (const item of setA) {
    if (setB.has(item)) matches++;
  }
  const union = new Set([...setA, ...setB]).size;
  return Math.round((matches / union) * 100);
}

// ─── Semantic matching using ontology tables ───

interface ConditionMapEntry {
  canonical_condition: string;
  synonyms: string[];
}

interface LabEquivEntry {
  canonical_name: string;
  aliases: string[];
}

function resolveCanonicalCondition(diagnosis: string, conditionMap: ConditionMapEntry[]): string {
  const lower = diagnosis.toLowerCase().trim();
  for (const entry of conditionMap) {
    if (entry.canonical_condition.toLowerCase() === lower) return entry.canonical_condition;
    for (const syn of entry.synonyms) {
      if (lower.includes(syn.toLowerCase()) || syn.toLowerCase().includes(lower)) {
        return entry.canonical_condition;
      }
    }
  }
  return lower; // fallback to raw string
}

function resolveCanonicalLab(testName: string, labEquiv: LabEquivEntry[]): string {
  const lower = testName.toLowerCase().trim();
  for (const entry of labEquiv) {
    if (entry.canonical_name.toLowerCase() === lower) return entry.canonical_name;
    for (const alias of entry.aliases) {
      if (lower.includes(alias.toLowerCase()) || alias.toLowerCase().includes(lower)) {
        return entry.canonical_name;
      }
    }
  }
  return lower;
}

function computeSemanticDiagnosisOverlap(a: string[], b: string[], conditionMap: ConditionMapEntry[]): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const canonA = new Set(a.map(d => resolveCanonicalCondition(d, conditionMap)));
  const canonB = new Set(b.map(d => resolveCanonicalCondition(d, conditionMap)));
  let matches = 0;
  for (const item of canonA) {
    if (canonB.has(item)) matches++;
  }
  const union = new Set([...canonA, ...canonB]).size;
  return Math.round((matches / union) * 100);
}

function computeSemanticLabOverlap(a: string[], b: string[], labEquiv: LabEquivEntry[]): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const canonA = new Set(a.map(l => resolveCanonicalLab(l, labEquiv)));
  const canonB = new Set(b.map(l => resolveCanonicalLab(l, labEquiv)));
  let matches = 0;
  for (const item of canonA) {
    if (canonB.has(item)) matches++;
  }
  const union = new Set([...canonA, ...canonB]).size;
  return Math.round((matches / union) * 100);
}

function computeGenericMedOverlap(a: string[], b: string[], brandGenericMap: Array<{brand_name: string; generic_name: string}>): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;

  const resolveGeneric = (name: string) => {
    const lower = name.toLowerCase().trim();
    const mapped = brandGenericMap.find(m => m.brand_name.toLowerCase() === lower);
    return mapped ? mapped.generic_name.toLowerCase() : extractGenericName(name);
  };

  const setA = new Set(a.map(resolveGeneric));
  const setB = new Set(b.map(resolveGeneric));
  let matches = 0;
  for (const item of setA) {
    if (setB.has(item)) matches++;
  }
  const union = new Set([...setA, ...setB]).size;
  return Math.round((matches / union) * 100);
}

interface ModuleLog {
  module: string;
  status: "success" | "error" | "skipped";
  latency_ms: number;
  details?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Only platform_admin or doctor roles
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("platform_admin") && !userRoles.includes("doctor")) {
      return new Response(JSON.stringify({ error: "Requires platform_admin or doctor role" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { patient_context } = await req.json();
    if (!patient_context) {
      return new Response(JSON.stringify({ error: "patient_context is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctx = patient_context;
    const moduleLogs: ModuleLog[] = [];

    // Build a synthetic transcript from patient_context
    const transcriptParts = [];
    if (ctx.symptoms?.length) transcriptParts.push(`Patient presents with ${ctx.symptoms.join(", ")}.`);
    if (ctx.duration) transcriptParts.push(`Duration: ${ctx.duration}.`);
    if (ctx.vitals) {
      const v = ctx.vitals;
      if (v.temperature) transcriptParts.push(`Temperature ${v.temperature}°F.`);
      if (v.bp) transcriptParts.push(`Blood pressure ${v.bp}.`);
      if (v.pulse) transcriptParts.push(`Pulse ${v.pulse} bpm.`);
      if (v.spo2) transcriptParts.push(`SpO2 ${v.spo2}%.`);
    }
    if (ctx.allergies?.length) transcriptParts.push(`Allergies: ${ctx.allergies.join(", ")}.`);
    if (ctx.conditions?.length) transcriptParts.push(`Known conditions: ${ctx.conditions.join(", ")}.`);
    if (ctx.current_medications?.length) transcriptParts.push(`Current medications: ${ctx.current_medications.join(", ")}.`);
    transcriptParts.push(`${ctx.age || 35} year old ${ctx.gender || "patient"}.`);
    const syntheticTranscript = transcriptParts.join(" ");

    // Build clinical_context for legacy pipeline
    const clinicalContext = {
      chief_complaint: ctx.symptoms?.[0] || "",
      age: ctx.age,
      gender: ctx.gender,
      blood_pressure: ctx.vitals?.bp || "",
      pulse: ctx.vitals?.pulse || null,
      temperature: ctx.vitals?.temperature || null,
      oxygen_saturation: ctx.vitals?.spo2 || null,
      allergies: ctx.allergies || [],
      current_medications: ctx.current_medications || [],
      chronic_conditions: ctx.conditions || [],
    };

    // ══════════════════════════════════════
    // STEP 1: RUN LEGACY PIPELINE
    // ══════════════════════════════════════
    const legacyStart = Date.now();
    let legacyOutput: any = { diagnoses: [], labs: [], medications: [], error: null };

    try {
      const legacyUrl = `${supabaseUrl}/functions/v1/run-ai-pipeline`;
      const legacyResp = await fetch(legacyUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: anonKey,
        },
        body: JSON.stringify({
          transcript: syntheticTranscript,
          clinical_context: clinicalContext,
        }),
      });

      if (legacyResp.ok) {
        const data = await legacyResp.json();
        const diagSection = data.soap_sections?.["Provisional Diagnosis"] || "";
        legacyOutput.diagnoses = diagSection.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
        const planSection = data.soap_sections?.["Treatment Plan"] || "";
        legacyOutput.medications = planSection.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean);
        legacyOutput.soap_sections = data.soap_sections;
        legacyOutput.safety_results = data.safety_results;
        legacyOutput.extracted_data = data.extracted_data;
      } else {
        const errText = await legacyResp.text();
        legacyOutput.error = `Legacy pipeline failed: ${legacyResp.status} - ${errText}`;
      }
    } catch (e) {
      legacyOutput.error = `Legacy pipeline error: ${e instanceof Error ? e.message : "Unknown"}`;
    }
    legacyOutput.latency_ms = Date.now() - legacyStart;

    // ══════════════════════════════════════
    // STEP 2: RUN FULL MODULAR PIPELINE
    // ══════════════════════════════════════
    const modularStart = Date.now();
    let modularOutput: any = {
      diagnoses: [], labs: [], medications: [], guidelines: [],
      safety_score: 0, safety_flags: [], error: null,
      context: null, ddx: null, hypotheses: [], evidence: null, compliance: null, oversight: null,
    };

    try {
      // ─── MODULE 1: Context Engine ───────────────────────
      const ctxStart = Date.now();
      const structuredContext = {
        patient_age: ctx.age || null,
        patient_sex: ctx.gender || null,
        chief_complaint: ctx.symptoms?.[0] || "",
        symptoms: ctx.symptoms || [],
        symptom_duration: ctx.duration || "",
        vitals: {
          temperature: ctx.vitals?.temperature || null,
          bp_systolic: ctx.vitals?.bp ? parseInt(ctx.vitals.bp.split("/")[0]) : null,
          bp_diastolic: ctx.vitals?.bp ? parseInt(ctx.vitals.bp.split("/")[1]) : null,
          pulse: ctx.vitals?.pulse || null,
          spo2: ctx.vitals?.spo2 || null,
        },
        medical_history: ctx.conditions || [],
        family_history: [],
        lifestyle_factors: {},
        medications: ctx.current_medications || [],
        allergies: ctx.allergies || [],
        lab_results: [],
        previous_visits: 0,
      };
      modularOutput.context = structuredContext;
      moduleLogs.push({
        module: "context_engine",
        status: "success",
        latency_ms: Date.now() - ctxStart,
        details: `Assembled ${Object.keys(structuredContext).length} data points`,
      });

      // ─── MODULE 1.5: DDX Engine ────────────────────────
      const ddxStart = Date.now();
      try {
        const ddxUrl = `${supabaseUrl}/functions/v1/ddx-engine`;
        const ddxResp = await fetch(ddxUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({
            symptoms: structuredContext.symptoms,
            vitals: {
              temperature: structuredContext.vitals.temperature,
              spo2: structuredContext.vitals.spo2,
              pulse: structuredContext.vitals.pulse,
            },
            age: structuredContext.patient_age,
            sex: structuredContext.patient_sex,
            medical_history: structuredContext.medical_history,
            current_medications: structuredContext.medications,
            allergies: structuredContext.allergies,
          }),
        });

        if (ddxResp.ok) {
          const ddxData = await ddxResp.json();
          modularOutput.ddx = ddxData;

          // Merge DDX diagnoses into modular output
          if (ddxData.differential_diagnoses?.length > 0) {
            modularOutput.diagnoses = ddxData.differential_diagnoses.map((d: any) => d.diagnosis_name);
          }

          // Merge DDX labs
          if (ddxData.recommended_labs?.length > 0) {
            const existingLabs = new Set(modularOutput.labs.map((l: string) => l.toLowerCase()));
            for (const lab of ddxData.recommended_labs) {
              if (!existingLabs.has(lab.test_name.toLowerCase())) {
                modularOutput.labs.push(lab.test_name);
              }
            }
          }

          // Merge DDX medications
          if (ddxData.suggested_medications?.length > 0) {
            const existingMeds = new Set(modularOutput.medications.map((m: string) => m.toLowerCase()));
            for (const med of ddxData.suggested_medications) {
              if (med.safe && !existingMeds.has(med.generic_name.toLowerCase())) {
                modularOutput.medications.push(med.generic_name);
              }
            }
          }

          // Merge DDX guidelines
          if (ddxData.guideline_recommendations?.length > 0) {
            modularOutput.guidelines = ddxData.guideline_recommendations.map((g: any) => ({
              title: g.guideline_name,
              organization: g.authority,
              recommendation: g.recommendation,
              evidence_grade: g.evidence_level,
            }));
          }

          moduleLogs.push({
            module: "ddx_engine",
            status: "success",
            latency_ms: Date.now() - ddxStart,
            details: `${ddxData.differential_diagnoses?.length || 0} diagnoses (${ddxData.dangerous_diagnoses_injected || 0} must-not-miss), ${ddxData.recommended_labs?.length || 0} labs, ${ddxData.suggested_medications?.length || 0} meds, ${ddxData.guideline_recommendations?.length || 0} guidelines. Graph: ${ddxData.matched_symptoms?.length || 0}/${structuredContext.symptoms.length} symptoms matched. Execution: ${ddxData.execution_ms}ms`,
          });
        } else {
          const errText = await ddxResp.text();
          moduleLogs.push({
            module: "ddx_engine",
            status: "error",
            latency_ms: Date.now() - ddxStart,
            details: `HTTP ${ddxResp.status}: ${errText.substring(0, 200)}`,
          });
        }
      } catch (e) {
        moduleLogs.push({
          module: "ddx_engine",
          status: "error",
          latency_ms: Date.now() - ddxStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }

      // ─── MODULE 2: Hypothesis Engine ────────────────────
      // Calls query-clinical-graph for knowledge graph results + AI for hypothesis generation
      const hypStart = Date.now();
      try {
        // Step 2a: Query knowledge graph
        let graphDiagnoses: any[] = [];
        let graphLabs: any[] = [];
        try {
          const graphUrl = `${supabaseUrl}/functions/v1/query-clinical-graph`;
          const graphResp = await fetch(graphUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ symptoms: structuredContext.symptoms }),
          });
          if (graphResp.ok) {
            const graphData = await graphResp.json();
            graphDiagnoses = graphData.diagnoses || [];
            graphLabs = (graphData.suggested_labs || []).map((l: any) => l.test_name);
          }
        } catch (e) {
          console.warn("Knowledge graph query failed:", e);
        }

        // Step 2b: Fetch dangerous diagnoses
        let dangerousDiags: any[] = [];
        try {
          const { data: dangerousRows } = await admin
            .from("dangerous_diagnoses")
            .select("*, diagnoses(id, diagnosis_name)")
            .order("priority", { ascending: true });

          if (dangerousRows) {
            const symptomsLower = structuredContext.symptoms.map((s: string) => s.toLowerCase());
            for (const row of dangerousRows) {
              const trigger = row.trigger_symptom.toLowerCase();
              if (symptomsLower.some((s: string) => s.includes(trigger) || trigger.includes(s))) {
                if ((row as any).diagnoses) {
                  dangerousDiags.push({
                    diagnosis_name: (row as any).diagnoses.diagnosis_name,
                    trigger_symptom: row.trigger_symptom,
                    must_not_miss: true,
                  });
                }
              }
            }
          }
        } catch { /* non-blocking */ }

        // Step 2c: AI hypothesis generation with graph context
        const graphContext = graphDiagnoses.length > 0
          ? `\n\nKnowledge Graph Results:\n${graphDiagnoses.slice(0, 6).map((d: any) =>
              `- ${d.diagnosis_name} (confidence: ${d.confidence}, matching symptoms: ${d.matching_symptoms})`
            ).join("\n")}`
          : "";

        const dangerousContext = dangerousDiags.length > 0
          ? `\n\nMust-Not-Miss Diagnoses:\n${dangerousDiags.map((d: any) =>
              `- ${d.diagnosis_name} (trigger: ${d.trigger_symptom})`
            ).join("\n")}`
          : "";

        const hypothesisResp = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            temperature: 0.2,
            messages: [
              {
                role: "system",
                content: `You are a clinical reasoning assistant. Given patient context and knowledge graph results, generate a ranked list of differential diagnoses.

RULES:
- Output ONLY valid JSON array, no markdown, no explanation.
- Each item: { "diagnosis": string, "confidence": number (0-1), "supporting_factors": string[], "contradicting_factors": string[], "recommended_tests": string[], "must_not_miss": boolean }
- Maximum 6 diagnoses, ordered by confidence descending.
- Use knowledge graph results to inform and validate confidence scores.
- Include must-not-miss dangerous diagnoses even at low confidence. Mark them with "must_not_miss": true.
- Be conservative. If data is insufficient, reflect lower confidence.
- NEVER state a definitive diagnosis. These are hypotheses for clinician review.`,
              },
              {
                role: "user",
                content: `Patient Context:
- Age: ${structuredContext.patient_age ?? "unknown"}
- Sex: ${structuredContext.patient_sex ?? "unknown"}
- Chief Complaint: ${structuredContext.chief_complaint}
- Symptoms: ${structuredContext.symptoms.join(", ") || "not specified"}
- Duration: ${structuredContext.symptom_duration || "not specified"}
- Vitals: ${JSON.stringify(structuredContext.vitals)}
- Medical History: ${structuredContext.medical_history.join(", ") || "none"}
- Medications: ${structuredContext.medications.join(", ") || "none"}
- Allergies: ${structuredContext.allergies.join(", ") || "none"}${graphContext}${dangerousContext}

Generate differential diagnoses as JSON array.`,
              },
            ],
          }),
        });

        if (hypothesisResp.ok) {
          const hData = await hypothesisResp.json();
          const content = hData.choices?.[0]?.message?.content || "";
          const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            modularOutput.hypotheses = Array.isArray(parsed) ? parsed : [];
            modularOutput.diagnoses = modularOutput.hypotheses.map((h: any) => h.diagnosis);

            // Inject must-not-miss if missing
            const existingNames = new Set(modularOutput.diagnoses.map((d: string) => d.toLowerCase()));
            for (const dd of dangerousDiags) {
              if (!existingNames.has(dd.diagnosis_name.toLowerCase())) {
                modularOutput.hypotheses.push({
                  diagnosis: dd.diagnosis_name,
                  confidence: 0.15,
                  supporting_factors: [`Trigger symptom: ${dd.trigger_symptom}`],
                  contradicting_factors: ["Low prior probability but must not miss"],
                  recommended_tests: [],
                  must_not_miss: true,
                });
                modularOutput.diagnoses.push(dd.diagnosis_name);
              }
            }

            // Extract recommended tests from hypotheses + graph labs
            const allTests = new Set<string>();
            for (const h of modularOutput.hypotheses) {
              for (const t of (h.recommended_tests || [])) allTests.add(t);
            }
            for (const l of graphLabs) allTests.add(l);
            modularOutput.labs = [...allTests];
          } catch {
            modularOutput.hypotheses = [];
          }
        }
        moduleLogs.push({
          module: "hypothesis_engine",
          status: modularOutput.hypotheses.length > 0 ? "success" : "error",
          latency_ms: Date.now() - hypStart,
          details: `Generated ${modularOutput.hypotheses.length} hypotheses (graph: ${graphDiagnoses.length} diagnoses, dangerous: ${dangerousDiags.length}). Source: ${graphDiagnoses.length > 0 ? "knowledge_graph+ai" : "ai_only"}. Top: ${modularOutput.hypotheses[0]?.diagnosis || "none"}`,
        });
      } catch (e) {
        moduleLogs.push({
          module: "hypothesis_engine",
          status: "error",
          latency_ms: Date.now() - hypStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }

      // ─── MODULE 3: Knowledge Retrieval ──────────────────
      // Calls clinical-knowledge edge function for PubMed, Europe PMC, OpenFDA, DailyMed evidence
      const knStart = Date.now();
      try {
        const knowledgeUrl = `${supabaseUrl}/functions/v1/clinical-knowledge`;
        const knowledgeResp = await fetch(knowledgeUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({
            chief_complaint: structuredContext.chief_complaint,
            duration: structuredContext.symptom_duration,
            symptoms: structuredContext.symptoms.join(", "),
            age: structuredContext.patient_age,
            gender: structuredContext.patient_sex,
            allergies: structuredContext.allergies.join(", "),
            medications: structuredContext.medications.join(", "),
            conditions: structuredContext.medical_history.join(", "),
            vitals: JSON.stringify(structuredContext.vitals),
          }),
        });

        if (knowledgeResp.ok) {
          const knData = await knowledgeResp.json();
          modularOutput.evidence = {
            citations: knData.citations || [],
            drug_safety: knData.drug_safety || [],
            suggestions: knData.suggestions || {},
            sources_queried: knData.sources_queried || [],
            retrieval_confidence: knData.retrieval_confidence || "low",
          };

          // Merge medication suggestions from evidence
          const evidenceMeds = (knData.suggestions?.prescriptions || []).map((p: any) => p.drug_name);
          if (evidenceMeds.length > 0) {
            const existingSet = new Set(modularOutput.medications.map((m: string) => m.toLowerCase()));
            for (const med of evidenceMeds) {
              if (!existingSet.has(med.toLowerCase())) {
                modularOutput.medications.push(med);
              }
            }
          }

          // Merge lab suggestions from evidence
          const evidenceLabs = (knData.suggestions?.lab_tests || []).map((l: any) => l.test_name);
          if (evidenceLabs.length > 0) {
            const existingLabSet = new Set(modularOutput.labs.map((l: string) => l.toLowerCase()));
            for (const lab of evidenceLabs) {
              if (!existingLabSet.has(lab.toLowerCase())) {
                modularOutput.labs.push(lab);
              }
            }
          }

          moduleLogs.push({
            module: "knowledge_retrieval",
            status: "success",
            latency_ms: Date.now() - knStart,
            details: `Retrieved ${(knData.citations || []).length} citations from ${(knData.sources_queried || []).join(", ")}. Confidence: ${knData.retrieval_confidence || "low"}`,
          });
        } else {
          const errText = await knowledgeResp.text();
          moduleLogs.push({
            module: "knowledge_retrieval",
            status: "error",
            latency_ms: Date.now() - knStart,
            details: `HTTP ${knowledgeResp.status}: ${errText.substring(0, 200)}`,
          });
        }
      } catch (e) {
        moduleLogs.push({
          module: "knowledge_retrieval",
          status: "error",
          latency_ms: Date.now() - knStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }

      // ─── MODULE 4: Guideline Engine ─────────────────────
      // Calls guideline-compliance edge function to check against ICMR > WHO > NICE > CDC > specialty
      const glStart = Date.now();
      try {
        // First, fetch guideline_sources to get priority ordering
        const { data: guidelineSources } = await admin
          .from("guideline_sources")
          .select("organization, priority, disease_category, region")
          .eq("is_active", true)
          .order("priority", { ascending: true });

        const complianceUrl = `${supabaseUrl}/functions/v1/guideline-compliance`;
        const complianceResp = await fetch(complianceUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({
            diagnoses: modularOutput.diagnoses.slice(0, 5),
            medications: modularOutput.medications.slice(0, 5).map((m: string) => ({
              drug_name: m,
              dose: "",
              frequency: "",
              duration: "",
            })),
            tests: modularOutput.labs.slice(0, 5),
            care_plan: "",
            patient_age: structuredContext.patient_age,
            patient_sex: structuredContext.patient_sex,
            chief_complaint: structuredContext.chief_complaint,
          }),
        });

        if (complianceResp.ok) {
          const compData = await complianceResp.json();

          // Build priority map from guideline_sources
          const priorityMap: Record<string, number> = {};
          for (const gs of (guidelineSources || [])) {
            priorityMap[gs.organization.toUpperCase()] = gs.priority;
          }

          // Sort results by source priority
          const sortedResults = (compData.results || []).sort((a: any, b: any) => {
            const aPriority = a.matching_guidelines?.[0]?.source_organization
              ? (priorityMap[a.matching_guidelines[0].source_organization.toUpperCase()] ?? 10) : 10;
            const bPriority = b.matching_guidelines?.[0]?.source_organization
              ? (priorityMap[b.matching_guidelines[0].source_organization.toUpperCase()] ?? 10) : 10;
            return aPriority - bPriority;
          });

          // Detect conflicts
          const conflicts = sortedResults
            .filter((r: any) => r.compliance_status === "review_suggested")
            .map((r: any) => ({
              recommendation: r.item,
              conflicting_guideline: r.matching_guidelines?.[0]?.title || "Unknown",
              organization: r.matching_guidelines?.[0]?.source_organization || "Unknown",
              severity: r.matching_guidelines?.length > 1 ? "high" : "moderate",
              explanation: r.explanation || "",
            }));

          // Compute compliance score
          const totalEvaluated = sortedResults.length || 1;
          const alignedCount = sortedResults.filter(
            (r: any) => r.compliance_status === "guideline_aligned" || r.compliance_status === "evidence_supported"
          ).length;
          const complianceScore = Math.round((alignedCount / totalEvaluated) * 100);

          modularOutput.compliance = {
            results: sortedResults,
            guidelines_matched: compData.guidelines_matched || 0,
            guidelines_sources: compData.guidelines_sources || [],
            guideline_sources_used: (guidelineSources || []).map((gs: any) => gs.organization),
            guideline_compliance_score: complianceScore,
            conflicts_detected: conflicts,
          };

          // Extract guideline references
          modularOutput.guidelines = sortedResults
            .filter((r: any) => r.matching_guidelines?.length > 0)
            .flatMap((r: any) => r.matching_guidelines.map((g: any) => ({
              title: g.title,
              organization: g.source_organization,
              recommendation: g.recommendation_text?.substring(0, 200),
              evidence_grade: g.evidence_grade,
            })));

          // Log guideline citations to guideline_usage_logs
          for (const result of sortedResults) {
            for (const gl of (result.matching_guidelines || [])) {
              if (gl.guideline_id) {
                await admin.from("guideline_usage_logs").insert({
                  guideline_id: gl.guideline_id,
                  visit_id: "00000000-0000-0000-0000-000000000000", // benchmark placeholder
                  clinic_id: "00000000-0000-0000-0000-000000000000",
                  tier: priorityMap[gl.source_organization?.toUpperCase()] ?? 5,
                  matched_condition: result.item,
                  recommendation_used: gl.recommendation_text?.substring(0, 500),
                  guideline_name: gl.title,
                  recommendation_checked: result.item,
                  compliance_result: result.compliance_status,
                }).catch(() => {}); // non-critical
              }
            }
          }

          moduleLogs.push({
            module: "guideline_engine",
            status: "success",
            latency_ms: Date.now() - glStart,
            details: `Evaluated ${sortedResults.length} items against ${compData.guidelines_matched || 0} guidelines. Compliance: ${complianceScore}%. Conflicts: ${conflicts.length}. Sources: ${(compData.guidelines_sources || []).join(", ")}`,
          });
        } else {
          const errText = await complianceResp.text();
          moduleLogs.push({
            module: "guideline_engine",
            status: "error",
            latency_ms: Date.now() - glStart,
            details: `HTTP ${complianceResp.status}: ${errText.substring(0, 200)}`,
          });
        }
      } catch (e) {
        moduleLogs.push({
          module: "guideline_engine",
          status: "error",
          latency_ms: Date.now() - glStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }

      // ─── MODULE 5: Oversight Engine ─────────────────────
      // Calls clinical-safety edge function for drug interactions, allergy conflicts, vital dangers
      const osStart = Date.now();
      try {
        const bpParts = ctx.vitals?.bp?.split("/") || [];
        const vitalsObj = {
          bp_systolic: parseInt(bpParts[0]) || null,
          bp_diastolic: parseInt(bpParts[1]) || null,
          pulse: ctx.vitals?.pulse || null,
          temperature: ctx.vitals?.temperature || null,
          spo2: ctx.vitals?.spo2 || null,
        };

        const safetyUrl = `${supabaseUrl}/functions/v1/clinical-safety`;
        const safetyResp = await fetch(safetyUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({
            medications: [...structuredContext.medications, ...modularOutput.medications],
            allergies: structuredContext.allergies,
            vitals: vitalsObj,
            symptoms: structuredContext.symptoms,
            clinical_context: clinicalContext,
            actor_id: user.id,
          }),
        });

        if (safetyResp.ok) {
          const safetyData = await safetyResp.json();
          modularOutput.oversight = {
            interaction_flags: safetyData.interaction_flags || [],
            allergy_flags: safetyData.allergy_flags || [],
            dose_warnings: safetyData.dose_warnings || [],
            vitals_dangers: safetyData.vitals_dangers || [],
            emergency_patterns: safetyData.emergency_patterns || [],
            confidence_level: safetyData.confidence_level || "moderate",
            requires_manual_review: safetyData.requires_manual_review || false,
          };

          // Compute safety score
          const totalFlags =
            (safetyData.interaction_flags || []).length +
            (safetyData.allergy_flags || []).length * 2 + // allergy = double weight
            (safetyData.dose_warnings || []).length +
            (safetyData.vitals_dangers || []).length +
            (safetyData.emergency_patterns || []).length * 3; // emergency = triple weight

          modularOutput.safety_score = Math.max(0, 100 - totalFlags * 15);

          // Build human-readable safety flags
          modularOutput.safety_flags = [
            ...(safetyData.interaction_flags || []).map((f: any) => `Interaction: ${f.drug_a} + ${f.drug_b} (${f.severity})`),
            ...(safetyData.allergy_flags || []).map((f: any) => `Allergy conflict: ${f.medication} vs ${f.allergy}`),
            ...(safetyData.dose_warnings || []).map((f: any) => `Dose: ${f.medication} — ${f.issue}`),
            ...(safetyData.vitals_dangers || []).map((f: any) => `Vital: ${f.parameter} ${f.value} (${f.severity})`),
            ...(safetyData.emergency_patterns || []).map((f: any) => `Emergency: ${f.pattern}`),
          ];

          moduleLogs.push({
            module: "oversight_engine",
            status: "success",
            latency_ms: Date.now() - osStart,
            details: `Safety score: ${modularOutput.safety_score}/100. Flags: ${totalFlags} (interactions: ${(safetyData.interaction_flags || []).length}, allergies: ${(safetyData.allergy_flags || []).length}, vitals: ${(safetyData.vitals_dangers || []).length}, emergencies: ${(safetyData.emergency_patterns || []).length})`,
          });
        } else {
          const errText = await safetyResp.text();
          moduleLogs.push({
            module: "oversight_engine",
            status: "error",
            latency_ms: Date.now() - osStart,
            details: `HTTP ${safetyResp.status}: ${errText.substring(0, 200)}`,
          });
        }
      } catch (e) {
        moduleLogs.push({
          module: "oversight_engine",
          status: "error",
          latency_ms: Date.now() - osStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }

      // ─── MODULE 5.5: Uncertainty Engine ─────────────────
      const uncStart = Date.now();
      let uncertaintyOutput: any = null;
      try {
        const safetyFlagsList = modularOutput.safety_flags || [];
        const uncUrl = `${supabaseUrl}/functions/v1/uncertainty-engine`;
        const uncResp = await fetch(uncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            symptoms: structuredContext.symptoms,
            vitals: structuredContext.vitals,
            differential_diagnoses: (modularOutput.ddx?.differential_diagnoses || modularOutput.hypotheses || []).map((d: any) => ({
              diagnosis_name: d.diagnosis_name || d.diagnosis,
              probability: d.probability || (d.confidence ? Math.round(d.confidence * 100) : 0),
              must_not_miss: d.must_not_miss || false,
              supporting_symptoms: d.supporting_symptoms || d.supporting_factors || [],
            })),
            suggested_labs: (modularOutput.ddx?.recommended_labs || []),
            guideline_sources: (modularOutput.compliance?.guideline_sources_used || []),
            guideline_recommendations: (modularOutput.ddx?.guideline_recommendations || []).map((g: any) => ({
              authority: g.authority,
              evidence_level: g.evidence_level,
            })),
            safety_flags: safetyFlagsList,
            safety_score: modularOutput.safety_score,
            medical_history: structuredContext.medical_history,
            current_medications: structuredContext.medications,
            allergies: structuredContext.allergies,
            matched_symptoms: modularOutput.ddx?.matched_symptoms || [],
            unmatched_symptoms: modularOutput.ddx?.unmatched_symptoms || [],
          }),
        });

        if (uncResp.ok) {
          uncertaintyOutput = await uncResp.json();
          moduleLogs.push({
            module: "uncertainty_engine",
            status: "success",
            latency_ms: Date.now() - uncStart,
            details: `Confidence: ${uncertaintyOutput.confidence_score} (${uncertaintyOutput.confidence_label}). Missing: ${uncertaintyOutput.missing_evidence?.length || 0} items. Conflicts: ${uncertaintyOutput.diagnostic_conflict ? "yes" : "no"}`,
          });
        } else {
          moduleLogs.push({
            module: "uncertainty_engine",
            status: "error",
            latency_ms: Date.now() - uncStart,
            details: `HTTP ${uncResp.status}`,
          });
        }
      } catch (e) {
        moduleLogs.push({
          module: "uncertainty_engine",
          status: "error",
          latency_ms: Date.now() - uncStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }
      modularOutput.uncertainty = uncertaintyOutput;


      // Calls clinical-soap edge function with combined context from all previous modules
      const soapStart = Date.now();
      try {
        // Build enriched extraction data from all modules
        const enrichedExtracted = {
          chief_complaint: structuredContext.chief_complaint,
          duration: structuredContext.symptom_duration,
          associated_symptoms: structuredContext.symptoms.slice(1).join(", "),
          vitals: JSON.stringify(structuredContext.vitals),
          chronic_conditions: structuredContext.medical_history.join(", "),
          current_medications: structuredContext.medications.join(", "),
          allergies: structuredContext.allergies.join(", "),
          // Enrich with modular pipeline results
          hypotheses: modularOutput.hypotheses.map((h: any) =>
            `${h.diagnosis} (confidence: ${Math.round((h.confidence || 0) * 100)}%)`
          ).join("; "),
          evidence_citations: (modularOutput.evidence?.citations || [])
            .slice(0, 3)
            .map((c: any) => `${c.title} (${c.source}, ${c.year})`)
            .join("; "),
          guideline_compliance: (modularOutput.compliance?.results || [])
            .map((r: any) => `${r.item}: ${r.compliance_status}`)
            .join("; "),
          safety_results: modularOutput.oversight || {},
        };

        const soapUrl = `${supabaseUrl}/functions/v1/clinical-soap`;
        const soapResp = await fetch(soapUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            apikey: anonKey,
          },
          body: JSON.stringify({
            transcript: syntheticTranscript,
            extractedData: enrichedExtracted,
            clinical_context: clinicalContext,
          }),
        });

        if (soapResp.ok) {
          const soapData = await soapResp.json();
          modularOutput.soap_sections = {
            "Visit Summary": soapData.sections?.["Visit Summary"] || "",
            "Findings": soapData.sections?.["Findings"] || "",
            "Provisional Diagnosis": soapData.sections?.["Provisional Diagnosis"] || "",
            "Safety Warnings": soapData.sections?.["Safety Warnings"] || "No safety concerns identified.",
            "Treatment Plan": soapData.sections?.["Treatment Plan"] || "",
            "Advice": soapData.sections?.["Advice"] || "",
            "Follow-up": soapData.sections?.["Follow-up"] || "",
          };

          moduleLogs.push({
            module: "soap_generator",
            status: "success",
            latency_ms: Date.now() - soapStart,
            details: "Generated enriched SOAP from combined module outputs",
          });
        } else {
          const errText = await soapResp.text();
          moduleLogs.push({
            module: "soap_generator",
            status: "error",
            latency_ms: Date.now() - soapStart,
            details: `HTTP ${soapResp.status}: ${errText.substring(0, 200)}`,
          });
        }
      } catch (e) {
        moduleLogs.push({
          module: "soap_generator",
          status: "error",
          latency_ms: Date.now() - soapStart,
          details: e instanceof Error ? e.message : "Unknown error",
        });
      }

    } catch (e) {
      modularOutput.error = `Modular pipeline error: ${e instanceof Error ? e.message : "Unknown"}`;
    }
    modularOutput.latency_ms = Date.now() - modularStart;

    // ══════════════════════════════════════
    // STEP 3: COMPARISON (Semantic Matching)
    // ══════════════════════════════════════

    // Load ontology tables for semantic matching
    const { data: conditionMap } = await admin
      .from("clinical_condition_map")
      .select("canonical_condition, synonyms");

    const { data: labEquiv } = await admin
      .from("lab_test_equivalence")
      .select("canonical_name, aliases");

    const { data: brandGenericMap } = await admin
      .from("drug_brand_generic_map")
      .select("brand_name, generic_name")
      .limit(500);

    // Text-based (legacy) overlap for reference
    const text_diagnosis_overlap = computeOverlap(legacyOutput.diagnoses, modularOutput.diagnoses);
    const text_lab_overlap = computeOverlap(legacyOutput.labs || [], modularOutput.labs);
    const text_medication_overlap = computeMedicationOverlap(legacyOutput.medications, modularOutput.medications);

    // Semantic overlap using ontology
    const semantic_diagnosis_overlap = computeSemanticDiagnosisOverlap(
      legacyOutput.diagnoses, modularOutput.diagnoses, conditionMap || []
    );
    const semantic_lab_overlap = computeSemanticLabOverlap(
      legacyOutput.labs || [], modularOutput.labs, labEquiv || []
    );
    const semantic_medication_overlap = computeGenericMedOverlap(
      legacyOutput.medications, modularOutput.medications, brandGenericMap || []
    );

    const comparison = {
      // Primary metrics (semantic)
      diagnosis_overlap: semantic_diagnosis_overlap,
      lab_overlap: semantic_lab_overlap,
      medication_overlap: semantic_medication_overlap,
      // Text-based metrics for reference
      text_diagnosis_overlap,
      text_lab_overlap,
      text_medication_overlap,
      // Semantic vs text delta
      semantic_diagnosis_delta: semantic_diagnosis_overlap - text_diagnosis_overlap,
      semantic_lab_delta: semantic_lab_overlap - text_lab_overlap,
      semantic_medication_delta: semantic_medication_overlap - text_medication_overlap,
      latency_difference_ms: legacyOutput.latency_ms - modularOutput.latency_ms,
      legacy_faster: legacyOutput.latency_ms < modularOutput.latency_ms,
      modules_executed: moduleLogs.filter(l => l.status === "success").length,
      modules_failed: moduleLogs.filter(l => l.status === "error").length,
      modules_total: moduleLogs.length,
    };

    // ══════════════════════════════════════
    // STEP 4: STORE TEST RESULTS
    // ══════════════════════════════════════
    await admin.from("ai_pipeline_tests").insert({
      patient_context: ctx,
      legacy_output: legacyOutput,
      modular_output: {
        ...modularOutput,
        module_logs: moduleLogs,
      },
      comparison_metrics: comparison,
      triggered_by: user.id,
    });

    // ══════════════════════════════════════
    // STEP 5: MONITORING EVENT
    // ══════════════════════════════════════
    await admin.from("monitoring_events").insert({
      event_type: "ai_pipeline_comparison",
      agent_name: "compare-ai-pipelines",
      duration_ms: legacyOutput.latency_ms + modularOutput.latency_ms,
      success: true,
      metadata: {
        user_id: user.id,
        comparison,
        legacy_latency: legacyOutput.latency_ms,
        modular_latency: modularOutput.latency_ms,
        module_logs: moduleLogs,
      },
    });

    return new Response(JSON.stringify({
      legacy_pipeline: {
        diagnoses: legacyOutput.diagnoses,
        labs: legacyOutput.labs || [],
        medications: legacyOutput.medications,
        latency_ms: legacyOutput.latency_ms,
        error: legacyOutput.error,
      },
      modular_pipeline: {
        diagnoses: modularOutput.diagnoses,
        labs: modularOutput.labs,
        medications: modularOutput.medications,
        guidelines: modularOutput.guidelines,
        safety_score: modularOutput.safety_score,
        safety_flags: modularOutput.safety_flags,
        ddx: modularOutput.ddx || null,
        hypotheses: modularOutput.hypotheses,
        evidence: modularOutput.evidence ? {
          citation_count: modularOutput.evidence.citations?.length || 0,
          sources_queried: modularOutput.evidence.sources_queried,
          retrieval_confidence: modularOutput.evidence.retrieval_confidence,
        } : null,
        compliance: modularOutput.compliance,
        oversight: modularOutput.oversight,
        soap_sections: modularOutput.soap_sections || null,
        latency_ms: modularOutput.latency_ms,
        error: modularOutput.error,
      },
      comparison,
      module_execution_logs: moduleLogs,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("compare-ai-pipelines error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
