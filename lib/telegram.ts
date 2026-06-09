import { Bot, Context, webhookCallback } from "grammy";
import { extractExpense } from "./ai";
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
import { Expense, ExtractedExpense, ExpenseCategory, ALL_CATEGORIES } from "./types";

// ── Keyword sets ──────────────────────────────────────────────────────────────

const CONFIRM_RE =
  /^\s*(ok|okay|確認|沒問題|對|可以|yes|好|好的|確定|寫入|記帳|存|存入)\s*$/i;

const CANCEL_RE =
  /^\s*(取消|刪掉|刪除|放棄|discard|cancel|不要|算了|不用了|不寫)\s*$/i;

// ── TWD rough estimates ───────────────────────────────────────────────────────

const APPROX_TWD: Record<string, number> = {
  JPY: 0.216,
  USD: 32.0,
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

// ── Draft formatting ──────────────────────────────────────────────────────────

function formatDraft(d: ExtractedExpense): string {
  const emoji = getCategoryEmoji(d.category);
  const twd = estimateTwd(d.amount, d.currency);
  const amountStr = `${d.amount.toLocaleString()} ${d.currency}${twd ? `（${twd}）` : ""}`;
  const confidence = `${(d.confidence_score * 100).toFixed(0)}%`;

  const lines = [
    "🧾 草稿（待確認）",
    "",
    d.transaction_date ? `📅 ${d.transaction_date}` : "📅 日期不明",
    `🏪 ${d.merchant}`,
    `💴 ${amountStr}`,
    `${emoji} ${d.category}${d.payment_method ? ` · ${d.payment_method}` : ""}`,
  ];

  if (d.location) lines.push(`📍 ${d.location}`);

  lines.push(
    `🎯 信心度：${confidence}${d.needs_review ? "（建議確認）" : ""}`,
    "",
    "───────────────",
    "✅ 回覆「確認」或「OK」→ 寫入",
    "✏️ 修改：回覆「店名是吉野家」「金額是684」「類別是餐飲」等",
    "❌ 回覆「取消」→ 丟棄草稿"
  );

  return lines.join("\n");
}

function formatConfirmed(e: Expense): string {
  const emoji = getCategoryEmoji(e.category);
  const lines = [
    e.needs_review ? "⚠️ 已記錄（建議到儀表板確認）" : "✅ 已記錄",
    "",
    `🏪 ${e.merchant}`,
    `💴 ${e.amount.toLocaleString()} ${e.currency}`,
    `${emoji} ${e.category}${e.payment_method ? ` · ${e.payment_method}` : ""}`,
  ];
  if (e.location) lines.push(`📍 ${e.location}`);
  if (e.transaction_date) lines.push(`🗓 ${e.transaction_date}`);
  lines.push("", `📝 ${e.ai_summary}`);
  if (e.needs_review) {
    lines.push(
      "",
      `🔍 信心度 ${(e.confidence_score * 100).toFixed(0)}% — 請到儀表板確認金額 / 幣別 / 商家`
    );
  }
  return lines.join("\n");
}

// ── Correction parsing ────────────────────────────────────────────────────────

const CATEGORY_PATTERNS: [RegExp, ExpenseCategory][] = [
  [/餐飲|吃飯|飲食|食物|餐廳|午餐|晚餐|早餐|咖啡|拉麵|壽司|便當|牛丼|定食/, "餐飲"],
  [/交通|電車|巴士|公車|地鐵|捷運|計程|新幹線|Suica|IC卡/, "交通"],
  [/購物|買東西|衣服|藥妝|電器|雜貨|超市|便利店|百貨/, "購物"],
  [/住宿|飯店|旅館|民宿|hostel|hotel|check.in/, "住宿"],
  [/門票|入場|景點|博物館|展覽|門|票/, "門票"],
];

function mapCategory(text: string): ExpenseCategory | null {
  const t = text.trim();
  for (const [re, cat] of CATEGORY_PATTERNS) {
    if (re.test(t)) return cat;
  }
  if ((ALL_CATEGORIES as string[]).includes(t)) return t as ExpenseCategory;
  return null;
}

/**
 * Try to extract field updates from a correction message.
 * Returns { updated, fields } if anything changed, or null if nothing matched.
 *
 * Handled patterns:
 *  Merchant : "店名是吉野家"  "商家是xxx"  "叫xxx"  plain name <= 15 CJK/alpha chars
 *  Amount   : "金額是684"  "¥684"  "684円"  bare number
 *  Category : "類別是餐飲"  "分類是xxx"
 *  Payment  : "付款是現金"  "用現金"  "刷信用卡"
 *  Date     : "日期是6/9"  "6月9日"
 */
export function applyCorrection(
  text: string,
  draft: ExtractedExpense
): { updated: ExtractedExpense; fields: string[] } | null {
  const fields: string[] = [];
  const next = { ...draft };
  const t = text.trim();

  // ── Merchant ──────────────────────────────────────────────────────────────
  const merchantExplicit = t.match(
    /^(?:店名|商家|名稱|地方|叫)\s*(?:是|：|:|叫)?\s*(.{1,30})$/
  );
  if (merchantExplicit) {
    next.merchant = merchantExplicit[1].trim();
    fields.push("商家");
  }

  // ── Amount ────────────────────────────────────────────────────────────────
  if (!fields.includes("商家")) {
    const amountMatch =
      t.match(/^(?:金額|價格|費用|共)\s*(?:是|：|:)?\s*([\d,，.]+)\s*(?:円|¥|元|JPY|TWD)?$/) ||
      t.match(/^[¥￥]([\d,，.]+)/) ||
      t.match(/^([\d,，.]+)\s*(?:円|¥|元|JPY|TWD)/) ||
      t.match(/^([\d,，.]+)$/);
    if (amountMatch) {
      const val = parseFloat(amountMatch[1].replace(/[,，]/g, ""));
      if (val > 0) {
        next.amount = val;
        fields.push("金額");
      }
    }
  }

  // ── Category ──────────────────────────────────────────────────────────────
  const catExplicit = t.match(/^(?:類別|分類|類型)\s*(?:是|：|:)?\s*(.+)$/);
  if (catExplicit) {
    const cat = mapCategory(catExplicit[1]);
    if (cat) {
      next.category = cat;
      fields.push("類別");
    }
  }

  // ── Payment method ────────────────────────────────────────────────────────
  const payMatch = t.match(
    /^(?:付款方式?|支付方式?|刷)\s*(?:是|：|:|用)?\s*(.{1,20})$/
  );
  if (payMatch) {
    next.payment_method = payMatch[1].trim();
    fields.push("付款方式");
  }

  // ── Fallback: short pure-name text → assume merchant ─────────────────────
  // e.g. user sends "吉野家" or "McDonald's" after an incorrect OCR
  if (
    fields.length === 0 &&
    t.length <= 20 &&
    /^[一-鿿぀-ゟ゠-ヿ･-ﾟa-zA-Z·・\s]+$/.test(t)
  ) {
    next.merchant = t;
    fields.push("商家");
  }

  if (fields.length === 0) return null;

  // Re-check confidence after correction
  if (fields.includes("商家") || fields.includes("金額")) {
    const stillUncertain = next.amount <= 0 || !next.merchant || next.confidence_score < 0.6;
    next.needs_review = stillUncertain;
    // Bump confidence when user explicitly corrects key fields
    if (!stillUncertain && next.confidence_score < 0.7) {
      next.confidence_score = 0.75;
    }
  }

  return { updated: next, fields };
}

// ── Plain text: does it look like a new expense? ──────────────────────────────

function looksLikeNewExpense(text: string): boolean {
  const hasAmount = /\d+/.test(text);
  if (!hasAmount) return false;
  const hasContext =
    /[¥￥円元]|JPY|TWD|NT\$|餐|飯|食|買|購|票|住|宿|乘|搭|電車|巴士|計程|咖啡|便利/.test(text);
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

// ── Shared draft → confirm flow ───────────────────────────────────────────────

/**
 * Run OCR, store as pending draft, reply with summary.
 * Called from both the photo handler and (when text looks like a new expense)
 * the text handler.
 */
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

// ── Handler registration ──────────────────────────────────────────────────────

function registerHandlers(bot: Bot) {
  const allowed = getAllowedChatIds();
  const isAllowed = (chatId: number) =>
    allowed.size === 0 || allowed.has(String(chatId));

  // /start
  bot.command("start", (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;
    ctx.reply(
      [
        "👋 旅行記帳 Bot",
        "",
        "📸 傳一張收據 / 付款截圖 → AI 辨識後顯示草稿",
        "確認後才寫入 Google Sheets",
        "",
        "📝 也可純文字：晚餐 2800 日圓 信用卡",
        "",
        "草稿確認：回覆「OK」或「確認」",
        "草稿修改：回覆「店名是xxx」「金額是xxx」",
        "草稿取消：回覆「取消」",
      ].join("\n")
    );
  });

  // ── Photo: always starts a new draft ─────────────────────────────────────
  bot.on("message:photo", async (ctx) => {
    if (!isAllowed(ctx.chat.id)) return;

    const chatId = String(ctx.chat.id);
    const msgId = String(ctx.message.message_id);

    if (await isDuplicate(msgId)) {
      await ctx.reply("⚠️ 這則訊息已記錄過了");
      return;
    }

    // If there's a pending draft, overwrite it (new photo = new intent)
    const existing = await getPendingDraft(chatId);
    if (existing) {
      await ctx.reply(
        `⚠️ 已覆蓋上一筆草稿（${existing.draft.merchant}）。如需保留請先確認。`
      );
    }

    const photos = ctx.message.photo;
    const best = photos[photos.length - 1];
    const caption = ctx.message.caption || "";

    // Download photo
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

    await createDraftAndReply(ctx, chatId, { imageBase64, mimeType: "image/jpeg", textContext: caption }, {
      telegram_message_id: msgId,
      original_text_context: caption,
      image_file_reference: best.file_id,
    });
  });

  // ── Text: correction / confirm / cancel / new expense ────────────────────
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return;
    if (!isAllowed(ctx.chat.id)) return;

    const chatId = String(ctx.chat.id);
    const msgId = String(ctx.message.message_id);

    const pending = await getPendingDraft(chatId);

    // ── Path A: pending draft exists ──────────────────────────────────────
    if (pending) {
      // Confirm
      if (CONFIRM_RE.test(text)) {
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
          await ctx.api.editMessageText(
            ctx.chat.id,
            writing.message_id,
            formatConfirmed(expense)
          );
        } catch (err) {
          console.error("Write error:", err);
          await ctx.api.editMessageText(
            ctx.chat.id,
            writing.message_id,
            "❌ 寫入失敗，請稍後再試。草稿已保留，再次回覆「確認」重試。"
          );
        }
        return;
      }

      // Cancel
      if (CANCEL_RE.test(text)) {
        await clearPendingDraft(chatId);
        await ctx.reply("🗑 已取消，草稿已刪除。");
        return;
      }

      // Correction
      const result = applyCorrection(text, pending.draft);
      if (result) {
        const { updated, fields } = result;
        // Persist updated draft
        await setPendingDraft(chatId, { ...pending, draft: updated });
        await ctx.reply(
          `✏️ 已更新：${fields.join("、")}\n\n${formatDraft(updated)}`
        );
      } else {
        // Ambiguous — show current draft and ask
        await ctx.reply(
          `❓ 看不懂這個修改指令。\n\n目前草稿：\n${formatDraft(pending.draft)}`
        );
      }
      return;
    }

    // ── Path B: no pending draft ──────────────────────────────────────────
    // Only create a draft if text clearly looks like a new expense.
    // Prevents correction text like "吉野家" from creating 0-yen records.
    if (!looksLikeNewExpense(text)) {
      await ctx.reply(
        "📸 請傳一張收據或付款截圖，或輸入包含金額的文字（例：拉麵 980 日圓）。"
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
