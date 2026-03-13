import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// ─── Types ──────────────────────────────────────────────────────
interface ExtractedData {
  symptom_likelihoods: Array<{
    symptom: string;
    disease_name: string;
    probability: number;
    weight: number;
    evidence_level: string;
  }>;
  symptom_physiology: Array<{
    symptom: string;
    physiology_process: string;
    organ_system: string;
  }>;
  physiology_diagnosis: Array<{
    physiology_process: string;
    disease_name: string;
    confidence_score: number;
  }>;
  disease_tests: Array<{
    disease_name: string;
    test_name: string;
    test_category: string;
    diagnostic_strength: string;
  }>;
  disease_treatments: Array<{
    disease_name: string;
    drug_name: string;
    drug_class: string;
    line_of_treatment: string;
    guideline_source: string;
  }>;
}

// ─── Implausible pairs (Safety Filter) ─────────────────────────
const IMPLAUSIBLE_PAIRS: Array<[string, string]> = [
  ["stroke", "runny nose"], ["appendicitis", "cough"],
  ["myocardial infarction", "dandruff"], ["pneumonia", "itchy scalp"],
  ["meningitis", "ingrown toenail"], ["pulmonary embolism", "acne"],
  ["aortic dissection", "hiccups"], ["heart failure", "hair loss"],
  ["stroke", "sneezing"], ["appendicitis", "ear pain"],
];

function isImplausible(symptom: string, disease: string): boolean {
  const s = symptom.toLowerCase(), d = disease.toLowerCase();
  return IMPLAUSIBLE_PAIRS.some(([bd, bs]) =>
    (d.includes(bd) && s.includes(bs)) || (s.includes(bd) && d.includes(bs))
  );
}

// ─── Name-to-ID resolvers with upsert ──────────────────────────
async function resolveSymptomId(supabase: any, name: string): Promise<string | null> {
  const normalized = name.toLowerCase().trim();
  const { data } = await supabase
    .from("symptoms").select("id").eq("symptom_name", normalized).maybeSingle();
  if (data) return data.id;
  const { data: inserted, error } = await supabase
    .from("symptoms").insert({ symptom_name: normalized, category: "extracted" }).select("id").single();
  return error ? null : inserted.id;
}

async function resolveDiagnosisId(supabase: any, name: string): Promise<string | null> {
  const normalized = name.toLowerCase().trim();
  const { data } = await supabase
    .from("diagnoses").select("id").eq("diagnosis_name", normalized).maybeSingle();
  if (data) return data.id;
  const { data: inserted, error } = await supabase
    .from("diagnoses").insert({ diagnosis_name: normalized, category: "extracted" }).select("id").single();
  return error ? null : inserted.id;
}

async function resolveAnatomicalSystemId(supabase: any, name: string): Promise<string | null> {
  const normalized = name.toLowerCase().trim();
  const { data } = await supabase
    .from("anatomical_systems").select("id").eq("system_name", normalized).maybeSingle();
  if (data) return data.id;
  const { data: inserted, error } = await supabase
    .from("anatomical_systems").insert({ system_name: normalized, description: "" }).select("id").single();
  return error ? null : inserted.id;
}

async function resolvePhysiologicalStateId(
  supabase: any, name: string, organSystem: string
): Promise<string | null> {
  const normalized = name.toLowerCase().trim();
  const { data } = await supabase
    .from("physiological_states").select("id").eq("state_name", normalized).maybeSingle();
  if (data) return data.id;
  const systemId = await resolveAnatomicalSystemId(supabase, organSystem);
  if (!systemId) return null;
  const { data: inserted, error } = await supabase
    .from("physiological_states")
    .insert({ state_name: normalized, system_id: systemId, description: "" })
    .select("id").single();
  return error ? null : inserted.id;
}

