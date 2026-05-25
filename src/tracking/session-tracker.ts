import type { IntentionResult, TurnRecord } from "../types";
import type { TriggerType } from "./trigger-checker.js";

export interface SessionEvolutionState {
  sessionKey: string;
  toolCallCount: number;
  failureCount: number;
  skillsUsed: Set<string>;
  turnCount: number;
  lastIntentionResult: IntentionResult | null;
  turnHistory: TurnRecord[];
  triggers: TriggerType[];
  createdAt: Date;
  updatedAt: Date;
}

export class SessionTracker {
  private sessions = new Map<string, SessionEvolutionState>();

  has(sessionKey: string): boolean {
    return this.sessions.has(sessionKey);
  }

  getOrCreate(sessionKey: string): SessionEvolutionState {
    let session = this.sessions.get(sessionKey);
    if (!session) {
      const now = new Date();
      session = {
        sessionKey,
        toolCallCount: 0,
        failureCount: 0,
        skillsUsed: new Set(),
        turnCount: 0,
        lastIntentionResult: null,
        turnHistory: [],
        triggers: [],
        createdAt: now,
        updatedAt: now,
      };
      this.sessions.set(sessionKey, session);
    }
    return session;
  }

  incrementToolCall(sessionKey: string): void {
    const session = this.getOrCreate(sessionKey);
    session.toolCallCount++;
    session.updatedAt = new Date();
  }

  recordFailure(sessionKey: string): void {
    const session = this.getOrCreate(sessionKey);
    session.failureCount++;
    session.updatedAt = new Date();
  }

  recordSkill(sessionKey: string, skillId: string): void {
    const session = this.getOrCreate(sessionKey);
    session.skillsUsed.add(skillId);
    session.updatedAt = new Date();
  }

  incrementTurn(sessionKey: string): void {
    const session = this.getOrCreate(sessionKey);
    session.turnCount++;
    session.toolCallCount = 0;
    session.failureCount = 0;
    session.updatedAt = new Date();
  }

  setIntentResult(sessionKey: string, result: IntentionResult): void {
    const session = this.getOrCreate(sessionKey);
    session.lastIntentionResult = result;
    session.updatedAt = new Date();
  }

  recordTurn(
    sessionKey: string,
    turnNumber: number,
    intentInputConversation: import("../types.js").RecentTurn[],
    reviewMessages: unknown[],
    result: IntentionResult,
  ): void {
    const session = this.getOrCreate(sessionKey);
    session.turnHistory.push({
      turnNumber,
      intentInputConversation,
      reviewMessages,
      intentResult: result,
    });
    session.lastIntentionResult = result;
    session.updatedAt = new Date();
  }

  getTurnHistory(sessionKey: string): TurnRecord[] {
    const session = this.getOrCreate(sessionKey);
    return [...session.turnHistory];
  }

  recordReviewMessages(sessionKey: string, messages: unknown[]): void {
    const session = this.getOrCreate(sessionKey);
    const lastTurn = session.turnHistory[session.turnHistory.length - 1];
    if (lastTurn) {
      lastTurn.reviewMessages = messages;
    }
    session.updatedAt = new Date();
  }

  /**
   * Get the latest user text from the session's turn history.
   * Returns the intentInputConversation of the most recent turn, or empty string if no turns.
   */
  getLatestUserText(sessionKey: string): string {
    const session = this.getOrCreate(sessionKey);
    if (session.turnHistory.length === 0) {
      return "";
    }
    const lastTurn = session.turnHistory[session.turnHistory.length - 1];
    const userMessages = lastTurn.intentInputConversation.filter(
      (t) => t.role === "user",
    );
    if (userMessages.length === 0) {
      return "";
    }
    return userMessages[userMessages.length - 1].text;
  }

  recordTrigger(sessionKey: string, trigger: TriggerType): void {
    const session = this.getOrCreate(sessionKey);
    session.triggers.push(trigger);
    session.updatedAt = new Date();
  }

  remove(sessionKey: string): boolean {
    return this.sessions.delete(sessionKey);
  }

  cleanup(maxAgeMs: number): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt.getTime() > maxAgeMs) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

export const defaultSessionTracker = new SessionTracker();
