import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lightbulb, Loader2, Sparkles, Check, Search, ExternalLink,
  Shield, Workflow, Cpu, Scale, ArrowUpRight, Clock, AlertTriangle,
  FileText, Globe, Newspaper
} from "lucide-react";

interface Insight {
  id: string;
  title: string;
  evidence_source: string;
  problem_detected: string;
  clinical_impact: string;
  suggested_improvement: string;
  priority: string;
  category: string;
  status: string;
  source_urls: string[];
  keywords: string[];
  roadmap_task: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  safety: { label: "Safety", icon: Shield, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800" },
  workflow: { label: "Workflow", icon: Workflow, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
  ai_performance: { label: "AI Performance", icon: Cpu, color: "text-violet-600 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-400 border-violet-200 dark:border-violet-800" },
  regulation: { label: "Regulation", icon: Scale, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-amber-500 text-white",
  medium: "bg-primary/80 text-primary-foreground",
  low: "bg-muted text-muted-foreground",
};

const SOURCE_ICONS: Record<string, { icon: typeof Globe; label: string }> = {
  PubMed: { icon: FileText, label: "PubMed" },
  "Europe PMC": { icon: Globe, label: "Europe PMC" },
  "FDA FAERS": { icon: Shield, label: "FDA Safety" },
  "WHO Guidelines": { icon: Globe, label: "WHO" },
  "NHS AI Lab": { icon: Newspaper, label: "NHS AI" },
};

export default function InnovationDashboard() {
  const { toast } = useToast();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingDigest, setGeneratingDigest] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [roadmapInput, setRoadmapInput] = useState("");
  const [lastRunSources, setLastRunSources] = useState<Record<string, number> | null>(null);
  const [dailySummary, setDailySummary] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("innovation_insights" as any)
      .select("*")
      .order("created_at", { ascending: false }) as any);
    if (error) toast({ title: "Failed to load insights", variant: "destructive" });
    else setInsights(data || []);
    setLoading(false);
  };

