# Harness — Tokyo Solo Expense Tracker

## What the Harness Covers

| Layer | What it does |
|---|---|
| **Guides** | CORE_RULES → AI_PROJECT_CORE → MEMORY.md — tells agents how to act |
| **Sensors** | `npm run typecheck`, `npm run build` — verifies changes are safe |
| **Memory** | `MEMORY.md`, `docs/ai/CHANGELOG.md`, `docs/ai/DECISIONS.md` |

---

## Standard Workflow

1. Read: `CLAUDE.md` → `CORE_RULES.md` → `AI_PROJECT_CORE.md` → `MEMORY.md` → `docs/HARNESS.md`
2. Inspect relevant source files
3. Make scoped change — no unrelated refactors
4. Run sensors:
   ```bash
   npm run typecheck
   npm run build
   git diff --check
   ```
5. Update `docs/ai/CHANGELOG.md` and `docs/ai/HANDOVER.md` if state changed
6. Commit only after sensors pass

---

## Critical rules

### Telegram webhook
- Always verify `X-Telegram-Bot-Api-Secret-Token` header
- Check `TELEGRAM_ALLOWED_CHAT_IDS` — reject unauthorized chats
- Never log full update payloads (contain user data)
- Re-register webhook after any URL change: `npx tsx scripts/register-webhook.ts`

### Gemini extraction
- Use `gemini-1.5-flash` (supports vision + JSON schema output)
- Always normalize extracted fields before writing to Sheets (see `normalizeExtracted()` in `lib/gemini.ts`)
- Low confidence → set `status: needs_review`

### Google Sheets
- Dedup check before every write: `telegram_chat_id` + `telegram_message_id`
- Call `ensureHeaders()` before first write per cold start
- Credentials: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` in env
- `GOOGLE_PRIVATE_KEY`: newlines must be `\n` literals in `.env.local`

### Environment
- `.env.local` is gitignored — never commit it
- `.env.local.example` is the canonical variable list (no values)
- See `MEMORY.md` for full list of required env vars

---

## Verification commands

```bash
npm run typecheck      # TypeScript check
npm run build          # Next.js production build
git diff --check       # Whitespace check
```

---

## Key files

| File | Purpose |
|------|---------|
| `lib/gemini.ts` | Gemini extraction (text + image) |
| `lib/sheets.ts` | Google Sheets read/write/dedup/balance |
| `lib/telegram.ts` | grammy bot + message handlers |
| `lib/types.ts` | All shared types |
| `lib/categories.ts` | Category config + inferCategory() |
| `app/api/telegram/webhook/route.ts` | Webhook endpoint |
| `app/api/expenses/route.ts` | Expenses read API for dashboard |
| `components/Dashboard.tsx` | Client-side dashboard with filters |
| `scripts/register-webhook.ts` | Register Telegram webhook URL |
| `scripts/apps-script/webhook.gs` | Apps Script alternative webhook |
| `docs/ai/DESIGN_TASTE_GUIDE.md` | UI design guidance (taste-skill) |
