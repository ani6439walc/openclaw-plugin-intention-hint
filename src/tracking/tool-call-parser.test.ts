import { describe, expect, it } from "vitest";
import { extractToolCallsFromMessages } from "./tool-call-parser.js";

describe("extractToolCallsFromMessages", () => {
  describe("basic parsing", () => {
    it("extracts single tool call with matching result", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/test.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "file content",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "call-1",
        toolName: "read",
        params: '{"path": "/test.txt"}',
        result: '"file content"',
        isError: false,
      });
    });

    it("extracts OpenClaw transcript tool results with object arguments", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call_a5a71ae7017c45b39e61ddad",
              name: "read",
              arguments: { path: "~/.openclaw/skills/cx/SKILL.md" },
              partialArgs: '{"path": "~/.openclaw/skills/cx/SKILL.md"}',
            },
          ],
        },
        {
          role: "toolResult",
          toolCallId: "call_a5a71ae7017c45b39e61ddad",
          toolName: "read",
          content: [
            {
              type: "text",
              text: "---\nname: cx\n---\n# cx",
            },
          ],
          isError: false,
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "call_a5a71ae7017c45b39e61ddad",
        toolName: "read",
        params: '{"path":"~/.openclaw/skills/cx/SKILL.md"}',
        result: "---\nname: cx\n---\n# cx",
        isError: false,
      });
    });
  });

  describe("multiple calls in single message", () => {
    it("extracts multiple tool calls from single message", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/file1.txt"}',
            },
            {
              type: "toolCall",
              id: "call-2",
              name: "write",
              arguments: '{"path": "/file2.txt", "content": "hello"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content1",
              isError: false,
            },
            {
              type: "toolResult",
              toolCallId: "call-2",
              result: "success",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "call-1",
        toolName: "read",
        params: '{"path": "/file1.txt"}',
        result: '"content1"',
        isError: false,
      });
      expect(result[1]).toEqual({
        id: "call-2",
        toolName: "write",
        params: '{"path": "/file2.txt", "content": "hello"}',
        result: '"success"',
        isError: false,
      });
    });
  });

  describe("multiple messages with calls", () => {
    it("extracts tool calls across multiple message pairs", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/file1.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content1",
              isError: false,
            },
          ],
        },
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-2",
              name: "write",
              arguments: '{"path": "/file2.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-2",
              result: "content2",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].toolName).toBe("read");
      expect(result[1].toolName).toBe("write");
    });
  });

  describe("partial call handling", () => {
    it("uses complete arguments when partialArgs is also present", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/test.txt"}',
            },
            {
              type: "toolCall",
              id: "call-2",
              name: "read",
              arguments: '{"path": "/test.txt"}',
              partialArgs: '{"path": "',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content1",
              isError: false,
            },
            {
              type: "toolResult",
              toolCallId: "call-2",
              result: "content2",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0].toolName).toBe("read");
      expect(result[0].result).toBe('"content1"');
      expect(result[1].toolName).toBe("read");
      expect(result[1].result).toBe('"content2"');
    });

    it("skips tool calls that only have partialArgs", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              partialArgs: '{"path": "',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toEqual([]);
    });
  });

  describe("empty messages array", () => {
    it("returns empty array for empty messages", () => {
      const result = extractToolCallsFromMessages([]);
      expect(result).toEqual([]);
    });

    it("returns empty array for non-array input", () => {
      const result = extractToolCallsFromMessages(null as unknown as unknown[]);
      expect(result).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      const result = extractToolCallsFromMessages(
        undefined as unknown as unknown[],
      );
      expect(result).toEqual([]);
    });
  });

  describe("orphaned calls", () => {
    it("skips tool calls without matching result", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/test.txt"}',
            },
            {
              type: "toolCall",
              id: "call-2",
              name: "write",
              arguments: '{"path": "/test.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].toolName).toBe("read");
    });

    it("skips tool results without matching call", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/test.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content",
              isError: false,
            },
            {
              type: "toolResult",
              toolCallId: "call-orphan",
              result: "orphan",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].toolName).toBe("read");
    });
  });

  describe("error detection", () => {
    it("detects isError: true", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/test.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "File not found",
              isError: true,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].isError).toBe(true);
    });

    it("defaults isError to false when not specified", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/test.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content",
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].isError).toBe(false);
    });
  });

  describe("complex arguments parsing", () => {
    it("handles nested JSON arguments", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "complex_tool",
              arguments: JSON.stringify({
                nested: { key: "value", array: [1, 2, 3] },
                boolean: true,
                number: 42,
                null: null,
              }),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: { nested: "result" },
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].toolName).toBe("complex_tool");
      expect(result[0].params).toBe(
        '{"nested":{"key":"value","array":[1,2,3]},"boolean":true,"number":42,"null":null}',
      );
      expect(result[0].result).toBe('{"nested":"result"}');
    });

    it("handles special characters in arguments", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "read",
              arguments: '{"path": "/path/with spaces/and-dashes_file.txt"}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "content",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].params).toBe(
        '{"path": "/path/with spaces/and-dashes_file.txt"}',
      );
    });

    it("handles empty string arguments", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "call-1",
              name: "echo",
              arguments: '{"message": ""}',
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "toolResult",
              toolCallId: "call-1",
              result: "",
              isError: false,
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0].params).toBe('{"message": ""}');
      expect(result[0].result).toBe('""');
    });
  });

  describe("edge cases", () => {
    it("handles messages without content", () => {
      const messages = [{ role: "assistant" }, { role: "user" }];

      const result = extractToolCallsFromMessages(messages);
      expect(result).toEqual([]);
    });

    it("handles messages with empty content array", () => {
      const messages = [
        { role: "assistant", content: [] },
        { role: "user", content: [] },
      ];

      const result = extractToolCallsFromMessages(messages);
      expect(result).toEqual([]);
    });

    it("handles non-message objects", () => {
      const messages = ["not an object", 123, null, { notAMessage: true }];

      const result = extractToolCallsFromMessages(messages);
      expect(result).toEqual([]);
    });

    it("handles content items without type", () => {
      const messages = [
        {
          role: "assistant",
          content: [{ id: "call-1", name: "read" }],
        },
      ];

      const result = extractToolCallsFromMessages(messages);
      expect(result).toEqual([]);
    });

    it("handles toolCall missing required fields", () => {
      const messages = [
        {
          role: "assistant",
          content: [
            {
              type: "toolCall",
            },
          ],
        },
      ];

      const result = extractToolCallsFromMessages(messages);
      expect(result).toEqual([]);
    });
  });
});
