import type { OpenClawPluginApi } from "../../api.js";
import type { IntentionResult, ThinkLevel } from "../types.js";
import type { SessionEvolutionState } from "../tracking/session-tracker.js";
import crypto from "crypto";
import { writeBacklogEntry } from "./backlog-writer.js";

const REVIEW_TIMEOUT_MS = 30_000;

export type SpawnReviewSubagentParams = {
  api: OpenClawPluginApi;
  agentId: string;
  sessionId: string;
  sessionKey?: string;
  triggerType: string;
  sessionData: SessionEvolutionState;
  intentInputConversation?: import("../types.js").RecentTurn[];
  intentsDir?: string;
  messageProvider?: string;
  modelRef: { provider: string; model: string };
  reviewModel?: string;
  reviewThinkingLevel?: ThinkLevel;
  reviewTimeoutMs?: number;
  turnHistory?: import("../types.js").TurnRecord[];
  triggerIntent?: import("../types.js").IntentionResult | null;
  triggerConversation?: import("../types.js").RecentTurn[];
  currentTurnConversation?: import("../types.js").RecentTurn[];
};

export type ReviewResult = {
  passed: boolean;
  issues: string[];
  suggestions: string[];
  timestamp: string;
};

export function resolveReviewModelRef(params: {
  modelRef: { provider: string; model: string };
  reviewModel?: string;
}): { provider: string; model: string } {
  const reviewModel = params.reviewModel?.trim();
  if (!reviewModel) return params.modelRef;

  const slashIndex = reviewModel.indexOf("/");
  if (slashIndex > 0 && slashIndex < reviewModel.length - 1) {
    return {
      provider: reviewModel.slice(0, slashIndex),
      model: reviewModel.slice(slashIndex + 1),
    };
  }

  return { provider: params.modelRef.provider, model: reviewModel };
}

const REVIEW_PROMPT_TEMPLATE = `# Self-Evolution Review Task

You are a review subagent for the intention-hint plugin's self-evolution system.

## Task
Review the current session state and identify potential improvements for future sessions.

## Session Context

### Trigger
- Trigger type: {{triggerType}}

### Metrics (Counts Only)
- Tool calls: {{toolCallCount}}
- Failures: {{failureCount}}
- Turns: {{turnCount}}
- Skills used: {{skillsUsed}}

### Trigger Round Context
The following conversation was used as input for intent classification:
{{triggerConversation}}

### Last Intent Analysis Summary
Intent: {{intent}}
Reason: {{reason}}
Goal: {{goal}}
Confidence: {{confidence}}
Complexity: {{complexity}}

{{conversationSection}}

### Intent File Analysis
You can read intent definition files from: {{intentsDir}}
Use the read tool to examine intent files and suggest improvements.

## Review Guidelines

1. **Efficiency**: Are there unnecessary tool calls? Could some steps be combined?
2. **Skills**: Were the right skills used? Missing skills that should have been triggered?
3. **Intent Accuracy**: Was the intent classification accurate based on the outcome?
4. **Failure Patterns**: Identify recurring failure patterns if any.
5. **Prompt Quality**: Any improvements to the complexity prompts?

## Output Format

Provide your review in this exact JSON format:

\`\`\`json
{
  "passed": true | false,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "timestamp": "{{timestamp}}"
}
\`\`\`

## Important Constraints
- Focus on analyzing the structured conversation patterns and metrics provided in this prompt.
- Do not attempt to use external tools or fetch additional history outside the scope of this prompt.
- Keep suggestions actionable and specific
`;

function buildConversationSection(params: SpawnReviewSubagentParams): string {
  if (
    params.currentTurnConversation &&
    params.currentTurnConversation.length > 0
  ) {
    return buildSingleTurnConversationSection(params.currentTurnConversation);
  }

  return "### Conversation\n\nNo conversation data available.\n";
}

function buildSingleTurnConversationSection(
  conversation: import("../types.js").RecentTurn[],
): string {
  const lines = ["### Current Turn Conversation\n"];

  for (const turn of conversation) {
    lines.push(`**${turn.role}**: ${turn.text}\n`);
  }

  return lines.join("\n");
}

