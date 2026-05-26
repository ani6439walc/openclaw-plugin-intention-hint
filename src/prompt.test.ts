import { describe, it, expect } from "vitest";
import {
  buildIntentionPrompt,
  parseIntentionResult,
  buildPromptPrefix,
} from "./prompt.js";
import type {
  IntentDefinition,
  IntentionResult,
  ResolvedIntentionHintPluginConfig,
  RecentTurn,
} from "./types.js";
import { FALLBACK_INTENT } from "./constants.js";

describe("buildIntentionPrompt", () => {
  const mockIntents: IntentDefinition[] = [
    {
      id: "coding",
      name: "Coding Task",
      triggers: ["write code", "implement", "create function"],
      examples: [
        "Write a function to sort an array",
        "Implement a login system",
      ],
      enabled: true,
      prompt: "You are helping with coding tasks.",
    },
    {
      id: "debugging",
      name: "Debugging",
      triggers: ["fix bug", "error", "not working"],
      examples: ["My code throws an error", "Fix this bug"],
      enabled: true,
      prompt: "You are helping debug issues.",
    },
    {
      id: "disabled-intent",
      name: "Disabled Intent",
      triggers: ["test"],
      examples: [],
      enabled: false,
      prompt: "This should not appear.",
    },
  ];

  it("should include intent catalog in prompt", () => {
    const result = buildIntentionPrompt({
      intents: mockIntents,
      latest: "hello",
    });

    expect(result).toContain('<intent id="coding" name="Coding Task">');
    expect(result).toContain('<intent id="debugging" name="Debugging">');
    expect(result).toContain("triggers:");
    expect(result).toContain("- write code");
    expect(result).toContain("examples:");
    expect(result).toContain("- Write a function to sort an array");
  });

  it("should not include disabled intents", () => {
    const result = buildIntentionPrompt({
      intents: mockIntents,
      latest: "hello",
    });

    expect(result).not.toContain('<intent id="disabled-intent"');
    expect(result).not.toContain("Disabled Intent");
  });

  it("should always include fallback intent", () => {
    const result = buildIntentionPrompt({
      intents: [],
      latest: "hello",
    });

    expect(result).toContain(`intent: ${FALLBACK_INTENT.id}`);
    expect(result).toContain(FALLBACK_INTENT.name);
  });

  it("should include conversation history when provided", () => {
    const conversation: RecentTurn[] = [
      { role: "user", text: "Hello there" },
      { role: "assistant", text: "Hi! How can I help?" },
    ];

    const result = buildIntentionPrompt({
      intents: mockIntents,
      latest: "I need help with code",
      conversation,
    });

    expect(result).toContain('<turn role="user">\nHello there\n</turn>');
    expect(result).toContain(
      '<turn role="assistant">\nHi! How can I help?\n</turn>',
    );
  });

  it("should include latest message in input section", () => {
    const result = buildIntentionPrompt({
      intents: mockIntents,
      latest: "I need help with code",
    });

    expect(result).toContain("<latest>");
    expect(result).toContain("I need help with code");
    expect(result).toContain("</latest>");
  });

  it("should work with empty conversation", () => {
    const result = buildIntentionPrompt({
      intents: mockIntents,
      latest: "test message",
    });

    expect(result).toContain("<conversation>");
    expect(result).toContain("</conversation>");
    expect(result).toContain("<latest>");
    expect(result).toContain("test message");
  });

  it("should include classification rules and output format", () => {
    const result = buildIntentionPrompt({
      intents: mockIntents,
      latest: "hello",
    });

    expect(result).toContain("<classification_rules>");
    expect(result).toContain("<output_format>");
    expect(result).toContain("intent:");
    expect(result).toContain("reason:");
    expect(result).toContain("goal:");
    expect(result).toContain("confidence:");
    expect(result).toContain("complexity:");
  });
});

