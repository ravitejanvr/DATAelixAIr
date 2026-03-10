import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, FlaskConical, BarChart3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Progress } from "@/components/ui/progress";

const DEFAULT_CONTEXT = {
  age: 35,
  gender: "male",
  symptoms: ["fever", "headache", "body ache"],
  duration: "2 days",
  vitals: {
    temperature: 101,
    bp: "120/80",
    pulse: 88,
    spo2: 98,
  },
  allergies: ["penicillin"],
  conditions: ["hypertension"],
  current_medications: ["telmisartan"],
};

export default function AiPipelineTest() {
  const [input, setInput] = useState(JSON.stringify(DEFAULT_CONTEXT, null, 2));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runComparison = async () => {
    setLoading(true);
    setResult(null);
    try {
      const parsed = JSON.parse(input);
      const { data, error } = await supabase.functions.invoke("compare-ai-pipelines", {
        body: { patient_context: parsed },
      });
      if (error) throw error;
      setResult(data);
      toast.success("Pipeline comparison complete");
    } catch (e: any) {
      toast.error(e.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const comp = result?.comparison;

  return (
    <PlatformAdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">AI Pipeline Comparison Test Harness</h1>
          <Badge variant="outline" className="ml-2">Developer Tool</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Run both legacy and modular pipelines with identical inputs to compare outputs. Does NOT modify production workflows.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-sm">Patient Context (JSON)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="font-mono text-xs min-h-[350px]"
              />
              <Button onClick={runComparison} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {loading ? "Running both pipelines..." : "Run Comparison"}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="lg:col-span-2 space-y-4">
            {comp && (
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Comparison Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <MetricBar label="Diagnosis Overlap" value={comp.diagnosis_overlap} />
                  <MetricBar label="Lab Overlap" value={comp.lab_overlap} />
                  <MetricBar label="Medication Overlap" value={comp.medication_overlap} />
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Latency Diff: {comp.latency_difference_ms}ms</span>
                    <span>{comp.legacy_faster ? "Legacy faster" : "Modular faster"}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {result && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PipelineCard
                  title="Legacy Pipeline"
                  data={result.legacy_pipeline}
                  variant="legacy"
                />
                <PipelineCard
                  title="Modular Pipeline"
                  data={result.modular_pipeline}
                  variant="modular"
                />
              </div>
            )}

            {!result && !loading && (
              <Card className="flex items-center justify-center min-h-[300px] text-muted-foreground">
                <div className="text-center space-y-2">
                  <FlaskConical className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm">Configure patient context and run comparison</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PlatformAdminLayout>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "text-green-600" : value >= 40 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className={`font-mono font-bold ${color}`}>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function PipelineCard({ title, data, variant }: { title: string; data: any; variant: "legacy" | "modular" }) {
  if (!data) return null;
  const borderColor = variant === "modular" ? "border-blue-500/30" : "border-muted";

  return (
    <Card className={borderColor}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          {title}
          <Badge variant="secondary" className="text-[10px]">{data.latency_ms}ms</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {data.error && (
          <div className="p-2 bg-destructive/10 rounded text-destructive text-xs">{data.error}</div>
        )}

        <Section title="Diagnoses" items={data.diagnoses} />
        <Section title="Labs" items={data.labs} />
        <Section title="Medications" items={data.medications} />

        {variant === "modular" && (
          <>
            {data.guidelines?.length > 0 && (
              <div>
                <p className="font-semibold mb-1">Guidelines</p>
                {data.guidelines.map((g: any, i: number) => (
                  <div key={i} className="p-1.5 bg-muted/50 rounded mb-1">
                    <span className="font-medium">{g.title}</span>
                    <span className="text-muted-foreground ml-1">— {g.organization}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>Safety Score: <strong>{data.safety_score}/100</strong></span>
            </div>
            {data.safety_flags?.length > 0 && (
              <div className="space-y-1">
                {data.safety_flags.map((f: string, i: number) => (
                  <Badge key={i} variant="destructive" className="text-[10px] mr-1">{f}</Badge>
                ))}
              </div>
            )}
            {data.reasoning && (
              <div>
                <p className="font-semibold mb-1">Clinical Reasoning</p>
                <p className="text-muted-foreground">{data.reasoning}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="font-semibold mb-1">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <Badge key={i} variant="outline" className="text-[10px]">{item}</Badge>
        ))}
      </div>
    </div>
  );
}
