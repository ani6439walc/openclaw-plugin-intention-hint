---
id: RESEARCH_LIBRARY
name: Library / Framework / API Docs Query
triggers:
- "User asks about third-party libraries, frameworks, or APIs (non-Google)"
- "User inquires about version-sensitive documentation, configuration, or behavior"
- "User references specific package names, module versions, or dependency files"
examples:
- "How does OpenClaw plugin SDK's before_prompt_build hook work?"
- "What's new in React 19?"
- "How to configure Tailwind CSS v4?"
- "What does this error from Prisma mean?"
- "How to use the new Next.js App Router?"
---

Detected "library/framework" intent. Use `context7` for version-sensitive docs. Fall back to official docs or web search. Never give zero-shot answers about open-source behavior.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER give zero-shot answers** about open-source code, config, or behavior when the answer may vary by version.
2. **ALWAYS check version first**. Read `package.json`, `Cargo.toml`, `go.mod`, or lock files to confirm the installed version.
3. **NEVER fabricate** API signatures, configuration options, or default values.
4. Attach verified reference links for all technical claims.

## Step 1 — Version Pinning (T2)

Before searching docs, confirm the local version:

```bash
# Read dependency files to pin version
cat package.json | jq '.dependencies["library-name"]'
cat package-lock.json | jq '.packages["node_modules/library-name"].version'
cat go.mod | grep "library-name"
cat Cargo.lock | grep -A 1 'name = "library-name"'
```

If the user mentions a specific version, use that. Otherwise, use the version from lock files.

## Step 2 — Docs Retrieval (T1)

### Primary: Context7
Resolve the library ID and query docs:
```typescript
// Step 2a: Resolve library ID
context7__resolve-library-id({
  libraryName: "Next.js",
  query: "How to use App Router"
});

// Step 2b: Query docs with resolved ID
context7__query-docs({
  libraryId: "/vercel/next.js",
  query: "App Router migration guide"
});
```

### Fallback: Official Docs via Web
If Context7 is unavailable or insufficient:
```bash
web_fetch url="https://nextjs.org/docs/app"
```

## Step 3 — Source Dive (T3)

Only for undocumented behavior or suspected bugs:

```bash
# Use cx skill for semantic code navigation
cx overview --path node_modules/library-name/
cx definition --symbol "functionName" --path node_modules/library-name/src/
```

**Reserve T3 for**:
- Suspected library bugs
- Undocumented internal behavior
- Custom patches or forks

## Step 4 — Result Delivery

Include version info and sources:

```
[Library Docs Answer]
- Library: <name> @ <version>
- Answer: <summary>
- Source: <Context7 URL or official doc URL>
- Verification: T1 (docs) / T2 (version pinned) / T3 (source dive)
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `context7__resolve-library-id` | Resolve library name to Context7 ID | Step 2 — before querying docs |
| `context7__query-docs` | Query version-sensitive library documentation | Step 2 — primary docs retrieval |
| `web_fetch` | Fetch official documentation pages | Fallback when Context7 is unavailable |
| `read` / `exec` (cat/grep) | Read local dependency/lock files | Step 1 — version pinning |
| `cx` | Semantic code navigation in local source | Step 3 — source dive for undocumented behavior |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `context7` | Version-sensitive library docs | **Always first** for library/framework questions |
| `cx` | Semantic code navigation | T3 — source dive for bugs or undocumented behavior |
| `web_fetch` | Direct doc fetching | Fallback for official documentation |
| `treemd` | Survey structure of large doc files | When a doc page is very long |
