# Changelog

## 2026-06-09 — Respec: solo OCR-first capture

**Product pivot:** Aston/Amy split tracker → single-user OCR-first capture.
Image-first input, provider-agnostic AI, richer extraction schema.

### Added
- `lib/ai.ts` — provider-agnostic vision/OCR seam (`extractExpense`); Gemini impl via
  `AI_PROVIDER_API_KEY` / `AI_MODEL`; returns raw model output; enforces `needs_review`
- `README.md` — full setup (Telegram, webhook, Sheets, env, run, deploy, limitations)

### Changed
- `lib/types.ts` — new 17-field schema: source, transaction_date, payment_method,
  location, original_text_context, ai_summary, confidence_score, needs_review,
  image_file_reference, raw_ai_response. Dropped payer/split_method/trip_id/item_name/status
- `lib/sheets.ts` — schema A:Q; dedup by `telegram_message_id` only; `computeSummary`
  (by-currency, by-category, primary currency, needs_review count) — removed split/balance
- `lib/telegram.ts` — image-first; stores `original_text_context`; confirmation shows
  review flag + confidence
- `app/api/expenses/route.ts` — returns `{ transactions, summary }`; clearer error passthrough
- `components/Dashboard.tsx` — total / by-currency / by-category / needs-review /
  recent (expandable cards) + loading/empty/error
- `.env.local.example` — `AI_PROVIDER_API_KEY`/`AI_MODEL` (was `GEMINI_API_KEY`),
  `GOOGLE_SHEETS_ID` (was `GOOGLE_SHEET_ID`)
- `MEMORY.md`, `AI_PROJECT_CORE.md`, `ROADMAP.md`, `docs/HARNESS.md` — updated to new model

### Removed
- `lib/gemini.ts` → replaced by `lib/ai.ts`
- `scripts/apps-script/webhook.gs` → diverged from new schema; Next.js webhook is the path

### Verification
- `npm run typecheck` ✅ · `npm run lint` ✅ · `npm run build` ✅

---

## 2026-06-09 — MVP rebuild (Gemini + Google Sheets)

**Architecture pivot:** Claude/SQLite → Gemini 1.5 Flash / Google Sheets

### Added
- `lib/gemini.ts` — Gemini 1.5 Flash extraction (text + vision)
- `lib/sheets.ts` — Google Sheets CRUD via service account; balance computation
- `app/api/expenses/route.ts` — read API for dashboard
- `components/Dashboard.tsx` — mobile-first dashboard with balance, categories, filters
- `scripts/apps-script/webhook.gs` — complete Apps Script alternative webhook
- `docs/ai/DESIGN_TASTE_GUIDE.md` — curated taste-skill guidance
- `MEMORY.md` — current project state for agents
- `ROADMAP.md` — MVP phases

### Changed
- `lib/types.ts` — full rewrite: new schema with payer, split_method, status, item_name, etc.
- `lib/categories.ts` — updated to 6 categories: 餐飲 交通 購物 住宿 門票 其他
- `lib/telegram.ts` — rewritten for new schema; text input as priority; Gemini calls
- `app/api/telegram/webhook/route.ts` — simplified; removed SQLite dependency
- `app/dashboard/page.tsx` — Suspense shell + skeleton
- `app/page.tsx` — redirect to /dashboard
- `app/globals.css` — design system tokens; tabular-nums
- `AGENTS.md`, `CLAUDE.md` — updated to include MEMORY.md + taste-skill reference
- `AI_PROJECT_CORE.md` — rewritten for new architecture
- `docs/HARNESS.md` — updated critical rules for new stack

### Removed
- `lib/db.ts` — SQLite (replaced by lib/sheets.ts)
- `lib/ocr.ts` — Anthropic Claude (replaced by lib/gemini.ts)
- `@anthropic-ai/sdk`, `better-sqlite3`, `@types/better-sqlite3` packages

### Added packages
- `@google/generative-ai`
- `googleapis`
- `uuid` + `@types/uuid`

---

## 2026-06-09 — Initial scaffold

- Bootstrapped Next.js 15 + TypeScript + Tailwind
- Installed grammy, @anthropic-ai/sdk, better-sqlite3
- Established Harness Engineering structure
- Scaffolded initial lib modules (superseded by MVP rebuild above)
