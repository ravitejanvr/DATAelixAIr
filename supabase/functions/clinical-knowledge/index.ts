import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EUROPE_PMC_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const OPENFDA_BASE = "https://api.fda.gov/drug";
const DAILYMED_BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const MAX_CITATIONS = 6;

// ═══════════════════════════════════════════════════════════
// AGENT 1: Evidence Retrieval Agent
// Retrieves raw evidence from PubMed, Europe PMC, OpenFDA, DailyMed
// ═══════════════════════════════════════════════════════════

interface RawCitation {
  source: string;
  pmid?: string;
  doi?: string;
  title?: string;
  year?: string;
  url?: string;
  abstract?: string;
  journal?: string;
  authors?: string[];
}

interface DrugSafetyRaw {
  drug: string;
  black_box_warning: string | null;
  fda_warnings: string[];
  dailymed_warnings: string[];
}

async function retrievePubMed(query: string, maxResults = 3): Promise<RawCitation[]> {
  try {
    const searchRes = await fetch(
      `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&sort=relevance`
    );
    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    const fetchRes = await fetch(
      `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`
    );
    const xml = await fetchRes.text();
    const citations: RawCitation[] = [];
    const blocks = xml.split("<PubmedArticle>").slice(1);

    for (const block of blocks.slice(0, maxResults)) {
      const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
      const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const year = block.match(/<Year>(\d{4})<\/Year>/)?.[1] || "";
      const doi = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1] || "";
      const journal = block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] || "";
      const abstractText = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
        ?.map(t => t.replace(/<[^>]+>/g, "").trim()).join(" ") || "";
      const authorMatches = block.match(/<LastName>([\s\S]*?)<\/LastName>/g) || [];
      const authors = authorMatches.slice(0, 3).map(a => a.replace(/<[^>]+>/g, ""));

      citations.push({
        source: "PubMed", pmid, doi, title: title.substring(0, 250), year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract: abstractText.substring(0, 500), journal, authors,
      });
    }
    return citations;
  } catch (e) {
    console.error("PubMed retrieval failed:", e);
    return [];
  }
}

async function retrieveEuropePMC(query: string, maxResults = 3): Promise<RawCitation[]> {
  try {
    const res = await fetch(
      `${EUROPE_PMC_BASE}/search?query=${encodeURIComponent(query)}&resultType=core&pageSize=${maxResults}&format=json`
    );
    const data = await res.json();
    return (data?.resultList?.result || []).slice(0, maxResults).map((r: any) => ({
      source: "Europe PMC",
      pmid: r.pmid || "",
      doi: r.doi || "",
      title: (r.title || "").substring(0, 250),
      year: r.pubYear || "",
      url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : `https://europepmc.org/article/${r.source}/${r.id}`,
      abstract: (r.abstractText || "").substring(0, 500),
      journal: r.journalTitle || "",
      authors: (r.authorString || "").split(", ").slice(0, 3),
    }));
  } catch { return []; }
}

async function retrieveOpenFDA(drugName: string): Promise<DrugSafetyRaw> {
  const empty: DrugSafetyRaw = { drug: drugName, black_box_warning: null, fda_warnings: [], dailymed_warnings: [] };
  try {
    const res = await fetch(`${OPENFDA_BASE}/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`);
    if (!res.ok) return empty;
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return empty;
    const blackBox = result.boxed_warning?.[0]?.substring(0, 300) || null;
    const warnings: string[] = [];
    if (result.warnings?.[0]) warnings.push(result.warnings[0].substring(0, 200));
    if (result.contraindications?.[0]) warnings.push(result.contraindications[0].substring(0, 200));
    return { drug: drugName, black_box_warning: blackBox, fda_warnings: warnings, dailymed_warnings: [] };
  } catch { return empty; }
}

