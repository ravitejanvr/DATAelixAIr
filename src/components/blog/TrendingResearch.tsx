import { motion } from "framer-motion";
import type { TrendingResearch as TrendingResearchType } from "@/lib/blog-data";

interface Props {
  items: TrendingResearchType[];
}

export default function TrendingResearch({ items }: Props) {
  return (
    <section className="pb-14 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-[0.65rem] font-medium uppercase tracking-[0.15em] text-muted-foreground/50 mb-6">
          Recent Publications
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <motion.a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group flex flex-col p-6 border border-border/50 rounded-xl bg-card hover:border-border hover:shadow-sm transition-all"
            >
              <div className="flex items-baseline gap-2 mb-3 text-[0.7rem] text-muted-foreground/60 uppercase tracking-wider font-medium">
                <span>{item.journal}</span>
                <span className="mx-1">·</span>
                <span>{item.year}</span>
              </div>
              <h3 className="font-display text-[1.05rem] font-semibold text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-[0.82rem] text-muted-foreground/80 font-light leading-relaxed flex-1 line-clamp-3">
                {item.summary}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
