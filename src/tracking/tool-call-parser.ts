export interface ToolCallInfo {
  id: string;
  toolName: string;
  params: string;
  result: string;
  isError: boolean;
}

interface ToolCallContent {
  type: "toolCall";
  id: string;
  name: string;
  arguments?: unknown;
  partialArgs?: string;
}

interface ToolResultContent {
  type: "toolResult";
  toolCallId: string;
  result: unknown;
  isError?: boolean;
  resultIsPlainText?: boolean;
}

interface MessageContent {
  type: string;
  [key: string]: unknown;
}

interface Message {
  role: string;
  content?: MessageContent[];
  [key: string]: unknown;
}

export function extractToolCallsFromMessages(
  messages: unknown[],
): ToolCallInfo[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const toolCalls = new Map<string, ToolCallContent>();
  const toolResults = new Map<string, ToolResultContent>();

  for (const message of messages) {
    if (!isMessage(message)) {
      continue;
    }

    const topLevelToolResult = extractTopLevelToolResult(message);
    if (topLevelToolResult) {
      toolResults.set(topLevelToolResult.toolCallId, topLevelToolResult);
    }

    if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (!isMessageContent(content)) {
          continue;
        }

        if (content.type === "toolCall") {
          const toolCall = content as unknown as ToolCallContent;
          const args = stringifyToolArguments(toolCall.arguments);
          if (toolCall.id && toolCall.name && args !== undefined) {
            toolCalls.set(toolCall.id, toolCall);
          }
        } else if (content.type === "toolResult") {
          const toolResult = content as unknown as ToolResultContent;
          if (toolResult.toolCallId) {
            toolResults.set(toolResult.toolCallId, toolResult);
          }
        }
      }
    }
  }

  const result: ToolCallInfo[] = [];

  for (const [callId, toolCall] of toolCalls) {
    const toolResult = toolResults.get(callId);

    if (!toolResult) {
      continue;
    }

    const params = stringifyToolArguments(toolCall.arguments);
    if (params === undefined) {
      continue;
    }

    result.push({
      id: callId,
      toolName: toolCall.name,
      params,
      result: stringifyToolResult(toolResult),
      isError: toolResult.isError ?? false,
    });
  }

  return result;
}

function isMessage(value: unknown): value is Message {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Message).role === "string"
  );
}

function isMessageContent(value: unknown): value is MessageContent {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MessageContent).type === "string"
  );
}

function stringifyToolArguments(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  const json = JSON.stringify(value);
  return typeof json === "string" ? json : undefined;
}

function stringifyToolResult(toolResult: ToolResultContent): string {
  if (toolResult.resultIsPlainText) {
    return typeof toolResult.result === "string"
      ? toolResult.result
      : String(toolResult.result ?? "");
  }
  const json = JSON.stringify(toolResult.result);
  return typeof json === "string" ? json : "";
}

function extractTopLevelToolResult(
  message: Message,
): ToolResultContent | undefined {
  if (message.role !== "toolResult" && message.role !== "tool") {
    return undefined;
  }
  if (typeof message.toolCallId !== "string") {
    return undefined;
  }

  const textResult = extractTextResult(message.content);
  if (textResult !== undefined) {
    return {
      type: "toolResult",
      toolCallId: message.toolCallId,
      result: textResult,
      isError: message.isError === true,
      resultIsPlainText: true,
    };
  }

  return {
    type: "toolResult",
    toolCallId: message.toolCallId,
    result: message.result ?? message.content,
    isError: message.isError === true,
  };
}

function extractTextResult(content: unknown): string | undefined {
  if (!Array.isArray(content)) return undefined;

  const texts = content.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Record<string, unknown>;
    const text = record.text ?? record.content ?? record.value;
    return typeof text === "string" ? [text] : [];
  });

  return texts.length > 0 ? texts.join("\n") : undefined;
}
