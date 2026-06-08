import { Bot, webhookCallback } from "grammy";
import { extractFromText, extractFromImage } from "./gemini";
import { appendExpense, isDuplicate, ensureHeaders } from "./sheets";
import { getCategoryEmoji } from "./categories";
import { Expense } from "./types";

let bot: Bot | null = null;

function getAllowedChatIds(): Set<string> {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS || "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
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

function formatConfirmation(expense: Expense): string {
  const emoji = getCategoryEmoji(expense.category);
  const reviewNote = expense.status === "needs_review" ? "\n⚠️ 信心度較低，請稍後確認" : "";
  return [
    `✅ 已記帳`,
    ``,
    `${emoji} ${expense.item_name}`,
    `🏪 ${expense.merchant}`,
    `💴 ¥${Math.round(expense.amount).toLocaleString()} ${expense.currency !== "JPY" ? `(${expense.currency})` : ""}`.trim(),
    `👤 ${expense.payer} 付 · ${expense.split_method}`,
    `📂 ${expense.category}`,
    reviewNote,
  ].filter((l) => l !== undefined).join("\n").trim();
}

function registerHandlers(bot: Bot) {
  const allowedIds = getAllowedChatIds();

  function isAllowed(chatId: number): boolean {
    if (allowedIds.size === 0) return true; // no restriction if not configured
    return allowedIds.has(String(chatId));
  }

  bot.command("start", (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;
    ctx.reply(
      [
        "👋 東京記帳 Bot 已啟動",
        "",
        "📝 傳送消費訊息：",
        "  晚餐 2800 日圓 Amy付 餐飲",
        "  便利商店飲料 350",
        "  電車 1200 交通",
        "",
        "📸 或直接傳收據/截圖",
        "",
        "格式：品項 金額 [Amy付] [分類]",
        "預設：Aston付、平分、JPY",
      ].join("\n")
    );
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    if (!isAllowed(ctx.chat.id)) return;

    const chatId = String(ctx.chat.id);
    const msgId = String(ctx.message.message_id);

    if (await isDuplicate(chatId, msgId)) {
      await ctx.reply("⚠️ 此訊息已記錄過");
      return;
    }

    const processingMsg = await ctx.reply("⏳ 解析中…");

    try {
      await ensureHeaders();
      const extracted = await extractFromText(text);
      const expense = await appendExpense({
        extracted,
        source: "telegram_text",
        raw_text: text,
        telegram_chat_id: chatId,
        telegram_message_id: msgId,
        telegram_file_id: "",
      });

      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        formatConfirmation(expense)
      );
    } catch (err) {
      console.error("Text extraction error:", err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "❌ 解析失敗，請確認格式：品項 金額 [Amy付] [分類]"
      );
    }
  });

  bot.on("message:photo", async (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;

    const chatId = String(ctx.chat.id);
    const msgId = String(ctx.message.message_id);

    if (await isDuplicate(chatId, msgId)) {
      await ctx.reply("⚠️ 此訊息已記錄過");
      return;
    }

    const processingMsg = await ctx.reply("⏳ 辨識收據中…");

    try {
      const photos = ctx.message.photo;
      const best = photos[photos.length - 1];
      const file = await ctx.api.getFile(best.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      await ensureHeaders();
      const extracted = await extractFromImage(
        base64,
        "image/jpeg",
        ctx.message.caption
      );
      const expense = await appendExpense({
        extracted,
        source: "telegram_photo",
        raw_text: ctx.message.caption || "",
        telegram_chat_id: chatId,
        telegram_message_id: msgId,
        telegram_file_id: best.file_id,
      });

      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        formatConfirmation(expense)
      );
    } catch (err) {
      console.error("Photo extraction error:", err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "❌ 辨識失敗，請重試或改用文字輸入"
      );
    }
  });
}

export function createWebhookHandler() {
  const b = getBot();
  return webhookCallback(b, "std/http");
}
