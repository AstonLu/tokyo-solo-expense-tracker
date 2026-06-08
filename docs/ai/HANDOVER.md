# Session Handover

## Last updated: 2026-06-09 (MVP rebuild session)

## Current state

Architecture rebuilt. All code compiles. Awaiting real credentials for end-to-end test.

## What's done

- [x] Architecture pivoted: Claude/SQLite → Gemini/Google Sheets
- [x] `lib/types.ts` — new schema with payer, split_method, status, etc.
- [x] `lib/categories.ts` — 6 categories: 餐飲 交通 購物 住宿 門票 其他
- [x] `lib/gemini.ts` — Gemini 1.5 Flash text + image extraction
- [x] `lib/sheets.ts` — Google Sheets CRUD + dedup + balance computation
- [x] `lib/telegram.ts` — text handler + photo handler + /start
- [x] `app/api/telegram/webhook/route.ts` — secure webhook
- [x] `app/api/expenses/route.ts` — read API for dashboard
- [x] `components/Dashboard.tsx` — mobile-first dashboard, filters, balance card
- [x] `app/dashboard/page.tsx` + skeleton
- [x] `scripts/register-webhook.ts` — webhook registration
- [x] `scripts/apps-script/webhook.gs` — Apps Script alternative (complete)
- [x] `docs/ai/DESIGN_TASTE_GUIDE.md` — taste-skill guidance
- [x] `MEMORY.md`, `ROADMAP.md`, `AGENTS.md`, `CLAUDE.md`, `AI_PROJECT_CORE.md` — all updated
- [x] `npm run typecheck` passes

## What's next

- [ ] Fill in `.env.local` from `.env.local.example`
- [ ] Create Google Sheet with `expenses` tab
- [ ] Set up GCP service account + share sheet
- [ ] Run `npm run dev` for local development
- [ ] Use ngrok for Telegram webhook testing locally
- [ ] `npx tsx scripts/register-webhook.ts` to register
- [ ] End-to-end test: send a text message to the bot
- [ ] End-to-end test: send a receipt photo
- [ ] Deploy to Vercel

## Known limitations

- `lib/gemini.ts` uses a type cast `as any` for `responseSchema` due to the Google SDK's union type constraint — this is intentional and safe at runtime
- Google Sheets reads all rows on every API call — fine for an MVP trip, not for scale
- No pagination in the dashboard — fine for ~50 expenses
