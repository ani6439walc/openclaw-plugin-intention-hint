---
id: WORKSPACE_FILE_EDITING
name: Workspace File Editing (工作區檔案編輯)
enabled: true
triggers:
  - "User wants to edit, translate, restructure, append, or patch a workspace configuration/reference file such as TOOLS.md, AGENTS.md, MEMORY.md, CONTEXT.md, or SOUL.md"
  - "User references a specific section, heading, line range, or wording in a workspace file and asks to modify, rewrite, translate, or update it"
  - "User wants to update workspace docs with new information, correct existing content, or change formatting/language"
  - "User mentions editing workspace configuration docs: 翻譯、修改、更新、改寫、編輯 TOOLS.md、AGENTS.md、MEMORY.md 等設定檔內容"
examples:
  - "TOOLS.md 的 Browser Technical Reference 段落翻譯成中文"
  - "幫我把 AGENTS.md 裡的錯誤修正一下"
  - "MEMORY.md 加一段新的筆記"
  - "把 CONTEXT.md 的這段重寫得更清楚"
  - "幫我更新 TOOLS.md 的 Ghost 連線資訊"
---

Detected "workspace file editing" intent. The user wants direct content changes to local workspace documentation, rules, notes, or configuration/reference files.

## Guidelines

- This intent covers direct content modification of workspace files, not lookup-only questions.
- Always read the target file or section first to understand current structure before editing.
- Preserve existing frontmatter, heading hierarchy, local wording conventions, and formatting style.
- When translating, keep technical terms, code blocks, commands, paths, and proper nouns intact unless the user explicitly requests full localization.
- Prefer surgical section or block edits over full-file rewrites.
- For large or risky edits, draft the change and confirm before writing.

## Skills & Tools

- Read workspace files to inspect current content and structure:
  read({ path: "<file>", offset: <line>, limit: <lines> })

- Apply precise edits to specific sections or line ranges:
  edit({ path: "<file>", edits: [{ oldText: "<existing text>", newText: "<replacement text>" }] })

- Create or overwrite a file only after preserving existing content and confirming scope:
  write({ path: "<file>", content: "<full content>" })

- Search, diff, or validate after editing:
  exec({ command: "rg -n '<pattern>' <path> && git diff -- <file>", workdir: "<workspace>" })

## Response Strategy

- Confirm the target file and section before editing if the request is ambiguous.
- Make the smallest edit that satisfies the request.
- Re-read or diff the affected section after editing.
- Report the exact file changed and a brief summary of what changed.

## Concrete Workflow

### Step 1 — Locate and Read

- Identify the target workspace file and requested section, heading, line range, or phrase.
- Read the affected content before planning any edit.

### Step 2 — Plan the Edit

- Determine whether the transformation is translation, rewrite, append, restructure, formatting, or correction.
- Preserve nearby structure, heading style, code blocks, and special syntax.

### Step 3 — Apply Targeted Changes

- Use precise replacements for existing content.
- Avoid broad rewrites that could remove unrelated user edits.

### Step 4 — Verify Result

- Re-read the edited section or inspect a diff.
- Run formatting, lint, or search checks when relevant.

### Step 5 — Report Concisely

- Summarize changed files and exact content-level changes.
- Mention any skipped or ambiguous parts.
