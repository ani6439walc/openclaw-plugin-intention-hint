import { describe, expect, it, vi } from "vitest";
import type { OpenClawPluginApi } from "../api.js";
import { createPlugin } from "./plugin.js";

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: () => true,
    mkdirSync: vi.fn(),
    readdirSync: (path: import("fs").PathLike, options?: unknown) => {
      try {
        return actual.readdirSync(path, options as never);
      } catch {
        return [];
      }
    },
  };
});

describe("createPlugin", () => {
  it("registers the session_end hook", () => {
    const on = vi.fn();
    const api = {
      config: {},
      pluginConfig: {},
      runtime: {
        config: {
          current: () => ({}),
        },
      },
      on,
    } as unknown as OpenClawPluginApi;

    createPlugin(api).register(api);

    expect(on).toHaveBeenCalledWith("session_end", expect.any(Function));
  });
});
