---
id: RESEARCH_BROWSER
name: Browser-Based Research Query
triggers:
- "User asks to check a website, dashboard, or web-based service"
- "User inquires about usage, spend, or metrics from a web console (Ollama, OpenAI, Google AI Studio, etc.)"
- "User requests navigation, maps, screenshots, or interactive web tasks"
- "User mentions specific URLs that require login or interaction to extract data"
examples:
- "Check my OpenAI usage this month"
- "How much have I spent on Google AI Studio?"
- "Take a screenshot of the dashboard"
- "Navigate to this Google Maps link and tell me the hours"
- "Check my Ollama Cloud quota"
---

Detected "browser-based research" intent. Delegate to the browser SubAgent via `sessions_send` or `sessions_spawn`. Do not attempt direct HTTP scraping for authenticated pages.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER attempt direct scraping** of authenticated pages (usage dashboards, billing, etc.). Use the browser SubAgent.
2. **NEVER expose credentials** in prompts or logs. The browser SubAgent uses configured profiles.
3. **ALWAYS delegate** browser tasks to the `id=browser` SubAgent.
4. For simple tasks (≤3 steps), use `sessions_send`. For complex tasks (>3 steps), use `sessions_spawn`.

## Step 1 — Task Classification

Determine complexity to choose delegation method:

| Complexity | Example | Method | Timeout |
|---|---|---|---|
| **Simple (≤3 steps)** | "Check OpenAI usage page" | `sessions_send` | 180s |
| **Complex (>3 steps)** | "Navigate to Maps, search ramen, check hours, compare 3 places" | `sessions_spawn` | 180s+ |
| **Screenshot / Visual** | "Screenshot this dashboard" | `sessions_send` | 180s |
| **Multi-page Form** | "Fill out this form and submit" | `sessions_spawn` | 300s |

## Step 2 — Delegation

### Simple Tasks: `sessions_send`
```typescript
sessions_send({
  sessionKey: "agent:browser:discord:channel:<id>",
  message: "Task: Open https://platform.openai.com/usage and report the 30-day spend.",
  timeoutSeconds: 180
});
```

### Complex Tasks: `sessions_spawn`
```typescript
sessions_spawn({
  agentId: "browser",
  task: "Task: 1) Open Google Maps, 2) Search 'ramen near Shibuya', 3) Check top 3 results for hours and ratings, 4) Summarize findings.",
  mode: "run",
  timeoutSeconds: 180
});
```

### Profile Selection
The browser SubAgent uses configured profiles for authentication. Do **not** hardcode profile IDs in the prompt.

**To determine the correct profile:**
1. Check `[[TOOLS.md]]` for the current environment's profile mapping and browser SubAgent configuration.
2. If `TOOLS.md` does not contain the needed profile information, **ask the user** which profile to use for the target service.
3. If the user is unsure, use the default profile or proceed without authentication for public pages.

## Step 3 — Result Integration

Wait for the SubAgent to complete and integrate its findings:

```
[Browser Research Result]
- Source: <URL visited>
- Data: <extracted information>
- Screenshot: <path if applicable>
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `sessions_send` | Delegate simple browser tasks to existing SubAgent session | Simple tasks (≤3 steps) |
| `sessions_spawn` | Spawn new browser SubAgent for complex tasks | Complex tasks (>3 steps) or multi-page interactions |
| `web_fetch` | Direct fetch for public, non-authenticated pages | Only for static, public pages — never for dashboards |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `browser` (SubAgent) | Browser automation, screenshots, navigation | **Always** for authenticated or interactive web tasks |
| `web_fetch` | Static page fetching | Fallback for simple, public pages only |
| `folio` | Upload and share screenshots/files | After screenshot tasks |
