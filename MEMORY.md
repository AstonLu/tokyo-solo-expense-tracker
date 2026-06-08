# MEMORY.md — Tokyo Solo Expense Capture

Current baseline for AI agents. Read with `docs/ai/HANDOVER.md`.

---

## Product (current)

Solo travel expense capture. Send a Telegram **photo** (receipt / payment screenshot /
paper invoice) with optional **text context** → AI vision extracts → Google Sheets →
mobile dashboard. Image-first; plain text is a secondary path.

> Note: an earlier session built an Aston/Amy **split** version. The 2026-06-09 respec
> removed split/payer and pivoted to this solo OCR-first schema. Do not reintroduce
> split unless explicitly asked.

## Architecture

```
Telegram (image + caption)
  → /api/telegram/webhook  (grammy, secret + chat-id guarded)
  → lib/ai.ts              (provider-agnostic vision/OCR; default Gemini)
  → lib/sheets.ts          (append to Google Sheets — source of truth)
  → /api/expenses → /dashboard (components/Dashboard.tsx)
```

## Implemented

- [x] `lib/types.ts` — Expense (17-field schema), ExtractedExpense, DashboardSummary
- [x] `lib/ai.ts` — provider-agnostic `extractExpense()`; Gemini impl; keeps raw response; enforces needs_review
- [x] `lib/sheets.ts` — ensureHeaders, appendExpense, getAllExpenses, isDuplicate, computeSummary
- [x] `lib/categories.ts` — 餐飲 交通 購物 住宿 門票 其他 (+emoji, inferCategory helper)
- [x] `lib/telegram.ts` — photo handler (primary), text handler, /start, dedup, allow-list
- [x] `app/api/telegram/webhook/route.ts` — secret-verified webhook
- [x] `app/api/expenses/route.ts` — transactions + summary; clear error on missing creds
- [x] `components/Dashboard.tsx` — total / by-currency / by-category / needs-review / recent (expandable) + loading/empty/error
- [x] `scripts/register-webhook.ts` — Telegram setWebhook
- [x] README (full setup), docs/ai/DESIGN_TASTE_GUIDE.md
- [x] typecheck + lint + build all pass

## Pending setup (needs your credentials)

1. Telegram bot via @BotFather → `TELEGRAM_BOT_TOKEN`
2. Your chat id via @userinfobot → `TELEGRAM_ALLOWED_CHAT_IDS`
3. AI key (Gemini) → `AI_PROVIDER_API_KEY` (+ `AI_MODEL`)
4. Google Sheet with `expenses` tab → `GOOGLE_SHEETS_ID`
5. GCP service account + share sheet → `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
6. `cp .env.local.example .env.local`, fill in
7. Deploy / ngrok → `WEBHOOK_BASE_URL` → `npm run register-webhook`

## Schema — Google Sheets tab `expenses` (A:Q)

id · created_at · source · telegram_message_id · transaction_date · merchant ·
amount · currency · category · payment_method · location · original_text_context ·
ai_summary · confidence_score · needs_review · image_file_reference · raw_ai_response

## Key decisions

- **Provider-agnostic AI** via `AI_PROVIDER_API_KEY` / `AI_MODEL`; swap by editing `lib/ai.ts` only
- **Google Sheets** as single source of truth (no DB, no Supabase)
- **needs_review enforced in code** (`lib/ai.ts normalize`) — low-confidence rows are written, never dropped
- **Image not stored** — only Telegram `file_id` kept as `image_file_reference`
- **Apps Script alternative removed** in this respec (it carried the old split schema)

## Env vars required (names only)

```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_ALLOWED_CHAT_IDS
AI_PROVIDER_API_KEY
AI_MODEL
GOOGLE_SHEETS_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
WEBHOOK_BASE_URL
```
