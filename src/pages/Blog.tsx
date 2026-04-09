import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import TrendingResearch from "@/components/blog/TrendingResearch";
import {
  staticArticles,
  trendingResearch,
  shortCategoryLabels,
  type Article,
} from "@/lib/blog-data";
import { supabase } from "@/integrations/supabase/client";

const Blog = () => {
  const [allArticles, setAllArticles] = useState<Article[]>(staticArticles);

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      const { data } = await supabase
        .from("blog_articles")
        .select("*")
        .eq("status", "published")
        .order("publish_date", { ascending: false }) as any;

      if (data?.length) {
        const dbArticles: Article[] = data.map((a: any) => ({
          ...a,
          publish_date: a.publish_date || a.created_at,
          source_name: a.source_name || "",
          source_url: a.source_url || "",
        }));
        const merged = [
          ...dbArticles,
          ...staticArticles.filter((s) => !dbArticles.some((d) => d.slug === s.slug)),
        ];
        setAllArticles(merged);
      }
    } catch {
      // Keep static articles as fallback
    }
  };

  const sorted = [...allArticles].sort(
    (a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime()
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Research & Insights — DATAelixAIr",
    description: "Clinical research and evidence relevant to healthcare documentation and decision support.",
    publisher: { "@type": "Organization", name: "elixAIr" },
  };

  return (
    <div>
      <SEO
        title="Research & Insights — DATAelixAIr™ by elixAIr"
        description="Clinical research and evidence relevant to healthcare documentation, decision support, and patient safety."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="pt-36 pb-16">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.1] tracking-tight text-foreground">
              Research & Insights
            </h1>
          </motion.div>
        </div>
      </section>

      {/* Trending Research */}
      <TrendingResearch items={trendingResearch} />

      {/* Articles list */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl divide-y divide-border">
            {sorted.map((article, i) => {
              const isExternal = !article.content && article.source_url;
              const linkTarget = isExternal ? article.source_url : `/blog/${article.slug}`;
              const label = shortCategoryLabels[article.category] || article.category;
              const dateStr = new Date(article.publish_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

              const inner = (
                <div className="py-6 first:pt-0 group">
                  <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                    {article.summary}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                    {article.source_name && <span>{article.source_name}</span>}
                    {article.source_name && <span>·</span>}
                    <span>{dateStr}</span>
                  </div>
                </div>
              );

              if (isExternal) {
                return (
                  <motion.a
                    key={article.slug}
                    href={linkTarget}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="block"
                  >
                    {inner}
                  </motion.a>
                );
              }

              return (
                <motion.a
                  key={article.slug}
                  href={linkTarget}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="block"
                >
                  {inner}
                </motion.a>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Blog;
