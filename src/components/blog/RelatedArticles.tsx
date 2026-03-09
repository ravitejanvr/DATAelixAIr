import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { categoryMeta, type Article } from "@/lib/blog-data";

interface Props {
  articles: Article[];
}

export default function RelatedArticles({ articles }: Props) {
  if (!articles.length) return null;

  return (
    <div className="border border-border rounded-2xl p-6 bg-card">
      <h3 className="font-display text-sm font-bold text-foreground mb-4">Related Reading</h3>
      <div className="space-y-3">
        {articles.map((a) => {
          const meta = categoryMeta[a.category];
          const Icon = meta.icon;
          const isExternal = !a.content && a.source_url;

          const content = (
            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`inline-flex items-center gap-0.5 text-[0.6rem] font-semibold uppercase px-1.5 py-0.5 rounded border ${meta.colorClass}`}>
                    <Icon className="h-2.5 w-2.5" />
                    {a.category.split(" & ")[0]}
                  </span>
                  <span className="text-[0.6rem] text-muted-foreground/50 flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" /> {a.reading_time_min} min
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{a.title}</p>
              </div>
              <ArrowRight size={14} className="text-primary mt-1 shrink-0 group-hover:translate-x-0.5 transition-transform" />
            </div>
          );

          if (isExternal) {
            return (
              <a key={a.slug} href={a.source_url} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            );
          }
          return (
            <Link key={a.slug} to={`/blog/${a.slug}`}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
