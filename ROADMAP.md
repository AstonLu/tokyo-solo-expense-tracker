# Roadmap — Tokyo Solo Expense Tracker

---

## MVP 1 — Telegram text → Sheets → website ✅ (architecture built)

- [x] Telegram bot receives text messages
- [x] Gemini extracts structured expense data
- [x] Writes to Google Sheets
- [x] Website reads and displays expenses
- [x] Balance calculation (Aston/Amy)
- [x] Category breakdown
- [x] Payer + split_method tracking
- [ ] End-to-end test with real credentials
- [ ] Deploy to Vercel

## MVP 2 — Receipt photo support (ready to test)

- [x] Telegram bot receives photo messages
- [x] Gemini vision OCR from image
- [ ] Test with real Japanese receipts
- [ ] Tune prompts for Japanese receipt formats

## MVP 3 — Confirmation / edit / delete flow

- [ ] Bot: reply with parsed result + "確認 / 修改" buttons (Telegram InlineKeyboard)
- [ ] Web: mark needs_review items as confirmed
- [ ] Web: delete a record
- [ ] Web: manual add form (simple, for when photo OCR fails)

## MVP 4 — Connect back to main project

- [ ] Extract core pattern (Gemini extraction + Sheets write) as a reusable module
- [ ] Migrate expense schema into the US Graduation Trip App (if needed)
- [ ] Replace SQLite with Supabase if moving to multi-trip multi-user
- [ ] Add currency conversion API for non-JPY entries

---

## Out of scope for this project

- Itinerary planning
- Weather
- Shopping lists
- Multi-trip management
- Full auth system
- Production-grade OCR pipeline
- Push notifications
