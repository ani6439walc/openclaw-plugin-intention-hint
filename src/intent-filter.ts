import type {
  IntentDefinition,
  ResolvedIntentionHintPluginConfig,
} from "./types.js";

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\\\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesWildcard(pattern: string, value: string): boolean {
  const normalizedPattern = pattern.trim();
  if (!normalizedPattern) return false;
  return wildcardToRegExp(normalizedPattern).test(value);
}

export function resolveIntentDenyPatterns(
  config: ResolvedIntentionHintPluginConfig,
  agentId: string | undefined,
): string[] {
  const normalizedAgentId = agentId?.trim();
  if (!normalizedAgentId) return [];

  const patterns: string[] = [];
  for (const [agentPattern, intentPatterns] of Object.entries(
    config.intentDeny,
  )) {
    if (matchesWildcard(agentPattern, normalizedAgentId)) {
      patterns.push(...intentPatterns);
    }
  }
  return [...new Set(patterns)];
}

export function filterIntentsForAgent(
  intents: readonly IntentDefinition[],
  config: ResolvedIntentionHintPluginConfig,
  agentId: string | undefined,
): IntentDefinition[] {
  const denyPatterns = resolveIntentDenyPatterns(config, agentId);
  if (denyPatterns.length === 0) return [...intents];

  return intents.filter(
    (intent) =>
      !denyPatterns.some((pattern) => matchesWildcard(pattern, intent.id)),
  );
}
