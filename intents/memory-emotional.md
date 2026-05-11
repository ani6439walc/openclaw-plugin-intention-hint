---
id: MEMORY_EMOTIONAL
name: Emotional Memory Query
triggers:
- "User is asking about mood, feelings, emotional states, or subjective experiences"
- "User uses emotional vocabulary like 'mood', 'feeling', 'frustrated', 'happy', 'sad', 'stressed'"
- "User inquires about emotional reactions to past events, even when phrased around technical topics"
examples:
- "How was I feeling at that time?"
- "How did that thing I mentioned last time make me feel?"
- "Have I been under a lot of stress lately?"
- "Why was I so frustrated back then?"
- "Was I happy when working on that project?"
---

Detected "emotional" intent. Use **Emotional Density Weighting** to prioritize emotionally tagged segments. Technical content should be deprioritized unless it explicitly contains emotional markers.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER report only technical facts** when the user asks about feelings. Always look for emotional tags or sentiment-laden language.
2. **NEVER dismiss emotional content** buried in technical context. A bug-fix session may contain "frustrated", "relieved", "proud".
3. Do **not** invent emotions. If no emotional tags exist, report `NO_EMOTIONAL_DATA` rather than guessing.
4. Weight emotional paragraphs higher, but still cite the source file and line.

## Step 1 — Dual-Axis Search

Run **two parallel searches**:

### Axis 1: Emotional Tags (Primary)
Search for explicit emotional markers using `rg`:
```bash
rg -i "#害羞|#顫抖|#失落|#開心|#煩躁|#挫折|#沮喪|#生氣|#驕傲|#感動" memory/
```

Also search for emotional keywords in the user's query:
```typescript
memory_search({
  query: "<emotion_keyword>",  // e.g., "frustrated", "happy", "stressed"
  corpus: "memory",
  maxResults: 10,
  minScore: 0.1,
});
```

### Axis 2: Technical Context (Secondary)
If the user mentions a specific event or topic, also search for that topic to locate the *context* where emotions might be buried:
```typescript
memory_search({
  query: "<topic_keyword>",  // e.g., "PCA exam", "bug fix", "project launch"
  corpus: "memory",
  maxResults: 10,
  minScore: 0.1,
});
```

## Step 2 — Emotional Density Scoring

For each hit, compute an **emotional density score**:

| Condition | Score Modifier |
|---|---|
| Contains ≥ 2 emotional tags (e.g., `#害羞`, `#顫抖`) | × 1.5 |
| Contains 1 emotional tag | × 1.2 |
| Contains emotional keywords but no tags (e.g., "frustrated", "relieved") | × 1.1 |
| Purely technical, no emotional markers | × 0.8 |

Re-rank all results by **adjusted score** (original `memory_search` score × emotional modifier).

## Step 3 — Contextual Extraction

For the top emotionally ranked results:

1. Read the paragraph containing the emotional marker using `memory_get`.
2. Extract:
   - **The emotion** (what was felt)
   - **The trigger** (what caused it)
   - **The intensity** (mild, moderate, strong — inferred from language)
   - **The date** (when it happened)

**Example extraction:**
```
Source: memory/2026-03-22.md:L45
Emotion: Proud / Relieved
Trigger: Fixed the production outage after 6 hours
Intensity: Strong
Date: 2026-03-22
```

## Step 4 — Result Delivery

Present emotional findings with context:

```
[Memory Hint: Emotional]
- Top emotional moments:
  - [date] — <emotion> (<intensity>): <trigger>
  - [date] — <emotion> (<intensity>): <trigger>
- ⚠️ Technical context only: If the user asked about feelings during [topic],
  no explicit emotional tags were found. Consider asking for clarification.
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `memory_search` | Vector search for emotion keywords + topic context | Step 1 — Axis 1 and Axis 2 |
| `memory_get` | Read specific emotional paragraphs | Step 3 — extract context around emotional markers |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `treemd` | Survey structure of large files before reviewing | When the file is very long and you need to locate relevant sections |
| `obsidian-cli` | Tag extraction via `obsidian tags file=<note>` | Optional — when `rg` is insufficient and you need Obsidian's native tag index |
