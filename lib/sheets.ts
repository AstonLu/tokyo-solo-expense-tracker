import { google } from "googleapis";
import { v4 as uuidv4 } from "uuid";
import {
  Expense,
  ExtractedExpense,
  ExpenseSource,
  DashboardSummary,
  ExpenseCategory,
  PaidBy,
  BenefitType,
  ALL_CATEGORIES,
} from "./types";
import { computeSettlement, toUsd } from "./split";

const SHEET_TAB = "expenses";
const SHEET_RANGE = `${SHEET_TAB}!A:Y`;
const PENDING_TAB = "pending_expenses";

/**
 * Column order — must match Expense field order and the documented schema.
 * Columns R–Y (paid_by … inferred_items) were appended after the original
 * Tokyo A:Q schema. Appending (never reordering) keeps old rows valid.
 */
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
  // ── Split-expense columns (R–Y) ──
  "paid_by",
  "benefit_type",
  "aston_share_amount",
  "amy_share_amount",
  "split_note",
  "missing_fields",
  "merchant_display_name_zh",
  "inferred_items",
];

export interface PendingDraft {
  draft: ExtractedExpense;
  telegram_message_id: string;
  original_text_context: string;
  image_file_reference: string;
  raw_ai_response: string;
}

// ── Auth / client helpers ─────────────────────────────────────────────────────

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

// ── Private helpers ───────────────────────────────────────────────────────────

async function getTabSheetId(
  client: ReturnType<typeof sheetsClient>,
  spreadsheetId: string,
  title: string
): Promise<number | null> {
  const res = await client.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === title);
  return sheet?.properties?.sheetId ?? null;
}

/** Creates the pending_expenses tab if it does not already exist. */
async function ensurePendingTab(
  client: ReturnType<typeof sheetsClient>,
  spreadsheetId: string
): Promise<void> {
  const id = await getTabSheetId(client, spreadsheetId, PENDING_TAB);
  if (id !== null) return;
  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: PENDING_TAB } } }],
    },
  });
}

// ── Expenses tab ─────────────────────────────────────────────────────────────

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
    // ── Split-expense columns ──
    e.paid_by,
    e.benefit_type,
    e.aston_share_amount,
    e.amy_share_amount,
    e.split_note,
    e.missing_fields.join(", "),
    e.merchant_display_name_zh,
    e.inferred_items,
  ];
}

function rowToExpense(row: string[]): Expense | null {
  if (!row[0] || row[0] === "id") return null;
  // Old A:Q rows simply lack R–Y; fall back to safe defaults.
  const paid_by = (row[17] as PaidBy) || "unknown";
  const benefit_type = (row[18] as BenefitType) || "unknown";
  return {
    id: row[0] || "",
    created_at: row[1] || "",
    source: (row[2] as ExpenseSource) || "telegram_text",
    telegram_message_id: row[3] || "",
    transaction_date: row[4] || "",
    merchant: row[5] || "",
    amount: parseFloat(row[6]) || 0,
    currency: row[7] || "USD",
    category: (row[8] as ExpenseCategory) || "其他",
    payment_method: row[9] || "",
    location: row[10] || "",
    original_text_context: row[11] || "",
    ai_summary: row[12] || "",
    confidence_score: parseFloat(row[13]) || 0,
    needs_review: String(row[14]).toUpperCase() === "TRUE",
    image_file_reference: row[15] || "",
    raw_ai_response: row[16] || "",
    paid_by: (["aston", "amy", "unknown"] as string[]).includes(paid_by) ? paid_by : "unknown",
    benefit_type: (
      ["shared_50_50", "aston_only", "amy_only", "custom", "unknown"] as string[]
    ).includes(benefit_type)
      ? benefit_type
      : "unknown",
    aston_share_amount: parseFloat(row[19]) || 0,
    amy_share_amount: parseFloat(row[20]) || 0,
    split_note: row[21] || "",
    missing_fields: row[22] ? row[22].split(",").map((s) => s.trim()).filter(Boolean) : [],
    merchant_display_name_zh: row[23] || "",
    inferred_items: row[24] || "",
  };
}

