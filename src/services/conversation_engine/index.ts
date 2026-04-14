/**
 * Conversation Engine — V4 Closed-Loop Interaction
 *
 * Manages the closed-loop flow:
 *   User Input → Scribe Adapter → Canonicalization →
 *   SessionContext.update() → runClinicalPipelineV4() →
 *   Question Engine → Ask next question → Repeat
 *
 * Rules:
 * - Tracks asked questions (no repetition)
 * - Prioritizes: symptom expansion → severity → associated → risk → demographics
 * - No raw strings beyond canonicalization boundary
 * - Conversational tone for questions
 * - Session state tracks mode + language across turns
 */

import { SessionContextManager } from "../session_context";
import type { UploadedFile } from "../session_context/types";
import { extractFromTranscript } from "../scribe_adapter/extractor";
import { detectLanguage } from "../canonical/normalizer";
import { runClinicalPipelineV4 } from "../pipeline";
import type { PipelineOutput, ClinicalQuestion, PipelineVitals } from "../pipeline/types";
import type { SupportedLanguage } from "../canonical/types";
import type { ConversationMessage, UIState, SessionState, InteractionMode } from "./types";

export type { ConversationMessage, UIState, SessionState, InteractionMode } from "./types";

/** Question category priority order */
const CATEGORY_PRIORITY: Record<string, number> = {
  symptom_expansion: 0,
  severity: 1,
  associated_symptoms: 2,
  risk_factors: 3,
  history: 4,
  demographics: 5,
};

/** Conversational rewrites for robotic question text */
function toConversationalTone(text: string): string {
  if (/^(can you|could you|how|what|do you|have you|are you|is there|does|did|when|where)/i.test(text)) {
    return text;
  }
  if (/^(duration|severity|onset|location)/i.test(text)) {
    return `Can you tell me more about the ${text.toLowerCase()}?`;
  }
  return text;
}

export class ConversationEngine {
  private session: SessionContextManager;
  private messages: ConversationMessage[] = [];
  private askedQuestionIds = new Set<string>();
  private askedQuestionTexts = new Set<string>();
  private pendingQuestions: ClinicalQuestion[] = [];
  private latestPipelineResult: PipelineOutput | null = null;
  private isProcessing = false;
  private messageCounter = 0;

  /** Persistent session state exposed to UI */
  private sessionState: SessionState = {
    mode: "text",
    language: "unknown",
    transcriptBuffer: [],
    lastQuestionId: null,
  };

  constructor() {
    this.session = new SessionContextManager();
  }

  // ══════════════════════════════════════════════
  // SESSION STATE METHODS
  // ══════════════════════════════════════════════

  setMode(mode: InteractionMode): void {
    this.sessionState.mode = mode;
  }

  getMode(): InteractionMode {
    return this.sessionState.mode;
  }

  getLanguage(): SupportedLanguage {
    return this.sessionState.language;
  }

  /** Buffer a voice transcript chunk without triggering pipeline */
  bufferTranscript(chunk: string): void {
    if (chunk.trim()) {
      this.sessionState.transcriptBuffer.push(chunk.trim());
    }
  }

  /** Flush transcript buffer and process as single input */
  async flushTranscriptBuffer(): Promise<UIState> {
    const fullText = this.sessionState.transcriptBuffer.join(" ").trim();
    this.sessionState.transcriptBuffer = [];
    if (!fullText) return this.getCurrentState();
    return this.processTextInput(fullText);
  }

  // ══════════════════════════════════════════════
  // CORE INTERACTION METHODS
  // ══════════════════════════════════════════════

  async processTextInput(text: string): Promise<UIState> {
    this.isProcessing = true;

    // Detect language on first meaningful input
    if (this.sessionState.language === "unknown") {
      this.sessionState.language = detectLanguage(text);
    }

    const userMsg = this.addMessage("user", text);

    // Extract symptoms via scribe adapter
    const extracted = extractFromTranscript(text);
    this.session.updateFromExtraction(extracted, "patient_text");

    // Track extracted features on user message
    const features = this.session.getCanonicalFeatures();
    userMsg.extracted_features = features.map(f => f.feature_id);

    // Run pipeline + generate response
    await this.runPipeline();
    this.generateSystemResponse();

    this.isProcessing = false;
    return this.getCurrentState();
  }

  async answerQuestion(questionId: string, answer: string): Promise<UIState> {
    this.isProcessing = true;

    // Mark question as answered (both ID and text)
    this.askedQuestionIds.add(questionId);
    const question = this.pendingQuestions.find(q => q.question_id === questionId);
    if (question) {
      this.askedQuestionTexts.add(this.normalizeQuestionText(question.text));
    }

    this.session.updateFromAnswers(questionId, answer);
    this.addMessage("user", answer);

    // Remove from pending
    this.pendingQuestions = this.pendingQuestions.filter(q => q.question_id !== questionId);

    await this.runPipeline();
    this.generateSystemResponse();

    this.isProcessing = false;
    return this.getCurrentState();
  }

