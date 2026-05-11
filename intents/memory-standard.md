---
id: MEMORY_STANDARD
name: General Memory Query
triggers:
- "User asks about past events, records, or historical information without a clear timeframe, comparison intent, emotional leaning, or meta nature"
- "User's question involves past conversations or requires retrieval from long-term memory, but does not fit recent, chronology, comparison, emotional, or meta categories"
examples:
- "What was that idea I told you about before?"
- "Where is the related info for that project?"
- "Have we discussed this topic before?"
- "Help me find records about xxx"
- "What do I usually order at that restaurant?"
- "Do you remember my flight preferences?"
- "What was my previous laptop setup?"
---

Detected "general memory" intent. Use vector-based memory retrieval (`memory_search` + `memory_get`) to find relevant long-term memories. This is the fallback intent for queries that do not fit recent, chronology, comparison, emotional, or meta categories.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER fabricate information**. If no hits, explicitly report `NONE`.
2. **NEVER guess** about user preferences, habits, or personal facts. Only return what exists in memory.
3. **NEVER conflate weak connections**. Return memory only if it clearly helps answer the **latest user message itself**.
4. Do not return memory just because it matched the broader recent topic.
5. Use `memory_search` as primary retrieval. Use `memory_get` to extract specific lines from top-ranked files.
6. Final summary must be under **300 characters** total.

## Step 1 — Query Analysis & Reformulation

Transform the user's latest message into a self-contained, search-optimized query. Use recent conversation **only** to disambiguate pronouns and relative references.

### A. Standalone Reformulation
Rephrase into a self-contained query. Resolve pronouns and relative references using historical entities.
- Example: "How much did it cost?" → "How much did the Titanic movie cost?"

### B. Keyword Distillation
Extract 3–5 high-weight concepts. Strip all conversational noise, fillers, and formatting.
- Example: "I need to find a way to cook steak" → `steak cooking method temperature`

### C. CJK Trigram Optimization (for Traditional Chinese queries)
Space-separate nouns and concepts to optimize matching.
- Example: `量子力學基礎` → `量子力學 基礎`

**Language Constraint**: Output search queries **ONLY** in Traditional Chinese (Taiwan) or English (for technical keywords/entities). **NEVER** use Simplified Chinese characters.

## Step 2 — Memory Retrieval

Use the reformulated query from Step 1 to retrieve memories.

### Primary: `memory_search`
Use `memory_search` as the primary vector-based retrieval method:
```typescript
memory_search({
  query: "<reformulated_query>",  // space-separated for CJK
  corpus: "all",                   // search both memory/*.md and sessions/*.jsonl
  maxResults: 3,
  minScore: 0.1,                   // permissive for preference/habit recall
})
```
Then use `memory_get` to read specific lines from the top-ranked files.

### Preference / Habit Boost
If the user directly asks about **favorites, preferences, habits, routines, or personal facts** (e.g., "what is my favorite food", "do you remember my flight preferences"):
- Use a **permissive threshold** (`minScore: 0.1` for Traditional Chinese) before deciding that no useful memory exists.
- Treat this as a **strong recall signal**.

### Ignore Prior Traces
If recent context already contains recalled-memory summaries, debug output, or prior memory/tool traces:
- **Ignore** that surfaced text unless the latest user message **clearly requires re-checking** it.

## Step 3 — Relevance Filtering

Evaluate each result against the **latest user message only** (not the broader conversation topic).

**Reject if:**
- The connection is weak, broad, or only vaguely related.
- The memory helps with the broader topic but not the **specific** latest question.
- Recent context and latest message point to different memory domains, and the memory matches the broader topic rather than the latest message.

**Accept if:**
- The memory would **materially help** answer the user's latest message.
- The user directly asked about personal facts, preferences, or habits and the memory contains relevant data.

---

## Step 4 — Boundary-Condition Check (V2.2)

> Run this check **after** Step 2 (Memory Retrieval) and **before** Step 3 (Relevance Filtering).  
> If any condition matches, apply the corresponding patch **immediately** and skip the standard relevance filter.

