import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { OpenClawPluginApi } from "../api.js";
import { createPlugin, initializePluginDataRoot } from "./plugin.js";
import { packageRoot } from "./file-utils.js";
import { IntentCatalog } from "./intent-loader.js";

describe("createPlugin", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-state-"));
  });

  afterEach(() => {
    fs.rmSync(stateDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createApi(overrides: Partial<OpenClawPluginApi> = {}) {
    const on = vi.fn();
    const api = {
      config: {},
      pluginConfig: {},
      runtime: {
        config: {
          current: () => ({}),
        },
        state: {
          resolveStateDir: () => stateDir,
        },
      },
      on,
      ...overrides,
    } as unknown as OpenClawPluginApi & { on: ReturnType<typeof vi.fn> };
    return api;
  }

  it("registers the session_end hook", () => {
    const api = createApi();

    createPlugin(api).register(api);

    expect(api.on).toHaveBeenCalledWith("session_end", expect.any(Function));
  });

  it("initializes the runtime data root under the OpenClaw state directory", () => {
    const api = createApi();

    createPlugin(api).register(api);

    const dataRoot = path.join(stateDir, "plugins", "intention-hint");
    expect(fs.existsSync(path.join(dataRoot, "sessions"))).toBe(true);
    expect(fs.existsSync(path.join(dataRoot, "intents"))).toBe(true);
  });

  it("loads runtime intents from the fixed data-root intents directory", () => {
    const api = createApi({ pluginConfig: { intentsDir: "./custom" } });
    const load = vi.spyOn(IntentCatalog.prototype, "load").mockReturnValue(0);

    createPlugin(api).register(api);

    expect(load).toHaveBeenCalledWith("intents");
  });

  it("copies bundled intents only when the runtime intents directory is missing", () => {
    const dataRoot = path.join(stateDir, "plugins", "intention-hint");
    initializePluginDataRoot({ dataRoot, packageRoot });

    const intentFiles = fs
      .readdirSync(path.join(dataRoot, "intents"))
      .filter((entry) => entry.endsWith(".md"));

    expect(intentFiles.length).toBeGreaterThan(0);
  });

  it("does not overwrite existing runtime intent files", () => {
    const dataRoot = path.join(stateDir, "plugins", "intention-hint");
    const intentsDir = path.join(dataRoot, "intents");
    fs.mkdirSync(intentsDir, { recursive: true });
    fs.writeFileSync(path.join(intentsDir, "custom.md"), "custom");

    initializePluginDataRoot({ dataRoot, packageRoot });

    expect(fs.readdirSync(intentsDir)).toEqual(["custom.md"]);
    expect(fs.readFileSync(path.join(intentsDir, "custom.md"), "utf-8")).toBe(
      "custom",
    );
  });

  it("migrates old package sessions and root files without overwriting new data", () => {
    const oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-old-root-"));
    try {
      const oldSessions = path.join(oldRoot, "sessions");
      fs.mkdirSync(oldSessions, { recursive: true });
      fs.writeFileSync(
        path.join(oldSessions, "old-session.json"),
        '{"sessionId":"old-session"}',
      );
      fs.writeFileSync(path.join(oldSessions, "stats.json"), '{"old":true}');
      fs.writeFileSync(
        path.join(oldSessions, "evolution.json"),
        '{"old":true}',
      );

      const dataRoot = path.join(stateDir, "plugins", "intention-hint");
      fs.mkdirSync(path.join(dataRoot, "sessions"), { recursive: true });
      fs.writeFileSync(path.join(dataRoot, "stats.json"), '{"new":true}');

      initializePluginDataRoot({ dataRoot, packageRoot: oldRoot });

      expect(
        fs.readFileSync(
          path.join(dataRoot, "sessions", "old-session.json"),
          "utf-8",
        ),
      ).toBe('{"sessionId":"old-session"}');
      expect(fs.readFileSync(path.join(dataRoot, "stats.json"), "utf-8")).toBe(
        '{"new":true}',
      );
      expect(
        fs.readFileSync(path.join(dataRoot, "evolution.json"), "utf-8"),
      ).toBe('{"old":true}');
    } finally {
      fs.rmSync(oldRoot, { recursive: true, force: true });
    }
  });
});
