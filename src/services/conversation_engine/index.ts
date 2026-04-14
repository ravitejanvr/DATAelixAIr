/**
 * Conversation Engine — V4 Unified Clinical Interaction Pipeline
 *
 * SINGLE execution flow:
 *   User Input → normalizeTranscript() → processTranscript() (scribe+canonical)
 *   → LLM extraction → merge into SessionContextManager (SSOT)
 *   → runClinicalPipelineV4() → question generation → UI
 *
 * Rules:
 * - SessionContextManager is the ONLY state store
 * - No raw strings beyond canonicalization boundary
 * - Questions adapt to already-known context
 * - Unicode-safe deduplication for multilingual support
 */

import { SessionContextManager } from "../session_context";
import type { UploadedFile } from "../session_context/types";
import { processTranscript } from "../scribe_adapter";
import { detectLanguage } from "../canonical/normalizer";
import { runClinicalPipelineV4 } from "../pipeline";
import type { PipelineOutput, ClinicalQuestion, PipelineVitals } from "../pipeline/types";
import type { SupportedLanguage } from "../canonical/types";
import type { ConversationMessage, UIState, SessionState, InteractionMode, VoiceSession } from "./types";
import { normalizeTranscript } from "./transcript_normalizer";
import {
  extractClinicalEntitiesLLM,
  mergeEntitiesIntoCollected,
  type CollectedFields,
  type LLMExtractionResult,
} from "./llm_extraction";
import {
  assertNoEnglishFallback,
  getSystemMessage,
  translateOptionLabel,
  translateQuestion,
  translateSafetyAction,
  translateSafetyCondition,
  toConversationalTone as toConversationalToneML,
  cleanTranscript,
  isNegativeResponse,
} from "./translations";

export type { ConversationMessage, UIState, SessionState, InteractionMode, VoiceSession } from "./types";

/** Question category priority order */
const CATEGORY_PRIORITY: Record<string, number> = {
  symptom_expansion: 0,
  severity: 1,
  associated_symptoms: 2,
  risk_factors: 3,
  history: 4,
  demographics: 5,
};

type ResponseInput =
  | { type: "greeting" }
  | { type: "pipeline"; input: string }
  | { type: "vitals_recorded" }
  | { type: "files_attached"; names: string }
  | { type: "demographics_updated" };

interface GeneratedMessage {
  role: "system" | "question";
  content: string;
  question?: ClinicalQuestion;
  questionOptionLabels?: Record<string, string>;
}

interface GeneratedResponse {
  messages: GeneratedMessage[];
  primaryText: string | null;
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
  private sessionState: SessionState = this.defaultSessionState();

  private defaultSessionState(): SessionState {
    return {
      mode: "text",
      language: "unknown",
      transcriptBuffer: [],
      lastQuestionId: null,
      voice: { isActive: false, turn: "idle", hasGreeted: false, isProcessing: false },
      collectedFields: {},
    };
  }

  constructor() {
    this.session = new SessionContextManager();
  }

  // ══════════════════════════════════════════════
  // SESSION STATE METHODS
  // ══════════════════════════════════════════════

  setMode(mode: InteractionMode): void {
    this.sessionState.mode = mode;
    this.sessionState.voice.isActive = mode === "voice";
    if (mode === "text") {
      this.sessionState.voice.turn = "idle";
      this.sessionState.voice.isProcessing = false;
    }
  }

  getMode(): InteractionMode {
    return this.sessionState.mode;
  }

  getLanguage(): SupportedLanguage {
    return this.sessionState.language;
  }

  getVoiceSession(): VoiceSession {
    return { ...this.sessionState.voice };
  }

  /** Start a voice session. Returns greeting text if first time. */
  startVoiceSession(): { greeting: string | null; state: UIState } {
    this.sessionState.mode = "voice";
    this.sessionState.voice.isActive = true;
    this.sessionState.voice.turn = "system";

    let greeting: string | null = null;
    if (!this.sessionState.voice.hasGreeted) {
      this.sessionState.voice.hasGreeted = true;
      const response = this.generateResponse({ type: "greeting" }, this.sessionState);
      this.appendGeneratedResponse(response);
      greeting = response.primaryText;
    }

    this.sessionState.voice.turn = "user";
    return { greeting, state: this.getCurrentState() };
  }

  /** Stop voice session */
  stopVoiceSession(): UIState {
    this.sessionState.voice.isActive = false;
    this.sessionState.voice.turn = "idle";
    this.sessionState.voice.isProcessing = false;
    return this.getCurrentState();
  }

