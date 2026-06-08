import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import { Expense, ExtractedExpense, BalanceSummary, TRIP_ID, ALL_CATEGORIES, ExpenseCategory, ExpenseSource } from "./types";

const SHEET_RANGE = "expenses!A:S";
const HEADER_ROW = [
  "id", "created_at", "trip_id", "date", "merchant", "item_name",
  "amount", "currency", "category", "payer", "split_method",
  "source", "confidence", "raw_text", "telegram_chat_id",
  "telegram_message_id", "telegram_file_id", "status", "notes",
];

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Google service account credentials not set");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetId() {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID is not set");
  return id;
}

function rowToExpense(row: string[]): Expense | null {
  if (!row[0] || row[0] === "id") return null; // skip header or empty
  return {
    id: row[0] || "",
    created_at: row[1] || "",
    trip_id: row[2] || TRIP_ID,
    date: row[3] || "",
    merchant: row[4] || "",
    item_name: row[5] || "",
    amount: parseFloat(row[6]) || 0,
    currency: row[7] || "JPY",
    category: (row[8] as ExpenseCategory) || "其他",
    payer: (row[9] as Expense["payer"]) || "Aston",
    split_method: (row[10] as Expense["split_method"]) || "平分",
    source: (row[11] as ExpenseSource) || "telegram_text",
    confidence: (row[12] as Expense["confidence"]) || "high",
    raw_text: row[13] || "",
    telegram_chat_id: row[14] || "",
    telegram_message_id: row[15] || "",
    telegram_file_id: row[16] || "",
    status: (row[17] as Expense["status"]) || "confirmed",
    notes: row[18] || "",
  };
}

export async function ensureHeaders(): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const sheetId = getSheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "expenses!A1:A1",
  });

  const firstCell = res.data.values?.[0]?.[0];
  if (firstCell !== "id") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: "expenses!A1",
      valueInputOption: "RAW",
      requestBody: { values: [HEADER_ROW] },
    });
  }
}

export async function appendExpense(params: {
  extracted: ExtractedExpense;
  source: ExpenseSource;
  raw_text: string;
  telegram_chat_id: string;
  telegram_message_id: string;
  telegram_file_id: string;
}): Promise<Expense> {
  const { extracted, source, raw_text, telegram_chat_id, telegram_message_id, telegram_file_id } = params;

  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const expense: Expense = {
    id: uuidv4(),
    created_at: now,
    trip_id: TRIP_ID,
    date: extracted.date || today,
    merchant: extracted.merchant,
    item_name: extracted.item_name,
    amount: extracted.amount,
    currency: extracted.currency,
    category: extracted.category,
    payer: extracted.payer,
    split_method: extracted.split_method,
    source,
    confidence: extracted.confidence,
    raw_text,
    telegram_chat_id,
    telegram_message_id,
    telegram_file_id,
    status: extracted.confidence === "low" ? "needs_review" : "confirmed",
    notes: extracted.notes,
  };

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: getSheetId(),
    range: "expenses!A:S",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        expense.id,
        expense.created_at,
        expense.trip_id,
        expense.date,
        expense.merchant,
        expense.item_name,
        expense.amount,
        expense.currency,
        expense.category,
        expense.payer,
        expense.split_method,
        expense.source,
        expense.confidence,
        expense.raw_text,
        expense.telegram_chat_id,
        expense.telegram_message_id,
        expense.telegram_file_id,
        expense.status,
        expense.notes,
      ]],
    },
  });

  return expense;
}

export async function getAllExpenses(): Promise<Expense[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSheetId(),
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];
  return rows
    .slice(1) // skip header
    .map(rowToExpense)
    .filter((e): e is Expense => e !== null);
}

export async function isDuplicate(
  telegram_chat_id: string,
  telegram_message_id: string
): Promise<boolean> {
  const expenses = await getAllExpenses();
  return expenses.some(
    (e) =>
      e.telegram_chat_id === telegram_chat_id &&
      e.telegram_message_id === telegram_message_id
  );
}

export function computeBalance(expenses: Expense[]): BalanceSummary {
  let aston_total_paid = 0;
  let amy_total_paid = 0;
  let net_balance = 0; // positive = Amy owes Aston, negative = Aston owes Amy

  const by_category = Object.fromEntries(
    ALL_CATEGORIES.map((cat) => [cat, { total: 0, count: 0 }])
  ) as BalanceSummary["by_category"];

  for (const e of expenses) {
    const amt = e.amount;
    const cat = e.category as ExpenseCategory;

    if (by_category[cat]) {
      by_category[cat].total += amt;
      by_category[cat].count += 1;
    }

    if (e.payer === "Aston") {
      aston_total_paid += amt;
      if (e.split_method === "平分") net_balance += amt / 2;
      else if (e.split_method === "Amy only") net_balance += amt;
      // Aston only: no balance effect
    } else {
      amy_total_paid += amt;
      if (e.split_method === "平分") net_balance -= amt / 2;
      else if (e.split_method === "Aston only") net_balance -= amt;
      // Amy only: no balance effect
    }
  }

  return {
    aston_total_paid,
    amy_total_paid,
    net_balance,
    total_spend: aston_total_paid + amy_total_paid,
    count: expenses.length,
    by_category,
  };
}
