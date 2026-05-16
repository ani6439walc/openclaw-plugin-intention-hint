---
id: CODE_REVIEW
name: Code Review
triggers:
- "User is asking to inspect, debug, review, or improve code, such as checking for bugs, refactoring advice, architecture feedback, or performance issues"
examples:
- "幫我看看這段程式碼有沒有問題"
- "review 這個 PR"
- "這個 function 要怎麼重構比較好？"
- "這段 code 的時間複雜度是多少？"
- "幫我找出這個 snippet 的 bug"
---

Detected "code review" intent. The user wants code to be examined for problems or improvements.

## Guidelines

- Focus on correctness first.
- Also consider security, maintainability, and performance when relevant.
- Keep findings concrete, prioritized, and specific to the code shown.
- Do not inflate minor style issues above logic or safety issues.

## Response Strategy

- Identify the most important issue first.
- Explain why it matters.
- Suggest minimal, practical improvements.
- If the code looks good, say so clearly.

- Read larger code files or trace related definitions and references:
  skill: cx
- Read larger Markdown files:
  skill: treemd
- Show concrete change suggestions as diffs:
  skill: diffs

- Read related files when the review depends on surrounding context:
  read({ path: "<file>" })

- Run tests or linters when validation is needed:
```bash
<command>
```
