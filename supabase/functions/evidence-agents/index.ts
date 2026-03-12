import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EUROPE_PMC_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const OPENFDA_BASE = "https://api.fda.gov/drug";
const DAILYMED_BASE = "https://dailymed.nlm.nih.gov/dailymed/services/v2";
const MAX_TOTAL_CITATIONS = 6;

interface Citation {
  source: string;
  pmid?: string;
  doi?: string;
  title?: string;
  year?: string;
  url?: string;
  confidence?: "high" | "moderate" | "low";
}

interface MedicationEvidence {
  drug: string;
  summary: string;
  ai_generated: boolean;
  citations: Citation[];
}

interface GuidelineRef {
  guideline: string;
  source: string;
  summary_points: string[];
}

interface DrugSafetyNote {
  drug: string;
  black_box_warning: string | null;
  high_risk_flags: string[];
  dailymed_warnings: string[];
  citations: Citation[];
}

// --- Citation confidence scoring ---
function scoreCitation(citation: Citation): "high" | "moderate" | "low" {
  const year = parseInt(citation.year || "0");
  const currentYear = new Date().getFullYear();
  const hasPmid = !!citation.pmid;
  const hasDoi = !!citation.doi;
  const hasTitle = !!citation.title && citation.title.length > 10;

  if (hasPmid && hasDoi && hasTitle && year >= currentYear - 5) return "high";
  if ((hasPmid || hasDoi) && hasTitle && year >= currentYear - 10) return "moderate";
  return "low";
}

// --- PubMed search (2 results per drug) ---
async function searchPubMedForDrug(drugName: string, diagnosis: string): Promise<{ citations: Citation[] }> {
  const query = `${drugName} ${diagnosis} treatment`;
  try {
    const searchRes = await fetch(`${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=2&retmode=json&sort=relevance`);
    const searchData = await searchRes.json();
    const ids = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return { citations: [] };

    const fetchRes = await fetch(`${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`);
    const xml = await fetchRes.text();
    const citations: Citation[] = [];
    const blocks = xml.split("<PubmedArticle>").slice(1);

    for (const block of blocks.slice(0, 2)) {
      const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
      const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const year = block.match(/<Year>(\d{4})<\/Year>/)?.[1] || "";
      const doi = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1] || "";
      const c: Citation = {
        source: "PubMed", pmid, doi, title: title.substring(0, 200), year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
      c.confidence = scoreCitation(c);
      citations.push(c);
    }
    return { citations };
  } catch (e) {
    console.error(`PubMed search failed for ${drugName}:`, e);
    return { citations: [] };
  }
}

// --- Europe PMC search ---
async function searchEuropePMCForDrug(drugName: string, diagnosis: string): Promise<Citation[]> {
  try {
    const query = `${drugName} ${diagnosis}`;
    const res = await fetch(`${EUROPE_PMC_BASE}/search?query=${encodeURIComponent(query)}&resultType=lite&pageSize=2&format=json`);
    const data = await res.json();
    const results = data?.resultList?.result || [];
    return results.slice(0, 2).map((r: any) => {
      const c: Citation = {
        source: "Europe PMC", pmid: r.pmid || "", doi: r.doi || "",
        title: (r.title || "").substring(0, 200), year: r.pubYear || "",
        url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : `https://europepmc.org/article/${r.source}/${r.id}`,
      };
      c.confidence = scoreCitation(c);
      return c;
    });
  } catch { return []; }
}

// --- OpenFDA black box warnings ---
async function getOpenFDAWarnings(drugName: string): Promise<{ blackBox: string | null; warnings: string[] }> {
  try {
    const res = await fetch(`${OPENFDA_BASE}/label.json?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`);
    if (!res.ok) return { blackBox: null, warnings: [] };
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return { blackBox: null, warnings: [] };

    const blackBox = result.boxed_warning?.[0]?.substring(0, 300) || null;
    const warnings: string[] = [];
    if (result.warnings?.[0]) warnings.push(result.warnings[0].substring(0, 200));
    if (result.contraindications?.[0]) warnings.push(result.contraindications[0].substring(0, 200));
    return { blackBox, warnings };
  } catch { return { blackBox: null, warnings: [] }; }
}

