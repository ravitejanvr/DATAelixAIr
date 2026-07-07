import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { RefreshCcw, Play, CheckCircle2, XCircle, Loader2, Search, ShieldCheck, Rewind, FlaskConical, Wrench } from "lucide-react";
import OntologyUploader from "@/components/terminology/OntologyUploader";

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
  
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data: d, error } = await (supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>)("get_terminology_dashboard");
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

  const [releaseFolder, setReleaseFolder] = useState("snomed/");
  const [missingPaths, setMissingPaths] = useState<string[]>([]);
  const [repairCandidates, setRepairCandidates] = useState<Array<{ from: string; to: string }>>([]);

  const createRelease = async () => {
    const folder = releaseFolder.replace(/\/+$/, "").trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/.test(folder)) {
      return toast({ title: "Invalid folder", description: "Use a path like snomed/SnomedCT_INT_20260701", variant: "destructive" });
    }
    setBusy("create");
    setMissingPaths([]);
    setRepairCandidates([]);
    try {
      const { data: r, error } = await supabase.functions.invoke("terminology-create-release", {
        body: { code_system_short_name: "snomed-ct", release_folder: folder },
      });
      // Edge function returns 409 with a JSON body when objects are missing; the
      // supabase-js client surfaces this as `error` while still parsing the body.
      const payload = (r ?? (error as unknown as { context?: { body?: unknown } })?.context?.body) as
        | { error?: string; missing?: string[]; repair_candidates?: Array<{ from: string; to: string }>; chunks_seeded?: number }
        | undefined;

      if (payload?.error === "missing_objects") {
        setMissingPaths(payload.missing ?? []);
        setRepairCandidates(payload.repair_candidates ?? []);
        toast({
          title: "Missing objects — no jobs seeded",
          description: `${payload.missing?.length ?? 0} chunk(s) not found. ${payload.repair_candidates?.length ?? 0} can be auto-repaired.`,
          variant: "destructive",
        });
        return;
      }
      if (error) throw error;
      toast({ title: "Release created", description: `${payload?.chunks_seeded ?? 0} chunks queued from ontology/${folder}/manifest.json` });
      refresh();
    } catch (e) {
      toast({ title: "Create failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const repairPaths = async () => {
    const folder = releaseFolder.replace(/\/+$/, "").trim();
    if (!folder) return;
    setBusy("repair");
    try {
      const { data: r, error } = await supabase.functions.invoke("terminology-repair-paths", {
        body: { release_folder: folder },
      });
      if (error) throw error;
      const rep = r as { moved?: string[]; failed?: Array<{ from: string; to: string; error: string }>; jobs_reset_to_pending?: number };
      toast({
        title: (rep.failed?.length ?? 0) === 0 ? "Repair complete" : "Repair partially failed",
        description: `Moved ${rep.moved?.length ?? 0} · failed ${rep.failed?.length ?? 0} · reset ${rep.jobs_reset_to_pending ?? 0} jobs`,
        variant: (rep.failed?.length ?? 0) === 0 ? "default" : "destructive",
      });
      setMissingPaths([]);
      setRepairCandidates([]);
      refresh();
    } catch (e) {
      toast({ title: "Repair failed", description: String(e), variant: "destructive" });
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
      const { data: r, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)("terminology_search", { q: query, limit_n: 15 });
      if (error) throw error;
      setHits((r ?? []) as SearchHit[]);
    } catch (e) {
      toast({ title: "Search failed", description: String(e), variant: "destructive" });
    }
  };

  const verifyRelease = async (releaseId: string) => {
    setBusy(`verify:${releaseId}`);
    try {
      const { data: r, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "terminology_verify_release", { p_release_id: releaseId }
      );
      if (error) throw error;
      const report = r as { ok: boolean; counts?: unknown; issues?: unknown };
      toast({
        title: report.ok ? "Verification passed" : "Verification failed",
        description: JSON.stringify(report.issues ?? report),
        variant: report.ok ? "default" : "destructive",
      });
    } catch (e) {
      toast({ title: "Verify failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const rollbackRelease = async (releaseId: string) => {
    if (!confirm(`Rollback: make release ${releaseId} the active one?`)) return;
    setBusy(`rollback:${releaseId}`);
    try {
      const { data: r, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "terminology_rollback_release", { p_release_id: releaseId }
      );
      if (error) throw error;
      toast({ title: "Rollback complete", description: JSON.stringify(r).slice(0, 200) });
      refresh();
    } catch (e) {
      toast({ title: "Rollback failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  const runE2ETest = async () => {
    setBusy("e2e");
    try {
      const { data: r, error } = await supabase.functions.invoke("terminology-e2e-test", {});
      if (error) throw error;
      const report = r as { ok?: boolean; summary?: unknown; error?: string };
      toast({
        title: report.ok ? "E2E test passed" : "E2E test failed",
        description: report.error ?? JSON.stringify(report.summary),
        variant: report.ok ? "default" : "destructive",
      });
      console.log("[terminology-e2e-test]", report);
    } catch (e) {
      toast({ title: "E2E invoke failed", description: String(e), variant: "destructive" });
    } finally { setBusy(null); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Terminology Administration</h1>
          <p className="text-sm text-muted-foreground">SNOMED CT releases, import queue, and search index health.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runE2ETest} disabled={busy === "e2e"}>
            {busy === "e2e" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FlaskConical className="h-4 w-4 mr-2" />}
            Run E2E test
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
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
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-muted-foreground font-mono">
                      {Object.entries(r.row_counts ?? {}).map(([k, v]) => `${k}: ${Number(v).toLocaleString()}`).join(" · ") || "no rows loaded"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => verifyRelease(r.id)} disabled={busy === `verify:${r.id}`}>
                        {busy === `verify:${r.id}`
                          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Verify
                      </Button>
                      {!isActive && r.status === "archived" && (
                        <Button size="sm" variant="ghost" onClick={() => rollbackRelease(r.id)} disabled={busy === `rollback:${r.id}`}>
                          {busy === `rollback:${r.id}`
                            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            : <Rewind className="h-4 w-4 mr-2" />}
                          Rollback to this
                        </Button>
                      )}
                      {!isActive && doneChunks === totalChunks && totalChunks > 0 && failedChunks === 0 && r.status !== "archived" && (
                        <Button size="sm" onClick={() => promote(r.id)} disabled={busy === `promote:${r.id}`}>
                          {busy === `promote:${r.id}`
                            ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Promote to active
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upload chunks */}
      <OntologyUploader />

      {/* Create release */}
      <Card>
        <CardHeader><CardTitle className="text-base">Register new release</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Enter the release folder inside the <code>ontology</code> bucket where you uploaded
            <code> manifest.json</code> and the <code>*.ndjson.gz</code> chunks. The manifest is
            read from Storage — no copy/paste required.
          </p>
          <Input
            value={releaseFolder}
            onChange={(e) => setReleaseFolder(e.target.value)}
            placeholder="snomed/SnomedCT_INT_20260701"
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={createRelease} disabled={busy === "create" || !releaseFolder.trim()}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create release from folder
            </Button>
            <Button
              variant="outline"
              onClick={repairPaths}
              disabled={busy === "repair" || !releaseFolder.trim()}
              title="Move any misplaced chunks into the folder the manifest expects and reset failed jobs"
            >
              {busy === "repair" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wrench className="h-4 w-4 mr-2" />}
              Repair paths &amp; resume
            </Button>
          </div>
          {missingPaths.length > 0 && (
            <div className="border border-destructive/40 rounded p-2 text-xs space-y-1">
              <div className="text-destructive font-medium">
                {missingPaths.length} object(s) missing at expected paths.
                {repairCandidates.length > 0 && ` ${repairCandidates.length} auto-repair candidate(s) found one level up — click Repair paths.`}
              </div>
              <ul className="font-mono text-[11px] text-muted-foreground max-h-32 overflow-auto">
                {missingPaths.slice(0, 8).map((p) => <li key={p}>· {p}</li>)}
                {missingPaths.length > 8 && <li>… +{missingPaths.length - 8} more</li>}
              </ul>
            </div>
          )}
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
