import {
  DEFAULT_LOW_COMPLEXITY_PROMPT,
  DEFAULT_MEDIUM_COMPLEXITY_PROMPT,
  DEFAULT_HIGH_COMPLEXITY_PROMPT,
  FALLBACK_INTENT,
  INTENTION_HINT_PLUGIN_TAG,
  UNTRUSTED_CONTEXT_HEADER,
} from "./constants.js";
import type {
  IntentDefinition,
  IntentionResult,
  RecentTurn,
  ResolvedIntentionHintPluginConfig,
} from "./types.js";

export function buildIntentionPrompt(params: {
  conversation?: RecentTurn[];
  latest: string;
  intents: readonly IntentDefinition[];
}): string {
  const enabledIntents = params.intents.filter((i) => i.enabled);
  const allIntents = [...enabledIntents, FALLBACK_INTENT];

  const intentCatalog = allIntents
    .map((intent) => {
      const lines = [`<intent id="${intent.id}" name="${intent.name}">`];
      if (intent.triggers.length > 0) {
        lines.push(`triggers:`);
        lines.push(...intent.triggers.map((t) => `- ${t}`));
      }
      if (intent.examples.length > 0) {
        lines.push(`examples:`);
        lines.push(...intent.examples.map((ex) => `- ${ex}`));
      }
      lines.push(`</intent>`);
      return lines.join("\n");
    })
    .join("\n");

  const conversationXml =
    params.conversation && params.conversation.length > 0
      ? params.conversation
          .map((turn) => `<turn role="${turn.role}">${turn.text}</turn>`)
          .join("\n")
      : "";

  return `<input_context>
Three input types are provided:
1. conversation: Recent conversation turns between user and assistant
2. latest: The latest user message to classify
3. intents: Available intent definitions with triggers and examples
</input_context>

<classification_rules>
1. Use conversation history to understand context
2. Classify based on overall conversational goal
3. Prefer intent that explains WHY user said this
4. DO NOT FORCE classification - default to OTHER (Fallback) if uncertain
5. Memory intents: classify first if triggers match
</classification_rules>

<output_format>
Return only defined fields, one per line:

<field_schema>
intent: <id> (<name>)
reason: <brief reason>
goal: <what user wants>
confidence: <0.0 to 1.0>
complexity: <low|medium|high>
suggestion: <optional — only when confidence < 0.8>
</field_schema>

Field definitions:
- confidence: 0.0 (guessing) to 1.0 (certain), numerical float
- complexity: low (simple greeting), medium (normal task), high (multi-step)
- suggestion: only provide when confidence < 0.65; give general guidance such as clarifying scope, recommending narrower focus, or noting missing context — do NOT mention specific tools or skills

Fallback:
If none of the provided intents confidently fit, return:
intent: ${FALLBACK_INTENT.id} (${FALLBACK_INTENT.name})
reason: Unable to confidently classify
goal: <what the user likely wants to achieve>
</output_format>

<intent_catalog>
${intentCatalog}
</intent_catalog>

<input>
<conversation>
${conversationXml}
</conversation>
<latest>
${params.latest}
</latest>
</input>`;
}

export function parseIntentionResult(
  raw: string,
  validIntentIds: string[],
): IntentionResult | undefined {
  const cleaned = raw.replace(/<\/?output_format>/gi, "").trim();
  const lines = cleaned.split(/\r?\n/);
  const result: Partial<IntentionResult> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (key === "intent") {
      const match = value.match(/^([a-z0-9_-]+)/i);
      result.intent = match ? match[1] : value;
    } else if (key === "reason") {
      result.reason = value || undefined;
    } else if (key === "goal") {
      result.goal = value || undefined;
    } else if (key === "suggestion" && value) {
      result.suggestion = value;
    } else if (key === "confidence") {
      // Expecting 0.0-1.0 numerical scale per prompt definition
      const num = parseFloat(value);
      if (!isNaN(num) && num >= 0 && num <= 1) {
        result.confidence = num;
      }
    } else if (key === "complexity") {
      // Expecting low|medium|high per prompt definition
      const normalized = value.trim().toLowerCase();
      if (
        ["low", "medium", "high"].includes(
          normalized as "low" | "medium" | "high",
        )
      ) {
        result.complexity = normalized as "low" | "medium" | "high";
      }
    }
  }

  let intent = result.intent ?? FALLBACK_INTENT.id;

  // Find case-insensitive match in validIntentIds
  const caseInsensitiveMatch = validIntentIds.find(
    (id) => id.toLowerCase() === intent.toLowerCase(),
  );
  if (caseInsensitiveMatch) {
    intent = caseInsensitiveMatch;
  } else if (!validIntentIds.includes(intent)) {
    // Fallback: look for "other" case-insensitively, otherwise use first valid intent
    const otherMatch = validIntentIds.find(
      (id) => id.toLowerCase() === FALLBACK_INTENT.id.toLowerCase(),
    );
    intent = otherMatch ?? validIntentIds[0] ?? FALLBACK_INTENT.id;
  }

  if (
    !result.reason ||
    !result.goal ||
    result.confidence === undefined ||
    !result.complexity
  ) {
    return undefined;
  }

  return {
    intent,
    reason: result.reason,
    goal: result.goal,
    ...(result.suggestion ? { suggestion: result.suggestion } : {}),
    confidence: result.confidence,
    complexity: result.complexity,
  };
}

export function buildPromptPrefix(
  result: IntentionResult,
  intents: readonly IntentDefinition[],
  config: ResolvedIntentionHintPluginConfig,
): string | undefined {
  const intentDef = intents.find((i) => i.id === result.intent && i.enabled);
  const effectiveDef = intentDef ?? FALLBACK_INTENT;

  const lines: string[] = [];
  lines.push(`reason: ${result.reason}`);
  lines.push(`goal: ${result.goal}`);
  if (result.suggestion) lines.push(`suggestion: ${result.suggestion}`);
  lines.push(`confidence: ${result.confidence}`);
  lines.push(`complexity: ${result.complexity}`);
  lines.push("");
  lines.push(effectiveDef.prompt);

  const complexityPrompt =
    config.complexityPrompts[result.complexity] ??
    (result.complexity === "low"
      ? DEFAULT_LOW_COMPLEXITY_PROMPT
      : result.complexity === "medium"
        ? DEFAULT_MEDIUM_COMPLEXITY_PROMPT
        : DEFAULT_HIGH_COMPLEXITY_PROMPT);
  lines.push("");
  lines.push(complexityPrompt);

  return `${UNTRUSTED_CONTEXT_HEADER}
<${INTENTION_HINT_PLUGIN_TAG}>
${lines.join("\n")}
</${INTENTION_HINT_PLUGIN_TAG}>`;
}
