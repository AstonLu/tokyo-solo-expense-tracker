# Session Handover

## Last updated: 2026-06-09 (respec: solo OCR-first capture)

## Current state

Full vertical slice built and passing typecheck + lint + build. Awaiting real
credentials for an end-to-end run. Not deployed.

## What changed this session

- Pivoted from Aston/Amy **split** tracker → **single-user OCR-first** capture
- New 17-field schema (see `MEMORY.md` / `README.md`)
- New provider-agnostic AI layer `lib/ai.ts` (`AI_PROVIDER_API_KEY` / `AI_MODEL`)
- Image-first Telegram handling; text is secondary
- Dashboard rebuilt: total / by-currency / by-category / needs-review / recent (expandable)
- Removed `lib/gemini.ts` and the stale `scripts/apps-script/webhook.gs`
- Env renamed: `GEMINI_API_KEY`→`AI_PROVIDER_API_KEY`(+`AI_MODEL`), `GOOGLE_SHEET_ID`→`GOOGLE_SHEETS_ID`

## What's next

- [ ] Fill `.env.local` (see `README.md` §4)
- [ ] Create Sheet + `expenses` tab + share with service account
- [ ] `npm run dev` + ngrok → `npm run register-webhook`
- [ ] Send a real receipt photo; confirm a row lands + dashboard shows it
- [ ] Deploy to Vercel

## Watch-outs

- `lib/ai.ts` uses one `as any` for Gemini `parts` array — intentional, safe.
- `GOOGLE_PRIVATE_KEY` newlines must be literal `\n` in `.env.local`.
- Mixed-currency **category** totals display in the primary currency only; the
  by-currency section is the accurate multi-currency view.
- If reintroducing split/payer, it must be an explicit request — the respec removed it.
