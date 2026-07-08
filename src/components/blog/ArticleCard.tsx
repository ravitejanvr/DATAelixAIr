import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { shortCategoryLabels, categoryMeta, type Article } from "@/lib/blog-data";

interface Props {
  article: Article;
  index: number;
}

export default function ArticleCard({ article, index }: Props) {
  const meta = categoryMeta[article.category];
  const Icon = meta.icon;
  const isExternal = !article.content && article.source_url;
  const linkTarget = isExternal ? article.source_url : `/blog/${article.slug}`;
  const label = shortCategoryLabels[article.category] || article.category;

  const inner = (
    <>
      {/* Top row: category left, read time right */}
      <div className="flex items-center justify-between mb-4">
        <span
          className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${meta.colorClass}`}
        >
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="text-[0.6rem] text-muted-foreground/80 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {article.reading_time_min} min
        </span>
      </div>

      {/* Title */}
      <h3 className="font-display text-lg font-bold text-foreground mb-2.5 leading-snug line-clamp-2">
        {article.title}
      </h3>

      {/* Summary */}
      <p className="text-sm text-muted-foreground font-light leading-relaxed flex-1 line-clamp-3">
        {article.summary}
      </p>

      {/* Footer: date left, source right */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground/80">
          {new Date(article.publish_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
        </span>
        {article.source_name && (
          <span className="text-xs text-muted-foreground font-medium">
            {article.source_name}
          </span>
        )}
      </div>
    </>
  );

  if (isExternal) {
    return (
      <motion.a
        href={linkTarget}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04 }}
        className="group border border-border rounded-2xl p-7 bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-card-hover transition-all flex flex-col cursor-pointer"
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        to={linkTarget}
        className="group border border-border rounded-2xl p-7 bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-card-hover transition-all flex flex-col cursor-pointer block"
      >
        {inner}
      </Link>
    </motion.div>
  );
}
