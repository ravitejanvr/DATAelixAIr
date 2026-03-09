import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Chip, ChipGroup } from "@/components/ui/chip";
import SEO from "@/components/SEO";
import TrendingResearch from "@/components/blog/TrendingResearch";
import ArticleCard from "@/components/blog/ArticleCard";
import {
  articles,
  categories,
  categoryMeta,
  trendingResearch,
  type ArticleCategory,
} from "@/lib/blog-data";

type Filter = "All" | ArticleCategory;

const Blog = () => {
  const [activeFilter, setActiveFilter] = useState<Filter>("All");

  const filtered =
    activeFilter === "All"
      ? [...articles].sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime())
      : articles
          .filter((a) => a.category === activeFilter)
          .sort((a, b) => new Date(b.publish_date).getTime() - new Date(a.publish_date).getTime());

  return (
    <div>
      <SEO
        title="Research & Insights — DATAelixAIr"
        description="Evidence-driven perspectives on clinical AI, patient safety, and healthcare innovation. Curated research from McKinsey, Nature, and WHO."
      />

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
            <p className="mt-3 text-sm text-muted-foreground/70 leading-relaxed max-w-lg">
              This knowledge hub curates research, clinical insights, and digital health developments shaping the future of healthcare.
            </p>
          </motion.div>

          {/* Category chips */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-8">
            <ChipGroup>
              <Chip
                variant={activeFilter === "All" ? "action" : "neutral"}
                selected={activeFilter === "All"}
                onClick={() => setActiveFilter("All")}
              >
                All
              </Chip>
              {categories.map((cat) => {
                const Icon = categoryMeta[cat].icon;
                return (
                  <Chip
                    key={cat}
                    variant={activeFilter === cat ? "action" : "neutral"}
                    selected={activeFilter === cat}
                    icon={<Icon className="h-3 w-3" />}
                    onClick={() => setActiveFilter(cat)}
                  >
                    {cat}
                  </Chip>
                );
              })}
            </ChipGroup>
          </motion.div>
        </div>
      </section>

      {/* Trending Research */}
      {activeFilter === "All" && <TrendingResearch items={trendingResearch} />}

      {/* Articles grid */}
      <section className="pb-24 bg-background">
        <div className="container mx-auto px-4">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeFilter}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filtered.map((article, i) => (
                <ArticleCard
                  key={article.title}
                  article={article}
                  index={i}
                  onCategoryClick={(cat) => setActiveFilter(cat)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-16">No articles in this category yet.</p>
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

export default Blog;
