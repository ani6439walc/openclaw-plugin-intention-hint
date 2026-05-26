import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionTracker } from "./session-tracker.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("SessionTracker", () => {
  let tempDir: string;
  let tracker: SessionTracker;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-tracker-test-"));
    tracker = SessionTracker.create(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("create", () => {
    it("should return a new instance each time (not singleton)", () => {
      const tracker1 = SessionTracker.create(tempDir);
      const tracker2 = SessionTracker.create(tempDir);

      expect(tracker1).toBeInstanceOf(SessionTracker);
      expect(tracker2).toBeInstanceOf(SessionTracker);
      expect(tracker1).not.toBe(tracker2);
    });

    it("should create tracker with correct plugin root", () => {
      const customDir = path.join(tempDir, "custom");
      fs.mkdirSync(customDir, { recursive: true });

      const customTracker = SessionTracker.create(customDir);
      expect(customTracker).toBeInstanceOf(SessionTracker);
    });
  });

  describe("record", () => {
    it("should update session data with record()", () => {
      expect(() =>
        tracker.record({
          sessionId: "test-session-123",
          agentId: "test-agent",
          current: { input: "test prompt", intent: {} },
        }),
      ).not.toThrow();
    });

    it("should skip recording when sessionId is empty", () => {
      expect(() =>
        tracker.record({
          sessionId: "",
          current: { input: "test prompt", intent: {} },
        }),
      ).not.toThrow();
    });

    it("should skip recording when sessionId is undefined", () => {
      expect(() =>
        tracker.record({
          current: { input: "test prompt", intent: {} },
        } as any),
      ).not.toThrow();
    });

    it("should append toolCalls to array (not overwrite)", () => {
      tracker.record({
        sessionId: "test-session-123",
        current: {
          intent: {},
          toolCalls: [
            { name: "tool1", params: { key: "value1" }, durationMs: 100 },
          ],
        },
      });
      tracker.record({
        sessionId: "test-session-123",
        current: {
          intent: {},
          toolCalls: [
            { name: "tool2", params: { key: "value2" }, durationMs: 200 },
          ],
        },
      });
      expect(() => tracker.write()).not.toThrow();
    });

    it("should handle multiple record calls", () => {
      tracker.record({ sessionId: "test-session-123", agentId: "agent1" });
      tracker.record({ sessionId: "test-session-123", agentId: "agent2" });

      expect(() => tracker.write()).not.toThrow();
    });
  });

  describe("write", () => {
    it("should create JSON file with correct structure", () => {
      tracker.record({
        sessionId: "test-session-123",
        agentId: "test-agent",
        current: { input: "test prompt", intent: {} },
      });
      tracker.write();

      const sessionsDir = path.join(tempDir, "sessions");
      expect(fs.existsSync(sessionsDir)).toBe(true);

      const files = fs.readdirSync(sessionsDir);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toBe("test-session-123.json");

      const filePath = path.join(sessionsDir, files[0]);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.sessionId).toBe("test-session-123");
      expect(parsed.agentId).toBe("test-agent");
      expect(parsed.current.input).toBe("test prompt");
    });

    it("should persist data to JSON file", () => {
      const startDate = new Date().toISOString();
      tracker.record({
        sessionId: "persist-test-456",
        sessionKey: "test-key",
        agentId: "persist-agent",
        current: {
          input: "persist prompt",
          intent: {
            input: [{ role: "user", text: "hello" }],
            result: {
              reason: "test reasoning",
              intent: "test-intent",
              goal: "test goal",
              confidence: 0.9,
              complexity: "low",
            },
          },
          toolCalls: [
            {
              name: "testTool",
              params: { arg: "value" },
              result: "success",
              durationMs: 150,
            },
          ],
          result: "test response",
          timestamps: {
            start: startDate,
            end: new Date().toISOString(),
          },
        },
      });
      tracker.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const filePath = path.join(sessionsDir, files[0]);
      const content = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.sessionId).toBe("persist-test-456");
      expect(parsed.sessionKey).toBe("test-key");
      expect(parsed.agentId).toBe("persist-agent");
      expect(parsed.current.input).toBe("persist prompt");
      expect(parsed.current.intent.input).toEqual([
        { role: "user", text: "hello" },
      ]);
      expect(parsed.current.intent.result).toEqual({
        reason: "test reasoning",
        intent: "test-intent",
        goal: "test goal",
        confidence: 0.9,
        complexity: "low",
      });
      expect(parsed.current.toolCalls).toHaveLength(1);
      expect(parsed.current.toolCalls[0].name).toBe("testTool");
      expect(parsed.current.result).toBe("test response");
      expect(parsed.current.timestamps.start).toBe(startDate);
    });

    it("should handle write without prior record calls", () => {
      tracker.record({ sessionId: "no-record" });
      expect(() => tracker.write()).not.toThrow();
    });

    it("should overwrite file for same sessionId (not create new files)", () => {
      tracker.record({
        sessionId: "overwrite-test",
        current: { input: "first prompt", intent: {} },
      });
      tracker.write();

      tracker.record({
        sessionId: "overwrite-test",
        current: { input: "second prompt", intent: {} },
      });
      tracker.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      expect(files.length).toBe(1);
      expect(files[0]).toBe("overwrite-test.json");

      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);
      expect(parsed.current.input).toBe("second prompt");
    });

    it("should create sessions directory if it does not exist", () => {
      tracker.record({ sessionId: "test-789" });

      const sessionsDir = path.join(tempDir, "sessions");
      expect(fs.existsSync(sessionsDir)).toBe(false);

      tracker.write();

      expect(fs.existsSync(sessionsDir)).toBe(true);
    });

    it("should handle toolCalls array persistence", () => {
      tracker.record({
        sessionId: "tool-persist-test",
        current: {
          intent: {},
          toolCalls: [
            {
              name: "tool1",
              params: { key: "value1" },
              durationMs: 100,
            },
          ],
        },
      });
      tracker.write();

      let content = fs.readFileSync(
        path.join(tempDir, "sessions", "tool-persist-test.json"),
        "utf-8",
      );
      let parsed = JSON.parse(content);
      expect(parsed.current.toolCalls).toEqual([
        { name: "tool1", params: { key: "value1" }, durationMs: 100 },
      ]);

      tracker.record({
        sessionId: "tool-persist-test",
        current: {
          intent: {},
          toolCalls: [
            {
              name: "tool2",
              params: { key: "value2" },
              durationMs: 200,
            },
          ],
        },
      });
      tracker.write();

      content = fs.readFileSync(
        path.join(tempDir, "sessions", "tool-persist-test.json"),
        "utf-8",
      );
      parsed = JSON.parse(content);
      expect(parsed.current.toolCalls).toEqual([
        { name: "tool1", params: { key: "value1" }, durationMs: 100 },
        { name: "tool2", params: { key: "value2" }, durationMs: 200 },
      ]);
    });

    it("should merge timestamps across multiple record calls", () => {
      const start = new Date().toISOString();
      tracker.record({
        sessionId: "timestamp-test",
        current: {
          intent: {},
          timestamps: { start },
        },
      });

      const end = new Date().toISOString();
      tracker.record({
        sessionId: "timestamp-test",
        current: {
          intent: {},
          timestamps: { end },
        },
      });
      tracker.write();

      const content = fs.readFileSync(
        path.join(tempDir, "sessions", "timestamp-test.json"),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.current.timestamps.start).toBe(start);
      expect(parsed.current.timestamps.end).toBe(end);
    });
  });

  describe("edge cases", () => {
    it("should deduplicate skillsUsed across multiple toolCalls", () => {
      const tracker2 = SessionTracker.create(tempDir);
      tracker2.record({
        sessionId: "skill-dedup",
        current: {
          intent: {},
          toolCalls: [
            {
              name: "read",
              params: { path: "/path/to/gemini/SKILL.md" },
              result: "---\nname: gemini\n---\ncontent",
              durationMs: 100,
            },
            {
              name: "read",
              params: { path: "/path/to/gemini/SKILL.md" },
              result: "---\nname: gemini\n---\ncontent",
              durationMs: 100,
            },
          ],
        },
      });
      tracker2.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.current.skillsUsed).toEqual([
        { name: "gemini", path: "/path/to/gemini/SKILL.md" },
      ]);
      expect(parsed.current.skillsUsed.length).toBe(1);
    });

    it("should track multiple unique skills", () => {
      const tracker3 = SessionTracker.create(tempDir);
      tracker3.record({
        sessionId: "multi-skills",
        current: {
          intent: {},
          toolCalls: [
            {
              name: "read",
              params: { path: "/path/to/gemini/SKILL.md" },
              result: "---\nname: gemini\n---\nc",
              durationMs: 100,
            },
            {
              name: "read",
              params: { path: "/path/to/frontend-ui-engineering/SKILL.md" },
              result: "---\nname: frontend-ui-engineering\n---\nc",
              durationMs: 200,
            },
          ],
        },
      });
      tracker3.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.current.skillsUsed).toEqual([
        { name: "gemini", path: "/path/to/gemini/SKILL.md" },
        {
          name: "frontend-ui-engineering",
          path: "/path/to/frontend-ui-engineering/SKILL.md",
        },
      ]);
    });

    it("should ignore non-SKILL.md read calls", () => {
      const tracker4 = SessionTracker.create(tempDir);
      tracker4.record({
        sessionId: "no-skill-read",
        current: {
          intent: {},
          toolCalls: [
            {
              name: "read",
              params: { path: "/path/to/README.md" },
              result: "---\nname: test\n---\nc",
              durationMs: 100,
            },
          ],
        },
      });
      tracker4.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.current.skillsUsed).toBeUndefined();
    });

    it("should handle session data with special characters", () => {
      tracker.record({
        sessionId: "special-chars-test",
        current: {
          input: 'Hello "world" with \n newlines and \t tabs',
          intent: {},
          result: "Response with unicode: 你好世界 🌍",
        },
      });
      tracker.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.current.input).toBe(
        'Hello "world" with \n newlines and \t tabs',
      );
      expect(parsed.current.result).toBe("Response with unicode: 你好世界 🌍");
    });

    it("should handle empty toolCalls array", () => {
      tracker.record({
        sessionId: "empty-tools-test",
        current: { intent: {}, toolCalls: [] },
      });
      tracker.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.current.toolCalls).toEqual([]);
    });

    it("should handle undefined optional fields", () => {
      tracker.record({
        sessionId: "undefined-test",
      });
      tracker.write();

      const sessionsDir = path.join(tempDir, "sessions");
      const files = fs.readdirSync(sessionsDir);
      const content = fs.readFileSync(
        path.join(sessionsDir, files[0]),
        "utf-8",
      );
      const parsed = JSON.parse(content);

      expect(parsed.sessionId).toBe("undefined-test");
    });
  });

  describe("hasIntentData guard", () => {
    it("should return false before any intentResult is recorded", () => {
      expect(tracker.hasIntentData("new-session")).toBe(false);
    });

    it("should return true after record with intentResult", () => {
      const tracker2 = SessionTracker.create(tempDir);
      tracker2.record({
        sessionId: "intent-session",
        current: {
          intent: {
            result: {
              intent: "test",
              reason: "test reason",
              goal: "test goal",
              confidence: 0.9,
              complexity: "low",
            },
          },
        },
      });
      expect(tracker2.hasIntentData("intent-session")).toBe(true);
    });

    it("should return false after record without intentResult", () => {
      const tracker3 = SessionTracker.create(tempDir);
      tracker3.record({
        sessionId: "no-intent-session",
        current: { input: "hello", intent: {} },
      });
      expect(tracker3.hasIntentData("no-intent-session")).toBe(false);
    });

    it("should return false for different sessionId", () => {
      const tracker4 = SessionTracker.create(tempDir);
      tracker4.record({
        sessionId: "session-a",
        current: {
          intent: {
            result: {
              intent: "test",
              reason: "test reason",
              goal: "test goal",
              confidence: 0.9,
              complexity: "low",
            },
          },
        },
      });
      expect(tracker4.hasIntentData("session-a")).toBe(true);
      expect(tracker4.hasIntentData("session-b")).toBe(false);
    });
  });
});
