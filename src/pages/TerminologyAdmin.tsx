import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { RefreshCcw, Play, CheckCircle2, XCircle, Loader2, Search } from "lucide-react";

type Release = {
  id: string;
  code_system_id: string;
  release_identifier: string;
  status: string;
  effective_date: string | null;
  created_at: string;
  loaded_at: string | null;
  activated_at: string | null;
  row_counts: Record<string, number>;
};

type JobRollup = {
  release_id: string;
  status: string;
  chunk_count: number;
  loaded_rows: number;
  expected_rows: number;
};

type Dashboard = {
  code_systems: Array<{ id: string; short_name: string; name: string; active_release_id: string | null }>;
  releases: Release[];
  jobs: JobRollup[];
  counts: Record<string, number>;
};

type SearchHit = {
  code: string;
  preferred_term: string;
  matched_term: string;
  language: string;
  source: string;
  score: number;
};

export default function TerminologyAdmin() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [manifestJson, setManifestJson] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: d, error } = await supabase.rpc("get_terminology_dashboard");
      if (error) throw error;
      setData(d as Dashboard);
    } catch (e) {
      toast({ title: "Load failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const createRelease = async () => {
    let manifest: unknown;
    try { manifest = JSON.parse(manifestJson); }
    catch { return toast({ title: "Invalid JSON", variant: "destructive" }); }
    setBusy("create");
    try {
      const { data: r, error } = await supabase.functions.invoke("terminology-create-release", {
        body: { code_system_short_name: "snomed-ct", manifest },
      });
      if (error) throw error;
      toast({ title: "Release created", description: `${(r as { chunks_seeded: number }).chunks_seeded} chunks queued` });
      setManifestJson("");
      refresh();
    } catch (e) {
      toast({ title: "Create failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const loadOne = async () => {
    setBusy("load");
    try {
      const { data: r, error } = await supabase.functions.invoke("terminology-load-chunk", {});
      if (error) throw error;
      toast({ title: "Chunk loaded", description: JSON.stringify(r).slice(0, 200) });
      refresh();
    } catch (e) {
      toast({ title: "Load failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const promote = async (releaseId: string) => {
    if (!confirm(`Promote release ${releaseId} to active?`)) return;
    setBusy(`promote:${releaseId}`);
    try {
      const { data: r, error } = await supabase.functions.invoke("terminology-promote-release", {
        body: { release_id: releaseId },
      });
      if (error) throw error;
      toast({ title: "Promoted", description: JSON.stringify((r as { counts: unknown }).counts) });
      refresh();
    } catch (e) {
      toast({ title: "Promote failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const runSearch = async () => {
    if (query.length < 2) return;
    try {
      const { data: r, error } = await supabase.rpc("terminology_search", { q: query, limit_n: 15 });
      if (error) throw error;
      setHits((r ?? []) as SearchHit[]);
    } catch (e) {
      toast({ title: "Search failed", description: String(e), variant: "destructive" });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Terminology Administration</h1>
          <p className="text-sm text-muted-foreground">SNOMED CT releases, import queue, and search index health.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Counts */}
      <Card>
        <CardHeader><CardTitle className="text-base">Index counts</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {data?.counts && Object.entries(data.counts).map(([k, v]) => (
              <div key={k} className="rounded border p-3">
                <div className="text-xs text-muted-foreground">{k}</div>
                <div className="text-xl font-mono">{Number(v).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Releases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Releases</span>
            <Button size="sm" variant="secondary" onClick={loadOne} disabled={busy === "load"}>
              {busy === "load" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Load next chunk
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.releases.length === 0 && <div className="text-sm text-muted-foreground">No releases yet.</div>}
            {data?.releases.map((r) => {
              const jobs = data.jobs.filter((j) => j.release_id === r.id);
              const totalChunks = jobs.reduce((a, b) => a + b.chunk_count, 0);
              const doneChunks = jobs.filter((j) => j.status === "done").reduce((a, b) => a + b.chunk_count, 0);
              const failedChunks = jobs.filter((j) => j.status === "failed").reduce((a, b) => a + b.chunk_count, 0);
              const pct = totalChunks ? Math.round((doneChunks / totalChunks) * 100) : 0;
              const isActive = data.code_systems.some((cs) => cs.active_release_id === r.id);
              return (
                <div key={r.id} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <code className="text-sm">{r.release_identifier}</code>
                      <Badge variant={isActive ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                        {isActive ? "active" : r.status}
                      </Badge>
                      {failedChunks > 0 && <Badge variant="destructive">{failedChunks} failed</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{r.effective_date ?? "—"}</span>
                      <span>·</span>
                      <span>{doneChunks}/{totalChunks} chunks · {pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground font-mono">
                      {Object.entries(r.row_counts ?? {}).map(([k, v]) => `${k}: ${Number(v).toLocaleString()}`).join(" · ") || "no rows loaded"}
                    </div>
                    {!isActive && doneChunks === totalChunks && totalChunks > 0 && failedChunks === 0 && (
                      <Button size="sm" onClick={() => promote(r.id)} disabled={busy === `promote:${r.id}`}>
                        {busy === `promote:${r.id}`
                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Promote to active
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create release */}
      <Card>
        <CardHeader><CardTitle className="text-base">Register new release</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Paste the <code>manifest.json</code> emitted by <code>scripts/snomed-preprocess.mjs</code>.
            Chunks must already be uploaded to the <code>ontology</code> bucket at the paths listed inside.
          </p>
          <Textarea rows={6} value={manifestJson} onChange={(e) => setManifestJson(e.target.value)} placeholder='{ "release_identifier": "SnomedCT_INT_20250701", "chunks": [...] }' className="font-mono text-xs" />
          <Button onClick={createRelease} disabled={busy === "create" || !manifestJson.trim()}>
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create release + seed queue
          </Button>
        </CardContent>
      </Card>

      {/* Search verification */}
      <Card>
        <CardHeader><CardTitle className="text-base">Search verification</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g., pneumonia" onKeyDown={(e) => e.key === "Enter" && runSearch()} />
            <Button onClick={runSearch} variant="outline">
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </div>
          {hits.length > 0 && (
            <div className="border rounded divide-y">
              {hits.map((h, i) => (
                <div key={i} className="p-2 flex items-center justify-between text-sm">
                  <div>
                    <div>{h.matched_term}</div>
                    <div className="text-xs text-muted-foreground">{h.preferred_term} · {h.source} · {h.language}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">{h.code}</code>
                    <Badge variant="outline">{h.score.toFixed(3)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {query.length >= 2 && hits.length === 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-2"><XCircle className="h-3 w-3" /> No results</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
