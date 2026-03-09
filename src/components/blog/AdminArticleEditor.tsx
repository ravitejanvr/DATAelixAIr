import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Check, Trash2, Loader2, BookOpen, Eye, Archive,
  FileText, Search, Sparkles, Radar, HeartPulse, Shield, Globe
} from "lucide-react";
import BlogHealthChecker from "@/components/blog/BlogHealthChecker";
import { categories, generateSlug, type ArticleCategory, type ArticleStatus, type SourceType } from "@/lib/blog-data";

/** Trusted source whitelist */
const TRUSTED_SOURCES = [
  { value: "nature.com", label: "Nature Digital Medicine" },
  { value: "mckinsey.com", label: "McKinsey Health" },
  { value: "who.int", label: "WHO Guidelines" },
  { value: "nhsx.nhs.uk", label: "NHS AI Lab" },
  { value: "sciencedirect.com", label: "ScienceDirect" },
  { value: "gov.health", label: "Government Health Reports" },
];

interface DbArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  keywords: string[];
  source_type: string;
  related_platform_features: string[];
  author: string;
  publish_date: string | null;
  reading_time_min: number;
  status: string;
  source_name: string | null;
  source_url: string | null;
  source_journal: string | null;
  source_year: number | null;
  key_findings: string[];
  clinical_implications: string | null;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

const emptyArticle: Partial<DbArticle> = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  category: "Research & Evidence",
  keywords: [],
  source_type: "Editorial",
  related_platform_features: [],
  author: "",
  reading_time_min: 5,
  status: "draft",
  source_name: "",
  source_url: "",
  source_journal: "",
  source_year: null,
  key_findings: [],
  clinical_implications: "",
  meta_title: "",
  meta_description: "",
};

