# End-to-End Smoke Test — Tokyo Solo Expense Capture

A tight, ordered runbook to validate the full path once real credentials are wired:

```
Telegram photo → AI extraction → Google Sheets row → dashboard reads it → needs_review works
```

Prerequisite: [`SETUP_CHECKLIST.md`](SETUP_CHECKLIST.md) complete. For the exhaustive
case matrix see [`TESTING.md`](TESTING.md). This file is the minimal "is it alive?" pass.

---

## 0. Pre-flight (no Telegram yet)

1. **Env present.** `.env.local` has all nine variables filled (see §"Credentials" below).
2. **Server up.**
   ```bash
   npm run dev
   ```
3. **Webhook health.** In a browser or curl:
   ```bash
   curl -s http://localhost:3000/api/telegram/webhook
   # → {"status":"ok","service":"tokyo-solo-expense-bot"}
   ```
4. **Dashboard reachable.** Open `http://localhost:3000/dashboard`.
   - Empty Sheet → empty state ("還沒有任何記錄"). This already proves the Sheets
     **read** path + credentials work. A red error card instead means creds/sharing
     are wrong — fix before continuing (see §Blockers).

✅ Health endpoint returns ok **and** the dashboard shows empty (not error).

## 1. Expose + register the webhook

```bash
npx ngrok http 3000            # terminal 2 → copy the https URL
# put it in .env.local as WEBHOOK_BASE_URL, then:
npm run register-webhook
```

- The script prints `getWebhookInfo`. Confirm `url` = your ngrok URL and there is no
  `last_error_message`.
- Note: `register-webhook` runs via `npx dotenv-cli`; the first run may install it.

✅ `getWebhookInfo` shows the ngrok URL, no last error.

---

## 2. Smoke case A — Telegram photo with caption (the core path)

**Do:** From an allow-listed chat, send a clear receipt photo. Caption: `澀谷午餐 刷卡`.

Walk the pipeline, each step gates the next:

| # | Stage | Confirm |
|---|-------|---------|
| 2.1 | **Telegram → webhook** | Bot replies "⏳ 辨識中…" within ~1–2s. (Webhook reachable + secret OK.) |
| 2.2 | **AI extraction runs** | Reply edits to **✅ 已記錄** with merchant, amount + `JPY`, category, 📝 summary. (AI key + vision OK.) |
| 2.3 | **Row appended to Sheets** | Open the `expenses` tab → a new bottom row; `source=telegram_photo`, `amount`/`currency`/`merchant` filled, `original_text_context=澀谷午餐 刷卡`, `image_file_reference` non-empty, `needs_review=FALSE`, `raw_ai_response` has JSON. |
| 2.4 | **Dashboard reads it** | Reload `/dashboard` → 總支出 updates, the row shows under 最近交易; tap the card → detail expands. |

✅ All four rows of the table pass. This is the headline success.

## 3. Smoke case B — needs_review (low-confidence input)

**Do:** Send a **blurry** or **non-receipt** photo (or text with no amount, e.g. `something`).

| # | Confirm |
|---|---------|
| 3.1 | Bot replies **⚠️ 已記錄（需要確認）** with a confidence % — record is **not** dropped. |
| 3.2 | Sheet row has `needs_review=TRUE` and a low `confidence_score`. |
| 3.3 | `/dashboard` shows the row in the amber **待確認 · N** section. |

✅ Low-confidence input is captured, flagged, and surfaced — never silently lost.

## 4. (Optional) duplicate guard

**Do:** Forward the **same** message from case A again.
**Confirm:** Bot replies **⚠️ 這則訊息已記錄過了**; no new Sheet row (dedup on `telegram_message_id`).

---

## Credentials you must provide (names only — never commit values)

| Variable | Source |
|----------|--------|
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | you choose (random string) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | @userinfobot (your numeric id) |
| `GROQ_API_KEY` | console.groq.com/keys (free tier) |
| `AI_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` (default is fine) |
| `GOOGLE_SHEETS_ID` | Sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | service-account JSON `client_email` |
| `GOOGLE_PRIVATE_KEY` | service-account JSON `private_key` (`\n`-escaped) |
| `WEBHOOK_BASE_URL` | ngrok URL (local) / Vercel URL (prod) |

## Blockers & quick fixes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Dashboard red error card | Sheets creds missing/wrong, or Sheet not shared | SETUP steps 4–6; share Sheet with the service-account email as **Editor** |
| `caller does not have permission` | Sheet not shared with service account | SETUP step 6 |
| Bot never replies | Webhook not registered, or chat not allow-listed | `npm run register-webhook`; check `TELEGRAM_ALLOWED_CHAT_IDS` |
| "⏳ 辨識中…" then ❌ failure | AI key missing/invalid, or Sheets write failing | check `AI_PROVIDER_API_KEY`; check Sheets sharing |
| `getWebhookInfo` shows `last_error_message` | URL unreachable / wrong secret | confirm ngrok is up and `WEBHOOK_BASE_URL` is current; re-register |

> Scope guard: do not test payer/split, multi-user, login, or voice — out of scope.
