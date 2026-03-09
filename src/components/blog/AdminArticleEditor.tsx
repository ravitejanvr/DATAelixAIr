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
  FileText, Search, Sparkles
} from "lucide-react";
import { categories, generateSlug, type ArticleCategory, type ArticleStatus, type SourceType } from "@/lib/blog-data";

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

  const save = async () => {
    if (!editing?.title) { toast({ title: "Title required", variant: "destructive" }); return; }
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
    const { error } = await (supabase.from("blog_articles").update({
      status: "published",
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      publish_date: new Date().toISOString().split("T")[0],
    }).eq("id", id) as any);
    if (error) { toast({ title: "Approve failed", variant: "destructive" }); return; }
    toast({ title: "Article published" });

    // Index for RAG
    const article = articles.find((a) => a.id === id);
    if (article) {
      await (supabase.from("blog_article_index").upsert({
        article_id: id,
        title: article.title,
        summary: article.summary,
        keywords: article.keywords,
        category: article.category,
        full_text: `${article.title}\n${article.summary}\n${article.content}\n${(article.key_findings || []).join("\n")}`,
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

  const generateDraft = async () => {
    setGenerating(true);
    try {
      // Fetch research first
      const { data: researchData } = await supabase.functions.invoke("fetch-research", {
        body: { query: "clinical AI healthcare safety", max_results: 3 },
      });

      if (!researchData?.papers?.length) {
        toast({ title: "No research found", variant: "destructive" });
        setGenerating(false);
        return;
      }

      const paper = researchData.papers[0];

      // Generate draft
      const { data: draftData, error } = await supabase.functions.invoke("draft-article", {
        body: { paper },
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
        category: draft.category || "Research & Evidence",
        keywords: draft.keywords || [],
        key_findings: draft.key_findings || [],
        clinical_implications: draft.clinical_implications || "",
        source_type: "Research",
        source_name: paper.source || paper.journal,
        source_url: paper.url,
        source_journal: paper.journal,
        source_year: paper.year,
        author: (paper.authors || []).slice(0, 3).join(", ") || "Research Team",
        status: "draft",
      });

      toast({ title: "AI draft generated", description: "Review and edit before publishing." });
    } catch (e) {
      toast({ title: "Generation error", variant: "destructive" });
    }
    setGenerating(false);
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
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Meta Title</label>
            <Input value={editing.meta_title || ""} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase">Meta Description</label>
            <Input value={editing.meta_description || ""} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="h-8 text-xs" />
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
          <Button size="sm" variant="outline" onClick={generateDraft} disabled={generating}>
            {generating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            AI Generate
          </Button>
          <Button size="sm" onClick={() => setEditing({ ...emptyArticle, created_by: user?.id })}>
            <Plus className="h-3 w-3 mr-1" /> New Article
          </Button>
        </div>
      </div>

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

      <div className="space-y-2">
        {filteredArticles.map((a) => (
          <Card key={a.id}>
            <CardContent className="py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {statusBadge(a.status)}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {a.category} · {a.author || "—"} · {a.source_type}
                  {a.publish_date && ` · ${new Date(a.publish_date).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(a)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                {a.status === "draft" && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600" onClick={() => approve(a.id)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
                {a.status === "published" && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => archive(a.id)}>
                    <Archive className="h-3 w-3" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteArticle(a.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredArticles.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No articles found.</p>
        )}
      </div>
    </div>
  );
}
