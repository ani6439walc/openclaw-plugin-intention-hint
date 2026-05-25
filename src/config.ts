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
  DEFAULT_SELF_EVOLUTION_SATISFACTION_CHECK_INTERVAL,
  DEFAULT_SELF_EVOLUTION_TOOL_CALL_COUNT_THRESHOLD,
  DEFAULT_SELF_EVOLUTION_SKILLS_USED_THRESHOLD,
  DEFAULT_SELF_EVOLUTION_FAILURE_COUNT_THRESHOLD,
  DEFAULT_SELF_EVOLUTION_WEAK_INTENT_CONFIDENCE_THRESHOLD,
  DEFAULT_SELF_EVOLUTION_REVIEW_TIMEOUT_MS,
} from "./constants.js";
import type { ResolvedIntentionHintPluginConfig, ThinkLevel } from "./types.js";

const THINK_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "adaptive",
  "max",
] as const satisfies readonly ThinkLevel[];

function normalizeThinkLevel(value: unknown): ThinkLevel {
  return typeof value === "string" && THINK_LEVELS.includes(value as ThinkLevel)
    ? (value as ThinkLevel)
    : "low";
}
export function clampInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function normalizePluginConfig(
  raw: unknown,
): ResolvedIntentionHintPluginConfig {
  const cfg = (raw ?? {}) as Record<string, unknown>;
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
  const asBool = (v: unknown, fallback: boolean): boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.toLowerCase() === "true";
    return fallback;
  };
  const queryMode = (cfg.queryMode ?? DEFAULT_QUERY_MODE) as string;
  return {
    agents: asStringArray(cfg.agents).length
      ? asStringArray(cfg.agents)
      : ["main"],
    intentDeny: asStringArrayMap(cfg.intentDeny),
    model: typeof cfg.model === "string" ? cfg.model : undefined,
    modelFallback:
      typeof cfg.modelFallback === "string" ? cfg.modelFallback : undefined,
    allowedChatTypes: asStringArray(cfg.allowedChatTypes).length
      ? asStringArray(cfg.allowedChatTypes)
      : ["direct"],
    allowedChatIds: asStringArray(cfg.allowedChatIds),
    deniedChatIds: asStringArray(cfg.deniedChatIds),
    queryMode: (["message", "recent", "full"].includes(queryMode)
      ? queryMode
      : DEFAULT_QUERY_MODE) as "message" | "recent" | "full",
    recentUserTurns: clampInt(
      cfg.recentUserTurns as number | undefined,
      DEFAULT_RECENT_USER_TURNS,
      0,
      20,
    ),
    recentAssistantTurns: clampInt(
      cfg.recentAssistantTurns as number | undefined,
      DEFAULT_RECENT_ASSISTANT_TURNS,
      0,
      10,
    ),
    recentUserChars: clampInt(
      cfg.recentUserChars as number | undefined,
      DEFAULT_RECENT_USER_CHARS,
      40,
      1000,
    ),
    recentAssistantChars: clampInt(
      cfg.recentAssistantChars as number | undefined,
      DEFAULT_RECENT_ASSISTANT_CHARS,
      40,
      1000,
    ),
    timeoutMs: clampInt(
      cfg.timeoutMs as number | undefined,
      DEFAULT_TIMEOUT_MS,
      250,
      120_000,
    ),
    intentsDir:
      typeof cfg.intentsDir === "string" ? cfg.intentsDir : "./intents",
    intentsHotReload: asBool(cfg.intentsHotReload, true),
    intentsHotReloadIntervalMs: clampInt(
      cfg.intentsHotReloadIntervalMs as number | undefined,
      5_000,
      1_000,
      300_000,
    ),
    complexityPrompts: {
      low:
        typeof (cfg.complexityPrompts as Record<string, unknown> | undefined)
          ?.low === "string" &&
        (
          (cfg.complexityPrompts as Record<string, unknown>)?.low as string
        ).trim()
          ? ((cfg.complexityPrompts as Record<string, unknown>).low as string)
          : DEFAULT_LOW_COMPLEXITY_PROMPT,
      medium:
        typeof (cfg.complexityPrompts as Record<string, unknown> | undefined)
          ?.medium === "string" &&
        (
          (cfg.complexityPrompts as Record<string, unknown>)?.medium as string
        ).trim()
          ? ((cfg.complexityPrompts as Record<string, unknown>)
              .medium as string)
          : DEFAULT_MEDIUM_COMPLEXITY_PROMPT,
      high:
        typeof (cfg.complexityPrompts as Record<string, unknown> | undefined)
          ?.high === "string" &&
        (
          (cfg.complexityPrompts as Record<string, unknown>)?.high as string
        ).trim()
          ? ((cfg.complexityPrompts as Record<string, unknown>).high as string)
          : DEFAULT_HIGH_COMPLEXITY_PROMPT,
    },
    selfEvolution: {
      enabled: asBool(
        (cfg.selfEvolution as Record<string, unknown> | undefined)?.enabled,
        true,
      ),
      reviewModel:
        typeof (cfg.selfEvolution as Record<string, unknown> | undefined)
          ?.reviewModel === "string"
          ? ((cfg.selfEvolution as Record<string, unknown>)
              ?.reviewModel as string)
          : undefined,
      reviewThinkingLevel: normalizeThinkLevel(
        (cfg.selfEvolution as Record<string, unknown> | undefined)
          ?.reviewThinkingLevel,
      ),
      reviewTimeoutMs: clampInt(
        (cfg.selfEvolution as Record<string, unknown> | undefined)
          ?.reviewTimeoutMs as number | undefined,
        DEFAULT_SELF_EVOLUTION_REVIEW_TIMEOUT_MS,
        10_000,
        600_000,
      ),
      triggers: {
        satisfactionCheckInterval: clampInt(
          (
            (cfg.selfEvolution as Record<string, unknown> | undefined)
              ?.triggers as Record<string, unknown> | undefined
          )?.satisfactionCheckInterval as number | undefined,
          DEFAULT_SELF_EVOLUTION_SATISFACTION_CHECK_INTERVAL,
          1,
          100,
        ),
        toolCallCountThreshold: clampInt(
          (
            (cfg.selfEvolution as Record<string, unknown> | undefined)
              ?.triggers as Record<string, unknown> | undefined
          )?.toolCallCountThreshold as number | undefined,
          DEFAULT_SELF_EVOLUTION_TOOL_CALL_COUNT_THRESHOLD,
          1,
          1000,
        ),
        skillsUsedThreshold: clampInt(
          (
            (cfg.selfEvolution as Record<string, unknown> | undefined)
              ?.triggers as Record<string, unknown> | undefined
          )?.skillsUsedThreshold as number | undefined,
          DEFAULT_SELF_EVOLUTION_SKILLS_USED_THRESHOLD,
          0,
          100,
        ),
        failureCountThreshold: clampInt(
          (
            (cfg.selfEvolution as Record<string, unknown> | undefined)
              ?.triggers as Record<string, unknown> | undefined
          )?.failureCountThreshold as number | undefined,
          DEFAULT_SELF_EVOLUTION_FAILURE_COUNT_THRESHOLD,
          1,
          100,
        ),
        weakIntentConfidenceThreshold: (() => {
          const raw = (
            (cfg.selfEvolution as Record<string, unknown> | undefined)
              ?.triggers as Record<string, unknown> | undefined
          )?.weakIntentConfidenceThreshold as number | undefined;
          if (
            typeof raw === "number" &&
            !Number.isNaN(raw) &&
            raw >= 0 &&
            raw <= 1
          ) {
            return raw;
          }
          return DEFAULT_SELF_EVOLUTION_WEAK_INTENT_CONFIDENCE_THRESHOLD;
        })(),
      },
    },
  };
}
