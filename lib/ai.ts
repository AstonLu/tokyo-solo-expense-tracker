/**
 * AI vision / OCR extraction layer.
 *
 * Provider-agnostic seam: callers use `extractExpense()` and never import a
 * provider SDK directly. To swap providers later, replace the body of
 * `callModel()` — the input/output contract stays the same.
 *
 * Current implementation: Groq (vision-capable), configured via
 * GROQ_API_KEY (or AI_PROVIDER_API_KEY) and AI_MODEL.
 */
import Groq from "groq-sdk";
import {
  ExtractedExpense,
  ExpenseCategory,
  ALL_CATEGORIES,
  CONFIDENCE_REVIEW_THRESHOLD,
} from "./types";

export interface ExtractionInput {
  /** Base64 image data (no data: prefix), if an image was sent. */
  imageBase64?: string;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  /** Caption / free-text context the user typed with the message. */
  textContext?: string;
}

export interface ExtractionOutput {
  extracted: ExtractedExpense;
  /** Raw, unparsed model output — persisted for auditing. */
  raw: string;
}

const SYSTEM_PROMPT = `You extract a single structured expense from a traveler's payment screenshot, receipt, paper invoice, or text note.

MERCHANT IDENTIFICATION (most important):
- Look for the store name in: receipt header/top section, logo text, company name, large bold text, brand name, Japanese/Chinese store name text.
- Common Japanese chain examples: 吉野家 (Yoshinoya), すき家 (Sukiya), マクドナルド (McDonald's), セブン-イレブン (7-Eleven), ローソン (Lawson), ファミリーマート (FamilyMart), スターバックス (Starbucks), ドトール (Doutor).
- If you see Japanese katakana/hiragana text at the top that looks like a store name, use it.
- Do NOT leave merchant blank if any store identifier is visible.
- If you are uncertain about the merchant name, set confidence_score low and needs_review true — but still provide your best guess.

Rules:
- Default currency is JPY unless the document clearly shows another currency.
- amount must be the final total paid (look for 合計 / TOTAL / 総計 / お会計 on receipts).
- Japanese era dates: 令和7 = 2025, 令和8 = 2026. Output transaction_date as YYYY-MM-DD, or null if absent.
- category MUST be exactly one of: 餐飲 交通 購物 住宿 門票 其他
- payment_method: short label such as "信用卡", "現金", "IC卡", "QR支付", or "" if unknown.
- location: place/area if derivable (e.g. "Shibuya"), else "".
- ai_summary: one concise human sentence describing the expense in Traditional Chinese.
- confidence_score: a number from 0 to 1 reflecting how sure you are about amount + currency + merchant together.
- needs_review: true if amount, currency, or merchant is uncertain or missing.
- Never invent an amount. If you cannot find one, set amount to 0, confidence_score low, needs_review true.

Return ONLY a JSON object with keys:
transaction_date, merchant, amount, currency, category, payment_method, location, ai_summary, confidence_score, needs_review`;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY || process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

async function callModel(input: ExtractionInput): Promise<string> {
  const client = getClient();
  const model = process.env.AI_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

  const userContent: ContentPart[] = [];

  if (input.imageBase64) {
    const mimeType = input.mimeType || "image/jpeg";
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${input.imageBase64}` },
    });
  }

  const instruction = input.imageBase64
    ? "Extract the expense from this receipt/payment image. Pay special attention to the store name and final total amount."
    : "Extract the expense from this note.";
  const context = input.textContext
    ? `\nUser context: ${input.textContext}`
    : "";
  userContent.push({ type: "text", text: instruction + context });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    max_tokens: 1024,
    temperature: 0.1,
  });

  return response.choices[0]?.message?.content ?? "{}";
}

export async function extractExpense(
  input: ExtractionInput
): Promise<ExtractionOutput> {
  const raw = await callModel(input);
  const extracted = normalize(safeParse(raw), input.textContext);
  return { extracted, raw };
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    return {};
  }
}

function normalize(
  raw: Record<string, unknown>,
  textContext?: string
): ExtractedExpense {
  const amount =
    typeof raw.amount === "number"
      ? raw.amount
      : parseFloat(String(raw.amount ?? "")) || 0;

  const currency = String(raw.currency || "JPY").toUpperCase();
  const merchant = String(raw.merchant || "").trim();

  let confidence =
    typeof raw.confidence_score === "number"
      ? raw.confidence_score
      : parseFloat(String(raw.confidence_score ?? "")) || 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const category = (
    ALL_CATEGORIES.includes(raw.category as ExpenseCategory)
      ? raw.category
      : "其他"
  ) as ExpenseCategory;

  const coreUncertain =
    amount <= 0 ||
    !merchant ||
    confidence < CONFIDENCE_REVIEW_THRESHOLD;
  const needs_review = raw.needs_review === true || coreUncertain;

  return {
    transaction_date: raw.transaction_date
      ? String(raw.transaction_date)
      : null,
    merchant: merchant || "未知商家",
    amount,
    currency,
    category,
    payment_method: String(raw.payment_method || ""),
    location: String(raw.location || ""),
    ai_summary:
      String(raw.ai_summary || "").trim() ||
      (textContext ? textContext.slice(0, 120) : "（無摘要）"),
    confidence_score: confidence,
    needs_review,
  };
}
