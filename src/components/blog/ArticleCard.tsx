import { motion } from "framer-motion";
import { ExternalLink, Clock } from "lucide-react";
import { categoryMeta, type Article } from "@/lib/blog-data";

interface Props {
  article: Article;
  index: number;
  onCategoryClick?: (cat: Article["category"]) => void;
}

export default function ArticleCard({ article, index, onCategoryClick }: Props) {
  const meta = categoryMeta[article.category];
  const Icon = meta.icon;

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group border border-border rounded-2xl p-7 bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-card-hover transition-all flex flex-col cursor-pointer"
    >
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
            {article.source}
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
        <span className="flex items-center gap-2 text-primary text-sm font-medium">
          Read Article <ExternalLink size={13} className="group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </motion.a>
  );
}
