import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import {
  Expense,
  ExtractedExpense,
  ExpenseSource,
  DashboardSummary,
  ExpenseCategory,
  ALL_CATEGORIES,
} from "./types";

const SHEET_TAB = "expenses";
const SHEET_RANGE = `${SHEET_TAB}!A:Q`;

/** Column order — must match Expense field order and the documented schema. */
const HEADER_ROW = [
  "id",
  "created_at",
  "source",
  "telegram_message_id",
  "transaction_date",
  "merchant",
  "amount",
  "currency",
  "category",
  "payment_method",
  "location",
  "original_text_context",
  "ai_summary",
  "confidence_score",
  "needs_review",
  "image_file_reference",
  "raw_ai_response",
];

/**
 * Throws a clear, actionable error when Sheets credentials are missing.
 */
function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Google Sheets credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY."
    );
  }
  return new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID is not set");
  return id;
}

function sheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function expenseToRow(e: Expense): (string | number)[] {
  return [
    e.id,
    e.created_at,
    e.source,
    e.telegram_message_id,
    e.transaction_date,
    e.merchant,
    e.amount,
    e.currency,
    e.category,
    e.payment_method,
    e.location,
    e.original_text_context,
    e.ai_summary,
    e.confidence_score,
    e.needs_review ? "TRUE" : "FALSE",
    e.image_file_reference,
    e.raw_ai_response,
  ];
}

function rowToExpense(row: string[]): Expense | null {
  if (!row[0] || row[0] === "id") return null;
  return {
    id: row[0] || "",
    created_at: row[1] || "",
    source: (row[2] as ExpenseSource) || "telegram_text",
    telegram_message_id: row[3] || "",
    transaction_date: row[4] || "",
    merchant: row[5] || "",
    amount: parseFloat(row[6]) || 0,
    currency: row[7] || "JPY",
    category: (row[8] as ExpenseCategory) || "其他",
    payment_method: row[9] || "",
    location: row[10] || "",
    original_text_context: row[11] || "",
    ai_summary: row[12] || "",
    confidence_score: parseFloat(row[13]) || 0,
    needs_review: String(row[14]).toUpperCase() === "TRUE",
    image_file_reference: row[15] || "",
    raw_ai_response: row[16] || "",
  };
}

export async function ensureHeaders(): Promise<void> {
  const sheets = sheetsClient();
  const sheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_TAB}!A1:A1`,
  });
  if (res.data.values?.[0]?.[0] !== "id") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${SHEET_TAB}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] },
    });
  }
}

export async function appendExpense(params: {
  extracted: ExtractedExpense;
  source: ExpenseSource;
  telegram_message_id: string;
  original_text_context: string;
  image_file_reference: string;
  raw_ai_response: string;
}): Promise<Expense> {
  const now = new Date().toISOString();
  const expense: Expense = {
    id: uuidv4(),
    created_at: now,
    source: params.source,
    telegram_message_id: params.telegram_message_id,
    transaction_date: params.extracted.transaction_date || now.slice(0, 10),
    merchant: params.extracted.merchant,
    amount: params.extracted.amount,
    currency: params.extracted.currency,
    category: params.extracted.category,
    payment_method: params.extracted.payment_method,
    location: params.extracted.location,
    original_text_context: params.original_text_context,
    ai_summary: params.extracted.ai_summary,
    confidence_score: params.extracted.confidence_score,
    needs_review: params.extracted.needs_review,
    image_file_reference: params.image_file_reference,
    raw_ai_response: params.raw_ai_response,
  };

  await sheetsClient().spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: SHEET_RANGE,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [expenseToRow(expense)] },
  });

  return expense;
}

export async function getAllExpenses(): Promise<Expense[]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: SHEET_RANGE,
  });
  return (res.data.values || [])
    .slice(1)
    .map((r) => rowToExpense(r as string[]))
    .filter((e): e is Expense => e !== null);
}

export async function isDuplicate(
  telegram_message_id: string
): Promise<boolean> {
  if (!telegram_message_id) return false;
  const all = await getAllExpenses();
  return all.some((e) => e.telegram_message_id === telegram_message_id);
}

export function computeSummary(expenses: Expense[]): DashboardSummary {
  const total_by_currency: Record<string, number> = {};
  const currencyCounts: Record<string, number> = {};
  const by_category = Object.fromEntries(
    ALL_CATEGORIES.map((c) => [c, { total: 0, count: 0 }])
  ) as DashboardSummary["by_category"];

  let needs_review_count = 0;

  for (const e of expenses) {
    total_by_currency[e.currency] =
      (total_by_currency[e.currency] || 0) + e.amount;
    currencyCounts[e.currency] = (currencyCounts[e.currency] || 0) + 1;
    if (by_category[e.category]) {
      by_category[e.category].total += e.amount;
      by_category[e.category].count += 1;
    }
    if (e.needs_review) needs_review_count += 1;
  }

  // Primary currency = the one used in the most transactions (JPY-dominant trips).
  const primary_currency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "JPY";

  return {
    total_by_currency,
    by_category,
    primary_currency,
    total_primary: total_by_currency[primary_currency] || 0,
    count: expenses.length,
    needs_review_count,
  };
}
