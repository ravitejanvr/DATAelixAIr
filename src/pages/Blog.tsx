import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SEO from "@/components/SEO";
import ArticleCard from "@/components/blog/ArticleCard";
import {
  staticArticles,
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
    description: "Evidence-driven perspectives on clinical AI, patient safety, and healthcare innovation.",
    publisher: { "@type": "Organization", name: "DATAelixAIr" },
  };

  return (
    <div>
      <SEO
        title="Research & Insights — DATAelixAIr™ by elixAIr"
        description="Evidence-driven perspectives on clinical AI, patient safety, and healthcare innovation from elixAIr. Curated research from McKinsey, Nature, and WHO."
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="pt-32 pb-14 bg-background">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3.5">Knowledge Hub</p>
            <h1 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              Research &amp; <em className="not-italic text-primary">Insights</em>
            </h1>
            <p className="mt-4 text-muted-foreground font-light leading-relaxed max-w-xl">
              Evidence-driven perspectives on clinical AI, patient safety, and healthcare innovation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Articles grid */}
      <section className="pb-24 bg-background">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {sorted.map((article, i) => (
              <ArticleCard key={article.slug} article={article} index={i} />
            ))}
          </motion.div>

          {sorted.length === 0 && (
            <p className="text-center text-muted-foreground py-16">No articles yet.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
