import { NextResponse } from "next/server";
import { getAllExpenses, computeSummary } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const all = await getAllExpenses();
    // Most recent first for the dashboard.
    const transactions = [...all].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    const summary = computeSummary(all);
    return NextResponse.json({ transactions, summary });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load expenses";
    console.error("GET /api/expenses failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
