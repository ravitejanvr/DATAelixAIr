/**
 * TurnController — Deterministic Clinical Conversation State Machine
 *
 * Enforces strict turn-based flow:
 *   IDLE → LISTENING → PROCESSING → THINKING → ASKING → WAITING_FOR_USER → LISTENING ...
 *
 * Rules:
 * - Exactly ONE question per turn
 * - No parallel execution
 * - No premature questioning
 * - State transitions are validated (illegal transitions throw)
 */

export type ConversationState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "THINKING"
  | "ASKING"
  | "WAITING_FOR_USER"
  | "ERROR";

/** Valid state transitions map */
const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  IDLE: ["LISTENING", "PROCESSING"], // PROCESSING for text (skip LISTENING)
  LISTENING: ["PROCESSING", "IDLE"],  // IDLE for cancel
  PROCESSING: ["THINKING", "ERROR"],
  THINKING: ["ASKING", "ERROR"],
  ASKING: ["WAITING_FOR_USER", "ERROR"],
  WAITING_FOR_USER: ["LISTENING", "PROCESSING", "IDLE"], // PROCESSING for text
  ERROR: ["IDLE"],
};

export interface TurnLog {
  turn_number: number;
  state_before: ConversationState;
  state_after: ConversationState;
  input: string;
  extracted: Record<string, unknown>;
  session_snapshot: Record<string, unknown>;
  next_question: string | null;
  timestamp: string;
}

export class TurnController {
  private _state: ConversationState = "IDLE";
  private _turnNumber = 0;
  private _turnLogs: TurnLog[] = [];
  private _processingLock = false;

  get state(): ConversationState {
    return this._state;
  }

  get turnNumber(): number {
    return this._turnNumber;
  }

  get isAcceptingInput(): boolean {
    return this._state === "IDLE" || this._state === "WAITING_FOR_USER";
  }

  get isListening(): boolean {
    return this._state === "LISTENING";
  }

  get isProcessing(): boolean {
    return this._state === "PROCESSING" || this._state === "THINKING";
  }

  get isAsking(): boolean {
    return this._state === "ASKING";
  }

  /**
   * Attempt a state transition. Throws if transition is illegal.
   */
  transition(to: ConversationState): void {
    const allowed = VALID_TRANSITIONS[this._state];
    if (!allowed.includes(to)) {
      console.error(`[TURN] ILLEGAL transition: ${this._state} → ${to}`);
      throw new Error(`Illegal state transition: ${this._state} → ${to}`);
    }
    const from = this._state;
    this._state = to;
    console.log(`[TURN] ${from} → ${to} (turn ${this._turnNumber})`);
  }

  /**
   * Acquire processing lock. Returns false if already locked (prevents parallel execution).
   */
  acquireLock(): boolean {
    if (this._processingLock) {
      console.warn("[TURN] Processing lock already held — rejecting input");
      return false;
    }
    this._processingLock = true;
    return true;
  }

  /**
   * Release processing lock.
   */
  releaseLock(): void {
    this._processingLock = false;
  }

  /**
   * Start a new turn (called when user input begins).
   */
  beginTurn(): void {
    this._turnNumber++;
  }

  /**
   * Log a completed turn for debugging.
   */
  logTurn(data: {
    input: string;
    extracted: Record<string, unknown>;
    session_snapshot: Record<string, unknown>;
    next_question: string | null;
  }): void {
    const log: TurnLog = {
      turn_number: this._turnNumber,
      state_before: this._state,
      state_after: this._state,
      input: data.input,
      extracted: data.extracted,
      session_snapshot: data.session_snapshot,
      next_question: data.next_question,
      timestamp: new Date().toISOString(),
    };
    this._turnLogs.push(log);

    // Keep last 50 turns
    if (this._turnLogs.length > 50) {
      this._turnLogs = this._turnLogs.slice(-50);
    }

    console.log("[TURN_LOG]", JSON.stringify(log, null, 2));
  }

  /**
   * Force reset to IDLE (error recovery or session reset).
   */
  reset(): void {
    this._state = "IDLE";
    this._turnNumber = 0;
    this._processingLock = false;
    this._turnLogs = [];
  }

  /**
   * Force error state with recovery.
   */
  error(): void {
    this._state = "ERROR";
    this._processingLock = false;
  }

  /**
   * Get recent turn logs for debugging.
   */
  getRecentLogs(count = 10): TurnLog[] {
    return this._turnLogs.slice(-count);
  }
}