// --- DailyMed drug label warnings ---
async function getDailyMedWarnings(drugName: string): Promise<string[]> {
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
    // Extract key sections
    const sections = labelData?.data?.sections || [];
    for (const section of sections) {
      const name = (section.name || "").toLowerCase();
      if (name.includes("warning") || name.includes("precaution") || name.includes("contraindication")) {
        const text = (section.text || "").replace(/<[^>]+>/g, "").trim();
        if (text.length > 10) {
          warnings.push(text.substring(0, 250));
        }
      }
      if (warnings.length >= 3) break;
    }
    return warnings;
  } catch (e) {
    console.error(`DailyMed lookup failed for ${drugName}:`, e);
    return [];
  }
}

// --- AI evidence summarization ---
async function summarizeEvidence(drug: string, diagnosis: string, citations: Citation[]): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || citations.length === 0) {
    return citations.length > 0
      ? `${citations.length} publication(s) found for ${drug} in the context of ${diagnosis}.`
      : "No high-quality evidence retrieved from indexed sources.";
  }

  try {
    const citationContext = citations.map(c =>
      `- "${c.title}" (${c.source}, ${c.year || "n.d."})`
    ).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.1,
        max_tokens: 150,
        messages: [
          {
            role: "system",
            content: `You are a medical evidence summarizer. Given publication titles for a drug-diagnosis pair, write a 1-2 sentence clinical summary of the available evidence.
Rules:
- Be factual and concise
- Never recommend or advise — only summarize what the evidence shows
- Never fabricate findings — only describe what the citations suggest
- If evidence is limited, say so explicitly
- Include the evidence strength qualifier (e.g., "limited evidence suggests", "multiple studies indicate")`
          },
          {
            role: "user",
            content: `Drug: ${drug}\nDiagnosis: ${diagnosis}\nCitations:\n${citationContext}`
          }
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 402) {
        return `${citations.length} publication(s) found for ${drug} in the context of ${diagnosis}.`;
      }
      throw new Error(`AI gateway error: ${res.status}`);
    }

    const data = await res.json();
    const summary = data.choices?.[0]?.message?.content?.trim();
    return summary || `${citations.length} publication(s) found for ${drug} in the context of ${diagnosis}.`;
  } catch (e) {
    console.error("Evidence summarization failed:", e);
    return `${citations.length} publication(s) found for ${drug} in the context of ${diagnosis}.`;
  }
}

