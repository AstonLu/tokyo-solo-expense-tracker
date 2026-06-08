# Changelog

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
