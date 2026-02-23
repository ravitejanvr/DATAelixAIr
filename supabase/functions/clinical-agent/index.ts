import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EUROPE_PMC_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";

async function searchPubMed(query: string, max = 5): Promise<any[]> {
  try {
    const searchUrl = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${max}&retmode=json&sort=relevance`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();
    const ids = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const fetchUrl = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const fetchResp = await fetch(fetchUrl);
    const xml = await fetchResp.text();

    const articles: any[] = [];
    const blocks = xml.split("<PubmedArticle>").slice(1);
    for (const block of blocks) {
      const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
      const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const abstractText = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
        ?.map(t => t.replace(/<[^>]+>/g, "").trim()).join(" ") || "";
      const year = block.match(/<Year>(\d{4})<\/Year>/)?.[1] || "";
      articles.push({ pmid, title, abstract: abstractText.substring(0, 800), year, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` });
    }
    return articles;
  } catch (e) {
    console.error("PubMed search failed:", e);
    return [];
  }
}

async function searchEuropePMC(query: string, max = 3): Promise<any[]> {
  try {
    const url = `${EUROPE_PMC_BASE}/search?query=${encodeURIComponent(query)}&resultType=core&pageSize=${max}&format=json`;
    const resp = await fetch(url);
    const data = await resp.json();
    return (data?.resultList?.result || []).map((r: any) => ({
      pmid: r.pmid || r.id || "",
      title: r.title || "",
      abstract: (r.abstractText || "").substring(0, 800),
      year: r.pubYear || "",
      url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : "",
    }));
  } catch (e) {
    console.error("Europe PMC search failed:", e);
    return [];
  }
}

async function searchICD11(term: string): Promise<string[]> {
  try {
    const resp = await fetch(`https://id.who.int/icd/release/11/2024-01/mms/search?q=${encodeURIComponent(term)}&subtreeFilterUsesFoundationDescendants=false&includeKeywordResult=false&flatResults=true&useFlexisearch=true&highlightingEnabled=false`, {
      headers: { "API-Version": "v2", "Accept-Language": "en", "Accept": "application/json" },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.destinationEntities || []).slice(0, 3).map((e: any) => {
      const code = e.theCode || "";
      const title = e.title || "";
      return `${code}: ${title}`;
    });
  } catch {
    return [];
  }
}

async function searchDailyMed(drugName: string): Promise<string> {
  try {
    const resp = await fetch(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(drugName)}&pagesize=1`);
    if (!resp.ok) return "";
    const data = await resp.json();
    const spl = data?.data?.[0];
    if (!spl) return "";
    return `[DailyMed] ${drugName}: SPL SetID ${spl.setid}, Title: ${spl.title || "N/A"}`;
  } catch {
    return "";
  }
}

async function searchOpenFDA(drugName: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"&limit=1`);
    if (!resp.ok) return "";
    const data = await resp.json();
    const result = data?.results?.[0];
    if (!result) return "";
    const warnings = result.warnings?.[0]?.substring(0, 500) || "";
    const contraindications = result.contraindications?.[0]?.substring(0, 500) || "";
    return `[OpenFDA] ${drugName}: ${warnings ? "Warnings: " + warnings : ""} ${contraindications ? "Contraindications: " + contraindications : ""}`.trim();
  } catch {
    return "";
  }
}

async function checkDrugInteractions(drugs: string[]): Promise<string> {
  if (drugs.length < 2) return "No interaction check needed for single drug.";
  
  const rxcuis: string[] = [];
  for (const drug of drugs.slice(0, 5)) {
    try {
      const resp = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drug)}&search=1`);
      const data = await resp.json();
      const rxcui = data?.idGroup?.rxnormId?.[0];
      if (rxcui) rxcuis.push(rxcui);
    } catch { /* skip */ }
  }

  if (rxcuis.length < 2) return "Could not resolve drug identifiers for interaction check.";

  try {
    const resp = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuis.join("+")}`);
    const data = await resp.json();
    const interactions = data?.fullInteractionTypeGroup?.[0]?.fullInteractionType || [];
    if (interactions.length === 0) return "No known interactions found between the specified drugs.";

    return interactions.map((i: any) => {
      const pair = i.interactionPair?.[0];
      const desc = pair?.description || "Unknown interaction";
      const severity = pair?.severity || "N/A";
      return `⚠️ ${desc} (Severity: ${severity})`;
    }).join("\n");
  } catch {
    return "Drug interaction check service unavailable.";
  }
}

