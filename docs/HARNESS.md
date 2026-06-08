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

### AI extraction
- All AI calls go through `lib/ai.ts` `extractExpense()` — the only provider seam.
  Config: `AI_PROVIDER_API_KEY` + `AI_MODEL` (default `gemini-1.5-flash`, vision-capable).
- `normalize()` enforces `needs_review` (amount ≤ 0 / no merchant / low confidence).
- Never drop a record — low confidence is written and flagged.
- To swap providers, edit only `callModel()` in `lib/ai.ts`.

### Google Sheets
- Dedup check before every write: `telegram_message_id`
- Call `ensureHeaders()` before first write per cold start
- Credentials: `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
- `GOOGLE_PRIVATE_KEY`: newlines must be `\n` literals in `.env.local`
- Sheet is the single source of truth — no parallel store

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
| `lib/ai.ts` | Provider-agnostic vision/OCR extraction |
| `lib/sheets.ts` | Google Sheets read/write/dedup/summary |
| `lib/telegram.ts` | grammy bot + message handlers (photo primary) |
| `lib/types.ts` | All shared types + schema |
| `lib/categories.ts` | Category config + helpers |
| `app/api/telegram/webhook/route.ts` | Webhook endpoint |
| `app/api/expenses/route.ts` | Expenses read API for dashboard |
| `components/Dashboard.tsx` | Mobile dashboard (expandable cards) |
| `scripts/register-webhook.ts` | Register Telegram webhook URL |
| `docs/ai/DESIGN_TASTE_GUIDE.md` | UI design guidance (taste-skill) |
