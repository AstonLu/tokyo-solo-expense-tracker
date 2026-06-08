# Durable Decisions

## 2026-06-09 — MVP rebuild session

### Gemini over Claude for LLM
- **Decision:** Use `@google/generative-ai` (Gemini 1.5 Flash) instead of `@anthropic-ai/sdk`.
- **Reason:** User preference. Gemini supports native JSON schema output (`responseMimeType: "application/json"`) which makes structured extraction cleaner.

### Google Sheets over SQLite
- **Decision:** Use `googleapis` + service account to read/write a Google Sheet instead of `better-sqlite3`.
- **Reason:** Portable (works on Vercel serverless), human-readable/editable, zero DB setup, easy to inspect mid-trip.
- **Revisit:** If migrating to multi-user, replace with Supabase.

### Next.js API route over Google Apps Script (primary)
- **Decision:** Use `/api/telegram/webhook` (Next.js) as primary ingestion path.
- **Reason:** Project already has Next.js infra; single Vercel deployment for both webhook + display.
- **Alternative:** `scripts/apps-script/webhook.gs` — fully functional, documented for teams that prefer zero-infra.

### grammy retained
- **Decision:** Keep `grammy` as the Telegram bot framework.
- **Reason:** Good TypeScript types for Telegram updates, webhook-native design.

### taste-skill: extracted not installed
- **Decision:** No CLI install of taste-skill. Extracted relevant content to `docs/ai/DESIGN_TASTE_GUIDE.md`.
- **Reason:** CLI install adds repo noise with skills not relevant to a data dashboard (landing page patterns, etc.).

### No image storage
- **Decision:** Photos are processed in memory only; extracted data is stored.
- **Reason:** Privacy, storage simplicity.

### Static `trip_id`
- **Decision:** `trip_id` is hardcoded as `tokyo_2d1n_mvp`.
- **Reason:** MVP scope is a single trip. Multi-trip is out of scope.
