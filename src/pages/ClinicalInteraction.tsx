import { useState, useRef, useCallback, useEffect } from "react";
import { ConversationEngine } from "@/services/conversation_engine";
import type { UIState, ConversationMessage } from "@/services/conversation_engine/types";
import { processUploadedFile } from "@/services/file_adapter";
import type { PipelineVitals } from "@/services/pipeline/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Send, Mic, MicOff, Upload, RotateCcw, AlertTriangle,
  Brain, Shield, Activity, CheckCircle2, Clock, FileText,
} from "lucide-react";
import SEO from "@/components/SEO";

// ══════════════════════════════════════════════
// Clinical Interaction Page — V4 Test Harness
// ══════════════════════════════════════════════

const engine = new ConversationEngine();

export default function ClinicalInteraction() {
  const [state, setState] = useState<UIState>(engine.getCurrentState());
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.messages]);

  const handleSendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || state.is_processing) return;
    setTextInput("");
    const newState = await engine.processTextInput(text);
    setState(newState);
  }, [textInput, state.is_processing]);

  const handleAnswerQuestion = useCallback(async (questionId: string, answer: string) => {
    const newState = await engine.answerQuestion(questionId, answer);
    setState(newState);
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const processed = await Promise.all(
      Array.from(files).map(f => processUploadedFile(f))
    );
    const newState = await engine.attachFiles(processed);
    setState(newState);
  }, []);

  const handleReset = useCallback(() => {
    engine.reset();
    setState(engine.getCurrentState());
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  const result = state.pipeline_result;

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Clinical Interaction — V4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-screen">
        {/* ═══ LEFT: Chat Panel ═══ */}
        <div className="lg:col-span-2 flex flex-col border-r border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-foreground">Clinical Interaction — V4 Pipeline</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={state.minimum_context_met ? "default" : "destructive"}>
                {state.minimum_context_met ? "Context Met" : "Needs More Data"}
              </Badge>
              <Badge variant="outline">Turn {state.turn_count}</Badge>
              <Button variant="ghost" size="icon" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-3 max-w-3xl mx-auto">
              {state.messages.length === 0 && (
                <div className="text-center text-muted-foreground py-20">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Start a clinical consultation</p>
                  <p className="text-sm mt-1">Type symptoms or use voice input</p>
                </div>
              )}
              {state.messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onAnswer={handleAnswerQuestion}
                />
              ))}
              {state.is_processing && (
                <div className="flex gap-2 items-center text-muted-foreground text-sm">
                  <div className="animate-pulse">●</div> Processing...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t border-border p-4 bg-background">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file"
              >
                <Upload className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileUpload}
              />
              <Input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe symptoms... e.g. 'fever since 3 days with weakness'"
                className="flex-1"
                disabled={state.is_processing}
              />
              <Button
                onClick={handleSendText}
                disabled={!textInput.trim() || state.is_processing}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Debug / State Panel ═══ */}
        <div className="hidden lg:flex flex-col overflow-auto bg-muted/10">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Canonical Features */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Canonical Features
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {state.features.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No features yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {state.features.map(tf => (
                        <Badge key={tf.feature.feature_id} variant="secondary" className="text-xs">
                          {tf.feature.feature_id}
                          {tf.feature.intensity !== "unknown" && (
                            <span className="ml-1 opacity-70">({tf.feature.intensity})</span>
                          )}
                          {tf.feature.duration && (
                            <span className="ml-1 opacity-70">{tf.feature.duration}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pipeline Results */}
              {result && (
                <>
                  {/* Confidence */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Confidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Overall</span>
                          <span className="font-mono">
                            {(result.confidence.overall_confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${result.confidence.overall_confidence * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Uncertainty: {(result.confidence.uncertainty_score * 100).toFixed(0)}%</span>
                          <span>Exec: {result.execution_ms}ms</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Diagnoses */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Brain className="h-4 w-4" /> SSAL Diagnoses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {result.ssal.diagnoses.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Awaiting DDX engine data</p>
                      ) : (
                        <div className="space-y-2">
                          {result.ssal.diagnoses.slice(0, 5).map((dx, i) => (
                            <div key={dx.diagnosis_id} className="flex justify-between text-sm">
                              <span>#{dx.rank} {dx.diagnosis_name}</span>
                              <Badge variant={i === 0 ? "default" : "outline"} className="text-xs">
                                {(dx.final_probability * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Safety Alerts */}
                  {result.safety.safety_alerts.length > 0 && (
                    <Card className="border-destructive/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                          <Shield className="h-4 w-4" /> Safety Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {result.safety.safety_alerts.map(alert => (
                            <div key={alert.alert_id} className="text-xs">
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-destructive" />
                                <span className="font-medium">{alert.condition}</span>
                              </div>
                              <p className="text-muted-foreground ml-4">{alert.action}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Missing Data */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Completeness
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Score</span>
                          <span className="font-mono">
                            {(result.completeness.completeness_score * 100).toFixed(0)}%
                          </span>
                        </div>
                        {result.questions.missing_critical_fields.length > 0 && (
                          <div className="text-xs text-destructive mt-1">
                            Missing: {result.questions.missing_critical_fields.join(", ")}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cognitive Signals */}
                  {result.cognitive.evidence_gaps.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Evidence Gaps</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {result.cognitive.evidence_gaps.slice(0, 5).map((gap, i) => (
                            <div key={i} className="text-xs flex justify-between">
                              <span>{gap.missing_feature}</span>
                              <Badge
                                variant={gap.importance === "critical" ? "destructive" : "outline"}
                                className="text-[10px]"
                              >
                                {gap.importance}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Files */}
                  {state.files.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Attached Files
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {state.files.map(f => (
                          <div key={f.file_id} className="text-xs flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span>{f.file_name}</span>
                            <Badge variant="outline" className="text-[10px]">{f.file_type}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// MESSAGE BUBBLE COMPONENT
// ══════════════════════════════════════════════

function MessageBubble({
  message,
  onAnswer,
}: {
  message: ConversationMessage;
  onAnswer: (qId: string, answer: string) => void;
}) {
  const [answerInput, setAnswerInput] = useState("");

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2 max-w-[80%]">
          <p className="text-sm">{message.content}</p>
          {message.extracted_features && message.extracted_features.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {message.extracted_features.map(fid => (
                <Badge key={fid} variant="secondary" className="text-[10px] bg-primary-foreground/20 text-primary-foreground">
                  {fid}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.role === "question" && message.question) {
    const q = message.question;
    return (
      <div className="flex justify-start">
        <div className="bg-accent/50 border border-accent rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%] space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant={q.priority === "critical" ? "destructive" : "outline"}
              className="text-[10px]"
            >
              {q.priority}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{q.category}</span>
          </div>
          <p className="text-sm">{message.content}</p>
          {q.options ? (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map(opt => (
                <Button
                  key={opt}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => onAnswer(q.question_id, opt)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="Type answer..."
                className="text-xs h-8"
                onKeyDown={e => {
                  if (e.key === "Enter" && answerInput.trim()) {
                    onAnswer(q.question_id, answerInput.trim());
                    setAnswerInput("");
                  }
                }}
              />
              <Button
                size="sm"
                className="h-8"
                disabled={!answerInput.trim()}
                onClick={() => {
                  onAnswer(q.question_id, answerInput.trim());
                  setAnswerInput("");
                }}
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // System message
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2 max-w-[80%]">
        <p className="text-sm text-foreground">{message.content}</p>
      </div>
    </div>
  );
}
