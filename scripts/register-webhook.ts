/**
 * Register the Telegram webhook URL with Telegram's API.
 * Run after deploying or changing the public URL.
 *
 * Usage:
 *   cp .env.local.example .env.local  # fill in values first
 *   npx tsx scripts/register-webhook.ts
 */

export {};

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!BOT_TOKEN) { console.error("❌ TELEGRAM_BOT_TOKEN is not set"); process.exit(1); }
if (!WEBHOOK_BASE_URL) { console.error("❌ WEBHOOK_BASE_URL is not set"); process.exit(1); }

const webhookUrl = `${WEBHOOK_BASE_URL}/api/telegram/webhook`;

async function registerWebhook() {
  const url = new URL(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`);
  url.searchParams.set("url", webhookUrl);
  if (SECRET) url.searchParams.set("secret_token", SECRET);
  url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json();
  if (data.ok) console.log(`✅ Webhook registered: ${webhookUrl}`);
  else { console.error("❌ Failed:", data); process.exit(1); }
}

async function getInfo() {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const data = await res.json();
  console.log("\n📡 Current webhook info:");
  console.log(JSON.stringify(data.result, null, 2));
}

await registerWebhook();
await getInfo();
