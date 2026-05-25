import {
  definePluginEntry,
  logger,
  type OpenClawConfig,
  type OpenClawPluginApi,
} from "../api.js";
import { resolveLivePluginConfigObject } from "openclaw/plugin-sdk/plugin-config-runtime";
import { resolveConfig } from "./config.js";
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

export function createPlugin(api: OpenClawPluginApi) {
  return definePluginEntry({
    id: "intention-hint",
    name: "Intention Hint",
    description:
      "Pre-scans user intent before replies and injects routing hints via before_prompt_build hook.",
    register() {
      let config = resolveConfig(api.pluginConfig);

      const refreshLiveConfigFromRuntime = () => {
        const livePluginConfig = resolveLivePluginConfigObject(
          api.runtime.config?.current
            ? () => api.runtime.config.current() as OpenClawConfig
            : undefined,
          "intention-hint",
          api.pluginConfig as Record<string, unknown>,
        );
        config = resolveConfig(livePluginConfig ?? {});
      };

      refreshLiveConfigFromRuntime();

      const refreshIntents = () => {
        const dir = config.intentsDir;
        if (dir) {
          defaultCatalog.load(dir);
        } else {
          defaultCatalog.reset();
        }
      };
      refreshIntents();

      api.on(
        "before_prompt_build",
        async (event, ctx) => {
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

            // Use current config for early checks (will be refreshed after)
            if (!isEnabledForAgent(config, effectiveAgentId)) return undefined;
            if (!isEligibleInteractiveSession(ctx)) return undefined;
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

            const modelRef = getModelRef(api, effectiveAgentId, config, {
              modelProviderId: ctx.modelProviderId,
              modelId: ctx.modelId,
            });
            if (!modelRef) return undefined;

            // THEN refresh config and intents
            refreshLiveConfigFromRuntime();
            refreshIntents();

            if (defaultCatalog.count === 0) {
              logger.debug("no intents loaded; skipping intention scan.");
              return undefined;
            }

            logger.debug(
              `before_prompt_build hook triggered, ctx: ${JSON.stringify(ctx)}`,
            );

            const availableIntents = defaultCatalog.filterForAgent(
              config,
              effectiveAgentId,
            );

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
              logger.debug(
                "intention subagent failed; skipping hint injection.",
              );
              return undefined;
            }

            logger.debug(
              `intention subagent result: ${JSON.stringify(result)}`,
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
    },
  });
}