### ❶ Temporal Recency
**Trigger**: User uses words like "today", "yesterday", "just now", "this morning", "recently".
**Detection**: The query explicitly references a date within the last 48 hours.
**Patch**: Switch to `MEMORY_RECENT` Fast Path (`rg` on raw daily notes). Do **not** use `memory_search`.

### ❷ Sparse Occurrence
**Trigger**: User asks for a specific ID, URL, ticket number, or exact phrase that appears rarely.
**Detection**: `memory_search` returns < 2 hits, or all results have score < 0.2.
**Patch**: Use `rg` with precise patterns (e.g., `rg -i "JIRA-[0-9]+|https?://"`) across `darling/` and `memory/`.

### ❸ Semantic Drift
**Trigger**: The query contains ambiguous terms that could belong to multiple domains.
**Detection**: Top results from `memory_search` span ≥ 3 unrelated topics (e.g., "exam" → PCA exam, health check, school exam).
**Patch**: Run **disambiguation sub-queries** for each domain:
```typescript
memory_search({ query: "exam PCA score" });
memory_search({ query: "exam health check" });
memory_search({ query: "exam school" });
```
If results diverge, ask the user to clarify: "Do you mean (a) PCA exam, (b) health check, or (c) something else?"

### ❹ Data Scarcity
**Trigger**: User asks about a person, topic, or event with little or no recorded history.
**Detection**: `memory_search` returns 0 hits, or only hits from `MEMORY.md` definition pages / generic templates.
**Patch**: Report `INSUFFICIENT_DATA`. Do **not** guess or hallucinate.
```
No specific records found for "{topic}". The memory may not exist yet.
```

### ❺ Long-Term Path Discovery
**Trigger**: User asks about evolution, changes, or journey over a long timespan ("from...to...", "how has it changed").
**Detection**: The query implies a duration > 30 days, or uses words like "心路歷程", "演變", "progress".
**Patch**: Switch to `MEMORY_CHRONOLOGY` temporal clustering. Split search into "start → middle → end" segments and aggregate results chronologically.

### ❻ Comparison / Contrast
**Trigger**: User compares two or more things, time periods, or approaches ("vs", "difference", "compared to").
**Detection**: The query contains comparative structures or explicitly names two subjects.
**Patch**: Switch to `MEMORY_COMPARE`. Retrieve memories for **each subject separately**, then align fields for comparison. Do **not** conflate the two.

### ❼ Meta-Memory
**Trigger**: User asks about the system itself, SOPs, memory structure, or improvement suggestions ("system", "SOP", "plugin", "workflow").
**Detection**: Query contains meta-vocabulary and no personal-life keywords ("diary", "yesterday", "travel", "ate").
**Patch**: Switch to `MEMORY_META`. Change search scope to **System Corpus** (`darling/projects/`, `AGENTS.md`, `TOOLS.md`, etc.) and use `rg` instead of `memory_search`.

### ❽ Emotion Buried in Technical Context
**Trigger**: User asks about feelings, mood, or emotional states, but memory is dominated by technical tags.
**Detection**: `memory_search` returns mostly technical results (#error, #architecture) with zero emotional tags (#shy, #trembling, #happy).
**Patch**: Switch to `MEMORY_EMOTIONAL`. Run a secondary `rg` for emotional tags:
```bash
rg -i "#害羞|#顫抖|#失落|#開心|#煩躁|#挫折" memory/YYYY-MM-DD.md
```
Weight emotionally dense segments higher (emotional tags → score × 1.5).

---

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `memory_search` | Vector semantic search across memory corpus | **Primary retrieval method** — always call this first |
| `memory_get` | Read specific memory file excerpt | After `memory_search` returns file paths to extract exact lines |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `obsidian-cli` | Vault navigation: tags, backlinks, links, search | Optional — when you need to explore file relationships or tag distributions after initial search |
| `treemd` | Survey structure of large diary files before extracting | Optional, when a hit file is very large and you need to locate the relevant section |