async function retrieveDailyMed(drugName: string): Promise<string[]> {
  try {
    const searchRes = await fetch(`${DAILYMED_BASE}/spls.json?drug_name=${encodeURIComponent(drugName)}&pagesize=1`);
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const setId = searchData?.data?.[0]?.setid;
    if (!setId) return [];
    const labelRes = await fetch(`${DAILYMED_BASE}/spls/${setId}.json`);
    if (!labelRes.ok) return [];
    const labelData = await labelRes.json();
    const warnings: string[] = [];
    for (const section of (labelData?.data?.sections || [])) {
      const name = (section.name || "").toLowerCase();
      if (name.includes("warning") || name.includes("precaution") || name.includes("contraindication")) {
        const text = (section.text || "").replace(/<[^>]+>/g, "").trim();
        if (text.length > 10) warnings.push(text.substring(0, 250));
      }
      if (warnings.length >= 3) break;
    }
    return warnings;
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════
// AGENT 2: Evidence Filtering Agent
// Scores, deduplicates, and filters citations for quality
// ═══════════════════════════════════════════════════════════

interface ScoredCitation extends RawCitation {
  confidence: "high" | "moderate" | "low";
  relevance_score: number;
  query_context: string;
}

function scoreCitation(c: RawCitation, queryTerms: string[]): ScoredCitation {
  const year = parseInt(c.year || "0");
  const currentYear = new Date().getFullYear();
  const hasPmid = !!c.pmid;
  const hasDoi = !!c.doi;
  const hasTitle = !!c.title && c.title.length > 10;
  const hasAbstract = !!c.abstract && c.abstract.length > 50;

  // Confidence from source quality
  let confidence: "high" | "moderate" | "low" = "low";
  if (hasPmid && hasDoi && hasTitle && year >= currentYear - 5) confidence = "high";
  else if ((hasPmid || hasDoi) && hasTitle && year >= currentYear - 10) confidence = "moderate";

  // Relevance: how many query terms appear in title + abstract
  const text = ((c.title || "") + " " + (c.abstract || "")).toLowerCase();
  let matchCount = 0;
  for (const term of queryTerms) {
    if (text.includes(term.toLowerCase())) matchCount++;
  }
  const relevance_score = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;

  // Boost for recent + abstract-rich
  const recencyBonus = year >= currentYear - 3 ? 0.2 : year >= currentYear - 7 ? 0.1 : 0;
  const abstractBonus = hasAbstract ? 0.1 : 0;

  return {
    ...c,
    confidence,
    relevance_score: Math.min(1, relevance_score + recencyBonus + abstractBonus),
    query_context: queryTerms.join(", "),
  };
}

function filterAndRankCitations(citations: RawCitation[], queryTerms: string[], maxCount: number): ScoredCitation[] {
  // Score all
  const scored = citations.map(c => scoreCitation(c, queryTerms));

  // Deduplicate by PMID or DOI or title
  const seen = new Set<string>();
  const unique: ScoredCitation[] = [];
  for (const c of scored) {
    const key = c.pmid || c.doi || (c.title || "").toLowerCase().slice(0, 60);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    unique.push(c);
  }

  // Filter out very low relevance unless nothing else available
  const relevant = unique.filter(c => c.relevance_score > 0.1 || c.confidence !== "low");
  const pool = relevant.length > 0 ? relevant : unique;

  // Sort by confidence tier, then relevance
  const tierOrder = { high: 0, moderate: 1, low: 2 };
  pool.sort((a, b) => {
    const tierDiff = tierOrder[a.confidence] - tierOrder[b.confidence];
    if (tierDiff !== 0) return tierDiff;
    return b.relevance_score - a.relevance_score;
  });

  return pool.slice(0, maxCount);
}

// ═══════════════════════════════════════════════════════════
// AGENT 3: Clinical Context Agent
// Maps filtered evidence to patient context, generates
// evidence-backed clinical suggestions via AI
// ═══════════════════════════════════════════════════════════

interface PatientContext {
  chief_complaint: string;
  duration?: string;
  age?: number;
  gender?: string;
  allergies?: string;
  medications?: string;
  conditions?: string;
  vitals?: string;
  transcript_excerpt?: string;
}

interface EvidenceBackedSuggestion {
  prescriptions: Array<{
    drug_name: string;
    dose: string;
    frequency: string;
    duration: string;
    rationale: string;
    allergy_conflict: boolean;
    evidence_refs: string[];  // PMID or citation index
    evidence_confidence: "high" | "moderate" | "low";
  }>;
  lab_tests: Array<{
    test_name: string;
    rationale: string;
    priority: "routine" | "urgent";
    evidence_refs: string[];
    evidence_confidence: "high" | "moderate" | "low";
  }>;
  documentation_shortcuts: Array<{
    text: string;
    category: "subjective" | "objective" | "plan" | "advice";
  }>;
  guidelines: Array<{
    guideline: string;
    source: string;
    summary_points: string[];
  }>;
}

async function mapEvidenceToContext(
  patientCtx: PatientContext,
  filteredCitations: ScoredCitation[],
  drugSafety: DrugSafetyRaw[]
): Promise<{ suggestions: EvidenceBackedSuggestion; model: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  // Build evidence context for the AI
  const citationContext = filteredCitations.map((c, i) =>
    `[${i + 1}] "${c.title}" (${c.source}, ${c.year || "n.d."}, confidence: ${c.confidence}, PMID: ${c.pmid || "N/A"})`
  ).join("\n");

  const safetyContext = drugSafety
    .filter(d => d.black_box_warning || d.fda_warnings.length > 0 || d.dailymed_warnings.length > 0)
    .map(d => `Drug: ${d.drug} | Black box: ${d.black_box_warning || "none"} | Warnings: ${d.fda_warnings.join("; ") || "none"}`)
    .join("\n");

  const systemPrompt = `You are a clinical knowledge mapping agent for an Indian private clinic decision-support system.

Given patient context and retrieved biomedical evidence, generate evidence-backed clinical suggestions.

CRITICAL RULES:
- Every prescription suggestion MUST reference at least one citation by index [n]
- Every lab test suggestion SHOULD reference evidence when available
- If evidence supports a medication, include the citation index in evidence_refs
- Allergy conflicts must be flagged (allergy_conflict: true)
- Respect drug safety warnings from OpenFDA/DailyMed
- Use Indian-market generic drug names and standard doses
- Max 4 prescriptions, 4 lab tests, 4 documentation shortcuts, 3 guidelines
- evidence_confidence should reflect the quality of supporting citations
- Documentation shortcuts should be natural clinical English
- Guidelines should reference well-known bodies: WHO, NICE, AHA, ICMR, API, RSSDI

Return ONLY valid JSON matching this structure:
{
  "prescriptions": [{ "drug_name": "", "dose": "", "frequency": "", "duration": "", "rationale": "", "allergy_conflict": false, "evidence_refs": ["[1]"], "evidence_confidence": "high|moderate|low" }],
  "lab_tests": [{ "test_name": "", "rationale": "", "priority": "routine|urgent", "evidence_refs": ["[1]"], "evidence_confidence": "high|moderate|low" }],
  "documentation_shortcuts": [{ "text": "", "category": "subjective|objective|plan|advice" }],
  "guidelines": [{ "guideline": "", "source": "", "summary_points": [""] }]
}`;

  const userPrompt = `PATIENT CONTEXT:
- Chief complaint: ${patientCtx.chief_complaint}
- Duration: ${patientCtx.duration || "not specified"}
- Age: ${patientCtx.age || "unknown"}, Gender: ${patientCtx.gender || "unknown"}
- Known allergies: ${patientCtx.allergies || "none reported"}
- Current medications: ${patientCtx.medications || "none"}
- Chronic conditions: ${patientCtx.conditions || "none"}
- Vitals: ${patientCtx.vitals || "not recorded"}
${patientCtx.transcript_excerpt ? `- Transcript excerpt: ${patientCtx.transcript_excerpt}` : ""}

RETRIEVED EVIDENCE (${filteredCitations.length} citations):
${citationContext || "No citations retrieved."}

DRUG SAFETY ALERTS:
${safetyContext || "No safety alerts."}

Generate evidence-backed clinical suggestions.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");
    throw new Error(`AI gateway returned ${response.status}`);
  }

  const aiData = await response.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  let suggestions: EvidenceBackedSuggestion;
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    suggestions = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
  } catch {
    suggestions = { prescriptions: [], lab_tests: [], documentation_shortcuts: [], guidelines: [] };
  }

  return { suggestions, model: "gemini-3-flash-preview" };
}

// ═══════════════════════════════════════════════════════════
// ORCHESTRATOR: Clinical Knowledge Layer
// ═══════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      chief_complaint, duration, symptoms, age, gender,
      allergies, medications, conditions, vitals, transcript_excerpt,
    } = body;

    if (!chief_complaint) {
      return new Response(JSON.stringify({ error: "chief_complaint is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queryTerms = [
      chief_complaint,
      ...(symptoms ? symptoms.split(",").map((s: string) => s.trim()) : []),
    ].filter(Boolean);

    const diagnosisQuery = `${chief_complaint} ${duration || ""} treatment management`.trim();
    const medicationList = medications ? medications.split(",").map((s: string) => s.trim()).filter(Boolean) : [];

    // ── AGENT 1: Evidence Retrieval (parallel) ──
    const [pubmedCitations, epmcCitations, ...drugSafetyResults] = await Promise.all([
      retrievePubMed(diagnosisQuery, 4),
      retrieveEuropePMC(diagnosisQuery, 4),
      ...medicationList.slice(0, 3).map(async (drug: string) => {
        const [fda, dailymed] = await Promise.all([
          retrieveOpenFDA(drug),
          retrieveDailyMed(drug),
        ]);
        return { ...fda, dailymed_warnings: dailymed } as DrugSafetyRaw;
      }),
    ]);

    const allRawCitations = [...pubmedCitations, ...epmcCitations];
    const sourcesQueried = new Set<string>(["PubMed", "Europe PMC"]);
    if (medicationList.length > 0) {
      sourcesQueried.add("OpenFDA");
      sourcesQueried.add("DailyMed");
    }

    // ── AGENT 2: Evidence Filtering ──
    const filteredCitations = filterAndRankCitations(allRawCitations, queryTerms, MAX_CITATIONS);

    // Compute retrieval confidence
    const hasHighConf = filteredCitations.some(c => c.confidence === "high");
    const hasCitations = filteredCitations.length > 0;
    const retrieval_confidence: "high" | "moderate" | "low" =
      hasHighConf && filteredCitations.length >= 3 ? "high" :
        hasCitations ? "moderate" : "low";

    // ── AGENT 3: Clinical Context Mapping ──
    const { suggestions, model } = await mapEvidenceToContext(
      { chief_complaint, duration, age, gender, allergies, medications, conditions, vitals, transcript_excerpt },
      filteredCitations,
      drugSafetyResults as DrugSafetyRaw[],
    );

    const duration_ms = Date.now() - startTime;

    return new Response(JSON.stringify({
      suggestions,
      citations: filteredCitations.map(c => ({
        source: c.source,
        pmid: c.pmid,
        doi: c.doi,
        title: c.title,
        year: c.year,
        url: c.url,
        confidence: c.confidence,
        relevance_score: c.relevance_score,
      })),
      drug_safety: drugSafetyResults,
      retrieval_confidence,
      sources_queried: Array.from(sourcesQueried),
      total_citations: filteredCitations.length,
      model,
      duration_ms,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : "Unknown error";
    if (errMsg === "RATE_LIMIT") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (errMsg === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("clinical-knowledge error:", e);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
