import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, ExternalLink, SearchX, Loader2, Search } from "lucide-react";
import { BookOpen, ShieldCheck, Workflow, Globe, FlaskConical } from "lucide-react";
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

const categoryMeta: Record<string, { icon: typeof BookOpen; colorClass: string }> = {
  "Clinical AI & Decision Support": { icon: BookOpen, colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400" },
  "Patient Safety & Clinical Governance": { icon: ShieldCheck, colorClass: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400" },
  "Patient Safety & Governance": { icon: ShieldCheck, colorClass: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400" },
  "Healthcare Operations & Workflow": { icon: Workflow, colorClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" },
  "Digital Health & Interoperability": { icon: Globe, colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  "Research & Evidence": { icon: FlaskConical, colorClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400" },
};

/** Only trust a URL if is_verified is explicitly true */
function hasVerifiedUrl(article: InsightArticle): boolean {
  return article.is_verified === true && !!article.url && article.url.length > 10;
}

function googleScholarSearch(title: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <SearchX className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Insight Not Found</h1>
          <p className="text-sm text-muted-foreground max-w-md">
            This insight may have been removed or the link may be incorrect.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/insights"><ArrowLeft size={14} className="mr-1" /> Browse All Insights</Link>
        </Button>
      </div>
    );
  }

  const meta = categoryMeta[article.category] || categoryMeta["Research & Evidence"];
  const Icon = meta.icon;
  const date = article.published_at || article.created_at;
  const verified = hasVerifiedUrl(article);

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
        description={article.summary.substring(0, 160)}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="pt-28 pb-8 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link to="/insights" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft size={14} /> Back to Research & Insights
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${meta.colorClass}`}>
                <Icon className="h-3 w-3" />
                {article.category}
              </span>
            </div>

            <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.15] tracking-tight text-foreground mb-4">
              {article.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {(() => {
                  try { return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
                  catch { return "Recent"; }
                })()}
              </span>
              <span>{article.source}</span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="pb-16 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {/* Summary */}
            <div className="mb-8">
              <p className="text-[0.95rem] text-muted-foreground font-light leading-relaxed border-l-2 border-primary/30 pl-4">
                {article.summary}
              </p>
            </div>

            {/* Clinical relevance */}
            {article.clinical_relevance && (
              <div className="mb-8 p-5 rounded-xl bg-primary/5 border border-primary/10">
                <h2 className="font-display text-base font-bold text-foreground mb-2">Why This Matters Clinically</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{article.clinical_relevance}</p>
              </div>
            )}

            {/* Link section — strict verification */}
            <div className="mb-8 flex flex-wrap items-center gap-3">
              {verified ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={article.url} target="_blank" rel="noopener noreferrer">
                    View Publication <ExternalLink size={14} className="ml-1" />
                  </a>
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground/60">Source: {article.source}</p>
              )}
              {/* Fallback: Google Scholar search */}
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" asChild>
                <a href={googleScholarSearch(article.title)} target="_blank" rel="noopener noreferrer">
                  <Search size={12} className="mr-1" /> Find on Google Scholar
                </a>
              </Button>
            </div>

            {/* CTA */}
            <div className="rounded-xl border border-border bg-muted/30 p-6 text-center">
              <h3 className="font-display text-lg font-bold text-foreground mb-2">See How This Applies in Practice</h3>
              <p className="text-sm text-muted-foreground mb-4">
                DATAelixAIr integrates clinical intelligence directly into consultation workflows.
              </p>
              <Button asChild>
                <Link to="/onboard">Request Pilot Access <ArrowLeft size={14} className="ml-1 rotate-180" /></Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default InsightDetail;
