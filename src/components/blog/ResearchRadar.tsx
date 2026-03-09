import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Radar, ExternalLink, BookOpen, Clock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface RadarArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: string;
  source_journal: string | null;
  source_year: number | null;
  source_url: string | null;
  publish_date: string | null;
  reading_time_min: number;
  keywords: string[];
}

export default function ResearchRadar() {
  const [articles, setArticles] = useState<RadarArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("blog_articles")
        .select("id, title, slug, summary, category, source_journal, source_year, source_url, publish_date, reading_time_min, keywords")
        .eq("status", "published")
        .eq("source_type", "Research")
        .order("publish_date", { ascending: false })
        .limit(6) as any;
      setArticles(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading || articles.length === 0) return null;

  return (
    <section className="py-12 bg-muted/30 border-y border-border/40">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2.5 mb-6"
        >
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Radar className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
              Research Radar
              <Sparkles className="h-3.5 w-3.5 text-primary/60" />
            </h2>
            <p className="text-[11px] text-muted-foreground">
              AI-curated insights from the latest clinical research
            </p>
          </div>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to={`/article/${a.slug}`}
                className="group block rounded-xl border border-border/50 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all h-full"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <Badge variant="outline" className="text-[9px] font-medium border-primary/20 text-primary">
                    Research Radar
                  </Badge>
                  {a.source_journal && (
                    <span className="text-[9px] text-muted-foreground truncate">{a.source_journal}</span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {a.title}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">
                  {a.summary}
                </p>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {a.reading_time_min} min
                  </span>
                  <span className="flex items-center gap-1 text-primary/70 group-hover:text-primary transition-colors">
                    Read Analysis <ExternalLink className="h-2.5 w-2.5" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
