/**
 * Tokyo Solo Expense Tracker — Google Apps Script Webhook
 *
 * ALTERNATIVE to the Next.js webhook route.
 * Use this if you want zero-infra ingestion without deploying to Vercel.
 *
 * Setup:
 * 1. Open script.google.com → New project
 * 2. Paste this code
 * 3. Set Script Properties (Project Settings → Script Properties):
 *    - TELEGRAM_BOT_TOKEN
 *    - TELEGRAM_WEBHOOK_SECRET
 *    - TELEGRAM_ALLOWED_CHAT_IDS  (comma-separated)
 *    - GEMINI_API_KEY
 *    - GOOGLE_SHEET_ID
 * 4. Deploy → New deployment → Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy the web app URL
 * 6. Set Telegram webhook:
 *    curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WEB_APP_URL>&secret_token=<SECRET>"
 */

const SHEET_NAME = "expenses";
const HEADER_ROW = [
  "id", "created_at", "trip_id", "date", "merchant", "item_name",
  "amount", "currency", "category", "payer", "split_method",
  "source", "confidence", "raw_text", "telegram_chat_id",
  "telegram_message_id", "telegram_file_id", "status", "notes",
];
const TRIP_ID = "tokyo_2d1n_mvp";

// ── Webhook entry point ────────────────────────────────────────────────────

function doPost(e) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty("TELEGRAM_WEBHOOK_SECRET");

  // Verify secret if configured
  if (secret) {
    const incomingSecret = e.parameter["secret_token"] ||
      (e.headers && e.headers["X-Telegram-Bot-Api-Secret-Token"]);
    if (incomingSecret !== secret) {
      return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
    }
  }

  try {
    const update = JSON.parse(e.postData.contents);
    handleUpdate(update);
  } catch (err) {
    console.error("Webhook error:", err);
  }

  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

function handleUpdate(update) {
  const msg = update.message;
  if (!msg) return;

  const props = PropertiesService.getScriptProperties();
  const allowedIds = (props.getProperty("TELEGRAM_ALLOWED_CHAT_IDS") || "")
    .split(",").map(s => s.trim()).filter(Boolean);

  if (allowedIds.length > 0 && !allowedIds.includes(String(msg.chat.id))) return;

  const chatId = String(msg.chat.id);
  const msgId = String(msg.message_id);

  if (isDuplicate(chatId, msgId)) {
    sendTelegramMessage(chatId, "⚠️ 此訊息已記錄過");
    return;
  }

  if (msg.text && !msg.text.startsWith("/")) {
    handleTextMessage(msg, chatId, msgId);
  } else if (msg.photo) {
    handlePhotoMessage(msg, chatId, msgId);
  } else if (msg.text && msg.text.startsWith("/start")) {
    sendTelegramMessage(chatId,
      "👋 東京記帳 Bot 已啟動\n\n格式：品項 金額 [Amy付] [分類]\n例：晚餐 2800 Amy付 餐飲\n\n或直接傳收據照片"
    );
  }
}

// ── Text message handler ───────────────────────────────────────────────────

function handleTextMessage(msg, chatId, msgId) {
  sendTelegramMessage(chatId, "⏳ 解析中…");

  try {
    const extracted = extractWithGemini({ text: msg.text });
    const expense = appendToSheet({
      extracted,
      source: "telegram_text",
      raw_text: msg.text,
      telegram_chat_id: chatId,
      telegram_message_id: msgId,
      telegram_file_id: "",
    });
    sendTelegramMessage(chatId, formatConfirmation(expense));
  } catch (err) {
    console.error("Text extraction failed:", err);
    sendTelegramMessage(chatId, "❌ 解析失敗，格式：品項 金額 [Amy付] [分類]");
  }
}

// ── Photo message handler ──────────────────────────────────────────────────

function handlePhotoMessage(msg, chatId, msgId) {
  sendTelegramMessage(chatId, "⏳ 辨識收據中…");

  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty("TELEGRAM_BOT_TOKEN");
    const best = msg.photo[msg.photo.length - 1];

    // Get file path
    const fileRes = UrlFetchApp.fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${best.file_id}`
    );
    const filePath = JSON.parse(fileRes.getContentText()).result.file_path;

    // Download photo as base64
    const photoRes = UrlFetchApp.fetch(
      `https://api.telegram.org/file/bot${token}/${filePath}`
    );
    const photoBase64 = Utilities.base64Encode(photoRes.getContent());

    const extracted = extractWithGemini({
      imageBase64: photoBase64,
      caption: msg.caption,
    });

    const expense = appendToSheet({
      extracted,
      source: "telegram_photo",
      raw_text: msg.caption || "",
      telegram_chat_id: chatId,
      telegram_message_id: msgId,
      telegram_file_id: best.file_id,
    });

    sendTelegramMessage(chatId, formatConfirmation(expense));
  } catch (err) {
    console.error("Photo extraction failed:", err);
    sendTelegramMessage(chatId, "❌ 辨識失敗，請重試或改用文字輸入");
  }
}

