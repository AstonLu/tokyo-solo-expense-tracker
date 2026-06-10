export type ExpenseCategory =
  | "餐飲"
  | "交通"
  | "購物"
  | "住宿"
  | "門票"
  | "其他";

export type ExpenseSource = "telegram_photo" | "telegram_text";

/** Who fronted the money. */
export type PaidBy = "aston" | "amy" | "unknown";

/** Who the expense is for, which determines how it splits. */
export type BenefitType =
  | "shared_50_50"
  | "aston_only"
  | "amy_only"
  | "custom"
  | "unknown";

/**
 * A single expense record. Mirrors the Google Sheets column order (A:Y).
 * Columns R–Y were appended after the original Tokyo schema (A:Q); old rows
 * simply lack them and fall back to safe defaults on read.
 */
export interface Expense {
  id: string;
  created_at: string;
  source: ExpenseSource;
  telegram_message_id: string;
  transaction_date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  payment_method: string;
  location: string;
  original_text_context: string;
  ai_summary: string;
  confidence_score: number;
  needs_review: boolean;
  image_file_reference: string;
  raw_ai_response: string;
  // ── Split-expense fields (US trip) ──
  paid_by: PaidBy;
  benefit_type: BenefitType;
  aston_share_amount: number;
  amy_share_amount: number;
  split_note: string;
  missing_fields: string[];
  merchant_display_name_zh: string;
  inferred_items: string;
}

/**
 * Structured fields produced by the AI vision/OCR layer.
 * `original_text_context` and `image_file_reference` come from Telegram, not the model.
 * Share amounts are computed deterministically in `lib/split.ts`, never by the model.
 */
export interface ExtractedExpense {
  transaction_date: string | null;
  merchant: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  payment_method: string;
  location: string;
  ai_summary: string;
  confidence_score: number;
  needs_review: boolean;
  // ── Split-expense fields ──
  paid_by: PaidBy;
  benefit_type: BenefitType;
  aston_share_amount: number;
  amy_share_amount: number;
  split_note: string;
  /** Required fields still missing, e.g. ["amount","paid_by"]. Drives clarification. */
  missing_fields: string[];
  /** Normalized / translated merchant name for display (e.g. zh-TW). */
  merchant_display_name_zh: string;
  /** Items inferred from the receipt, comma-joined. */
  inferred_items: string;
}

export interface Settlement {
  direction: "amy_owes_aston" | "aston_owes_amy" | "settled";
  /** Absolute amount owed, in USD (rough cross-currency estimate). */
  amount_usd: number;
}

export interface DashboardSummary {
  total_by_currency: Record<string, number>;
  by_category: Record<ExpenseCategory, { total: number; count: number }>;
  primary_currency: string;
  total_primary: number;
  count: number;
  needs_review_count: number;
  // ── Split totals (USD estimate) ──
  aston_paid_usd: number;
  amy_paid_usd: number;
  aston_share_usd: number;
  amy_share_usd: number;
  settlement: Settlement;
}

export interface ExpensesApiResponse {
  transactions: Expense[];
  summary: DashboardSummary;
}

export const ALL_CATEGORIES: ExpenseCategory[] = [
  "餐飲",
  "交通",
  "購物",
  "住宿",
  "門票",
  "其他",
];

/** Below this confidence the record is flagged for manual review. */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.6;
