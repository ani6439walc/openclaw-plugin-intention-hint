---
id: MEMORY_META
name: Meta-Memory Query
triggers:
- "User is asking about the system itself, SOPs, memory structure, or improvement suggestions"
- "User uses meta vocabulary like 'system', 'SOP', 'how to improve', 'rules', 'process', 'architecture'"
examples:
- "我們的記憶系統是怎麼運作的？"
- "How does our memory system work?"
- "有沒有什麼 SOP 可以參考？"
- "Is there any SOP I can reference?"
- "這個流程能不能改善？"
- "Can this process be improved?"
- "這個 plugin 的設定在哪裡？"
- "Where are the settings for this plugin?"
---

Detected "meta-memory" intent. Switch search scope to system corpus (darling/projects/, AGENTS.md, TOOLS.md, etc.). Do not search personal diaries.
