import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Authority tier map ──
const AUTHORITY_TIERS: Record<string, { tier: number; label: string }> = {
  ICMR: { tier: 1, label: "National (India)" },
  NHS: { tier: 1, label: "National (UK)" },
  WHO: { tier: 2, label: "Global" },
  NICE: { tier: 3, label: "Specialty Society" },
  CDC: { tier: 3, label: "Specialty Society" },
  IDSA: { tier: 3, label: "Specialty Society" },
  AHA: { tier: 3, label: "Specialty Society" },
  ESC: { tier: 3, label: "Specialty Society" },
  ADA: { tier: 3, label: "Specialty Society" },
};

function getAuthorityTier(org: string): { tier: number; label: string } {
  const upper = org.toUpperCase();
  for (const [key, val] of Object.entries(AUTHORITY_TIERS)) {
    if (upper.includes(key)) return val;
  }
  return { tier: 5, label: "Literature" };
}

interface ComplianceRequest {
  diagnoses: string[];
  medications: Array<{ drug_name: string; dose: string; frequency: string; duration: string }>;
  tests: string[];
  care_plan: string;
  patient_age?: number;
  patient_sex?: string;
  chief_complaint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const body: ComplianceRequest = await req.json();
    const { diagnoses = [], medications = [], tests = [], care_plan = "", patient_age, patient_sex, chief_complaint } = body;

