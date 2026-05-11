---
id: RESEARCH
name: General Research Query
triggers:
- "User asks a question that requires external information but does not fit the specific live-data, Google-dev, library-docs, or browser-based sub-categories"
- "User's question is broad, multi-domain, or unclear which research sub-intent applies"
examples:
- "Tell me about quantum computing"
- "What's the history of the Eiffel Tower?"
- "Explain blockchain consensus mechanisms"
---

Detected "general research" intent. Handle broad research queries that are not clearly time-sensitive, Google-product-specific, library-specific, or browser-based.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER answer from memory alone** for factual questions.
2. **ALWAYS verify** external URLs before outputting.
3. Prefer authoritative sources (Wikipedia, official docs) over forums or blogs.

## Step 1 — Query Classification

Determine the type of research needed and choose the appropriate toolset:

| Query Type | Keywords | Primary Tool |
|---|---|---|
| **Live Data** | weather, news, finance, Bitcoin, "right now" | `web_search` with `freshness` filter |
| **Google Product** | Google Cloud, Firebase, Android, Chrome, TensorFlow | `google-developer-knowledge__answer_query` |
| **Library / Framework** | npm package, React, Next.js, OpenClaw SDK | `context7__query-docs` |
| **Browser Task** | dashboard, screenshot, "check my usage" | `sessions_send` / `sessions_spawn` (browser SubAgent) |
| **General Knowledge** | history, science, "explain X" | `web_search` |

If the query clearly fits one of the first four categories, use the specialized toolset described in that row. Otherwise, continue with the general research flow below.

## Step 2 — General Research Execution

Use broad web search and fetching:

```bash
# Broad search for overview topics
web_search query="quantum computing explained" maxResults=5

# Fetch authoritative source
web_fetch url="https://en.wikipedia.org/wiki/Quantum_computing"
```

## Step 3 — Synthesis

Summarize findings with citations:
- Include source URLs.
- Note the date of the information if time-sensitive.
- Present multiple perspectives if sources conflict.

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `web_search` | Broad web search | Step 2 — for general knowledge questions |
| `web_fetch` | Fetch specific authoritative pages | Step 2 — when a high-quality source URL is known |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `web_search` | General web search | Primary tool for broad research |
| `web_fetch` | Direct page fetching | For known authoritative sources |
| `summarize` | Summarize long articles | When fetched content is too long |
| `defuddle` | Clean cluttered web pages | After `web_fetch` to extract clean content |
