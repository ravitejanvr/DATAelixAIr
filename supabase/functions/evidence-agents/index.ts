import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EUROPE_PMC_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const OPENFDA_BASE = "https://api.fda.gov/drug";
const MAX_TOTAL_CITATIONS = 6;

interface Citation {
  source: string;
  pmid?: string;
  doi?: string;
  title?: string;
  year?: string;
  url?: string;
}

interface MedicationEvidence {
  drug: string;
  summary: string;
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
  citations: Citation[];
}

// --- PubMed search (2 results per drug) ---
async function searchPubMedForDrug(drugName: string, diagnosis: string): Promise<{ articles: any[]; citations: Citation[] }> {
  const query = `${drugName} ${diagnosis} treatment`;
  try {
    const searchRes = await fetch(`${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=2&retmode=json&sort=relevance`);
    const searchData = await searchRes.json();
    const ids = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return { articles: [], citations: [] };

    const fetchRes = await fetch(`${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`);
    const xml = await fetchRes.text();
    const citations: Citation[] = [];
    const blocks = xml.split("<PubmedArticle>").slice(1);

    for (const block of blocks.slice(0, 2)) {
      const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
      const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
      const year = block.match(/<Year>(\d{4})<\/Year>/)?.[1] || "";
      const doi = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1] || "";
      citations.push({
        source: "PubMed",
        pmid,
        doi,
        title: title.substring(0, 200),
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    }
    return { articles: blocks, citations };
  } catch (e) {
    console.error(`PubMed search failed for ${drugName}:`, e);
    return { articles: [], citations: [] };
  }
}

// --- Europe PMC search ---
async function searchEuropePMCForDrug(drugName: string, diagnosis: string): Promise<Citation[]> {
  try {
    const query = `${drugName} ${diagnosis}`;
    const res = await fetch(`${EUROPE_PMC_BASE}/search?query=${encodeURIComponent(query)}&resultType=lite&pageSize=2&format=json`);
    const data = await res.json();
    const results = data?.resultList?.result || [];
    return results.slice(0, 2).map((r: any) => ({
      source: "Europe PMC",
      pmid: r.pmid || "",
      doi: r.doi || "",
      title: (r.title || "").substring(0, 200),
      year: r.pubYear || "",
      url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : `https://europepmc.org/article/${r.source}/${r.id}`,
    }));
  } catch {
    return [];
  }
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
  } catch {
    return { blackBox: null, warnings: [] };
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
        model: "google/gemini-2.5-flash",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are a clinical guideline reference assistant. Given a diagnosis, return relevant guideline references.
Rules:
- Only reference well-known guidelines: WHO, NICE, AHA, ESC, ICMR, API (Association of Physicians of India)
- Max 3 guidelines
- Max 3 bullet points per guideline
- Never interpret or recommend — only cite
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

    if (!res.ok) return [];
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { medications, diagnosis, patient_age, allergies } = await req.json();

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return new Response(JSON.stringify({ error: "medications array required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const diagnosisText = diagnosis || "unspecified condition";
    let totalCitations = 0;

    // 1. Medication Evidence Agent
    const medication_evidence: MedicationEvidence[] = [];
    for (const drug of medications.slice(0, 5)) {
      if (totalCitations >= MAX_TOTAL_CITATIONS) break;
      const remaining = MAX_TOTAL_CITATIONS - totalCitations;
      const maxPerDrug = Math.min(2, remaining);

      const [pubmedResult, epmcCitations] = await Promise.all([
        searchPubMedForDrug(drug, diagnosisText),
        searchEuropePMCForDrug(drug, diagnosisText),
      ]);

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
      medication_evidence.push({
        drug,
        summary: uniqueCitations.length > 0
          ? `Evidence found for ${drug} in the context of ${diagnosisText}.`
          : "No high-quality evidence retrieved.",
        citations: uniqueCitations,
      });
    }

    // 2. Guideline Agent
    const guidelines = await matchGuidelines(diagnosisText, medications);

    // 3. Drug Safety Agent
    const drug_safety: DrugSafetyNote[] = [];
    for (const drug of medications.slice(0, 5)) {
      const { blackBox, warnings } = await getOpenFDAWarnings(drug);
      const highRiskFlags: string[] = [];
      if (patient_age && patient_age > 65) highRiskFlags.push("Geriatric patient — verify dosage adjustment");
      if (patient_age && patient_age < 12) highRiskFlags.push("Pediatric patient — verify weight-based dosing");
      if (allergies?.length > 0) highRiskFlags.push("Patient has documented allergies — cross-check required");

      drug_safety.push({
        drug,
        black_box_warning: blackBox,
        high_risk_flags: [...highRiskFlags, ...warnings.map(w => w.substring(0, 150))],
        citations: blackBox ? [{ source: "OpenFDA", url: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(drug)}"` }] : [],
      });
    }

    return new Response(JSON.stringify({
      medication_evidence,
      guidelines,
      drug_safety,
      total_citations: totalCitations,
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
