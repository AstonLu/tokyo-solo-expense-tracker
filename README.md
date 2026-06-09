# 東京記帳 MVP — Tokyo Solo Expense Capture

Send a Telegram photo (receipt / payment screenshot / paper invoice) with optional
text context → AI vision extracts the expense → a row is written to Google Sheets →
a mobile-first web dashboard reads it back.

```
Telegram (image + caption)
        │
        ▼
/api/telegram/webhook  (grammy)
        │
        ▼
lib/ai.ts   AI vision / OCR → structured expense JSON
        │
        ▼
lib/sheets.ts  → append row to Google Sheets (source of truth)
        │
        ▼
/dashboard  reads /api/expenses → mobile dashboard
```

This is a deliberately small MVP. See [Known limitations](#known-mvp-limitations).

---

## Stack

| Layer | Tech |
|-------|------|
| App | Next.js 16 (App Router), TypeScript, Tailwind v4 |
| Bot | grammy webhook |
| AI | Provider-agnostic (`lib/ai.ts`); default Groq vision (free tier) |
| Storage | Google Sheets via service account |

---

## 1. Create the Telegram bot

1. Open Telegram, message **@BotFather** → `/newbot` → follow prompts.
2. Copy the **bot token** → `TELEGRAM_BOT_TOKEN`.
3. Message **@userinfobot** to get your numeric chat id → `TELEGRAM_ALLOWED_CHAT_IDS`
   (comma-separated; leave blank to allow everyone — not recommended).
4. Pick any random string for `TELEGRAM_WEBHOOK_SECRET` (used to verify webhook calls).

## 2. Set the webhook

The app exposes `POST /api/telegram/webhook`. After deploying (or starting ngrok):

```bash
# Fill .env.local first (see below), set WEBHOOK_BASE_URL to your public URL, then:
npm run register-webhook
```

This calls Telegram's `setWebhook` with your URL + secret. The script also prints
the current webhook info so you can confirm it registered.

Local testing without deploying:

```bash
npm run dev                 # terminal 1
npx ngrok http 3000         # terminal 2 → copy the https URL into WEBHOOK_BASE_URL
npm run register-webhook
```

## 3. Configure Google Sheets

1. Create a Google Sheet. Note the id from the URL:
   `https://docs.google.com/spreadsheets/d/`**`<GOOGLE_SHEETS_ID>`**`/edit`
2. Add a tab named exactly **`expenses`** (the app creates the header row on first write).
3. In [Google Cloud Console](https://console.cloud.google.com/):
   - Enable the **Google Sheets API**.
   - Create a **service account** → create a **JSON key** → download it.
   - Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
   - Copy `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` escapes).
4. **Share the Sheet** with the service account email, **Editor** access.

## 4. Configure environment variables

```bash
cp .env.local.example .env.local
# then fill in every value
```

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot auth |
| `TELEGRAM_WEBHOOK_SECRET` | Verifies inbound webhook requests |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Allow-list of chat ids (blank = all) |
| `GROQ_API_KEY` | Groq API key (free at console.groq.com/keys) |
| `AI_MODEL` | Vision model id (default `meta-llama/llama-4-scout-17b-16e-instruct`) |
| `GOOGLE_SHEETS_ID` | Target spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account identity |
| `GOOGLE_PRIVATE_KEY` | Service account key (`\n`-escaped) |
| `WEBHOOK_BASE_URL` | Public URL for webhook registration |

## 5. Run locally

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /dashboard
```

The dashboard reads from Google Sheets via `/api/expenses`. With credentials unset
it shows a clear error state rather than crashing.

## 6. Deploy

Deploy to **Vercel** (recommended — webhook needs a public HTTPS URL):

1. Import the repo in Vercel.
2. Add every variable from the table above in **Project → Settings → Environment Variables**.
3. Deploy, set `WEBHOOK_BASE_URL` to the production URL, run `npm run register-webhook`.

---

## Google Sheets schema (tab: `expenses`, columns A:Q)

| Col | Field | Notes |
|-----|-------|-------|
| A | `id` | UUID |
| B | `created_at` | ISO 8601 (server time) |
| C | `source` | `telegram_photo` / `telegram_text` |
| D | `telegram_message_id` | Dedup key |
| E | `transaction_date` | YYYY-MM-DD |
| F | `merchant` | |
| G | `amount` | Number |
| H | `currency` | Default JPY |
| I | `category` | 餐飲 / 交通 / 購物 / 住宿 / 門票 / 其他 |
| J | `payment_method` | e.g. 信用卡 / 現金 / IC卡 |
| K | `location` | e.g. Shibuya |
| L | `original_text_context` | The user's caption/text, verbatim |
| M | `ai_summary` | One-line AI description |
| N | `confidence_score` | 0–1 |
| O | `needs_review` | `TRUE` / `FALSE` |
| P | `image_file_reference` | Telegram `file_id` (image not stored) |
| Q | `raw_ai_response` | Raw model output, for auditing |

`needs_review` is set `TRUE` when amount/currency/merchant are uncertain or
confidence is below the threshold in `lib/types.ts`. Low-confidence rows are still
written — never silently dropped — and surfaced in the dashboard's **待確認** section.

---

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

---

## Known MVP limitations

- **Single user.** No login; access is gated only by `TELEGRAM_ALLOWED_CHAT_IDS`.
- **Reads all rows per request.** Fine for a short trip; not paginated.
- **Mixed-currency category totals** are shown in the primary (most-used) currency
  only — the per-currency section is the accurate multi-currency view.
- **No edit/delete in the UI** yet (planned — see `ROADMAP.md`). Correct mistakes
  directly in the Sheet.
- **Image is not stored** — only a Telegram `file_id` reference is kept.
- **One expense per message.** No multi-line receipts split into items.
