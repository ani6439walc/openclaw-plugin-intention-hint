import {
  definePluginEntry,
  logger,
  type OpenClawConfig,
  type OpenClawPluginApi,
  type OpenClawPluginDefinition,
} from "../api.js";
import { resolveLivePluginConfigObject } from "openclaw/plugin-sdk/plugin-config-runtime";
import { resolveConfig } from "./config.js";
import { IntentCatalog } from "./intent-loader.js";
import { SessionTracker } from "./session-tracker.js";
import { StatsAggregator } from "./stats-aggregator.js";
import { BacklogWriter } from "./backlog-writer.js";
import { createHookHandlers, type HookDeps } from "./hooks.js";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  evolutionBacklogPath,
  intentsPath,
  packageRoot as defaultPackageRoot,
  resolvePluginDataRoot,
  sessionsDirPath,
  statsPath,
} from "./file-utils.js";

const PLUGIN_ID = "intention-hint";

function copyFileIfMissing(sourcePath: string, targetPath: string): void {
  if (fs.existsSync(targetPath)) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function seedBundledIntents(dataRoot: string, packageRoot: string): void {
  const sourceDir = path.join(packageRoot, "intents");
  const targetDir = intentsPath(dataRoot);
  if (!fs.existsSync(sourceDir)) return;
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) return;

  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    if (!entry.endsWith(".md")) continue;
    copyFileIfMissing(path.join(sourceDir, entry), path.join(targetDir, entry));
  }
}

function migrateLegacySessions(dataRoot: string, packageRoot: string): void {
  if (path.resolve(dataRoot) === path.resolve(packageRoot)) return;

  const legacySessionsDir = path.join(packageRoot, "sessions");
  if (!fs.existsSync(legacySessionsDir)) return;

  const targetSessionsDir = sessionsDirPath(dataRoot);
  fs.mkdirSync(targetSessionsDir, { recursive: true });

  for (const entry of fs.readdirSync(legacySessionsDir, {
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

    const sourcePath = path.join(legacySessionsDir, entry.name);
    if (entry.name === "stats.json") {
      copyFileIfMissing(sourcePath, statsPath(dataRoot));
      continue;
    }
    if (entry.name === "evolution.json") {
      copyFileIfMissing(sourcePath, evolutionBacklogPath(dataRoot));
      continue;
    }
    copyFileIfMissing(sourcePath, path.join(targetSessionsDir, entry.name));
  }
}

export function initializePluginDataRoot({
  dataRoot,
  packageRoot = defaultPackageRoot,
}: {
  dataRoot: string;
  packageRoot?: string;
}): void {
  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    fs.mkdirSync(sessionsDirPath(dataRoot), { recursive: true });
  } catch (err) {
    logger.warn("failed to create intention-hint data root", {
      error: err,
      path: dataRoot,
    });
    return;
  }

  try {
    seedBundledIntents(dataRoot, packageRoot);
  } catch (err) {
    logger.warn("failed to seed intention-hint intents", {
      error: err,
      path: intentsPath(dataRoot),
    });
  }

  try {
    migrateLegacySessions(dataRoot, packageRoot);
  } catch (err) {
    logger.warn("failed to migrate legacy intention-hint data", {
      error: err,
      path: path.join(packageRoot, "sessions"),
    });
  }
}

export function createPlugin(
  api: OpenClawPluginApi,
): OpenClawPluginDefinition & {
  register: NonNullable<OpenClawPluginDefinition["register"]>;
} {
  let config = resolveConfig(api.pluginConfig as Record<string, unknown>);

  const refreshLiveConfigFromRuntime = () => {
    const livePluginConfig = resolveLivePluginConfigObject(
      api.runtime.config?.current
        ? () => api.runtime.config.current() as OpenClawConfig
        : undefined,
      PLUGIN_ID,
      api.pluginConfig as Record<string, unknown>,
    );
    config = resolveConfig(livePluginConfig ?? {});
  };

  return definePluginEntry({
    id: PLUGIN_ID,
    name: "Intention Hint",
    description:
      "Pre-scans user intent before replies and injects routing hints via before_prompt_build hook.",
    register() {
      const stateDir = api.runtime.state.resolveStateDir(process.env);
      const dataRoot = resolvePluginDataRoot(stateDir, PLUGIN_ID);
      initializePluginDataRoot({ dataRoot });

      const catalog = IntentCatalog.create(dataRoot);
      const tracker = SessionTracker.create(dataRoot);
      const statsAggregator = StatsAggregator.create(dataRoot);
      const backlogWriter = BacklogWriter.create(dataRoot);

      const refreshRuntimeIntents = () => {
        catalog.load("intents");
      };

      const deps: HookDeps = {
        api,
        config: () => config,
        refreshLiveConfigFromRuntime,
        refreshIntents: refreshRuntimeIntents,
        catalog,
        tracker,
        statsAggregator,
        backlogWriter,
      };

      const handlers = createHookHandlers(deps);

      refreshLiveConfigFromRuntime();
      refreshRuntimeIntents();

      api.on("before_prompt_build", handlers.onBeforePromptBuild, {
        timeoutMs: config.timeoutMs * 1.1 + 500,
      });
      api.on("after_tool_call", handlers.onAfterToolCall);
      api.on("agent_end", handlers.onAgentEnd);
      api.on("session_end", handlers.onSessionEnd);
    },
  });
}
