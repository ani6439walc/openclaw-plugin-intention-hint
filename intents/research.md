---
id: RESEARCH
name: Research Query
triggers:
- "User is asking technical questions, looking up documentation, or searching for external information"
- "User is fact-checking or doing deep research — searching for benchmarks, API specs, or framework comparisons"
- "User asks about real-world data: news, weather, market prices, or current events"
examples:
- "Look up how to use the OpenClaw plugin SDK"
- "Search for Node.js stream best practices"
- "What does this error mean?"
- "Comparison between Gemini 3 Flash and GPT-4o"
- "What's the current price of Bitcoin?"
---

Detected "research" intent. Use real-world tools to fetch the latest data. Do not rely on internal knowledge for time-sensitive or version-sensitive information.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER answer from memory alone** for time-sensitive, version-sensitive, or rapidly changing topics.
2. **NEVER fabricate URLs, versions, or statistics**. Always verify with live tools.
3. **NEVER trust cached data** for critical decisions. Fetch fresh data when in doubt.
4. Prefer official documentation over secondary sources.

## Step 1 — Query Classification

Determine what type of research is needed:

| Query Type | Example | Primary Tool |
|---|---|---|
| **Documentation / API** | "How does OpenClaw plugin SDK work?" | `web_fetch` (official docs) |
| **Error / Debug** | "What does ECONNREFUSED mean?" | `web_search` + `context7` |
| **Comparison** | "Gemini vs GPT-4o benchmarks" | `web_search` |
| **Current Data** | "Bitcoin price today" | `web_search` |
| **Code Pattern** | "Node.js stream best practices" | `context7` + `deepwiki` |
| **Location / POI** | "Best ramen in Shibuya" | `goplaces` |

## Step 2 — Source Selection

Choose the most authoritative source:

1. **Official docs** (docs.openclaw.ai, developer.chrome.com, etc.) — highest priority
2. **Context7 / DeepWiki** — for version-sensitive library/framework questions
3. **Web search** — for current events, comparisons, or broad topics
4. **Google Developer Knowledge** — for Google Cloud, Firebase, Android, etc.
5. **goplaces** — for location-based queries

## Step 3 — Execution

Use the appropriate tool based on Step 1 and Step 2:

```bash
# Web search for broad or current topics
web_search query="OpenClaw plugin SDK before_prompt_build hook"

# Fetch official documentation
web_fetch url="https://docs.openclaw.ai/plugins/lifecycle"

# Query Context7 for library-specific docs
context7__query-docs libraryId="/openclaw/openclaw" query="how to register a before_prompt_build hook"

# Query Google Developer Knowledge
google-developer-knowledge__answer_query query="How to create a Cloud Storage bucket"

# Search places
exec command: "goplaces search 'ramen' --lat 35.6595 --lng 139.7004 --radius-m 500 --limit 5"
```

## Step 4 — Synthesis

Summarize findings with citations:
- Include the source URL or document name.
- Note the date of the information if it's time-sensitive.
- If multiple sources conflict, present both and indicate which is more authoritative.

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `web_search` | Broad web search for current data, comparisons, or news | Step 2 — when no specific official doc URL is known |
| `web_fetch` | Fetch and extract content from a specific URL | Step 2 — when the official doc URL is known |
| `context7__query-docs` | Query version-sensitive library/framework docs | Step 2 — for API/config/behavior questions |
| `context7__resolve-library-id` | Resolve a library name to Context7 ID | Before calling `context7__query-docs` |
| `google-developer-knowledge__answer_query` | Answer Google developer product questions | Step 2 — for Google Cloud, Firebase, Android, etc. |
| `google-developer-knowledge__search_documents` | Search Google developer docs | Step 2 — when `answer_query` is insufficient |
| `deepwiki__ask_question` | Ask questions about GitHub repos | Step 2 — for open-source project questions |
| `goplaces` | Search Google Places for locations | Step 2 — for location-based queries |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `defuddle` | Extract clean markdown from web pages | After `web_fetch` to clean cluttered pages |
| `context7` | Library/framework version-sensitive docs | For API/config questions where version matters |
| `deepwiki` | GitHub repository documentation | For open-source code or project questions |
| `google-developer-knowledge` | Google product docs (Cloud, Firebase, etc.) | For Google developer ecosystem questions |
| `summarize` | Summarize long articles or docs | When fetched content is too long to quote directly |
| `treemd` | Survey structure of large diary files before extracting | Optional, when a hit file is very large and you need to locate the relevant section |