  /** Check if system is ready for user input (turn-based guard) */
  isUserTurn(): boolean {
    if (this.sessionState.mode !== "voice") return true;
    return this.sessionState.voice.turn === "user" && !this.sessionState.voice.isProcessing;
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
  // CORE INTERACTION — UNIFIED PIPELINE
  // ══════════════════════════════════════════════

  /**
   * MAIN ENTRY POINT for all user input (voice or text).
   *
   * Execution order (CORRECT):
   *   1. Clean + normalize transcript
   *   2. Detect & lock language
   *   3. Run scribe extraction + canonicalization (processTranscript)
   *   4. Run LLM extraction (semantic understanding)
   *   5. Sync ALL results into SessionContextManager (SSOT)
   *   6. Run clinical pipeline (reasoning + question generation)
   *   7. Generate response (acknowledgment + next question)
   *   8. Render to UI
   */
  async processTextInput(text: string): Promise<UIState> {
    // ── Step 1: Clean STT artifacts ──
    const cleanedText = cleanTranscript(text);
    if (!cleanedText) return this.getCurrentState();

    // Turn-based guard for voice mode
    if (this.sessionState.mode === "voice") {
      if (this.sessionState.voice.isProcessing) return this.getCurrentState();
      this.sessionState.voice.turn = "system";
      this.sessionState.voice.isProcessing = true;
    }
    this.isProcessing = true;

    // ── Step 2: Detect & lock language ──
    this.lockSessionLanguage(cleanedText);
    console.log("[PIPELINE] Lang:", this.sessionState.language, "| Input:", cleanedText);

    // ── Step 3: Normalize transcript for extraction ──
    const normalizedText = normalizeTranscript(cleanedText, this.sessionState.language);

    const userMsg = this.addMessage("user", cleanedText);

    // ── Step 4: Scribe extraction + canonicalization (ALWAYS runs) ──
    const scribeOutput = processTranscript(normalizedText);
    console.log("[SCRIBE] Extracted:", scribeOutput.extracted_symptoms.length, "symptoms,",
      scribeOutput.canonicalization?.features.length ?? 0, "canonical features");

    // Write scribe canonical features into SessionContextManager
    if (scribeOutput.canonicalization?.features.length) {
      this.session.updateFromCanonicalFeatures(
        scribeOutput.canonicalization.features,
        "patient_text"
      );
    }
    // Also write raw extraction (for duration/severity enrichment)
    if (scribeOutput.extracted_symptoms.length > 0) {
      this.session.updateFromExtraction(scribeOutput.extracted_symptoms, "patient_text");
    }

    // Tag user message with extracted features
    userMsg.extracted_features = this.session.getCanonicalFeatures().map(f => f.feature_id);

    // ── Step 5: LLM extraction (semantic understanding) — runs in parallel intent ──
    const llmResult = await this.runLLMExtraction(normalizedText);

    // ── Step 6: Sync LLM entities into SessionContextManager (SSOT) ──
    if (llmResult?.extracted_entities) {
      this.session.syncFromLLMEntities(llmResult.extracted_entities, "patient_text");
      console.log("[SYNC] Session features after merge:", this.session.getCanonicalFeatures().length);
    }

    // ── Step 7: Run clinical pipeline with UNIFIED state ──
    await this.runPipeline();

    // ── Step 8: Generate response ──
    if (llmResult) {
      this.appendLLMResponse(llmResult);
    } else {
      // Fallback: use pipeline-generated questions
      this.appendGeneratedResponse(
        this.generateResponse({ type: "pipeline", input: cleanedText }, this.sessionState)
      );
    }

    this.isProcessing = false;

    // Release turn back to user
    if (this.sessionState.mode === "voice") {
      this.sessionState.voice.isProcessing = false;
      this.sessionState.voice.turn = "user";
    }

    return this.getCurrentState();
  }

  async answerQuestion(questionId: string, answer: string): Promise<UIState> {
    const normalizedAnswer = answer.trim();
    if (!normalizedAnswer) return this.getCurrentState();

    this.isProcessing = true;
    this.lockSessionLanguage(normalizedAnswer);

    // Mark question as answered
    this.askedQuestionIds.add(questionId);
    const question = this.pendingQuestions.find(q => q.question_id === questionId);
    if (question) {
      this.askedQuestionTexts.add(this.normalizeQuestionText(question.text));
    }

    this.session.updateFromAnswers(questionId, normalizedAnswer);
    this.addMessage("user", normalizedAnswer);
    this.pendingQuestions = this.pendingQuestions.filter(q => q.question_id !== questionId);

    // Normalize + scribe extract the answer too
    const normalized = normalizeTranscript(normalizedAnswer, this.sessionState.language);
    const scribeOutput = processTranscript(normalized);
    if (scribeOutput.canonicalization?.features.length) {
      this.session.updateFromCanonicalFeatures(scribeOutput.canonicalization.features, "question_answer");
    }

    // LLM extraction
    const llmResult = await this.runLLMExtraction(normalized);
    if (llmResult?.extracted_entities) {
      this.session.syncFromLLMEntities(llmResult.extracted_entities, "question_answer");
    }

    // Pipeline with unified state
    await this.runPipeline();

    if (llmResult) {
      this.appendLLMResponse(llmResult);
    } else {
      this.appendGeneratedResponse(
        this.generateResponse({ type: "pipeline", input: normalizedAnswer }, this.sessionState)
      );
    }

    this.isProcessing = false;
    return this.getCurrentState();
  }

  async attachVitals(vitals: PipelineVitals): Promise<UIState> {
    this.session.attachVitals(vitals);
    await this.runPipeline();
    this.appendGeneratedResponse(
      this.generateResponse({ type: "vitals_recorded" }, this.sessionState)
    );
    return this.getCurrentState();
  }

  async attachFiles(files: UploadedFile[]): Promise<UIState> {
    this.session.attachFiles(files);
    const names = files.map(f => f.file_name).join(", ");
    await this.runPipeline();
    this.appendGeneratedResponse(
      this.generateResponse({ type: "files_attached", names }, this.sessionState)
    );
    return this.getCurrentState();
  }

  async setDemographics(data: { age?: number; sex?: string; name?: string }): Promise<UIState> {
    this.session.setDemographics(data);
    await this.runPipeline();
    this.appendGeneratedResponse(
      this.generateResponse({ type: "demographics_updated" }, this.sessionState)
    );
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
    this.sessionState = this.defaultSessionState();
  }

  // ══════════════════════════════════════════════
  // INTERNAL METHODS
  // ══════════════════════════════════════════════

  private async runPipeline(): Promise<void> {
    const input = this.session.toPipelineInput();
    this.latestPipelineResult = await runClinicalPipelineV4(input);

    // Filter out already-asked questions using both ID and normalized text
    // Also skip questions for data we already have in session
    const newQuestions = this.latestPipelineResult.questions.questions
      .filter(q => {
        if (this.askedQuestionIds.has(q.question_id)) return false;
        if (this.askedQuestionTexts.has(this.normalizeQuestionText(q.text))) return false;
        // Skip questions for already-collected data
        if (this.session.hasData(q.category)) return false;
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

  private generateResponse(input: ResponseInput, session: SessionState): GeneratedResponse {
    const lang = session.language;
    const messages: GeneratedMessage[] = [];

    const pushMessage = (
      role: GeneratedMessage["role"],
      content: string,
      context: string,
      question?: ClinicalQuestion,
      questionOptionLabels?: Record<string, string>,
      validate = true
    ) => {
      messages.push({
        role,
        content: validate ? assertNoEnglishFallback(content, lang, context) : content,
        question,
        questionOptionLabels,
      });
    };

    if (input.type === "greeting") {
      if (lang !== "unknown") {
        pushMessage("system", getSystemMessage("greeting", lang), "greeting");
      }
      return {
        messages,
        primaryText: messages.length > 0 ? messages[messages.length - 1].content : null,
      };
    }

    if (input.type === "vitals_recorded") {
      pushMessage("system", getSystemMessage("vitals_recorded", lang), "vitals_recorded");
    }

    if (input.type === "files_attached") {
      pushMessage(
        "system",
        getSystemMessage("files_attached", lang, { names: input.names }),
        "files_attached",
        undefined,
        undefined,
        false
      );
    }

    if (this.latestPipelineResult) {
      const result = this.latestPipelineResult;
      const features = this.session.getCanonicalFeatures();

      if (features.length > 0) {
        const confidence = (result.confidence.overall_confidence * 100).toFixed(0);
        pushMessage("system", getSystemMessage("noted", lang, { confidence }), "pipeline_noted");
      }

      for (const alert of result.safety.safety_alerts) {
        pushMessage(
          "system",
          getSystemMessage("safety_alert", lang, {
            condition: translateSafetyCondition(alert.condition, lang),
            action: translateSafetyAction(alert.action, lang),
          }),
          `safety:${alert.alert_id}`
        );
      }

      if (this.pendingQuestions.length > 0) {
        const nextQ = this.pendingQuestions[0];
        const normalized = this.normalizeQuestionText(nextQ.text);

        if (!this.askedQuestionTexts.has(normalized)) {
          const translatedText = translateQuestion(nextQ.text, lang);
          const conversationalText = toConversationalToneML(translatedText, lang);
          const questionOptionLabels = nextQ.options
            ? Object.fromEntries(nextQ.options.map(option => [option, translateOptionLabel(option, lang)]))
            : undefined;

          this.askedQuestionTexts.add(normalized);
          this.askedQuestionIds.add(nextQ.question_id);
          this.sessionState.lastQuestionId = nextQ.question_id;

          pushMessage(
            "question",
            conversationalText,
            `question:${nextQ.question_id}`,
            nextQ,
            questionOptionLabels
          );
        }
      }
    }

    const primaryMessage = [...messages].reverse().find(
      message => message.role === "question" || message.role === "system"
    );

    return {
      messages,
      primaryText: primaryMessage?.content ?? null,
    };
  }

  private lockSessionLanguage(text: string): void {
    if (this.sessionState.language !== "unknown") return;

    const detectedLanguage = detectLanguage(text);
    if (detectedLanguage !== "unknown") {
      this.sessionState.language = detectedLanguage;
    }
  }

  private appendGeneratedResponse(response: GeneratedResponse): void {
    for (const message of response.messages) {
      this.addMessage(message.role, message.content, message.question, message.questionOptionLabels);
    }
  }

  /**
   * Unicode-safe question text normalization for dedup comparison.
   * Handles Telugu, Hindi, Tamil, and English correctly.
   */
  private normalizeQuestionText(text: string): string {
    return text
      .normalize("NFKD")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Run LLM extraction — extracts entities + generates next question dynamically.
   * Falls back to null if LLM call fails (pipeline questions used as fallback).
   */
  private async runLLMExtraction(userInput: string): Promise<LLMExtractionResult | null> {
    try {
      const result = await extractClinicalEntitiesLLM(
        userInput,
        this.sessionState.collectedFields,
        this.sessionState.language
      );

      if (!result) return null;

      // Merge extracted entities into collected fields
      this.sessionState.collectedFields = mergeEntitiesIntoCollected(
        this.sessionState.collectedFields,
        result.extracted_entities
      );

      // Demographics and medications also written to SessionContextManager
      // (syncFromLLMEntities handles this in the caller)

      console.log("[LLM] Collected fields:", JSON.stringify(this.sessionState.collectedFields));
      console.log("[LLM] Acknowledgment:", result.acknowledgment);
      console.log("[LLM] Next question:", result.next_question?.text);

      return result;
    } catch (err) {
      console.error("[LLM] Extraction failed, falling back to pipeline:", err);
      return null;
    }
  }

  /**
   * Append LLM-generated acknowledgment + dynamic question to messages.
   */
  private appendLLMResponse(result: LLMExtractionResult): void {
    // Add acknowledgment as system message
    if (result.acknowledgment) {
      this.addMessage("system", result.acknowledgment);
    }

    // Add dynamic question if not all fields are collected
    if (!result.all_fields_collected && result.next_question) {
      const q = result.next_question;
      const questionId = `llm_q_${q.field}_${this.messageCounter}`;

      // Track to prevent re-asking
      this.askedQuestionIds.add(questionId);
      this.askedQuestionTexts.add(this.normalizeQuestionText(q.text));
      this.sessionState.lastQuestionId = questionId;

      const clinicalQuestion: ClinicalQuestion = {
        question_id: questionId,
        text: q.text,
        category: q.field,
        priority: q.priority,
        options: q.options,
      };

      const optionLabels = q.options
        ? Object.fromEntries(q.options.map(opt => [opt, opt]))
        : undefined;

      const msg = this.addMessage("question", q.text, clinicalQuestion, optionLabels);
      msg.llm_question = q;

      this.pendingQuestions = [clinicalQuestion];
    }
  }

  private addMessage(
    role: ConversationMessage["role"],
    content: string,
    question?: ClinicalQuestion,
    questionOptionLabels?: Record<string, string>
  ): ConversationMessage {
    const msg: ConversationMessage = {
      id: `msg_${this.messageCounter++}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      question,
      question_option_labels: questionOptionLabels,
    };
    this.messages.push(msg);
    return msg;
  }
}
