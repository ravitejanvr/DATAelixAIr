import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const EUROPE_PMC_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";

interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  year: string;
  doi: string;
  url: string;
}

async function searchPubMed(query: string, maxResults = 10): Promise<string[]> {
  const url = `${PUBMED_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json&sort=relevance`;
  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok || text.trimStart().startsWith("<")) {
    console.warn("[PubMed] esearch returned non-JSON:", text.substring(0, 200));
    return [];
  }
  try {
    const data = JSON.parse(text);
    return data?.esearchresult?.idlist || [];
  } catch {
    console.warn("[PubMed] esearch JSON parse failed");
    return [];
  }
}

async function fetchPubMedDetails(ids: string[]): Promise<PubMedArticle[]> {
  if (ids.length === 0) return [];
  const url = `${PUBMED_BASE}/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const resp = await fetch(url);
  const xml = await resp.text();

  const articles: PubMedArticle[] = [];
  const articleBlocks = xml.split("<PubmedArticle>").slice(1);

  for (const block of articleBlocks) {
    const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || "";
    const title = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1]?.replace(/<[^>]+>/g, "") || "";
    const abstractText = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
      ?.map(t => t.replace(/<[^>]+>/g, "").trim())
      .join(" ") || "";
    const journal = block.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] || "";
    const year = block.match(/<Year>(\d{4})<\/Year>/)?.[1] || "";
    const doi = block.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/)?.[1] || "";

    const authorMatches = block.match(/<LastName>([\s\S]*?)<\/LastName>/g) || [];
    const authors = authorMatches.slice(0, 3).map(a => a.replace(/<[^>]+>/g, ""));

    articles.push({
      pmid,
      title,
      abstract: abstractText.substring(0, 1500),
      authors,
      journal,
      year,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }

  return articles;
}

async function searchEuropePMC(query: string, maxResults = 5): Promise<PubMedArticle[]> {
  const url = `${EUROPE_PMC_BASE}/search?query=${encodeURIComponent(query)}&resultType=core&pageSize=${maxResults}&format=json`;
  const resp = await fetch(url);
  const data = await resp.json();
  const results = data?.resultList?.result || [];

  return results.map((r: any) => ({
    pmid: r.pmid || r.id || "",
    title: r.title || "",
    abstract: (r.abstractText || "").substring(0, 1500),
    authors: (r.authorString || "").split(", ").slice(0, 3),
    journal: r.journalTitle || "",
    year: r.pubYear || "",
    doi: r.doi || "",
    url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : `https://europepmc.org/article/${r.source}/${r.id}`,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, sources = ["pubmed", "europepmc"], maxResults = 8 } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allArticles: PubMedArticle[] = [];

    const promises: Promise<void>[] = [];

    if (sources.includes("pubmed")) {
      promises.push(
        searchPubMed(query.trim(), Math.ceil(maxResults / 2)).then(ids =>
          fetchPubMedDetails(ids).then(articles => {
            allArticles.push(...articles);
          })
        )
      );
    }

    if (sources.includes("europepmc")) {
      promises.push(
        searchEuropePMC(query.trim(), Math.ceil(maxResults / 2)).then(articles => {
          allArticles.push(...articles);
        })
      );
    }

    await Promise.all(promises);

    // Deduplicate by PMID
    const seen = new Set<string>();
    const unique = allArticles.filter(a => {
      if (!a.pmid || seen.has(a.pmid)) return false;
      seen.add(a.pmid);
      return true;
    });

    return new Response(JSON.stringify({ articles: unique.slice(0, maxResults), query }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pubmed-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
