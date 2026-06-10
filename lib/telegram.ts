import { Bot, Context, webhookCallback } from "grammy";
import { extractExpense, interpretReply, finalizeDraft } from "./ai";
import {
  appendExpense,
  isDuplicate,
  ensureHeaders,
  setPendingDraft,
  getPendingDraft,
  clearPendingDraft,
  PendingDraft,
} from "./sheets";
import { getCategoryEmoji } from "./categories";
import { Expense, ExtractedExpense, PaidBy, BenefitType } from "./types";

// ── Fast-path keyword sets (confirm / cancel need no AI call) ──────────────────

const CONFIRM_RE =
  /^\s*(ok|okay|確認|沒問題|對|可以|yes|好|好的|確定|寫入|記帳|存|存入)\s*$/i;

const CANCEL_RE =
  /^\s*(取消|刪掉|刪除|放棄|discard|cancel|不要|算了|不用了|不寫)\s*$/i;

// ── TWD rough estimates (handy for the two Taiwanese travelers) ────────────────

const APPROX_TWD: Record<string, number> = {
  USD: 32.0,
  JPY: 0.216,
  EUR: 35.0,
  HKD: 4.1,
  KRW: 0.024,
  SGD: 24.0,
  CNY: 4.5,
};

function estimateTwd(amount: number, currency: string): string | null {
  if (currency === "TWD") return null;
  const rate = APPROX_TWD[currency];
  if (!rate) return null;
  return `≈ NT$${Math.round(amount * rate).toLocaleString()}`;
}

// ── Split-field display helpers ────────────────────────────────────────────────

const PAID_BY_LABEL: Record<PaidBy, string> = {
  aston: "Aston",
  amy: "Amy",
  unknown: "待確認",
};

const BENEFIT_LABEL: Record<BenefitType, string> = {
  shared_50_50: "50 / 50 共同",
  aston_only: "全部 Aston",
  amy_only: "全部 Amy",
  custom: "自訂分攤",
  unknown: "待確認",
};

/** Minimal clarification question for whatever required fields are missing. */
function clarifyQuestion(missing: string[]): string {
  const needAmount = missing.includes("amount");
  const needMerchant = missing.includes("merchant");
  if (needAmount && needMerchant) return "❓ 請問這筆的店名和金額是？";
  if (needAmount) return "❓ 請問金額是多少？";
  if (needMerchant) return "❓ 請問店名是？";
  if (missing.includes("paid_by")) return "❓ 這筆是 Aston 還是 Amy 付的？";
  return "";
}

// ── Draft formatting ──────────────────────────────────────────────────────────

function formatDraft(d: ExtractedExpense): string {
  const emoji = getCategoryEmoji(d.category);
  const twd = estimateTwd(d.amount, d.currency);
  const amountStr =
    d.amount > 0
      ? `${d.amount.toLocaleString()} ${d.currency}${twd ? `（${twd}）` : ""}`
      : "金額待確認";
  const merchantName =
    d.merchant_display_name_zh && d.merchant_display_name_zh !== d.merchant
      ? `${d.merchant}（${d.merchant_display_name_zh}）`
      : d.merchant;

  const lines = [
    "🧾 草稿（待確認）",
    "",
    d.transaction_date ? `📅 ${d.transaction_date}` : "📅 日期不明",
    `🏪 ${merchantName}`,
    `💵 ${amountStr}`,
    `${emoji} ${d.category}${d.payment_method ? ` · ${d.payment_method}` : ""}`,
    `👤 付款：${PAID_BY_LABEL[d.paid_by]} · 分攤：${BENEFIT_LABEL[d.benefit_type]}`,
  ];

  if (d.amount > 0) {
    lines.push(
      `   Aston ${d.aston_share_amount.toLocaleString()} · Amy ${d.amy_share_amount.toLocaleString()} ${d.currency}`
    );
  }
  if (d.location) lines.push(`📍 ${d.location}`);
  if (d.inferred_items) lines.push(`🛒 ${d.inferred_items}`);
  if (d.split_note) lines.push(`📝 ${d.split_note}`);

  const question = clarifyQuestion(d.missing_fields);
  if (question) {
    lines.push("", question);
  } else {
    lines.push(
      "",
      "───────────────",
      "✅ 回覆「確認」→ 寫入",
      "✏️ 修改：例如「金額是 45」「Amy 付的」「這是 Aston 的」",
      "❌ 回覆「取消」→ 丟棄草稿"
    );
  }

  return lines.join("\n");
}

