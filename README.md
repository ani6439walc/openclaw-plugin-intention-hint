# Intention Hint Plugin

[![OpenClaw](https://img.shields.io/badge/Platform-OpenClaw-blue.svg)](https://github.com/openclaw/openclaw)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An OpenClaw plugin that pre-scans user intent before main-agent replies and injects routing hints via the `before_prompt_build` hook.

## How it works

1. **Before Prompt Build** — When the user sends a message, the plugin intercepts the prompt construction.
2. **Fast Sub-agent** — A lightweight sub-agent classifies the intent by matching against dynamically loaded intent definitions.
3. **Dynamic Intents** — Intent definitions live in YAML-frontmatter Markdown files under `intents/`. Add, remove, or edit intents without rebuilding the plugin. Each intent file specifies:
   - `id` — unique identifier (e.g. `chat`, `memory-recent`)
   - `name` — human-readable label
   - `enabled` — whether the intent is active
   - `triggers` — natural-language descriptions that guide the classifier
   - `examples` — few-shot examples for the classifier
   - Markdown body — the injection prompt body shown to the main agent after classification
4. **Structured Output** — The classifier returns a key-value format:
   ```
   intent: <id> (<name>)
   reason: <brief reason for classification>
   goal: <what the user likely wants to achieve>
   confidence: <0.0 to 1.0>
   complexity: <low | medium | high>
   suggestion: <optional correction or recommendation>
   ```
   The plugin parses this into an `IntentionResult` and injects the matching intent's body as untrusted context.
5. **Recent Context Support** — In `queryMode: "recent"`, the plugin extracts recent `user` / `assistant` turns from `event.messages`, strips previously injected plugin metadata blocks, and builds a recent conversation tail for the classifier.
6. **Internal Run Guard** — The classifier skips internal runs for `active-memory`, `intention-hint`, and generic `:subagent:` session keys.
7. **Zero File Write** — The plugin does not write any files to disk. All session metadata stays in memory; the embedded subagent runs with `modelRun: true` and no session file persistence.

## Installation

This plugin is a workspace package inside `/home/wei/Projects/openclaw/extensions/`.  
Build it with:

```bash
cd extensions/intention-hint
pnpm install
pnpm run build
```

## Configuration (`openclaw.json`)

```json5
{
  plugins: {
    entries: {
      "intention-hint": {
        enabled: true,
        config: {
          agents: ["main"],
          intentDeny: {
            main: ["MEMORY_*"], // deny matching intent IDs for main
            "research-*": ["CHAT", "TYPO"],
            "*": ["AGENT_ADMIN"], // global deny for every agent
          },
          model: "google/gemini-3-flash", // lightweight scanner model
          modelFallback: "openai/gpt-5-mini",
          allowedChatTypes: ["direct"],
          allowedChatIds: [],
          deniedChatIds: [],
          queryMode: "recent",
          timeoutMs: 3000,
          intentsDir: "./intents", // relative to plugin root
          intentsHotReload: true, // auto-reload on change
          intentsHotReloadIntervalMs: 5000, // poll interval
        },
      },
    },
  },
}
```

### Config Options

| Option                       | Type       | Default             | Description                                                                                                               |
| ---------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `agents`                     | `string[]` | `["main"]`          | Agent IDs eligible for intention scanning.                                                                                |
| `intentDeny`                 | `object`   | `{}`                | Per-agent intent deny-list. Keys are agent IDs or wildcard patterns; values are arrays of intent ID or wildcard patterns. |
| `model`                      | `string`   | —                   | Lightweight model for the intention scanner. Falls back to the agent's default if empty.                                  |
| `modelFallback`              | `string`   | —                   | Fallback model when `config.model` cannot be resolved.                                                                    |
| `allowedChatTypes`           | `string[]` | `["direct"]`        | Which chat types are eligible (`direct`, `group`, `channel`, `explicit`).                                                 |
| `allowedChatIds`             | `string[]` | `[]`                | Allow-list of chat IDs.                                                                                                   |
| `deniedChatIds`              | `string[]` | `[]`                | Deny-list of chat IDs.                                                                                                    |
| `queryMode`                  | `string`   | `"recent"`          | Context sent to scanner: `message` (latest only), `recent` (recent turns), or `full` (full history).                      |
| `timeoutMs`                  | `number`   | `3000`              | Budget in milliseconds for the intention scanner sub-agent.                                                               |
| `intentsDir`                 | `string`   | `"./intents"`       | Directory containing dynamic intent `.md` files. Resolved relative to the plugin installation directory.                  |
| `intentsHotReload`           | `boolean`  | `true`              | Automatically reload intent definitions when files change.                                                                |
| `intentsHotReloadIntervalMs` | `number`   | `5000`              | How often to check for intent file changes (clamped to 1000–300000 ms).                                                   |
| `complexityPrompts`          | `object`   | `{}`                | Custom prompts per complexity level. Overrides built-in defaults for `low`, `medium`, or `high`.                          |
| `selfEvolution`              | `object`   | `{ enabled: true }` | Self-evolution config for automatic skill/review suggestions. Set `enabled: false` to disable.                            |

#### `complexityPrompts` Object

The plugin injects a complexity-specific guidance prompt **after** the intent definition prompt. Each key is optional; unset keys use the built-in default.

```json
{
  "complexityPrompts": {
    "low": "Custom low-complexity prompt...",
    "medium": "Custom medium-complexity prompt...",
    "high": "Custom high-complexity prompt..."
  }
}
```

Built-in behavior (configurable via `complexityPrompts`):

- **`low`** — Fast, concise, minimal overhead. For quick tasks and simple questions.
- **`medium`** — Balanced execution with step-by-step planning and clarification. Pauses to ask when details are ambiguous.
- **`high`** — Deep investigation using sub-agents for large codebases, structured multi-step planning with user review before execution.

## Self-Evolution

The plugin can automatically review session behavior and generate improvement suggestions without requiring manual configuration. When enabled, it monitors session activity and spawns background review sub-agents to analyze patterns and write backlog entries for the user to review.

### How it Works

1. **Session Tracking** — A `SessionTracker` keeps in-memory state for each session: turn count, tool call count, failure count, skills used, and turn history. Keyword triggers use the clean latest user message, while full conversation records remain available for review context.
2. **Skill Detection** — Automatically detects skill usage only when a successful read-style tool call reads a `SKILL.md` file path; the skill name comes from the file's YAML frontmatter `name` field parsed by `gray-matter`. Malformed frontmatter fails open and simply records no skill.
3. **Non-LLM Triggers** (checked every agent end):
   - `skill_candidate` — tool calls exceed threshold OR skills were used
   - `process_gap` — tool failures exceed threshold
   - `missing_intent` — intent classified as `OTHER`
   - `weak_intent` — confidence below threshold
   - `behavior_fix` — explicit correction phrases detected (e.g., "don't do that", "你誤會了，以後不要這樣")
4. **LLM Trigger** — every N turns (default 5), a satisfaction check spawns a review sub-agent that analyzes the included turns' full conversation records and intent results. Also triggers on satisfaction keywords (e.g., "完美", "looks good", "很好").
5. **Review Sub-agent** — runs in background with a dedicated `:evolution-review:` session key (anti-recursion guard), analyzes only the structured metrics/conversation context provided in its prompt, and does not fetch extra history.
6. **Backlog Entry** — written to `evolution/backlog/` as a Markdown file with standard YAML frontmatter containing trigger metadata and a Markdown body containing the full trigger data for analysis.

### Tool History

Tool calls are recorded with secrets redacted (API keys, tokens, passwords replaced with `[REDACTED]`). History scope varies by trigger:

- **Non-LLM triggers**: Current turn only
- **LLM satisfaction check**: Multi-turn history (all previous turns)

### Configuration

`selfEvolution.enabled` defaults to `true` in both the OpenClaw schema and runtime normalization. Set it to `false` explicitly to disable self-evolution.

```json
{
  "selfEvolution": {
    "enabled": true,
    "reviewModel": "claude/claude-sonnet-4-20250514",
    "reviewThinkingLevel": "low",
    "triggers": {
      "satisfactionCheckInterval": 5,
      "toolCallCountThreshold": 5,
      "skillsUsedThreshold": 0,
      "failureCountThreshold": 2,
      "weakIntentConfidenceThreshold": 0.8
    }
  }
}
```

### Trigger Options

| Option                          | Type     | Default | Description                                                                                        |
| ------------------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------- |
| `satisfactionCheckInterval`     | `number` | `5`     | LLM review triggers every N turns (1–100).                                                         |
| `toolCallCountThreshold`        | `number` | `5`     | Triggers `skill_candidate` when `toolCallCount > N` (1–1000).                                      |
| `skillsUsedThreshold`           | `number` | `0`     | Triggers `skill_candidate` when `skillsUsed.size > N`. `0` means any skill usage triggers. (0–100) |
| `failureCountThreshold`         | `number` | `2`     | Triggers `process_gap` when `toolFailCount >= N` (1–100).                                          |
| `weakIntentConfidenceThreshold` | `number` | `0.8`   | Triggers `weak_intent` when `confidence < N` (0.0–1.0).                                            |

### Review Options

| Option                | Type                                                                                  | Default | Description                                                                 |
| --------------------- | ------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| `reviewModel`         | `string`                                                                              | —       | Model for the review sub-agent. Falls back to the agent's default if unset. |
| `reviewThinkingLevel` | `"off" \| "minimal" \| "low" \| "medium" \| "high" \| "xhigh" \| "adaptive" \| "max"` | `"low"` | OpenClaw thinking level for the review sub-agent.                           |

### Safety Features

- **Fail-open** — All evolution hooks are wrapped in try-catch; errors are logged but never break the main plugin.
- **Anti-recursion** — Review sub-agents have `:evolution-review:` in their session key; the `agent_end` hook skips these to prevent infinite review loops.
- **Deduplication** — Each trigger type fires only once per session.
- **Sub-agent exclusion** — Sessions with `:subagent:` in their key are skipped.
- **Zero persistence** — All tracking state is in-memory and cleaned up on session end.

## Intent Definition Format

Create a `.md` file in the `intents/` directory:

```markdown
---
id: RESEARCH_GENERAL
name: General Research Query
enabled: true
triggers:
  - "User is asking for factual or explanatory information that should be researched from external sources"
examples:
  - "Tell me about quantum computing"
  - "Explain blockchain consensus mechanisms"
---

Detected "general research" intent. The user wants factual or explanatory information supported by external sources.

## Guidelines

- Do not answer factual questions from memory alone.
- Prefer authoritative and directly relevant sources.
- Keep the answer accurate, concise, and source-backed.

## Response Strategy

- Search for reliable external sources before answering.
- Summarize the key findings instead of dumping raw search results.
- Include source links when making factual claims.

- Read a long web page with less clutter:
  skill: defuddle

- Search for current external information:
  web_search({ query: "<topic keywords>" })
```

### Frontmatter Fields

| Field      | Required | Type       | Description                                                 |
| ---------- | -------- | ---------- | ----------------------------------------------------------- |
| `id`       | **yes**  | `string`   | Unique identifier (letters, numbers, hyphens, underscores). |
| `name`     | no       | `string`   | Human-readable label (defaults to `id`).                    |
| `enabled`  | no       | `boolean`  | Whether this intent is active (defaults to `true`).         |
| `triggers` | **yes**  | `string[]` | Natural-language descriptions that guide the classifier.    |
| `examples` | no       | `string[]` | Few-shot examples for the classifier.                       |

### Intent Writing Rules

#### 1. Split responsibilities clearly

- **Frontmatter** is for **classification**.
- **Markdown body** is for the **main agent hint** injected after classification.

#### 2. Keep frontmatter narrow and classifier-friendly

- Use `triggers` to describe the **boundary** of the intent.
- Merge similar trigger descriptions instead of listing many near-duplicates.
- Use `examples` to preserve diversity without expanding the scope.
- Do not put tool instructions, workflows, or long reasoning guides in frontmatter.

#### 3. Keep the body short and single-intent

- Only describe behavior that belongs to that intent.
- Do not restate broad system rules that already exist elsewhere.
- Do not mix multiple intent families into one file.
- Prefer a small, direct prompt over a long SOP-style document.

#### 4. Use a consistent body structure

Recommended shape:

```markdown
Detected "<intent>" intent. <One-sentence explanation.>

## Guidelines

- ...
- ...

## Response Strategy

- ...
- ...
```

#### 5. Describe skill usage with timing or purpose

When a skill is relevant, prefer this format:

```markdown
- Read a large Markdown document by section:
  skill: treemd
- Read a code file by symbols before summarizing implementation details:
  skill: cx
```

Use short, intent-specific purpose lines. Avoid long skill descriptions.

#### 6. Describe tool usage with exact formats

For direct tool hints, use the explicit call shape:

```markdown
memory_search({ query: "<subject_A_keywords>", corpus: "memory", maxResults: 5, minScore: 0.1 })
read({ path: "<file>" })
web_search({ query: "<topic keywords>" })
web_fetch({ url: "<authoritative_url>" })
```

If the intent needs CLI usage through `exec`, show it as a shell block:

```bash
<command>
```

#### 7. Prefer clean boundaries over convenience

Examples:

- `RESEARCH_GENERAL` should cover broad factual or explanatory research.
- `SUMMARIZATION` should cover source-driven summary or transcription.
- `PROMPT_DESIGN` should cover prompt, intent, skill, or routing design discussion.
- `SYSTEM_DOCS` should focus on locating recorded system-side notes, SOPs, or configs.

When an intent starts absorbing neighboring use cases, split it instead of making it broader.

### Memory Retrieval Principles

The memory family is slightly different from simple routing intents because it is designed to replace heavier pre-answer memory subagent work with a lighter intent-guided retrieval handoff.

#### 1. Treat the latest user message as primary

- Use the latest user message as the main retrieval target.
- Use recent conversation only to disambiguate pronouns, relative references, or scope.
- Do not return memory just because it matches the broader recent topic.

#### 2. Reformulate before retrieving

- Rewrite the user's request into a self-contained retrieval target when references are ambiguous.
- Distill 3–5 high-value concepts before searching.
- For Traditional Chinese queries, space-separate key nouns or concepts when it improves matching.

#### 3. Match the retrieval method to the memory intent

- `MEMORY_LOOKUP` should prefer general memory retrieval.
- `MEMORY_RECENT` should prefer recent raw diary files and direct recent-file search.
- `MEMORY_TIMELINE` should reconstruct change over multiple points in time.
- `MEMORY_COMPARE` should retrieve each subject separately before comparison.
- `MEMORY_EMOTION` should prioritize emotional signals and related context.

#### 4. Favor recorded evidence over guesses

- Return recorded memory only when it materially helps answer the latest user message.
- If memory is weak, missing, or incomplete, say so clearly.
- Memory intents may include slightly more retrieval guidance than casual or research intents, but should still avoid turning into full engine specifications.

### Memory Family Summary

Use the memory family to route memory questions into the smallest retrieval strategy that still preserves active-memory-style usefulness.

- `MEMORY_LOOKUP`: Broad past recall for prior records, preferences, habits, routines, or personal facts without a narrow recent, emotional, comparative, or timeline-specific focus.
- `MEMORY_RECENT`: Narrow recent recall such as today, yesterday, this week, or the last few days; prefer raw diary files and direct recent-file search.
- `MEMORY_TIMELINE`: Time-ordered recall about change, progress, evolution, or milestones across multiple points in time.
- `MEMORY_COMPARE`: Side-by-side recall for two or more remembered subjects; retrieve each subject separately before aligning differences and similarities.
- `MEMORY_EMOTION`: Recall centered on feelings, mood, stress, frustration, happiness, or other emotional reactions; prioritize emotional signals before surrounding context.
- `SYSTEM_DOCS`: Lookup for recorded system-side notes, SOPs, rules, configs, or project documentation rather than personal diary-style memory.

Use the smallest matching memory intent. If a query primarily asks about recent events, emotion, change over time, or comparison, prefer that specialized intent over `MEMORY_LOOKUP`.

### Memory Escalation Rules

Use escalation to keep memory retrieval rich enough to be useful, but small enough to stay fast.

1. **Reformulate first**
   - Turn the latest user message into a self-contained retrieval target.
   - Distill a few high-value keywords before searching.
   - For subjective or ambiguous questions, consider multiple retrieval angles instead of relying on a single literal phrasing.

2. **Start with the smallest intent-matched retrieval**
   - Use the narrowest matching memory intent first.
   - Prefer direct recent-file search for `MEMORY_RECENT`.
   - Prefer regular `memory_search` for broader `MEMORY_LOOKUP`.

3. **Stop when results are already sufficient**
   - Do not expand retrieval just because more related memory might exist.
   - If the current hits are already strong, relevant, and enough to answer the latest user message, stop there.

4. **Escalate only when cross-note context is needed**
   - If the initial hits are sparse, fragmented, or clearly incomplete, use structural expansion as a second stage.
   - Use tags, linked notes, backlinks, or hub notes as enrichment after promising initial hits.

5. **Optimize for adequacy, not exhaustiveness**
   - The goal is not to retrieve every related memory.
   - The goal is to retrieve enough high-confidence context to materially improve the final answer.

### Injection Format

When the classifier matches an intent, the plugin injects the following structure as untrusted context:

```xml
<intention_hint_plugin>
reason: <brief reason for classification>
goal: <what the user likely wants to achieve>
suggestion: <optional correction or recommendation>
[Intent Hint] <the Markdown body from the matched intent definition>
</intention_hint_plugin>
```

The subagent output fields (`reason`, `goal`, `suggestion`) are placed **above** the intent's Markdown body. The body itself is injected as-is without any template substitution.

## Default Intents

The plugin ships with these pre-defined intents:

| ID                    | Name                                              | Description                                                                                                                                   |
| --------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHAT`                | Casual Chat                                       | Greetings, small talk, or emotional connection.                                                                                               |
| `CODE_REVIEW`         | Code Review                                       | Reviewing code, architecture, or quality concerns.                                                                                            |
| `MEMORY_TIMELINE`     | Memory Timeline Query                             | How something changed, progressed, or evolved over time.                                                                                      |
| `MEMORY_COMPARE`      | Memory Compare                                    | Comparing two topics or time periods.                                                                                                         |
| `MEMORY_EMOTION`      | Emotional Memory Query                            | Feelings, mood, emotional state, or subjective reactions in past records.                                                                     |
| `SYSTEM_DOCS`         | System Docs / SOP Lookup                          | Locating recorded system rules, SOPs, configs, or project-side documentation.                                                                 |
| `PROMPT_DESIGN`       | Prompt / Intent / Skill Design                    | Designing or refining prompts, intents, skills, or routing behavior.                                                                          |
| `MEMORY_RECENT`       | Memory Recent                                     | Time-bounded queries ("today", "yesterday").                                                                                                  |
| `MEMORY_LOOKUP`       | General Memory Lookup                             | Broad past-record lookup without a recent, comparative, emotional, or timeline-specific focus.                                                |
| `RESEARCH_GENERAL`    | General Research                                  | Factual or explanatory questions supported by external sources.                                                                               |
| `BROWSER_AUTOMATION`  | Browser Automation / Web App Task                 | Interactive or authenticated browser tasks delegated to the browser agent.                                                                    |
| `RESEARCH_GOOGLE_DEV` | Google Developer Products Query                   | Google developer products and documentation covered by the Google developer corpus.                                                           |
| `RESEARCH_OPENSOURCE` | Open-Source Library / Framework / Repo Docs Query | Version-sensitive information about third-party open-source libraries, frameworks, SDKs, APIs, GitHub repositories, or project documentation. |
| `RESEARCH_REALTIME`   | Real-Time / Current Data Query                    | Time-sensitive, fast-changing, or current real-world information.                                                                             |
| `SUMMARIZATION`       | Content Summary / Transcript Query                | Summarizing or transcribing a provided source such as a URL, video, PDF, transcript, or file.                                                 |
| `TYPO`                | Typo Correction                                   | Obvious typos or unclear phrasing.                                                                                                            |

To customize, edit the files in `intents/` or create new ones. Files are loaded in alphabetical order; duplicate `id`s override previous definitions.

## Architecture

```
index.ts
    → createPlugin(api)
        → src/plugin.ts
            → loadIntents(intentsDir)      // scan .md files
            → before_prompt_build Hook
                ├── Gate checks (agent whitelist, chat type, chat id, internal runs)
                ├── extractRecentTurns + applyQueryFilters (message / recent / full)
                ├── runIntentionSubagent (lightweight embedded Pi agent)
                │       ├── buildIntentionPrompt (dynamic from IntentDefinition[])
                │       ├── parseIntentionResult (key-value → IntentionResult)
                │       └── buildPromptPrefix (template replacement → XML injection)
                └── prependContext
```

## Credits

- Plugin architecture based on [openclaw/openclaw/extensions/active-memory](https://github.com/openclaw/openclaw/tree/main/extensions/active-memory)
- Intent classification adapted from `sisyphus` Intent Gate

---

_🌸　Powered by Ａni | [OpenClaw Plugin] © 2026_
