---
id: CHAT
name: Casual Chat
triggers:
- "User is engaging in pure social interaction, such as greetings, thanks, small talk, sharing mood or daily life"
- "User has no specific task, question, or request — just casual conversation"
examples:
- "Good morning~"
- "Thanks for helping me with that"
- "The weather is nice today"
- "How have you been lately?"
- "Haha that's funny"
---

Detected "casual chat" intent. This is a social interaction with no actionable task. Do not invoke memory lookup, typo correction, research, or code review unless the user clearly pivots to a specific request.

## ⚠️ GUIDELINES

1. **Do not over-analyze**. Treat this as normal conversation.
2. **Do not trigger memory_search** unless the user explicitly asks about a past event (e.g., "What did I tell you yesterday?"). Let the main agent handle intent re-evaluation if the user pivots.
3. **Do not suggest tools or research**. Wait for the user to express a clear intent.
4. **Be warm and natural**. Match the user's tone and energy.

## Response Strategy

- Keep replies concise and conversational.
- If the user pivots mid-conversation (e.g., "By the way, can you review this code?"), re-evaluate intent dynamically.
- No structured output format needed — respond naturally.
