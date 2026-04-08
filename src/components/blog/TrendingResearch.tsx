import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import type { TrendingResearch as TrendingResearchType } from "@/lib/blog-data";

interface Props {
  items: TrendingResearchType[];
}

export default function TrendingResearch({ items }: Props) {
  return (
    <section className="pb-12 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-display text-xl font-bold text-foreground">Trending Research</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <motion.a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="group relative border border-border rounded-2xl p-6 bg-card hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-card-hover transition-all flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                  {item.journal}
                </span>
                <span className="text-[0.65rem] text-muted-foreground/60 ml-auto">{item.year}</span>
              </div>
              <h3 className="font-display text-base font-bold text-foreground mb-2 leading-snug line-clamp-2">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed flex-1 line-clamp-3">
                {item.summary}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
