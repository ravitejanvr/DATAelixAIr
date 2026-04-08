import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ExternalLink, Clock, Calendar, Loader2 } from "lucide-react";
import { BookOpen, ShieldCheck, Workflow, Globe, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip, ChipGroup } from "@/components/ui/chip";
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
}

const CATEGORIES = [
  "All",
  "Clinical AI & Decision Support",
  "Patient Safety & Governance",
  "Healthcare Operations & Workflow",
  "Digital Health & Interoperability",
  "Research & Evidence",
] as const;

const categoryMeta: Record<string, { icon: typeof BookOpen; colorClass: string }> = {
  "Clinical AI & Decision Support": { icon: BookOpen, colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  "Patient Safety & Governance": { icon: ShieldCheck, colorClass: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400" },
  "Healthcare Operations & Workflow": { icon: Workflow, colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
  "Digital Health & Interoperability": { icon: Globe, colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  "Research & Evidence": { icon: FlaskConical, colorClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400" },
};

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
      setArticles((data as InsightArticle[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "All" ? articles : articles.filter(a => a.category === filter);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Research & Insights — DATAelixAIr",
    description: "Continuously updated clinical AI research from Nature, The Lancet, JAMA, PubMed, and WHO.",
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
  };

  return (
    <div>
      <SEO
        title="Research & Insights — DATAelixAIr™ by elixAIr"
        description="Continuously updated clinical AI research insights from Nature, The Lancet, JAMA, PubMed, and WHO. Evidence-driven perspectives on healthcare innovation."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="pt-32 pb-14 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Clinical Intelligence</p>
            <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Research &amp; <em className="not-italic text-primary">Insights</em>
            </h1>
            <p className="mt-4 text-muted-foreground font-light leading-relaxed max-w-xl">
              Continuously updated research from authoritative clinical sources. Automatically curated, never stale.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/60">
              Sources: Nature Digital Medicine · The Lancet · JAMA · PubMed · WHO
            </p>
          </motion.div>

          {/* Category chips */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8">
            <ChipGroup>
              {CATEGORIES.map(cat => {
                const meta = cat !== "All" ? categoryMeta[cat] : null;
                const Icon = meta?.icon;
                return (
                  <Chip
                    key={cat}
                    variant={filter === cat ? "action" : "neutral"}
                    selected={filter === cat}
                    icon={Icon ? <Icon className="h-3 w-3" /> : undefined}
                    onClick={() => setFilter(cat)}
                  >
                    {cat === "All" ? "All" : cat}
                  </Chip>
                );
              })}
            </ChipGroup>
          </motion.div>
        </div>
      </section>

      {/* Articles grid */}
      <section className="pb-24 bg-background">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading latest research...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              {articles.length === 0
                ? "Research articles are being ingested. Check back soon."
                : "No articles in this category yet."}
            </p>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={filter}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {filtered.map((article, i) => {
                  const meta = categoryMeta[article.category] || categoryMeta["Research & Evidence"];
                  const Icon = meta.icon;
                  const date = article.published_at || article.created_at;

                  return (
                    <motion.div
                      key={article.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        to={`/insights/${article.slug}`}
                        className="group block rounded-xl border border-border/50 bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all h-full flex flex-col"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`inline-flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.colorClass}`}>
                            <Icon className="h-2.5 w-2.5" />
                            {article.category}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>

                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3 flex-1">
                          {article.summary}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 mt-auto pt-3 border-t border-border/30">
                          <span className="truncate max-w-[40%]">{article.source}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {(() => {
                              try { return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
                              catch { return "Recent"; }
                            })()}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          <div className="mt-16 text-center">
            <p className="text-muted-foreground font-light mb-4">Want to collaborate on research or suggest a topic?</p>
            <Button variant="outline" asChild>
              <Link to="/contact">
                Get in Touch <ArrowRight className="ml-1" size={14} />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ResearchInsights;