// --- Guideline matching via AI ---
async function matchGuidelines(diagnosis: string, medications: string[]): Promise<GuidelineRef[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return [];

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a clinical guideline reference assistant. Given a diagnosis, return relevant guideline references.
Rules:
- Only reference well-known guidelines: WHO, NICE, AHA, ESC, ICMR, API (Association of Physicians of India), RSSDI
- Max 3 guidelines
- Max 3 bullet points per guideline
- Never interpret or recommend — only cite what the guideline states
- Never say "You should prescribe..." — only "According to guideline X..."
- If no relevant guideline found, return empty array
Return ONLY valid JSON array: [{"guideline":"name","source":"WHO/NICE/etc","summary_points":["point1","point2"]}]`
          },
          {
            role: "user",
            content: `Diagnosis: ${diagnosis}\nMedications: ${medications.join(", ")}`
          }
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429 || res.status === 402) return [];
      return [];
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch { return []; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { medications, diagnosis, query, patient_age, allergies, related_features } = await req.json();

    const safeMedications = Array.isArray(medications)
      ? medications.filter((m): m is string => typeof m === "string" && m.trim().length > 0)
      : [];

    // Backward-compatible fallback: some callers send { query, max_results } without medications
    const diagnosisText = diagnosis || query || "unspecified condition";
    let totalCitations = 0;
    const sourcesQueried = new Set<string>();

    // 1. Medication Evidence Agent — parallel PubMed + Europe PMC per drug
    const medication_evidence: MedicationEvidence[] = [];
    for (const drug of safeMedications.slice(0, 5)) {
      if (totalCitations >= MAX_TOTAL_CITATIONS) break;
      const remaining = MAX_TOTAL_CITATIONS - totalCitations;
      const maxPerDrug = Math.min(2, remaining);

      const [pubmedResult, epmcCitations] = await Promise.all([
        searchPubMedForDrug(drug, diagnosisText),
        searchEuropePMCForDrug(drug, diagnosisText),
      ]);

      sourcesQueried.add("PubMed");
      sourcesQueried.add("Europe PMC");

      // Deduplicate and limit
      const allCitations = [...pubmedResult.citations, ...epmcCitations];
      const seen = new Set<string>();
      const uniqueCitations: Citation[] = [];
      for (const c of allCitations) {
        const key = c.pmid || c.doi || c.title || "";
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        uniqueCitations.push(c);
        if (uniqueCitations.length >= maxPerDrug) break;
      }

      totalCitations += uniqueCitations.length;

      // AI-generated summary
      const summary = await summarizeEvidence(drug, diagnosisText, uniqueCitations);

      medication_evidence.push({
        drug,
        summary,
        ai_generated: uniqueCitations.length > 0,
        citations: uniqueCitations,
      });
    }

    // 2. Guideline Agent
    const guidelines = await matchGuidelines(diagnosisText, safeMedications);

    // 3. Drug Safety Agent — parallel OpenFDA + DailyMed per drug
    const drug_safety: DrugSafetyNote[] = [];
    for (const drug of safeMedications.slice(0, 5)) {
      const [{ blackBox, warnings: fdaWarnings }, dailymedWarnings] = await Promise.all([
        getOpenFDAWarnings(drug),
        getDailyMedWarnings(drug),
      ]);

      sourcesQueried.add("OpenFDA");
      if (dailymedWarnings.length > 0) sourcesQueried.add("DailyMed");

      const highRiskFlags: string[] = [];
      if (patient_age && patient_age > 65) highRiskFlags.push("Geriatric patient — verify dosage adjustment");
      if (patient_age && patient_age < 12) highRiskFlags.push("Pediatric patient — verify weight-based dosing");
      if (allergies?.length > 0) highRiskFlags.push("Patient has documented allergies — cross-check required");

      drug_safety.push({
        drug,
        black_box_warning: blackBox,
        high_risk_flags: [...highRiskFlags, ...fdaWarnings.map(w => w.substring(0, 150))],
        dailymed_warnings: dailymedWarnings,
        citations: blackBox
          ? [{ source: "OpenFDA", url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drug)}"`, confidence: "high" as const }]
          : [],
      });
    }

    // 4. Compute overall retrieval confidence
    const hasHighConfCitations = medication_evidence.some(me =>
      me.citations.some(c => c.confidence === "high")
    );
    const hasCitations = totalCitations > 0;
    const hasGuidelines = guidelines.length > 0;

    let retrieval_confidence: "high" | "moderate" | "low" = "low";
    if (hasHighConfCitations && hasGuidelines) retrieval_confidence = "high";
    else if (hasCitations || hasGuidelines) retrieval_confidence = "moderate";

    // 5. Query evidence_sources table for curated platform evidence
    let platform_evidence: any[] = [];
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, supabaseKey);

      // Search by diagnosis keyword or related features
      const searchTerms = [diagnosisText, ...medications.slice(0, 3)];
      const { data: evidenceRows } = await sb
        .from("evidence_sources")
        .select("id, title, authors, journal, year, source_link, summary, related_feature, evidence_strength")
        .or(searchTerms.map(t => `summary.ilike.%${t}%`).join(","))
        .order("year", { ascending: false })
        .limit(4);
      platform_evidence = evidenceRows || [];
    } catch (e) {
      console.error("evidence_sources query failed:", e);
    }

    return new Response(JSON.stringify({
      medication_evidence,
      guidelines,
      drug_safety,
      platform_evidence,
      total_citations: totalCitations,
      retrieval_confidence,
      sources_queried: Array.from(sourcesQueried),
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evidence-agents error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