// ─── PubMed retrieval ──────────────────────────────────────────
async function fetchPubMedAbstracts(
  disease: string, queryType: string, maxResults = 5
): Promise<Array<{ pmid: string; title: string; abstract: string }>> {
  const query = `${disease} ${queryType}`;
  const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&sort=relevance`;
  const searchResp = await fetch(searchUrl);
  if (!searchResp.ok) { await searchResp.text(); return []; }
  const searchData = await searchResp.json();
  const ids: string[] = searchData?.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const fetchUrl = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const fetchResp = await fetch(fetchUrl);
  if (!fetchResp.ok) { await fetchResp.text(); return []; }
  const xml = await fetchResp.text();

  const articles: Array<{ pmid: string; title: string; abstract: string }> = [];
  for (const block of xml.split("<PubmedArticle>").slice(1)) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
    const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
    const abstractText = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
      ?.map(t => t.replace(/<[^>]+>/g, "").trim()).join(" ") || "";
    articles.push({ pmid, title, abstract: abstractText.substring(0, 2000) });
  }
  return articles;
}

// ─── AI extraction via Lovable AI ──────────────────────────────
async function extractRelationships(
  disease: string, abstracts: string[], apiKey: string
): Promise<ExtractedData> {
  const combinedText = abstracts.join("\n\n---\n\n").substring(0, 12000);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are a medical knowledge extraction system. Extract structured clinical relationships from medical literature abstracts.

RULES:
- Only extract relationships explicitly supported by the text
- Use standard medical terminology (lowercase)
- For symptom-disease probability: hallmark=0.8-0.95, common=0.6-0.8, occasional=0.3-0.6
- Do NOT include relationships with probability < 0.3
- evidence_level: "strong", "moderate", or "limited"
- diagnostic_strength: "definitive", "strong", "moderate", or "supportive"
- line_of_treatment: "first_line", "second_line", or "adjunct"
- organ_system must be one of: cardiovascular, respiratory, neurological, gastrointestinal, endocrine, renal, musculoskeletal, dermatological, hematological, immunological, ent, psychiatric, general`,
        },
        {
          role: "user",
          content: `Extract all clinical relationships for "${disease}" from these abstracts:\n\n${combinedText}`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "report_extracted_relationships",
          description: "Report extracted medical relationships from literature",
          parameters: {
            type: "object",
            properties: {
              symptom_likelihoods: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    symptom: { type: "string" },
                    disease_name: { type: "string" },
                    probability: { type: "number" },
                    weight: { type: "number" },
                    evidence_level: { type: "string", enum: ["strong", "moderate", "limited"] },
                  },
                  required: ["symptom", "disease_name", "probability", "weight", "evidence_level"],
                  additionalProperties: false,
                },
              },
              symptom_physiology: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    symptom: { type: "string" },
                    physiology_process: { type: "string" },
                    organ_system: { type: "string" },
                  },
                  required: ["symptom", "physiology_process", "organ_system"],
                  additionalProperties: false,
                },
              },
              physiology_diagnosis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    physiology_process: { type: "string" },
                    disease_name: { type: "string" },
                    confidence_score: { type: "number" },
                    organ_system: { type: "string" },
                  },
                  required: ["physiology_process", "disease_name", "confidence_score", "organ_system"],
                  additionalProperties: false,
                },
              },
              disease_tests: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    disease_name: { type: "string" },
                    test_name: { type: "string" },
                    test_category: { type: "string" },
                    diagnostic_strength: { type: "string", enum: ["definitive", "strong", "moderate", "supportive"] },
                  },
                  required: ["disease_name", "test_name", "test_category", "diagnostic_strength"],
                  additionalProperties: false,
                },
              },
              disease_treatments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    disease_name: { type: "string" },
                    drug_name: { type: "string" },
                    drug_class: { type: "string" },
                    line_of_treatment: { type: "string", enum: ["first_line", "second_line", "adjunct"] },
                    guideline_source: { type: "string" },
                  },
                  required: ["disease_name", "drug_name", "drug_class", "line_of_treatment", "guideline_source"],
                  additionalProperties: false,
                },
              },
            },
            required: ["symptom_likelihoods", "symptom_physiology", "physiology_diagnosis", "disease_tests", "disease_treatments"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "report_extracted_relationships" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI extraction failed:", response.status, errText);
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");
  return JSON.parse(toolCall.function.arguments) as ExtractedData;
}

