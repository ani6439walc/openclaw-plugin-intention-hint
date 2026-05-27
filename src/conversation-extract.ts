import { logger } from "../api.js";
import { UNTRUSTED_CONTEXT_HEADER } from "./constants.js";
import type {
  MessageContentPart,
  PromptMessageLike,
  RecentTurn,
  ContextWindow,
} from "./types.js";

/**
 * Extract readable text from tool call results.
 * Handles JSON-encoded content blocks (e.g. {"content":[{"type":"text","text":"..."}]}
 * and knowledge base answers (e.g. {"answerText":"..."}).
 */
export function extractToolText(raw: unknown): string {
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    const parsed = JSON.parse(str);
    if (parsed?.content?.[0]?.text) return parsed.content[0].text as string;
    if (parsed?.answerText) return parsed.answerText as string;
  } catch (err) {
    logger.warn("failed to parse tool response as JSON, returning raw string", {
      error: err,
      raw: str,
    });
  }
  return str;
}

/**
 * Apply filtering and capping to conversation turns based on query mode settings.
 * Restores the logic that was previously inside buildQuery().
 */
export function limitConversationTurns(
  allTurns: RecentTurn[],
  queryMode: "message" | "recent" | "full",
  cWindow: ContextWindow = {
    user: { turns: 5, chars: 220 },
    assistant: { turns: 5, chars: 180 },
  },
): RecentTurn[] {
  if (queryMode === "message") {
    return [];
  }
  if (queryMode === "full") {
    return allTurns;
  }

  const maxUserTurns = cWindow.user.turns;
  const maxAssistantTurns = cWindow.assistant.turns;
  const userCharLimit = cWindow.user.chars;
  const assistantCharLimit = cWindow.assistant.chars;

  const filtered = allTurns.filter((turn) => turn.text.trim().length > 0);

  // Walk backwards, picking up to maxUserTurns user + maxAssistantTurns assistant
  let remainingUser = maxUserTurns;
  let remainingAssistant = maxAssistantTurns;
  const picked: RecentTurn[] = [];
  for (let i = filtered.length - 1; i >= 0; i--) {
    const turn = filtered[i];
    if (turn.role === "user" && remainingUser > 0) {
      remainingUser--;
      const cleaned = turn.text.trim().replace(/\s+/g, " ");
      picked.unshift({
        role: turn.role,
        text:
          cleaned.length > userCharLimit
            ? cleaned.slice(0, userCharLimit) + " (truncated...)"
            : cleaned,
      });
    } else if (turn.role === "assistant" && remainingAssistant > 0) {
      remainingAssistant--;
      const cleaned = turn.text.trim().replace(/\s+/g, " ");
      picked.unshift({
        role: turn.role,
        text:
          cleaned.length > assistantCharLimit
            ? cleaned.slice(0, assistantCharLimit) + " (truncated...)"
            : cleaned,
      });
    }
    if (remainingUser === 0 && remainingAssistant === 0) break;
  }

  return picked;
}

function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractTextContent(
  content: string | Array<string | MessageContentPart> | undefined,
): string {
  if (typeof content === "string") return stripThinkingTags(content);
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      parts.push(stripThinkingTags(item));
      continue;
    }
    if (!item || typeof item !== "object") continue;
    if (
      item.type === "thinking" ||
      item.type === "redacted_thinking" ||
      item.type === "tool_use" ||
      item.type === "tool_result"
    )
      continue;
    if (typeof item.text === "string") {
      parts.push(stripThinkingTags(item.text));
      continue;
    }
    if (item.type === "text" && typeof item.content === "string") {
      parts.push(stripThinkingTags(item.content));
    }
  }
  return parts.join(" ").trim();
}

function stripMetadataBlocks(text: string): string {
  return text
    .replace(/<intention_hint_plugin>[\s\S]*?<\/intention_hint_plugin>/gi, " ")
    .replace(/<active_memory_plugin>[\s\S]*?<\/active_memory_plugin>/gi, " ")
    .replace(
      /Conversation info \(untrusted metadata\):\s*```json[\s\S]*?```\s*/gi,
      " ",
    )
    .replace(/Sender \(untrusted metadata\):\s*```json[\s\S]*?```\s*/gi, " ")
    .split(UNTRUSTED_CONTEXT_HEADER)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHeartbeatMessage(role: string, text: string): boolean {
  const trimmed = text.trim();
  if (role === "assistant" && trimmed === "HEARTBEAT_OK") return true;
  return role === "user" && trimmed.toLowerCase().includes("heartbeat poll");
}

/**
 * Extract user-assistant conversation turns from raw messages.
 * Each turn is defined as user→assistant pair.
 * Intermediate content (thinking, tool_use, system messages) is discarded.
 * Only complete pairs and the latest standalone user message are kept.
 */
export function extractRecentTurns(
  messages: unknown[] | undefined,
): RecentTurn[] {
  if (!Array.isArray(messages)) return [];

  const turns: RecentTurn[] = [];
  let pendingUser: RecentTurn | undefined;

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;

    const typed = message as PromptMessageLike;
    const role = typed.role;
    if (role !== "user" && role !== "assistant") continue;

    const text = stripMetadataBlocks(extractTextContent(typed.content));
    if (!text || isHeartbeatMessage(role, text)) continue;

    if (role === "user") {
      // If we already have a pending user without assistant, the previous
      // user turn is incomplete. Keep it and replace with the new one.
      pendingUser = { role: "user", text };
    } else if (role === "assistant" && pendingUser) {
      // Complete the pair.
      turns.push(pendingUser);
      turns.push({ role: "assistant", text });
      pendingUser = undefined;
    }
  }

  // If there's a trailing user message with no assistant response, include it
  // (the conversation is still in progress).
  if (pendingUser) {
    turns.push(pendingUser);
  }

  return turns;
}