describe("parseIntentionResult", () => {
  it("should parse valid intention result", () => {
    const raw = `intent: coding (Coding Task)
reason: User wants to write code
goal: Implement a sorting function
confidence: 0.85
complexity: medium`;

    const result = parseIntentionResult(raw, ["coding", "debugging", "other"]);

    expect(result).toBeDefined();
    expect(result!.intent).toBe("coding");
    expect(result!.reason).toBe("User wants to write code");
    expect(result!.goal).toBe("Implement a sorting function");
    expect(result!.confidence).toBe(0.85);
    expect(result!.complexity).toBe("medium");
  });

  it("should parse with suggestion when confidence is low", () => {
    const raw = `intent: other (Unclassified)
reason: Unable to confidently classify
goal: User is asking something unclear
confidence: 0.45
complexity: low
suggestion: Please clarify what you need help with`;

    const result = parseIntentionResult(raw, ["coding", "debugging", "other"]);

    expect(result).toBeDefined();
    expect(result!.intent).toBe("other");
    expect(result!.suggestion).toBe("Please clarify what you need help with");
  });

  it("should handle case-insensitive field names", () => {
    const raw = `INTENT: coding
REASON: User wants code
GOAL: Sort function
CONFIDENCE: 0.9
COMPLEXITY: HIGH`;

    const result = parseIntentionResult(raw, ["coding", "other"]);

    expect(result).toBeDefined();
    expect(result!.intent).toBe("coding");
    expect(result!.complexity).toBe("high");
  });

  it("should return undefined for incomplete results", () => {
    const raw = `intent: coding
reason: User wants code`;

    const result = parseIntentionResult(raw, ["coding", "other"]);

    expect(result).toBeUndefined();
  });

  it("should fallback to valid intent when intent not in list", () => {
    const raw = `intent: unknown-intent
reason: Some reason
goal: Some goal
confidence: 0.8
complexity: medium`;

    const result = parseIntentionResult(raw, ["coding", "other"]);

    expect(result).toBeDefined();
    expect(result!.intent).toBe("other");
  });

  it("should handle case-insensitive intent matching", () => {
    const raw = `intent: CODING
reason: User wants code
goal: Sort function
confidence: 0.8
complexity: medium`;

    const result = parseIntentionResult(raw, ["coding", "other"]);

    expect(result).toBeDefined();
    expect(result!.intent).toBe("coding");
  });

  it("should handle confidence as integer", () => {
    const raw = `intent: coding
reason: User wants code
goal: Sort function
confidence: 1
complexity: low`;

    const result = parseIntentionResult(raw, ["coding"]);

    expect(result).toBeDefined();
    expect(result!.confidence).toBe(1);
  });

  it("should ignore invalid confidence values", () => {
    const raw = `intent: coding
reason: User wants code
goal: Sort function
confidence: invalid
complexity: low`;

    const result = parseIntentionResult(raw, ["coding"]);

    expect(result).toBeUndefined();
  });

  it("should ignore out-of-range confidence values", () => {
    const raw = `intent: coding
reason: User wants code
goal: Sort function
confidence: 1.5
complexity: low`;

    const result = parseIntentionResult(raw, ["coding"]);

    expect(result).toBeUndefined();
  });

  it("should handle empty suggestion", () => {
    const raw = `intent: coding
reason: User wants code
goal: Sort function
confidence: 0.8
complexity: low
suggestion:`;

    const result = parseIntentionResult(raw, ["coding"]);

    expect(result).toBeDefined();
    expect(result!.suggestion).toBeUndefined();
  });

  it("should strip output_format tags", () => {
    const raw = `<output_format>
intent: coding
reason: User wants code
goal: Sort function
confidence: 0.8
complexity: low
</output_format>`;

    const result = parseIntentionResult(raw, ["coding"]);

    expect(result).toBeDefined();
    expect(result!.intent).toBe("coding");
  });
});

