import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { categoryMeta, type Article } from "@/lib/blog-data";

interface Props {
  article: Article;
  index: number;
  onCategoryClick?: (cat: Article["category"]) => void;
}

export default function ArticleCard({ article, index, onCategoryClick }: Props) {
  const meta = categoryMeta[article.category];
  const Icon = meta.icon;
  const isExternal = !article.content && article.source_url;
  const linkTarget = isExternal ? article.source_url : `/blog/${article.slug}`;

  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
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
          {children}
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
          {children}
        </Link>
      </motion.div>
    );
  };

  return (
    <CardWrapper>
      {/* Category chip */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCategoryClick?.(article.category);
          }}
          className={`inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-colors ${meta.colorClass}`}
        >
          <Icon className="h-3 w-3" />
          {article.category.split(" & ")[0]}
        </button>

        {article.source_type === "Research" && (
          <span className="text-[0.6rem] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
            {article.source_name}
          </span>
        )}

        <span className="text-[0.6rem] text-muted-foreground/50 ml-auto flex items-center gap-1">
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

      {/* Footer */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground/50">
          {new Date(article.publish_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          {" · "}
          {article.author}
        </span>
      </div>
    </CardWrapper>
  );
}
