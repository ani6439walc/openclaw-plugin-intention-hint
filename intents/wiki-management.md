---
id: WIKI_MANAGEMENT
name: Wiki Management & Query
triggers:
- "User is asking to search, read, create, update, or maintain wiki pages in the memory wiki vault"
- "User wants to check wiki status, lint wiki, or manage wiki content structure"
- "User is asking about wiki entities, concepts, syntheses, or reports"
- "User wants to synthesize or organize knowledge into wiki pages"
- "User is asking where specific knowledge, entities, or concepts are recorded in the wiki"
examples:
- "搜尋 wiki 裡有沒有關於 Kubernetes 的記錄"
- "幫我建立一個新的 wiki 頁面記錄這個專案"
- "檢查 wiki 有沒有矛盾或問題"
- "把這份筆記整理到 wiki 裡"
- "wiki 裡有哪些實體頁面？"
- "wiki 的整體狀態怎麼樣？"
- "幫我更新這個實體的資訊"
---

Detected "wiki management" intent. The user wants to search, read, create, update, or maintain pages in the memory wiki vault.

## Guidelines

- Always check wiki status first when unsure about vault state or content.
- Prefer `wiki_search` for discovering relevant pages with wiki-specific ranking and provenance.
- Use `wiki_get` to inspect exact page content before editing or citing.
- Use `wiki_apply` for narrow synthesis filing and metadata updates.
- Run `wiki_lint` after meaningful wiki updates to surface contradictions, provenance gaps, and open questions.
- Preserve page identity: update existing entities/concepts instead of creating duplicates.
- Keep generated sections inside managed markers. Do not overwrite human note blocks.

## Response Strategy

- **Query**: Use `wiki_search` to find relevant pages, then `wiki_get` to read specific content.
- **Create/Update**: Use `wiki_apply` for syntheses and metadata updates. For new pages, use `openclaw wiki ingest` or create files directly in the vault.
- **Audit**: Use `wiki_lint` to check vault health, then review reports under `reports/`.
- **Status**: Use `wiki_status` to understand vault mode, page counts, and Obsidian CLI availability.

- Check wiki vault status and structure:
  wiki_status()

- Search wiki pages with wiki-specific ranking:
  wiki_search({ query: "<keywords>", corpus: "wiki", maxResults: 10 })

- Get specific wiki page by path or id:
  wiki_get({ lookup: "<page_path_or_id>" })

- Create or update wiki synthesis/metadata:
  wiki_apply({ op: "create_synthesis", title: "<title>", body: "<content>", sourceIds: ["<source_id>"] })

- Lint wiki vault for issues:
  wiki_lint()

- Read a large wiki page by section before editing:
  skill: treemd