function formatConfirmed(e: Expense): string {
  const emoji = getCategoryEmoji(e.category);
  const lines = [
    e.needs_review ? "⚠️ 已記錄（建議到儀表板確認）" : "✅ 已記錄",
    "",
    `🏪 ${e.merchant}`,
    `💵 ${e.amount.toLocaleString()} ${e.currency}`,
    `${emoji} ${e.category}${e.payment_method ? ` · ${e.payment_method}` : ""}`,
    `👤 ${PAID_BY_LABEL[e.paid_by]} 付 · ${BENEFIT_LABEL[e.benefit_type]}`,
  ];
  if (e.amount > 0) {
    lines.push(
      `   Aston ${e.aston_share_amount.toLocaleString()} · Amy ${e.amy_share_amount.toLocaleString()} ${e.currency}`
    );
  }
  if (e.location) lines.push(`📍 ${e.location}`);
  lines.push("", `📝 ${e.ai_summary}`);
  return lines.join("\n");
}

// ── Plain text: does it look like a new expense? ──────────────────────────────

function looksLikeNewExpense(text: string): boolean {
  if (!/\d/.test(text)) return false;
  const hasContext =
    /[$＄¥￥円元]|usd|twd|nt\$|dollar|paid|付|餐|飯|食|買|購|票|住|宿|gas|油|hotel|coffee|uber|lyft|waymo|bart|muni|park|outlet|rental|grocer|lunch|dinner|breakfast/i.test(
      text
    );
  return hasContext;
}

// ── Bot singleton ─────────────────────────────────────────────────────────────

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

// ── Shared flows ───────────────────────────────────────────────────────────────

/** Run extraction, store as pending draft, reply with the formatted summary. */
async function createDraftAndReply(
  ctx: Context,
  chatId: string,
  extractInput: Parameters<typeof extractExpense>[0],
  source: {
    telegram_message_id: string;
    original_text_context: string;
    image_file_reference: string;
  }
): Promise<void> {
  const pending = await ctx.reply("⏳ 辨識中…");
  const chatNumId = ctx.chat!.id;
  try {
    const { extracted, raw } = await extractExpense(extractInput);

    const draftData: PendingDraft = {
      draft: extracted,
      telegram_message_id: source.telegram_message_id,
      original_text_context: source.original_text_context,
      image_file_reference: source.image_file_reference,
      raw_ai_response: raw,
    };

    await setPendingDraft(chatId, draftData);
    await ctx.api.editMessageText(chatNumId, pending.message_id, formatDraft(extracted));
  } catch (err) {
    console.error("Draft creation error:", err);
    await ctx.api.editMessageText(
      chatNumId,
      pending.message_id,
      "❌ 辨識失敗，請稍後再試或改用文字輸入。"
    );
  }
}

/** Write a confirmed draft to Sheets. Keeps the draft on failure for retry. */
async function writeDraft(ctx: Context, chatId: string, pending: PendingDraft): Promise<void> {
  const writing = await ctx.reply("⏳ 寫入中…");
  try {
    await ensureHeaders();
    const expense = await appendExpense({
      extracted: pending.draft,
      source: pending.image_file_reference ? "telegram_photo" : "telegram_text",
      telegram_message_id: pending.telegram_message_id,
      original_text_context: pending.original_text_context,
      image_file_reference: pending.image_file_reference,
      raw_ai_response: pending.raw_ai_response,
    });
    await clearPendingDraft(chatId);
    await ctx.api.editMessageText(ctx.chat!.id, writing.message_id, formatConfirmed(expense));
  } catch (err) {
    console.error("Write error:", err);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      writing.message_id,
      "❌ 寫入失敗，請稍後再試。草稿已保留，再次回覆「確認」重試。"
    );
  }
}

// ── Handler registration ──────────────────────────────────────────────────────

