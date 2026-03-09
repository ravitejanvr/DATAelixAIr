import { useState, useEffect } from "react";
import { ExternalLink, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface EvidenceSource {
  id: string;
  title: string;
  authors: string;
  journal: string;
  year: number;
  source_link: string;
  summary: string;
  related_feature: string;
  evidence_strength: string;
}

interface ArticleEvidenceSourcesProps {
  /** Platform features referenced by the article */
  relatedFeatures: string[];
}

const strengthLabel: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  emerging: "Emerging",
};

export default function ArticleEvidenceSources({ relatedFeatures }: ArticleEvidenceSourcesProps) {
  const [sources, setSources] = useState<EvidenceSource[]>([]);

  useEffect(() => {
    if (!relatedFeatures.length) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("evidence_sources")
          .select("*")
          .in("related_feature", relatedFeatures)
          .order("year", { ascending: false })
          .limit(6) as any;
        setSources(data || []);
      } catch {
        setSources([]);
      }
    })();
  }, [relatedFeatures.join(",")]);

  if (sources.length === 0) return null;

  return (
    <div className="mb-8 border border-border rounded-xl p-5 bg-card">
      <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-primary" />
        Supporting Research
      </h3>
      <div className="space-y-3">
        {sources.map((src) => (
          <div key={src.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground leading-snug">{src.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {src.authors} · <span className="italic">{src.journal}</span> · {src.year}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{src.summary}</p>
              <Badge variant="outline" className="text-[9px] mt-1.5">
                {strengthLabel[src.evidence_strength] || "Moderate"} evidence
              </Badge>
            </div>
            {src.source_link && (
              <a
                href={src.source_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs flex items-center gap-1 shrink-0 hover:underline"
              >
                View <ExternalLink size={11} />
              </a>
            )}
          </div>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground italic mt-3">
        Evidence assists documentation only — not medical advice.
      </p>
    </div>
  );
}