describe("buildPromptPrefix", () => {
  const mockIntents: IntentDefinition[] = [
    {
      id: "coding",
      name: "Coding Task",
      triggers: [],
      examples: [],
      enabled: true,
      prompt:
        "You are helping with coding tasks. Write clean, well-tested code.",
    },
    {
      id: "debugging",
      name: "Debugging",
      triggers: [],
      examples: [],
      enabled: true,
      prompt: "You are helping debug issues. Be thorough in your analysis.",
    },
    {
      id: "disabled-intent",
      name: "Disabled",
      triggers: [],
      examples: [],
      enabled: false,
      prompt: "This intent is disabled.",
    },
  ];

  const mockConfig: ResolvedIntentionHintPluginConfig = {
    agents: [],
    intentDeny: {},
    model: undefined,
    modelFallback: undefined,
    allowedChatTypes: [],
    allowedChatIds: [],
    deniedChatIds: [],
    queryMode: "recent",
    contextWindow: {
      user: { turns: 5, chars: 220 },
      assistant: { turns: 5, chars: 180 },
    },
    timeoutMs: 3000,
    intentsDir: undefined,
    complexityPrompts: {
      low: "LOW_COMPLEXITY_PROMPT",
      medium: "MEDIUM_COMPLEXITY_PROMPT",
      high: "HIGH_COMPLEXITY_PROMPT",
    },
  };

  it("should build prefix with intent prompt and complexity", () => {
    const result: IntentionResult = {
      intent: "coding",
      reason: "User wants to write code",
      goal: "Implement a function",
      confidence: 0.9,
      complexity: "medium",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toBeDefined();
    expect(prefix).toContain("reason: User wants to write code");
    expect(prefix).toContain("goal: Implement a function");
    expect(prefix).toContain("confidence: 0.9");
    expect(prefix).toContain("complexity: medium");
    expect(prefix).toContain("You are helping with coding tasks");
    expect(prefix).toContain("MEDIUM_COMPLEXITY_PROMPT");
  });

  it("should include suggestion when present", () => {
    const result: IntentionResult = {
      intent: "coding",
      reason: "User wants code",
      goal: "Implement something",
      suggestion: "Consider breaking this into smaller tasks",
      confidence: 0.6,
      complexity: "high",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain(
      "suggestion: Consider breaking this into smaller tasks",
    );
  });

  it("should use low complexity prompt for low complexity", () => {
    const result: IntentionResult = {
      intent: "coding",
      reason: "Simple request",
      goal: "Say hello",
      confidence: 0.95,
      complexity: "low",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain("LOW_COMPLEXITY_PROMPT");
  });

  it("should use high complexity prompt for high complexity", () => {
    const result: IntentionResult = {
      intent: "coding",
      reason: "Complex request",
      goal: "Build entire system",
      confidence: 0.8,
      complexity: "high",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain("HIGH_COMPLEXITY_PROMPT");
  });

  it("should fallback to FALLBACK_INTENT when intent not found", () => {
    const result: IntentionResult = {
      intent: "unknown-intent",
      reason: "Unknown request",
      goal: "Do something",
      confidence: 0.5,
      complexity: "medium",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain(FALLBACK_INTENT.prompt);
  });

  it("should fallback to FALLBACK_INTENT when intent is disabled", () => {
    const result: IntentionResult = {
      intent: "disabled-intent",
      reason: "Request for disabled intent",
      goal: "Do something",
      confidence: 0.8,
      complexity: "low",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain(FALLBACK_INTENT.prompt);
    expect(prefix).not.toContain("This intent is disabled");
  });

  it("should wrap content in intention_hint_plugin tags", () => {
    const result: IntentionResult = {
      intent: "coding",
      reason: "User wants code",
      goal: "Build app",
      confidence: 0.9,
      complexity: "medium",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain("<intention_hint_plugin>");
    expect(prefix).toContain("</intention_hint_plugin>");
  });

  it("should include untrusted context header", () => {
    const result: IntentionResult = {
      intent: "coding",
      reason: "User wants code",
      goal: "Build app",
      confidence: 0.9,
      complexity: "medium",
    };

    const prefix = buildPromptPrefix(result, mockIntents, mockConfig);

    expect(prefix).toContain("Untrusted context");
  });
});