// ─── Graph insertion with ID resolution + dedup ────────────────
async function insertRelationships(
  supabase: any, extracted: ExtractedData
): Promise<{ inserted: Record<string, number>; rejected: number }> {
  const inserted: Record<string, number> = {
    symptom_likelihoods: 0, symptom_physiology_map: 0,
    physiology_diagnosis_map: 0, disease_tests: 0, disease_treatments: 0,
  };
  let rejected = 0;

  // 1. Symptom likelihoods (FK: symptom_id, diagnosis_id)
  for (const sl of extracted.symptom_likelihoods) {
    if (sl.probability < 0.3 || isImplausible(sl.symptom, sl.disease_name)) { rejected++; continue; }
    const symptomId = await resolveSymptomId(supabase, sl.symptom);
    const diagnosisId = await resolveDiagnosisId(supabase, sl.disease_name);
    if (!symptomId || !diagnosisId) continue;

    const { data: existing } = await supabase
      .from("symptom_likelihoods").select("id")
      .eq("symptom_id", symptomId).eq("diagnosis_id", diagnosisId).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("symptom_likelihoods").insert({
      symptom_id: symptomId, diagnosis_id: diagnosisId, likelihood_value: sl.probability,
    });
    if (!error) inserted.symptom_likelihoods++;
  }

  // 2. Symptom physiology (FK: symptom_id, physiological_state_id)
  for (const sp of extracted.symptom_physiology) {
    const symptomId = await resolveSymptomId(supabase, sp.symptom);
    const stateId = await resolvePhysiologicalStateId(supabase, sp.physiology_process, sp.organ_system);
    if (!symptomId || !stateId) continue;

    const { data: existing } = await supabase
      .from("symptom_physiology_map").select("id")
      .eq("symptom_id", symptomId).eq("physiological_state_id", stateId).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("symptom_physiology_map").insert({
      symptom_id: symptomId, physiological_state_id: stateId, confidence_score: 0.7,
    });
    if (!error) inserted.symptom_physiology_map++;
  }

  // 3. Physiology → diagnosis (FK: physiological_state_id, diagnosis_id)
  for (const pd of extracted.physiology_diagnosis) {
    const stateId = await resolvePhysiologicalStateId(supabase, pd.physiology_process, pd.organ_system || "general");
    const diagnosisId = await resolveDiagnosisId(supabase, pd.disease_name);
    if (!stateId || !diagnosisId) continue;

    const { data: existing } = await supabase
      .from("physiology_diagnosis_map").select("id")
      .eq("physiological_state_id", stateId).eq("diagnosis_id", diagnosisId).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("physiology_diagnosis_map").insert({
      physiological_state_id: stateId, diagnosis_id: diagnosisId, relevance_score: pd.confidence_score,
    });
    if (!error) inserted.physiology_diagnosis_map++;
  }

  // 4. Disease tests (text columns — direct insert)
  for (const dt of extracted.disease_tests) {
    const { data: existing } = await supabase
      .from("disease_tests").select("id")
      .eq("disease_name", dt.disease_name.toLowerCase()).eq("test_name", dt.test_name.toLowerCase()).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("disease_tests").insert({
      disease_name: dt.disease_name.toLowerCase(),
      test_name: dt.test_name.toLowerCase(),
      test_category: dt.test_category,
      diagnostic_strength: dt.diagnostic_strength,
    });
    if (!error) inserted.disease_tests++;
  }

  // 5. Disease treatments (text columns — direct insert)
  for (const tr of extracted.disease_treatments) {
    const { data: existing } = await supabase
      .from("disease_treatments").select("id")
      .eq("disease_name", tr.disease_name.toLowerCase()).eq("drug_name", tr.drug_name.toLowerCase()).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("disease_treatments").insert({
      disease_name: tr.disease_name.toLowerCase(),
      drug_name: tr.drug_name.toLowerCase(),
      drug_class: tr.drug_class,
      line_of_treatment: tr.line_of_treatment,
      guideline_source: tr.guideline_source,
    });
    if (!error) inserted.disease_treatments++;
  }

  return { inserted, rejected };
}

