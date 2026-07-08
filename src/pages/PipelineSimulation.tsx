/**
 * Pipeline Simulation Tool
 *
 * Allows admins to input symptoms, history, and vitals,
 * then run the full clinical pipeline and view results.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Play, Stethoscope, FlaskConical, Pill, Shield, Brain, FileText } from "lucide-react";
import { mergeContextSources, type ContextSource, type MergedContextObject } from "@/services/context_service";
import { runClinicalPipeline, type ClinicalPipelineResult } from "@/services/benchmark_v8/legacy_pipeline_adapter";
import SEO from "@/components/SEO";

export default function PipelineSimulation() {
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState("");
  const [history, setHistory] = useState("");
  const [medications, setMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [temperature, setTemperature] = useState("");
  const [pulse, setPulse] = useState("");
  const [spo2, setSpo2] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ClinicalPipelineResult | null>(null);

  const csvToArr = (s: string) => s.split(",").map(v => v.trim()).filter(Boolean);

  const runSimulation = async () => {
    if (!chiefComplaint.trim()) return;
    setRunning(true);
    setResult(null);

    try {
      const source: ContextSource = {
        source_type: "doctor",
        chief_complaint: chiefComplaint,
        symptoms: csvToArr(symptoms),
        symptom_duration: duration,
        medical_history: csvToArr(history),
        medications: csvToArr(medications),
        allergies: csvToArr(allergies),
        vitals: {
          temperature: temperature ? parseFloat(temperature) : null,
          pulse: pulse ? parseInt(pulse) : null,
          spo2: spo2 ? parseInt(spo2) : null,
          bp_systolic: bpSys ? parseInt(bpSys) : null,
          bp_diastolic: bpDia ? parseInt(bpDia) : null,
        },
      };

      const ctx = mergeContextSources(
        `sim-${Date.now()}`,
        `sim-patient`,
        `sim-clinic`,
        [source],
      );

      const pipelineResult = await runClinicalPipeline(ctx);
      setResult(pipelineResult);
    } catch (e) {
      console.error("Simulation failed:", e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      <SEO title="Pipeline Simulation — DATAelixAIr" description="Simulate clinical pipeline end-to-end." />
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pipeline Simulation</h2>
          <p className="text-sm text-muted-foreground">Input patient data and run the full clinical reasoning pipeline.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Input Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Stethoscope className="h-4 w-4" /> Patient Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Chief Complaint *</Label>
                <Input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="e.g., persistent cough with fever" />
              </div>
              <div>
                <Label className="text-xs">Symptoms (comma-separated)</Label>
                <Input value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="cough, fever, chest pain" />
              </div>
              <div>
                <Label className="text-xs">Duration</Label>
                <Input value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g., 5 days" />
              </div>
              <div>
                <Label className="text-xs">Medical History (comma-separated)</Label>
                <Input value={history} onChange={e => setHistory(e.target.value)} placeholder="diabetes, hypertension" />
              </div>
              <div>
                <Label className="text-xs">Current Medications (comma-separated)</Label>
                <Input value={medications} onChange={e => setMedications(e.target.value)} placeholder="metformin, amlodipine" />
              </div>
              <div>
                <Label className="text-xs">Allergies (comma-separated)</Label>
                <Input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="penicillin, sulfa" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Temp (°C)</Label><Input type="number" value={temperature} onChange={e => setTemperature(e.target.value)} placeholder="38.5" /></div>
                <div><Label className="text-xs">Pulse (bpm)</Label><Input type="number" value={pulse} onChange={e => setPulse(e.target.value)} placeholder="88" /></div>
                <div><Label className="text-xs">SpO2 (%)</Label><Input type="number" value={spo2} onChange={e => setSpo2(e.target.value)} placeholder="95" /></div>
                <div className="flex gap-1">
                  <div className="flex-1"><Label className="text-xs">BP Sys</Label><Input type="number" value={bpSys} onChange={e => setBpSys(e.target.value)} placeholder="130" /></div>
                  <div className="flex-1"><Label className="text-xs">BP Dia</Label><Input type="number" value={bpDia} onChange={e => setBpDia(e.target.value)} placeholder="85" /></div>
                </div>
              </div>

              <Button onClick={runSimulation} disabled={running || !chiefComplaint.trim()} className="w-full">
                {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Run Pipeline
              </Button>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-4">
            {running && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Running clinical pipeline...</p>
                </CardContent>
              </Card>
            )}

            {result && (
              <>
                {/* Latency Banner */}
                <Card className={result.latency.total_ms > 15000 ? "border-amber-300" : "border-emerald-300"}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <span className="text-sm font-medium">Total Latency</span>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-xs">W1: {result.latency.wave1_ms}ms</Badge>
                      <Badge variant="outline" className="text-xs">W2: {result.latency.wave2_ms}ms</Badge>
                      <Badge variant="outline" className="text-xs">W3: {result.latency.wave3_ms}ms</Badge>
                      <Badge className={`text-xs ${result.latency.total_ms > 15000 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {result.latency.total_ms}ms
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="ddx">
                  <TabsList className="flex-wrap">
                    <TabsTrigger value="ddx"><Brain className="h-3 w-3 mr-1" /> DDX</TabsTrigger>
                    <TabsTrigger value="labs"><FlaskConical className="h-3 w-3 mr-1" /> Labs</TabsTrigger>
                    <TabsTrigger value="meds"><Pill className="h-3 w-3 mr-1" /> Meds</TabsTrigger>
                    <TabsTrigger value="safety"><Shield className="h-3 w-3 mr-1" /> Safety</TabsTrigger>
                    <TabsTrigger value="soap"><FileText className="h-3 w-3 mr-1" /> SOAP</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ddx" className="space-y-2">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs">Differential Diagnoses</CardTitle></CardHeader>
                      <CardContent>
                        {result.ddx_candidates.diagnoses.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No diagnoses found.</p>
                        ) : (
                          <div className="space-y-2">
                            {result.ddx_candidates.diagnoses.map((d, i) => (
                              <div key={i} className="flex items-center justify-between py-1 border-b border-muted/50 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                                  <span className="text-sm font-medium">{d.diagnosis}</span>
                                  {d.must_not_miss && <Badge className="bg-destructive/10 text-destructive text-[8px]">MUST NOT MISS</Badge>}
                                </div>
                                <span className="text-sm font-bold">{Math.round(d.probability_score)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 text-xs text-muted-foreground">
                          Confidence: {result.confidence_scores.confidence_label} ({Math.round(result.confidence_scores.confidence_score * 100)}%)
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="labs">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs">Recommended Labs</CardTitle></CardHeader>
                      <CardContent>
                        {result.recommended_labs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No lab recommendations.</p>
                        ) : (
                          <div className="space-y-1">
                            {result.recommended_labs.map((l, i) => (
                              <div key={i} className="flex items-center justify-between text-sm py-1">
                                <span>{l.test_name}</span>
                                <Badge variant="outline" className="text-[9px]">{l.priority}</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="meds">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs">Medication Suggestions</CardTitle></CardHeader>
                      <CardContent>
                        {result.recommended_medications.suggestions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No medication suggestions.</p>
                        ) : (
                          <div className="space-y-2">
                            {result.recommended_medications.suggestions.map((m, i) => (
                              <div key={i} className="text-sm py-1 border-b border-muted/50 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{m.generic_name}</span>
                                  {m.safe ? <Badge className="bg-emerald-100 text-emerald-800 text-[8px]">Safe</Badge> :
                                    <Badge className="bg-destructive/10 text-destructive text-[8px]">Review</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{m.dose} · {m.frequency} · {m.for_diagnosis}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Safety Score: {result.recommended_medications.safety_score}/100</p>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="safety">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs">Safety Alerts</CardTitle></CardHeader>
                      <CardContent>
                        {result.safety_alerts.alerts.length === 0 ? (
                          <p className="text-xs text-emerald-600">✓ No safety issues detected.</p>
                        ) : (
                          <div className="space-y-2">
                            {result.safety_alerts.alerts.map((a, i) => (
                              <div key={i} className={`p-2 rounded text-sm ${
                                a.severity === "critical" ? "bg-destructive/10 text-destructive" :
                                a.severity === "high" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400" :
                                "bg-muted text-muted-foreground"
                              }`}>
                                <Badge className="text-[8px] mb-1" variant="outline">{a.severity}</Badge>
                                <p className="text-xs">{a.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="soap">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs">SOAP Note</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        {(["subjective", "objective", "assessment", "plan"] as const).map(section => (
                          <div key={section}>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">{section}</p>
                            <p className="text-sm whitespace-pre-wrap">{result.soap_draft.soap[section]}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}

            {!result && !running && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Enter patient data and run the pipeline to see results.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
