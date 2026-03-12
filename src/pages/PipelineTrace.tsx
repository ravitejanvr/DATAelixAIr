/**
 * Pipeline Execution Trace — Full Wave-by-Wave Visualization + Context Processing Map
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Activity, Clock, Zap, GitBranch, Eye } from "lucide-react";
import { runPipelineTrace, BENCHMARK_CASES_V5, type PipelineTrace, type WaveTrace } from "@/services/pipeline_trace";
import type { LineageReport, FieldLineageEntry, PipelineStage } from "@/services/clinical_pipeline/lineage_tracker";
import SEO from "@/components/SEO";

const STAGE_LABELS: Record<PipelineStage, string> = {
  pcie: "PCIE",
  context_enrichment: "Context",
  ddx: "DDX",
  physiology: "Physio",
  evidence: "Evidence",
  bayesian: "Bayes",
  guideline: "Guide",
  hypothesis: "Hypo",
  safety: "Safety",
  uncertainty: "Uncert",
  soap: "SOAP",
  cockpit: "Cockpit",
};

const STAGE_ORDER: PipelineStage[] = [
  "pcie", "context_enrichment", "ddx", "physiology", "evidence",
  "bayesian", "guideline", "hypothesis", "safety", "uncertainty", "soap", "cockpit",
];

function ContextProcessingMap({ lineage }: { lineage: LineageReport }) {
  const [filter, setFilter] = useState<"all" | "unprocessed" | "dropped">("all");

  const filtered = lineage.fields.filter(f => {
    if (filter === "unprocessed") return f.unprocessed_passthrough;
    if (filter === "dropped") return f.dropped_at !== null;
    return true;
  });

  return (
    <Card className="border-l-4 border-l-chart-3">
      <CardHeader className="py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-chart-3" />
            Context Processing Map — Field Lineage
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{lineage.coverage_pct}% coverage</Badge>
            <Badge variant="outline" className="text-xs">{lineage.fields_consumed_by_reasoning}/{lineage.total_fields} fields consumed</Badge>
            {lineage.unprocessed_fields.length > 0 && (
              <Badge variant="destructive" className="text-xs">{lineage.unprocessed_fields.length} unprocessed</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex gap-2">
          {(["all", "unprocessed", "dropped"] as const).map(f => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="text-xs h-7">
              {f === "all" ? `All (${lineage.total_fields})` : f === "unprocessed" ? `Unprocessed (${lineage.unprocessed_fields.length})` : `Dropped (${lineage.dropped_fields.length})`}
            </Button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1.5 pr-2 sticky left-0 bg-background z-10 min-w-[140px]">Field</th>
                {STAGE_ORDER.map(s => (
                  <th key={s} className="text-center py-1.5 px-1 min-w-[44px]">
                    <span className="text-[10px]">{STAGE_LABELS[s]}</span>
                  </th>
                ))}
                <th className="text-center py-1.5 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <FieldLineageRow key={f.field} entry={f} />
              ))}
            </tbody>
          </table>
        </div>

        {lineage.dropped_fields.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-destructive mb-1">Dropped Fields:</p>
            <ul className="text-xs space-y-0.5">
              {lineage.dropped_fields.map(d => (
                <li key={d.field} className="font-mono text-destructive">
                  <XCircle className="h-3 w-3 inline mr-1" />
                  <strong>{d.field}</strong> — last seen at {d.last_seen_at}, dropped at {d.dropped_at}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldLineageRow({ entry }: { entry: FieldLineageEntry }) {
  const hasValue = entry.origin_value !== undefined && entry.origin_value !== null;

  return (
    <tr className={`border-b border-muted ${entry.unprocessed_passthrough ? "bg-destructive/5" : ""}`}>
      <td className="py-1 pr-2 sticky left-0 bg-background z-10 font-semibold">{entry.field}</td>
      {STAGE_ORDER.map(stage => {
        const consumed = entry.consumed_by.includes(stage);
        const snap = entry.wave_snapshots.find(s => s.stage === stage);
        const present = snap?.present ?? false;

        return (
          <td key={stage} className="text-center py-1 px-1">
            {consumed ? (
              <span className="inline-block w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] leading-4">&#10003;</span>
            ) : present ? (
              <span className="inline-block w-4 h-4 rounded-full bg-muted text-[8px] leading-4">&#9679;</span>
            ) : (
              <span className="text-muted-foreground/30">—</span>
            )}
          </td>
        );
      })}
      <td className="text-center py-1 px-2">
        {entry.unprocessed_passthrough ? (
          <Badge variant="destructive" className="text-[9px] px-1">unprocessed</Badge>
        ) : entry.dropped_at ? (
          <Badge variant="outline" className="text-[9px] px-1 border-destructive text-destructive">dropped</Badge>
        ) : entry.influenced_output ? (
          <Badge variant="default" className="text-[9px] px-1">active</Badge>
        ) : !hasValue ? (
          <Badge variant="outline" className="text-[9px] px-1">empty</Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px] px-1">passive</Badge>
        )}
      </td>
    </tr>
  );
}

function WaveCard({ wave, index }: { wave: WaveTrace; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasGaps = wave.gaps.length > 0;

  return (
    <Card className={`border-l-4 ${hasGaps ? "border-l-destructive" : "border-l-primary"}`}>
      <CardHeader className="cursor-pointer py-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-mono flex items-center gap-2">
            {hasGaps ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-primary" />}
            {wave.wave} — {wave.label}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              <Clock className="h-3 w-3 mr-1" />{wave.duration_ms}ms
            </Badge>
            {hasGaps && <Badge variant="destructive" className="text-xs">{wave.gaps.length} gaps</Badge>}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Engines Invoked:</p>
            <div className="flex flex-wrap gap-1">
              {wave.engines_invoked.map(e => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Input Context:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">{JSON.stringify(wave.input_summary, null, 2)}</pre>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Output:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60 font-mono">{JSON.stringify(wave.output_summary, null, 2)}</pre>
          </div>
          {hasGaps && (
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">Gaps / Empty Outputs:</p>
              <ul className="text-xs space-y-0.5">
                {wave.gaps.map((g, i) => (
                  <li key={i} className="text-destructive font-mono flex items-center gap-1">
                    <XCircle className="h-3 w-3 flex-shrink-0" /> {g}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function PipelineTracePage() {
  const [selectedCase, setSelectedCase] = useState("3");
  const [trace, setTrace] = useState<PipelineTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveWaves, setLiveWaves] = useState<WaveTrace[]>([]);
  const [activeTab, setActiveTab] = useState<"waves" | "lineage">("waves");

  const runTrace = async () => {
    setLoading(true);
    setTrace(null);
    setLiveWaves([]);
    try {
      const result = await runPipelineTrace(parseInt(selectedCase), (wave) => setLiveWaves(prev => [...prev, wave]));
      setTrace(result);
    } catch (err) {
      console.error("[PipelineTrace] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayWaves = trace ? trace.waves : liveWaves;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-6xl mx-auto">
      <SEO title="Pipeline Execution Trace" description="Full wave-by-wave clinical pipeline trace with data lineage" />

      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Pipeline Execution Trace</h1>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4 flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Benchmark Case</label>
            <Select value={selectedCase} onValueChange={setSelectedCase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BENCHMARK_CASES_V5.map((bc, i) => (
                  <SelectItem key={bc.id} value={String(i)}>{bc.id}: {bc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runTrace} disabled={loading} className="w-full sm:w-auto">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><Zap className="h-4 w-4 mr-2" />Execute Trace</>}
          </Button>
        </CardContent>
      </Card>

      {trace && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Case</p>
                <p className="font-semibold">{trace.case_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Latency</p>
                <p className="font-mono font-semibold">{trace.total_ms}ms</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Diagnoses</p>
                <p className="font-semibold">{trace.diagnoses_generated.length > 0 ? trace.diagnoses_generated.join(", ") : "None"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lineage Coverage</p>
                <p className={`font-semibold ${(trace.lineage?.coverage_pct ?? 0) < 70 ? "text-destructive" : "text-primary"}`}>
                  {trace.lineage?.coverage_pct ?? 0}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Gaps</p>
                <p className={`font-semibold ${trace.all_gaps.length > 0 ? "text-destructive" : "text-primary"}`}>{trace.all_gaps.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Danger Detected</p>
                <Badge variant={trace.danger_detected ? "destructive" : "secondary"}>{trace.danger_detected ? "Yes" : "No"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unprocessed Fields</p>
                <p className={`font-semibold ${(trace.lineage?.unprocessed_fields.length ?? 0) > 0 ? "text-destructive" : "text-primary"}`}>
                  {trace.lineage?.unprocessed_fields.length ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Waves Executed</p>
                <p className="font-mono">{trace.waves.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(trace || displayWaves.length > 0) && (
        <div className="flex gap-2 mb-4">
          <Button size="sm" variant={activeTab === "waves" ? "default" : "outline"} onClick={() => setActiveTab("waves")}>
            <Eye className="h-4 w-4 mr-1" /> Wave Execution
          </Button>
          <Button size="sm" variant={activeTab === "lineage" ? "default" : "outline"} onClick={() => setActiveTab("lineage")} disabled={!trace?.lineage}>
            <GitBranch className="h-4 w-4 mr-1" /> Context Processing Map
          </Button>
        </div>
      )}

      {activeTab === "lineage" && trace?.lineage && (
        <div className="space-y-4">
          <ContextProcessingMap lineage={trace.lineage} />
          <Card className="border-l-4 border-l-accent">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-mono">Adapter Field Audit (toClinicalContext)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1 pr-3">Field</th>
                      <th className="text-left py-1 pr-3">Unified Value</th>
                      <th className="text-left py-1 pr-3">ClinicalContext Value</th>
                      <th className="text-left py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.adapter_field_audit.map(row => (
                      <tr key={row.field} className="border-b border-muted">
                        <td className="py-1 pr-3 font-semibold">{row.field}</td>
                        <td className="py-1 pr-3 max-w-[200px] truncate">{JSON.stringify(row.unified_value)}</td>
                        <td className="py-1 pr-3 max-w-[200px] truncate">{JSON.stringify(row.clinical_value)}</td>
                        <td className="py-1">
                          <Badge variant={row.status === "mapped" ? "default" : "destructive"} className="text-xs">
                            {row.status === "mapped" ? "mapped" : row.status === "dropped" ? "DROPPED" : "empty"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "waves" && displayWaves.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Wave-by-Wave Execution</h2>
          {displayWaves.map((w, i) => <WaveCard key={`${w.wave}-${i}`} wave={w} index={i} />)}
        </div>
      )}

      {trace && trace.all_gaps.length > 0 && (
        <Card className="mt-6 border-destructive">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> All Pipeline Gaps ({trace.all_gaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="text-xs space-y-1 font-mono">
              {trace.all_gaps.map((g, i) => <li key={i} className="text-destructive">• {g}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {trace && (
        <details className="mt-6">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Raw Pipeline Result (JSON)</summary>
          <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-auto max-h-96 font-mono">{JSON.stringify(trace.final_result, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
