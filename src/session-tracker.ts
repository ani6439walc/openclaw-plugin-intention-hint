import path from "node:path";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import type { RecentTurn, IntentionResult, ContextWindow } from "./types.js";
import matter from "gray-matter";

export interface SkillRecord {
  name: string;
  path: string;
}

export interface IntentState {
  input?: RecentTurn[];
  result?: IntentionResult;
}

export interface SessionState {
  input?: string;
  intent?: IntentState;
  skillsUsed?: SkillRecord[];
  toolCalls?: Array<{
    name: string;
    params: Record<string, unknown>;
    result?: string;
    error?: string;
    durationMs?: number;
  }>;
  result?: string;
  error?: string;
  timestamps?: {
    start?: string;
    end?: string;
  };
}

export interface SessionData {
  sessionId: string;
  sessionKey?: string;
  agentId?: string;
  current: SessionState;
  history?: SessionState[];
}

function extractSkillInfo(
  toolName: string,
  toolParams: Record<string, unknown>,
  toolResult: unknown,
): { name: string; path: string } | undefined {
  if (toolName !== "read") return;
  const filePath = toolParams.path;
  if (typeof filePath !== "string" || !filePath.endsWith("SKILL.md")) return;
  const text = typeof toolResult === "string" ? toolResult : null;
  if (text === null) return;

  try {
    const parsed = matter(text);
    if (parsed.data?.name && typeof parsed.data.name === "string") {
      return { name: parsed.data.name, path: filePath };
    }
  } catch {
    // not valid markdown with frontmatter
  }
  return;
}

export class SessionTracker {
  private pluginRoot: string;
  private sessionData: SessionData = {
    sessionId: "",
    current: { intent: {} },
  };
  private sessionsWithIntent: Set<string> = new Set();

  private constructor(pluginRoot: string) {
    this.pluginRoot = pluginRoot;
  }

  static create(pluginRoot: string): SessionTracker {
    return new SessionTracker(pluginRoot);
  }

  hasIntentData(sessionId: string): boolean {
    return this.sessionsWithIntent.has(sessionId);
  }

  rotate(): void {
    const snapshot = this.sessionData.current;
    if (
      !snapshot.input &&
      !snapshot.result &&
      !snapshot.error &&
      !snapshot.toolCalls?.length
    ) {
      return;
    }

    if (!this.sessionData.history) {
      this.sessionData.history = [];
    }
    this.sessionData.history.push({ ...snapshot });
    this.sessionData.current = { intent: {} };
  }

  record(data: Partial<SessionData>): void {
    if (!data.sessionId) {
      return;
    }

    if (
      this.sessionData.sessionId &&
      this.sessionData.sessionId !== data.sessionId
    ) {
      this.sessionData = { sessionId: data.sessionId, current: { intent: {} } };
    }

    this.sessionData.sessionId = data.sessionId;

    if (data.sessionKey !== undefined) {
      this.sessionData.sessionKey = data.sessionKey;
    }
    if (data.agentId !== undefined) {
      this.sessionData.agentId = data.agentId;
    }

    const current = this.sessionData.current;

    if (data.current) {
      if (data.current.input !== undefined) {
        current.input = data.current.input;
      }
      if (data.current.intent) {
        if (!current.intent) current.intent = {};
        if (data.current.intent.input !== undefined) {
          current.intent.input = data.current.intent.input;
        }
        if (data.current.intent.result !== undefined) {
          current.intent.result = data.current.intent.result;
          this.sessionsWithIntent.add(data.sessionId);
        }
      }
      if (data.current.result !== undefined) {
        current.result = data.current.result;
      }
      if (data.current.error !== undefined) {
        current.error = data.current.error;
      }
      if (data.current.timestamps) {
        current.timestamps = {
          ...(current.timestamps || {}),
          ...(data.current.timestamps || {}),
        };
      }

      if (data.current.toolCalls) {
        if (data.current.toolCalls.length === 0) {
          current.toolCalls = [];
        } else {
          const existingToolCalls = current.toolCalls || [];
          current.toolCalls = [...existingToolCalls, ...data.current.toolCalls];

          const existing = current.skillsUsed || [];
          const seenNames = new Set(existing.map((s) => s.name));
          for (const tc of data.current.toolCalls) {
            const skill = extractSkillInfo(tc.name, tc.params, tc.result);
            if (skill && !seenNames.has(skill.name)) {
              seenNames.add(skill.name);
              existing.push(skill);
            }
          }
          if (existing.length > 0) {
            current.skillsUsed = [...existing];
          }
        }
      }
      if (data.current.skillsUsed) {
        const existing = current.skillsUsed || [];
        const seenNames = new Set(existing.map((s) => s.name));
        for (const skill of data.current.skillsUsed) {
          if (!seenNames.has(skill.name)) {
            seenNames.add(skill.name);
            existing.push(skill);
          }
        }
        current.skillsUsed = existing;
      }
    }

    if (data.history) {
      this.sessionData.history = data.history;
    }
  }

  write(): void {
    if (!this.sessionData.sessionId) {
      return;
    }

    const sessionsDir = path.join(this.pluginRoot, "sessions");
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    const filename = `${this.sessionData.sessionId}.json`;
    const filePath = path.join(sessionsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(this.sessionData, null, 2));
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(currentDir, "..", "..");

export const defaultTracker = SessionTracker.create(pluginRoot);
