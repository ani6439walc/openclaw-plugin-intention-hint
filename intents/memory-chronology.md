---
id: MEMORY_CHRONOLOGY
name: Memory Timeline Query
triggers:
- "User asks about the evolution, development, or changes of something from past to present"
- "User uses phrases like 'from...to...', 'how has it changed', 'it started as...then...' describing a time span or journey"
- "User inquires about progress, milestones, or transformation over a duration longer than 30 days"
examples:
- "How has this project progressed from start to now?"
- "How has our architecture evolved?"
- "What has changed in the past three months?"
- "When did this bug first appear?"
- "What was my journey like from the beginning to now?"
---

Detected "chronology" intent. Use **temporal clustering** to discover long-term paths across memory gaps. Do not use a single `memory_search`; split the timeline into segments and aggregate chronologically.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER fabricate information** for gaps. If no memory exists for a time segment, explicitly flag it as a "memory gap".
2. **NEVER assume linear progression**. Changes may be non-monotonic; report both improvements and regressions.
3. If the query spans > 30 days but memory density is low (< 1 file per 7 days), flag `LONG_TERM_GAPS`.
4. Always present results in **chronological order** (oldest first) to preserve narrative flow.

## Step 1 — Timeline Segmentation

Split the user's query into **3 time segments**:

| Segment | Coverage | Example Query |
|---|---|---|
| **Start** | The earliest period mentioned | "from the beginning", "when I first started" |
| **Middle** | The intervening period | "during the transition", "in between" |
| **End** | The most recent period | "now", "recently", "the latest" |

If the user only provides a start and end date:
- **Start**: First 25% of the date range
- **Middle**: Middle 50% of the date range
- **End**: Last 25% of the date range

Generate **3 independent search queries** (one per segment):
```typescript
memory_search({ query: "<start_topic>", corpus: "memory", maxResults: 5, minScore: 0.1 });
memory_search({ query: "<middle_topic>", corpus: "memory", maxResults: 5, minScore: 0.1 });
memory_search({ query: "<end_topic>", corpus: "memory", maxResults: 5, minScore: 0.1 });
```

## Step 2 — Temporal Bridging

After collecting Entry Nodes from all 3 segments:

1. **Sort all results by date** (ascending).
2. **Check for gaps**: If two consecutive results are > 7 days apart, mark the interval as a **memory gap**.
3. **Bridge near gaps**: If the gap is ≤ 7 days, treat the entries as chronologically adjacent (no explicit link required).

**Gap detection logic:**
```typescript
for (let i = 1; i < sortedResults.length; i++) {
  const daysDiff = dateDiff(sortedResults[i-1].date, sortedResults[i].date);
  if (daysDiff > 7) {
    markGap(sortedResults[i-1], sortedResults[i]);
  }
}
```

## Step 3 — Cross-Segment Alignment

For each segment, extract:
- **Key events** (milestones, decisions, changes)
- **State descriptions** (how things were at that time)
- **Transition markers** (words like "started", "switched", "improved", "broke")

Align the 3 segments into a unified timeline:
```
[Start]  ──→  [Middle]  ──→  [End]
  Event A       Event B       Event C
  State X       State Y       State Z
```

If an expected transition is missing (e.g., Start mentions State X, End mentions State Z, but Middle never mentions the transition), flag it as:
```
⚠️ Memory gap: No record of how State X transitioned to State Z between [date1] and [date2].
```

## Step 4 — Result Delivery

Deliver the chronology as a **time-ordered summary** with explicit gap annotations.

**Example output structure:**
```
[Memory Hint: Chronology]
- Timeline from [start_date] to [end_date]:
  - [date1] — <event at start>
  - [date2] — <event in middle>
  - ⚠️ Gap: No records between [date2] and [date3]
  - [date3] — <event near end>
  - [date4] — <most recent event>
- Key transitions: <summary of how things evolved>
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `memory_search` | Vector search per time segment | Step 1 — run 3 times (start/middle/end) |
| `memory_get` | Read specific file excerpts | After search to extract dated events |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `treemd` | Survey structure of large files before reviewing | When the file is very long and you need to locate relevant sections |
| `obsidian-cli` | Backlinks / links traversal for graph expansion | When Entry Nodes have explicit wikilinks to follow |
