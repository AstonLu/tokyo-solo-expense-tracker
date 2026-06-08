export type ExpenseCategory =
  | "餐飲"
  | "交通"
  | "購物"
  | "住宿"
  | "門票"
  | "其他";

export type ExpenseSource = "telegram_photo" | "telegram_text";

/**
 * A single expense record. Mirrors the Google Sheets column order (A:Q).
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
}

/**
 * Structured fields produced by the AI vision/OCR layer.
 * `original_text_context` and `image_file_reference` come from Telegram, not the model.
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
}

export interface DashboardSummary {
  total_by_currency: Record<string, number>;
  by_category: Record<ExpenseCategory, { total: number; count: number }>;
  primary_currency: string;
  total_primary: number;
  count: number;
  needs_review_count: number;
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