    if (diagnoses.length === 0 && medications.length === 0 && tests.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        results: [],
        compliance_score: 100,
        conflicts: [],
        management_steps: [],
        guidelines_matched: 0,
        guidelines_sources: [],
        message: "No items to evaluate",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ══════════════════════════════════════════════════════
    // STAGE 1: Relational traversal — diagnoses → guideline_rules → authorities
    // ══════════════════════════════════════════════════════
    let relationalGuidelines: any[] = [];
    let matchedDiagnoses: any[] = [];

    if (diagnoses.length > 0) {
      const diagFilters = diagnoses.slice(0, 10).map((d: string) => `diagnosis_name.ilike.%${d.trim()}%`).join(",");
      const { data: diagRows } = await sb
        .from("diagnoses")
        .select("id, diagnosis_name, icd10_code")
        .or(diagFilters);

      matchedDiagnoses = diagRows || [];
      const diagnosisIds = matchedDiagnoses.map((d: any) => d.id);

      if (diagnosisIds.length > 0) {
        const { data: rules } = await sb
          .from("guideline_rules")
          .select("id, recommendation, evidence_level, treatment_generic_name, diagnosis_id, guideline_authorities(id, authority_name, priority, country)")
          .in("diagnosis_id", diagnosisIds);

        if (rules && rules.length > 0) {
          for (const rule of rules) {
            const diagName = matchedDiagnoses.find((d: any) => d.id === rule.diagnosis_id)?.diagnosis_name || "";
            const authority = (rule as any).guideline_authorities;
            const authorityName = authority?.authority_name || "Unknown";
            const tierInfo = getAuthorityTier(authorityName);

            relationalGuidelines.push({
              id: rule.id,
              title: `${authorityName} — ${diagName} Management`,
              source_organization: authorityName,
              year: 2024,
              evidence_grade: rule.evidence_level,
              recommendation_text: rule.recommendation,
              condition: diagName,
              treatment: rule.treatment_generic_name,
              applicable_drugs: [rule.treatment_generic_name],
              applicable_tests: [],
              guideline_url: null,
              tier: tierInfo.tier,
              tier_label: tierInfo.label,
              authority_priority: authority?.priority ?? 10,
              country: authority?.country || "global",
            });
          }
          relationalGuidelines.sort((a: any, b: any) => a.authority_priority - b.authority_priority);
        }
      }
    }

    // ══════════════════════════════════════════════════════
    // STAGE 1b: Diagnosis → guideline_registry via diagnosis_guideline_map
    // ══════════════════════════════════════════════════════
    let registryGuidelines: any[] = [];
    if (matchedDiagnoses.length > 0) {
      const diagIds = matchedDiagnoses.map((d: any) => d.id);
      const { data: maps } = await sb
        .from("diagnosis_guideline_map")
        .select("guideline_id, relevance_score, recommendation_summary, diagnosis_id")
        .in("diagnosis_id", diagIds)
        .order("relevance_score", { ascending: false })
        .limit(10);

      if (maps && maps.length > 0) {
        const guidelineIds = [...new Set(maps.map((m: any) => m.guideline_id))];
        const { data: guidelines } = await sb
          .from("guideline_registry")
          .select("*")
          .in("id", guidelineIds)
          .eq("is_active", true);

        if (guidelines) {
          for (const g of guidelines) {
            const map = maps.find((m: any) => m.guideline_id === g.id);
            const tierInfo = getAuthorityTier(g.organization);
            registryGuidelines.push({
              id: g.id,
              title: g.title,
              source_organization: g.organization,
              year: g.publication_date ? new Date(g.publication_date).getFullYear() : 2024,
              evidence_grade: "A",
              recommendation_text: map?.recommendation_summary || g.recommendation_text,
              condition: g.condition,
              applicable_drugs: g.applicable_drugs || [],
              applicable_tests: g.applicable_tests || [],
              guideline_url: g.guideline_url,
              tier: tierInfo.tier,
              tier_label: tierInfo.label,
              relevance_score: map?.relevance_score || 0,
              country: g.country,
            });
          }
        }
      }
    }

    // STAGE 1c: Fallback — keyword search in clinical_guidelines
    if (relationalGuidelines.length + registryGuidelines.length < 2) {
      const searchTerms = [
        ...diagnoses,
        ...medications.map(m => m.drug_name),
        ...tests,
        chief_complaint,
      ].filter(Boolean);

      for (const term of searchTerms.slice(0, 4)) {
        const { data } = await sb
          .from("clinical_guidelines")
          .select("*")
          .eq("is_active", true)
          .or(`condition.ilike.%${term}%,clinical_topic.ilike.%${term}%,title.ilike.%${term}%`)
          .limit(3);
        if (data) {
          for (const g of data) {
            const tierInfo = getAuthorityTier(g.source_organization || "");
            registryGuidelines.push({
              id: g.id,
              title: g.title,
              source_organization: g.source_organization,
              year: g.year,
              evidence_grade: g.evidence_grade,
              recommendation_text: g.recommendation_text,
              condition: g.condition,
              applicable_drugs: g.applicable_drugs || [],
              applicable_tests: g.applicable_tests || [],
              guideline_url: g.guideline_url,
              tier: tierInfo.tier,
              tier_label: tierInfo.label,
              country: "global",
            });
          }
        }
      }
    }

    // Combine and deduplicate
    const seenIds = new Set<string>();
    const allGuidelines = [...relationalGuidelines, ...registryGuidelines].filter(g => {
      if (seenIds.has(g.id)) return false;
      seenIds.add(g.id);
      return true;
    }).slice(0, 15);

    // ══════════════════════════════════════════════════════
    // STAGE 2: Conflict Detection (deterministic)
    // Compare prescribed medications against guideline-recommended treatments
    // ══════════════════════════════════════════════════════
    const conflicts: any[] = [];
    const managementSteps: any[] = [];

    const prescribedDrugs = medications.map(m => m.drug_name.toLowerCase().trim());

    for (const g of allGuidelines) {
      // Extract management steps from each guideline
      if (g.recommendation_text) {
        managementSteps.push({
          step: g.recommendation_text,
          source: g.source_organization,
          tier: g.tier,
          tier_label: g.tier_label || "Unknown",
          condition: g.condition,
          evidence_grade: g.evidence_grade,
        });
      }

      // Check if guideline recommends specific drugs that were NOT prescribed
      const guidelineDrugs = (g.applicable_drugs || []).map((d: string) => d.toLowerCase().trim());
      if (guidelineDrugs.length > 0 && prescribedDrugs.length > 0) {
        // Check for prescribed drugs NOT in guideline recommendations for this condition
        for (const prescribed of prescribedDrugs) {
          const isRecommended = guidelineDrugs.some((gd: string) =>
            gd.includes(prescribed) || prescribed.includes(gd)
          );
          if (!isRecommended && g.condition && diagnoses.some(d => d.toLowerCase().includes(g.condition.toLowerCase()))) {
            // Check if any guideline drug conflicts with prescribed
            conflicts.push({
              type: "unlisted_drug",
              severity: g.tier <= 2 ? "high" : "moderate",
              prescribed_drug: prescribed,
              guideline_recommends: guidelineDrugs.join(", "),
              source: g.source_organization,
              tier: g.tier,
              condition: g.condition,
              explanation: `${prescribed} is not listed in ${g.source_organization} guidelines for ${g.condition}. Recommended: ${guidelineDrugs.join(", ")}.`,
            });
          }
        }
      }
    }

    // Deduplicate conflicts by drug+source
    const uniqueConflicts: any[] = [];
    const conflictKeys = new Set<string>();
    for (const c of conflicts) {
      const key = `${c.prescribed_drug}|${c.source}`;
      if (!conflictKeys.has(key)) {
        conflictKeys.add(key);
        uniqueConflicts.push(c);
      }
    }

    // Deduplicate management steps
    const uniqueSteps: any[] = [];
    const stepKeys = new Set<string>();
    for (const s of managementSteps) {
      const key = `${s.source}|${s.condition}`;
      if (!stepKeys.has(key)) {
        stepKeys.add(key);
        uniqueSteps.push(s);
      }
    }
    // Sort by tier (national first)
    uniqueSteps.sort((a: any, b: any) => a.tier - b.tier);

    // ══════════════════════════════════════════════════════
    // STAGE 3: DETERMINISTIC compliance evaluation (stored rules first)
    // The AI model is only consulted for items that no stored guideline covers.
    // ══════════════════════════════════════════════════════
    const itemsToEvaluate = [
      ...diagnoses.map(d => ({ item: d, type: "diagnosis" })),
      ...medications.map(m => ({ item: `${m.drug_name} ${m.dose} ${m.frequency}`.trim(), type: "medication", drug: m.drug_name })),
      ...tests.map(t => ({ item: t, type: "test" })),
      ...(care_plan ? [{ item: care_plan, type: "care_plan" }] : []),
    ] as Array<{ item: string; type: string; drug?: string }>;

    const norm = (s: string) => (s || "").toLowerCase().trim();
    const overlaps = (a: string, b: string) => {
      const x = norm(a), y = norm(b);
      if (!x || !y) return false;
      return x.includes(y) || y.includes(x);
    };

    const deterministicResults: any[] = [];
    const unresolved: Array<{ item: string; type: string }> = [];

    for (const entry of itemsToEvaluate) {
      let matched: any[] = [];
      let status: string | null = null;
      let explanation = "";

      if (entry.type === "diagnosis") {
        matched = allGuidelines.filter(g => overlaps(g.condition || "", entry.item));
        if (matched.length > 0) {
          status = "guideline_aligned";
          const top = matched[0];
          explanation = `${top.source_organization} (${top.year}) guidance exists for ${top.condition}: ${top.recommendation_text}`;
        }
      } else if (entry.type === "medication") {
        const drug = norm(entry.drug || entry.item);
        const conditionGuidelines = allGuidelines.filter(g =>
          diagnoses.some(d => overlaps(g.condition || "", d)));
        const pool = conditionGuidelines.length > 0 ? conditionGuidelines : allGuidelines;
        matched = pool.filter(g => (g.applicable_drugs || []).some((gd: string) => gd && overlaps(gd, drug)));
        if (matched.length > 0) {
          status = "guideline_aligned";
          const top = matched[0];
          explanation = `Listed as a recommended agent for ${top.condition} by ${top.source_organization} (${top.year}).`;
        } else if (conditionGuidelines.some(g => (g.applicable_drugs || []).length > 0)) {
          status = "review_suggested";
          matched = conditionGuidelines.filter(g => (g.applicable_drugs || []).length > 0);
          const top = matched[0];
          explanation = `Not listed in ${top.source_organization} (${top.year}) guidance for ${top.condition}. Recommended: ${(top.applicable_drugs || []).join(", ")}.`;
        }
      } else if (entry.type === "test") {
        matched = allGuidelines.filter(g => (g.applicable_tests || []).some((gt: string) => gt && overlaps(gt, entry.item)));
        if (matched.length > 0) {
          status = "guideline_aligned";
          const top = matched[0];
          explanation = `Recommended investigation for ${top.condition} per ${top.source_organization} (${top.year}).`;
        }
      }

      if (status) {
        deterministicResults.push({
          item: entry.item,
          item_type: entry.type,
          compliance_status: status,
          explanation,
          matching_guidelines: matched.slice(0, 2).map(g => ({
            guideline_id: g.id,
            title: g.title,
            source: g.source_organization,
            source_organization: g.source_organization,
            year: g.year,
            evidence_grade: g.evidence_grade,
            recommendation_text: g.recommendation_text,
            guideline_url: g.guideline_url || "",
            tier: g.tier,
            tier_label: g.tier_label,
          })),
          resolved_by: "stored_guidelines",
        });
      } else {
        unresolved.push({ item: entry.item, type: entry.type });
      }
    }

    const guidelineContext = allGuidelines.slice(0, 12).map(g =>
      `[${g.source_organization}] (Tier ${g.tier}: ${g.tier_label}) ${g.title}\nCondition: ${g.condition}\nGrade: ${g.evidence_grade}\nRecommendation: ${g.recommendation_text}\nDrugs: ${(g.applicable_drugs || []).join(", ")}\nTests: ${(g.applicable_tests || []).join(", ")}`
    ).join("\n\n---\n\n");

    // ══════════════════════════════════════════════════════
    // STAGE 3b: AI fallback — ONLY for items no stored rule covers
    // ══════════════════════════════════════════════════════
    let evaluations: any[] = [];
    let aiUsed = false;

    if (unresolved.length > 0 && !deterministic_only) {
      aiUsed = true;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a clinical guideline compliance evaluator. Compare recommendations against trusted medical guidelines (WHO, NICE, ICMR, IDSA, AHA, ESC, ADA). For each item classify:
- "guideline_aligned": Directly matches a specific guideline recommendation
- "evidence_supported": Consistent with evidence but no exact guideline match
- "review_suggested": Deviates from guidelines or insufficient evidence

Be conservative — only "guideline_aligned" when a clear match exists. Reference the specific guideline source.
Patient: Age ${patient_age || "unknown"}, Sex ${patient_sex || "unknown"}, Chief complaint: ${chief_complaint || "not specified"}.`,
          },
          {
            role: "user",
            content: `Evaluate these clinical items against the guidelines below.

Items:
${unresolved.map((item, i) => `${i + 1}. [${item.type}] ${item.item}`).join("\n")}

Guidelines:
${guidelineContext || "No matching guidelines found. Evaluate based on general clinical evidence."}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "evaluate_compliance",
            description: "Evaluate clinical recommendations against guidelines",
            parameters: {
              type: "object",
              properties: {
                evaluations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      item: { type: "string" },
                      item_type: { type: "string", enum: ["diagnosis", "medication", "test", "care_plan"] },
                      compliance_status: { type: "string", enum: ["guideline_aligned", "evidence_supported", "review_suggested"] },
                      explanation: { type: "string" },
                      matching_guideline_source: { type: "string" },
                    },
                    required: ["item", "item_type", "compliance_status", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["evaluations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "evaluate_compliance" } },
      }),
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limit exceeded");
        if (response.status === 402) throw new Error("AI credits required");
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) throw new Error("No structured output from AI");

      evaluations = JSON.parse(toolCall.function.arguments).evaluations || [];
    } else if (unresolved.length > 0) {
      // Deterministic-only mode: unresolved items are flagged for review, no AI call.
      evaluations = unresolved.map(u => ({
        item: u.item,
        item_type: u.type,
        compliance_status: "review_suggested",
        explanation: "No stored guideline covers this item.",
      }));
    }


    // ══════════════════════════════════════════════════════
    // STAGE 4: Enrich results with guideline citations
    // ══════════════════════════════════════════════════════
    const results = evaluations.map((ev: any) => {
      const matchingGuidelines: any[] = [];
      if (ev.matching_guideline_source) {
        const matched = allGuidelines.filter(g =>
          g.source_organization?.toLowerCase().includes(ev.matching_guideline_source.toLowerCase()) ||
          g.title?.toLowerCase().includes(ev.matching_guideline_source.toLowerCase())
        );
        matched.slice(0, 2).forEach(g => {
          matchingGuidelines.push({
            guideline_id: g.id,
            title: g.title,
            source: g.source_organization,
            source_organization: g.source_organization,
            year: g.year,
            evidence_grade: g.evidence_grade,
            recommendation_text: g.recommendation_text,
            guideline_url: g.guideline_url || "",
            tier: g.tier,
            tier_label: g.tier_label,
          });
        });
      }

      return {
        item: ev.item,
        item_type: ev.item_type,
        compliance_status: ev.compliance_status,
        explanation: ev.explanation,
        matching_guidelines: matchingGuidelines,
        resolved_by: "ai_fallback",
      };
    });

    const results = [...deterministicResults, ...aiResults];


    // ══════════════════════════════════════════════════════
    // STAGE 5: Compute compliance score
    // ══════════════════════════════════════════════════════
    const totalItems = results.length || 1;
    const alignedCount = results.filter((r: any) => r.compliance_status === "guideline_aligned").length;
    const supportedCount = results.filter((r: any) => r.compliance_status === "evidence_supported").length;
    const reviewCount = results.filter((r: any) => r.compliance_status === "review_suggested").length;

    // Weighted score: aligned=100%, supported=70%, review=30%
    const complianceScore = Math.round(
      ((alignedCount * 100 + supportedCount * 70 + reviewCount * 30) / (totalItems * 100)) * 100
    );

    const durationMs = Date.now() - startMs;
    const allSources = [...new Set(allGuidelines.map(g => g.source_organization))];

    // Log to monitoring
    try {
      await sb.from("monitoring_events").insert({
        event_type: "guideline_compliance_check",
        agent_name: "guideline-compliance",
        duration_ms: durationMs,
        success: true,
        metadata: {
          diagnoses_count: diagnoses.length,
          medications_count: medications.length,
          guidelines_matched: allGuidelines.length,
          compliance_score: complianceScore,
          conflicts_count: uniqueConflicts.length,
          sources: allSources,
        },
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      success: true,
      results,
      compliance_score: complianceScore,
      score_breakdown: {
        aligned: alignedCount,
        evidence_supported: supportedCount,
        review_suggested: reviewCount,
        total: totalItems,
      },
      conflicts: uniqueConflicts.slice(0, 10),
      management_steps: uniqueSteps.slice(0, 8),
      guidelines_matched: allGuidelines.length,
      guidelines_sources: allSources,
      authority_tiers_used: [...new Set(allGuidelines.map(g => `Tier ${g.tier}: ${g.tier_label}`))],
      duration_ms: durationMs,
      disclaimer: "Guideline compliance is advisory. All clinical decisions require physician judgment.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("guideline-compliance error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("credits") ? 402 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
