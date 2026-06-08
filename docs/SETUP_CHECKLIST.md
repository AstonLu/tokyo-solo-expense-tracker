# Setup Checklist — Tokyo Solo Expense Capture

Work top to bottom. Each step ends with a ✅ check you can verify before moving on.
Full reference: [`README.md`](../README.md). Variable names: [`.env.local.example`](../.env.local.example).

---

## 1. Telegram bot

1. In Telegram, open **@BotFather** → send `/newbot`.
2. Choose a name and a username (must end in `bot`).
3. Copy the **HTTP API token** it returns.
4. Put it in `.env.local` as `TELEGRAM_BOT_TOKEN`.

✅ `https://api.telegram.org/bot<TOKEN>/getMe` returns `"ok": true`.

## 2. Telegram chat ID (allow-list)

1. Message **@userinfobot** (or **@RawDataBot**) on Telegram.
2. Copy the numeric **Id** it replies with.
3. Set `TELEGRAM_ALLOWED_CHAT_IDS` to that id (comma-separated for several).
   - Blank = allow everyone. Not recommended.
4. Pick any random string for `TELEGRAM_WEBHOOK_SECRET` (verifies inbound calls).

✅ Your id is a plain number, e.g. `123456789`.

## 3. Google Sheet

1. Create a new Google Sheet.
2. Rename a tab to exactly **`expenses`** (lowercase). The app writes the header
   row on first use — you don't add columns manually.
3. From the URL copy the id:
   `docs.google.com/spreadsheets/d/`**`<GOOGLE_SHEETS_ID>`**`/edit`
4. Set `GOOGLE_SHEETS_ID`.

✅ The tab is named `expenses` and you have the id string.

## 4. Google Cloud service account

1. Open [console.cloud.google.com](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → Credentials → Create credentials → Service account.**
3. Name it, create, open it → **Keys → Add key → Create new key → JSON** → download.
4. From the JSON: copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
5. From the JSON: copy `private_key` → `GOOGLE_PRIVATE_KEY`.
   - Keep the `\n` escapes inside the quotes (one line in `.env.local`).

✅ You have a `…iam.gserviceaccount.com` email and a `-----BEGIN PRIVATE KEY-----…` value.

## 5. Enable Google Sheets API

1. **APIs & Services → Library → search "Google Sheets API" → Enable**
   (in the same project as the service account).

✅ The Sheets API shows **Enabled** / **Manage**.

## 6. Share the Sheet with the service account

1. Open the Sheet → **Share**.
2. Paste the `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
3. Give it **Editor**, then send/share.

✅ The service account appears in the Sheet's people list with Editor access.
(Skipping this is the #1 cause of `The caller does not have permission` errors.)

## 7. AI provider key (Gemini default)

1. Open [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → create an API key.
2. Set `AI_PROVIDER_API_KEY` to it.
3. Set `AI_MODEL=gemini-1.5-flash` (any vision-capable model id works).

✅ Key is set; model id is vision-capable.

## 8. Local `.env.local`

```bash
cp .env.local.example .env.local
# fill in every value from steps 1–7
```

Required keys: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`TELEGRAM_ALLOWED_CHAT_IDS`, `AI_PROVIDER_API_KEY`, `AI_MODEL`, `GOOGLE_SHEETS_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `WEBHOOK_BASE_URL`.

✅ `.env.local` exists and is **not** committed (it's gitignored).

## 9. Local webhook test with ngrok

Telegram only calls public HTTPS URLs, so tunnel your local server:

```bash
npm install
npm run dev                 # terminal 1 → http://localhost:3000
npx ngrok http 3000         # terminal 2 → copy the https://… URL
```

1. Put the ngrok URL in `.env.local` as `WEBHOOK_BASE_URL`.
2. Register the webhook:
   ```bash
   npm run register-webhook
   ```
   It calls Telegram `setWebhook` (URL + secret) and prints the current webhook info.

✅ The printed `getWebhookInfo` shows your ngrok URL and no `last_error_message`.

## 10. Vercel deployment environment variables

1. Import the repo in [Vercel](https://vercel.com/new).
2. **Project → Settings → Environment Variables** — add all nine variables from step 8.
   - `GOOGLE_PRIVATE_KEY`: paste the full value including `\n` escapes.
3. Deploy.

✅ Build succeeds and `https://<app>.vercel.app/api/telegram/webhook` returns
`{"status":"ok",...}` on GET.

## 11. Production webhook registration

1. Set `WEBHOOK_BASE_URL` (locally or in your shell) to the production URL.
2. Run:
   ```bash
   npm run register-webhook
   ```
   (Re-run this any time the public URL changes.)

✅ `getWebhookInfo` shows the production URL. Send a receipt photo → a row appears
in the Sheet and on `/dashboard`.

---

## Quick reference

| Variable | From | Step |
|----------|------|------|
| `TELEGRAM_BOT_TOKEN` | @BotFather | 1 |
| `TELEGRAM_WEBHOOK_SECRET` | you choose | 2 |
| `TELEGRAM_ALLOWED_CHAT_IDS` | @userinfobot | 2 |
| `AI_PROVIDER_API_KEY` | AI Studio | 7 |
| `AI_MODEL` | `gemini-1.5-flash` | 7 |
| `GOOGLE_SHEETS_ID` | Sheet URL | 3 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | service account JSON | 4 |
| `GOOGLE_PRIVATE_KEY` | service account JSON | 4 |
| `WEBHOOK_BASE_URL` | ngrok / Vercel URL | 9 / 10 |
