import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import EvidenceSourcesPanel from "@/components/blog/EvidenceSourcesPanel";
import RelatedArticles from "@/components/blog/RelatedArticles";
import RelatedCapabilities from "@/components/blog/RelatedCapabilities";
import {
  staticArticles,
  categoryMeta,
  findRelatedArticles,
  detectFeatureLinks,
  type Article,
} from "@/lib/blog-data";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [allArticles, setAllArticles] = useState<Article[]>(staticArticles);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticle();
  }, [slug]);

  const loadArticle = async () => {
    setLoading(true);
    try {
      // Try DB first
      const { data: dbArticles } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("status", "published") as any;

      const dbList: Article[] = (dbArticles || []).map((a: any) => ({
        ...a,
        publish_date: a.publish_date || a.created_at,
        source_name: a.source_name || "",
        source_url: a.source_url || "",
      }));

      const combined = [...dbList, ...staticArticles.filter((s) => !dbList.some((d) => d.slug === s.slug))];
      setAllArticles(combined);

      const found = combined.find((a) => a.slug === slug);
      setArticle(found || null);
    } catch {
      const found = staticArticles.find((a) => a.slug === slug);
      setArticle(found || null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Article not found.</p>
        <Button variant="outline" asChild>
          <Link to="/blog">← Back to Research & Insights</Link>
        </Button>
      </div>
    );
  }

  const meta = categoryMeta[article.category];
  const Icon = meta.icon;
  const related = findRelatedArticles(article, allArticles);
  const capabilities = detectFeatureLinks(article);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    author: { "@type": "Person", name: article.author },
    datePublished: article.publish_date,
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
    keywords: article.keywords.join(", "),
  };

  return (
    <div>
      <SEO
        title={article.meta_title || `${article.title} — DATAelixAIr`}
        description={article.meta_description || article.summary}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="pt-28 pb-12 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft size={14} /> Back to Research & Insights
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Category & metadata */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <span className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${meta.colorClass}`}>
                <Icon className="h-3 w-3" />
                {article.category}
              </span>
              {article.source_type === "Research" && (
                <span className="text-[0.6rem] font-medium uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                  {article.source_name}
                </span>
              )}
            </div>

            <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-extrabold leading-[1.15] tracking-tight text-foreground mb-4">
              {article.title}
            </h1>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
              <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(article.publish_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
              <span className="flex items-center gap-1"><Clock size={14} /> {article.reading_time_min} min read</span>
              <span>{article.author}</span>
            </div>

            {/* Summary */}
            <p className="text-lg text-muted-foreground font-light leading-relaxed mb-8 border-l-2 border-primary/30 pl-4">
              {article.summary}
            </p>

            {/* Key Findings */}
            {article.key_findings.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-lg font-bold text-foreground mb-3">Key Findings</h2>
                <ul className="space-y-2">
                  {article.key_findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary font-bold mt-0.5">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Content */}
            {article.content && (
              <div className="prose prose-sm max-w-none dark:prose-invert mb-8">
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            )}

            {/* Clinical Implications */}
            {article.clinical_implications && (
              <div className="mb-8 p-4 rounded-xl bg-primary/5 border border-primary/10">
                <h2 className="font-display text-lg font-bold text-foreground mb-2">Clinical Implications</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{article.clinical_implications}</p>
              </div>
            )}

            {/* External link */}
            {article.source_url && (
              <div className="mb-8">
                <Button variant="outline" asChild>
                  <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                    Read Original Source <ExternalLink size={14} className="ml-1" />
                  </a>
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Sidebar-style panels */}
      <section className="pb-24 bg-background">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <EvidenceSourcesPanel article={article} />
          <RelatedCapabilities capabilities={capabilities} />
          <RelatedArticles articles={related} />
        </div>
      </section>
    </div>
  );
}
