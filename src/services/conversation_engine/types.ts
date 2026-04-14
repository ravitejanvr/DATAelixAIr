/**
 * Conversation Engine Types — V4 Interaction Layer
 */

import type { CanonicalFeature } from "../canonical/types";
import type { ClinicalQuestion, PipelineOutput } from "../pipeline/types";
import type { TrackedFeature, UploadedFile } from "../session_context/types";

/** A single message in the conversation */
export interface ConversationMessage {
  id: string;
  role: "user" | "system" | "question";
  content: string;
  timestamp: string;
  /** For question messages: the question object */
  question?: ClinicalQuestion;
  /** For user messages: extracted features from this message */
  extracted_features?: string[];
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
}