export async function ensureHeaders(): Promise<void> {
  const sheets = sheetsClient();
  const sheetId = getSheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${SHEET_TAB}!1:1`,
  });
  const current = (res.data.values?.[0] as string[] | undefined) ?? [];
  // Reconcile when missing, or when an older/shorter header (e.g. A:Q) is
  // present. Writing row 1 only touches headers, never data rows.
  const needsUpdate =
    current[0] !== "id" ||
    current.length < HEADER_ROW.length ||
    HEADER_ROW.some((h, i) => current[i] !== h);
  if (needsUpdate) {
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
  const e = params.extracted;
  const expense: Expense = {
    id: uuidv4(),
    created_at: now,
    source: params.source,
    telegram_message_id: params.telegram_message_id,
    transaction_date: e.transaction_date || now.slice(0, 10),
    merchant: e.merchant,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    payment_method: e.payment_method,
    location: e.location,
    original_text_context: params.original_text_context,
    ai_summary: e.ai_summary,
    confidence_score: e.confidence_score,
    needs_review: e.needs_review,
    image_file_reference: params.image_file_reference,
    raw_ai_response: params.raw_ai_response,
    paid_by: e.paid_by,
    benefit_type: e.benefit_type,
    aston_share_amount: e.aston_share_amount,
    amy_share_amount: e.amy_share_amount,
    split_note: e.split_note,
    missing_fields: e.missing_fields,
    merchant_display_name_zh: e.merchant_display_name_zh,
    inferred_items: e.inferred_items,
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

/**
 * Delete a single expense row by its UUID.
 * Finds the row in the expenses tab and removes it via batchUpdate.
 */
export async function deleteExpense(id: string): Promise<void> {
  const client = sheetsClient();
  const spreadsheetId = getSheetId();

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];
  // rows[0] is the header; data starts at rows[1].
  const rowIndex = rows.findIndex((r) => r[0] === id);
  if (rowIndex <= 0) throw new Error("Record not found");

  const tabId = await getTabSheetId(client, spreadsheetId, SHEET_TAB);
  if (tabId === null) throw new Error("expenses tab not found");

  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: tabId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });
}

// ── Pending drafts tab ────────────────────────────────────────────────────────
//
// Serverless functions on Vercel share no in-memory state between invocations,
// so pending drafts are persisted in a "pending_expenses" tab in the same
// Google Sheet. Each row corresponds to one chat session (keyed by chat_id).
// The tab is created automatically on first use.

/**
 * Persist (or overwrite) the pending draft for a given chat_id.
 */
export async function setPendingDraft(
  chatId: string,
  data: PendingDraft
): Promise<void> {
  const client = sheetsClient();
  const spreadsheetId = getSheetId();

  await ensurePendingTab(client, spreadsheetId);

  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `${PENDING_TAB}!A:A`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((r) => r[0] === chatId);

  const row = [
    chatId,
    new Date().toISOString(),
    JSON.stringify(data.draft),
    data.telegram_message_id,
    data.original_text_context,
    data.image_file_reference,
    data.raw_ai_response,
  ];

  if (rowIndex >= 0) {
    // Overwrite existing row (rowIndex is 0-based; Sheets notation is 1-based)
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${PENDING_TAB}!A${rowIndex + 1}:G${rowIndex + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [row] },
    });
  } else {
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `${PENDING_TAB}!A:G`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
}

/**
 * Retrieve the pending draft for a given chat_id, or null if none exists.
 * Errors are swallowed so a missing/malformed tab never breaks the bot.
 */
export async function getPendingDraft(
  chatId: string
): Promise<PendingDraft | null> {
  try {
    const client = sheetsClient();
    const spreadsheetId = getSheetId();

    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${PENDING_TAB}!A:G`,
    });

    const rows = res.data.values || [];
    const row = rows.find((r) => r[0] === chatId);
    if (!row) return null;

    return {
      draft: JSON.parse(row[2]) as ExtractedExpense,
      telegram_message_id: row[3] || "",
      original_text_context: row[4] || "",
      image_file_reference: row[5] || "",
      raw_ai_response: row[6] || "",
    };
  } catch {
    return null;
  }
}

/**
 * Delete the pending draft row for a given chat_id.
 * Silently succeeds if no draft exists.
 */
export async function clearPendingDraft(chatId: string): Promise<void> {
  try {
    const client = sheetsClient();
    const spreadsheetId = getSheetId();

    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${PENDING_TAB}!A:A`,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === chatId);
    if (rowIndex < 0) return;

    const tabId = await getTabSheetId(client, spreadsheetId, PENDING_TAB);
    if (tabId === null) return;

    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: tabId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });
  } catch {
    // Silently ignore — draft cleanup should never crash the bot
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

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

  const primary_currency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "USD";

  // ── Split totals (USD estimate) + net settlement ──
  let aston_paid_usd = 0;
  let amy_paid_usd = 0;
  let aston_share_usd = 0;
  let amy_share_usd = 0;
  for (const e of expenses) {
    const amtUsd = toUsd(e.amount, e.currency);
    if (e.paid_by === "aston") aston_paid_usd += amtUsd;
    else if (e.paid_by === "amy") amy_paid_usd += amtUsd;
    aston_share_usd += toUsd(e.aston_share_amount, e.currency);
    amy_share_usd += toUsd(e.amy_share_amount, e.currency);
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const settlement = computeSettlement(
    expenses.map((e) => ({
      amount: e.amount,
      currency: e.currency,
      paid_by: e.paid_by,
      aston_share_amount: e.aston_share_amount,
      amy_share_amount: e.amy_share_amount,
    }))
  );

  return {
    total_by_currency,
    by_category,
    primary_currency,
    total_primary: total_by_currency[primary_currency] || 0,
    count: expenses.length,
    needs_review_count,
    aston_paid_usd: round2(aston_paid_usd),
    amy_paid_usd: round2(amy_paid_usd),
    aston_share_usd: round2(aston_share_usd),
    amy_share_usd: round2(amy_share_usd),
    settlement,
  };
}
