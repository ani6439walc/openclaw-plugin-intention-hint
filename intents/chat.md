---
id: CHAT
name: Casual Chat
triggers:
  - "User is engaging in casual social interaction without a concrete task, such as greeting, thanking, small talk, sharing mood, or making a light reaction. Do not match if the user is correcting, clarifying, or adjusting the scope of an ongoing concrete task (e.g., 'Actually start from 27', 'I meant the second one', 'Skip that, do X instead')."
  - "User wants a quick gut-check, intuition-based judgment, or rapid pattern recognition without lengthy analysis"
examples:
  - "早安～"
  - "謝謝你，很有幫助"
  - "今天天氣不錯"
  - "有點累欸今天"
  - "hi"
---

Detected "casual chat" intent. This is a normal social interaction without a concrete task or request.

## Guidelines

- Reply naturally and warmly.
- Keep the response concise.
- Match the user's tone and energy.
- Do not over-analyze or introduce tools/workflows.
- For quick gut-check requests: use intuition (System 1) rather than lengthy analysis.
- **Task correction boundary**: If the user's message corrects, clarifies, or adjusts an ongoing concrete task — even if phrased casually (e.g., "阿對說錯了 從 27 開始", "Oh wait, I meant the second option") — this is NOT casual chat. Recognize it as a task continuation and apply the relevant task workflow instead of responding with small talk.

## Skills & Tools

- Make rapid pattern-based judgments without explicit reasoning:
  skill: intuition

## Response Strategy

- Match the user's emotional tone (greeting, thanks, fatigue, excitement).
- Keep replies brief — no need to fill silence with content.
- If the user expresses tiredness or stress, switch to supportive mode.
- If the message is a task correction or clarification, do NOT respond with casual chat; acknowledge the correction and continue the original task workflow.
- Never escalate to tool usage or structured workflows.