// ─── Main handler ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  if (!lovableKey) {
    return new Response(
      JSON.stringify({ success: false, error: "LOVABLE_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const diseases: string[] = body.diseases || [];
    const maxArticlesPerDisease: number = body.max_articles || 5;
    const dryRun: boolean = body.dry_run || false;

    if (diseases.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Provide at least one disease name in 'diseases' array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pipelineStats: Array<{ stage: string; count: number; duration_ms: number }> = [];
    const allResults: Record<string, any> = {};

    for (const disease of diseases.slice(0, 10)) {
      console.log(`[KG-Extract] Processing: ${disease}`);
      const diseaseStart = Date.now();

      // Stage 1: Literature retrieval
      const s1Start = Date.now();
      const queryTypes = ["clinical presentation symptoms", "pathophysiology mechanism", "diagnostic tests", "treatment guidelines"];
      const allAbstracts: string[] = [];
      for (const qt of queryTypes) {
        const articles = await fetchPubMedAbstracts(disease, qt, Math.ceil(maxArticlesPerDisease / 4));
        for (const a of articles) {
          if (a.abstract) allAbstracts.push(`[${a.title}]\n${a.abstract}`);
          else if (a.title) allAbstracts.push(a.title);
        }
      }
      pipelineStats.push({ stage: `retrieval:${disease}`, count: allAbstracts.length, duration_ms: Date.now() - s1Start });

      if (allAbstracts.length === 0) {
        allResults[disease] = { skipped: true, reason: "no_abstracts" };
        continue;
      }

      // Stage 2+3: AI extraction
      const s2Start = Date.now();
      let extracted: ExtractedData;
      try {
        extracted = await extractRelationships(disease, allAbstracts, lovableKey);
      } catch (e) {
        allResults[disease] = { skipped: true, reason: "extraction_error", error: e.message };
        continue;
      }
      const totalExtracted = extracted.symptom_likelihoods.length + extracted.symptom_physiology.length +
        extracted.physiology_diagnosis.length + extracted.disease_tests.length + extracted.disease_treatments.length;
      pipelineStats.push({ stage: `extraction:${disease}`, count: totalExtracted, duration_ms: Date.now() - s2Start });

      // Stage 5+6: Insert with safety filter + dedup
      if (!dryRun) {
        const s5Start = Date.now();
        const { inserted, rejected } = await insertRelationships(supabase, extracted);
        pipelineStats.push({
          stage: `insertion:${disease}`,
          count: Object.values(inserted).reduce((a, b) => a + b, 0),
          duration_ms: Date.now() - s5Start,
        });
        allResults[disease] = { inserted, rejected };
      } else {
        allResults[disease] = {
          dry_run: true,
          extracted: {
            symptom_likelihoods: extracted.symptom_likelihoods.length,
            symptom_physiology: extracted.symptom_physiology.length,
            physiology_diagnosis: extracted.physiology_diagnosis.length,
            disease_tests: extracted.disease_tests.length,
            disease_treatments: extracted.disease_treatments.length,
          },
        };
      }

      console.log(`[KG-Extract] Completed ${disease} in ${Date.now() - diseaseStart}ms`);
    }

    // Log monitoring event
    await supabase.from("monitoring_events").insert({
      event_type: "knowledge_graph_extraction",
      agent_name: "extract-knowledge-graph",
      success: true,
      metadata: { diseases, dry_run: dryRun, stats: pipelineStats, results: allResults },
    });

    return new Response(
      JSON.stringify({ success: true, diseases_processed: Object.keys(allResults).length, results: allResults, pipeline_stats: pipelineStats }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[KG-Extract] Pipeline error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
