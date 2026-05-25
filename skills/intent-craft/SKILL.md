---
name: intent-craft
description: "Design, refine, or audit intention-hint-plugin intent definitions. Single-intent interview mode or full bootstrap audit of all skills/tools."
---

Craft intent definitions for the intention-hint plugin.
Two modes — pick based on user request scope.

## Mode: single

User wants to create, rename, split, merge, or refine **one** intent.

Read order:
1. `references/interview.md`
2. `references/format-rules.md`
3. `references/closing.md`

Then follow the 5-step workflow: classify → interview → ground → draft → deliver.

## Mode: audit

User wants to bootstrap or re-audit the entire intent system (first install or after many new skills/tools).

Read order:
1. `references/discovery.md`
2. `references/clustering.md`
3. `references/interview.md`
4. `references/format-rules.md`
5. `references/closing.md`

Then follow: discovery → clustering → interview → generate → review.

## First-time setup (assets)

When bootstrapping from scratch, copy example intent templates from `assets/` as starting points:
- `assets/chat.md` / `assets/typo.md` — minimal behavior-only intents (no tools)
- `assets/memory-lookup.md` / `assets/memory-compare.md` / `assets/memory-timeline.md` — memory retrieval SOPs
- `assets/summarization.md` / `assets/research-general.md` — multi-source routing patterns

These are English example templates. Adapt to the project's language and intent scope.

## Decision style

- Recommend defaults confidently; keep cognitive load low.
- Favor simple, maintainable intent boundaries over clever taxonomy.
