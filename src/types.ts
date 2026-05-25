export type ComplexityPromptsConfig = {
  low?: string;
  medium?: string;
  high?: string;
};

export type ResolvedComplexityPromptsConfig = {
  low: string;
  medium: string;
  high: string;
};

export type SelfEvolutionTriggersConfig = {
  /** LLM satisfaction check interval in turns (default: 5) */
  satisfactionCheckInterval?: number;
  /** Non-LLM: tool call count threshold (default: 5) */
  toolCallCountThreshold?: number;
  /** Non-LLM: used skills size threshold (default: 0, means any skill triggers) */
  skillsUsedThreshold?: number;
  /** Non-LLM: tool failure count threshold (default: 2) */
  failureCountThreshold?: number;
  /** Non-LLM: confidence threshold for weak_intent (default: 0.8) */
  weakIntentConfidenceThreshold?: number;
};

export type ThinkLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "adaptive"
  | "max";

export type SelfEvolutionConfig = {
  enabled?: boolean;
  reviewModel?: string;
  reviewThinkingLevel?: ThinkLevel;
  reviewTimeoutMs?: number;
  triggers?: SelfEvolutionTriggersConfig;
};

export type IntentionHintPluginConfig = {
  agents?: string[];
  intentDeny?: Record<string, string[]>;
  model?: string;
  modelFallback?: string;
  allowedChatTypes?: string[];
  allowedChatIds?: string[];
  deniedChatIds?: string[];
  queryMode?: string;
  recentUserTurns?: number;
  recentAssistantTurns?: number;
  recentUserChars?: number;
  recentAssistantChars?: number;
  timeoutMs?: number;
  intentsDir?: string;
  intentsHotReload?: boolean;
  intentsHotReloadIntervalMs?: number;
  complexityPrompts?: ComplexityPromptsConfig;
  selfEvolution?: SelfEvolutionConfig;
};

export type ResolvedIntentionHintPluginConfig = {
  agents: string[];
  intentDeny: Record<string, string[]>;
  model: string | undefined;
  modelFallback: string | undefined;
  allowedChatTypes: string[];
  allowedChatIds: string[];
  deniedChatIds: string[];
  queryMode: "message" | "recent" | "full";
  recentUserTurns: number;
  recentAssistantTurns: number;
  recentUserChars: number;
  recentAssistantChars: number;
  timeoutMs: number;
  intentsDir: string | undefined;
  intentsHotReload: boolean;
  intentsHotReloadIntervalMs: number;
  complexityPrompts: ResolvedComplexityPromptsConfig;
  selfEvolution: {
    enabled: boolean;
    reviewModel: string | undefined;
    reviewThinkingLevel: ThinkLevel;
    reviewTimeoutMs: number;
    triggers: {
      satisfactionCheckInterval: number;
      toolCallCountThreshold: number;
      skillsUsedThreshold: number;
      failureCountThreshold: number;
      weakIntentConfidenceThreshold: number;
    };
  };
};

export type IntentDefinition = {
  enabled: boolean;
  id: string;
  name: string;
  triggers: string[];
  examples: string[];
  prompt: string;
};

export type IntentionResult = {
  intent: string;
  reason: string;
  goal: string;
  suggestion?: string;
  confidence: number;
  complexity: "low" | "medium" | "high";
};

export type TurnRecord = {
  turnNumber: number;
  intentInputConversation: RecentTurn[];
  reviewMessages: unknown[];
  intentResult: IntentionResult;
};

export type ToolCallRecord = {
  toolName: string;
  params: string;
  result: string;
  error?: string;
  turnNumber: number;
};

export type RecentTurn = {
  role: string;
  text: string;
};

export type MessageContentPart = {
  type?: string;
  text?: string;
  value?: string;
  content?: string;
};

export type PromptMessageLike = {
  role?: string;
  content?: string | Array<string | MessageContentPart>;
};