const SYSTEM_PROMPT = `You are DATAELIXAIR Clinical RAG Agent — an AI-powered clinical decision support system for healthcare professionals.

CRITICAL RULES:
1. You are a CLINICAL DECISION SUPPORT tool, NOT a replacement for clinical judgment
2. Always cite PubMed sources with PMID numbers
3. Present risk assessments with confidence levels
4. Flag drug interactions with severity (🟢 safe, 🟡 caution, 🔴 danger)
5. Generate SOAP notes when patient data is provided
6. Include ICD-11 codes where applicable
7. Recommend evidence-based guidelines (NICE, AHA, ESC, ADA)
8. Always add disclaimer: "Clinical decision support only. Verify with clinical judgment."

OUTPUT FORMAT (JSON):
{
  "summary": "Brief clinical summary",
  "soap_notes": {
    "subjective": "Patient-reported symptoms and history",
    "objective": "Clinical findings, lab values, vitals",
    "assessment": "Clinical assessment with risk stratification and ICD codes",
    "plan": "Treatment plan with evidence-based recommendations"
  },
  "risk_assessment": {
    "primary_risk": "Main risk identified",
    "risk_percentage": "Calculated risk % with methodology",
    "risk_factors": ["list of risk factors"],
    "protective_factors": ["list of protective factors"]
  },
  "drug_recommendations": [
    {
      "drug": "Drug name",
      "dosage": "Recommended dosage",
      "frequency": "Frequency",
      "rationale": "Why this drug",
      "evidence_level": "A/B/C",
      "interactions": "Known interactions"
    }
  ],
  "drug_interactions": [
    {
      "drugs": ["drug1", "drug2"],
      "severity": "safe|caution|warning|danger",
      "description": "Interaction details"
    }
  ],
  "citations": [
    {
      "pmid": "PMID number",
      "title": "Article title",
      "relevance": "How this supports the recommendation",
      "url": "PubMed URL"
    }
  ],
  "tests_recommended": ["List of recommended tests"],
  "follow_up": "Follow-up recommendations",
  "icd_codes": [{"code": "ICD-11 code", "description": "Description"}],
  "guidelines_referenced": ["NICE/AHA/ESC guidelines cited"],
  "disclaimer": "Clinical decision support only. Verify with clinical judgment."
}

When you receive PubMed evidence context, USE IT to support your clinical reasoning. Cite specific PMIDs.
When drug names are mentioned, assess interactions.
Always be evidence-based and cite sources.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { patientData, query, drugs = [] } = await req.json();

    if (!patientData && !query) {
      return new Response(JSON.stringify({ error: "Patient data or query is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build simple, targeted search queries from patient data
    const primaryTerms: string[] = [];
    if (patientData?.conditions && Array.isArray(patientData.conditions)) {
      primaryTerms.push(...patientData.conditions);
    }
    if (patientData?.symptoms && Array.isArray(patientData.symptoms)) {
      primaryTerms.push(...patientData.symptoms);
    }

    // Use conditions as primary query, clinical query as secondary
    const conditionQuery = primaryTerms.slice(0, 3).join(" AND ");
    const clinicalQuery = query || "";

    // Run two separate focused searches for better coverage
    const searches: Promise<any[]>[] = [];
    if (conditionQuery) {
      searches.push(searchPubMed(conditionQuery + " treatment", 4));
      searches.push(searchEuropePMC(conditionQuery, 3));
    }
    if (clinicalQuery && clinicalQuery !== conditionQuery) {
      searches.push(searchPubMed(clinicalQuery, 3));
    }

    const [drugInteractions, ...articleArrays] = await Promise.all([
      drugs.length >= 2 ? checkDrugInteractions(drugs) : Promise.resolve(""),
      ...searches,
    ]);

    // Fetch OpenFDA warnings, DailyMed info, and ICD-11 codes in parallel
    const [fdaResults, dailyMedResults, icdResults] = await Promise.all([
      Promise.all(drugs.slice(0, 3).map(d => searchOpenFDA(d))),
      Promise.all(drugs.slice(0, 3).map(d => searchDailyMed(d))),
      Promise.all(primaryTerms.slice(0, 3).map(t => searchICD11(t))),
    ]);
    const fdaContext = fdaResults.filter(Boolean).join("\n");
    const dailyMedContext = dailyMedResults.filter(Boolean).join("\n");
    const icdContext = icdResults.flat().join("\n");

    // Flatten and deduplicate by PMID
    const seen = new Set<string>();
    const allArticles = (articleArrays as any[][]).flat().filter(a => {
      if (!a?.pmid || seen.has(a.pmid)) return false;
      seen.add(a.pmid);
      return true;
    });

    // Build context for AI
    const evidenceContext = allArticles.map((a, i) =>
      `[${i + 1}] PMID:${a.pmid} (${a.year}) "${a.title}" - ${a.abstract}`
    ).join("\n\n");

    const userMessage = `PATIENT DATA:
${JSON.stringify(patientData || {}, null, 2)}

CLINICAL QUERY: ${query || "Provide comprehensive clinical assessment"}

PUBMED EVIDENCE (${allArticles.length} articles found):
${evidenceContext || "No PubMed articles found for this query."}

DRUG INTERACTION CHECK:
${drugInteractions || "No drugs specified for interaction check."}

OPENFDA DRUG WARNINGS:
${fdaContext || "No FDA data available."}

DAILYMED DRUG INFO:
${dailyMedContext || "No DailyMed data available."}

WHO ICD-11 CODES:
${icdContext || "No ICD-11 codes resolved."}

DRUGS TO ASSESS: ${drugs.join(", ") || "None specified"}

Please provide a comprehensive clinical assessment in the JSON format specified. Cite the PubMed evidence provided above using their PMID numbers.`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Try to parse as JSON, fallback to raw text
    let clinicalAssessment;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      clinicalAssessment = JSON.parse(jsonStr);
    } catch {
      clinicalAssessment = { summary: content, raw: true };
    }

    return new Response(JSON.stringify({
      assessment: clinicalAssessment,
      evidence: allArticles,
      drugInteractions: drugInteractions || null,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("clinical-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
