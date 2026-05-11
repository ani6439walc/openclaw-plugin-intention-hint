import { UNTRUSTED_CONTEXT_HEADER } from "./constants.js";
import type {
  MessageContentPart,
  PromptMessageLike,
  RecentTurn,
} from "./types.js";

export function buildQuery(params: {
  latestUserMessage: string;
  recentTurns?: RecentTurn[];
  queryMode: "message" | "recent" | "full";
}): string {
  const latest = params.latestUserMessage.trim();
  if (params.queryMode === "message") {
    return latest;
  }
  if (params.queryMode === "full") {
    const allTurns = (params.recentTurns ?? [])
      .map((turn) => `${turn.role}: ${turn.text.trim().replace(/\s+/g, " ")}`)
      .filter((turn) => turn.length > 0);
    if (allTurns.length === 0) return latest;
    return [
      "Full conversation context:",
      ...allTurns,
      "",
      "Latest user message:",
      latest,
    ].join("\n");
  }

  const recentTurns = (params.recentTurns ?? [])
    .map((turn) => ({
      role: turn.role,
      text: turn.text.trim().replace(/\s+/g, " "),
    }))
    .filter((turn) => turn.text.length > 0);
  if (recentTurns.length === 0) return latest;
  return [
    "Recent conversation tail:",
    ...recentTurns.map((turn) => `${turn.role}: ${turn.text}`),
    "",
    "Latest user message:",
    latest,
  ].join("\n");
}

function extractTextContent(
  content: string | Array<string | MessageContentPart> | undefined,
): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const parts: string[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      parts.push(item);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    if (typeof item.text === "string") {
      parts.push(item.text);
      continue;
    }
    if (item.type === "text" && typeof item.content === "string") {
      parts.push(item.content);
    }
  }
  return parts.join(" ").trim();
}

function stripIntentionHintBlocks(text: string): string {
  return text
    .replace(/<intention_hint_plugin>[\s\S]*?<\/intention_hint_plugin>/gi, " ")
    .replace(/<active_memory_plugin>[\s\S]*?<\/active_memory_plugin>/gi, " ")
    .split(UNTRUSTED_CONTEXT_HEADER)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractRecentTurns(
  messages: unknown[] | undefined,
): RecentTurn[] {
  if (!Array.isArray(messages)) return [];

  const turns: RecentTurn[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const typed = message as PromptMessageLike;
    const role =
      typed.role === "user" || typed.role === "assistant"
        ? typed.role
        : undefined;
    if (!role) continue;

    const text = stripIntentionHintBlocks(extractTextContent(typed.content));
    if (!text) continue;
    turns.push({ role, text });
  }
  return turns;
}
