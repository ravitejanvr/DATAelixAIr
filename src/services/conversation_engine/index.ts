/**
 * Conversation Engine — V4 Turn-Based Clinical Interaction Pipeline
 *
 * DETERMINISTIC STATE MACHINE:
 *   IDLE → LISTENING → PROCESSING → THINKING → ASKING → WAITING_FOR_USER → ...
 *
 * SINGLE execution flow per turn:
 *   User Input → classifyIntent() → normalizeTranscript()
 *   → processTranscript() (scribe+canonical) → LLM extraction
 *   → merge into SessionContextManager (SSOT) → decideNextStep() → UI
 *
 * Rules:
 * - TurnController enforces exactly ONE question per turn
 * - SessionContextManager is the ONLY state store (no collectedFields)
 * - No raw strings beyond canonicalization boundary
 * - No parallel execution (processing lock)
 * - Questions adapt to already-known context
 * - Intent classification gates pipeline execution
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
import { classifyIntent, type UserIntent } from "./intent_classifier";
import {
  decideNextStep,
  getClarificationResponse,
  getAcknowledgment,
  type QuestionMeta,
  type NextAction,
} from "./reasoning_engine";
import {
  extractClinicalEntitiesLLM,
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

type ResponseInput =
  | { type: "greeting" }
  | { type: "pipeline"; input: string }
  | { type: "vitals_recorded" }
  | { type: "files_attached"; names: string }
  | { type: "demographics_updated" };

export class ConversationEngine {
  private session: SessionContextManager;
  private turn: TurnController;
  private messages: ConversationMessage[] = [];
  private askedQuestionIds = new Set<string>();
  private askedQuestionTexts = new Set<string>();
  private pendingQuestions: ClinicalQuestion[] = [];
  private latestPipelineResult: PipelineOutput | null = null;
  private messageCounter = 0;
  /** Per-field attempt counter for rephrasing */
  private fieldAttempts = new Map<string, number>();

  /** Persistent session state exposed to UI */
  private sessionState: SessionState = this.defaultSessionState();

  private defaultSessionState(): SessionState {
    return {
      mode: "text",
      language: "unknown",
      transcriptBuffer: [],
      lastQuestionId: null,
      voice: { isActive: false, hasGreeted: false },
      collectedFields: {}, // Kept for backward compat but DERIVED from session
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

  getFSMState() {
    return this.turn.state;
  }

  isAcceptingInput(): boolean {
    return this.turn.isAcceptingInput;
  }

  startVoiceSession(): { greeting: string | null; state: UIState } {
    this.sessionState.mode = "voice";
    this.sessionState.voice.isActive = true;

    let greeting: string | null = null;
    if (!this.sessionState.voice.hasGreeted) {
      this.sessionState.voice.hasGreeted = true;
      const lang = this.sessionState.language;
      greeting = getSystemMessage("greeting", lang);
      this.addMessage("system", greeting);
    }

    if (this.turn.state === "IDLE") {
      this.turn.transition("LISTENING");
      this.turn.transition("PROCESSING");
      this.turn.transition("THINKING");
      this.turn.transition("ASKING");
      this.turn.transition("WAITING_FOR_USER");
    }

    this.syncFSMState();
    return { greeting, state: this.getCurrentState() };
  }

  stopVoiceSession(): UIState {
    this.sessionState.voice.isActive = false;
    if (this.turn.state !== "IDLE") {
      this.turn.reset();
    }
    this.syncFSMState();
    return this.getCurrentState();
  }

  bufferTranscript(chunk: string): void {
    if (chunk.trim()) {
      this.sessionState.transcriptBuffer.push(chunk.trim());
    }
  }

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
   * Flow:
   *   1. GUARD: assert accepting input + acquire lock
   *   2. CLASSIFY: determine intent
   *   3. PROCESSING: clean + normalize + scribe extraction (only for clinical intents)
   *   4. THINKING: LLM extraction + merge into SSOT + reasoning
   *   5. ASKING: generate response via reasoning engine
   *   6. WAITING_FOR_USER: release for next input
   */
  async processUserInput(text: string): Promise<UIState> {
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
      this.turn.transition("IDLE");
      this.syncFSMState();
      return this.getCurrentState();
    } finally {
      this.turn.releaseLock();
    }
  }

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
      this.transitionToWaiting();
      return this.getCurrentState();
    }

    // Step 2: Detect & lock language
    this.lockSessionLanguage(cleanedText);
    const lang = this.sessionState.language;

    // Step 3: Classify intent
    const hasActiveQuestion = this.sessionState.lastQuestionId !== null && this.pendingQuestions.length > 0;
    const intent = classifyIntent(cleanedText, lang, hasActiveQuestion);
    console.log("[TURN] Intent:", intent, "| Lang:", lang, "| Input:", cleanedText);

    // Add user message
    this.addMessage("user", cleanedText);

    // Step 4: Handle non-clinical intents WITHOUT full pipeline
    if (intent === "GREETING") {
      this.turn.transition("THINKING");
      this.turn.transition("ASKING");
      const greetText = getSystemMessage("greeting", lang);
      this.addMessage("system", greetText);
      this.turn.transition("WAITING_FOR_USER");
      this.syncFSMState();
      this.logTurnDebug(cleanedText, intent, null);
      return this.getCurrentState();
    }

    if (intent === "ACKNOWLEDGEMENT") {
      this.turn.transition("THINKING");
      this.turn.transition("ASKING");
      const ack = getAcknowledgment(lang);
      this.addMessage("system", ack);
      // Re-ask the pending question if there is one
      if (this.pendingQuestions.length > 0) {
        // Don't add a new question — the pending one is still valid
      }
      this.turn.transition("WAITING_FOR_USER");
      this.syncFSMState();
      this.logTurnDebug(cleanedText, intent, null);
      return this.getCurrentState();
    }

    // Step 5: Normalize transcript for extraction
    const normalizedText = normalizeTranscript(cleanedText, lang);

    // Step 6: Scribe extraction + canonicalization (ALWAYS for clinical intents)
    const scribeOutput = processTranscript(normalizedText);
    console.log("[SCRIBE] Extracted:", scribeOutput.extracted_symptoms.length, "symptoms,",
      scribeOutput.canonicalization?.features.length ?? 0, "canonical features");

    if (scribeOutput.canonicalization?.features.length) {
      this.session.updateFromCanonicalFeatures(
        scribeOutput.canonicalization.features,
        "patient_text"
      );
    }
    if (scribeOutput.extracted_symptoms.length > 0) {
      this.session.updateFromExtraction(scribeOutput.extracted_symptoms, "patient_text");
    }

    // ═══ THINKING ═══
    this.turn.transition("THINKING");
    this.syncFSMState();

    // Step 7: LLM extraction (semantic understanding)
    // Build collectedFields from SSOT for the LLM call
    const collectedForLLM = this.deriveCollectedFields();
    const llmResult = await this.runLLMExtraction(normalizedText, collectedForLLM);

    // Step 8: Sync LLM entities into SessionContextManager (SSOT)
    if (llmResult?.extracted_entities) {
      this.session.syncFromLLMEntities(llmResult.extracted_entities, "patient_text");
      console.log("[SYNC] Session features after merge:", this.session.getCanonicalFeatures().length);
    }

    // Step 9: Handle negation responses to questions
    if (intent === "NEGATION" || intent === "QUESTION_ANSWER") {
      this.handleQuestionResponse(cleanedText, intent);
    }

    // Step 10: Run clinical pipeline with UNIFIED state
    await this.runPipeline();

    // ═══ ASKING ═══
    this.turn.transition("ASKING");
    this.syncFSMState();

    // Step 11: Reasoning engine decides next action
    const meta: QuestionMeta = {
      askedQuestionIds: new Set(this.askedQuestionIds),
      askedQuestionTexts: new Set(this.askedQuestionTexts),
      attempts: new Map(this.fieldAttempts),
    };

    const llmQuestion = llmResult?.next_question ?? null;

    const action = decideNextStep(
      this.session,
      intent,
      lang,
      meta,
      llmQuestion,
      this.pendingQuestions,
    );

    // Step 12: Execute the decided action
    this.executeAction(action, llmResult, lang);

    // Step 13: Safety alerts
    this.emitSafetyAlerts(lang);

    // Log turn
    this.logTurnDebug(cleanedText, intent, action);

    // ═══ WAITING_FOR_USER ═══
    this.turn.transition("WAITING_FOR_USER");
    this.syncFSMState();

    // Sync derived collectedFields for UI display
    this.sessionState.collectedFields = this.deriveCollectedFields();

    return this.getCurrentState();
  }

  async answerQuestion(questionId: string, answer: string): Promise<UIState> {
    const normalizedAnswer = answer.trim();
    if (!normalizedAnswer) return this.getCurrentState();

    this.askedQuestionIds.add(questionId);
    const question = this.pendingQuestions.find(q => q.question_id === questionId);
    if (question) {
      this.askedQuestionTexts.add(this.normalizeQuestionText(question.text));
    }
    this.session.updateFromAnswers(questionId, normalizedAnswer);
    this.pendingQuestions = this.pendingQuestions.filter(q => q.question_id !== questionId);

    return this.processUserInput(normalizedAnswer);
  }

  async attachVitals(vitals: PipelineVitals): Promise<UIState> {
    this.session.attachVitals(vitals);
    await this.runPipeline();
    const lang = this.sessionState.language;
    this.addMessage("system", getSystemMessage("vitals_recorded", lang));
    return this.getCurrentState();
  }

  async attachFiles(files: UploadedFile[]): Promise<UIState> {
    this.session.attachFiles(files);
    const names = files.map(f => f.file_name).join(", ");
    await this.runPipeline();
    const lang = this.sessionState.language;
    this.addMessage("system", getSystemMessage("files_attached", lang, { names }));
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
      is_processing: this.turn.isProcessing,
      turn_count: snapshot.turn_count,
      minimum_context_met: this.latestPipelineResult?.questions.minimum_context_met ?? false,
      session: { ...this.sessionState },
    };
  }

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
    this.fieldAttempts.clear();
    this.sessionState = this.defaultSessionState();
  }

  // ══════════════════════════════════════════════
  // INTERNAL METHODS
  // ══════════════════════════════════════════════

  private syncFSMState(): void {
    this.sessionState.fsm_state = this.turn.state;
  }

  private transitionToWaiting(): void {
    this.turn.transition("THINKING");
    this.turn.transition("ASKING");
    this.turn.transition("WAITING_FOR_USER");
    this.syncFSMState();
  }

  /**
   * Derive CollectedFields from SessionContextManager (SSOT).
   * This is computed, not stored — eliminates the shadow state problem.
   */
  private deriveCollectedFields(): CollectedFields {
    const features = this.session.getCanonicalFeatures();
    const snapshot = this.session.getSnapshot();

    const fields: CollectedFields = {};

    if (features.length > 0) {
      fields.chief_complaint = features.map(f => f.feature_id);
    }
    if (this.session.hasData("severity")) {
      const severities = features
        .map(f => f.intensity)
        .filter(i => i !== "unknown");
      if (severities.length > 0) fields.severity = severities[0];
    }
    if (this.session.hasData("duration")) {
      const durations = features
        .map(f => f.duration)
        .filter((d): d is string => !!d && d !== "");
      if (durations.length > 0) fields.duration = durations[0];
    }
    if (snapshot.medications.length > 0) {
      fields.medications = snapshot.medications;
    }
    if (snapshot.allergies.length > 0) {
      fields.allergies = snapshot.allergies;
    }
    if (snapshot.patient_age != null) {
      fields.age = snapshot.patient_age;
    }
    if (snapshot.patient_sex) {
      fields.sex = snapshot.patient_sex;
    }
    if (snapshot.medical_history.length > 0) {
      fields.medical_history = snapshot.medical_history;
    }

    return fields;
  }

  private async runPipeline(): Promise<void> {
    const input = this.session.toPipelineInput();
    this.latestPipelineResult = await runClinicalPipelineV4(input);

    // Filter pipeline questions — remove already-asked and already-known
    const newQuestions = this.latestPipelineResult.questions.questions
      .filter(q => {
        if (this.askedQuestionIds.has(q.question_id)) return false;
        if (this.askedQuestionTexts.has(this.normalizeQuestionText(q.text))) return false;
        if (this.session.hasData(q.category)) return false;
        return true;
      });

    this.pendingQuestions = newQuestions;
  }

  /**
   * Execute a reasoning engine action — produces exactly ONE response per turn.
   */
  private executeAction(
    action: NextAction,
    llmResult: LLMExtractionResult | null,
    lang: SupportedLanguage,
  ): void {
    // Always emit LLM acknowledgment first (if available and meaningful)
    if (llmResult?.acknowledgment) {
      this.addMessage("system", llmResult.acknowledgment);
    }

    switch (action.type) {
      case "ask_question": {
        const q = action.question;
        this.askedQuestionIds.add(q.question_id);
        this.askedQuestionTexts.add(this.normalizeQuestionText(action.displayText));
        this.sessionState.lastQuestionId = q.question_id;

        // Track attempt for this field
        const currentAttempts = this.fieldAttempts.get(q.category) ?? 0;
        this.fieldAttempts.set(q.category, currentAttempts + 1);

        const optionLabels = q.options
          ? Object.fromEntries(q.options.map(opt => [opt, translateOptionLabel(opt, lang)]))
          : undefined;

        this.addMessage("question", action.displayText, q, optionLabels);
        this.pendingQuestions = [q]; // Exactly ONE pending question
        break;
      }

      case "acknowledge":
        if (!llmResult?.acknowledgment) {
          this.addMessage("system", action.text);
        }
        break;

      case "greet":
        this.addMessage("system", action.text);
        break;

      case "clarify":
        this.addMessage("system", action.text);
        break;

      case "proceed":
        this.addMessage("system", action.text);
        this.pendingQuestions = [];
        break;

      case "none":
        // No action needed — pipeline has enough data or all questions exhausted
        if (!llmResult?.acknowledgment) {
          // Only show confidence note if we have features
          if (this.session.getCanonicalFeatures().length > 0 && this.latestPipelineResult) {
            const confidence = (this.latestPipelineResult.confidence.overall_confidence * 100).toFixed(0);
            this.addMessage("system", getSystemMessage("noted", lang, { confidence }));
          }
        }
        break;
    }
  }

  /**
   * Handle question responses (NEGATION or QUESTION_ANSWER intent).
   * Maps negations to structured data updates.
   */
  private handleQuestionResponse(text: string, intent: UserIntent): void {
    if (!this.sessionState.lastQuestionId) return;

    const lastQuestion = this.pendingQuestions[0];
    if (!lastQuestion) return;

    // Mark as answered
    this.askedQuestionIds.add(lastQuestion.question_id);
    this.session.updateFromAnswers(lastQuestion.question_id, text);

    // Handle negation — mark field as "collected with none"
    if (intent === "NEGATION" || isNegativeResponse(text, this.sessionState.language)) {
      const category = lastQuestion.category;
      if (category === "allergies") {
        this.session.setAllergies(["none"]);
      } else if (category === "medications") {
        this.session.setMedications(["none"]);
      }
    }

    // Clear pending
    this.pendingQuestions = this.pendingQuestions.filter(q => q.question_id !== lastQuestion.question_id);
    this.sessionState.lastQuestionId = null;
  }

  /**
   * Emit safety alerts from pipeline result.
   */
  private emitSafetyAlerts(lang: SupportedLanguage): void {
    if (!this.latestPipelineResult) return;
    for (const alert of this.latestPipelineResult.safety.safety_alerts) {
      this.addMessage(
        "system",
        getSystemMessage("safety_alert", lang, {
          condition: translateSafetyCondition(alert.condition, lang),
          action: translateSafetyAction(alert.action, lang),
        })
      );
    }
  }

  private lockSessionLanguage(text: string): void {
    if (this.sessionState.language !== "unknown") return;
    const detectedLanguage = detectLanguage(text);
    if (detectedLanguage !== "unknown") {
      this.sessionState.language = detectedLanguage;
    }
  }

  private normalizeQuestionText(text: string): string {
    return text
      .normalize("NFKD")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Run LLM extraction with derived collected fields from SSOT.
   */
  private async runLLMExtraction(
    userInput: string,
    collectedFields: CollectedFields,
  ): Promise<LLMExtractionResult | null> {
    try {
      const result = await extractClinicalEntitiesLLM(
        userInput,
        collectedFields,
        this.sessionState.language
      );

      if (!result) return null;

      console.log("[LLM] Acknowledgment:", result.acknowledgment);
      console.log("[LLM] Next question:", result.next_question?.text);
      console.log("[LLM] All fields collected:", result.all_fields_collected);

      return result;
    } catch (err) {
      console.error("[LLM] Extraction failed:", err);
      return null;
    }
  }

  /**
   * Debug logging per turn.
   */
  private logTurnDebug(
    input: string,
    intent: UserIntent,
    action: NextAction | null,
  ): void {
    const snapshot = {
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
      has_allergies: this.session.hasData("allergies"),
    };

    this.turn.logTurn({
      input,
      extracted: {
        intent,
        session_features: snapshot.features.length,
      },
      session_snapshot: snapshot,
      next_question: action?.type === "ask_question" ? action.displayText : null,
    });

    console.log("[DEBUG_TURN]", {
      turn: this.turn.turnNumber,
      intent,
      action_type: action?.type ?? "none",
      session: snapshot,
      pending_questions: this.pendingQuestions.length,
    });
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
