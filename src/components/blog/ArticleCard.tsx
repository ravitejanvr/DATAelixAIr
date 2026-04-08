import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import type { Article } from "@/lib/blog-data";

interface Props {
  article: Article;
  index: number;
  onCategoryClick?: (cat: Article["category"]) => void;
}

export default function ArticleCard({ article, index, onCategoryClick }: Props) {
  const isExternal = !article.content && article.source_url;
  const linkTarget = isExternal ? article.source_url : `/blog/${article.slug}`;

  const inner = (
    <>
      {/* Source & date line */}
      <div className="flex items-baseline gap-2 mb-3 text-[0.7rem] text-muted-foreground/60 uppercase tracking-wider font-medium">
        <span>{article.source_name || article.source_type}</span>
        <span className="mx-1">·</span>
        <span>
          {new Date(article.publish_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display text-[1.05rem] font-semibold text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
        {article.title}
      </h3>

      {/* Summary */}
      <p className="text-[0.82rem] text-muted-foreground/80 font-light leading-relaxed flex-1 line-clamp-3">
        {article.summary}
      </p>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCategoryClick?.(article.category);
          }}
          className="text-[0.6rem] uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors"
        >
          {article.category}
        </button>
        <span className="text-[0.6rem] text-muted-foreground/40">
          {article.reading_time_min} min read
        </span>
      </div>
    </>
  );

  if (isExternal) {
    return (
      <motion.a
        href={linkTarget}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="group flex flex-col p-6 border border-border/50 rounded-xl bg-card hover:border-border hover:shadow-sm transition-all"
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        to={linkTarget}
        className="group flex flex-col p-6 border border-border/50 rounded-xl bg-card hover:border-border hover:shadow-sm transition-all block"
      >
        {inner}
      </Link>
    </motion.div>
  );
}
