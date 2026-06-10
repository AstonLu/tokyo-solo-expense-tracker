/**
 * AI vision / OCR + conversation layer.
 *
 * Provider-agnostic seam: callers use `extractExpense()` / `interpretReply()`
 * and never import a provider SDK directly. To swap providers later, replace
 * the body of `getClient()` / the call sites — the input/output contracts stay.
 *
 * Current implementation: Groq (vision-capable), configured via
 * GROQ_API_KEY (or AI_PROVIDER_API_KEY) and AI_MODEL.
 *
 * Division of labor: the model *classifies and infers* (merchant, payer,
 * benefit type, items). The money split is computed deterministically in
 * `lib/split.ts` — never trust the model's arithmetic, only its labels.
 */
import Groq from "groq-sdk";
import {
  ExtractedExpense,
  ExpenseCategory,
  ALL_CATEGORIES,
  PaidBy,
  BenefitType,
  CONFIDENCE_REVIEW_THRESHOLD,
} from "./types";
import { computeShares } from "./split";

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

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

const PAID_BY_VALUES: PaidBy[] = ["aston", "amy", "unknown"];
const BENEFIT_VALUES: BenefitType[] = [
  "shared_50_50",
  "aston_only",
  "amy_only",
  "custom",
  "unknown",
];

const SYSTEM_PROMPT = `You extract a single structured expense from a traveler's payment screenshot, receipt, paper invoice, or text note for a two-person US road trip (Aston and Amy).

TRIP CONTEXT: 2026 US graduation trip — Los Angeles, Zion, Salt Lake City, Yellowstone, Bozeman, San Francisco, Palo Alto. Typical spend: restaurants, coffee, groceries, outlet shopping, hotels, rental car, gas, national park fees, domestic flights, Uber/Waymo/BART/Muni.

MERCHANT (important):
- Read the store name from the receipt header, logo, or large bold text.
- Provide your best guess; never leave it blank. If unsure, set confidence low.
- merchant_display_name_zh: a short Traditional Chinese display name IF the merchant is well-known (e.g. "Trader Joe's" → "Trader Joe's 超市", "Chevron" → "Chevron 加油站"); otherwise "".

PAYER & SPLIT (read the user's caption/text — it OVERRIDES the image):
- paid_by: who fronted the money — "aston", "amy", or "unknown". "我"/"I" means Aston.
- benefit_type: who the expense is for:
    "shared_50_50" — joint expense, split evenly (DEFAULT when payer is known but nothing says otherwise)
    "aston_only"   — only Aston benefits
    "amy_only"     — only Amy benefits
    "custom"       — an explicit uneven split (e.g. "split 70/30")
    "unknown"      — cannot tell
- For "custom", also return aston_share_amount and amy_share_amount in the SAME currency, summing to amount. For non-custom, return 0 for both (the app computes shares).
- The caption wins over the receipt. Examples:
    "Aston paid dinner $60"               → paid_by aston, shared_50_50
    "Amy paid gas $80"                    → paid_by amy,   shared_50_50
    "Amy paid this but 100% mine"         → paid_by amy,   aston_only
    "我付 outlet 120，但這是 Amy 的東西"    → paid_by aston, amy_only
    "hotel $300 split 70/30"              → paid_by unknown unless stated, custom, shares 210 / 90

OTHER FIELDS:
- amount: final total paid (look for TOTAL / Amount Due / Balance). Never invent one; if absent, amount 0, confidence low.
- currency: default USD unless the document clearly shows another (e.g. TWD, JPY).
- category: EXACTLY one of: 餐飲 交通 購物 住宿 門票 其他.
- transaction_date: YYYY-MM-DD if visible, else null.
- payment_method: short label such as "信用卡", "現金", "Apple Pay", or "".
- location: city/area if derivable (e.g. "Springdale"), else "".
- inferred_items: comma-separated key items if visible on the receipt, else "".
- ai_summary: one concise Traditional Chinese sentence describing the expense.
- confidence_score: 0..1 over amount + currency + merchant together.
- split_note: a short note if the split is unusual (e.g. "Amy 代墊，全額算 Aston"), else "".

Return ONLY a JSON object with keys:
transaction_date, merchant, merchant_display_name_zh, amount, currency, category, payment_method, location, inferred_items, paid_by, benefit_type, aston_share_amount, amy_share_amount, split_note, ai_summary, confidence_score`;

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
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const userContent: ContentPart[] = [];

  if (input.imageBase64) {
    const mimeType = input.mimeType || "image/jpeg";
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${input.imageBase64}` },
    });
  }

  const instruction = input.imageBase64
    ? "Extract the expense from this receipt/payment image. Focus on store name and final total."
    : "Extract the expense from this note.";
  const context = input.textContext
    ? `\nUser caption/text (HIGH PRIORITY — overrides the image for payer/benefit/merchant): ${input.textContext}`
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

function toNumber(v: unknown): number {
  return typeof v === "number" ? v : parseFloat(String(v ?? "")) || 0;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  return String(v).trim();
}

function asPaidBy(v: unknown): PaidBy {
  const s = String(v ?? "").toLowerCase();
  return (PAID_BY_VALUES as string[]).includes(s) ? (s as PaidBy) : "unknown";
}

function asBenefit(v: unknown): BenefitType {
  const s = String(v ?? "").toLowerCase();
  return (BENEFIT_VALUES as string[]).includes(s) ? (s as BenefitType) : "unknown";
}

/**
 * Recompute the deterministic, derived fields of a draft: per-person shares,
 * missing required fields, and the needs_review flag. Call this after any
 * change to amount / paid_by / benefit_type.
 */
export function finalizeDraft(e: ExtractedExpense): ExtractedExpense {
  const shares = computeShares({
    amount: e.amount,
    benefit_type: e.benefit_type,
    aston_share_amount: e.benefit_type === "custom" ? e.aston_share_amount : undefined,
    amy_share_amount: e.benefit_type === "custom" ? e.amy_share_amount : undefined,
  });

  const missing: string[] = [];
  if (!(e.amount > 0)) missing.push("amount");
  if (!e.merchant || e.merchant === "未知商家") missing.push("merchant");
  if (e.paid_by === "unknown") missing.push("paid_by");

  const needs_review =
    missing.length > 0 || e.confidence_score < CONFIDENCE_REVIEW_THRESHOLD;

  return { ...e, ...shares, missing_fields: missing, needs_review };
}

function normalize(
  raw: Record<string, unknown>,
  textContext?: string
): ExtractedExpense {
  const amount = toNumber(raw.amount);
  const currency = toStr(raw.currency || "USD").toUpperCase() || "USD";
  const merchant = toStr(raw.merchant);

  let confidence =
    typeof raw.confidence_score === "number"
      ? raw.confidence_score
      : parseFloat(String(raw.confidence_score ?? "")) || 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const category = (
    ALL_CATEGORIES.includes(raw.category as ExpenseCategory) ? raw.category : "其他"
  ) as ExpenseCategory;

  const base: ExtractedExpense = {
    transaction_date: raw.transaction_date ? String(raw.transaction_date) : null,
    merchant: merchant || "未知商家",
    amount,
    currency,
    category,
    payment_method: toStr(raw.payment_method),
    location: toStr(raw.location),
    ai_summary:
      toStr(raw.ai_summary) || (textContext ? textContext.slice(0, 120) : "（無摘要）"),
    confidence_score: confidence,
    needs_review: false, // set by finalizeDraft
    paid_by: asPaidBy(raw.paid_by),
    benefit_type: asBenefit(raw.benefit_type),
    aston_share_amount: toNumber(raw.aston_share_amount),
    amy_share_amount: toNumber(raw.amy_share_amount),
    split_note: toStr(raw.split_note),
    missing_fields: [],
    merchant_display_name_zh: toStr(raw.merchant_display_name_zh),
    inferred_items: toStr(raw.inferred_items),
  };

  return finalizeDraft(base);
}

// ── Conversational reply interpretation ────────────────────────────────────────
//
// When a pending draft exists and the user replies with something that is not a
// plain confirm/cancel, classify their intent instead of blindly overwriting a
// field. This prevents bugs like "請幫我把店名翻譯成中文" setting the merchant to
// the literal string "翻譯成中文".

export type ReplyIntent =
  | "confirm"
  | "cancel"
  | "correct"
  | "transform"
  | "answer"
  | "question"
  | "new_expense"
  | "unclear";

export interface ReplyInterpretation {
  intent: ReplyIntent;
  /** Whitelisted fields to merge into the draft (correct / transform / answer). */
  patch?: Partial<ExtractedExpense>;
  /** Bot's textual reply, in zh-TW (question / transform note). */
  reply_text?: string;
  /** A follow-up clarification question, if still needed. */
  follow_up_question?: string;
}

const REPLY_SYSTEM_PROMPT = `You are the conversation brain of a two-person (Aston & Amy) travel expense bot. A DRAFT expense is pending confirmation. The user just replied. Classify their intent and, when appropriate, return field updates. Do NOT do arithmetic on shares — the app computes those.

intent is one of:
- "confirm"      — they approve writing the draft as-is
- "cancel"       — they want to discard the draft
- "correct"      — they want to change a field value (merchant, amount, currency, category, payment_method, paid_by, benefit_type, transaction_date, location)
- "transform"    — they ask to TRANSFORM existing data, not supply a new value. e.g. "把店名翻譯成中文", "merchant 用中文", "normalize the name". Do the transform yourself and return it in patch.merchant_display_name_zh (and/or patch.merchant). NEVER put the instruction text itself into a field.
- "answer"       — they are answering a clarification question (e.g. "Aston 付的" → patch.paid_by="aston"; "各付一半" → patch.benefit_type="shared_50_50")
- "question"     — they ask a question about this expense (e.g. "這筆多少錢？", "誰付的？"). Put a concise zh-TW answer in reply_text.
- "new_expense"  — the reply is clearly a brand-new expense, not about the draft
- "unclear"      — cannot tell

paid_by ∈ aston|amy|unknown ("我"/"I" = aston). benefit_type ∈ shared_50_50|aston_only|amy_only|custom|unknown. category ∈ 餐飲 交通 購物 住宿 門票 其他.

For "custom" benefit, you may set patch.aston_share_amount and patch.amy_share_amount (same currency, summing to amount).

Return ONLY JSON: { "intent": "...", "patch": { ...optional fields... }, "reply_text": "...optional zh-TW...", "follow_up_question": "...optional zh-TW..." }`;

const PATCHABLE_STRING_FIELDS = [
  "merchant",
  "merchant_display_name_zh",
  "currency",
  "payment_method",
  "location",
  "split_note",
  "inferred_items",
] as const;

function buildPatch(rawPatch: Record<string, unknown>): Partial<ExtractedExpense> {
  const patch: Partial<ExtractedExpense> = {};

  for (const f of PATCHABLE_STRING_FIELDS) {
    if (rawPatch[f] != null && toStr(rawPatch[f]) !== "") {
      (patch as Record<string, unknown>)[f] = toStr(rawPatch[f]);
    }
  }
  if (rawPatch.amount != null && toNumber(rawPatch.amount) > 0) {
    patch.amount = toNumber(rawPatch.amount);
  }
  if (rawPatch.transaction_date != null && toStr(rawPatch.transaction_date) !== "") {
    patch.transaction_date = toStr(rawPatch.transaction_date);
  }
  if (rawPatch.category != null && ALL_CATEGORIES.includes(rawPatch.category as ExpenseCategory)) {
    patch.category = rawPatch.category as ExpenseCategory;
  }
  if (rawPatch.paid_by != null) {
    const pb = asPaidBy(rawPatch.paid_by);
    if (pb !== "unknown" || String(rawPatch.paid_by).toLowerCase() === "unknown") patch.paid_by = pb;
  }
  if (rawPatch.benefit_type != null) {
    const bt = asBenefit(rawPatch.benefit_type);
    if (bt !== "unknown" || String(rawPatch.benefit_type).toLowerCase() === "unknown") patch.benefit_type = bt;
  }
  if (rawPatch.aston_share_amount != null) patch.aston_share_amount = toNumber(rawPatch.aston_share_amount);
  if (rawPatch.amy_share_amount != null) patch.amy_share_amount = toNumber(rawPatch.amy_share_amount);

  return patch;
}

const VALID_INTENTS: ReplyIntent[] = [
  "confirm",
  "cancel",
  "correct",
  "transform",
  "answer",
  "question",
  "new_expense",
  "unclear",
];

/**
 * Interpret a user's reply to a pending draft. One model call; output is
 * validated and whitelisted before reaching the draft.
 */
export async function interpretReply(
  draft: ExtractedExpense,
  userText: string
): Promise<ReplyInterpretation> {
  const client = getClient();
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const draftJson = JSON.stringify({
    merchant: draft.merchant,
    merchant_display_name_zh: draft.merchant_display_name_zh,
    amount: draft.amount,
    currency: draft.currency,
    category: draft.category,
    payment_method: draft.payment_method,
    transaction_date: draft.transaction_date,
    location: draft.location,
    paid_by: draft.paid_by,
    benefit_type: draft.benefit_type,
    missing_fields: draft.missing_fields,
  });

  let content = "{}";
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: REPLY_SYSTEM_PROMPT },
        { role: "user", content: `Current draft:\n${draftJson}\n\nUser reply:\n${userText}` },
      ],
      max_tokens: 600,
      temperature: 0.1,
    });
    content = response.choices[0]?.message?.content ?? "{}";
  } catch {
    return { intent: "unclear" };
  }

  const parsed = safeParse(content);
  const intent = VALID_INTENTS.includes(parsed.intent as ReplyIntent)
    ? (parsed.intent as ReplyIntent)
    : "unclear";

  const rawPatch =
    parsed.patch && typeof parsed.patch === "object"
      ? (parsed.patch as Record<string, unknown>)
      : {};

  return {
    intent,
    patch: buildPatch(rawPatch),
    reply_text: toStr(parsed.reply_text) || undefined,
    follow_up_question: toStr(parsed.follow_up_question) || undefined,
  };
}
