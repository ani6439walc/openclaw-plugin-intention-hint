import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "../api.js";
import { resolveConfig } from "./config.js";
import {
  buildIntentionEmbeddedRunParams,
  runTopicSwitchSubagent,
} from "./subagent.js";

describe("buildIntentionEmbeddedRunParams", () => {
  it("uses a run-specific session file", () => {
    const result = buildIntentionEmbeddedRunParams({
      params: {
        api: { config: {} } as OpenClawPluginApi,
        config: resolveConfig({}),
        agentId: "main",
        modelRef: { provider: "google", model: "intent" },
      },
      subagentSessionId: "intention-hint-test-run",
      subagentSessionKey: "agent:main:intention-hint:test",
      prompt: "classify",
    });

    expect(result.sessionFile).toBe(
      "/tmp/intention-hint-test-run.session.jsonl",
    );
  });
});

describe("runTopicSwitchSubagent", () => {
  it("runs a tool-free topic checker with classifier config", async () => {
    const runEmbeddedPiAgent = vi.fn().mockResolvedValue({
      payloads: [
        {
          text: JSON.stringify({
            keywords: [" Topic ", "Checker"],
            topicChanged: false,
            topicChangeReason: "same_topic",
          }),
        },
      ],
    });
    const api = {
      config: {},
      runtime: { agent: { runEmbeddedPiAgent } },
    } as unknown as OpenClawPluginApi;

    const result = await runTopicSwitchSubagent({
      api,
      config: resolveConfig({
        model: "google/test-intent",
        thinking: "low",
        timeoutMs: 4321,
      }),
      agentId: "main",
      latest: "continue topic checker",
      history: [
        {
          input: "plan topic checker",
          intent: "coding",
          goal: "Plan topic checker",
          keywords: ["topic", "checker"],
          topic: "topic / checker",
        },
      ],
      modelRef: { provider: "google", model: "test-intent" },
    });

    expect(result).toEqual({
      keywords: ["topic", "checker"],
      topic: "topic / checker",
      topicChanged: false,
      topicChangeReason: "same_topic",
    });
    expect(runEmbeddedPiAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        model: "test-intent",
        timeoutMs: 4321,
        thinkLevel: "low",
        disableTools: true,
        prompt: expect.stringContaining("topic continuity checker"),
      }),
    );
  });
});
