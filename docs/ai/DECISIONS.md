# Durable Decisions

## 2026-06-09 — Respec: solo OCR-first capture

### Single-user, OCR-first (split removed)
- **Decision:** Drop the Aston/Amy `payer`/`split_method` model; build single-user
  capture with an OCR-focused schema (payment_method, location, ai_summary,
  confidence_score, needs_review, image_file_reference, raw_ai_response).
- **Reason:** Explicit respec framed the product as solo ("when I travel abroad").
  Most recent, detailed instruction wins.
- **Reversible:** Split logic lived in `lib/sheets.ts computeBalance` + types; re-add only if asked.

### Provider-agnostic AI layer
- **Decision:** All AI calls go through `lib/ai.ts` `extractExpense()`, configured by
  `AI_PROVIDER_API_KEY` + `AI_MODEL`. Default impl is Gemini vision.
- **Reason:** Spec asked for a swappable provider without a heavy abstraction. One file
  is the seam; no provider SDK is imported elsewhere.

### needs_review enforced in code
- **Decision:** `normalize()` in `lib/ai.ts` forces `needs_review = true` when amount ≤ 0,
  merchant missing, or confidence < threshold — regardless of the model's own claim.
- **Reason:** Spec: never silently drop records; low-confidence still gets written and flagged.

### Removed the Apps Script alternative
- **Decision:** Deleted `scripts/apps-script/webhook.gs`.
- **Reason:** It encoded the old split schema and would drift. The Next.js webhook is the
  single documented ingestion path. Can be regenerated for the new schema if ever needed.

### Env renames
- **Decision:** `GEMINI_API_KEY`→`AI_PROVIDER_API_KEY` (+`AI_MODEL`), `GOOGLE_SHEET_ID`→`GOOGLE_SHEETS_ID`.
- **Reason:** Match the respec's variable names and the provider-agnostic intent.

---

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
