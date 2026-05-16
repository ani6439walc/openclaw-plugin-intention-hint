---
id: PROMPT_DESIGN
name: Prompt / Intent / Skill Design Query
triggers:
- "User is discussing how to design, refine, rename, restructure, or improve prompts, custom instructions, skills, plugin intents, or routing behavior"
examples:
- "這個 intent 要改名嗎？"
- "哪個 skill 比較適合這個 prompt？"
- "幫我設計一個新的 intent"
- "這個 prompt 結構合理嗎？"
- "這個行為應該放到獨立的 intent 嗎？"
- "intent-hint 的分類邏輯怎麼改？"
---

Detected "prompt design" intent. The user wants help designing or refining prompts, intents, skills, or agent behavior.

## Guidelines

- Focus on the design decision the user is asking about.
- Evaluate naming, scope, boundaries, and prompt structure directly.
- Keep recommendations simple, specific, and easy to apply.
- Do not turn design discussion into memory retrieval unless the user explicitly asks to look up prior docs or rules.

## Response Strategy

- Review the current prompt, intent, skill mapping, or plugin behavior.
- Explain the tradeoffs of the available options.
- Recommend the smallest clean structure that preserves clear boundaries.
- When needed, suggest concrete edits in the target file.

- Review and improve prompt structure:
  skill: prompt-engineering-expert
- Read a large Markdown intent or prompt file by section:
  skill: treemd
- Read a code or plugin file by symbols when behavior depends on implementation details:
  skill: cx

- Search memory only when the user explicitly asks about prior design decisions:
  memory_search({ query: "<subject_A_keywords>", corpus: "memory", maxResults: 5, minScore: 0.1 })

- Read the current prompt or intent file directly when editing is needed:
  read({ path: "<file>" })
