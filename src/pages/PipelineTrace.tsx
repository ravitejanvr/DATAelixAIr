/**
 * Pipeline Execution Trace — Full Wave-by-Wave Visualization
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle, XCircle, Activity, Clock, Zap } from "lucide-react";
import { runPipelineTrace, BENCHMARK_CASES_V5, type PipelineTrace, type WaveTrace } from "@/services/pipeline_trace";
import SEO from "@/components/SEO";

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
            {hasGaps && (
              <Badge variant="destructive" className="text-xs">{wave.gaps.length} gaps</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {/* Engines invoked */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Engines Invoked:</p>
            <div className="flex flex-wrap gap-1">
              {wave.engines_invoked.map(e => (
                <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
              ))}
            </div>
          </div>

          {/* Input */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Input Context:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 font-mono">
              {JSON.stringify(wave.input_summary, null, 2)}
            </pre>
          </div>

          {/* Output */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Output:</p>
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60 font-mono">
              {JSON.stringify(wave.output_summary, null, 2)}
            </pre>
          </div>

          {/* Gaps */}
          {hasGaps && (
            <div>
              <p className="text-xs font-semibold text-destructive mb-1">⚠ Gaps / Empty Outputs:</p>
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
  const [selectedCase, setSelectedCase] = useState("3"); // v5-04 Cardiac
  const [trace, setTrace] = useState<PipelineTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveWaves, setLiveWaves] = useState<WaveTrace[]>([]);

  const runTrace = async () => {
    setLoading(true);
    setTrace(null);
    setLiveWaves([]);
    try {
      const result = await runPipelineTrace(
        parseInt(selectedCase),
        (wave) => setLiveWaves(prev => [...prev, wave]),
      );
      setTrace(result);
    } catch (err) {
      console.error("[PipelineTrace] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayWaves = trace ? trace.waves : liveWaves;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-5xl mx-auto">
      <SEO title="Pipeline Execution Trace" description="Full wave-by-wave clinical pipeline trace" />

      <div className="flex items-center gap-3 mb-6">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">Pipeline Execution Trace</h1>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-4 flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="flex-1 w-full">
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Benchmark Case</label>
            <Select value={selectedCase} onValueChange={setSelectedCase}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BENCHMARK_CASES_V5.map((bc, i) => (
                  <SelectItem key={bc.id} value={String(i)}>
                    {bc.id}: {bc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={runTrace} disabled={loading} className="w-full sm:w-auto">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><Zap className="h-4 w-4 mr-2" />Execute Trace</>}
          </Button>
        </CardContent>
      </Card>

      {/* Summary */}
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
                <p className="font-semibold">{trace.diagnoses_generated.length > 0 ? trace.diagnoses_generated.join(", ") : "⚠ None"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Gaps</p>
                <p className={`font-semibold ${trace.all_gaps.length > 0 ? "text-destructive" : "text-primary"}`}>
                  {trace.all_gaps.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Labs Suggested</p>
                <p className="font-semibold">{trace.labs_suggested.length > 0 ? trace.labs_suggested.join(", ") : "⚠ None"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Graph Matches</p>
                <p className="font-mono">{trace.graph_matches}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Danger Detected</p>
                <Badge variant={trace.danger_detected ? "destructive" : "secondary"}>
                  {trace.danger_detected ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Waves Executed</p>
                <p className="font-mono">{trace.waves.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wave-by-Wave */}
      {displayWaves.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Wave-by-Wave Execution</h2>
          {displayWaves.map((w, i) => (
            <WaveCard key={`${w.wave}-${i}`} wave={w} index={i} />
          ))}
        </div>
      )}

      {/* All Gaps Summary */}
      {trace && trace.all_gaps.length > 0 && (
        <Card className="mt-6 border-destructive">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              All Pipeline Gaps ({trace.all_gaps.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="text-xs space-y-1 font-mono">
              {trace.all_gaps.map((g, i) => (
                <li key={i} className="text-destructive">• {g}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Raw Result */}
      {trace && (
        <details className="mt-6">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Raw Pipeline Result (JSON)
          </summary>
          <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-auto max-h-96 font-mono">
            {JSON.stringify(trace.final_result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
