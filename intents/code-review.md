---
id: CODE_REVIEW
name: Code Review
triggers:
- "User is requesting code inspection, review, or optimization — checking for issues, reviewing a PR, asking for improvement suggestions"
- "User provides code snippets and asks for advice on bugs, refactoring, architecture, or performance"
examples:
- "Take a look at this code for any issues"
- "Review this PR please"
- "How should I refactor this function?"
- "What's the time complexity of this code?"
- "Can you spot the bug in this snippet?"
---

Detected "code review" intent. Analyze for correctness, edge cases, type safety, and adherence to project conventions. Focus on logic errors first, then style, then performance.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER assume correctness**. Always question the user's assumptions and test edge cases.
2. **NEVER ignore security risks**. Flag injection risks, unsafe defaults, and exposed secrets immediately.
3. If the code relies on external dependencies, check for known vulnerabilities (if tools allow).
4. Respect project conventions. If a `.eslintrc`, `pyproject.toml`, or similar config exists, follow it.

## Step 1 — Context Gathering

Before reviewing, gather relevant context:

1. **Language / Framework**: Identify from file extension or code structure.
2. **Project Conventions**: Check for config files (`.eslintrc`, `tsconfig.json`, `pyproject.toml`, etc.).
3. **Related Files**: If this is a PR or function change, check for:
   - Callers of this function
   - Tests that cover this code
   - Documentation that references it

## Step 2 — Review Checklist

Evaluate the code systematically:

### Priority 1: Correctness & Logic
- [ ] Does the code do what it claims?
- [ ] Are there off-by-one errors, null dereferences, or race conditions?
- [ ] Are all error paths handled?
- [ ] Are there infinite loops or unbounded recursion?

### Priority 2: Security & Safety
- [ ] Are user inputs sanitized?
- [ ] Are secrets or credentials hardcoded?
- [ ] Are there injection risks (SQL, command, XSS)?
- [ ] Are permissions checked appropriately?

### Priority 3: Style & Maintainability
- [ ] Are variable names descriptive?
- [ ] Are functions small and focused?
- [ ] Is there duplicated code that should be refactored?
- [ ] Are comments necessary and up-to-date?

### Priority 4: Performance
- [ ] Are there unnecessary allocations or I/O?
- [ ] Is the algorithmic complexity appropriate?
- [ ] Are there caching opportunities?

## Step 3 — Result Delivery

Present findings in order of priority:

```
[Code Review]
- 🔴 Critical: <logic or security issue>
- 🟡 Warning: <style or maintainability concern>
- 🟢 Suggestion: <performance or readability improvement>
- ✅ Good: <what the code does well>
```

If the code is correct and well-written, say so explicitly.

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `exec` (bash) | Run linters, type checkers, or tests | When the project has lint/test scripts and the user wants automated validation |
| `read` | Read related source files | When reviewing a function requires understanding its callers or dependencies |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `cx` | Semantic code navigation (symbols, definitions, references) | When tracing function calls or understanding project structure |
| `treemd` | Survey structure of large files before reviewing | When the file is very long and you need to locate relevant sections |
| `diffs` | Generate shareable diffs for suggested changes | When proposing concrete code modifications |