  async attachVitals(vitals: PipelineVitals): Promise<UIState> {
    this.session.attachVitals(vitals);
    this.addMessage("system", "Vitals recorded.");
    await this.runPipeline();
    return this.getCurrentState();
  }

  async attachFiles(files: UploadedFile[]): Promise<UIState> {
    this.session.attachFiles(files);
    const names = files.map(f => f.file_name).join(", ");
    this.addMessage("system", `Files attached: ${names}`);
    await this.runPipeline();
    return this.getCurrentState();
  }

  async setDemographics(data: { age?: number; sex?: string; name?: string }): Promise<UIState> {
    this.session.setDemographics(data);
    await this.runPipeline();
    return this.getCurrentState();
  }

  getCurrentState(): UIState {
    const snapshot = this.session.getSnapshot();
    return {
      messages: [...this.messages],
      pending_questions: [...this.pendingQuestions],
      pipeline_result: this.latestPipelineResult,
      features: snapshot.features,
      files: snapshot.files,
      is_processing: this.isProcessing,
      turn_count: snapshot.turn_count,
      minimum_context_met: this.latestPipelineResult?.questions.minimum_context_met ?? false,
      session: { ...this.sessionState },
    };
  }

  /** Get the last system/question message content (for TTS) */
  getLastResponseText(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role === "question" || msg.role === "system") {
        return msg.content;
      }
    }
    return null;
  }

  reset(): void {
    this.session.reset();
    this.messages = [];
    this.askedQuestionIds.clear();
    this.askedQuestionTexts.clear();
    this.pendingQuestions = [];
    this.latestPipelineResult = null;
    this.isProcessing = false;
    this.messageCounter = 0;
    this.sessionState = {
      mode: "text",
      language: "unknown",
      transcriptBuffer: [],
      lastQuestionId: null,
    };
  }

  // ══════════════════════════════════════════════
  // INTERNAL METHODS
  // ══════════════════════════════════════════════

  private async runPipeline(): Promise<void> {
    const input = this.session.toPipelineInput();
    this.latestPipelineResult = await runClinicalPipelineV4(input);

    // Filter out already-asked questions using both ID and normalized text
    const newQuestions = this.latestPipelineResult.questions.questions
      .filter(q => {
        if (this.askedQuestionIds.has(q.question_id)) return false;
        if (this.askedQuestionTexts.has(this.normalizeQuestionText(q.text))) return false;
        return true;
      })
      .sort((a, b) => {
        const catA = CATEGORY_PRIORITY[a.category] ?? 99;
        const catB = CATEGORY_PRIORITY[b.category] ?? 99;
        if (catA !== catB) return catA - catB;
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      });

    this.pendingQuestions = newQuestions;
  }

  private generateSystemResponse(): void {
    if (!this.latestPipelineResult) return;

    const result = this.latestPipelineResult;
    const features = this.session.getCanonicalFeatures();

    // Summary of detections
    if (features.length > 0) {
      const featureList = features.map(f => f.feature_id).join(", ");
      this.addMessage("system",
        `Noted: ${featureList}. Confidence: ${(result.confidence.overall_confidence * 100).toFixed(0)}%`
      );
    }

    // Safety alerts
    for (const alert of result.safety.safety_alerts) {
      this.addMessage("system", `⚠️ ${alert.condition} — ${alert.action}`);
    }

    // Ask next question (only one at a time, conversational tone)
    if (this.pendingQuestions.length > 0) {
      const nextQ = this.pendingQuestions[0];
      const conversationalText = toConversationalTone(nextQ.text);

      const normalized = this.normalizeQuestionText(conversationalText);
      if (!this.askedQuestionTexts.has(normalized)) {
        this.askedQuestionTexts.add(normalized);
        this.askedQuestionIds.add(nextQ.question_id);
        this.sessionState.lastQuestionId = nextQ.question_id;
        this.addMessage("question", conversationalText, nextQ);
      }
    }
  }

  /** Normalize question text for dedup comparison */
  private normalizeQuestionText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private addMessage(
    role: ConversationMessage["role"],
    content: string,
    question?: ClinicalQuestion
  ): ConversationMessage {
    const msg: ConversationMessage = {
      id: `msg_${this.messageCounter++}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      question,
    };
    this.messages.push(msg);
    return msg;
  }
}
