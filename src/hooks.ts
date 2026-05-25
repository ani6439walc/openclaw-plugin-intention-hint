import type { ResolvedIntentionHintPluginConfig } from "./types.js";
import type { OpenClawPluginApi } from "../api.js";
import type {
  PluginHookBeforePromptBuildEvent,
  PluginHookAgentContext,
  PluginHookBeforePromptBuildResult,
} from "openclaw/plugin-sdk/types";
import { logger } from "../api.js";
import { defaultCatalog } from "./intent-loader.js";
import { applyQueryFilters, extractRecentTurns } from "./query.js";
import {
  isAllowedChatId,
  isAllowedChatType,
  isEligibleInteractiveSession,
  isEnabledForAgent,
  resolveStatusUpdateAgentId,
  shouldSkipIntentAnalysis,
  resolveCanonicalSessionKeyFromSessionId,
} from "./session.js";
import { getModelRef, runIntentionSubagent } from "./subagent.js";
import { buildPromptPrefix } from "./prompt.js";

export type HookDeps = {
  api: OpenClawPluginApi;
  config: () => ResolvedIntentionHintPluginConfig;
  refreshLiveConfigFromRuntime: () => void;
  refreshIntents: () => void;
};

export function createHookHandlers(deps: HookDeps) {
  const { api, config, refreshLiveConfigFromRuntime, refreshIntents } = deps;

  async function onBeforePromptBuild(
    event: PluginHookBeforePromptBuildEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforePromptBuildResult | undefined> {
    try {
      // Early return checks FIRST (before refresh calls)
      if (shouldSkipIntentAnalysis(ctx)) return undefined;

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
      const effectiveAgentId = resolvedAgentId;

      // Use current config for early checks
      const currentConfig = config();
      if (!isEnabledForAgent(currentConfig, effectiveAgentId)) return undefined;
      if (!isEligibleInteractiveSession(ctx)) return undefined;

      const resolvedSessionKeyForChecks = resolvedSessionKey ?? ctx.sessionKey;
      if (
        !isAllowedChatType(currentConfig, {
          ...ctx,
          sessionKey: resolvedSessionKeyForChecks,
          mainKey: api.config.session?.mainKey,
        })
      ) {
        return undefined;
      }
      if (
        !isAllowedChatId(currentConfig, {
          sessionKey: resolvedSessionKeyForChecks,
          messageProvider: ctx.messageProvider,
        })
      ) {
        return undefined;
      }

      // THEN refresh config and intents
      refreshLiveConfigFromRuntime();
      const refreshedConfig = config();

      const allTurns = extractRecentTurns(event.messages);
      const latestUserMessage = event.prompt ?? "";

      const conversation = applyQueryFilters(allTurns, {
        queryMode: refreshedConfig.queryMode,
        recentUserTurns: refreshedConfig.recentUserTurns,
        recentAssistantTurns: refreshedConfig.recentAssistantTurns,
        recentUserChars: refreshedConfig.recentUserChars,
        recentAssistantChars: refreshedConfig.recentAssistantChars,
      });

      const modelRef = getModelRef(api, effectiveAgentId, refreshedConfig, {
        modelProviderId: ctx.modelProviderId,
        modelId: ctx.modelId,
      });
      if (!modelRef) return undefined;

      refreshIntents();
      if (defaultCatalog.count === 0) {
        logger.debug("no intents loaded; skipping intention scan.");
        return undefined;
      }

      logger.debug(
        `before_prompt_build hook triggered, ctx: ${JSON.stringify(ctx)}`,
      );

      const availableIntents = defaultCatalog.filterForAgent(
        refreshedConfig,
        effectiveAgentId,
      );

      const result = await runIntentionSubagent({
        api,
        config: refreshedConfig,
        agentId: effectiveAgentId,
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
        logger.debug("intention subagent failed; skipping hint injection.");
        return undefined;
      }

      logger.debug(`intention subagent result: ${JSON.stringify(result)}`);

      const promptPrefix = buildPromptPrefix(
        result,
        availableIntents,
        refreshedConfig,
      );
      if (!promptPrefix) return undefined;

      return { prependContext: promptPrefix };
    } catch {
      return undefined;
    }
  }

  return {
    onBeforePromptBuild,
  };
}
