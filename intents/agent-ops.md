---
id: AGENT_OPS
name: Agent Operations / System Management
enabled: true
triggers:
  - "User is issuing a direct command to the agent for workspace management, skill approval, cron manipulation, or system diagnostics"
  - "User references a numbered item from a prior list (e.g. 'approve 2', 'delete the third one') requiring action on a known inventory"
  - "User confirms or rejects a pending proposal from a skill workshop or similar queue"
  - "User asks the agent to run a shell command, install a package, or manage dependencies via package managers (pnpm, npm, pip, brew, apt, uv, etc.)"
examples:
  - "approve 2"
  - "reject the first one"
  - "check cron jobs"
  - "restart the gateway"
  - "show me pending skills"
  - "好 建立"
  - "delete that one"
  - "幫我執行 pnpm add -g sharp"
  - "npm install axios"
  - "pip install requests"
  - "brew install wget"
  - "uv run --with paho-mqtt python3 script.py"
---
Detected "agent operations" intent. The user is issuing a direct system-level command, often referencing a numbered item from a prior list.

## Guidelines

- This is an action request, not a discussion. Execute immediately.
- If the command references a numbered item from a prior list, resolve the index before acting.
- Do not treat this as productivity, research, or casual chat.
- Do not ask for clarification if the intent is unambiguous.

## Response Strategy

- Execute the operation directly via the appropriate tool.
- Report the result concisely.
- Only ask for confirmation if the operation is destructive.
