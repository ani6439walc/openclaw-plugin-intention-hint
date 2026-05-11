---
id: TYPO
name: Typo Correction
triggers:
- "User's input has obvious typos, garbled text, or truncated/distorted text that makes the meaning unclear"
- "User's message appears to be a typing error, pinyin mistake, or keyboard mistouch producing gibberish"
examples:
- "Look up how to use opencaw"
- "What was that thing I told you about yesterday"
- "Why does this bug keep 出獻 (appearing)"
- "wj/6u ek72;3042k7"
---

Detected "typo" intent. The user's message contains garbled, misspelled, or unclear text. Re-interpret the corrected intent before proceeding.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER mock or embarrass the user** for typos. Treat it as a normal communication friction.
2. **NEVER guess wildly** when the typo is too ambiguous. Ask for clarification if multiple interpretations exist.
3. **Preserve the user's original meaning** as closely as possible when correcting.
4. If the typo is in a technical keyword (function name, API, variable), double-check the corrected form against official docs.

## Step 1 — Typo Classification

Identify the type of typo to determine correction strategy:

| Typo Type | Example | Correction Strategy |
|---|---|---|
| **Phonetic / Pinyin** | "opencaw" → "openclaw" | Map to closest phonetic match in known vocabulary |
| **Keyboard Adjacent** | "ek72" → "help" | Check QWERTY neighbor keys |
| **Garbled / Random** | "wj/6u" → ??? | Too ambiguous — ask for clarification |
| **Mixed Language** | "出獻" → "出現" | Context-aware character substitution |
| **Truncated** | "3042k7" → (incomplete) | Ask user to complete the word/sentence |
| **Auto-correct Error** | "defiantly" → "definitely" | Common auto-correct trap detection |

## Step 2 — Correction & Intent Re-interpretation

1. **Generate 1-3 possible corrections** based on context and known vocabulary.
2. **Score each candidate** by:
   - Phonetic similarity
   - Keyboard distance
   - Contextual fit with recent conversation
   - Presence in project glossary or memory
3. **Pick the highest-confidence correction**.

**Example:**
```
User: "幫我查一下 opencaw 怎麼用"
→ Typo: "opencaw"
→ Candidates: "openclaw" (99%), "opencart" (1%)
→ Corrected: "幫我查一下 openclaw 怎麼用"
→ Re-interpreted intent: RESEARCH (OpenClaw plugin SDK)
```

## Step 3 — Handling Ambiguity

If the corrected text is still ambiguous (confidence < 70%):

```
"Did you mean (a) openclaw, (b) opencart, or (c) something else?"
```

If the typo is completely unrecoverable (garbled/random):

```
"Sorry, I couldn't quite understand that. Could you rephrase?"
```

## Step 4 — Proceed with Corrected Intent

After correction, route to the appropriate intent:
- "openclaw 怎麼用" → `RESEARCH`
- "昨天說的那個" → `MEMORY_RECENT`
- "這段 code 有沒有問題" → `CODE_REVIEW`

Do **not** mention the typo correction in the final response unless the user explicitly asks.

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| *(none)* | Typo correction is done via LLM reasoning | N/A |
| `memory_search` | Optional: check if the typo resembles a known entity | When the typo might be a known project name or term in memory |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| *(none)* | Typo correction requires no external skills | N/A |
