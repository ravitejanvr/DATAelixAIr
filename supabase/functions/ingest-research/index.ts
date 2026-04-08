import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** RSS feed sources - authoritative clinical research */
const RSS_FEEDS = [
  { name: "Nature Digital Medicine", url: "https://www.nature.com/npjdigitalmed.rss", category: "Digital Health & Interoperability" },
  { name: "The Lancet Digital Health", url: "https://www.thelancet.com/rssfeed/lancet_digital_health.xml", category: "Clinical AI & Decision Support" },
  { name: "JAMA Network Open", url: "https://jamanetwork.com/rss/site_3/67.xml", category: "Research & Evidence" },
  { name: "WHO News", url: "https://www.who.int/rss-feeds/news-english.xml", category: "Patient Safety & Governance" },
];

/** PubMed search queries */
const PUBMED_QUERIES = [
  { query: "clinical decision support AI", category: "Clinical AI & Decision Support" },
  { query: "patient safety artificial intelligence", category: "Patient Safety & Governance" },
  { query: "digital health interoperability FHIR", category: "Digital Health & Interoperability" },
];

/** Relevance keywords - articles must match at least one */
const RELEVANCE_KEYWORDS = [
  "clinical", "diagnosis", "patient", "healthcare", "medical", "physician",
  "treatment", "safety", "decision support", "AI", "machine learning",
  "digital health", "EHR", "FHIR", "workflow", "interoperability",
  "drug", "prescription", "mortality", "morbidity", "guideline",
];

function isRelevant(title: string, summary: string): boolean {
  const text = `${title} ${summary}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some(k => text.includes(k));
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80) + "-" + Date.now().toString(36);
}

/** Simple XML text extraction */
function extractTag(xml: string, tag: string): string {
  const openCdata = `<${tag}><![CDATA[`;
  const closeCdata = `]]></${tag}>`;
  let idx = xml.indexOf(openCdata);
  if (idx !== -1) {
    const start = idx + openCdata.length;
    const end = xml.indexOf(closeCdata, start);
    return end > start ? xml.substring(start, end).trim() : "";
  }
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  idx = xml.indexOf(open);
  if (idx === -1) return "";
  const start = idx + open.length;
  const end = xml.indexOf(close, start);
  return end > start ? xml.substring(start, end).replace(/<[^>]*>/g, "").trim() : "";
}

interface FeedItem {
  title: string;
  url: string;
  summary: string;
  source: string;
  category: string;
  published_at: string | null;
}

async function fetchRSSFeed(feedUrl: string, source: string, category: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "DATAelixAIr-Research-Bot/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: FeedItem[] = [];
    // Split by <item> or <entry> tags
    const parts = xml.split(/<item[>\s]/).slice(1);
    const entryParts = parts.length > 0 ? parts : xml.split(/<entry[>\s]/).slice(1);

    for (const part of entryParts.slice(0, 5)) {
      const title = extractTag(part, "title");
      let url = extractTag(part, "link");
      // Handle Atom-style <link href="..."/>
      if (!url) {
        const linkMatch = part.match(/<link[^>]*href="([^"]+)"/);
        if (linkMatch) url = linkMatch[1];
      }
      const summary = extractTag(part, "description") || extractTag(part, "summary") || "";
      const pubDate = extractTag(part, "pubDate") || extractTag(part, "published") || extractTag(part, "dc:date") || "";

      if (title && url && isRelevant(title, summary)) {
        items.push({
          title: title.substring(0, 500),
          url,
          summary: summary.substring(0, 1000),
          source,
          category,
          published_at: pubDate ? new Date(pubDate).toISOString() : null,
        });
      }
    }
    return items;
  } catch (e) {
    console.warn(`[ingest-research] RSS fetch failed for ${source}:`, e);
    return [];
  }
}

async function fetchPubMed(query: string, category: string): Promise<FeedItem[]> {
  try {
    const dateFilter = new Date();
    dateFilter.setDate(dateFilter.getDate() - 14);
    const minDate = dateFilter.toISOString().split("T")[0].replace(/-/g, "/");

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=3&sort=date&retmode=json&mindate=${minDate}&datetype=pdat`;
    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });
    const searchData = await searchRes.json();
    const ids: string[] = searchData?.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const fetchRes = await fetch(fetchUrl, { signal: AbortSignal.timeout(10000) });
    const fetchData = await fetchRes.json();

    const items: FeedItem[] = [];
    for (const id of ids) {
      const item = fetchData?.result?.[id];
      if (!item || !item.title) continue;
      const title = item.title;
      const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
      const journal = item.fulljournalname || item.source || "PubMed";
      const pubDate = item.pubdate || "";

      if (isRelevant(title, "")) {
        items.push({
          title: title.substring(0, 500),
          url,
          summary: `Published in ${journal}. ${(item.authors || []).slice(0, 3).map((a: any) => a.name).join(", ")}`,
          source: `PubMed — ${journal}`,
          category,
          published_at: pubDate ? new Date(pubDate.split(" ")[0] + " 1, " + (pubDate.split(" ")[1] || new Date().getFullYear())).toISOString() : null,
        });
      }
    }
    return items;
  } catch (e) {
    console.warn(`[ingest-research] PubMed fetch failed for "${query}":`, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const allItems: FeedItem[] = [];

    // Fetch all RSS feeds in parallel
    const rssResults = await Promise.allSettled(
      RSS_FEEDS.map(f => fetchRSSFeed(f.url, f.name, f.category))
    );
    for (const r of rssResults) {
      if (r.status === "fulfilled") allItems.push(...r.value);
    }

    // Fetch PubMed queries in parallel
    const pubmedResults = await Promise.allSettled(
      PUBMED_QUERIES.map(q => fetchPubMed(q.query, q.category))
    );
    for (const r of pubmedResults) {
      if (r.status === "fulfilled") allItems.push(...r.value);
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const item of allItems) {
      // Validate URL
      try { new URL(item.url); } catch { skipped++; continue; }

      const slug = generateSlug(item.title);

      const { error } = await supabase.from("insights_articles").upsert(
        {
          title: item.title,
          source: item.source,
          url: item.url,
          summary: item.summary,
          category: item.category,
          published_at: item.published_at,
          slug,
          is_active: true,
        },
        { onConflict: "url", ignoreDuplicates: true }
      );

      if (error) {
        // Likely duplicate slug — try with different slug
        if (error.code === "23505" && error.message?.includes("slug")) {
          const { error: retryError } = await supabase.from("insights_articles").upsert(
            {
              title: item.title,
              source: item.source,
              url: item.url,
              summary: item.summary,
              category: item.category,
              published_at: item.published_at,
              slug: slug + "-" + Math.random().toString(36).slice(2, 6),
              is_active: true,
            },
            { onConflict: "url", ignoreDuplicates: true }
          );
          if (retryError) { errors++; } else { inserted++; }
        } else {
          skipped++; // duplicate URL = expected
        }
      } else {
        inserted++;
      }
    }

    console.log(`[ingest-research] Done: ${inserted} inserted, ${skipped} skipped, ${errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      fetched: allItems.length,
      inserted,
      skipped,
      errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ingest-research] Fatal error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
