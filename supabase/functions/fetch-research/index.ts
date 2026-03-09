import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResearchPaper {
  title: string;
  authors: string[];
  journal: string;
  year: number;
  abstract: string;
  url: string;
  source: string;
}

async function fetchPubMed(query: string, maxResults = 5): Promise<ResearchPaper[]> {
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&sort=date&retmode=json`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const ids: string[] = searchData?.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
  const fetchRes = await fetch(fetchUrl);
  const fetchData = await fetchRes.json();

  const papers: ResearchPaper[] = [];
  for (const id of ids) {
    const item = fetchData?.result?.[id];
    if (!item) continue;
    papers.push({
      title: item.title || "",
      authors: (item.authors || []).map((a: any) => a.name),
      journal: item.fulljournalname || item.source || "",
      year: parseInt(item.pubdate?.split(" ")[0]) || new Date().getFullYear(),
      abstract: "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: "PubMed",
    });
  }
  return papers;
}

async function fetchEuropePMC(query: string, maxResults = 5): Promise<ResearchPaper[]> {
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=${maxResults}&sort=DATE_CREATED desc`;
  const res = await fetch(url);
  const data = await res.json();
  const results = data?.resultList?.result || [];

  return results.map((r: any) => ({
    title: r.title || "",
    authors: r.authorString ? r.authorString.split(", ") : [],
    journal: r.journalTitle || "",
    year: parseInt(r.pubYear) || new Date().getFullYear(),
    abstract: r.abstractText || "",
    url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
    source: "Europe PMC",
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query = "clinical AI healthcare", max_results = 5 } = await req.json();

    const [pubmed, europepmc] = await Promise.all([
      fetchPubMed(query, max_results),
      fetchEuropePMC(query, max_results),
    ]);

    const papers = [...pubmed, ...europepmc]
      .sort((a, b) => b.year - a.year)
      .slice(0, max_results * 2);

    return new Response(JSON.stringify({ success: true, papers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-research error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
