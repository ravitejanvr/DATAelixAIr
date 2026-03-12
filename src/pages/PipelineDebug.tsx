/**
 * Pipeline Debug Dashboard
 *
 * Admin tool for inspecting pipeline execution results:
 * context object, DDX, guidelines, medications, safety, confidence, SOAP.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Clock, AlertTriangle, CheckCircle, Activity, FileText } from "lucide-react";
import SEO from "@/components/SEO";

interface PipelineLog {
  id: string;
  visit_id: string;
  engine_name: string;
  status: string;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export default function PipelineDebug() {
  const [visitId, setVisitId] = useState("");
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    if (!visitId.trim()) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("pipeline_execution_logs" as any)
        .select("*")
        .eq("visit_id", visitId.trim())
        .order("created_at", { ascending: true });
      setLogs((data as PipelineLog[]) || []);
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadRecent = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("pipeline_execution_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as PipelineLog[]) || []);
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
    if (status === "failed") return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    if (status === "started") return <Activity className="h-3.5 w-3.5 text-blue-600" />;
    return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400",
      failed: "bg-destructive/10 text-destructive",
      started: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
      skipped: "bg-muted text-muted-foreground",
    };
    return <Badge className={`${colors[status] || "bg-muted text-muted-foreground"} text-[10px]`}>{status}</Badge>;
  };

  // Group logs by visit_id
  const grouped = logs.reduce<Record<string, PipelineLog[]>>((acc, log) => {
    const key = log.visit_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  // Summary stats
  const totalRuns = Object.keys(grouped).length;
  const avgLatency = logs.filter(l => l.engine_name === "pipeline_total" && l.latency_ms)
    .reduce((sum, l, _, arr) => sum + (l.latency_ms || 0) / arr.length, 0);
  const failures = logs.filter(l => l.status === "failed").length;

  return (
    <>
      <SEO title="Pipeline Debug — DATAelixAIr" description="Debug clinical pipeline execution." />
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pipeline Debug Dashboard</h2>
          <p className="text-sm text-muted-foreground">Inspect clinical pipeline execution logs and latency.</p>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter visit ID..."
            value={visitId}
            onChange={e => setVisitId(e.target.value)}
            onKeyDown={e => e.key === "Enter" && loadLogs()}
            className="max-w-sm"
          />
          <Button onClick={loadLogs} disabled={loading} size="sm">
            <Search className="h-3.5 w-3.5 mr-1" /> Search
          </Button>
          <Button onClick={loadRecent} disabled={loading} variant="outline" size="sm">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Clock className="h-3.5 w-3.5 mr-1" />}
            Recent
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Pipeline Runs</p>
            <p className="text-2xl font-bold">{totalRuns}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Avg Latency</p>
            <p className="text-2xl font-bold">{Math.round(avgLatency)}ms</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Total Stages</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 pb-3">
            <p className="text-[10px] text-muted-foreground">Failures</p>
            <p className="text-2xl font-bold text-destructive">{failures}</p>
          </CardContent></Card>
        </div>

        {/* Logs Table */}
        {logs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Execution Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2 pr-3">Engine</th>
                      <th className="text-left py-2 pr-3">Visit ID</th>
                      <th className="text-right py-2 pr-3">Latency</th>
                      <th className="text-left py-2 pr-3">Error</th>
                      <th className="text-left py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} className="border-b border-muted/50 hover:bg-muted/30">
                        <td className="py-1.5 pr-3 flex items-center gap-1.5">
                          {statusIcon(log.status)}
                          {statusBadge(log.status)}
                        </td>
                        <td className="py-1.5 pr-3 font-mono">{log.engine_name}</td>
                        <td className="py-1.5 pr-3 font-mono text-muted-foreground truncate max-w-[120px]">{log.visit_id}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {log.latency_ms != null ? (
                            <span className={log.latency_ms > 3000 ? "text-amber-600" : "text-emerald-600"}>
                              {log.latency_ms}ms
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-1.5 pr-3 text-destructive truncate max-w-[200px]">{log.error_message || "—"}</td>
                        <td className="py-1.5 text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {logs.length === 0 && !loading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No pipeline logs found. Search by visit ID or load recent runs.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
