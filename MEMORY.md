# MEMORY.md — Tokyo Solo Expense Tracker

Current project state for AI agents. Read this alongside `docs/ai/HANDOVER.md`.

---

## Architecture (decided 2026-06-09)

```
Telegram message / photo
    ↓
Next.js API route  (/api/telegram/webhook)
    ↓
grammy parses the Telegram update
    ↓
Gemini 1.5 Flash  (text parse or vision OCR)
    ↓
Structured JSON  (merchant, amount, category, payer, split_method, …)
    ↓
Google Sheets  (append row via googleapis service account)
    ↓
Next.js dashboard reads  (/api/expenses → GET all rows)
```

**Alternative ingestion path:** `scripts/apps-script/webhook.gs` — a complete Google Apps Script
implementation that does the same thing without a Vercel deployment.

---

## Implemented features (as of 2026-06-09)

- [x] `lib/types.ts` — full schema types (payer, split_method, status, etc.)
- [x] `lib/categories.ts` — 6 categories: 餐飲 交通 購物 住宿 門票 其他
- [x] `lib/gemini.ts` — Gemini 1.5 Flash text + image extraction with JSON schema
- [x] `lib/sheets.ts` — Google Sheets append + read + dedup + balance computation
- [x] `lib/telegram.ts` — grammy bot: text handler, photo handler, /start command
- [x] `app/api/telegram/webhook/route.ts` — webhook endpoint with secret verification
- [x] `app/api/expenses/route.ts` — read expenses + balance for web UI
- [x] `components/Dashboard.tsx` — client-side dashboard with filters + balance + category chips
- [x] `app/dashboard/page.tsx` — server shell with Suspense skeleton
- [x] `scripts/register-webhook.ts` — register Telegram webhook URL
- [x] `scripts/apps-script/webhook.gs` — Apps Script alternative webhook
- [x] `docs/ai/DESIGN_TASTE_GUIDE.md` — curated taste-skill guidance for this project
- [x] Harness docs: CORE_RULES, CLAUDE.md, AGENTS.md, AI_PROJECT_CORE, HARNESS.md, DECISIONS.md

---

## Pending setup (you must do these)

1. **Create a Telegram bot** via @BotFather → get `TELEGRAM_BOT_TOKEN`
2. **Get your Telegram chat ID** via @userinfobot → set `TELEGRAM_ALLOWED_CHAT_IDS`
3. **Get Gemini API key** at aistudio.google.com → set `GEMINI_API_KEY`
4. **Create Google Sheet** with a tab named `expenses` → copy the Sheet ID
5. **Create a GCP service account:**
   - Enable Google Sheets API
   - Create service account → download JSON key
   - Share the Google Sheet with the service account email (Editor role)
   - Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`
6. **Fill `.env.local`** from `.env.local.example`
7. **Deploy to Vercel** OR run ngrok locally → set `WEBHOOK_BASE_URL`
8. **Register webhook:** `npx tsx scripts/register-webhook.ts`

---

## Google Sheets schema (tab: `expenses`)

| Column | Field | Notes |
|--------|-------|-------|
| A | id | UUID |
| B | created_at | ISO 8601 |
| C | trip_id | `tokyo_2d1n_mvp` |
| D | date | YYYY-MM-DD |
| E | merchant | Store name |
| F | item_name | What was bought |
| G | amount | Numeric |
| H | currency | JPY default |
| I | category | 餐飲/交通/購物/住宿/門票/其他 |
| J | payer | Aston / Amy |
| K | split_method | 平分 / Aston only / Amy only |
| L | source | telegram_text / telegram_photo / manual |
| M | confidence | high / medium / low |
| N | raw_text | Original message |
| O | telegram_chat_id | |
| P | telegram_message_id | Dedup key |
| Q | telegram_file_id | For photos |
| R | status | confirmed / needs_review |
| S | notes | Gemini notes |

---

## Key decisions

- **Gemini over Claude** for LLM: user preference; Gemini supports JSON schema output natively
- **Google Sheets over SQLite**: portable, no DB setup, easy to inspect/edit manually
- **Next.js webhook over Apps Script**: project already has the infra; Apps Script is documented as alternative
- **grammy retained**: good TypeScript typing for Telegram updates, webhook-native
- **No Supabase, no auth system, no itinerary**: MVP scope only

---

## taste-skill integration

- **No CLI install** — would add repo noise
- **Relevant content extracted to** `docs/ai/DESIGN_TASTE_GUIDE.md`
- Referenced in `AGENTS.md` and `CLAUDE.md` for UI tasks
- Applied to: off-white background, tabular-nums for amounts, dark balance card, category chips, empty state design

---

## Secrets / env vars required (no values here)

```
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_ALLOWED_CHAT_IDS
GEMINI_API_KEY
GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
WEBHOOK_BASE_URL
```
