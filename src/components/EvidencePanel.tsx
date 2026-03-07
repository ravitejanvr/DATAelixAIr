import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, ChevronDown, ChevronUp, Loader2, ExternalLink,
  AlertTriangle, Shield, ScrollText, CheckCircle, Sparkles, Database
} from "lucide-react";
import type { EvidenceData } from "@/layers/evidence/api";
import { evidenceConfidenceColor } from "@/layers/evidence/api";

interface EvidencePanelProps {
  medications: string[];
  diagnosis: string;
  patientAge?: number;
  allergies?: string[];
  confidenceLevel: string;
  disabled?: boolean;
}

export default function EvidencePanel({
  medications, diagnosis, patientAge, allergies, confidenceLevel, disabled
}: EvidencePanelProps) {
  const { toast } = useToast();
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState({ meds: true, guidelines: true, safety: true });

  const isLowConfidence = confidenceLevel === "low";

  const fetchEvidence = async () => {
    if (medications.length === 0) {
      toast({ title: "No medications", description: "No medications to retrieve evidence for." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("evidence-agents", {
        body: { medications, diagnosis, patient_age: patientAge, allergies },
      });
      if (error) throw new Error(error.message);
      setEvidence(data as EvidenceData);
    } catch (err: any) {
      toast({ title: "Evidence retrieval failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const confidenceBadge = (conf: string) => {
    const icon = conf === "high" ? <CheckCircle className="h-2.5 w-2.5" /> : conf === "moderate" ? <AlertTriangle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />;
    return <Badge variant="outline" className={`text-[8px] ${evidenceConfidenceColor(conf)}`}>{icon} {conf}</Badge>;
  };

  if (isLowConfidence) {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            <span>Low confidence output — evidence retrieval disabled. Manual review recommended.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Evidence & References
            <Badge variant="outline" className="text-[9px]">Advisory Only</Badge>
          </CardTitle>
          {!evidence && (
            <Button
              size="sm" variant="outline" onClick={fetchEvidence}
              disabled={loading || disabled || medications.length === 0}
              className="text-xs"
            >
              {loading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Fetching...</> : "Retrieve Evidence"}
            </Button>
          )}
        </div>
      </CardHeader>

      {evidence && (
        <CardContent className="space-y-3 pt-0">
          {/* Summary bar */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>{evidence.total_citations} citation(s) • Max 6 per session</span>
              {evidence.retrieval_confidence && confidenceBadge(evidence.retrieval_confidence)}
            </div>
            {evidence.sources_queried && evidence.sources_queried.length > 0 && (
              <div className="flex items-center gap-1">
                <Database className="h-2.5 w-2.5" />
                {evidence.sources_queried.map(s => (
                  <Badge key={s} variant="outline" className="text-[7px] px-1">{s}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* Medication Evidence */}
          <Collapsible open={sections.meds} onOpenChange={o => setSections(p => ({ ...p, meds: o }))}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold w-full text-left hover:text-primary transition-colors">
              {sections.meds ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <ScrollText className="h-3.5 w-3.5" /> Medication Evidence
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-5">
              {evidence.medication_evidence.map((me, i) => (
                <div key={i} className="p-2 rounded-md border border-border text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{me.drug}</span>
                    {me.ai_generated && (
                      <Badge variant="outline" className="text-[7px] px-1 gap-0.5">
                        <Sparkles className="h-2 w-2" /> AI Summary
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">{me.summary}</p>
                  {me.citations.length > 0 && (
                    <div className="space-y-0.5 mt-1">
                      {me.citations.map((c, j) => (
                        <div key={j} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[7px] px-1">{c.source}</Badge>
                          {c.confidence && confidenceBadge(c.confidence)}
                          {c.title && <span className="line-clamp-1 flex-1">{c.title}</span>}
                          {c.year && <span className="shrink-0">({c.year})</span>}
                          {c.url && (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Guidelines */}
          {evidence.guidelines.length > 0 && (
            <Collapsible open={sections.guidelines} onOpenChange={o => setSections(p => ({ ...p, guidelines: o }))}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold w-full text-left hover:text-primary transition-colors">
                {sections.guidelines ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <BookOpen className="h-3.5 w-3.5" /> Clinical Guidelines
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2 pl-5">
                {evidence.guidelines.map((g, i) => (
                  <div key={i} className="p-2 rounded-md border border-border text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{g.guidance || (g as any).guideline}</span>
                      <Badge variant="outline" className="text-[8px]">{g.source}</Badge>
                    </div>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {g.summary_points.map((point, j) => (
                        <li key={j}>{point}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Drug Safety */}
          <Collapsible open={sections.safety} onOpenChange={o => setSections(p => ({ ...p, safety: o }))}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold w-full text-left hover:text-primary transition-colors">
              {sections.safety ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <Shield className="h-3.5 w-3.5" /> Drug Safety Notes
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 pl-5">
              {evidence.drug_safety.map((ds, i) => (
                <div key={i} className={`p-2 rounded-md border text-xs ${
                  ds.black_box_warning ? "border-destructive/30 bg-destructive/5" : "border-border"
                }`}>
                  <span className="font-medium">{ds.drug}</span>
                  {ds.black_box_warning && (
                    <div className="mt-1 p-1.5 rounded bg-destructive/10 text-destructive text-[10px]">
                      <strong>⚠ Black Box Warning:</strong> {ds.black_box_warning}
                    </div>
                  )}
                  {ds.dailymed_warnings && ds.dailymed_warnings.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      <span className="text-[9px] font-medium text-muted-foreground flex items-center gap-1">
                        <Database className="h-2.5 w-2.5" /> DailyMed
                      </span>
                      {ds.dailymed_warnings.map((w, j) => (
                        <p key={j} className="text-[10px] text-muted-foreground pl-3">{w}</p>
                      ))}
                    </div>
                  )}
                  {ds.high_risk_flags.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {ds.high_risk_flags.map((f, j) => (
                        <li key={j} className="flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Disclaimer */}
          <div className="text-[9px] text-muted-foreground pt-1 border-t border-border">
            Evidence is advisory only and assists clinical documentation. It does not constitute medical advice.
            AI-generated summaries are labeled with <Sparkles className="h-2 w-2 inline" />. All citations link to original sources for verification.
          </div>
        </CardContent>
      )}
    </Card>
  );
}
