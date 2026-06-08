# Manual Testing — Tokyo Solo Expense Capture

Real-world test pass before relying on the bot during a trip. Run after the
[`SETUP_CHECKLIST.md`](SETUP_CHECKLIST.md) is fully green.

Legend: **Do** → what you send / cause · **Expect** → observable result.
Bot replies are in zh-TW; exact strings below come from `lib/telegram.ts`.

---

## A. Ingestion — happy paths

### A1. Clear receipt image with caption
- **Do:** Send a sharp photo of a Japanese receipt. Caption: `澀谷午餐 刷卡`.
- **Expect:** "⏳ 辨識中…" → edited to **✅ 已記錄** with merchant, amount + `JPY`,
  category, `📍`/payment method if detected, and a 📝 summary.
- **Verify in Sheet:** a new row; `source = telegram_photo`; `amount`/`currency`/`merchant`
  populated; `original_text_context = 澀谷午餐 刷卡`; `image_file_reference` non-empty;
  `needs_review = FALSE`; `raw_ai_response` contains JSON.

### A2. Payment screenshot with caption
- **Do:** Send a screenshot of a card/QR payment. Caption: `便利商店 現金`.
- **Expect:** **✅ 已記錄**; amount + currency parsed from the screenshot.
- **Verify:** row with `source = telegram_photo`; `payment_method` reflects context where derivable.

### A3. Image without caption
- **Do:** Send a receipt photo, no caption.
- **Expect:** **✅ 已記錄** from the image alone; `original_text_context` is empty.
- **Verify:** row written; `ai_summary` describes the expense (falls back gracefully with no caption).

### A4. Text-only message (secondary path, supported)
- **Do:** Send text only: `晚餐 2800 日圓 信用卡`.
- **Expect:** "⏳ 解析中…" → **✅ 已記錄**; amount `2800`, `JPY`.
- **Verify:** row with `source = telegram_text`; `image_file_reference` empty;
  `original_text_context` = the message.

---

## B. Ingestion — edge cases

### B1. Duplicate Telegram message
- **Do:** Forward/resend the **same** message (same `message_id`) again.
- **Expect:** **⚠️ 這則訊息已記錄過了** — no new row.
- **Verify:** Sheet row count unchanged. (Dedup key = `telegram_message_id`.)

### B2. Unreadable / non-receipt image
- **Do:** Send a blurry photo, or a random non-receipt image.
- **Expect:** Row is **still written, flagged** — reply shows **⚠️ 已記錄（需要確認）**
  with a confidence % and a prompt to confirm.
- **Verify:** row has `needs_review = TRUE`, low `confidence_score`; appears in the
  dashboard **待確認** section. Records are never silently dropped.

### B3. Unauthorized chat
- **Do:** Message the bot from a chat **not** in `TELEGRAM_ALLOWED_CHAT_IDS`.
- **Expect:** No reply, no row. (Silently ignored by design.)

---

## C. Failure modes (configuration)

### C1. Missing Google credentials
- **Do:** Unset `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` (or `GOOGLE_SHEETS_ID`),
  restart, send a message.
- **Expect (bot):** **❌ 辨識或寫入失敗…** (write step throws a clear creds error,
  caught by the handler).
- **Expect (dashboard):** `/dashboard` shows the **error state** — "無法載入資料" with
  the message and a hint to set Sheets env vars. No crash.

### C2. Missing AI key
- **Do:** Unset `AI_PROVIDER_API_KEY`, restart, send a photo or text.
- **Expect:** **❌ 辨識或寫入失敗…** / **❌ 解析或寫入失敗…** (extraction throws
  "AI_PROVIDER_API_KEY is not set", caught). No row written.

### C3. Wrong sheet not shared with service account
- **Do:** Valid creds, but the Sheet is **not** shared with the service-account email.
- **Expect (dashboard):** error state mentioning permission (`caller does not have permission`).
- **Fix:** SETUP step 6.

---

## D. Dashboard states

### D1. Loading
- **Do:** Open `/dashboard` on a throttled connection (DevTools → Slow 3G).
- **Expect:** Skeleton blocks (hero + cards) before data resolves.

### D2. Empty
- **Do:** Open `/dashboard` with valid creds but an empty `expenses` sheet.
- **Expect:** Empty state — 🧾 "還沒有任何記錄" with the Telegram hint. No error.

### D3. Error
- **Do:** As C1 (bad/missing creds).
- **Expect:** Red error card, not a blank page or a crash.

### D4. Needs-review state
- **Do:** Have at least one `needs_review = TRUE` row (from B2).
- **Expect:** A **待確認 · N** section above 最近交易, amber-tinted cards; tapping a
  card expands detail (summary, original text, source, confidence %).

### D5. Populated dashboard
- **Do:** Several confirmed rows across categories / currencies.
- **Expect:** Hero **總支出** in the primary currency; **各幣別** row only when >1
  currency; **分類** bars; **最近交易** newest-first; cards expand on tap.

---

## Pass criteria

- [ ] A1–A4 each write exactly one correct row and reply with a confirmation
- [ ] B1 produces no duplicate; B2 writes a flagged row; B3 is ignored
- [ ] C1/C2 fail safely with clear messages and no partial/garbage rows
- [ ] D1–D5 each render the intended state without crashing
- [ ] Mobile viewport (375px wide) reads cleanly end to end

> Scope note: payer/split, multi-user, login, and voice are intentionally out of
> scope — do not test for them.
