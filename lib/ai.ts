/**
 * AI vision / OCR extraction layer.
 *
 * Provider-agnostic seam: callers use `extractExpense()` and never import a
 * provider SDK directly. To swap providers later, replace the body of
 * `callModel()` — the input/output contract stays the same.
 *
 * Current implementation: Google Gemini (vision-capable), configured via
 * AI_PROVIDER_API_KEY and AI_MODEL.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
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

Rules:
- Default currency is JPY unless the document clearly shows another currency.
- amount must be the final total paid (look for 合計 / TOTAL / 総計 on receipts).
- Japanese era dates: 令和7 = 2025, 令和8 = 2026. Output transaction_date as YYYY-MM-DD, or null if absent.
- category MUST be exactly one of: 餐飲 交通 購物 住宿 門票 其他
- payment_method: short label such as "信用卡", "現金", "IC卡", "QR支付", or "" if unknown.
- location: place/area if derivable (e.g. "Shibuya"), else "".
- ai_summary: one concise human sentence describing the expense.
- confidence_score: a number from 0 to 1 reflecting how sure you are about amount + currency + merchant together.
- needs_review: true if amount, currency, or merchant is uncertain or missing.
- Never invent an amount. If you cannot find one, set amount to 0, confidence_score low, needs_review true.

Return ONLY a JSON object with keys:
transaction_date, merchant, amount, currency, category, payment_method, location, ai_summary, confidence_score, needs_review`;

function getModel() {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) throw new Error("AI_PROVIDER_API_KEY is not set");
  const modelName = process.env.AI_MODEL || "gemini-1.5-flash";
  const client = new GoogleGenerativeAI(apiKey);
  return client.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json" },
  });
}

async function callModel(input: ExtractionInput): Promise<string> {
  const model = getModel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];

  if (input.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: input.mimeType || "image/jpeg",
        data: input.imageBase64,
      },
    });
  }

  const instruction = input.imageBase64
    ? "Extract the expense from this image."
    : "Extract the expense from this note.";
  const context = input.textContext
    ? `\nUser context: ${input.textContext}`
    : "";
  parts.push({ text: instruction + context });

  const result = await model.generateContent(parts);
  return result.response.text();
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
    // Some models wrap JSON in prose or fences — recover the first JSON object.
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

  // Enforce review whenever the core fields look weak, regardless of model claim.
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
