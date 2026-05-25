import { describe, it, expect } from "vitest";
import { resolveConfig, clampInt } from "./config.js";
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

describe("resolveConfig", () => {
  describe("default values", () => {
    it("should use default values for empty config", () => {
      const result = resolveConfig({});
      expect(result.agents).toEqual(["main"]);
      expect(result.allowedChatTypes).toEqual(["direct"]);
      expect(result.intentsDir).toBe("./intents");
      expect(result.queryMode).toBe(DEFAULT_QUERY_MODE);
      expect(result.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
      expect(result.recentUserTurns).toBe(DEFAULT_RECENT_USER_TURNS);
      expect(result.recentAssistantTurns).toBe(DEFAULT_RECENT_ASSISTANT_TURNS);
      expect(result.recentUserChars).toBe(DEFAULT_RECENT_USER_CHARS);
      expect(result.recentAssistantChars).toBe(DEFAULT_RECENT_ASSISTANT_CHARS);
    });

    it("should handle empty object loading", () => {
      const result = resolveConfig({});
      expect(result.intentDeny).toEqual({});
      expect(result.allowedChatIds).toEqual([]);
      expect(result.deniedChatIds).toEqual([]);
      expect(result.model).toBeUndefined();
      expect(result.modelFallback).toBeUndefined();
    });
  });

  describe("enum validation", () => {
    it("should accept valid queryMode values", () => {
      const messageResult = resolveConfig({ queryMode: "message" });
      expect(messageResult.queryMode).toBe("message");

      const recentResult = resolveConfig({ queryMode: "recent" });
      expect(recentResult.queryMode).toBe("recent");

      const fullResult = resolveConfig({ queryMode: "full" });
      expect(fullResult.queryMode).toBe("full");
    });

    it("should fall back to default for invalid queryMode", () => {
      const result = resolveConfig({ queryMode: "invalid" });
      expect(result.queryMode).toBe(DEFAULT_QUERY_MODE);
    });

    it("should use default when queryMode is undefined", () => {
      const result = resolveConfig({});
      expect(result.queryMode).toBe(DEFAULT_QUERY_MODE);
    });
  });

  describe("complex structure - intentDeny map", () => {
    it("should parse intentDeny with valid structure", () => {
      const result = resolveConfig({
        intentDeny: {
          agent1: ["pattern1", "pattern2"],
          agent2: ["pattern3"],
        },
      });
      expect(result.intentDeny).toEqual({
        agent1: ["pattern1", "pattern2"],
        agent2: ["pattern3"],
      });
    });

    it("should filter out empty patterns in intentDeny", () => {
      const result = resolveConfig({
        intentDeny: {
          agent1: ["pattern1", "", "  ", "pattern2"],
          agent2: [],
        },
      });
      expect(result.intentDeny).toEqual({
        agent1: ["pattern1", "pattern2"],
      });
    });

    it("should trim keys in intentDeny", () => {
      const result = resolveConfig({
        intentDeny: {
          "  agent1  ": ["pattern1"],
        },
      });
      expect(result.intentDeny).toHaveProperty("agent1");
      expect(result.intentDeny).not.toHaveProperty("  agent1  ");
    });

    it("should return empty object for non-object intentDeny", () => {
      const result = resolveConfig({ intentDeny: "invalid" });
      expect(result.intentDeny).toEqual({});
    });

    it("should return empty object for array intentDeny", () => {
      const result = resolveConfig({ intentDeny: ["invalid"] });
      expect(result.intentDeny).toEqual({});
    });
  });

  describe("clampInt behavior", () => {
    it("should clamp timeoutMs within bounds (250-120000)", () => {
      const lowResult = resolveConfig({ timeoutMs: 100 });
      expect(lowResult.timeoutMs).toBe(250);

      const highResult = resolveConfig({ timeoutMs: 200000 });
      expect(highResult.timeoutMs).toBe(120000);

      const validResult = resolveConfig({ timeoutMs: 5000 });
      expect(validResult.timeoutMs).toBe(5000);
    });

    it("should clamp recentUserTurns within bounds (0-20)", () => {
      const lowResult = resolveConfig({ recentUserTurns: -5 });
      expect(lowResult.recentUserTurns).toBe(0);

      const highResult = resolveConfig({ recentUserTurns: 50 });
      expect(highResult.recentUserTurns).toBe(20);

      const validResult = resolveConfig({ recentUserTurns: 10 });
      expect(validResult.recentUserTurns).toBe(10);
    });

    it("should clamp recentAssistantTurns within bounds (0-10)", () => {
      const lowResult = resolveConfig({ recentAssistantTurns: -1 });
      expect(lowResult.recentAssistantTurns).toBe(0);

      const highResult = resolveConfig({ recentAssistantTurns: 20 });
      expect(highResult.recentAssistantTurns).toBe(10);

      const validResult = resolveConfig({ recentAssistantTurns: 5 });
      expect(validResult.recentAssistantTurns).toBe(5);
    });

    it("should clamp recentUserChars within bounds (40-1000)", () => {
      const lowResult = resolveConfig({ recentUserChars: 10 });
      expect(lowResult.recentUserChars).toBe(40);

      const highResult = resolveConfig({ recentUserChars: 5000 });
      expect(highResult.recentUserChars).toBe(1000);

      const validResult = resolveConfig({ recentUserChars: 500 });
      expect(validResult.recentUserChars).toBe(500);
    });

    it("should clamp recentAssistantChars within bounds (40-1000)", () => {
      const lowResult = resolveConfig({ recentAssistantChars: 20 });
      expect(lowResult.recentAssistantChars).toBe(40);

      const highResult = resolveConfig({ recentAssistantChars: 2000 });
      expect(highResult.recentAssistantChars).toBe(1000);

      const validResult = resolveConfig({ recentAssistantChars: 300 });
      expect(validResult.recentAssistantChars).toBe(300);
    });

    it("should use default for NaN values", () => {
      const result = resolveConfig({ timeoutMs: NaN });
      expect(result.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    });

    it("should use default for undefined numeric values", () => {
      const result = resolveConfig({ timeoutMs: undefined });
      expect(result.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    });
  });

  describe("string array fields", () => {
    it("should parse agents as string array", () => {
      const result = resolveConfig({ agents: ["agent1", "agent2"] });
      expect(result.agents).toEqual(["agent1", "agent2"]);
    });

    it("should trim and filter empty strings in agents", () => {
      const result = resolveConfig({
        agents: ["  agent1  ", "", "  ", "agent2"],
      });
      expect(result.agents).toEqual(["agent1", "agent2"]);
    });

    it("should convert single string to array", () => {
      const result = resolveConfig({ agents: "singleAgent" });
      expect(result.agents).toEqual(["singleAgent"]);
    });

    it("should use default for empty agents array", () => {
      const result = resolveConfig({ agents: [] });
      expect(result.agents).toEqual(["main"]);
    });

    it("should parse allowedChatIds as string array", () => {
      const result = resolveConfig({ allowedChatIds: ["id1", "id2"] });
      expect(result.allowedChatIds).toEqual(["id1", "id2"]);
    });

    it("should parse deniedChatIds as string array", () => {
      const result = resolveConfig({ deniedChatIds: ["id1", "id2"] });
      expect(result.deniedChatIds).toEqual(["id1", "id2"]);
    });

    it("should parse allowedChatTypes as string array", () => {
      const result = resolveConfig({ allowedChatTypes: ["direct", "group"] });
      expect(result.allowedChatTypes).toEqual(["direct", "group"]);
    });
  });

  describe("complexityPrompts", () => {
    it("should use default prompts when not provided", () => {
      const result = resolveConfig({});
      expect(result.complexityPrompts.low).toBe(DEFAULT_LOW_COMPLEXITY_PROMPT);
      expect(result.complexityPrompts.medium).toBe(
        DEFAULT_MEDIUM_COMPLEXITY_PROMPT,
      );
      expect(result.complexityPrompts.high).toBe(
        DEFAULT_HIGH_COMPLEXITY_PROMPT,
      );
    });

    it("should parse custom complexity prompts", () => {
      const result = resolveConfig({
        complexityPrompts: {
          low: "Custom low prompt",
          medium: "Custom medium prompt",
          high: "Custom high prompt",
        },
      });
      expect(result.complexityPrompts.low).toBe("Custom low prompt");
      expect(result.complexityPrompts.medium).toBe("Custom medium prompt");
      expect(result.complexityPrompts.high).toBe("Custom high prompt");
    });

    it("should use default for empty or whitespace-only prompts", () => {
      const result = resolveConfig({
        complexityPrompts: {
          low: "",
          medium: "   ",
          high: "Valid prompt",
        },
      });
      expect(result.complexityPrompts.low).toBe(DEFAULT_LOW_COMPLEXITY_PROMPT);
      expect(result.complexityPrompts.medium).toBe(
        DEFAULT_MEDIUM_COMPLEXITY_PROMPT,
      );
      expect(result.complexityPrompts.high).toBe("Valid prompt");
    });
  });

  describe("optional fields", () => {
    it("should handle optional model field", () => {
      const withModel = resolveConfig({ model: "gpt-4" });
      expect(withModel.model).toBe("gpt-4");

      const withoutModel = resolveConfig({});
      expect(withoutModel.model).toBeUndefined();
    });

    it("should handle optional modelFallback field", () => {
      const withFallback = resolveConfig({ modelFallback: "gpt-3.5" });
      expect(withFallback.modelFallback).toBe("gpt-3.5");

      const withoutFallback = resolveConfig({});
      expect(withoutFallback.modelFallback).toBeUndefined();
    });

    it("should handle optional intentsDir field", () => {
      const withDir = resolveConfig({ intentsDir: "./custom-intents" });
      expect(withDir.intentsDir).toBe("./custom-intents");

      const withoutDir = resolveConfig({});
      expect(withoutDir.intentsDir).toBe("./intents");
    });
  });
});

describe("clampInt", () => {
  it("should return fallback for undefined", () => {
    expect(clampInt(undefined, 10, 0, 100)).toBe(10);
  });

  it("should return fallback for NaN", () => {
    expect(clampInt(NaN, 10, 0, 100)).toBe(10);
  });

  it("should clamp to minimum", () => {
    expect(clampInt(-10, 50, 0, 100)).toBe(0);
  });

  it("should clamp to maximum", () => {
    expect(clampInt(150, 50, 0, 100)).toBe(100);
  });

  it("should floor decimal values", () => {
    expect(clampInt(50.7, 10, 0, 100)).toBe(50);
    expect(clampInt(50.2, 10, 0, 100)).toBe(50);
  });

  it("should return value when within bounds", () => {
    expect(clampInt(50, 10, 0, 100)).toBe(50);
  });
});
