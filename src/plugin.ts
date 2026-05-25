import {
  definePluginEntry,
  logger,
  type OpenClawConfig,
  type OpenClawPluginApi,
} from "../api.js";
import { resolveLivePluginConfigObject } from "openclaw/plugin-sdk/plugin-config-runtime";
import { clampInt, normalizePluginConfig } from "./config.js";
import { filterIntentsForAgent } from "./intent-filter.js";
import { defaultIntentCatalog } from "./intent-loader.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyQueryFilters,
  extractLatestConversationRound,
  extractRecentTurns,
} from "./query.js";
import {
  isAllowedChatId,
  isAllowedChatType,
  isEligibleInteractiveSession,
  isEnabledForAgent,
  resolveStatusUpdateAgentId,
  shouldSkipIntentAnalysis,
  resolveCanonicalSessionKeyFromSessionId,
} from "./session.js";
import {
  buildIntentionEmbeddedRunParams,
  buildIntentionPrompt,
  buildPromptPrefix,
  getModelRef,
  parseIntentionResult,
  runIntentionSubagent,
} from "./subagent.js";
import { defaultSessionTracker } from "./tracking/session-tracker.js";
import { redactAndTruncate } from "./utils/redact.js";
import {
  checkNonLLMTriggers,
  checkKeywordTriggers,
  shouldTriggerLLMReview,
  type TriggerType,
  type TriggerThresholds,
} from "./tracking/trigger-checker.js";
import { spawnReviewSubagent } from "./review/review-subagent.js";
import { extractSkillsFromToolCall } from "./tracking/skill-extractor.js";
import { extractToolCallsFromMessages } from "./tracking/tool-call-parser.js";

const pluginRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const intentCatalog = defaultIntentCatalog;
const sessionTracker = defaultSessionTracker;

intentCatalog.configure(pluginRoot);

