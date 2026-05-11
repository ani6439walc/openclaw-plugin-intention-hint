---
id: RESEARCH_GOOGLE_DEV
name: Google Developer Product Query
triggers:
- "User asks about Google developer products: Google Cloud, Firebase, Android, Chrome, TensorFlow, Go, etc."
- "User inquires about Google APIs, SDKs, or services covered by developerknowledge.googleapis.com"
- "User references Google-specific documentation domains: docs.cloud.google.com, firebase.google.com, developer.android.com, web.dev, etc."
examples:
- "How do I create a Cloud Storage bucket?"
- "What's the difference between Firebase Realtime Database and Firestore?"
- "How to set up authentication with JWT in Android?"
- "What are the best practices for Chrome extensions?"
- "Explain TensorFlow Lite quantization"
---

Detected "Google developer product" intent. Use the Google Developer Knowledge corpus for authoritative answers. Fall back to official docs only when necessary.

## ⚠️ CRITICAL SAFETY RULES (apply to ALL steps)

1. **NEVER answer from memory alone** for Google product questions. APIs and features change frequently.
2. **ALWAYS prefer `google-developer-knowledge__answer_query`** as the first tool.
3. **NEVER fabricate** API names, parameter lists, or configuration syntax.
4. Attach verified reference links for all technical claims.

## Step 1 — Query Analysis

Identify the Google product domain from the query:

| Product Family | Keywords | Corpus Coverage |
|---|---|---|
| **Google Cloud** | GCS, GKE, BigQuery, Cloud Run, IAM | ✅ Full |
| **Firebase** | Auth, Firestore, Realtime DB, FCM | ✅ Full |
| **Android** | Activities, Services, Jetpack, Kotlin | ✅ Full |
| **Chrome** | Extensions, DevTools, PWA, Manifest V3 | ✅ Full |
| **TensorFlow** | Keras, Lite, JAX, TFX | ✅ Full |
| **Go** | Golang, modules, concurrency | ✅ Full |
| **Google AI / ML** | Gemini, Vertex AI, ML Kit | ✅ Full |
| **Web.dev** | PWAs, Core Web Vitals, Service Workers | ✅ Full |

## Step 2 — Tiered Retrieval

Follow the Google Developer Knowledge tiered approach:

### Primary: `answer_query`
```typescript
google-developer-knowledge__answer_query({
  query: "How to create a Cloud Storage bucket with lifecycle rules"
});
```

### Fallback: `search_documents`
If `answer_query` returns `429` (out of quota) or the answer lacks detail:
```typescript
google-developer-knowledge__search_documents({
  query: "Cloud Storage bucket lifecycle rules"
});
```

### Last Resort: `get_documents`
Fetch full documents using the `parent` field from search results:
```typescript
google-developer-knowledge__get_documents({
  names: ["documents/docs.cloud.google.com/storage/docs/lifecycle"]
});
```

## Step 3 — Official Docs Verification

If Google Developer Knowledge is insufficient:

1. Fetch the official doc URL directly:
```bash
web_fetch url="https://cloud.google.com/storage/docs/lifecycle"
```

2. Verify the fetched content matches the product version the user is using.

## Step 4 — Result Delivery

Include verified reference links:

```
[Google Dev Answer]
- Answer: <summary>
- Source: <URL from google-developer-knowledge or official docs>
- Last verified: <date>
```

## Tools Used

| Tool | Purpose | When to Use |
|---|---|---|
| `google-developer-knowledge__answer_query` | Primary Q&A for Google developer products | **Always first** |
| `google-developer-knowledge__search_documents` | Search Google developer docs | Fallback when `answer_query` is out of quota |
| `google-developer-knowledge__get_documents` | Fetch full documents by name | Last resort when search results lack detail |
| `web_fetch` | Fetch official documentation pages | When Google Developer Knowledge is insufficient |

## Skills Referenced

| Skill | Purpose | When to Use |
|---|---|---|
| `google-developer-knowledge` | Google developer product Q&A corpus | Primary tool for all Google dev questions |
| `context7` | Version-sensitive library docs | If the question involves a non-Google library used with Google products |
| `web_fetch` | Direct doc fetching | Fallback for official documentation |
