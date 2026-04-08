import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, ExternalLink, Loader2 } from "lucide-react";
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
  is_verified: boolean;
}

const SHORT_CATEGORIES: Record<string, string> = {
  "Clinical AI & Decision Support": "Clinical AI",
  "Patient Safety & Clinical Governance": "Patient Safety",
  "Patient Safety & Governance": "Patient Safety",
  "Healthcare Operations & Workflow": "Operations",
  "Digital Health & Interoperability": "Digital Health",
  "Research & Evidence": "Research",
};

const FILTERS = ["All", "Clinical AI", "Digital Health", "Patient Safety", "Operations", "Research"] as const;

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

  const shortCat = (cat: string) => SHORT_CATEGORIES[cat] || cat;

  const filtered = filter === "All"
    ? articles
    : articles.filter(a => shortCat(a.category) === filter);

  // Only show filter tabs that have articles
  const activeTabs = FILTERS.filter(f =>
    f === "All" || articles.some(a => shortCat(a.category) === f)
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Research & Insights — DATAelixAIr",
    description: "Curated clinical AI research from Nature, The Lancet, JAMA, and PubMed.",
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
  };

  return (
    <div>
      <SEO
        title="Research & Insights — DATAelixAIr™ by elixAIr"
        description="Curated clinical AI research insights from Nature, The Lancet, JAMA, and PubMed. Evidence-driven perspectives on healthcare innovation."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero — minimal, no marketing copy */}
      <section className="pt-32 pb-10 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Research &amp; Insights
            </h1>
          </motion.div>

          {/* Filter tabs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 flex flex-wrap gap-1.5"
          >
            {activeTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === tab
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {tab}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Articles — editorial list */}
      <section className="pb-24 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-16 text-sm">
              No articles available.
            </p>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div
                key={filter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="divide-y divide-border/50"
              >
                {filtered.map((article, i) => (
                  <InsightEntry key={article.id} article={article} index={i} shortCat={shortCat} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          <div className="mt-20 text-center">
            <p className="text-sm text-muted-foreground mb-3">Want to collaborate on research?</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/contact">
                Get in Touch <ArrowRight className="ml-1" size={12} />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

function InsightEntry({
  article,
  index,
  shortCat,
}: {
  article: InsightArticle;
  index: number;
  shortCat: (c: string) => string;
}) {
  const date = article.published_at || article.created_at;
  const formattedDate = (() => {
    try {
      return new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  })();

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="py-6 first:pt-0"
    >
      {/* Category + date row */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {shortCat(article.category)}
        </span>
        <span className="text-[10px] text-muted-foreground/50">·</span>
        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />
          {formattedDate}
        </span>
        <span className="text-[10px] text-muted-foreground/50">·</span>
        <span className="text-[10px] text-muted-foreground/60">{article.source}</span>
      </div>

      {/* Title */}
      <Link
        to={`/insights/${article.slug}`}
        className="group"
      >
        <h2 className="text-[0.95rem] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors mb-2">
          {article.title}
        </h2>
      </Link>

      {/* Summary */}
      {article.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-2.5 max-w-2xl">
          {article.summary}
        </p>
      )}

      {/* Why it matters */}
      {article.clinical_relevance && (
        <div className="border-l-2 border-primary/30 pl-3 mb-3">
          <p className="text-xs font-medium text-foreground/80 leading-relaxed">
            <span className="font-semibold text-primary/80">Why it matters</span>{" "}
            — {article.clinical_relevance}
          </p>
        </div>
      )}

      {/* Source link */}
      {article.is_verified && (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View publication <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </motion.article>
  );
}

export default ResearchInsights;
