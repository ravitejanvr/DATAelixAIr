import { useState, useRef, useCallback, useEffect } from "react";
import { ConversationEngine } from "@/services/conversation_engine";
import type { UIState, ConversationMessage } from "@/services/conversation_engine/types";
import { processUploadedFile } from "@/services/file_adapter";
import VoiceRecorder from "@/components/VoiceRecorder";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Upload, RotateCcw, AlertTriangle,
  Brain, Shield, Activity, CheckCircle2, Clock, FileText, Mic,
} from "lucide-react";
import SEO from "@/components/SEO";

const engine = new ConversationEngine();

export default function ClinicalInteraction() {
  const [state, setState] = useState<UIState>(engine.getCurrentState());
  const [textInput, setTextInput] = useState("");
  const [showVoice, setShowVoice] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const handleSendText = useCallback(async () => {
    const text = textInput.trim();
    if (!text || state.is_processing) return;
    setTextInput("");
    const newState = await engine.processTextInput(text);
    setState(newState);
  }, [textInput, state.is_processing]);

  const handleTranscriptUpdate = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    const newState = await engine.processTextInput(transcript);
    setState(newState);
  }, []);

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
    setShowVoice(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  const result = state.pipeline_result;

  return (
    <div className="h-screen bg-background flex flex-col">
      <SEO title="Clinical Interaction — V4" description="Interactive clinical reasoning" />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        {/* ═══ LEFT: Chat Panel ═══ */}
        <div className="lg:col-span-2 flex flex-col border-r border-border min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="font-semibold text-foreground text-sm">Clinical Interaction</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={state.minimum_context_met ? "default" : "destructive"} className="text-[10px]">
                {state.minimum_context_met ? "Context Met" : "Needs Data"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">Turn {state.turn_count}</Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Symptom Chips Bar */}
          {state.features.length > 0 && (
            <div className="px-4 py-2 border-b border-border bg-muted/10 shrink-0">
              <ChipGroup>
                {state.features.map(tf => (
                  <Chip key={tf.feature.feature_id} variant="symptom" size="sm">
                    {tf.feature.feature_id.replace(/_/g, " ")}
                    {tf.feature.intensity !== "unknown" && ` (${tf.feature.intensity})`}
                    {tf.feature.duration && ` · ${tf.feature.duration}`}
                  </Chip>
                ))}
              </ChipGroup>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            <div className="max-w-2xl mx-auto space-y-3">
              {state.messages.length === 0 && (
                <div className="text-center text-muted-foreground py-16">
                  <Brain className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-base font-medium">Start a clinical consultation</p>
                  <p className="text-xs mt-1">Describe symptoms or tap the mic to speak</p>
                </div>
              )}
              {state.messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} onAnswer={handleAnswerQuestion} />
              ))}
              {state.is_processing && (
                <div className="flex gap-2 items-center text-muted-foreground text-xs pl-2">
                  <div className="flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                  </div>
                  Analyzing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Voice Recorder (expandable) */}
          {showVoice && (
            <div className="px-4 py-2 border-t border-border bg-muted/20 shrink-0">
              <VoiceRecorder onTranscriptUpdate={handleTranscriptUpdate} disabled={state.is_processing} />
            </div>
          )}

          {/* Fixed Bottom Input */}
          <div className="border-t border-border px-4 py-3 bg-background shrink-0">
            <div className="flex gap-2 max-w-2xl mx-auto">
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4" />
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={handleFileUpload} />
              <Button
                variant={showVoice ? "default" : "outline"}
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setShowVoice(v => !v)}
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Input
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe symptoms..."
                className="flex-1 h-9 text-sm"
                disabled={state.is_processing}
              />
              <Button onClick={handleSendText} disabled={!textInput.trim() || state.is_processing} size="icon" className="h-9 w-9 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Live State Panel ═══ */}
        <div className="hidden lg:flex flex-col overflow-auto bg-muted/10">
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Canonical Features */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-3">
                  <CardTitle className="text-xs flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-primary" /> Features ({state.features.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  {state.features.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">Awaiting input</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {state.features.map(tf => (
                        <Badge key={tf.feature.feature_id} variant="secondary" className="text-[10px]">
                          {tf.feature.feature_id}
                          {tf.feature.intensity !== "unknown" && <span className="ml-0.5 opacity-60">·{tf.feature.intensity}</span>}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {result && (
                <>
                  {/* Confidence */}
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span>Overall</span>
                        <span className="font-mono">{(result.confidence.overall_confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${result.confidence.overall_confidence * 100}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Uncertainty: {(result.confidence.uncertainty_score * 100).toFixed(0)}%</span>
                        <span>{result.execution_ms}ms</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Top Diagnoses */}
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5" /> Diagnoses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      {result.ssal.diagnoses.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground">Awaiting DDX</p>
                      ) : (
                        <div className="space-y-1.5">
                          {result.ssal.diagnoses.slice(0, 5).map((dx, i) => (
                            <div key={dx.diagnosis_id} className="flex justify-between items-center text-xs">
                              <span className="truncate mr-2">#{dx.rank} {dx.diagnosis_name}</span>
                              <Badge variant={i === 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                                {(dx.final_probability * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Safety */}
                  {result.safety.safety_alerts.length > 0 && (
                    <Card className="border-destructive/40">
                      <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5 text-destructive">
                          <Shield className="h-3.5 w-3.5" /> Safety Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1.5">
                        {result.safety.safety_alerts.map(alert => (
                          <div key={alert.alert_id} className="text-[10px]">
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-destructive" />
                              <span className="font-medium">{alert.condition}</span>
                            </div>
                            <p className="text-muted-foreground ml-4">{alert.action}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Completeness */}
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-3">
                      <CardTitle className="text-xs flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> Completeness
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span>Score</span>
                        <span className="font-mono">{(result.completeness.completeness_score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${result.completeness.completeness_score * 100}%` }} />
                      </div>
                      {result.questions.missing_critical_fields.length > 0 && (
                        <p className="text-[10px] text-destructive">Missing: {result.questions.missing_critical_fields.join(", ")}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Evidence Gaps */}
                  {result.cognitive.evidence_gaps.length > 0 && (
                    <Card>
                      <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs">Evidence Gaps</CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1">
                        {result.cognitive.evidence_gaps.slice(0, 4).map((gap, i) => (
                          <div key={i} className="text-[10px] flex justify-between">
                            <span>{gap.missing_feature}</span>
                            <Badge variant={gap.importance === "critical" ? "destructive" : "outline"} className="text-[9px]">{gap.importance}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Files */}
                  {state.files.length > 0 && (
                    <Card>
                      <CardHeader className="pb-1 pt-3 px-3">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" /> Files
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-1">
                        {state.files.map(f => (
                          <div key={f.file_id} className="text-[10px] flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            <span className="truncate">{f.file_name}</span>
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
// MESSAGE BUBBLE
// ══════════════════════════════════════════════

function MessageBubble({
  message,
  onAnswer,
}: {
  message: ConversationMessage;
  onAnswer: (qId: string, answer: string) => void;
}) {
  const [answerInput, setAnswerInput] = useState("");

  // User message — right aligned
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[75%]">
          <p className="text-sm leading-relaxed">{message.content}</p>
          {message.extracted_features && message.extracted_features.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {message.extracted_features.map(fid => (
                <span key={fid} className="text-[9px] bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded-full">
                  {fid}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Question message — left aligned, distinct styling
  if (message.role === "question" && message.question) {
    const q = message.question;
    return (
      <div className="flex justify-start">
        <div className="bg-accent/40 border border-accent/60 rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[80%] space-y-2">
          <p className="text-sm leading-relaxed">{message.content}</p>
          {q.options ? (
            <div className="flex flex-wrap gap-1.5">
              {q.options.map(opt => (
                <Button key={opt} variant="outline" size="sm" className="text-xs h-7 rounded-full" onClick={() => onAnswer(q.question_id, opt)}>
                  {opt}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <Input
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="Type your answer..."
                className="text-xs h-8 rounded-full"
                onKeyDown={e => {
                  if (e.key === "Enter" && answerInput.trim()) {
                    onAnswer(q.question_id, answerInput.trim());
                    setAnswerInput("");
                  }
                }}
              />
              <Button size="sm" className="h-8 rounded-full px-3" disabled={!answerInput.trim()} onClick={() => { onAnswer(q.question_id, answerInput.trim()); setAnswerInput(""); }}>
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // System message — left aligned, subtle
  return (
    <div className="flex justify-start">
      <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-3.5 py-2 max-w-[80%]">
        <p className="text-xs text-muted-foreground">{message.content}</p>
      </div>
    </div>
  );
}
