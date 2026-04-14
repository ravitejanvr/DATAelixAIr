/**
 * Conversation Engine — V4 Turn-Based Clinical Interaction Pipeline
 *
 * DETERMINISTIC STATE MACHINE:
 *   IDLE → LISTENING → PROCESSING → THINKING → ASKING → WAITING_FOR_USER → ...
 *
 * SINGLE execution flow per turn:
 *   User Input → normalizeTranscript() → processTranscript() (scribe+canonical)
 *   → LLM extraction → merge into SessionContextManager (SSOT)
 *   → runClinicalPipelineV4() → question generation → UI
 *
 * Rules:
 * - TurnController enforces exactly ONE question per turn
 * - SessionContextManager is the ONLY state store
 * - No raw strings beyond canonicalization boundary
 * - No parallel execution (processing lock)
 * - Questions adapt to already-known context
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
import { TurnController } from "./turn_controller";
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
  private turn: TurnController;
  private messages: ConversationMessage[] = [];
  private askedQuestionIds = new Set<string>();
  private askedQuestionTexts = new Set<string>();
  private pendingQuestions: ClinicalQuestion[] = [];
  private latestPipelineResult: PipelineOutput | null = null;
  private messageCounter = 0;

  /** Persistent session state exposed to UI */
  private sessionState: SessionState = this.defaultSessionState();

  private defaultSessionState(): SessionState {
    return {
      mode: "text",
      language: "unknown",
      transcriptBuffer: [],
      lastQuestionId: null,
      voice: { isActive: false, hasGreeted: false },
      collectedFields: {},
      fsm_state: "IDLE",
    };
  }

  constructor() {
    this.session = new SessionContextManager();
    this.turn = new TurnController();
  }

  // ══════════════════════════════════════════════
  // SESSION STATE METHODS
  // ══════════════════════════════════════════════

  setMode(mode: InteractionMode): void {
    this.sessionState.mode = mode;
    this.sessionState.voice.isActive = mode === "voice";
  }

  getMode(): InteractionMode {
    return this.sessionState.mode;
  }

  getLanguage(): SupportedLanguage {
    return this.sessionState.language;
  }

  /** Get current FSM state */
  getFSMState() {
    return this.turn.state;
  }

  /** Check if system is ready for user input */
  isAcceptingInput(): boolean {
    return this.turn.isAcceptingInput;
  }

  /** Start a voice session. Returns greeting text if first time. */
  startVoiceSession(): { greeting: string | null; state: UIState } {
    this.sessionState.mode = "voice";
    this.sessionState.voice.isActive = true;

    let greeting: string | null = null;
    if (!this.sessionState.voice.hasGreeted) {
      this.sessionState.voice.hasGreeted = true;
      const response = this.generateResponse({ type: "greeting" }, this.sessionState);
      this.appendGeneratedResponse(response);
      greeting = response.primaryText;
    }

    // After greeting, move to WAITING_FOR_USER
    if (this.turn.state === "IDLE") {
      // Transition IDLE → PROCESSING (greeting) → ASKING → WAITING_FOR_USER quickly
      // Since greeting is synchronous, go directly to WAITING
      this.turn.transition("LISTENING");
      this.turn.transition("PROCESSING");
      this.turn.transition("THINKING");
      this.turn.transition("ASKING");
      this.turn.transition("WAITING_FOR_USER");
    }

    this.syncFSMState();
    return { greeting, state: this.getCurrentState() };
  }

  /** Stop voice session */
  stopVoiceSession(): UIState {
    this.sessionState.voice.isActive = false;
    // Reset FSM to IDLE
    if (this.turn.state !== "IDLE") {
      this.turn.reset();
      this.turn.transition("IDLE" as any); // reset already sets IDLE
    }
    this.syncFSMState();
    return this.getCurrentState();
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
    return this.processUserInput(fullText);
  }

  // ══════════════════════════════════════════════
  // CORE INTERACTION — TURN-BASED PIPELINE
  // ══════════════════════════════════════════════

  /**
   * MAIN ENTRY POINT for all user input (voice or text).
   *
   * Strict turn-based execution:
   *   1. GUARD: assert accepting input + acquire lock
   *   2. PROCESSING: clean + normalize + scribe extraction
   *   3. THINKING: LLM extraction + merge into SSOT + run pipeline
   *   4. ASKING: generate response + question
   *   5. WAITING_FOR_USER: release for next input
   */
  async processUserInput(text: string): Promise<UIState> {
    // ── GUARD: Only accept input in valid states ──
    if (!this.turn.isAcceptingInput) {
      console.warn(`[TURN] Rejecting input — FSM state: ${this.turn.state}`);
      return this.getCurrentState();
    }
    if (!this.turn.acquireLock()) {
      console.warn("[TURN] Rejecting input — processing lock held");
      return this.getCurrentState();
    }

    try {
      return await this.executeTurn(text);
    } catch (err) {
      console.error("[TURN] Turn execution failed:", err);
      this.turn.error();
      this.syncFSMState();
      // Recover to IDLE so user can retry
      this.turn.transition("IDLE");
      this.syncFSMState();
      return this.getCurrentState();
    } finally {
      this.turn.releaseLock();
    }
  }

  /**
   * Legacy alias — routes to processUserInput for backward compatibility.
   */
  async processTextInput(text: string): Promise<UIState> {
    return this.processUserInput(text);
  }

  /**
   * Execute a single turn — the core deterministic pipeline.
   */
  private async executeTurn(rawInput: string): Promise<UIState> {
    this.turn.beginTurn();

    // ═══ PROCESSING ═══
    this.turn.transition("PROCESSING");
    this.syncFSMState();

    // Step 1: Clean STT artifacts
    const cleanedText = cleanTranscript(rawInput);
    if (!cleanedText) {
      this.turn.transition("THINKING");
      this.turn.transition("ASKING");
      this.turn.transition("WAITING_FOR_USER");
      this.syncFSMState();
      return this.getCurrentState();
    }

    // Step 2: Detect & lock language
    this.lockSessionLanguage(cleanedText);
    console.log("[TURN] Lang:", this.sessionState.language, "| Input:", cleanedText);

    // Step 3: Normalize transcript for extraction
    const normalizedText = normalizeTranscript(cleanedText, this.sessionState.language);

    // Add user message
    const userMsg = this.addMessage("user", cleanedText);

    // Step 4: Scribe extraction + canonicalization (ALWAYS runs)
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
    if (scribeOutput.extracted_symptoms.length > 0) {
      this.session.updateFromExtraction(scribeOutput.extracted_symptoms, "patient_text");
    }

    userMsg.extracted_features = this.session.getCanonicalFeatures().map(f => f.feature_id);

    // ═══ THINKING ═══
    this.turn.transition("THINKING");
    this.syncFSMState();

    // Step 5: LLM extraction (semantic understanding)
    const llmResult = await this.runLLMExtraction(normalizedText);

    // Step 6: Sync LLM entities into SessionContextManager (SSOT)
    if (llmResult?.extracted_entities) {
      this.session.syncFromLLMEntities(llmResult.extracted_entities, "patient_text");
      console.log("[SYNC] Session features after merge:", this.session.getCanonicalFeatures().length);
    }

    // Step 7: Run clinical pipeline with UNIFIED state
    await this.runPipeline();

    // ═══ ASKING ═══
    this.turn.transition("ASKING");
    this.syncFSMState();

    // Step 8: Generate response (acknowledgment + next question)
    let responseText: string | null = null;
    if (llmResult) {
      responseText = this.appendLLMResponse(llmResult);
    } else {
      const response = this.generateResponse({ type: "pipeline", input: cleanedText }, this.sessionState);
      this.appendGeneratedResponse(response);
      responseText = response.primaryText;
    }

    // Log the completed turn
    this.turn.logTurn({
      input: cleanedText,
      extracted: {
        scribe_symptoms: scribeOutput.extracted_symptoms.length,
        canonical_features: scribeOutput.canonicalization?.features.length ?? 0,
        llm_entities: llmResult?.extracted_entities ? {
          symptoms: llmResult.extracted_entities.symptoms?.length ?? 0,
          duration: llmResult.extracted_entities.duration,
          severity: llmResult.extracted_entities.severity,
        } : null,
      },
      session_snapshot: {
        features: this.session.getCanonicalFeatures().map(f => ({
          id: f.feature_id,
          intensity: f.intensity,
          duration: f.duration,
        })),
        has_symptoms: this.session.hasData("symptoms"),
        has_duration: this.session.hasData("duration"),
        has_severity: this.session.hasData("severity"),
        has_age: this.session.hasData("age"),
        has_medications: this.session.hasData("medications"),
      },
      next_question: this.pendingQuestions[0]?.text ?? null,
    });

    // ═══ WAITING_FOR_USER ═══
    this.turn.transition("WAITING_FOR_USER");
    this.syncFSMState();

    return this.getCurrentState();
  }

  async answerQuestion(questionId: string, answer: string): Promise<UIState> {
    const normalizedAnswer = answer.trim();
    if (!normalizedAnswer) return this.getCurrentState();

    // Mark question as answered
    this.askedQuestionIds.add(questionId);
    const question = this.pendingQuestions.find(q => q.question_id === questionId);
    if (question) {
      this.askedQuestionTexts.add(this.normalizeQuestionText(question.text));
    }
    this.session.updateFromAnswers(questionId, normalizedAnswer);
    this.pendingQuestions = this.pendingQuestions.filter(q => q.question_id !== questionId);

    // Process through full pipeline
    return this.processUserInput(normalizedAnswer);
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
      is_processing: this.turn.isProcessing,
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
    this.turn.reset();
    this.messages = [];
    this.askedQuestionIds.clear();
    this.askedQuestionTexts.clear();
    this.pendingQuestions = [];
    this.latestPipelineResult = null;
    this.messageCounter = 0;
    this.sessionState = this.defaultSessionState();
  }

  // ══════════════════════════════════════════════
  // INTERNAL METHODS
  // ══════════════════════════════════════════════

  private syncFSMState(): void {
    this.sessionState.fsm_state = this.turn.state;
  }

  private async runPipeline(): Promise<void> {
    const input = this.session.toPipelineInput();
    this.latestPipelineResult = await runClinicalPipelineV4(input);

    // Filter out already-asked questions + questions for known data
    const newQuestions = this.latestPipelineResult.questions.questions
      .filter(q => {
        if (this.askedQuestionIds.has(q.question_id)) return false;
        if (this.askedQuestionTexts.has(this.normalizeQuestionText(q.text))) return false;
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

      // Exactly ONE question per turn
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
   * Returns the primary text for TTS.
   */
  private appendLLMResponse(result: LLMExtractionResult): string | null {
    let primaryText: string | null = null;

    // Add acknowledgment as system message
    if (result.acknowledgment) {
      this.addMessage("system", result.acknowledgment);
      primaryText = result.acknowledgment;
    }

    // Add EXACTLY ONE dynamic question if not all fields are collected
    if (!result.all_fields_collected && result.next_question) {
      const q = result.next_question;
      const questionId = `llm_q_${q.field}_${this.messageCounter}`;

      // Check dedup before adding
      const normalizedText = this.normalizeQuestionText(q.text);
      if (!this.askedQuestionTexts.has(normalizedText) && !this.session.hasData(q.field)) {
        this.askedQuestionIds.add(questionId);
        this.askedQuestionTexts.add(normalizedText);
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
        primaryText = q.text;
      }
    }

    return primaryText;
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
