import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";

interface InsightArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  category: string;
  published_at: string | null;
  created_at: string;
  slug: string;
  clinical_relevance: string | null;
  is_verified: boolean | null;
}

const CATEGORIES = [
  "All",
  "Clinical AI & Decision Support",
  "Patient Safety & Clinical Governance",
  "Patient Safety & Governance",
  "Healthcare Operations & Workflow",
  "Digital Health & Interoperability",
  "Research & Evidence",
] as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

const ResearchInsights = () => {
  const [articles, setArticles] = useState<InsightArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("insights_articles")
        .select("*")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(50);
      setArticles((data as unknown as InsightArticle[]) || []);
      setLoading(false);
    })();
  }, []);

  const availableCategories = useMemo(() => {
    const cats = new Set(articles.map(a => a.category));
    return CATEGORIES.filter(c => c === "All" || cats.has(c));
  }, [articles]);

  const filtered = useMemo(() => {
    if (filter === "All") return articles;
    return articles.filter(a => a.category === filter);
  }, [articles, filter]);

  useEffect(() => {
    if (filter !== "All" && !availableCategories.includes(filter as any)) {
      setFilter("All");
    }
  }, [availableCategories, filter]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Research & Insights — DATAelixAIr",
    description: "Evidence-driven clinical AI research from Nature, The Lancet, JAMA, PubMed, and WHO.",
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
  };

  return (
    <div className="bg-background min-h-screen">
      <SEO
        title="Research & Insights — DATAelixAIr™ by elixAIr"
        description="Evidence-driven clinical AI research insights from Nature, The Lancet, JAMA, and PubMed. Curated perspectives on healthcare innovation and patient safety."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <section className="pt-32 pb-10">
        <div className="max-w-[820px] mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 mb-4">
              Clinical Intelligence
            </p>
            <h1 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-bold leading-[1.15] tracking-tight text-foreground">
              Research &amp; Insights
            </h1>
            <p className="mt-3 text-[15px] text-muted-foreground/80 leading-relaxed max-w-lg font-light">
              Evidence from high-impact journals and real-world clinical deployments, curated for decision makers.
            </p>
          </motion.div>

          {/* Filter — minimal text tabs */}
          {availableCategories.length > 2 && (
            <motion.nav
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-b border-border/40 pb-3"
            >
              {availableCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`text-[11px] uppercase tracking-[0.12em] font-medium pb-1 transition-colors ${
                    filter === cat
                      ? "text-foreground border-b border-foreground"
                      : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  {cat === "Patient Safety & Clinical Governance" ? "Patient Safety" :
                   cat === "Clinical AI & Decision Support" ? "Clinical AI" :
                   cat === "Healthcare Operations & Workflow" ? "Operations" :
                   cat === "Digital Health & Interoperability" ? "Digital Health" :
                   cat === "Research & Evidence" ? "Research" :
                   cat === "Patient Safety & Governance" ? "Patient Safety" :
                   cat}
                </button>
              ))}
            </motion.nav>
          )}
        </div>
      </section>

      {/* Feed */}
      <section className="pb-28">
        <div className="max-w-[820px] mx-auto px-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={filter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="divide-y divide-border/30"
              >
                {filtered.map((article, i) => {
                  const date = formatDate(article.published_at || article.created_at);

                  return (
                    <motion.article
                      key={article.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="group py-7 first:pt-0"
                    >
                      <Link to={`/insights/${article.slug}`} className="block">
                        {/* Category + meta line */}
                        <div className="flex items-center gap-3 mb-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
                            {article.category}
                          </span>
                          {date && (
                            <>
                              <span className="text-muted-foreground/20">·</span>
                              <span className="text-[10px] text-muted-foreground/40 tracking-wide">{date}</span>
                            </>
                          )}
                        </div>

                        {/* Title */}
                        <h2 className="text-[17px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors duration-200 mb-2">
                          {article.title}
                        </h2>

                        {/* Summary */}
                        <p className="text-[13px] text-muted-foreground/70 leading-relaxed line-clamp-2 mb-2.5 max-w-[680px]">
                          {article.summary}
                        </p>

                        {/* Clinical relevance — the highlight */}
                        {article.clinical_relevance && (
                          <p className="text-[12.5px] text-foreground/80 leading-snug pl-3 border-l-2 border-primary/30 max-w-[640px]">
                            {article.clinical_relevance}
                          </p>
                        )}

                        {/* Source */}
                        <p className="mt-3 text-[10px] text-muted-foreground/40 tracking-wide">
                          {article.source}
                        </p>
                      </Link>
                    </motion.article>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Footer CTA */}
          <div className="mt-20 pt-10 border-t border-border/20 text-center">
            <p className="text-sm text-muted-foreground/50 font-light mb-4">
              Interested in collaborating on clinical research?
            </p>
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <Link to="/contact">
                Get in Touch <ArrowRight className="ml-1.5" size={12} />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResearchInsights;
