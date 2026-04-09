import { motion } from "framer-motion";
import type { TrendingResearch as TrendingResearchType } from "@/lib/blog-data";

interface Props {
  items: TrendingResearchType[];
}

export default function TrendingResearch({ items }: Props) {
  return (
    <section className="pb-16">
      <div className="container mx-auto px-4">
        <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground mb-8">Trending Research</h2>
        <div className="max-w-3xl divide-y divide-border">
          {items.map((item, i) => (
            <motion.a
              key={item.title}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="block py-6 first:pt-0 group"
            >
              <h3 className="text-sm font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                {item.summary}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                <span>{item.journal}</span>
                <span>·</span>
                <span>{item.year}</span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
