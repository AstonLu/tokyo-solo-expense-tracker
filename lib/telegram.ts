import { Bot, webhookCallback } from "grammy";
import { extractExpense } from "./ai";
import { appendExpense, isDuplicate, ensureHeaders } from "./sheets";
import { getCategoryEmoji } from "./categories";
import { Expense } from "./types";

let bot: Bot | null = null;

function getAllowedChatIds(): Set<string> {
  return new Set(
    (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function getBot(): Bot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");
    bot = new Bot(token);
    registerHandlers(bot);
  }
  return bot;
}

function confirmation(e: Expense): string {
  const emoji = getCategoryEmoji(e.category);
  const lines = [
    e.needs_review ? "⚠️ 已記錄（需要確認）" : "✅ 已記錄",
    "",
    `🏪 ${e.merchant}`,
    `💴 ${e.amount.toLocaleString()} ${e.currency}`,
    `${emoji} ${e.category}${e.payment_method ? ` · ${e.payment_method}` : ""}`,
  ];
  if (e.location) lines.push(`📍 ${e.location}`);
  if (e.transaction_date) lines.push(`🗓 ${e.transaction_date}`);
  lines.push("", `📝 ${e.ai_summary}`);
  if (e.needs_review) {
    lines.push("", `🔍 信心度 ${(e.confidence_score * 100).toFixed(0)}% — 請到儀表板確認金額/幣別/商家`);
  }
  return lines.join("\n");
}

async function downloadPhotoBase64(
  fileId: string,
  api: Bot["api"]
): Promise<string> {
  const file = await api.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

function registerHandlers(bot: Bot) {
  const allowed = getAllowedChatIds();
  const isAllowed = (chatId: number) =>
    allowed.size === 0 || allowed.has(String(chatId));

  bot.command("start", (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;
    ctx.reply(
      [
        "👋 旅行記帳 Bot",
        "",
        "📸 傳一張收據 / 付款截圖 / 紙本發票照片",
        "可加上說明，例如「澀谷午餐，刷卡」",
        "",
        "📝 也可純文字：晚餐 2800 日圓 信用卡",
        "",
        "我會用 AI 辨識並寫入 Google Sheets。",
      ].join("\n")
    );
  });

  // Primary path: image (with optional caption as context).
  bot.on("message:photo", async (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;
    const msgId = String(ctx.message.message_id);

    if (await isDuplicate(msgId)) {
      await ctx.reply("⚠️ 這則訊息已記錄過了");
      return;
    }

    const pending = await ctx.reply("⏳ 辨識中…");
    try {
      const photos = ctx.message.photo;
      const best = photos[photos.length - 1];
      const base64 = await downloadPhotoBase64(best.file_id, ctx.api);
      const caption = ctx.message.caption || "";

      const { extracted, raw } = await extractExpense({
        imageBase64: base64,
        mimeType: "image/jpeg",
        textContext: caption,
      });

      await ensureHeaders();
      const expense = await appendExpense({
        extracted,
        source: "telegram_photo",
        telegram_message_id: msgId,
        original_text_context: caption,
        image_file_reference: best.file_id,
        raw_ai_response: raw,
      });

      await ctx.api.editMessageText(
        ctx.chat.id,
        pending.message_id,
        confirmation(expense)
      );
    } catch (err) {
      console.error("Photo handler error:", err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        pending.message_id,
        "❌ 辨識或寫入失敗，請稍後再試或改用文字輸入。"
      );
    }
  });

  // Secondary path: plain text note.
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    if (!isAllowed(ctx.chat.id)) return;
    const msgId = String(ctx.message.message_id);

    if (await isDuplicate(msgId)) {
      await ctx.reply("⚠️ 這則訊息已記錄過了");
      return;
    }

    const pending = await ctx.reply("⏳ 解析中…");
    try {
      const { extracted, raw } = await extractExpense({ textContext: text });

      await ensureHeaders();
      const expense = await appendExpense({
        extracted,
        source: "telegram_text",
        telegram_message_id: msgId,
        original_text_context: text,
        image_file_reference: "",
        raw_ai_response: raw,
      });

      await ctx.api.editMessageText(
        ctx.chat.id,
        pending.message_id,
        confirmation(expense)
      );
    } catch (err) {
      console.error("Text handler error:", err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        pending.message_id,
        "❌ 解析或寫入失敗，請稍後再試。"
      );
    }
  });
}

export function createWebhookHandler() {
  return webhookCallback(getBot(), "std/http");
}