function normalizeToolCallValue(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function recordExtractedToolCall(params: {
  sessionKey: string;
  toolName: string;
  toolParams: unknown;
  result?: unknown;
  isError?: boolean;
}): void {
  if (!sessionTracker.has(params.sessionKey)) return;

  const normalizedParams = normalizeToolCallValue(params.toolParams);
  const normalizedResult = normalizeToolCallValue(params.result);
  const errorText = params.isError ? String(params.result ?? "") : undefined;

  sessionTracker.incrementToolCall(params.sessionKey);
  if (params.isError) {
    sessionTracker.recordFailure(params.sessionKey);
  }

  const detectedSkills = extractSkillsFromToolCall(
    params.toolName,
    normalizedParams,
    normalizedResult,
    errorText,
  );
  for (const skillName of detectedSkills) {
    sessionTracker.recordSkill(params.sessionKey, skillName);
  }
}

function trimToolTranscriptTurns(
  turns: import("./types.js").RecentTurn[],
  maxLen = 3000,
): import("./types.js").RecentTurn[] {
  return turns.map((turn) => {
    const normalizedRole = turn.role.toLowerCase();
    const isToolOutput =
      normalizedRole === "tool" ||
      normalizedRole === "function" ||
      normalizedRole.includes("tool");

    if (!isToolOutput) return turn;

    return {
      ...turn,
      text: redactAndTruncate(turn.text, maxLen),
    };
  });
}

export function createPlugin(api: OpenClawPluginApi) {
  return definePluginEntry({
    id: "intention-hint",
    name: "Intention Hint",
    description:
      "Pre-scans user intent before replies and injects routing hints via before_prompt_build hook.",
    register() {
      let config = normalizePluginConfig(api.pluginConfig);

      const refreshLiveConfigFromRuntime = () => {
        const livePluginConfig = resolveLivePluginConfigObject(
          api.runtime.config?.current
            ? () => api.runtime.config.current() as OpenClawConfig
            : undefined,
          "intention-hint",
          api.pluginConfig as Record<string, unknown>,
        );
        config = normalizePluginConfig(livePluginConfig ?? {});
      };

      refreshLiveConfigFromRuntime();

      const refreshIntents = () => {
        const dir = config.intentsDir;
        if (dir) {
          intentCatalog.load(dir);
        } else {
          intentCatalog.reset();
        }
      };
      refreshIntents();

      api.on(
        "before_prompt_build",
        async (event, ctx) => {
          if (shouldSkipIntentAnalysis(ctx)) return undefined;

          try {
            refreshLiveConfigFromRuntime();

            const resolvedAgentId = resolveStatusUpdateAgentId(ctx);
            const resolvedSessionKey =
              ctx.sessionKey?.trim() ||
              (resolvedAgentId
                ? resolveCanonicalSessionKeyFromSessionId({
                    api,
                    agentId: resolvedAgentId,
                    sessionId: ctx.sessionId,
                  })
                : undefined);
            if (!isEnabledForAgent(config, resolvedAgentId)) return undefined;
            if (!isEligibleInteractiveSession(ctx)) return undefined;

            const modelRef = getModelRef(api, resolvedAgentId, config, {
              modelProviderId: ctx.modelProviderId,
              modelId: ctx.modelId,
            });
            if (!modelRef) return undefined;

            if (
              !isAllowedChatType(config, {
                ...ctx,
                sessionKey: resolvedSessionKey ?? ctx.sessionKey,
                mainKey: api.config.session?.mainKey,
              })
            ) {
              return undefined;
            }
            if (
              !isAllowedChatId(config, {
                sessionKey: resolvedSessionKey ?? ctx.sessionKey,
                messageProvider: ctx.messageProvider,
              })
            ) {
              return undefined;
            }

            refreshIntents();
            if (intentCatalog.count === 0) {
              logger.debug("No intents loaded; skipping intention scan.");
              return undefined;
            }

            logger.debug(
              `before_prompt_build hook triggered, ctx: ${JSON.stringify(ctx)}`,
            );

            const availableIntents = filterIntentsForAgent(
              intentCatalog.get(),
              config,
              resolvedAgentId,
            );

            if (config.selfEvolution?.enabled && resolvedSessionKey) {
              sessionTracker.incrementTurn(resolvedSessionKey);
            }

            const allTurns = extractRecentTurns(event.messages);
            const latestUserMessage = event.prompt ?? "";

            const conversation = applyQueryFilters(allTurns, {
              queryMode: config.queryMode,
              recentUserTurns: config.recentUserTurns,
              recentAssistantTurns: config.recentAssistantTurns,
              recentUserChars: config.recentUserChars,
              recentAssistantChars: config.recentAssistantChars,
            });

            const result = await runIntentionSubagent({
              api,
              config,
              agentId: resolvedAgentId,
              sessionKey: resolvedSessionKey,
              sessionId: ctx.sessionId,
              conversation,
              latest: latestUserMessage,
              messageProvider: ctx.messageProvider,
              channelId: ctx.channelId,
              modelRef,
              intents: availableIntents,
            });

            if (!result) {
              logger.debug(
                "Intention subagent failed; skipping hint injection.",
              );
              return undefined;
            }

            // Store intent result for self-evolution triggers
            if (config.selfEvolution?.enabled && resolvedSessionKey) {
              sessionTracker.setIntentResult(resolvedSessionKey, result);
              const turnNumber =
                sessionTracker.getOrCreate(resolvedSessionKey).turnCount;
              sessionTracker.recordTurn(
                resolvedSessionKey,
                turnNumber,
                [...conversation, { role: "user", text: latestUserMessage }],
                [],
                result,
              );
            }

            logger.debug(
              `Intention subagent result: ${JSON.stringify(result)}`,
            );

            const promptPrefix = buildPromptPrefix(
              result,
              availableIntents,
              config,
            );
            if (!promptPrefix) return undefined;

            return { prependContext: promptPrefix };
          } catch {
            return undefined;
          }
        },
        { timeoutMs: config.timeoutMs * 1.1 + 500 },
      );

      // agent_end hook - check triggers and spawn review if needed
      api.on("agent_end", async (event, ctx) => {
        if (!config.selfEvolution?.enabled) return undefined;
        const sessionKey = ctx.sessionKey;
        if (!sessionKey) return undefined;

        try {
          const eventRecord = event as Record<string, unknown>;

          if (!sessionTracker.has(sessionKey)) return undefined;

          const state = sessionTracker.getOrCreate(sessionKey);

          // Parse tool calls from messages BEFORE trigger check
          // This ensures sessionTracker state is up-to-date when triggers are evaluated
          const messages = (eventRecord.messages as unknown[]) ?? [];
          const extractedToolCalls = extractToolCallsFromMessages(messages);

          for (const tc of extractedToolCalls) {
            recordExtractedToolCall({
              sessionKey,
              toolName: tc.toolName,
              toolParams: tc.params,
              result: tc.result,
              isError: tc.isError,
            });
          }

          // Build trigger-checker compatible state
          const triggerState = {
            turnCount: state.turnCount,
            toolCallCount: state.toolCallCount,
            toolFailCount: state.failureCount,
            usedSkills: state.skillsUsed,
            triggeredReviews: new Set<TriggerType>(state.triggers),
          };

          const thresholds: TriggerThresholds = config.selfEvolution.triggers;

          // Check non-LLM triggers
          const nonLLMTrigger = checkNonLLMTriggers(
            triggerState,
            state.lastIntentionResult,
            thresholds,
          );

          // Check keyword-based triggers from user text
          const latestUserText = sessionTracker.getLatestUserText(sessionKey);
          const keywordTrigger = checkKeywordTriggers(
            triggerState,
            latestUserText,
          );

          // Check periodic LLM review trigger
          const llmTrigger = shouldTriggerLLMReview(triggerState, thresholds);

          // Priority: nonLLMTrigger > keywordTrigger > llmTrigger
          const trigger = nonLLMTrigger || keywordTrigger || llmTrigger;
          if (!trigger) return undefined;

          // Skip if already triggered for this type
          if (state.triggers.includes(trigger)) return undefined;

          const effectiveAgentId = resolveStatusUpdateAgentId(ctx) ?? "main";

          // Get model ref for review subagent
          const modelRef = getModelRef(api, effectiveAgentId, config, {
            modelProviderId: ctx.modelProviderId,
            modelId: ctx.modelId,
          });
          if (!modelRef) return undefined;

          // Record this trigger
          sessionTracker.recordTrigger(sessionKey, trigger);

          const latestRoundConversation = extractLatestConversationRound(
            eventRecord.messages as unknown[] | undefined,
          );
          const reviewConversation = trimToolTranscriptTurns(
            latestRoundConversation,
          );
          const currentTurnConversation =
            reviewConversation.length > 0
              ? reviewConversation
              : state.turnHistory[state.turnHistory.length - 1]
                  ?.intentInputConversation;

          sessionTracker.recordReviewMessages(
            sessionKey,
            currentTurnConversation ?? [],
          );

          const reviewSessionData = {
            ...state,
            // Keep review subagent inputs bounded. The review prompt should only
            // receive the current turn, not accumulated historical messages.
            turnHistory: [],
          };

          logger.debug(
            `agent_end hook triggered, ctx: ${JSON.stringify(ctx)}}, state: ${JSON.stringify({
              sessionKey: state.sessionKey,
              toolCallCount: state.toolCallCount,
              failureCount: state.failureCount,
              turnCount: state.turnCount,
              skillsUsed: Array.from(state.skillsUsed),
              triggers: state.triggers,
              lastIntentionResult: state.lastIntentionResult,
            })}`,
          );

          // Spawn review subagent in background (don't wait for result)
          spawnReviewSubagent({
            api,
            agentId: effectiveAgentId,
            sessionId: ctx.sessionId!,
            sessionKey,
            triggerType: trigger,
            sessionData: reviewSessionData,
            intentsDir: config.intentsDir,
            messageProvider: ctx.messageProvider,
            modelRef,
            reviewModel: config.selfEvolution?.reviewModel,
            reviewThinkingLevel: config.selfEvolution?.reviewThinkingLevel,
            reviewTimeoutMs: config.selfEvolution?.reviewTimeoutMs,
            triggerIntent: state.lastIntentionResult,
            currentTurnConversation,
          }).catch((err) => {
            logger.debug(`Review subagent spawn failed: ${err}`);
          });
          return undefined;
        } catch {
          return undefined;
        }
      });

      // session_end hook - cleanup session tracking data
      api.on("session_end", async (_event, ctx) => {
        if (!config.selfEvolution?.enabled) return undefined;
        const sessionKey = ctx.sessionKey;
        if (!sessionKey) return undefined;

        try {
          if (!sessionTracker.has(sessionKey)) return undefined;

          sessionTracker.remove(sessionKey);

          return undefined;
        } catch {
          return undefined;
        }
      });
    },
  });
}

export const __testing = {
  normalizePluginConfig,
  clampInt,
  buildIntentionPrompt,
  buildIntentionEmbeddedRunParams,
  parseIntentionResult,
  buildPromptPrefix,
  applyQueryFilters,
  extractLatestConversationRound,
  extractRecentTurns,
  getModelRef,
  isEnabledForAgent,
  isEligibleInteractiveSession,
  shouldSkipIntentAnalysis,
  isAllowedChatType,
  isAllowedChatId,
  resolveStatusUpdateAgentId,
  filterIntentsForAgent,
  extractSkillsFromToolCall,
  trimToolTranscriptTurns,
};
