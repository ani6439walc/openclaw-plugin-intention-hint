---
id: MEMORY_COMPARE
name: Memory Comparison Query
triggers:
- "User is comparing two or more things, time periods, or approaches"
- "User uses comparison phrases like 'compared to...', 'difference', 'vs', 'which is better'"
- "User asks about similarities, contrasts, or trade-offs between multiple subjects"
examples:
- "Which of these two approaches is better?"
- "What's the difference between last month's and this month's data?"
- "What's the difference between method A and method B?"
- "What's different between the previous version and the current one?"
- "How does Japan trip compare to the Chiayi trip?"
---

Detected "comparison" intent. Use **Dual Retrieval**: search each subject independently, then align fields for comparison. Do **not** conflate the two subjects into a single query.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER conflate subjects**. Retrieve memories for Subject A and Subject B separately.
2. **NEVER assume superiority**. Report differences neutrally; let the user judge which is "better".
3. If one subject has significantly fewer memory hits than the other, flag `ASYMMETRIC_DATA`.
4. Only compare fields that exist for **both** subjects. If a field is missing for one, mark it as "no data" rather than omitting it.

## Step 1 — Subject Extraction

Identify the **two (or more) subjects** being compared from the user's query.

**Example mappings:**
| User Query | Subject A | Subject B |
|---|---|---|
| "Japan vs Chiayi trips" | Japan trip | Chiayi trip |
| "PCA Exam 2 vs Exam 4" | PCA Exam 2 | PCA Exam 4 |
| "last month vs this month" | Last month's data | This month's data |
| "method A vs method B" | Method A | Method B |

If the query contains > 2 subjects, run pairwise comparisons or focus on the two most prominent.

## Step 2 — Dual Retrieval

Run **independent memory searches** for each subject:

```typescript
// Search Subject A
memory_search({ query: "<subject_A_keywords>", corpus: "memory", maxResults: 5, minScore: 0.1 });

// Search Subject B
memory_search({ query: "<subject_B_keywords>", corpus: "memory", maxResults: 5, minScore: 0.1 });
```

**Important**: Do **not** search for "A vs B" or "difference between A and B". Search for A alone and B alone.

## Step 3 — Field Alignment

Extract structured fields from each subject's memory hits. Common comparison fields:

| Field Category | Examples |
|---|---|
| **Time / Duration** | Start date, end date, length |
| **Location** | Place, venue, city |
| **People** | Who was involved |
| **Activities** | What was done |
| **Cost / Resources** | Money, time, effort spent |
| **Outcome / Result** | Success, failure, score, output |
| **Emotional Tone** | Mood, stress level, satisfaction |

For each field, extract values from **both** subjects. If a field is missing for one subject, mark it explicitly:
```
Field: Cost
- Subject A: $200
- Subject B: (no data)
```

## Step 4 — Difference Highlighting

Identify fields where the two subjects **differ meaningfully**:

```typescript
// Highlight rules
const differences = [];
for (const field of allFields) {
  const valA = getField(subjectA, field);
  const valB = getField(subjectB, field);
  if (valA && valB && valA !== valB) {
    differences.push({ field, A: valA, B: valB });
  }
}
```

Also identify **commonalities** (fields where values are similar or identical).

## Step 5 — Result Delivery

Present comparison in a **structured, neutral** format:

```
[Memory Hint: Comparison]
- Subjects: <A> vs <B>
- Commonalities:
  - <field>: <shared value>
- Differences:
  - <field>: A = <value>, B = <value>
  - <field>: A = <value>, B = (no data)
- ⚠️ ASYMMETRIC_DATA: Subject B has fewer records; comparison may be incomplete.
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `memory_search` | Vector search per subject | Step 2 — run independently for Subject A and Subject B |
| `memory_get` | Read specific file excerpts | After search to extract structured fields |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `treemd` | Survey structure of large files before reviewing | When the file is very long and you need to locate relevant sections |
| `obsidian-cli` | Tags / backlinks extraction for structural comparison | Optional — when you need to compare how subjects are tagged or linked in the vault |