function registerHandlers(bot: Bot) {
  const allowed = getAllowedChatIds();
  // Fail closed: an empty allow-list locks the bot rather than serving everyone.
  if (allowed.size === 0) {
    console.warn(
      "⚠️ TELEGRAM_ALLOWED_CHAT_IDS is empty — bot is LOCKED (fail-closed). " +
        "Set it to your Telegram chat id(s) to enable the bot."
    );
  }
  const isAllowed = (chatId: number) => allowed.has(String(chatId));

  // /start
  bot.command("start", (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;
    ctx.reply(
      [
        "👋 Amyrica 旅費 Bot（Aston × Amy 美國畢業旅行）",
        "",
        "📸 傳收據 / 付款截圖 → AI 辨識後顯示草稿",
        "確認後才寫入 Google Sheets",
        "",
        "📝 也可純文字：例如",
        "・Aston 晚餐 60",
        "・Amy paid gas 80",
        "・我付 outlet 120，但這是 Amy 的",
        "",
        "草稿確認：回覆「OK」或「確認」",
        "草稿修改：直接說「金額是 45」「Amy 付的」「店名翻成中文」",
        "草稿取消：回覆「取消」",
      ].join("\n")
    );
  });

  // ── Photo: always starts a new draft. Caption is high-priority context. ───
  bot.on("message:photo", async (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;

    const chatId = String(ctx.chat.id);
    const msgId = String(ctx.message.message_id);

    if (await isDuplicate(msgId)) {
      await ctx.reply("⚠️ 這則訊息已記錄過了");
      return;
    }

    const existing = await getPendingDraft(chatId);
    if (existing) {
      await ctx.reply(
        `⚠️ 已覆蓋上一筆草稿（${existing.draft.merchant}）。如需保留請先確認。`
      );
    }

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const caption = ctx.message.caption || "";

    let imageBase64: string;
    try {
      const file = await ctx.api.getFile(best.file_id);
      const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString("base64");
    } catch (err) {
      console.error("Photo download error:", err);
      await ctx.reply("❌ 無法下載圖片，請再試一次。");
      return;
    }

    await createDraftAndReply(
      ctx,
      chatId,
      { imageBase64, mimeType: "image/jpeg", textContext: caption },
      {
        telegram_message_id: msgId,
        original_text_context: caption,
        image_file_reference: best.file_id,
      }
    );
  });

  // ── Text: confirm / cancel / conversational reply / new expense ──────────
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    if (!isAllowed(ctx.chat.id)) return;

    const chatId = String(ctx.chat.id);
    const msgId = String(ctx.message.message_id);

    const pending = await getPendingDraft(chatId);

    // ── Path A: a draft is pending ────────────────────────────────────────
    if (pending) {
      // Fast paths (no AI call)
      if (CONFIRM_RE.test(text)) {
        await writeDraft(ctx, chatId, pending);
        return;
      }
      if (CANCEL_RE.test(text)) {
        await clearPendingDraft(chatId);
        await ctx.reply("🗑 已取消，草稿已刪除。");
        return;
      }

      // Otherwise classify intent — never blind field-replacement.
      const interp = await interpretReply(pending.draft, text);

      switch (interp.intent) {
        case "confirm":
          await writeDraft(ctx, chatId, pending);
          return;

        case "cancel":
          await clearPendingDraft(chatId);
          await ctx.reply("🗑 已取消，草稿已刪除。");
          return;

        case "new_expense":
          if (await isDuplicate(msgId)) {
            await ctx.reply("⚠️ 這則訊息已記錄過了");
            return;
          }
          await ctx.reply("📝 收到新的一筆，先覆蓋目前草稿。");
          await createDraftAndReply(ctx, chatId, { textContext: text }, {
            telegram_message_id: msgId,
            original_text_context: text,
            image_file_reference: "",
          });
          return;

        case "question":
          await ctx.reply(
            `${interp.reply_text || "（目前看不出答案）"}\n\n${formatDraft(pending.draft)}`
          );
          return;

        case "correct":
        case "transform":
        case "answer": {
          if (!interp.patch || Object.keys(interp.patch).length === 0) {
            await ctx.reply(`❓ 沒有可更新的內容。\n\n${formatDraft(pending.draft)}`);
            return;
          }
          const updated = finalizeDraft({ ...pending.draft, ...interp.patch });
          await setPendingDraft(chatId, { ...pending, draft: updated });
          const note = interp.reply_text ? `${interp.reply_text}\n\n` : "";
          await ctx.reply(`✏️ 已更新\n\n${note}${formatDraft(updated)}`);
          return;
        }

        case "unclear":
        default:
          await ctx.reply(`❓ 看不懂這個指令。\n\n目前草稿：\n${formatDraft(pending.draft)}`);
          return;
      }
    }

    // ── Path B: no pending draft ──────────────────────────────────────────
    if (!looksLikeNewExpense(text)) {
      await ctx.reply(
        "📸 請傳一張收據或付款截圖，或輸入包含金額的文字（例：Aston 晚餐 60、Amy paid gas 80）。"
      );
      return;
    }

    if (await isDuplicate(msgId)) {
      await ctx.reply("⚠️ 這則訊息已記錄過了");
      return;
    }

    await createDraftAndReply(ctx, chatId, { textContext: text }, {
      telegram_message_id: msgId,
      original_text_context: text,
      image_file_reference: "",
    });
  });
}

export function createWebhookHandler() {
  return webhookCallback(getBot(), "std/http");
}
