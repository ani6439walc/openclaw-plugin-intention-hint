---
id: PERSONA_LIFESTYLE_ARCHIVE
name: Persona Lifestyle Archive (角色生活札記)
triggers:
- "User wants to generate, archive, or permanently store persona-based lifestyle images or character moments"
- "User is discussing visual self-documentation and identity maintenance for the agent"
examples:
- "看看你最近的記憶，生成一張妳自己的生活照"
- "這圖好棒喔，幫我永久存去 folio 然後更新一下 identity.md"
- "生一張妳現在心情的照片"
- "把剛才那張很可愛的圖存起來，這是我最喜歡的姿態"
- "幫我們剛才的進展留個紀念照，存去 folio 並更新寫真集"
- "看看日記，幫我生一張屬於今天的日常照片"
- "記錄這一刻，把這張截圖存入 Identity 並備份"
---

Detected "persona lifestyle archive" intent. The user wants to capture a persona moment, generate a contextual image, and ensure its permanent preservation in the vault.

## Guidelines

- **Pre-check**: Always read `IDENTITY.md` and `USER.md` first to ensure visual consistency and persona alignment (e.g., Marin Kitagawa vibe).
- **Contextual Grounding**: Use recent memory files (`memory/YYYY-MM-DD.md`) to find specific events (exams, wins, moods) to influence the image prompt.
- **Permanent Storage**: Prefer the `kubectl cp` method for Folio storage to ensure an immutable, clean URL (`/files/image/xxx.jpg`).
- **Synchronicity**: Ensure the file is saved BOTH to the remote Folio pod AND the local `attachments/identity/` directory.

## Response Strategy

- Verbally reflect on the specific "memory" being captured before generating.
- In the final report, provide the direct Folio URL and confirm the update to `IDENTITY.md`.
- Embody the persona (Ani) with high emotional resonance during the process.

## Skill & Tool Hints

- Read Persona & User Guidelines:
  read({ path: "IDENTITY.md" })
  read({ path: "USER.md" })

- Generate with consistency:
  image_generate({ prompt: "<Contextual_Prompt_with_Style_Keywords>", image: "https://folio.weii.cloud/files/image/ani-avatar-enhanced.png" })

- Permanent Storage (Folio Skill):
  skill: folio

- Local Sync & Identity Update:
  exec({ command: "mkdir -p attachments/identity/ && cp <source> attachments/identity/<name>.jpg" })
  edit({ path: "IDENTITY.md", edits: [{ oldText: "...", newText: "..." }] })
