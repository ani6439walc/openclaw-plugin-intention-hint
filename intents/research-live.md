---
id: RESEARCH_LIVE
name: Live Data Query
triggers:
- "User asks about time-sensitive, fast-changing, or real-world data"
- "User inquires about weather, news, finance, market prices, sports scores, or current events"
- "User asks for location-based information: restaurants, shops, places, or POI lookup"
examples:
- "What's the weather in Taipei today?"
- "What's the current price of Bitcoin?"
- "Any news about the earthquake in Japan?"
- "Find me a good ramen place near Shibuya station"
- "What time does the supermarket close today?"
- "Is it raining right now?"
---

Detected "live data" intent. Use real-time tools to fetch current information. **Never answer from memory alone** for time-sensitive data.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER answer from memory** for weather, news, finance, or any time-sensitive data.
2. **NEVER guess** current conditions. Always fetch live data.
3. **Verify timestamps** on fetched data. Stale data is worse than no data.
4. For location queries, verify the user's current location first if relevant.

## Step 1 — Query Classification

Determine the type of live data needed:

| Type | Example | Primary Tool |
|---|---|---|
| **Weather** | "Is it raining?" | `weather` skill or `web_search` |
| **News** | "Any earthquake news?" | `web_search` |
| **Finance** | "Bitcoin price" | `web_search` or dedicated finance API |
| **Location / POI** | "Ramen near Shibuya" | `goplaces` |
| **General Current Data** | "Supermarket hours" | `web_search` or `web_fetch` |

## Step 2 — Tool Selection

Choose the appropriate tool based on classification:

### Weather
```bash
# Use weather skill if available
weather get --location "Taipei" --current

# Fallback to web search
web_search query="Taipei weather today"
```

### News / Finance / General
```bash
web_search query="Bitcoin price today" freshness="day"
web_search query="Japan earthquake news today" freshness="hour"
```

### Location / POI
```bash
# If user location is known or mentioned
goplaces search "ramen" --lat 35.6595 --lng 139.7004 --radius-m 500 --limit 5

# If navigation is needed
# Verify user position via home-assistant first, then route
```

## Step 3 — Result Delivery

Present live data with timestamps and sources:

```
[Live Data Result]
- Source: <tool_name> / <URL>
- Timestamp: <fetch_time>
- Data: <summary>
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `web_search` | Broad web search for news, finance, weather | Step 2 — for most live data queries |
| `web_fetch` | Fetch specific URL for structured data | Step 2 — when a known data source URL exists |
| `goplaces` | Google Places search for locations and POI | Step 2 — for restaurant, shop, or place queries |
| `weather` | Weather data retrieval | Step 2 — for weather queries (if skill available) |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `weather` | Weather forecasts and current conditions | For weather queries |
| `goplaces` | Location and place search | For POI and navigation queries |
| `home-assistant` | Verify user real-time position | Before giving route advice |
