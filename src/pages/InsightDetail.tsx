import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ExternalLink, SearchX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";

const SHORT_CATEGORIES: Record<string, string> = {
  "Clinical AI & Decision Support": "Clinical AI",
  "Patient Safety & Clinical Governance": "Patient Safety",
  "Patient Safety & Governance": "Patient Safety",
  "Healthcare Operations & Workflow": "Operations",
  "Digital Health & Interoperability": "Digital Health",
  "Research & Evidence": "Research",
};

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

const InsightDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<InsightArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setNotFound(false);
      const { data } = await supabase
        .from("insights_articles")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (data) {
        setArticle(data as InsightArticle);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4">
        <SearchX className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-foreground mb-2">Insight Not Found</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            This insight may have been removed or the link may be incorrect.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/insights"><ArrowLeft size={12} className="mr-1" /> All Insights</Link>
        </Button>
      </div>
    );
  }

  const date = article.published_at || article.created_at;
  const formattedDate = (() => {
    try {
      return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return "";
    }
  })();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: date,
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
  };

  return (
    <div>
      <SEO
        title={`${article.title} — DATAelixAIr`}
        description={article.summary?.substring(0, 160) || article.title}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="pt-28 pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link
            to="/insights"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-10"
          >
            <ArrowLeft size={12} /> Back
          </Link>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            {/* Meta row */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {SHORT_CATEGORIES[article.category] || article.category}
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
            <h1 className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-extrabold leading-[1.15] tracking-tight text-foreground mb-6">
              {article.title}
            </h1>

            {/* Summary */}
            {article.summary && (
              <p className="text-[0.95rem] text-muted-foreground font-light leading-relaxed mb-8 max-w-2xl">
                {article.summary}
              </p>
            )}

            {/* Why it matters */}
            {article.clinical_relevance && (
              <div className="border-l-2 border-primary/40 pl-4 mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary/70 mb-1.5">
                  Why it matters
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {article.clinical_relevance}
                </p>
              </div>
            )}

            {/* Source link */}
            {article.is_verified && (
              <div className="mb-10">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/50 rounded-md px-3 py-2"
                >
                  Read original publication <ExternalLink size={11} />
                </a>
              </div>
            )}

            {/* CTA */}
            <div className="border-t border-border/30 pt-8">
              <p className="text-sm text-muted-foreground mb-3">
                DATAelixAIr integrates clinical intelligence directly into consultation workflows.
              </p>
              <Button size="sm" asChild>
                <Link to="/onboard">
                  Request Pilot Access <ArrowLeft size={12} className="ml-1 rotate-180" />
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default InsightDetail;
