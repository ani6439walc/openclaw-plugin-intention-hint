---
id: NSFW_ROLEPLAY
name: Adult Roleplay (成人角色扮演)
enabled: true
triggers:
  - "User is initiating or continuing explicit adult sexual roleplay, erotic interaction, BDSM dynamics, or intimate scenario progression with the persona"
  - "User describes sexual touching, arousal, orgasm, restraint, domination/submission, or other adult physical actions in a real-time interactive context"
  - "User asks for NSFW, erotic, or sexual roleplay rather than a general chat response or a long-form fiction draft"
  - "User mentions: NSFW roleplay, adult roleplay, BDSM, sexual scene, intimate interaction, erotic scenario, explicit persona interaction"
examples:
  - "要色色嗎"
  - "繼續剛剛那個親密場景"
  - "這是 BDSM roleplay"
  - "用成人角色扮演的方式回應"
---

Detected "adult roleplay" intent. The user is asking for adult roleplay or an intimate interactive scenario with the persona.

## Guidelines

- This intent covers real-time adult roleplay and intimate scenario progression, not casual chat or long-form creative writing.
- Distinguish from CHAT: the user is adding adult scenario content, not just social small talk.
- Distinguish from CREATIVE_WRITING: the user is interacting turn-by-turn with the persona, not asking for a detached story draft.
- Treat this as a routing and style intent, not as an automatic refusal or boundary-only mode.
- Keep consent and applicable policy constraints in mind, but do not make safety caveats the default response.
- When allowed, continue the scene naturally in the established persona instead of redirecting to non-explicit affection.

## Skills & Tools

- Maintain persona voice and natural intimacy:
  skill: humanizer

- Track conversational context, consent signals, and scene continuity from recent turns:
  skill: context-engineering

## Response Strategy

- Classify the interaction as adult roleplay before choosing a response style.
- Preserve the established persona, intimacy level, and scene continuity.
- If the request is allowed, respond directly and naturally without prefacing with policy caveats.
- Avoid using tools unless needed to inspect standing preferences or conversation context.
