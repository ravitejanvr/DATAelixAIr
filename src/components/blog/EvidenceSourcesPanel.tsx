import { ExternalLink, BookOpen } from "lucide-react";
import type { Article } from "@/lib/blog-data";

interface Props {
  article: Article;
}

export default function EvidenceSourcesPanel({ article }: Props) {
  if (!article.source_url || article.source_type !== "Research") return null;

  return (
    <div className="border border-border rounded-2xl p-6 bg-card">
      <h3 className="font-display text-sm font-bold text-foreground mb-4 flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-primary" />
        Evidence Sources
      </h3>
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{article.title}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {article.source_journal && (
                <span className="text-xs text-muted-foreground">{article.source_journal}</span>
              )}
              {article.source_year && (
                <span className="text-xs text-muted-foreground">· {article.source_year}</span>
              )}
              {article.source_name && (
                <span className="text-[0.65rem] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium">
                  {article.source_name}
                </span>
              )}
            </div>
          </div>
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary text-xs font-medium hover:underline shrink-0"
          >
            View Source <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
