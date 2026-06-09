import { NextResponse } from "next/server";
import { getAllExpenses, computeSummary, deleteExpense } from "@/lib/sheets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const all = await getAllExpenses();
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

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    await deleteExpense(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    console.error("DELETE /api/expenses failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
