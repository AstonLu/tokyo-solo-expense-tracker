export type ExpenseCategory =
  | "餐飲"
  | "交通"
  | "購物"
  | "住宿"
  | "門票"
  | "其他";

export type Payer = "Aston" | "Amy";
export type SplitMethod = "平分" | "Aston only" | "Amy only";
export type Confidence = "high" | "medium" | "low";
export type ExpenseStatus = "confirmed" | "needs_review";
export type ExpenseSource = "telegram_text" | "telegram_photo" | "manual";

export interface Expense {
  id: string;
  created_at: string;
  trip_id: string;
  date: string;
  merchant: string;
  item_name: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  payer: Payer;
  split_method: SplitMethod;
  source: ExpenseSource;
  confidence: Confidence;
  raw_text: string;
  telegram_chat_id: string;
  telegram_message_id: string;
  telegram_file_id: string;
  status: ExpenseStatus;
  notes: string;
}

export interface ExtractedExpense {
  merchant: string;
  item_name: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  payer: Payer;
  split_method: SplitMethod;
  confidence: Confidence;
  date: string | null;
  notes: string;
}

export interface BalanceSummary {
  aston_total_paid: number;
  amy_total_paid: number;
  // positive = Amy owes Aston; negative = Aston owes Amy
  net_balance: number;
  total_spend: number;
  count: number;
  by_category: Record<ExpenseCategory, { total: number; count: number }>;
}

export const TRIP_ID = "tokyo_2d1n_mvp";

export const ALL_CATEGORIES: ExpenseCategory[] = [
  "餐飲",
  "交通",
  "購物",
  "住宿",
  "門票",
  "其他",
];