  const runAgent = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-innovation", {
        body: { generate_summary: true },
      });
      if (error || !data?.success) {
        toast({ title: "Innovation agent failed", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({
          title: "Innovation analysis complete",
          description: `${data.insights_saved} insights from ${data.sources?.total || 0} sources (PubMed, Europe PMC, FDA, WHO, NHS).`,
        });
        if (data.sources) setLastRunSources(data.sources);
        if (data.daily_summary) setDailySummary(data.daily_summary);
        load();
      }
    } catch {
      toast({ title: "Error running agent", variant: "destructive" });
    }
    setGenerating(false);
  };

  const runDailyDigest = async () => {
    setGeneratingDigest(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-innovation-summary", { body: {} });
      if (error || !data?.success) {
        toast({ title: "Digest generation failed", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({ title: "Daily digest generated", description: `${data.insights_generated} insights analyzed.` });
        if (data.daily_summary) setDailySummary(data.daily_summary);
        if (data.sources) setLastRunSources(data.sources);
        load();
      }
    } catch {
      toast({ title: "Error generating digest", variant: "destructive" });
    }
    setGeneratingDigest(false);
  };

  const approveInsight = async (id: string) => {
    await (supabase.from("innovation_insights" as any).update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
    }).eq("id", id) as any);
    toast({ title: "Insight approved" });
    load();
  };

  const dismissInsight = async (id: string) => {
    await (supabase.from("innovation_insights" as any).update({
      status: "dismissed",
      reviewed_at: new Date().toISOString(),
    }).eq("id", id) as any);
    toast({ title: "Insight dismissed" });
    load();
  };

  const convertToRoadmap = async (id: string) => {
    if (!roadmapInput.trim()) return;
    await (supabase.from("innovation_insights" as any).update({
      status: "roadmap",
      roadmap_task: roadmapInput.trim(),
      reviewed_at: new Date().toISOString(),
    }).eq("id", id) as any);
    toast({ title: "Converted to roadmap task" });
    setRoadmapInput("");
    setExpandedId(null);
    load();
  };

  const filtered = insights.filter((i) => {
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (searchQuery && !i.title.toLowerCase().includes(searchQuery.toLowerCase()) && !i.problem_detected.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const counts = {
    pending: insights.filter((i) => i.status === "pending").length,
    approved: insights.filter((i) => i.status === "approved").length,
    roadmap: insights.filter((i) => i.status === "roadmap").length,
  };

  // Count unique evidence sources
  const sourceCounts = insights.reduce((acc, i) => {
    const src = i.evidence_source || "Unknown";
    Object.keys(SOURCE_ICONS).forEach(key => {
      if (src.includes(key)) acc[key] = (acc[key] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" /> Innovation Intelligence
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            AI-generated insights from PubMed, Europe PMC, FDA, WHO &amp; NHS AI Lab
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runDailyDigest} disabled={generatingDigest}>
            {generatingDigest ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Newspaper className="h-3 w-3 mr-1" />}
            Daily Digest
          </Button>
          <Button size="sm" onClick={runAgent} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            Run Agent
          </Button>
        </div>
      </div>

      {/* Source badges */}
      {lastRunSources && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(lastRunSources).filter(([k]) => k !== "total").map(([source, count]) => {
            const config = SOURCE_ICONS[source === "pubmed" ? "PubMed" : source === "europepmc" ? "Europe PMC" : source === "fda" ? "FDA FAERS" : source === "who" ? "WHO Guidelines" : source === "nhs" ? "NHS AI Lab" : source];
            return (
              <Badge key={source} variant="outline" className="text-[9px] gap-1">
                {config ? <config.icon className="h-2.5 w-2.5" /> : null}
                {config?.label || source}: {count}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Daily summary */}
      {dailySummary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3">
            <p className="text-[9px] font-semibold text-primary uppercase mb-1.5">AI Daily Summary</p>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{dailySummary}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="py-2.5 text-center">
          <p className="text-lg font-bold text-amber-600">{counts.pending}</p>
          <p className="text-[9px] text-muted-foreground uppercase">Pending Review</p>
        </CardContent></Card>
        <Card><CardContent className="py-2.5 text-center">
          <p className="text-lg font-bold text-emerald-600">{counts.approved}</p>
          <p className="text-[9px] text-muted-foreground uppercase">Approved</p>
        </CardContent></Card>
        <Card><CardContent className="py-2.5 text-center">
          <p className="text-lg font-bold text-primary">{counts.roadmap}</p>
          <p className="text-[9px] text-muted-foreground uppercase">Roadmap Tasks</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search insights…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 text-xs pl-8" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Categories</SelectItem>
            <SelectItem value="safety" className="text-xs">Safety</SelectItem>
            <SelectItem value="workflow" className="text-xs">Workflow</SelectItem>
            <SelectItem value="ai_performance" className="text-xs">AI Performance</SelectItem>
            <SelectItem value="regulation" className="text-xs">Regulation</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="pending" className="text-xs">Pending</SelectItem>
            <SelectItem value="approved" className="text-xs">Approved</SelectItem>
            <SelectItem value="roadmap" className="text-xs">Roadmap</SelectItem>
            <SelectItem value="dismissed" className="text-xs">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Insights list */}
      <div className="space-y-3">
        {filtered.map((insight) => {
          const catConfig = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.ai_performance;
          const CatIcon = catConfig.icon;
          const isExpanded = expandedId === insight.id;

          return (
            <Card key={insight.id} className={`transition-all ${isExpanded ? "ring-1 ring-primary/30" : ""}`}>
              <CardContent className="py-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[9px] gap-1 ${catConfig.color}`}>
                        <CatIcon className="h-2.5 w-2.5" /> {catConfig.label}
                      </Badge>
                      <Badge className={`text-[9px] ${PRIORITY_COLORS[insight.priority] || PRIORITY_COLORS.medium}`}>
                        {insight.priority}
                      </Badge>
                      {insight.status === "roadmap" && (
                        <Badge className="text-[9px] bg-primary text-primary-foreground gap-1">
                          <ArrowUpRight className="h-2.5 w-2.5" /> Roadmap
                        </Badge>
                      )}
                      {insight.status === "dismissed" && (
                        <Badge variant="outline" className="text-[9px] text-muted-foreground">Dismissed</Badge>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                      className="text-left"
                    >
                      <h4 className="text-sm font-semibold text-foreground leading-snug hover:text-primary transition-colors">
                        {insight.title}
                      </h4>
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {new Date(insight.created_at).toLocaleDateString()}</span>
                      <span>· {insight.evidence_source}</span>
                    </p>
                  </div>

                  {insight.status === "pending" && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => approveInsight(insight.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => dismissInsight(insight.id)}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Problem Detected</p>
                        <p className="text-xs text-foreground leading-relaxed">{insight.problem_detected}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Clinical Impact</p>
                        <p className="text-xs text-foreground leading-relaxed">{insight.clinical_impact}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold text-muted-foreground uppercase mb-1">Suggested Improvement</p>
                      <p className="text-xs text-foreground leading-relaxed">{insight.suggested_improvement}</p>
                    </div>

                    {insight.source_urls?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {insight.source_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary flex items-center gap-0.5 hover:underline">
                            <ExternalLink className="h-2.5 w-2.5" /> Source {i + 1}
                          </a>
                        ))}
                      </div>
                    )}

                    {insight.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {insight.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-[8px]">{kw}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Roadmap conversion */}
                    {(insight.status === "pending" || insight.status === "approved") && (
                      <div className="flex gap-2 items-center pt-1">
                        <Textarea
                          placeholder="Describe roadmap task…"
                          value={roadmapInput}
                          onChange={(e) => setRoadmapInput(e.target.value)}
                          rows={2}
                          className="text-xs flex-1"
                        />
                        <Button size="sm" onClick={() => convertToRoadmap(insight.id)} disabled={!roadmapInput.trim()}>
                          <ArrowUpRight className="h-3 w-3 mr-1" /> Convert
                        </Button>
                      </div>
                    )}

                    {insight.roadmap_task && (
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                        <p className="text-[9px] font-semibold text-primary uppercase mb-1">Roadmap Task</p>
                        <p className="text-xs text-foreground">{insight.roadmap_task}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Lightbulb className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {insights.length === 0 ? "No insights yet. Run the Innovation Agent to scan PubMed, FDA, WHO, and NHS sources." : "No insights match your filters."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