export default function AdminArticleEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [articles, setArticles] = useState<DbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<DbArticle> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  useEffect(() => { loadArticles(); }, []);

  const loadArticles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_articles")
      .select("*")
      .order("created_at", { ascending: false }) as any;
    if (error) {
      toast({ title: "Failed to load articles", variant: "destructive" });
    } else {
      setArticles(data || []);
    }
    setLoading(false);
  };

  const validateForPublish = (article: Partial<DbArticle>): string[] => {
    const errors: string[] = [];
    if (!article.title?.trim()) errors.push("Title is required");
    if (!article.slug?.trim()) errors.push("Slug is required");
    if (!article.category?.trim()) errors.push("Category is required");
    if (!article.summary?.trim()) errors.push("Summary is required");
    if (!article.content?.trim()) errors.push("Content is required");
    if (!article.publish_date) errors.push("Publish date is required");
    return errors;
  };

  const save = async () => {
    if (!editing?.title) { toast({ title: "Title required", variant: "destructive" }); return; }

    if (editing.status === "published") {
      const errors = validateForPublish(editing);
      if (errors.length > 0) {
        toast({ title: "Cannot publish", description: errors.join(", "), variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    const slug = editing.slug || generateSlug(editing.title);
    const payload = {
      ...editing,
      slug,
      publish_date: editing.publish_date || new Date().toISOString().split("T")[0],
      created_by: editing.created_by || user?.id,
    };

    let saveError: any;
    if (editing.id) {
      const { error: e } = await (supabase.from("blog_articles") as any).update(payload).eq("id", editing.id);
      saveError = e;
    } else {
      const { error: e } = await (supabase.from("blog_articles") as any).insert([payload]);
      saveError = e;
    }

    if (saveError) {
      toast({ title: "Save failed", description: saveError.message, variant: "destructive" });
    } else {
      toast({ title: editing.id ? "Article updated" : "Article created" });
      setEditing(null);
      loadArticles();
    }
    setSaving(false);
  };

  const approve = async (id: string) => {
    const article = articles.find((a) => a.id === id);
    if (article) {
      const errors = validateForPublish(article);
      if (errors.length > 0) {
        toast({ title: "Cannot publish", description: errors.join(", "), variant: "destructive" });
        return;
      }
    }

    const { error } = await (supabase.from("blog_articles").update({
      status: "published",
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      publish_date: new Date().toISOString().split("T")[0],
    }).eq("id", id) as any);
    if (error) { toast({ title: "Approve failed", variant: "destructive" }); return; }
    toast({ title: "Article published" });

    const toIndex = articles.find((a) => a.id === id);
    if (toIndex) {
      await (supabase.from("blog_article_index").upsert({
        article_id: id,
        title: toIndex.title,
        summary: toIndex.summary,
        keywords: toIndex.keywords,
        category: toIndex.category,
        full_text: `${toIndex.title}\n${toIndex.summary}\n${toIndex.content}\n${(toIndex.key_findings || []).join("\n")}`,
      }, { onConflict: "article_id" }) as any);
    }
    loadArticles();
  };

  const archive = async (id: string) => {
    await (supabase.from("blog_articles").update({ status: "archived" }).eq("id", id) as any);
    toast({ title: "Article archived" });
    loadArticles();
  };

  const deleteArticle = async (id: string) => {
    await (supabase.from("blog_articles").delete().eq("id", id) as any);
    toast({ title: "Article deleted" });
    loadArticles();
  };

  const [radarRunning, setRadarRunning] = useState(false);

  const generateDraft = async () => {
    setGenerating(true);
    try {
      // Build search query based on selected source
      const sourceConfig = TRUSTED_SOURCES.find(s => s.value === sourceFilter);
      const searchTerm = sourceFilter !== "all" && sourceConfig
        ? `site:${sourceFilter} clinical AI healthcare`
        : "clinical AI healthcare safety";

      const { data: researchData } = await supabase.functions.invoke("fetch-research", {
        body: { query: searchTerm, max_results: 3 },
      });

      if (!researchData?.papers?.length) {
        toast({ title: "No research found from this source", description: "Try a different trusted source.", variant: "destructive" });
        setGenerating(false);
        return;
      }

      const paper = researchData.papers[0];
      const { data: draftData, error } = await supabase.functions.invoke("draft-article", {
        body: { paper, source_filter: sourceFilter !== "all" ? sourceFilter : undefined },
      });

      if (error || !draftData?.success) {
        toast({ title: "Draft generation failed", description: draftData?.error || error?.message, variant: "destructive" });
        setGenerating(false);
        return;
      }

      const draft = draftData.draft;
      setEditing({
        ...emptyArticle,
        title: draft.title || paper.title,
        slug: generateSlug(draft.title || paper.title),
        summary: draft.summary || "",
        content: draft.content || "",
        category: draft.category || "Research & Evidence",
        keywords: draft.keywords || [],
        key_findings: draft.key_findings || [],
        clinical_implications: draft.clinical_implications || "",
        source_type: "Research",
        source_name: sourceConfig?.label || paper.source || paper.journal,
        source_url: paper.url,
        source_journal: paper.journal,
        source_year: paper.year,
        author: (paper.authors || []).slice(0, 3).join(", ") || "Research Team",
        status: "draft",
        meta_title: draft.meta_title || "",
        meta_description: draft.meta_description || "",
        reading_time_min: draft.reading_time_min || 5,
        publish_date: draft.publish_date || new Date().toISOString().split("T")[0],
      });

      toast({ title: "AI draft generated", description: `Source: ${sourceConfig?.label || "All trusted sources"}. Review and edit before publishing.` });
    } catch (e) {
      toast({ title: "Generation error", variant: "destructive" });
    }
    setGenerating(false);
  };

  const runResearchRadar = async () => {
    setRadarRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("research-radar", {
        body: { query: "clinical AI healthcare patient safety digital health", max_results: 6 },
      });

      if (error || !data?.success) {
        toast({ title: "Research Radar failed", description: data?.error || error?.message, variant: "destructive" });
      } else {
        const drafted = (data.processed || []).filter((p: any) => p.status === "drafted").length;
        const skipped = (data.processed || []).filter((p: any) => p.status === "skipped").length;
        toast({
          title: "Research Radar complete",
          description: `${drafted} new drafts created, ${skipped} skipped (existing). ${data.total_fetched} papers scanned.`,
        });
        loadArticles();
      }
    } catch (e) {
      toast({ title: "Radar error", variant: "destructive" });
    }
    setRadarRunning(false);
  };

  const filteredArticles = articles.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const statusBadge = (status: string) => {
    if (status === "published") return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 text-[9px]">Published</Badge>;
    if (status === "archived") return <Badge className="bg-muted text-muted-foreground text-[9px]">Archived</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 text-[9px]">Draft</Badge>;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // Editor view
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{editing.id ? "Edit Article" : "New Article"}</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Title</label>
            <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value, slug: generateSlug(e.target.value) })} />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Category</label>
            <Select value={editing.category || ""} onValueChange={(v) => setEditing({ ...editing, category: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source Type</label>
            <Select value={editing.source_type || "Editorial"} onValueChange={(v) => setEditing({ ...editing, source_type: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Research", "Editorial", "Clinical Insight", "Industry Analysis"].map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Author</label>
            <Input value={editing.author || ""} onChange={(e) => setEditing({ ...editing, author: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Reading Time (min)</label>
            <Input type="number" value={editing.reading_time_min || 5} onChange={(e) => setEditing({ ...editing, reading_time_min: parseInt(e.target.value) || 5 })} className="h-8 text-xs" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Summary</label>
            <Textarea value={editing.summary || ""} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} rows={3} className="text-xs" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Content (Markdown)</label>
            <Textarea value={editing.content || ""} onChange={(e) => setEditing({ ...editing, content: e.target.value })} rows={8} className="text-xs font-mono" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Keywords (comma-separated)</label>
            <Input value={(editing.keywords || []).join(", ")} onChange={(e) => setEditing({ ...editing, keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })} className="h-8 text-xs" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Key Findings (one per line)</label>
            <Textarea value={(editing.key_findings || []).join("\n")} onChange={(e) => setEditing({ ...editing, key_findings: e.target.value.split("\n").filter(Boolean) })} rows={4} className="text-xs" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Clinical Implications</label>
            <Textarea value={editing.clinical_implications || ""} onChange={(e) => setEditing({ ...editing, clinical_implications: e.target.value })} rows={3} className="text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source Name</label>
            <Input value={editing.source_name || ""} onChange={(e) => setEditing({ ...editing, source_name: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Source URL</label>
            <Input value={editing.source_url || ""} onChange={(e) => setEditing({ ...editing, source_url: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Publish Date</label>
            <Input type="date" value={editing.publish_date || ""} onChange={(e) => setEditing({ ...editing, publish_date: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Status</label>
            <Select value={editing.status || "draft"} onValueChange={(v) => setEditing({ ...editing, status: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft" className="text-xs">Draft</SelectItem>
                <SelectItem value="published" className="text-xs">Published</SelectItem>
                <SelectItem value="archived" className="text-xs">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Meta Title</label>
            <Input value={editing.meta_title || ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="h-8 text-xs" placeholder="Max 60 chars" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Meta Description</label>
            <Input value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="h-8 text-xs" placeholder="Max 160 chars" />
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Articles ({articles.length})
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runResearchRadar} disabled={radarRunning}>
            {radarRunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Radar className="h-3 w-3 mr-1" />}
            Research Radar
          </Button>
          <Button size="sm" variant="outline" onClick={generateDraft} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            AI Generate
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...emptyArticle, created_by: user?.id })}>
            <Plus className="h-3 w-3 mr-1" /> New Article
          </Button>
        </div>
      </div>

      {/* Source filter for AI generation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold text-primary uppercase">Trusted Source Filter</span>
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-7 text-xs w-[200px] bg-background">
                <Globe className="h-3 w-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Trusted Sources</SelectItem>
                {TRUSTED_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-[10px] text-muted-foreground">
              AI Generate will only use whitelisted, high-credibility sources
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search articles…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 text-xs pl-8" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="draft" className="text-xs">Drafts</SelectItem>
            <SelectItem value="published" className="text-xs">Published</SelectItem>
            <SelectItem value="archived" className="text-xs">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Title</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Category</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">Publish Date</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredArticles.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm truncate max-w-[280px]">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.author || "—"}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">{a.category}</span>
                </td>
                <td className="px-4 py-3">{statusBadge(a.status)}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {a.publish_date ? new Date(a.publish_date).toLocaleDateString() : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={() => setEditing(a)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {a.status === "draft" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" title="Publish" onClick={() => approve(a.id)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    {a.status === "published" && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Archive" onClick={() => archive(a.id)}>
                        <Archive className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" title="Delete" onClick={() => deleteArticle(a.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredArticles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No articles found.</p>
        )}
      </div>

      <BlogHealthChecker />
    </div>
  );
}
