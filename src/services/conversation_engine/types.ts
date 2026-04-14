/**
 * Conversation Engine Types — V4 Interaction Layer
 */

import type { CanonicalFeature, SupportedLanguage } from "../canonical/types";
import type { ClinicalQuestion, PipelineOutput } from "../pipeline/types";
import type { TrackedFeature, UploadedFile } from "../session_context/types";
import type { CollectedFields, LLMNextQuestion } from "./llm_extraction";

/** Interaction mode */
export type InteractionMode = "voice" | "text";

/** A single message in the conversation */
export interface ConversationMessage {
  id: string;
  role: "user" | "system" | "question";
  content: string;
  timestamp: string;
  /** For question messages: the question object */
  question?: ClinicalQuestion;
  /** Localized option labels keyed by canonical/raw option value */
  question_option_labels?: Record<string, string>;
  /** For user messages: extracted features from this message */
  extracted_features?: string[];
  /** LLM-generated question metadata */
  llm_question?: LLMNextQuestion;
}

/** Voice session state for turn-based control */
export interface VoiceSession {
  isActive: boolean;
  turn: "user" | "system" | "idle";
  hasGreeted: boolean;
  isProcessing: boolean;
}

/** Persistent session state */
export interface SessionState {
  mode: InteractionMode;
  language: SupportedLanguage;
  transcriptBuffer: string[];
  lastQuestionId: string | null;
  voice: VoiceSession;
  /** LLM-tracked collected fields */
  collectedFields: CollectedFields;
}

/** Current state exposed to UI */
export interface UIState {
  messages: ConversationMessage[];
  pending_questions: ClinicalQuestion[];
  pipeline_result: PipelineOutput | null;
  features: TrackedFeature[];
  files: UploadedFile[];
  is_processing: boolean;
  turn_count: number;
  minimum_context_met: boolean;
  session: SessionState;
}
