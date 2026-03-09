import { useState, useEffect } from "react";
import { ExternalLink, BookOpen, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

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

interface ClinicalEvidenceSectionProps {
  feature: string;
}

const strengthColor: Record<string, string> = {
  strong: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-800",
  moderate: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800",
  emerging: "text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/30 dark:border-sky-800",
};

export default function ClinicalEvidenceSection({ feature }: ClinicalEvidenceSectionProps) {
  const [sources, setSources] = useState<EvidenceSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("evidence_sources")
          .select("*")
          .eq("related_feature", feature)
          .order("year", { ascending: false })
          .limit(6) as any;
        setSources(data || []);
      } catch {
        setSources([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [feature]);

  if (loading || sources.length === 0) return null;

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary mb-3 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Peer-Reviewed Research
          </p>
          <h2 className="font-display text-2xl font-bold text-foreground">Clinical Evidence</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Research supporting this capability from indexed biomedical sources.
          </p>
        </div>
        <div className="max-w-3xl mx-auto space-y-4">
          {sources.map((src, i) => (
            <motion.div
              key={src.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="border border-border rounded-xl p-5 bg-card hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{src.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {src.authors} · <span className="italic">{src.journal}</span> · {src.year}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{src.summary}</p>
                  <div className="mt-3">
                    <Badge variant="outline" className={`text-[10px] border ${strengthColor[src.evidence_strength] || strengthColor.moderate}`}>
                      {src.evidence_strength} evidence
                    </Badge>
                  </div>
                </div>
                {src.source_link && (
                  <a
                    href={src.source_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs flex items-center gap-1 shrink-0 mt-1"
                  >
                    Source <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-6 italic">
          Evidence is provided for transparency. Clinical judgment is always required.
        </p>
      </div>
    </section>
  );
}
