# AI Project Core — Tokyo Solo Expense Tracker

## Project Purpose

MVP to validate a **Telegram-based expense tracking workflow** during a 2-day 1-night solo Tokyo trip.
Goal: confirm this pipeline works before integrating it into a larger travel app.

**This is not a full travel app.** No itinerary, weather, shopping lists, or multi-trip management.

---

## Core Flow

```
Telegram message (text or photo)
    ↓
grammy webhook handler  (Next.js /api/telegram/webhook)
    ↓
Gemini 1.5 Flash  →  structured JSON extraction
    ↓
Google Sheets  →  append row (via service account)
    ↓
Next.js website  →  reads /api/expenses  →  displays dashboard
```

**Alternative ingestion:** `scripts/apps-script/webhook.gs` — Apps Script webhook,
useful for testing without Vercel deployment.

---

## Domain rules

### Travelers
- **Aston** — default payer
- **Amy** — co-traveler

### Expense fields
| Field | Default | Options |
|-------|---------|---------|
| `payer` | Aston | Aston / Amy |
| `split_method` | 平分 | 平分 / Aston only / Amy only |
| `currency` | JPY | any |
| `status` | confirmed | confirmed / needs_review |

### Categories
| Key | Label | Examples |
|-----|-------|---------|
| 餐飲 | 餐飲 | Restaurant, konbini, cafe |
| 交通 | 交通 | Train, taxi, IC card |
| 購物 | 購物 | Donki, Yodobashi, souvenirs |
| 住宿 | 住宿 | Hotel |
| 門票 | 門票 | Museum, shrine entry |
| 其他 | 其他 | Anything else |

### Balance logic
```
net_balance = 0  (positive = Amy owes Aston, negative = Aston owes Amy)

Aston paid + 平分      → net_balance += amount / 2
Aston paid + Amy only  → net_balance += amount
Aston paid + Aston only → no effect

Amy paid + 平分        → net_balance -= amount / 2
Amy paid + Aston only  → net_balance -= amount
Amy paid + Amy only    → no effect
```

### Deduplication
- Use `telegram_chat_id` + `telegram_message_id` as dedup key
- Check before processing every update

### Confidence and status
- `confidence: low` → `status: needs_review`
- UI shows amber left border for needs_review rows

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, App Router, TypeScript |
| Styling | Tailwind CSS v4, Geist font |
| Telegram | grammy |
| AI/LLM | Gemini 1.5 Flash (`@google/generative-ai`) |
| Storage | Google Sheets (`googleapis` service account) |
| Trip ID | `tokyo_2d1n_mvp` |

---

## Scope guards

- No Supabase, no full auth, no cloud DB
- No itinerary, weather, or multi-trip features
- No receipt image storage — only extracted structured data
- No complex Telegram conversation state for MVP
- Text input is priority; photo OCR is bonus

---

## Key files

| File | Purpose |
|------|---------|
| `lib/types.ts` | All TypeScript types |
| `lib/categories.ts` | Category meta + inferCategory() |
| `lib/gemini.ts` | Gemini text + image extraction |
| `lib/sheets.ts` | Sheets read/write/dedup/balance |
| `lib/telegram.ts` | grammy bot handlers |
| `app/api/telegram/webhook/route.ts` | Webhook endpoint |
| `app/api/expenses/route.ts` | Read expenses for UI |
| `components/Dashboard.tsx` | Main dashboard component |
| `scripts/register-webhook.ts` | Register Telegram webhook |
| `scripts/apps-script/webhook.gs` | Apps Script alternative |
