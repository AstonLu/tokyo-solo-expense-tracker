# AI Project Core — Tokyo Solo Expense Capture

## Purpose

A mobile-first **solo** travel expense capture MVP. Validate the vertical slice:
Telegram image + text → AI OCR/vision → Google Sheets → mobile dashboard.

**Not** a full travel app. No login, no multi-user, no accounting engine, no Supabase,
no multi-trip management.

## Core flow

```
Telegram photo (+ optional caption)        ← primary input
        │   (plain text note also accepted ← secondary)
        ▼
/api/telegram/webhook  (grammy; verifies secret + allow-listed chat id)
        ▼
lib/ai.ts  extractExpense()  → structured JSON + raw response
        ▼
lib/sheets.ts  appendExpense()  → Google Sheets row (source of truth)
        ▼
/api/expenses  →  components/Dashboard.tsx
```

## Extracted fields (AI)

`transaction_date, merchant, amount, currency, category, payment_method, location,
ai_summary, confidence_score, needs_review`

Plus from Telegram, not the model: `original_text_context` (caption/text),
`image_file_reference` (file_id), and `raw_ai_response` (audit).

## Domain rules

- Default currency **JPY**.
- `category` ∈ { 餐飲, 交通, 購物, 住宿, 門票, 其他 }.
- **needs_review = TRUE** when amount/currency/merchant uncertain or confidence
  < `CONFIDENCE_REVIEW_THRESHOLD` (`lib/types.ts`). Enforced in `lib/ai.ts`, not trusted
  blindly from the model.
- Low-confidence rows are **still written** — never silently dropped.
- Dedup on `telegram_message_id`.
- Image bytes are **not stored** — only the `file_id` reference.

## Tech stack

Next.js 16 (App Router, TS) · Tailwind v4 · grammy · provider-agnostic AI
(`lib/ai.ts`, default Groq vision, free tier) · Google Sheets (`googleapis` service account).

## Scope guards

- No login / multi-user / Supabase / desktop-first / voice / multi-trip.
- Keep `lib/ai.ts` as the only place that imports an AI SDK (swappable seam).
- Google Sheets is the single source of truth — don't add a parallel store.

## Key files

| File | Purpose |
|------|---------|
| `lib/types.ts` | Schema types, category list, review threshold |
| `lib/ai.ts` | Provider-agnostic vision/OCR extraction |
| `lib/sheets.ts` | Sheets read/write/dedup/summary |
| `lib/telegram.ts` | grammy handlers (photo primary, text secondary) |
| `app/api/telegram/webhook/route.ts` | Webhook endpoint |
| `app/api/expenses/route.ts` | Dashboard data API |
| `components/Dashboard.tsx` | Mobile dashboard |
| `scripts/register-webhook.ts` | Telegram setWebhook |
