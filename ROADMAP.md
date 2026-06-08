# Roadmap — Tokyo Solo Expense Capture

## MVP 1 — Image + text → AI OCR → Sheets → dashboard ✅ (built)

- [x] Telegram webhook (photo primary, text secondary)
- [x] Provider-agnostic AI vision extraction (`lib/ai.ts`)
- [x] Full OCR schema written to Google Sheets
- [x] needs_review flagging (never drops low-confidence rows)
- [x] Mobile dashboard: total, by-currency, by-category, needs-review, recent (expandable)
- [x] Loading / empty / error states
- [ ] End-to-end test with real credentials
- [ ] Deploy to Vercel

## MVP 2 — Review & correction

- [ ] Dashboard: mark a needs_review row as confirmed
- [ ] Dashboard: edit amount / currency / category inline
- [ ] Dashboard: delete a row
- [ ] Telegram: inline buttons to confirm/correct right after capture

## MVP 3 — Capture quality

- [ ] Tune prompts on real Japanese receipts
- [ ] Multi-item receipts (one message → several rows)
- [ ] Currency normalization / FX for non-JPY totals

## MVP 4 — Carry lessons to the main app

- [ ] Extract `lib/ai.ts` + `lib/sheets.ts` as a reusable capture module
- [ ] Decide storage (Sheets vs DB) for the larger project

---

## Out of scope (this MVP)

Login · multi-user · accounting system · Supabase · desktop-first ·
voice messages · multi-trip management.