// ── Gemini extraction ──────────────────────────────────────────────────────

function extractWithGemini({ text, imageBase64, caption }) {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEMINI_API_KEY");

  const systemPrompt = `You are an expense extraction assistant for a Tokyo travel expense tracker.
Two travelers: Aston and Amy. Rules:
- Default currency JPY, payer Aston, split_method 平分
- If "Amy付/Amy支付" → payer: Amy
- If "Aston only/只有Aston" → split_method: Aston only
- If "Amy only/只有Amy" → split_method: Amy only
Categories: 餐飲 交通 購物 住宿 門票 其他
Return JSON only with: merchant, item_name, amount, currency, category, payer, split_method, confidence (high/medium/low), date (YYYY-MM-DD or null), notes`;

  const parts = [];
  if (imageBase64) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
    parts.push({ text: caption ? `Caption: ${caption}. Extract expense.` : "Extract expense from receipt." });
  } else {
    parts.push({ text: `${systemPrompt}\n\nExtract expense: "${text}"` });
  }

  const payload = {
    contents: [{ parts }],
    generationConfig: { responseMimeType: "application/json" },
  };

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
    }
  );

  const data = JSON.parse(res.getContentText());
  const raw = JSON.parse(data.candidates[0].content.parts[0].text);
  return normalizeExtracted(raw);
}

function normalizeExtracted(raw) {
  const validCategories = ["餐飲", "交通", "購物", "住宿", "門票", "其他"];
  return {
    merchant: raw.merchant || "Unknown",
    item_name: raw.item_name || raw.merchant || "Unknown",
    amount: parseFloat(raw.amount) || 0,
    currency: (raw.currency || "JPY").toUpperCase(),
    category: validCategories.includes(raw.category) ? raw.category : "其他",
    payer: ["Aston", "Amy"].includes(raw.payer) ? raw.payer : "Aston",
    split_method: ["平分", "Aston only", "Amy only"].includes(raw.split_method) ? raw.split_method : "平分",
    confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "medium",
    date: raw.date || null,
    notes: raw.notes || "",
  };
}

// ── Google Sheets ──────────────────────────────────────────────────────────

function getSheet() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty("GOOGLE_SHEET_ID");
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER_ROW);
  }
  const firstCell = sheet.getRange("A1").getValue();
  if (firstCell !== "id") sheet.insertRowBefore(1) && sheet.getRange("A1:S1").setValues([HEADER_ROW]);
  return sheet;
}

function appendToSheet({ extracted, source, raw_text, telegram_chat_id, telegram_message_id, telegram_file_id }) {
  const sheet = getSheet();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const id = Utilities.getUuid();

  const row = [
    id,
    now,
    TRIP_ID,
    extracted.date || today,
    extracted.merchant,
    extracted.item_name,
    extracted.amount,
    extracted.currency,
    extracted.category,
    extracted.payer,
    extracted.split_method,
    source,
    extracted.confidence,
    raw_text,
    telegram_chat_id,
    telegram_message_id,
    telegram_file_id,
    extracted.confidence === "low" ? "needs_review" : "confirmed",
    extracted.notes,
  ];

  sheet.appendRow(row);
  return Object.fromEntries(HEADER_ROW.map((k, i) => [k, row[i]]));
}

function isDuplicate(chatId, msgId) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const chatIdx = HEADER_ROW.indexOf("telegram_chat_id");
  const msgIdx = HEADER_ROW.indexOf("telegram_message_id");
  return data.slice(1).some(row => String(row[chatIdx]) === chatId && String(row[msgIdx]) === msgId);
}

// ── Telegram API ───────────────────────────────────────────────────────────

function sendTelegramMessage(chatId, text) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("TELEGRAM_BOT_TOKEN");
  UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text }),
  });
}

function formatConfirmation(expense) {
  const categoryEmojis = { "餐飲": "🍜", "交通": "🚇", "購物": "🛍️", "住宿": "🏨", "門票": "🎫", "其他": "📦" };
  const emoji = categoryEmojis[expense.category] || "📦";
  const reviewNote = expense.status === "needs_review" ? "\n⚠️ 信心度較低，請稍後確認" : "";
  return `✅ 已記帳\n\n${emoji} ${expense.item_name}\n🏪 ${expense.merchant}\n💴 ¥${Math.round(expense.amount).toLocaleString()}\n👤 ${expense.payer} 付 · ${expense.split_method}\n📂 ${expense.category}${reviewNote}`;
}
