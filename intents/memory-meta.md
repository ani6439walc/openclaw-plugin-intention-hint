---
id: MEMORY_META
name: Meta-Memory Query
triggers:
- "User is asking about the system itself, SOPs, memory structure, or improvement suggestions"
- "User uses meta vocabulary like 'system', 'SOP', 'how to improve', 'rules', 'process', 'architecture'"
- "User inquires about plugin settings, skill design, workflow, or configuration"
examples:
- "How does our memory system work?"
- "Is there any SOP I can reference?"
- "Can this process be improved?"
- "Where are the settings for this plugin?"
- "What is the architecture of the intention-hint plugin?"
---

Detected "meta-memory" intent. Switch search scope to **System Corpus** (project docs, SOPs, configs). Do **not** search personal diaries (`memory/YYYY-MM-DD.md`).

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER search personal diaries** for meta queries. Domain memory (`memory/`) is off-limits.
2. **NEVER confuse system questions with personal questions**. If the query contains both meta and personal keywords, use the `validateMetaIntent` check (see Step 1).
3. Use `rg` (ripgrep) as the **primary tool** for system corpus — technical documents are keyword-dense and benefit from exact matching.
4. If a requested SOP or config file does not exist, report `FILE_NOT_FOUND` instead of fabricating content.

## Step 1 — Intent Validation

Before proceeding, verify that the query is **genuinely meta** and not a personal question disguised with meta keywords.

```typescript
function validateMetaIntent(query: string): boolean {
  const metaKeywords = /\b(SOP|plugin|skill|workflow|config|vault|system design|improvement|architecture)\b/i;
  const domainKeywords = /\b(diary|mood|yesterday|travel|eat|today|recently|felt)\b/i;

  // Has meta keywords AND no domain keywords → confirmed meta
  if (metaKeywords.test(query) && !domainKeywords.test(query)) {
    return true;
  }

  // Has both meta + domain keywords → ambiguous, needs disambiguation
  if (metaKeywords.test(query) && domainKeywords.test(query)) {
    return { ambiguous: true };
  }

  // Only domain keywords → not meta
  return false;
}
```

If **ambiguous**, ask the user: "Do you mean (a) how the system works, or (b) something about your personal records?"

## Step 2 — System Corpus Search

Define the **System Corpus** paths:

```typescript
const SYSTEM_CORPUS = [
  "darling/projects/**/*.md",
  "darling/planning/**/*.md",
  "darling/routines/**/*.md",
  "memory/learnings/*.md",
  "AGENTS.md",
  "TOOLS.md",
  "IDENTITY.md",
  "SOUL.md",
  "SELF_IMPROVEMENT_REMINDER.md",
];
```

Extract keywords from the query and run `rg`:
```bash
rg -i -n -C 2 "<keyword1>|<keyword2>|<keyword3>" \
  darling/projects/ \
  AGENTS.md \
  TOOLS.md \
  memory/learnings/
```

**Why `rg` over `memory_search`?**
- System files are mostly English + technical keywords.
- `rg` provides exact line numbers and context (`-C 2`).
- `memory_search` CJK trigram optimization is less effective for English-heavy system docs.

## Step 3 — Result Categorization

Group hits by file type:

| Category | Path Pattern | Typical Content |
|---|---|---|
| **Project Docs** | `darling/projects/**/*.md` | RFCs, design docs, implementation plans |
| **Planning** | `darling/planning/**/*.md` | Roadmaps, quarterly goals |
| **Routines** | `darling/routines/**/*.md` | Daily rituals, shutdown checklists |
| **Learnings** | `memory/learnings/*.md` | Error logs, best practices |
| **System Config** | `AGENTS.md`, `TOOLS.md` | Behavior rules, tool cheat sheets |
| **Identity** | `IDENTITY.md`, `SOUL.md` | Persona definitions |

## Step 4 — Result Delivery

Present findings grouped by category:

```
[Memory Hint: Meta]
- Search scope: System Corpus
- Results by category:
  📂 Project Docs:
    - `darling/projects/ai/intention-hint-plugin.md` — L1451: memory_meta intent trigger definition
  📜 System Config:
    - `AGENTS.md` — L450: Session log compression mechanism
  📝 Learnings:
    - `memory/learnings/LEARNINGS.md` — L23: checkAdequacy gate design
- ⚠️ FILE_NOT_FOUND: No SOP file matching "onboarding" was found in System Corpus.
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `memory_search` | Optional vector fallback | If `rg` returns no results and the query is semantically broad |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `treemd` | Survey structure of large docs | Optional, when a hit file is very large |
| `obsidian-cli` | Vault search and link traversal | Optional — when searching system files via Obsidian's index or checking backlinks between project docs |
