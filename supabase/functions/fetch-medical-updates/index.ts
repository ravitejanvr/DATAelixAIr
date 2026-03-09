import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const pipeline = body.pipeline || "all"; // "drug_alerts" | "guidelines" | "literature" | "all"
    const maxResults = body.max_results || 10;

    const results: Record<string, any> = {};
    const errors: string[] = [];

    // ─── Pipeline 1: Drug Safety Alerts (OpenFDA) ───────────────
    if (pipeline === "drug_alerts" || pipeline === "all") {
      try {
        const fdaRes = await fetch(
          `https://api.fda.gov/drug/event.json?search=receivedate:[${getDateDaysAgo(1)}+TO+${getToday()}]&limit=${Math.min(maxResults, 25)}`
        );
        if (fdaRes.ok) {
          const fdaData = await fdaRes.json();
          const alerts = (fdaData.results || []).map((r: any) => ({
            source: "openfda",
            drug_name: r.patient?.drug?.[0]?.medicinalproduct || "Unknown",
            generic_name: r.patient?.drug?.[0]?.openfda?.generic_name?.[0] || null,
            alert_type: "adverse_event",
            severity: classifySeverity(r.serious),
            title: `Adverse Event: ${r.patient?.drug?.[0]?.medicinalproduct || "Unknown Drug"}`,
            description: summarizeReaction(r.patient?.reaction),
            black_box_warning: false,
            affected_populations: [],
            contraindications: [],
            source_url: "https://open.fda.gov/apis/drug/event/",
            source_id: r.safetyreportid || null,
            is_active: true,
            metadata: { receive_date: r.receivedate, report_type: r.reporttype },
          }));

          // Deduplicate by source_id
          for (const alert of alerts) {
            if (!alert.source_id) continue;
            const { data: existing } = await supabase
              .from("drug_safety_updates")
              .select("id")
              .eq("source_id", alert.source_id)
              .maybeSingle();
            if (!existing) {
              await supabase.from("drug_safety_updates").insert(alert);
            }
          }
          results.drug_alerts = { fetched: alerts.length };
        }
      } catch (e) {
        errors.push(`OpenFDA: ${e.message}`);
      }
    }

    // ─── Pipeline 2: Literature (PubMed + Europe PMC) ───────────
    if (pipeline === "literature" || pipeline === "all") {
      try {
        // PubMed via E-utilities
        const queries = ["clinical AI diagnostic", "point of care testing India", "primary care guideline update"];
        let totalIngested = 0;

        for (const query of queries) {
          const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${Math.min(maxResults, 10)}&sort=date&retmode=json&datetype=edat&mindate=${getDateDaysAgo(7).replace(/(\d{4})(\d{2})(\d{2})/, "$1/$2/$3")}`;
          const searchRes = await fetch(searchUrl);
          if (!searchRes.ok) continue;

          const searchData = await searchRes.json();
          const ids = searchData.esearchresult?.idlist || [];
          if (ids.length === 0) continue;

          // Fetch summaries
          const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
          const summaryRes = await fetch(summaryUrl);
          if (!summaryRes.ok) continue;

          const summaryData = await summaryRes.json();
          const articles = summaryData.result || {};

          for (const pmid of ids) {
            const article = articles[pmid];
            if (!article || !article.title) continue;

            // Deduplicate
            const { data: existing } = await supabase
              .from("medical_evidence")
              .select("id")
              .eq("source_id", pmid)
              .eq("source", "pubmed")
              .maybeSingle();
            if (existing) continue;

            const year = article.pubdate ? parseInt(article.pubdate.substring(0, 4)) : null;
            await supabase.from("medical_evidence").insert({
              source: "pubmed",
              source_id: pmid,
              title: article.title,
              authors: (article.authors || []).map((a: any) => a.name).join(", "),
              journal: article.source || "",
              year,
              summary: article.title, // Full abstract requires separate fetch
              keywords: classifyKeywords(article.title, query),
              evidence_strength: "unknown",
              relevance_category: classifyRelevance(query),
              relevance_score: 0.5,
              url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
              is_ai_summarized: false,
              metadata: { query, pub_date: article.pubdate },
            });
            totalIngested++;
          }
        }

        // Europe PMC
        try {
          const epmcRes = await fetch(
            `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=clinical+AI+healthcare&format=json&pageSize=${Math.min(maxResults, 10)}&sort=DATE_CREATED+desc`
          );
          if (epmcRes.ok) {
            const epmcData = await epmcRes.json();
            for (const r of epmcData.resultList?.result || []) {
              if (!r.pmid && !r.doi) continue;
              const sourceId = r.pmid || r.doi;

              const { data: existing } = await supabase
                .from("medical_evidence")
                .select("id")
                .eq("source_id", sourceId)
                .eq("source", "europe_pmc")
                .maybeSingle();
              if (existing) continue;

              await supabase.from("medical_evidence").insert({
                source: "europe_pmc",
                source_id: sourceId,
                title: r.title || "",
                authors: r.authorString || "",
                journal: r.journalTitle || "",
                year: r.pubYear ? parseInt(r.pubYear) : null,
                summary: r.abstractText || r.title || "",
                keywords: classifyKeywords(r.title || "", "clinical AI"),
                evidence_strength: "unknown",
                relevance_category: "clinical_ai",
                relevance_score: 0.4,
                url: r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : `https://doi.org/${r.doi}`,
                is_ai_summarized: false,
                metadata: { source: "europe_pmc" },
              });
              totalIngested++;
            }
          }
        } catch (e) {
          errors.push(`EuropePMC: ${e.message}`);
        }

        results.literature = { ingested: totalIngested };
      } catch (e) {
        errors.push(`Literature: ${e.message}`);
      }
    }

    // ─── Pipeline 3: Guidelines (WHO, ICMR) ────────────────────
    if (pipeline === "guidelines" || pipeline === "all") {
      try {
        // WHO guidelines via GHO API
        const whoRes = await fetch(
          "https://ghoapi.azureedge.net/api/DIMENSION/GHO?$filter=contains(Title,'guideline')&$top=5"
        );
        let guidelineCount = 0;

        if (whoRes.ok) {
          const whoData = await whoRes.json();
          for (const item of whoData.value || []) {
            const title = item.Title || "";
            if (!title) continue;

            const { data: existing } = await supabase
              .from("guideline_updates")
              .select("id")
              .eq("title", title)
              .eq("source_organization", "WHO")
              .maybeSingle();
            if (existing) continue;

            await supabase.from("guideline_updates").insert({
              source_organization: "WHO",
              country: "global",
              specialty: "general",
              title,
              summary: item.Display || title,
              recommendation_text: "",
              keywords: classifyKeywords(title, "guideline"),
              applicable_conditions: [],
              applicable_drugs: [],
              is_active: true,
              metadata: { gho_code: item.Code },
            });
            guidelineCount++;
          }
        }

        results.guidelines = { ingested: guidelineCount };
      } catch (e) {
        errors.push(`Guidelines: ${e.message}`);
      }
    }

    // ─── Log monitoring event ───────────────────────────────────
    await supabase.from("monitoring_events").insert({
      event_type: "evidence_ingestion",
      agent_name: "fetch-medical-updates",
      success: errors.length === 0,
      metadata: { pipeline, results, errors },
    });

    return new Response(
      JSON.stringify({ success: true, pipeline, results, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Evidence ingestion error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helpers ──────────────────────────────────────────────────

function getToday(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function classifySeverity(serious: any): string {
  if (serious === "1" || serious === 1) return "critical";
  if (serious === "2" || serious === 2) return "high";
  return "moderate";
}

function summarizeReaction(reactions: any[]): string {
  if (!reactions || reactions.length === 0) return "No reaction data";
  return reactions
    .slice(0, 5)
    .map((r: any) => r.reactionmeddrapt || "Unknown")
    .join(", ");
}

function classifyKeywords(title: string, query: string): string[] {
  const keywords: string[] = [];
  const lower = title.toLowerCase();
  if (lower.includes("diabetes") || lower.includes("hba1c")) keywords.push("diabetes");
  if (lower.includes("cardiac") || lower.includes("heart")) keywords.push("cardiology");
  if (lower.includes("ai") || lower.includes("artificial")) keywords.push("ai");
  if (lower.includes("safety") || lower.includes("adverse")) keywords.push("safety");
  if (lower.includes("drug") || lower.includes("medication")) keywords.push("pharmacology");
  if (lower.includes("india") || lower.includes("icmr")) keywords.push("india");
  if (keywords.length === 0) keywords.push("general");
  return keywords;
}

function classifyRelevance(query: string): string {
  if (query.includes("AI")) return "clinical_ai";
  if (query.includes("India")) return "india_specific";
  if (query.includes("guideline")) return "guidelines";
  return "general";
}