function buildTurnHistorySection(
  turnHistory?: import("../types.js").TurnRecord[] | null,
): string {
  if (!turnHistory || turnHistory.length === 0) {
    return "### Turn History\n\nNo turn history available.\n";
  }

  const lines = [
    "### Turn History\n",
    `Total turns recorded: ${turnHistory.length}\n`,
  ];

  for (const record of turnHistory) {
    lines.push(`#### Turn ${record.turnNumber}`);
    lines.push(`- Intent: ${record.intentResult.intent}`);
    lines.push(`- Confidence: ${record.intentResult.confidence}`);
    lines.push(`- Complexity: ${record.intentResult.complexity}`);
    if (record.reviewMessages && record.reviewMessages.length > 0) {
      lines.push("- Messages:");
      lines.push("```");
      for (const msg of record.reviewMessages as any[]) {
        const role = msg.role || "unknown";
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              lines.push(`[${role}]: ${block.text}`);
            } else if (block.type === "toolCall" && block.name) {
              lines.push(
                `[${role}]: 📦 ${block.name}(${JSON.stringify(block.arguments)})`,
              );
            } else if (block.type === "thinking") {
              lines.push(`[${role}]: 🤔 [thinking]`);
            }
          }
        } else if (typeof content === "string") {
          lines.push(`[${role}]: ${content}`);
        }
      }
      lines.push("```\n");
    } else {
      lines.push(
        `- Conversation structure: ${record.intentInputConversation.length} turns`,
      );
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function buildTriggerConversationSection(
  triggerConversation?: import("../types.js").RecentTurn[] | null,
): string {
  if (!triggerConversation || triggerConversation.length === 0) {
    return "No trigger conversation available.";
  }

  const lines: string[] = [];
  for (const turn of triggerConversation) {
    lines.push(`**${turn.role}**: ${turn.text}`);
  }
  return lines.join("\n");
}

export function buildReviewPrompt(params: SpawnReviewSubagentParams): string {
  const intentResult =
    params.triggerIntent ?? params.sessionData.lastIntentionResult;
  const skillsUsed =
    Array.from(params.sessionData.skillsUsed).join(", ") || "none";
  const timestamp = new Date().toISOString();

  const conversationSection = buildConversationSection(params);
  const triggerConversationSection = buildTriggerConversationSection(
    params.triggerConversation,
  );

  return REVIEW_PROMPT_TEMPLATE.replace("{{triggerType}}", params.triggerType)
    .replace("{{toolCallCount}}", String(params.sessionData.toolCallCount))
    .replace("{{failureCount}}", String(params.sessionData.failureCount))
    .replace("{{turnCount}}", String(params.sessionData.turnCount))
    .replace("{{skillsUsed}}", skillsUsed)
    .replace("{{intentSummary}}", "See below for detailed intent analysis")
    .replace("{{toolHistorySection}}", "")
    .replace("{{conversationSection}}", conversationSection)
    .replace("{{timestamp}}", timestamp)
    .replace("{{triggerConversation}}", triggerConversationSection)
    .replace("{{intent}}", intentResult?.intent ?? "unknown")
    .replace("{{reason}}", intentResult?.reason ?? "N/A")
    .replace("{{goal}}", intentResult?.goal ?? "N/A")
    .replace("{{confidence}}", String(intentResult?.confidence ?? "N/A"))
    .replace("{{complexity}}", intentResult?.complexity ?? "N/A")
    .replace("{{intentsDir}}", params.intentsDir ?? "N/A");
}

function buildReviewSessionKey(
  _parentSessionKey: string | undefined,
  _sessionId: string,
  agentId: string,
): string {
  const timestamp = Date.now().toString(36);
  return `agent:${agentId}:evolution-review:${timestamp}`;
}

export function parseReviewResult(raw: string): ReviewResult | null {
  try {
    const jsonMatch = raw.match(/```json\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (
        typeof parsed.passed === "boolean" &&
        Array.isArray(parsed.issues) &&
        Array.isArray(parsed.suggestions)
      ) {
        return {
          passed: parsed.passed,
          issues: parsed.issues,
          suggestions: parsed.suggestions,
          timestamp: parsed.timestamp ?? new Date().toISOString(),
        };
      }
    }

    const directParsed = JSON.parse(raw.trim());
    if (
      typeof directParsed.passed === "boolean" &&
      Array.isArray(directParsed.issues) &&
      Array.isArray(directParsed.suggestions)
    ) {
      return {
        passed: directParsed.passed,
        issues: directParsed.issues,
        suggestions: directParsed.suggestions,
        timestamp: directParsed.timestamp ?? new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function spawnReviewSubagent(
  params: SpawnReviewSubagentParams,
): Promise<ReviewResult | undefined> {
  const reviewSessionId = `evolution-review-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;

  const parentSessionKey = params.sessionKey;

  const reviewSessionKey = buildReviewSessionKey(
    parentSessionKey,
    params.sessionId,
    params.agentId,
  );

  // Verify anti-recursion marker is present
  if (!reviewSessionKey.includes(":evolution-review:")) {
    throw new Error(
      "Review session key must contain :evolution-review: for anti-recursion",
    );
  }

  const prompt = buildReviewPrompt(params);

  const reviewModelRef = resolveReviewModelRef({
    modelRef: params.modelRef,
    reviewModel: params.reviewModel,
  });

  const thinkingLevel = params.reviewThinkingLevel ?? "low";

  const embeddedRunParams = {
    sessionId: reviewSessionId,
    sessionKey: reviewSessionKey,
    agentId: params.agentId,
    messageProvider: params.messageProvider,
    config: params.api.config,
    prompt,
    provider: reviewModelRef.provider,
    model: reviewModelRef.model,
    timeoutMs: params.reviewTimeoutMs ?? REVIEW_TIMEOUT_MS,
    runId: reviewSessionId,
    workspaceDir: "/tmp",
    agentDir: "/tmp",
    sessionFile: `/tmp/${reviewSessionId}.jsonl`,
    trigger: "manual" as const,
    modelRun: false,
    promptMode: "minimal" as const,
    toolsAllow: ["read"],
    disableTools: false,
    disableMessageTool: true,
    allowGatewaySubagentBinding: true,
    bootstrapContextMode: "lightweight" as const,
    verboseLevel: "off" as const,
    thinkLevel: thinkingLevel,
    reasoningLevel: "off" as const,
    silentExpected: true,
    authProfileFailurePolicy: "local" as const,
    cleanupBundleMcpOnRunEnd: true,
  };

  try {
    const result =
      await params.api.runtime.agent.runEmbeddedPiAgent(embeddedRunParams);

    const rawReply = ((result.payloads ?? []) as { text?: string }[])
      .map((payload) => payload.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim();

    const parsed = parseReviewResult(rawReply);
    if (!parsed) {
      return {
        passed: true,
        issues: [],
        suggestions: ["Review result parsing failed - defaulting to passed"],
        timestamp: new Date().toISOString(),
      };
    }

    // Write to backlog with trigger data
    try {
      const triggerData: Record<string, unknown> = {
        toolCallCount: params.sessionData.toolCallCount,
        failureCount: params.sessionData.failureCount,
        turnCount: params.sessionData.turnCount,
        skillsUsed: Array.from(params.sessionData.skillsUsed),
        triggerType: params.triggerType,
        lastIntentResult: params.triggerIntent
          ? {
              intent: params.triggerIntent.intent,
              confidence: params.triggerIntent.confidence,
              complexity: params.triggerIntent.complexity,
            }
          : null,
        turnHistoryCount: params.turnHistory?.length ?? 0,
        reviewResult: parsed,
      };

      writeBacklogEntry({
        type: params.triggerType as any,
        sessionId: params.sessionId,
        status: "pending",
        triggerIntent: params.triggerIntent?.intent,
        summary: `Review triggered by ${params.triggerType}. Found ${parsed.issues.length} issues, ${parsed.suggestions.length} suggestions.`,
        details:
          parsed.issues.length > 0 ? parsed.issues.join("\n") : undefined,
        triggerData,
      });
    } catch {
      // Non-fatal
    }

    return parsed;
  } catch (err) {
    // Return undefined on error - main flow should continue
    return undefined;
  }
}

export { REVIEW_PROMPT_TEMPLATE, REVIEW_TIMEOUT_MS };
