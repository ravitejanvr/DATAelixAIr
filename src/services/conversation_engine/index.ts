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
 * - Prioritizes critical → high → medium questions
 * - No raw strings beyond canonicalization boundary
 */

import { SessionContextManager } from "../session_context";
import type { UploadedFile } from "../session_context/types";
import { extractFromTranscript } from "../scribe_adapter/extractor";
import { runClinicalPipelineV4 } from "../pipeline";
import type { PipelineOutput, ClinicalQuestion, PipelineVitals } from "../pipeline/types";
import type { ConversationMessage, UIState } from "./types";

export type { ConversationMessage, UIState } from "./types";

export class ConversationEngine {
  private session: SessionContextManager;
  private messages: ConversationMessage[] = [];
  private askedQuestionIds = new Set<string>();
  private pendingQuestions: ClinicalQuestion[] = [];
  private latestPipelineResult: PipelineOutput | null = null;
  private isProcessing = false;
  private messageCounter = 0;

  constructor() {
    this.session = new SessionContextManager();
  }

  // ══════════════════════════════════════════════
  // CORE INTERACTION METHODS
  // ══════════════════════════════════════════════

  /**
   * Process text input from user (typed or transcribed).
   * Full flow: extract → canonicalize → update context → run pipeline → generate questions.
   */
  async processTextInput(text: string): Promise<UIState> {
    this.isProcessing = true;

    // Add user message
    const userMsg = this.addMessage("user", text);

    // Extract symptoms via scribe adapter
    const extracted = extractFromTranscript(text);

    // Update session context (canonicalization happens inside)
    this.session.updateFromExtraction(extracted, "patient_text");

    // Track which features were extracted for this message
    const features = this.session.getCanonicalFeatures();
    const featureIds = features.map(f => f.feature_id);
    userMsg.extracted_features = featureIds;

    // Run pipeline
    await this.runPipeline();

    // Generate system response
    this.generateSystemResponse();

    this.isProcessing = false;
    return this.getCurrentState();
  }

  /**
   * Answer a follow-up question.
   */
  async answerQuestion(questionId: string, answer: string): Promise<UIState> {
    this.isProcessing = true;

    // Mark as answered
    this.askedQuestionIds.add(questionId);
    this.session.updateFromAnswers(questionId, answer);

    // Add user answer message
    const question = this.pendingQuestions.find(q => q.question_id === questionId);
    this.addMessage("user", answer);

    // Remove from pending
    this.pendingQuestions = this.pendingQuestions.filter(q => q.question_id !== questionId);

    // Re-run pipeline with updated context
    await this.runPipeline();
    this.generateSystemResponse();

    this.isProcessing = false;
    return this.getCurrentState();
  }

  /**
   * Attach vitals to the session.
   */
  async attachVitals(vitals: PipelineVitals): Promise<UIState> {
    this.session.attachVitals(vitals);
    this.addMessage("system", "Vitals recorded.");
    await this.runPipeline();
    return this.getCurrentState();
  }

  /**
   * Attach files to the session.
   */
  async attachFiles(files: UploadedFile[]): Promise<UIState> {
    this.session.attachFiles(files);
    const names = files.map(f => f.file_name).join(", ");
    this.addMessage("system", `Files attached: ${names}`);
    await this.runPipeline();
    return this.getCurrentState();
  }

  /**
   * Set patient demographics.
   */
  async setDemographics(data: { age?: number; sex?: string; name?: string }): Promise<UIState> {
    this.session.setDemographics(data);
    await this.runPipeline();
    return this.getCurrentState();
  }

  /**
   * Get current UI state.
   */
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
    };
  }

  /**
   * Reset the entire session.
   */
  reset(): void {
    this.session.reset();
    this.messages = [];
    this.askedQuestionIds.clear();
    this.pendingQuestions = [];
    this.latestPipelineResult = null;
    this.isProcessing = false;
    this.messageCounter = 0;
  }

  // ══════════════════════════════════════════════
  // INTERNAL METHODS
  // ══════════════════════════════════════════════

  private async runPipeline(): Promise<void> {
    const input = this.session.toPipelineInput();
    this.latestPipelineResult = await runClinicalPipelineV4(input);

    // Update pending questions (filter out already asked)
    const newQuestions = this.latestPipelineResult.questions.questions
      .filter(q => !this.askedQuestionIds.has(q.question_id))
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      });

    this.pendingQuestions = newQuestions;
  }

  private generateSystemResponse(): void {
    if (!this.latestPipelineResult) return;

    const result = this.latestPipelineResult;
    const features = this.session.getCanonicalFeatures();

    // Summary of what was detected
    if (features.length > 0) {
      const featureList = features.map(f => f.feature_id).join(", ");
      this.addMessage("system",
        `Detected: ${featureList}. Confidence: ${(result.confidence.overall_confidence * 100).toFixed(0)}%`
      );
    }

    // Safety alerts
    if (result.safety.safety_alerts.length > 0) {
      for (const alert of result.safety.safety_alerts) {
        this.addMessage("system", `⚠️ Safety Alert: ${alert.condition} — ${alert.action}`);
      }
    }

    // Ask next priority question
    if (this.pendingQuestions.length > 0) {
      const nextQ = this.pendingQuestions[0];
      this.addMessage("question", nextQ.text, nextQ);
    }
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
