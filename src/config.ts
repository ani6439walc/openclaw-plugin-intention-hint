import { z, preprocess } from "openclaw/plugin-sdk/zod";
import {
  DEFAULT_QUERY_MODE,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RECENT_USER_TURNS,
  DEFAULT_RECENT_ASSISTANT_TURNS,
  DEFAULT_RECENT_USER_CHARS,
  DEFAULT_RECENT_ASSISTANT_CHARS,
  DEFAULT_LOW_COMPLEXITY_PROMPT,
  DEFAULT_MEDIUM_COMPLEXITY_PROMPT,
  DEFAULT_HIGH_COMPLEXITY_PROMPT,
} from "./constants.js";
import type {
  ContextWindow,
  ResolvedIntentionHintPluginConfig,
} from "./types.js";

export function clampInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

const asStringArray = (v: unknown): string[] => {
  if (Array.isArray(v))
    return v
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
};

const asStringArrayMap = (v: unknown): Record<string, string[]> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const result: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
    const normalizedKey = key.trim();
    if (!Array.isArray(value)) continue;
    const patterns = asStringArray(value);
    if (normalizedKey && patterns.length > 0) {
      result[normalizedKey] = patterns;
    }
  }
  return result;
};

function normalizeContextWindow(v: unknown): ContextWindow {
  const raw = typeof v === "object" && v !== null && !Array.isArray(v) ? v : {};
  const obj = raw as Record<string, unknown>;
  const userRaw =
    typeof obj.user === "object" && obj.user !== null ? obj.user : {};
  const userObj = userRaw as Record<string, unknown>;
  const assistantRaw =
    typeof obj.assistant === "object" && obj.assistant !== null
      ? obj.assistant
      : {};
  const assistantObj = assistantRaw as Record<string, unknown>;
  return {
    user: {
      turns: clampInt(
        userObj.turns as number,
        DEFAULT_RECENT_USER_TURNS,
        0,
        20,
      ),
      chars: clampInt(
        userObj.chars as number,
        DEFAULT_RECENT_USER_CHARS,
        40,
        1000,
      ),
    },
    assistant: {
      turns: clampInt(
        assistantObj.turns as number,
        DEFAULT_RECENT_ASSISTANT_TURNS,
        0,
        10,
      ),
      chars: clampInt(
        assistantObj.chars as number,
        DEFAULT_RECENT_ASSISTANT_CHARS,
        40,
        1000,
      ),
    },
  };
}

const IntentionHintConfigSchema = z.object({
  agents: preprocess(
    (v) => (asStringArray(v).length ? asStringArray(v) : ["main"]),
    z.array(z.string()),
  ),
  intentDeny: preprocess(
    (v) => asStringArrayMap(v),
    z.record(z.string(), z.array(z.string())),
  ),
  model: preprocess(
    (v) => (typeof v === "string" ? v : undefined),
    z.string().optional(),
  ),
  modelFallback: preprocess(
    (v) => (typeof v === "string" ? v : undefined),
    z.string().optional(),
  ),
  allowedChatTypes: preprocess(
    (v) => (asStringArray(v).length ? asStringArray(v) : ["direct"]),
    z.array(z.string()),
  ),
  allowedChatIds: preprocess((v) => asStringArray(v), z.array(z.string())),
  deniedChatIds: preprocess((v) => asStringArray(v), z.array(z.string())),
  queryMode: preprocess(
    (v) => {
      const mode = (v ?? DEFAULT_QUERY_MODE) as string;
      return ["message", "recent", "full"].includes(mode)
        ? mode
        : DEFAULT_QUERY_MODE;
    },
    z.enum(["message", "recent", "full"]),
  ),
  contextWindow: preprocess(
    (v) => normalizeContextWindow(v),
    z.object({
      user: z.object({
        turns: z.number().int(),
        chars: z.number().int(),
      }),
      assistant: z.object({
        turns: z.number().int(),
        chars: z.number().int(),
      }),
    }),
  ),
  timeoutMs: preprocess(
    (v) => clampInt(v as number | undefined, DEFAULT_TIMEOUT_MS, 250, 120_000),
    z.number().int(),
  ),
  intentsDir: preprocess(
    (v) => (typeof v === "string" ? v : "./intents"),
    z.string(),
  ),
  complexityPrompts: preprocess(
    (v) => {
      const cfg = v as Record<string, unknown> | undefined;
      return {
        low:
          typeof cfg?.low === "string" && cfg.low.trim()
            ? cfg.low
            : DEFAULT_LOW_COMPLEXITY_PROMPT,
        medium:
          typeof cfg?.medium === "string" && cfg.medium.trim()
            ? cfg.medium
            : DEFAULT_MEDIUM_COMPLEXITY_PROMPT,
        high:
          typeof cfg?.high === "string" && cfg.high.trim()
            ? cfg.high
            : DEFAULT_HIGH_COMPLEXITY_PROMPT,
      };
    },
    z.object({
      low: z.string(),
      medium: z.string(),
      high: z.string(),
    }),
  ),
});

export function resolveConfig(raw: unknown): ResolvedIntentionHintPluginConfig {
  return IntentionHintConfigSchema.parse(
    raw ?? {},
  ) as ResolvedIntentionHintPluginConfig;
}
