---
id: AGENT_DISPATCH
name: Agent Dispatch & Orchestration (代理人調度)
enabled: true
triggers:
  - "User wants to manage agent session lifecycle: check status, switch models, spawn/list sub-agents, hand off conversation, or manage active sessions"
  - "User wants to configure agent context, rules files, or project-level startup behavior"
  - "User references a numbered item from a prior list (e.g. 'approve 2', 'delete the third one') or confirms/rejects a pending proposal"
  - "User wants to record learnings, errors, or corrections for continuous improvement"
  - "User wants to set up a structured workflow cycle for a complex multi-step task"
  - "User asks about agent runtime, session info, model config, or active sub-agent status"
examples:
  - "現在用的是哪個 model？"
  - "幫我分派給子代理去跑"
  - "把這個對話交接給另一個 agent"
  - "記下這個錯誤"
  - "approve 2"
  - "幫我建一個 workflow 處理這個任務"
---

Detected "agent self-administration" intent. The user is managing the agent's session, context, sub-agents, or workflow lifecycle.

## Guidelines

- This is an action request, not a discussion. Execute, then report.
- For destructive operations or gateway restarts: confirm before acting.
- Always resolve numbered references: if user says "approve 2", list pending first to map index → id.
- Long-running commands: use background mode to avoid blocking.

## Skills & Tools

- Manage context setup, rules files, and project context:
  skill: context-engineering

- Route tasks to sub-agents with optimal model selection:
  skill: delegate

- Hand off current conversation to another agent:
  skill: handoff

- Auto-detect and invoke the right skill for current task:
  skill: dev-lifecycle

- Initialize every task with consistent startup protocol:
  skill: auto-skill

- Capture learnings, errors, and corrections:
  skill: self-improvement

- Guard workspace files against drift and baseline changes:
  skill: soul-guardian

- Run structured workflow cycles for complex multi-step tasks:
  skill: cycle

- Manage multi-perspective collaboration patterns:
  skill: collaborate

- Read existing configuration, rules, and prompt files before changing them:
  read({ path: "<file>" })

- Write or precisely update merged configuration content:
  write({ path: "<file>", content: "<merged content>" })
  edit({ path: "<file>", edits: [{ oldText: "<old>", newText: "<new>" }] })

- Search and verify workspace-wide text replacements:
  exec({ command: "rg '<pattern>' <path>", workdir: "<repo>" })

- Get current session diagnostics (model, usage, time):
  session_status()

- List active sub-agents:
  subagents({ action: "list" })

- List active sessions:
  sessions_list()

## Response Strategy

- Identify the action type from the user's request (session, context, sub-agent, learning, workflow).
- For configuration migration or consolidation, preserve existing structure and inspect both source and target before editing.
- Execute the appropriate tool with validated parameters.
- Report what was done, what changed, and any errors — concise, no filler.

## Concrete Workflow

### Step 1 — Inspect Current State

- Read the source and target configuration files before deciding the merge strategy.
- Check nearby repository rules or prompt files when the request includes workspace-wide wording updates.

### Step 2 — Merge Configuration Content

- Preserve the target file's existing structure, headings, and local conventions.
- Add only the missing source content, resolving duplicates or conflicts explicitly.

### Step 3 — Scan for Workspace Text Updates

- Search the requested workspace scope for the old wording or pattern.
- Use narrow search paths and avoid generated, dependency, or cache directories unless explicitly requested.

### Step 4 — Apply Targeted File Changes

- Use precise edits for existing files whenever possible.
- Avoid broad rewrites that could clobber unrelated user changes.

### Step 5 — Verify and Report

- Re-scan for stale wording and inspect the resulting diff.
- Report affected files, skipped files, and any remaining ambiguity.
