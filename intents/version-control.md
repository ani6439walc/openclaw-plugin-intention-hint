---
id: VERSION_CONTROL
name: Source Code Version Control
triggers:
- "User is asking to commit, push, pull, or manage git operations"
- "User wants to check git status, view git log, or review git diff"
- "User is asking about branch management, merging, or rebasing"
- "User wants to manage submodules or update dependencies"
- "User is asking to stage files, write commit messages, or handle git conflicts"
examples:
- "幫我 commit"
- "看看 git 記錄"
- "git status"
- "幫我 rebase 到 main"
- "誰改了這個檔案"
- "合併這個分支"
---

Detected "version control" intent. The user wants to perform git operations such as commit, push, pull, branch management, or submodule updates.

## Guidelines

- Always check `git status` first to understand the current state.
- Use `gaic` for standardized emoji-style commits when available.
- Prefer `git add` with specific files instead of `git add .` to avoid unintended changes.
- Verify staged changes with `git diff --cached --stat` before committing.
- For submodule updates, enter the submodule directory first before performing git operations.
- Keep commit messages concise and follow Conventional Commit format with emoji.

## Response Strategy

For all git operations, prefer using the **`git-master` skill** for commit, rebase, squash, and history search tasks. It provides atomic commits, style detection, conflict resolution, and blame/bisect workflows.

- For simple operations (status, log, pull, push): use `exec` directly.
- For commit/rebase/squash/history search: use `git-master` skill.

```bash
# Quick status + log
git status
git log --oneline -10

# Push to remote
git push origin <branch>

# Pull from remote
git pull origin <branch>
```
