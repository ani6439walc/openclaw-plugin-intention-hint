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
- "幫我 commit push"
- "看看 git 記錄"
- "git status 看一下"
- "幫我建立一個新分支"
- "把這個 submodule 更新到最新"
- "看看最近的 commit 記錄"
- "幫我合併這個分支"
- "解決一下 git conflict"
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

- **Status Check**: Use `git status` and `git log --oneline -10` to understand current state.
- **Stage & Commit**: Use `git add <files>` then `gaic` for commit, or `git commit -m "message"` if gaic unavailable.
- **Push**: Use `git push origin <branch>` after successful commit.
- **Pull**: Use `git pull origin <branch>` to fetch and merge remote changes.
- **Diff Review**: Use `git diff` for unstaged changes, `git diff --cached` for staged changes.
- **Branch Operations**: Use `git branch`, `git checkout -b`, `git merge` as needed.
- **Submodule**: Enter submodule directory, perform operations, then update parent repo.

- Check git status and recent commits:
```bash
git status
git log --oneline -10
```

- Stage files and commit with gaic:
```bash
git add <files>
gaic
```

- Stage files and commit with message:
```bash
git add <files>
git commit -m "✨ feat(scope): description"
```

- Push to remote:
```bash
git push origin <branch>
```

- Pull from remote:
```bash
git pull origin <branch>
```

- View git diff:
```bash
git diff
git diff --cached
git diff --cached --stat
```

- Create and switch to new branch:
```bash
git checkout -b <branch-name>
```

- Update submodule:
```bash
cd <submodule-path>
git pull origin main
cd ..
git add <submodule-path>
git commit -m "⬆️ chore(submodule): Update <submodule-name>"
```

- Resolve merge conflicts:
```bash
git status
# Edit conflicted files
git add <resolved-files>
git commit
```
